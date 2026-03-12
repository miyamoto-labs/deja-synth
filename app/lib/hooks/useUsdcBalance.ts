'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useClobClient } from './useClobClient';
import { useUserStore } from '@/app/lib/stores/user-store';

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Client-side hook to fetch the user's USDC balance on Polymarket.
 *
 * Only fetches when the ClobClient is ready (trading session complete).
 * Uses the authenticated ClobClient to call getBalanceAllowance().
 * Falls back to the server-side /api/wallet/balance endpoint only when
 * the ClobClient call itself fails (not when the client isn't ready yet).
 * Polls every 30s while active.
 */
export function useUsdcBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { createClobClient, isReady, safeAddress } = useClobClient();
  const { walletAddress, isConnected } = useUserStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      setBalance(null);
      return;
    }

    // Don't attempt anything until the ClobClient is ready.
    // This prevents the 404 spam loop when the trading session
    // is still initializing (no creds stored yet).
    if (!isReady || !createClobClient) {
      return;
    }

    try {
      setLoading(true);

      // Primary: use ClobClient directly
      try {
        const client = await createClobClient();
        const result = await client.getBalanceAllowance({
          asset_type: 'COLLATERAL' as any,
        });
        const raw = parseFloat(result?.balance || '0');
        // Polymarket CLOB always returns USDC in micro-units (6 decimals)
        // e.g. 5000000 = $5.00, 100000000 = $100.00
        const usdcBalance = raw / 1_000_000;
        setBalance(usdcBalance);
        failCountRef.current = 0;
        return;
      } catch (err) {
        console.warn('[useUsdcBalance] ClobClient balance failed, falling back:', err);
      }

      // Fallback: server-side endpoint using the Safe address
      // (credentials are stored under the Safe address, not the EOA)
      const addr = safeAddress || walletAddress;
      const res = await fetch(`/api/wallet/balance?wallet=${addr}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance ?? 0);
        failCountRef.current = 0;
      } else {
        failCountRef.current++;
        console.warn(`[useUsdcBalance] Server balance fetch failed: ${res.status} (attempt ${failCountRef.current})`);
        // After 3 consecutive failures, stop retrying to avoid log spam
        if (failCountRef.current >= 3) {
          setBalance(null);
        }
      }
    } catch (err) {
      failCountRef.current++;
      console.error('[useUsdcBalance] Error:', err);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [isConnected, walletAddress, isReady, createClobClient, safeAddress]);

  // Initial fetch + polling — only when ClobClient is ready
  useEffect(() => {
    if (!isConnected || !walletAddress || !isReady) {
      if (!isReady) {
        // Session not ready yet — don't clear balance if we had one cached
        return;
      }
      setBalance(null);
      return;
    }

    // Reset fail counter when deps change (e.g. session becomes ready)
    failCountRef.current = 0;
    fetchBalance();

    intervalRef.current = setInterval(() => {
      // Stop polling after repeated failures
      if (failCountRef.current >= 3) return;
      fetchBalance();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBalance, isConnected, walletAddress, isReady]);

  return {
    balance,
    loading,
    refetch: fetchBalance,
    /** Formatted string like "$12.34" or "$0.00" */
    formatted: balance !== null
      ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null,
  };
}
