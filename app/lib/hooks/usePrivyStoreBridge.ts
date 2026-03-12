'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePrivyWallet } from '@/app/lib/contexts/PrivyWalletContext';
import { useTradingSession } from '@/app/lib/hooks/useTradingSession';
import { useExternalWallet } from '@/app/lib/contexts/ExternalWalletContext';
import { useUserStore } from '@/app/lib/stores/user-store';

/**
 * Bridges authentication state (Privy + External wallet) into the Zustand user store.
 *
 * Priority: Privy with complete session > External wallet ready > Setting up > Disconnected
 */
export function usePrivyStoreBridge() {
  const { authenticated, ready } = usePrivy();
  const { eoaAddress } = usePrivyWallet();
  const { isComplete, safeAddress: privySafeAddress } = useTradingSession();
  const ext = useExternalWallet();
  const { setConnected, disconnect, walletAddress, isConnected, hasCredentials } = useUserStore();

  useEffect(() => {
    if (!ready) return;

    // Priority 1: Privy user with complete trading session
    if (authenticated && isComplete && privySafeAddress) {
      const addr = privySafeAddress.toLowerCase();
      if (walletAddress !== addr || !isConnected || !hasCredentials) {
        setConnected(addr, true);
      }
      return;
    }

    // Priority 2: External wallet with complete session
    if (ext.isReady && ext.safeAddress) {
      const addr = ext.safeAddress.toLowerCase();
      if (walletAddress !== addr || !isConnected || !hasCredentials) {
        setConnected(addr, true);
      }
      return;
    }

    // Priority 3: Privy user still setting up
    if (authenticated && eoaAddress && !isComplete) {
      const addr = (privySafeAddress || eoaAddress).toLowerCase();
      if (walletAddress !== addr || !isConnected) {
        setConnected(addr, false);
      }
      return;
    }

    // Priority 4: External wallet still setting up
    if (ext.isConnected && ext.eoaAddress && !ext.isReady) {
      const addr = (ext.safeAddress || ext.eoaAddress).toLowerCase();
      if (walletAddress !== addr || !isConnected) {
        setConnected(addr, false);
      }
      return;
    }

    // Nothing connected
    if (!authenticated && !ext.isConnected && ready) {
      if (walletAddress || isConnected) {
        disconnect();
      }
    }
  }, [
    authenticated, ready, eoaAddress, isComplete, privySafeAddress,
    ext.isReady, ext.isConnected, ext.eoaAddress, ext.safeAddress,
    walletAddress, isConnected, hasCredentials, setConnected, disconnect,
  ]);
}
