'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { addRpcUrlOverrideToChain } from '@privy-io/react-auth';
import { polygon } from 'viem/chains';
import { wagmiConfig } from '@/app/lib/wagmi-config';
import { PrivyWalletProvider } from '@/app/lib/contexts/PrivyWalletContext';
import { ExternalWalletProvider } from '@/app/lib/contexts/ExternalWalletContext';
import { usePrivyStoreBridge } from '@/app/lib/hooks/usePrivyStoreBridge';

/* ── Constants ─────────────────────────────────── */
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
const POLYGON_RPC = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com';


const queryClient = new QueryClient();

/* ── Error Boundary ────────────────────────────── */
class ProviderErrorBoundary extends Component<
  { children: ReactNode; name: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; name: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] Error:`, error, info);
    setTimeout(() => this.setState({ hasError: false, error: null }), 0);
  }
  render() {
    if (this.state.hasError) {
      console.warn(`[${this.props.name}] Caught error, recovering:`, this.state.error?.message);
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}

/* ── Bridge: syncs auth state → Zustand user store ── */
function StoreBridge({ children }: { children: ReactNode }) {
  usePrivyStoreBridge();
  return <>{children}</>;
}

/* ── Polygon chain with custom RPC ────────────── */
const polygonWithRpc = (() => {
  try {
    return addRpcUrlOverrideToChain(polygon, POLYGON_RPC);
  } catch {
    return polygon;
  }
})();

/* ── Provider (always wraps children — no SSR guard needed) ── */
/* SSR safety is handled in layout.tsx via next/dynamic ssr:false */
export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ProviderErrorBoundary name="PrivyProvider">
          <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
              defaultChain: polygon,
              supportedChains: [polygonWithRpc],
              appearance: {
                theme: 'dark',
                accentColor: '#00F0A0',
                logo: '/deja-logo.png',
              },
              loginMethods: ['google', 'twitter', 'telegram', 'wallet'],
              embeddedWallets: {
                ethereum: {
                  createOnLogin: 'users-without-wallets',
                },
              },
            }}
          >
            <ProviderErrorBoundary name="PrivyWalletProvider">
              <PrivyWalletProvider>
                <ProviderErrorBoundary name="ExternalWalletProvider">
                  <ExternalWalletProvider>
                    <StoreBridge>
                      {children}
                    </StoreBridge>
                  </ExternalWalletProvider>
                </ProviderErrorBoundary>
              </PrivyWalletProvider>
            </ProviderErrorBoundary>
          </PrivyProvider>
        </ProviderErrorBoundary>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
