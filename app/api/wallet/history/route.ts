import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// USDC.e (bridged) and native USDC on Polygon
const USDC_CONTRACTS = new Set([
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // native USDC
]);

// Etherscan V2 unified API (Polygonscan V1 is deprecated)
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
const POLYGON_CHAIN_ID = 137;

// Trade-fill functions to exclude — these are order fills, not deposits/withdrawals
const TRADE_FUNCTIONS = new Set(['matchOrders', 'fillOrder', 'fillOrKillOrder']);

interface TransferItem {
  type: 'deposit' | 'withdraw';
  amount: number;
  from: string;
  to: string;
  txHash: string;
  timestamp: string;
  tokenSymbol: string;
}

/**
 * GET /api/wallet/history?wallet=0x...
 * Returns USDC deposit/withdraw history using Etherscan V2 API.
 * Filters out trade fills (matchOrders) to only show real deposits & withdrawals.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
  }

  const apiKey = process.env.POLYGONSCAN_API_KEY || '';
  const walletLower = wallet.toLowerCase();

  try {
    const url = new URL(ETHERSCAN_V2);
    url.searchParams.set('chainid', String(POLYGON_CHAIN_ID));
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokentx');
    url.searchParams.set('address', wallet);
    url.searchParams.set('startblock', '0');
    url.searchParams.set('endblock', '99999999');
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', '100');
    if (apiKey) {
      url.searchParams.set('apikey', apiKey);
    }

    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    const data = await res.json();

    if (data.status !== '1' || !Array.isArray(data.result)) {
      console.log('[wallet/history] Etherscan V2 returned:', data.status, data.message);
      return NextResponse.json({ transfers: [] });
    }

    const transfers: TransferItem[] = [];

    for (const tx of data.result) {
      // Only USDC tokens
      if (!USDC_CONTRACTS.has(tx.contractAddress?.toLowerCase())) continue;

      // Parse the function name (e.g. "matchOrders(...)" → "matchOrders")
      const fnRaw = tx.functionName || '';
      const fnName = fnRaw.split('(')[0];

      // Skip trade fills — these are Polymarket order matches, not deposits/withdrawals
      if (TRADE_FUNCTIONS.has(fnName)) continue;

      const isIncoming = tx.to?.toLowerCase() === walletLower;
      const decimals = parseInt(tx.tokenDecimal) || 6;
      const amount = parseInt(tx.value) / Math.pow(10, decimals);
      if (amount <= 0) continue;

      transfers.push({
        type: isIncoming ? 'deposit' : 'withdraw',
        amount,
        from: tx.from?.toLowerCase() || '',
        to: tx.to?.toLowerCase() || '',
        txHash: tx.hash,
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        tokenSymbol: tx.tokenSymbol || 'USDC',
      });
    }

    console.log(
      `[wallet/history] ${wallet.slice(0, 10)}... — ${data.result.length} raw txs → ${transfers.length} transfers`,
    );

    return NextResponse.json({ transfers });
  } catch (err: any) {
    console.error('[wallet/history] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch transfer history' },
      { status: 500 }
    );
  }
}
