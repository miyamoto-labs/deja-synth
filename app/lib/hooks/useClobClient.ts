'use client';

import { usePrivyClobClient } from './usePrivyClobClient';
import { useExternalClobClient } from './useExternalClobClient';
import { useExternalWallet } from '@/app/lib/contexts/ExternalWalletContext';

/**
 * Unified ClobClient hook — returns whichever trading client is ready.
 * Priority: External wallet (MetaMask) when connected > Privy (embedded).
 *
 * When the user explicitly connects via "Connect Polymarket" (MetaMask),
 * the external client MUST take priority — otherwise trades would be
 * signed with the wrong wallet/Safe and silently fail.
 *
 * All trading consumers should use this instead of usePrivyClobClient directly.
 */
export function useClobClient() {
  const privy = usePrivyClobClient();
  const external = useExternalClobClient();
  const { isConnected: externalConnected } = useExternalWallet();

  // External wallet takes priority when user has explicitly connected MetaMask
  if (externalConnected && external.isReady) return external;
  if (privy.isReady) return privy;

  // Neither ready — return external state if connected (shows init progress),
  // otherwise return Privy's state (shows normal "not ready" UX)
  if (externalConnected) return external;
  return privy;
}
