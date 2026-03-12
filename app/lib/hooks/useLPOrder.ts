'use client';

import { useCallback } from 'react';
import { useClobClient } from './useClobClient';

interface LPOrderParams {
  yesTokenId: string;
  noTokenId: string;
  amount: number;    // total USDC to deploy (split evenly)
  yesPrice: number;  // limit price for YES token (0–1)
  noPrice: number;   // limit price for NO token (0–1)
}

interface LPOrderResult {
  yesResult: PromiseSettledResult<any>;
  noResult: PromiseSettledResult<any>;
}

export function useLPOrder() {
  const { createOrder, isReady, safeAddress } = useClobClient();

  const placeLPOrders = useCallback(
    async (params: LPOrderParams): Promise<LPOrderResult> => {
      if (!createOrder) throw new Error("Wallet not connected");

      const halfAmount = params.amount / 2;

      // Place both limit orders in parallel
      const [yesResult, noResult] = await Promise.allSettled([
        createOrder({
          tokenID: params.yesTokenId,
          side: 'BUY',
          size: halfAmount,
          price: params.yesPrice,
        }),
        createOrder({
          tokenID: params.noTokenId,
          side: 'BUY',
          size: halfAmount,
          price: params.noPrice,
        }),
      ]);

      return { yesResult, noResult };
    },
    [createOrder]
  );

  return { placeLPOrders, isReady, safeAddress };
}
