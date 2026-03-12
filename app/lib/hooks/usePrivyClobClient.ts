'use client';

import { useMemo } from 'react';
import { usePrivyWallet } from '@/app/lib/contexts/PrivyWalletContext';
import { useTradingSession } from './useTradingSession';
import { BrowserBuilderConfig } from '@/app/lib/browser-builder-config';
import { CLOB_API_URL } from '@/app/lib/polymarket-constants';

/* ── Hook ──────────────────────────────────────── */
/**
 * Creates an authenticated ClobClient using the Privy embedded wallet.
 * Returns null until the trading session is fully initialized.
 *
 * COLLATERAL (USDC) approvals are set during session init in useTradingSession.
 * CONDITIONAL (CTF) approvals are set at trade-time here, because the CLOB
 * requires a specific token_id for ERC-1155 operations.
 *
 * Usage:
 *   const { createOrder } = usePrivyClobClient();
 *   if (createOrder) await createOrder({ tokenID, side, size, price });
 */
export function usePrivyClobClient() {
  const { ethersSigner } = usePrivyWallet();
  const { session, isComplete } = useTradingSession();

  const createClobClient = useMemo(() => {
    if (!ethersSigner || !isComplete || !session?.apiCredentials || !session?.safeAddress) {
      return null;
    }

    return async () => {
      const { ClobClient } = await import('@polymarket/clob-client');

      const builderConfig = new BrowserBuilderConfig();

      return new ClobClient(
        CLOB_API_URL,
        137,
        ethersSigner as any,
        {
          key: session.apiCredentials!.key,
          secret: session.apiCredentials!.secret,
          passphrase: session.apiCredentials!.passphrase,
        },
        2, // signatureType = 2 for EOA → Safe proxy
        session.safeAddress, // funderAddress (Safe holds the USDC)
        undefined, // geoBlockToken
        false, // useServerTime
        builderConfig as any
      );
    };
  }, [ethersSigner, isComplete, session]);

  // Approvals are handled in useTradingSession via relayClient.execute() batch.
  // setApprovalForAll covers ALL token_ids, so no per-token approval needed.
  const ensureConditionalApproval = useMemo(() => {
    return async (_tokenId?: string) => { /* no-op */ };
  }, []);

  // Convenience: create and place an order
  // Ensures CONDITIONAL approval for the specific token before trading
  const createOrder = useMemo(() => {
    if (!createClobClient || !ensureConditionalApproval) return null;

    return async (params: {
      tokenID: string;
      side: 'BUY' | 'SELL';
      size: number;
      price: number;
    }) => {
      // Ensure CONDITIONAL approval for this specific token
      await ensureConditionalApproval(params.tokenID);

      const client = await createClobClient();
      return client.createAndPostOrder({
        tokenID: params.tokenID,
        side: params.side as any,
        size: params.size,
        price: params.price,
      });
    };
  }, [createClobClient, ensureConditionalApproval]);

  // Convenience: sell/close a position (GTC limit order)
  const sellPosition = useMemo(() => {
    if (!createClobClient || !ensureConditionalApproval) return null;

    return async (params: {
      tokenID: string;
      size: number;
      price: number;
    }) => {
      await ensureConditionalApproval(params.tokenID);

      const client = await createClobClient();
      return client.createAndPostOrder({
        tokenID: params.tokenID,
        side: 'SELL' as any,
        size: params.size,
        price: params.price,
      });
    };
  }, [createClobClient, ensureConditionalApproval]);

  // Convenience: market sell — GTC limit order with user's slippage for reliable fills.
  // FOK orders fail when orderbook lacks sufficient liquidity.
  const marketSellPosition = useMemo(() => {
    if (!createClobClient || !ensureConditionalApproval) return null;

    return async (params: {
      tokenID: string;
      amount: number;      // shares to sell
      price: number;       // current market price (used for slippage calc)
      slippagePct?: number; // user's sell tolerance (e.g. 15 = 15%), default 15
    }) => {
      await ensureConditionalApproval(params.tokenID);

      const slippage = (params.slippagePct || 15) / 100;
      const limitPrice = Math.max(
        Math.floor(params.price * (1 - slippage) * 100) / 100,
        0.01,
      );

      const client = await createClobClient();
      return client.createAndPostOrder({
        tokenID: params.tokenID,
        side: 'SELL' as any,
        size: Math.floor(params.amount * 100) / 100,
        price: limitPrice,
      });
    };
  }, [createClobClient, ensureConditionalApproval]);

  // Convenience: cancel a single open order by its CLOB order ID
  const cancelOrder = useMemo(() => {
    if (!createClobClient) return null;

    return async (orderID: string) => {
      const client = await createClobClient();
      return client.cancelOrder({ orderID });
    };
  }, [createClobClient]);

  // Convenience: cancel ALL open orders
  const cancelAllOrders = useMemo(() => {
    if (!createClobClient) return null;

    return async () => {
      const client = await createClobClient();
      return client.cancelAll();
    };
  }, [createClobClient]);

  // Convenience: fetch all open (LIVE) orders from the CLOB
  const getOpenOrders = useMemo(() => {
    if (!createClobClient) return null;

    return async () => {
      const client = await createClobClient();
      return client.getOpenOrders();
    };
  }, [createClobClient]);

  // Convenience: get USDC balance
  const getBalance = useMemo(() => {
    if (!createClobClient) return null;

    return async (): Promise<number> => {
      const client = await createClobClient();
      const result = await client.getBalanceAllowance({
        asset_type: 'COLLATERAL' as any,
      });
      const raw = parseFloat(result?.balance || '0');
      // CLOB always returns micro-USDC (6 decimals)
      return raw / 1_000_000;
    };
  }, [createClobClient]);

  return {
    createClobClient,
    createOrder,
    sellPosition,
    marketSellPosition,
    cancelOrder,
    cancelAllOrders,
    getOpenOrders,
    getBalance,
    ensureApprovals: ensureConditionalApproval, // backwards compat
    isReady: !!createClobClient,
    safeAddress: session?.safeAddress,
  };
}
