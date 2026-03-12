import type { TradeTarget } from '@/app/components/ui/TradePanel';
import { BrowserProvider } from 'ethers';

/* ── Quick Execute ─────────────────────────────── */
// Client-side trade execution with MetaMask signing.
// Used by PickCard quick-buy buttons.
// TradePanel uses the useTradeExecution hook directly instead.

export interface QuickExecuteParams {
  walletAddress: string;
  target: TradeTarget;
  amount: number;
}

export interface QuickExecuteResult {
  success: boolean;
  orderID?: string;
  message?: string;
  error?: string;
}

// Module-level credential cache (shared across calls in same page session)
let _credsCache: { key: string; secret: string; passphrase: string } | null = null;

export async function quickExecute(
  params: QuickExecuteParams
): Promise<QuickExecuteResult> {
  const { walletAddress, target, amount } = params;

  try {
    // ── Resolve tokenId & price from target ───
    let tokenId: string;
    let price: number;

    if (target.type === 'pick' && target.pick) {
      const market = target.pick.market;
      if (!market) {
        return { success: false, error: 'Market data missing — cannot place order' };
      }
      if (target.side === 'YES') {
        tokenId = market.yes_token;
        price = market.yes_price;
      } else {
        tokenId = market.no_token;
        price = market.no_price;
      }
    } else if (target.type === 'signal' && target.signal) {
      tokenId = target.signal.market_id;
      price = target.signal.price;
    } else {
      return { success: false, error: 'Invalid trade target' };
    }

    if (!tokenId) {
      return { success: false, error: 'Token ID not available for this market' };
    }

    // ── 1. Get MetaMask signer ──────────────
    if (!window.ethereum) {
      return { success: false, error: 'No wallet detected. Please install MetaMask.' };
    }

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // ── 2. Fetch API creds (cached) ─────────
    if (!_credsCache) {
      const credsRes = await fetch(`/api/wallet/creds?wallet=${walletAddress}`);
      if (!credsRes.ok) {
        const err = await credsRes.json().catch(() => ({}));
        return { success: false, error: err.error || 'Failed to fetch credentials' };
      }
      _credsCache = await credsRes.json();
    }

    // ── 3. Create ClobClient & sign order ───
    // Shim: Polymarket CLOB client expects ethers v5 _signTypedData,
    // but ethers v6 uses signTypedData (no underscore).
    const signerShim = new Proxy(signer, {
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
      signerShim as any,
      {
        key: _credsCache!.key,
        secret: _credsCache!.secret,
        passphrase: _credsCache!.passphrase,
      }
    );

    const size = amount / price;
    const signedOrder = await clobClient.createOrder({
      tokenID: tokenId,
      side: 'BUY' as any,
      size,
      price,
    });

    // ── 4. Submit signed order to server ────
    const res = await fetch('/api/trade/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signedOrder,
        walletAddress,
        direction: target.side,
        amount,
        price,
        source: target.type,
        sourceId: target.type === 'pick' ? target.pick?.id : target.signal?.id,
        marketSlug: target.type === 'pick' ? target.pick?.slug : target.signal?.market_id || null,
      }),
    });

    const result = await res.json();

    if (result.success) {
      return {
        success: true,
        orderID: result.orderID || '',
        message: result.message || `Order placed: BUY $${amount} at ${(price * 100).toFixed(0)}¢`,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Order failed',
      };
    }
  } catch (err: any) {
    // Handle MetaMask rejection
    if (err.code === 4001 || err.message?.includes('rejected')) {
      return { success: false, error: 'Transaction rejected in wallet' };
    }
    // Clear cached creds on auth errors
    if (err.message?.includes('401') || err.message?.includes('credential')) {
      _credsCache = null;
    }
    return {
      success: false,
      error: err.message || 'Something went wrong',
    };
  }
}
