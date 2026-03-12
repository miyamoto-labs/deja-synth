'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPublicClient, http, fallback, erc20Abi } from 'viem';
import { polygon } from 'viem/chains';
import { useUserStore } from '@/app/lib/stores/user-store';

/* ── Constants ─────────────────────────────────── */

// USDC contracts on Polygon
const USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const;
const USDC_BRIDGED = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;

const POLL_INTERVAL = 30_000; // 30s

const client = createPublicClient({
  chain: polygon,
  transport: fallback([
    http('https://polygon-bor-rpc.publicnode.com'),
    http('https://polygon.llamarpc.com'),
    http('https://polygon-rpc.com'),
  ]),
});

function formatUsd(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Reads on-chain USDC + USDC.e balances for the user's wallet on Polygon.
 * This shows actual tokens in the Safe wallet, separate from Polymarket CLOB balance.
 */
export function useOnchainBalance() {
  const { walletAddress, isConnected } = useUserStore();
  const [usdc, setUsdc] = useState<number | null>(null);
  const [usdce, setUsdce] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      setUsdc(null);
      setUsdce(null);
      return;
    }

    try {
      setLoading(true);
      const addr = walletAddress as `0x${string}`;

      const [rawUsdc, rawUsdce] = await Promise.all([
        client.readContract({
          address: USDC_NATIVE,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [addr],
        }),
        client.readContract({
          address: USDC_BRIDGED,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [addr],
        }),
      ]);

      setUsdc(Number(rawUsdc) / 1e6);
      setUsdce(Number(rawUsdce) / 1e6);
    } catch (err) {
      console.warn('[useOnchainBalance] Error reading on-chain balances:', err);
    } finally {
      setLoading(false);
    }
  }, [isConnected, walletAddress]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setUsdc(null);
      setUsdce(null);
      return;
    }

    fetchBalances();
    intervalRef.current = setInterval(fetchBalances, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBalances, isConnected, walletAddress]);

  const total = usdc !== null && usdce !== null ? usdc + usdce : null;

  return {
    usdc,
    usdce,
    total,
    loading,
    refetch: fetchBalances,
    formatted: total !== null ? formatUsd(total) : null,
    formattedUsdc: usdc !== null ? formatUsd(usdc) : null,
    formattedUsdce: usdce !== null ? formatUsd(usdce) : null,
  };
}
