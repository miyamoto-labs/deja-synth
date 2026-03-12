import { NextRequest, NextResponse } from 'next/server';
import { buildHmacSignature } from '@polymarket/builder-signing-sdk';

export const dynamic = 'force-dynamic';

/**
 * POST /api/polymarket/sign
 * Server-side builder HMAC signing endpoint.
 * Called by the ClobClient/RelayClient via remoteBuilderConfig.
 * Builder credentials stay server-side; client only gets the HMAC headers.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, path, body: requestBody } = body;

    console.log('[polymarket/sign] Request:', { method, path, bodyLength: requestBody?.length ?? 0, bodyPreview: typeof requestBody === 'string' ? requestBody.substring(0, 100) : typeof requestBody });

    const key = process.env.POLY_BUILDER_API_KEY;
    const secret = process.env.POLY_BUILDER_SECRET;
    const passphrase = process.env.POLY_BUILDER_PASSPHRASE;

    if (!key || !secret || !passphrase) {
      console.error('[polymarket/sign] Builder credentials missing:', { hasKey: !!key, hasSecret: !!secret, hasPassphrase: !!passphrase });
      return NextResponse.json(
        { error: 'Builder credentials not configured' },
        { status: 500 }
      );
    }

    if (!method || !path) {
      return NextResponse.json(
        { error: 'Missing required parameters: method, path' },
        { status: 400 }
      );
    }

    // Unix seconds — must match @polymarket/builder-signing-sdk's BuilderSigner
    const sigTimestamp = Math.floor(Date.now() / 1000).toString();

    const signature = buildHmacSignature(
      secret,
      parseInt(sigTimestamp),
      method,
      path,
      requestBody
    );

    console.log('[polymarket/sign] Returning headers:', { POLY_BUILDER_API_KEY: key.substring(0, 8) + '...', POLY_BUILDER_TIMESTAMP: sigTimestamp, sigLength: signature.length });

    return NextResponse.json({
      POLY_BUILDER_SIGNATURE: signature,
      POLY_BUILDER_TIMESTAMP: sigTimestamp,
      POLY_BUILDER_API_KEY: key,
      POLY_BUILDER_PASSPHRASE: passphrase,
    });
  } catch (error: any) {
    console.error('Builder signing error:', error);
    return NextResponse.json(
      { error: 'Failed to sign message' },
      { status: 500 }
    );
  }
}
