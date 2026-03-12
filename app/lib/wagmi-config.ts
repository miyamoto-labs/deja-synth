'use client';

import { http, createConfig, injected } from 'wagmi';
import { polygon } from 'wagmi/chains';

const POLYGON_RPC = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com';

export const wagmiConfig = createConfig({
  chains: [polygon],
  connectors: [injected()],
  transports: {
    [polygon.id]: http(POLYGON_RPC),
  },
  // Prevent wagmi from discovering Privy's injected provider
  multiInjectedProviderDiscovery: false,
});
