'use client';

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { usePrivy, useWallets, useHeadlessDelegatedActions, useSigners } from '@privy-io/react-auth';
import { createWalletClient, custom, type WalletClient, createPublicClient, http, type PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import { makeEip1193Signer } from '@/app/lib/polymarket-constants';

/* ── Types ─────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompatSigner = any;

interface PrivyWalletContextType {
  /** The active EOA wallet address (external wallet if connected, otherwise embedded) */
  eoaAddress: `0x${string}` | undefined;
  /** viem WalletClient for general wallet ops */
  walletClient: WalletClient | null;
  /** viem PublicClient for on-chain reads */
  publicClient: PublicClient | null;
  /** ethers signer (v6 with v5 compat shim) — used by ClobClient / RelayClient */
  ethersSigner: CompatSigner | null;
  /** Wallet provisioned + chain correct + authenticated */
  isReady: boolean;
  /** User is authenticated via Privy */
  authenticated: boolean;
  /** True when active wallet is external (MetaMask/Rabby), not Privy embedded */
  isExternalWallet: boolean;
}

const PrivyWalletContext = createContext<PrivyWalletContextType>({
  eoaAddress: undefined,
  walletClient: null,
  publicClient: null,
  ethersSigner: null,
  isReady: false,
  authenticated: false,
  isExternalWallet: false,
});

export const usePrivyWallet = () => useContext(PrivyWalletContext);

/* ── Constants ─────────────────────────────────── */
const POLYGON_RPC = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com';

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC),
});

/* ── Provider ──────────────────────────────────── */
export function PrivyWalletProvider({ children }: { children: ReactNode }) {
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [ethersSigner, setEthersSigner] = useState<CompatSigner | null>(null);
  const delegationAttempted = useRef(false);

  const { wallets, ready } = useWallets();
  const { authenticated, user } = usePrivy();
  const { delegateWallet } = useHeadlessDelegatedActions();
  const { addSigners } = useSigners();

  // Find the user's wallet — match by user.wallet.address (set by Privy based on login method)
  const wallet = wallets.find(
    (w) => w.address.toLowerCase() === user?.wallet?.address?.toLowerCase()
  ) || null;
  const eoaAddress = authenticated && wallet ? (wallet.address as `0x${string}`) : undefined;
  const isExternalWallet = wallet?.walletClientType !== 'privy' && !!wallet;

  // Initialize wallet clients when wallet is available
  useEffect(() => {
    async function init() {
      if (!wallet || !ready) {
        setWalletClient(null);
        setEthersSigner(null);
        return;
      }

      try {
        const provider = await wallet.getEthereumProvider();

        // viem WalletClient
        const client = createWalletClient({
          account: eoaAddress!,
          chain: polygon,
          transport: custom(provider),
        });
        setWalletClient(client);

        // Lightweight signer for Polymarket ClobClient
        // Uses raw EIP-1193 provider calls instead of ethers (avoids v5/v6 compat issues)
        const signer = makeEip1193Signer(eoaAddress!, provider);
        setEthersSigner(signer);
      } catch (err) {
        console.error('Failed to initialize Privy wallet client:', err);
        setWalletClient(null);
        setEthersSigner(null);
      }
    }
    init();
  }, [wallet, ready, eoaAddress]);

  // Auto-switch to Polygon if on wrong chain
  useEffect(() => {
    async function ensurePolygon() {
      if (!wallet || !ready || !authenticated) return;
      try {
        const chainId = wallet.chainId;
        if (chainId !== `eip155:${polygon.id}`) {
          await wallet.switchChain(polygon.id);
        }
      } catch (err) {
        console.error('Failed to switch to Polygon:', err);
      }
    }
    ensurePolygon();
  }, [wallet, ready, authenticated]);

  // Auto-configure wallet for server-side signing (enables auto-trading).
  // Two approaches, tried in order:
  //   1. Add key quorum as a signer (authorization key approach) — preferred
  //   2. Headless delegation (legacy) — fallback
  // Once either succeeds, the server can sign orders via Privy's server SDK.
  useEffect(() => {
    async function ensureServerSigning() {
      if (!wallet || !ready || !authenticated || !eoaAddress) return;
      if (delegationAttempted.current) return;
      delegationAttempted.current = true;

      // Server-side signing only works for Privy embedded wallets
      if (isExternalWallet) {
        console.log('[Privy] External wallet — skipping server-side signing setup');
        return;
      }

      const keyQuorumId = process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID;

      // Check if already delegated
      const linkedWallet = user?.linkedAccounts?.find(
        (a: any) => a.type === 'wallet' && a.connectorType === 'embedded' && a.chainType === 'ethereum',
      );
      if (linkedWallet && (linkedWallet as any).delegated) {
        console.log('[Privy] Wallet already delegated:', eoaAddress);
        return;
      }

      // Approach 1: Add key quorum as signer (for authorization key-based server signing)
      if (keyQuorumId) {
        try {
          console.log(`[Privy] Adding key quorum ${keyQuorumId} as signer for wallet ${eoaAddress}...`);
          await addSigners({
            address: eoaAddress,
            signers: [{ signerId: keyQuorumId }],
          });
          console.log('[Privy] Key quorum added as signer successfully:', eoaAddress);
          return; // Success — no need for delegation
        } catch (err: any) {
          console.warn('[Privy] addSigners failed:', err?.message || err);
          // Fall through to delegation
        }
      }

      // Approach 2: Headless delegation (legacy — server signs with appId+appSecret)
      try {
        console.log(`[Privy] Attempting headless delegation for wallet ${eoaAddress}...`);
        await delegateWallet({ address: eoaAddress, chainType: 'ethereum' });
        console.log('[Privy] Wallet delegated for server-side signing:', eoaAddress);
      } catch (err: any) {
        // Both approaches failed — log prominently
        console.error(
          '[Privy] SERVER SIGNING SETUP FAILED — auto-trading will NOT work.',
          'KeyQuorumId:', keyQuorumId || 'NOT SET',
          'Error:', err?.message || err,
        );
      }
    }
    ensureServerSigning();
  }, [wallet, ready, authenticated, eoaAddress, user, delegateWallet, addSigners]);

  return (
    <PrivyWalletContext.Provider
      value={{
        eoaAddress,
        walletClient,
        publicClient,
        ethersSigner,
        isReady: ready && authenticated && !!walletClient && !!ethersSigner,
        authenticated,
        isExternalWallet,
      }}
    >
      {children}
    </PrivyWalletContext.Provider>
  );
}
