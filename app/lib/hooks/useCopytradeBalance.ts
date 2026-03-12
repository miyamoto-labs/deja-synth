'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPublicClient, http, fallback, erc20Abi } from 'viem';
import { polygon } from 'viem/chains';

// Polymarket uses bridged USDC (USDC.e) on Polygon
const USDC_BRIDGED = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;
const POLL_INTERVAL = 30_000;

const client = createPublicClient({
  chain: polygon,
  transport: fallback([
    http('https://polygon-bor-rpc.publicnode.com'),
    http('https://polygon.llamarpc.com'),
    http('https://polygon-rpc.com'),
  ]),
});

/**
 * Reads the USDC.e balance for a copytrade wallet address on Polygon.
 * Polls every 30s while the address is set.
 */
export function useCopytradeBalance(address: string | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }

    try {
      setLoading(true);
      const raw = await client.readContract({
        address: USDC_BRIDGED,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });
      setBalance(Number(raw) / 1e6);
    } catch (err) {
      console.warn('[useCopytradeBalance] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }

    fetchBalance();
    intervalRef.current = setInterval(fetchBalance, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBalance, address]);

  const formatted = balance !== null
    ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  return { balance, loading, formatted, refetch: fetchBalance };
}
