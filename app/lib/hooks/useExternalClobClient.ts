'use client';

import { useMemo } from 'react';
import { useExternalWallet } from '@/app/lib/contexts/ExternalWalletContext';
import { BrowserBuilderConfig } from '@/app/lib/browser-builder-config';
import { CLOB_API_URL } from '@/app/lib/polymarket-constants';

/**
 * ClobClient hook for external wallets (MetaMask via wagmi).
 * Return type matches usePrivyClobClient exactly so useClobClient can unify them.
 */
export function useExternalClobClient() {
  const { signer, apiCredentials, safeAddress, isReady } = useExternalWallet();

  const createClobClient = useMemo(() => {
    if (!signer || !isReady || !apiCredentials || !safeAddress) return null;

    return async () => {
      const { ClobClient } = await import('@polymarket/clob-client');
      const builderConfig = new BrowserBuilderConfig();

      return new ClobClient(
        CLOB_API_URL,
        137,
        signer,
        {
          key: apiCredentials.key,
          secret: apiCredentials.secret,
          passphrase: apiCredentials.passphrase,
        },
        2, // signatureType = 2 for EOA → Safe proxy
        safeAddress,
        undefined,
        false,
        builderConfig as any
      );
    };
  }, [signer, isReady, apiCredentials, safeAddress]);

  const ensureConditionalApproval = useMemo(() => {
    return async (_tokenId?: string) => { /* no-op — approvals checked at connect time */ };
  }, []);

  const createOrder = useMemo(() => {
    if (!createClobClient) return null;
    return async (params: { tokenID: string; side: 'BUY' | 'SELL'; size: number; price: number }) => {
      await ensureConditionalApproval(params.tokenID);
      console.log('[ExternalClobClient] Creating order:', {
        tokenID: params.tokenID,
        side: params.side,
        size: params.size,
        price: params.price,
        safeAddress,
      });
      const client = await createClobClient();
      const result = await client.createAndPostOrder({
        tokenID: params.tokenID,
        side: params.side as any,
        size: params.size,
        price: params.price,
      });
      console.log('[ExternalClobClient] Order result:', JSON.stringify(result));
      return result;
    };
  }, [createClobClient, ensureConditionalApproval, safeAddress]);

  const sellPosition = useMemo(() => {
    if (!createClobClient) return null;
    return async (params: { tokenID: string; size: number; price: number }) => {
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

  const marketSellPosition = useMemo(() => {
    if (!createClobClient) return null;
    return async (params: {
      tokenID: string;
      amount: number;
      price: number;
      slippagePct?: number;
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

  const cancelOrder = useMemo(() => {
    if (!createClobClient) return null;
    return async (orderID: string) => {
      const client = await createClobClient();
      return client.cancelOrder({ orderID });
    };
  }, [createClobClient]);

  const cancelAllOrders = useMemo(() => {
    if (!createClobClient) return null;
    return async () => {
      const client = await createClobClient();
      return client.cancelAll();
    };
  }, [createClobClient]);

  const getOpenOrders = useMemo(() => {
    if (!createClobClient) return null;
    return async () => {
      const client = await createClobClient();
      return client.getOpenOrders();
    };
  }, [createClobClient]);

  const getBalance = useMemo(() => {
    if (!createClobClient) return null;
    return async (): Promise<number> => {
      const client = await createClobClient();
      const result = await client.getBalanceAllowance({ asset_type: 'COLLATERAL' as any });
      const raw = parseFloat(result?.balance || '0');
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
    ensureApprovals: ensureConditionalApproval,
    isReady: !!createClobClient,
    safeAddress,
  };
}
