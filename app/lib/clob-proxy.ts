/**
 * CLOB Proxy — Submit orders to Polymarket CLOB through a residential proxy.
 *
 * Polymarket geoblocks all cloud/datacenter IPs. This module routes CLOB
 * order submissions through a residential proxy (e.g. Decodo) so server-side
 * execution works from Vercel.
 *
 * Set CLOB_PROXY_URL in env to enable:
 *   CLOB_PROXY_URL=http://user:pass@gate.decodo.com:7777
 *
 * If not set, falls back to direct fetch (will 403 from cloud IPs).
 */

import crypto from 'crypto';

const CLOB_HOST = 'https://clob.polymarket.com';

export interface ClobSubmitResult {
  ok: boolean;
  status: number;
  data: any;
}

/**
 * Submit a pre-signed order to Polymarket CLOB.
 * Uses Decodo residential proxy if CLOB_PROXY_URL env is set.
 */
export async function submitOrderToCLOB(opts: {
  signedOrder: any;
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
  walletAddress: string;
  orderType?: string;
}): Promise<ClobSubmitResult> {
  const {
    signedOrder,
    apiKey,
    apiSecret,
    apiPassphrase,
    walletAddress,
    orderType = 'GTC',
  } = opts;

  // Convert numeric side (0=BUY, 1=SELL from @polymarket/order-utils)
  // to string ("BUY"/"SELL") expected by the CLOB API.
  // The SDK's orderToJson() does this conversion internally, but since
  // we're constructing the payload manually for proxy routing, we must
  // do it ourselves.
  const sideStr: string =
    signedOrder.side === 0 || signedOrder.side === 'BUY'
      ? 'BUY'
      : 'SELL';

  // Build order payload (matches SDK's orderToJson format exactly)
  const orderPayload = {
    deferExec: false,
    order: {
      salt:
        typeof signedOrder.salt === 'string'
          ? parseInt(signedOrder.salt, 10)
          : signedOrder.salt,
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: signedOrder.taker,
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      side: sideStr,
      expiration: signedOrder.expiration,
      nonce: signedOrder.nonce,
      feeRateBps: signedOrder.feeRateBps,
      signatureType: signedOrder.signatureType,
      signature: signedOrder.signature,
    },
    owner: apiKey,
    orderType,
  };

  const orderBody = JSON.stringify(orderPayload);
  const timestamp = Math.floor(Date.now() / 1000);
  const method = 'POST';
  const requestPath = '/order';

  const hmacSignature = buildHmacSignature(
    apiSecret,
    timestamp,
    method,
    requestPath,
    orderBody,
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    POLY_ADDRESS: walletAddress.toLowerCase(),
    POLY_SIGNATURE: hmacSignature,
    POLY_TIMESTAMP: `${timestamp}`,
    POLY_API_KEY: apiKey,
    POLY_PASSPHRASE: apiPassphrase,
  };

  // Builder attribution
  const builderKey = process.env.POLY_BUILDER_API_KEY;
  const builderSecret = process.env.POLY_BUILDER_SECRET;
  const builderPassphrase = process.env.POLY_BUILDER_PASSPHRASE;
  if (builderKey && builderSecret && builderPassphrase) {
    headers['POLY_BUILDER_API_KEY'] = builderKey;
    headers['POLY_BUILDER_PASSPHRASE'] = builderPassphrase;
    headers['POLY_BUILDER_SIGNATURE'] = buildHmacSignature(
      builderSecret,
      timestamp,
      method,
      requestPath,
      orderBody,
    );
    headers['POLY_BUILDER_TIMESTAMP'] = `${timestamp}`;
  }

  // Submit — proxy if available, direct otherwise
  const proxyUrl = process.env.CLOB_PROXY_URL;
  const url = `${CLOB_HOST}${requestPath}`;

  let status: number;
  let data: any;
  const tSubmitStart = Date.now();
  let totalAttempts = 0;

  if (proxyUrl) {
    // Use undici ProxyAgent for residential proxy support.
    // Parse credentials manually to handle special chars (=, +, etc.) in passwords
    // that break URL parsing in undici's ProxyAgent.
    const { ProxyAgent, request } = await import('undici');

    const parsed = new URL(proxyUrl);
    const proxyOrigin = `${parsed.protocol}//${parsed.host}`;
    const proxyToken = parsed.username
      ? `Basic ${Buffer.from(`${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`).toString('base64')}`
      : undefined;

    // Retry up to 3 times on 403 — each new ProxyAgent gets a fresh IP
    // from the residential pool, which may clear the geoblock.
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const tAttempt = Date.now();
      totalAttempts++;
      const agent = new ProxyAgent({
        uri: proxyOrigin,
        token: proxyToken,
      });
      const res = await request(url, {
        method: 'POST',
        headers,
        body: orderBody,
        dispatcher: agent,
      });
      status = res.statusCode;
      data = await res.body.json().catch(() => ({}));

      console.log(`[clob-proxy] attempt=${attempt + 1}/${MAX_RETRIES + 1} status=${status} duration_ms=${Date.now() - tAttempt} proxy=true`);

      if (status !== 403 || attempt === MAX_RETRIES) break;
      // Brief pause before retry with a fresh proxy IP
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
    }
  } else {
    totalAttempts = 1;
    const tAttempt = Date.now();
    const res = await fetch(url, { method, headers, body: orderBody });
    status = res.status;
    data = await res.json().catch(() => ({}));
    console.log(`[clob-proxy] attempt=1/1 status=${status} duration_ms=${Date.now() - tAttempt} proxy=false`);
  }

  const success = status >= 200 && status < 300;
  console.log(`[clob-proxy] total_attempts=${totalAttempts} total_ms=${Date.now() - tSubmitStart} success=${success}`);

  return { ok: success, status, data };
}

/** Build Polymarket CLOB HMAC signature (same as SDK) */
function buildHmacSignature(
  secret: string,
  timestamp: number,
  method: string,
  requestPath: string,
  body?: string,
): string {
  let message = `${timestamp}${method}${requestPath}`;
  if (body !== undefined) message += body;

  const keyBuffer = Buffer.from(
    secret.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );

  const sig = crypto
    .createHmac('sha256', keyBuffer)
    .update(message)
    .digest('base64');

  return sig.replace(/\+/g, '-').replace(/\//g, '_');
}
