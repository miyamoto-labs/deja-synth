import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/derive-keys
 * One-time utility: derives Polymarket CLOB API credentials from a private key.
 * Used to generate system wallet credentials for server-side trading.
 *
 * Body: { privateKey: "0x..." }
 * Returns: { address, key, secret, passphrase }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { privateKey } = body;

    if (!privateKey) {
      return NextResponse.json(
        { error: 'Missing privateKey' },
        { status: 400 }
      );
    }

    const keyStr = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const wallet = new Wallet(keyStr);
    const address = wallet.address;

    // Shim: Polymarket CLOB client expects ethers v5 _signTypedData
    const signerShim = new Proxy(wallet, {
      get(target, prop, receiver) {
        if (prop === '_signTypedData') {
          return target.signTypedData.bind(target);
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const { ClobClient } = await import('@polymarket/clob-client');

    const clobClient = new ClobClient(
      'https://clob.polymarket.com',
      137,
      signerShim as any
    );

    // createOrDeriveApiKey: tries creating a new key first,
    // falls back to deriving existing if one already exists
    const credentials = await clobClient.createOrDeriveApiKey();

    if (!credentials.key || !credentials.secret || !credentials.passphrase) {
      return NextResponse.json(
        { error: 'Failed to derive API credentials from CLOB. The wallet may need to be activated on polymarket.com first.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      address,
      key: credentials.key,
      secret: credentials.secret,
      passphrase: credentials.passphrase,
    });
  } catch (err: any) {
    console.error('Derive keys error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to derive keys' },
      { status: 500 }
    );
  }
}
