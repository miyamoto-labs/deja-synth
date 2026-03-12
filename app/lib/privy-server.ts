import { decrypt } from './crypto';

/**
 * Privy Server SDK utilities for server-side order signing.
 *
 * Privy social login users (Twitter/Google) have an embedded wallet whose
 * private key is managed by Privy. They DON'T have `encrypted_private_key`
 * in ep_users. This module lets the copytrade processor sign CLOB orders
 * via Privy's server API, so these users can copy-trade without keeping
 * a browser tab open.
 *
 * Requirements:
 *   - NEXT_PUBLIC_PRIVY_APP_ID  (already set for the frontend)
 *   - PRIVY_APP_SECRET          (from Privy Dashboard → Settings → API Keys)
 *   - User's embedded wallet must be Privy-managed (default for social login)
 */

let privyInstance: any = null;

/** Singleton Privy server client. */
async function getPrivyClient() {
  if (privyInstance) return privyInstance;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Missing PRIVY_APP_ID or PRIVY_APP_SECRET env vars');
  }

  const { PrivyClient } = await import('@privy-io/node');
  privyInstance = new PrivyClient({ appId, appSecret });
  return privyInstance;
}

/**
 * Convert ethers-style _signTypedData(domain, types, value) args
 * to Privy's API format for eth_signTypedData_v4.
 *
 * ethers passes:
 *   domain  — { name, version, chainId, verifyingContract, salt }
 *   types   — { Order: [...fields], ... }  (NO EIP712Domain)
 *   value   — the message object
 *
 * Privy expects:
 *   typed_data.domain   — serialized domain
 *   typed_data.types    — includes EIP712Domain type array
 *   typed_data.primary_type — first key in `types`
 *   typed_data.message  — serialized message
 */
function buildPrivyTypedData(domain: any, types: any, value: any) {
  // Build EIP712Domain type from the domain fields present
  const domainTypes: { name: string; type: string }[] = [];
  if (domain.name !== undefined) domainTypes.push({ name: 'name', type: 'string' });
  if (domain.version !== undefined) domainTypes.push({ name: 'version', type: 'string' });
  if (domain.chainId !== undefined) domainTypes.push({ name: 'chainId', type: 'uint256' });
  if (domain.verifyingContract !== undefined) domainTypes.push({ name: 'verifyingContract', type: 'address' });
  if (domain.salt !== undefined) domainTypes.push({ name: 'salt', type: 'bytes32' });

  // Serialize domain (BigInt → Number for chainId)
  const serializedDomain: Record<string, unknown> = { ...domain };
  if (serializedDomain.chainId !== undefined) {
    serializedDomain.chainId = Number(serializedDomain.chainId);
  }

  // Serialize message (BigInt → string)
  const serializedMessage: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    serializedMessage[k] = typeof v === 'bigint' ? v.toString() : v;
  }

  // Primary type is the first non-EIP712Domain type
  const primaryType = Object.keys(types)[0];

  return {
    domain: serializedDomain,
    types: { EIP712Domain: domainTypes, ...types },
    primary_type: primaryType,
    message: serializedMessage,
  };
}

// Cache: eoaAddress → { walletId, timestamp } (avoids repeated API lookups within a single request)
// TTL: 5 minutes — prevents stale IDs if Privy rotates wallet IDs during migrations
const walletIdCache = new Map<string, { id: string; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolve the Privy internal wallet ID for a given EOA address.
 * Looks up the user by wallet address and finds their embedded ETH wallet.
 */
async function resolvePrivyWalletId(privy: any, eoaAddress: string): Promise<string> {
  const key = eoaAddress.toLowerCase();
  const cached = walletIdCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.id;

  // privy.users() returns a PrivyUsersService with getByWalletAddress()
  const user = await privy.users().getByWalletAddress({ address: key });
  if (!user) {
    throw new Error(`No Privy user found for EOA ${eoaAddress}`);
  }

  // Find the Ethereum embedded wallet in linked_accounts
  const embeddedWallet = (user.linked_accounts || []).find(
    (a: any) =>
      a.type === 'wallet' &&
      a.connector_type === 'embedded' &&
      a.chain_type === 'ethereum' &&
      a.id,
  );

  if (!embeddedWallet?.id) {
    throw new Error(
      `No embedded wallet with ID found for Privy user ${user.id}. ` +
      `The wallet may not support server-side signing (delegated=${embeddedWallet?.delegated}).`,
    );
  }

  console.log(
    `[Privy] Resolved wallet for EOA ${eoaAddress}: id=${embeddedWallet.id}, ` +
    `delegated=${embeddedWallet.delegated}, address=${embeddedWallet.address}`,
  );

  walletIdCache.set(key, { id: embeddedWallet.id, ts: Date.now() });
  return embeddedWallet.id;
}

/**
 * Creates a ClobClient that uses Privy's server SDK for EIP-712 signing.
 *
 * For users who logged in via social auth (Twitter/Google) and have a
 * Privy-managed embedded wallet. Uses signatureType=2 (POLY_GNOSIS_SAFE)
 * because the EOA signs orders but the Safe holds the funds.
 *
 * @param eoaAddress         The user's EOA address (Privy embedded wallet)
 * @param safeAddress        The user's Safe proxy address (holds USDC)
 * @param encryptedApiKey    Encrypted CLOB API key
 * @param encryptedApiSecret Encrypted CLOB API secret
 * @param encryptedApiPassphrase Encrypted CLOB API passphrase
 * @param builderConfig      Optional builder attribution config
 */
export async function createPrivyClobClient(
  eoaAddress: string,
  safeAddress: string,
  encryptedApiKey: string,
  encryptedApiSecret: string,
  encryptedApiPassphrase: string,
  builderConfig?: any,
) {
  const privy = await getPrivyClient();
  const apiKey = decrypt(encryptedApiKey);
  const apiSecret = decrypt(encryptedApiSecret);
  const apiPassphrase = decrypt(encryptedApiPassphrase);

  // Resolve the Privy wallet ID for this EOA
  const walletId = await resolvePrivyWalletId(privy, eoaAddress);

  // Strip whitespace/newlines from authorization key (Vercel env vars sometimes add trailing \n)
  const rawAuthKey = process.env.PRIVY_AUTHORIZATION_KEY;
  const authPrivateKey = rawAuthKey?.trim() || undefined;

  // Create a signer object that the ClobClient can use.
  // The ClobClient only needs getAddress() and _signTypedData().
  const privySigner = {
    getAddress: async () => eoaAddress,
    _signTypedData: async (domain: any, types: any, value: any) => {
      const typedData = buildPrivyTypedData(domain, types, value);

      // Build the signTypedData request options.
      // If we have an authorization key, ALWAYS include it — works for both
      // delegated and non-delegated wallets (avoids a wasted 401 round-trip).
      const signOpts: any = {
        params: { typed_data: typedData },
      };
      if (authPrivateKey) {
        signOpts.authorization_context = {
          authorization_private_keys: [authPrivateKey],
        };
      }

      console.log(
        `[Privy] signTypedData: walletId=${walletId}, hasAuthKey=${!!authPrivateKey}, ` +
        `authKeyLen=${authPrivateKey?.length || 0}, primaryType=${typedData.primary_type}`,
      );

      let result: any;
      try {
        result = await privy.wallets().ethereum().signTypedData(walletId, signOpts);
      } catch (err: any) {
        // Privy SDK throws APIError with .status and .error properties
        const errStatus = err?.status;
        const errMsg = err?.message || '';
        const errBody = err?.error || err?.body || '';
        console.error(
          `[Privy] signTypedData FAILED: status=${errStatus}, walletId=${walletId}, ` +
          `hasAuthKey=${!!authPrivateKey}, authKeyLen=${authPrivateKey?.length || 0}, ` +
          `message=${errMsg.slice(0, 300)}, ` +
          `body=${typeof errBody === 'string' ? errBody.slice(0, 200) : JSON.stringify(errBody).slice(0, 200)}`,
        );

        const hint = !authPrivateKey
          ? ' (PRIVY_AUTHORIZATION_KEY not set — set it to enable server-side signing)'
          : errStatus === 401
            ? ' (Auth key may be wrong or not registered in Privy Dashboard)'
            : '';
        throw new Error(
          `Privy signTypedData ${errStatus}: ${errMsg.slice(0, 200)}${hint}`,
        );
      }

      const sig = result?.signature;
      if (!sig) {
        throw new Error(`Privy signTypedData returned no signature: ${JSON.stringify(result)}`);
      }
      console.log(`[Privy] signTypedData OK: sig=${sig.substring(0, 20)}...`);
      return sig;
    },
    // Some CLOB internals also check signTypedData (without underscore)
    signTypedData: undefined as any, // set below
  };
  privySigner.signTypedData = privySigner._signTypedData;

  const { ClobClient } = await import('@polymarket/clob-client');

  return new ClobClient(
    'https://clob.polymarket.com',
    137,
    privySigner as any,
    { key: apiKey, secret: apiSecret, passphrase: apiPassphrase },
    2,             // signatureType = POLY_GNOSIS_SAFE (EOA → Safe proxy)
    safeAddress,   // funderAddress (Safe holds the USDC)
    undefined,     // geoBlockToken
    undefined,     // useServerTime
    builderConfig,
  );
}

/**
 * Check if Privy server signing is available (env vars configured).
 */
export function isPrivyServerAvailable(): boolean {
  // Delegated wallets only need appId + appSecret (no authorization key required)
  return !!(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}
