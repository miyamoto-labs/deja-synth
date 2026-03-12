import { Wallet } from 'ethers';
import { decrypt } from './crypto';

/**
 * Creates a ClobClient with a real server-side signer for placing orders
 * without any MetaMask popups.
 *
 * The user's encrypted private key is stored during onboarding and
 * decrypted here to create an ethers Wallet that can sign EIP-712
 * typed data for Polymarket CLOB orders.
 */
export async function createServerClobClient(
  encryptedPrivateKey: string,
  encryptedApiKey: string,
  encryptedApiSecret: string,
  encryptedApiPassphrase: string,
  builderConfig?: any,
  safeWalletAddress?: string,  // For Gnosis Safe users: the Safe address that holds USDC
) {
  const privateKey = decrypt(encryptedPrivateKey);
  const apiKey = decrypt(encryptedApiKey);
  const apiSecret = decrypt(encryptedApiSecret);
  const apiPassphrase = decrypt(encryptedApiPassphrase);

  const wallet = new Wallet(privateKey);

  // Shim: Polymarket CLOB client expects ethers v5 signer with _signTypedData,
  // but ethers v6 Wallet uses signTypedData (no underscore).
  const signerShim = new Proxy(wallet, {
    get(target, prop, receiver) {
      if (prop === '_signTypedData') {
        return target.signTypedData.bind(target);
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  const { ClobClient } = await import('@polymarket/clob-client');

  // For Safe wallet users: signatureType=2 (POLY_GNOSIS_SAFE), funder=Safe address
  // The EOA's key signs orders, but the Safe wallet is the actual trader/funder
  const signatureType = safeWalletAddress ? 2 : undefined;  // 2 = POLY_GNOSIS_SAFE
  const funderAddress = safeWalletAddress || undefined;

  return new ClobClient(
    'https://clob.polymarket.com',
    137,
    signerShim as any,
    { key: apiKey, secret: apiSecret, passphrase: apiPassphrase },
    signatureType,
    funderAddress,
    undefined, // geoBlockToken
    undefined, // useServerTime
    builderConfig,
  );
}

/**
 * Creates the BuilderConfig for Polymarket builder attribution.
 * Returns undefined if builder credentials are not configured.
 */
export async function getBuilderConfig() {
  const builderKey = process.env.POLY_BUILDER_API_KEY;
  const builderSecret = process.env.POLY_BUILDER_SECRET;
  const builderPassphrase = process.env.POLY_BUILDER_PASSPHRASE;

  if (!builderKey || !builderSecret || !builderPassphrase) return undefined;

  const { BuilderConfig } = await import('@polymarket/builder-signing-sdk');

  return new BuilderConfig({
    localBuilderCreds: {
      key: builderKey,
      secret: builderSecret,
      passphrase: builderPassphrase,
    },
  });
}
