'use client';

import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
  type ReactNode,
} from 'react';
import {
  useAccount, useConnect, useDisconnect,
  useWalletClient as useWagmiWalletClient,
  injected,
} from 'wagmi';
import { createPublicClient, http, erc20Abi } from 'viem';
import { polygon } from 'viem/chains';
import {
  deriveSafeAddress,
  USDC_TOKEN, CTF_TOKEN, EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT,
  CLOB_API_URL, ERC1155_IS_APPROVED_ABI,
} from '@/app/lib/polymarket-constants';
import { BrowserBuilderConfig } from '@/app/lib/browser-builder-config';

/* ── Types ─────────────────────────────────────── */
interface ExternalSession {
  version: number;
  eoaAddress: string;
  safeAddress: string;
  hasApprovals: boolean;
  apiCredentials: { key: string; secret: string; passphrase: string };
  lastChecked: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompatSigner = any;

interface ExternalWalletContextType {
  eoaAddress: `0x${string}` | undefined;
  safeAddress: `0x${string}` | undefined;
  isConnected: boolean;
  isReady: boolean;
  isInitializing: boolean;
  initError: string | null;
  apiCredentials: { key: string; secret: string; passphrase: string } | null;
  signer: CompatSigner | null;
  connectWallet: () => void;
  disconnectWallet: () => void;
  retry: () => void;
}

const ExternalWalletContext = createContext<ExternalWalletContextType>({
  eoaAddress: undefined,
  safeAddress: undefined,
  isConnected: false,
  isReady: false,
  isInitializing: false,
  initError: null,
  apiCredentials: null,
  signer: null,
  connectWallet: () => {},
  disconnectWallet: () => {},
  retry: () => {},
});

export const useExternalWallet = () => useContext(ExternalWalletContext);

/* ── Constants ─────────────────────────────────── */
const EXT_SESSION_VERSION = 2; // v2: viem-native signer + updateBalanceAllowance
const EXT_SESSION_KEY = (addr: string) => `ep_ext_session_${addr.toLowerCase()}`;
const POLYGON_RPC = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com';

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC),
});

/* ── Session persistence ── */
function loadExtSession(address: string): ExternalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(EXT_SESSION_KEY(address));
    if (!stored) return null;
    const session = JSON.parse(stored) as ExternalSession;
    if (!session.eoaAddress || session.eoaAddress.toLowerCase() !== address.toLowerCase()) return null;
    if ((session.version || 0) < EXT_SESSION_VERSION) return null;
    if (!session.hasApprovals || !session.apiCredentials) return null;
    return session;
  } catch {
    return null;
  }
}

function saveExtSession(address: string, session: ExternalSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EXT_SESSION_KEY(address), JSON.stringify(session));
}

/* ── On-chain allowance check ── */
async function checkAllAllowances(safeAddress: `0x${string}`): Promise<boolean> {
  const usdcSpenders = [CTF_TOKEN, EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT];
  const ctfOperators = [EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT];

  try {
    const [erc20Results, erc1155Results] = await Promise.all([
      Promise.all(
        usdcSpenders.map(spender =>
          publicClient.readContract({
            address: USDC_TOKEN,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [safeAddress, spender as `0x${string}`],
          })
        )
      ),
      Promise.all(
        ctfOperators.map(operator =>
          publicClient.readContract({
            address: CTF_TOKEN,
            abi: ERC1155_IS_APPROVED_ABI,
            functionName: 'isApprovedForAll',
            args: [safeAddress, operator as `0x${string}`],
          })
        )
      ),
    ]);

    const allErc20 = erc20Results.every(a => a > 0n);
    const allErc1155 = erc1155Results.every(Boolean);

    console.log('[ExternalWallet] Allowance check:', {
      erc20: erc20Results.map((a, i) => `${usdcSpenders[i].slice(-4)}: ${a > 0n}`),
      erc1155: erc1155Results.map((a, i) => `${ctfOperators[i].slice(-4)}: ${a}`),
    });

    return allErc20 && allErc1155;
  } catch (err) {
    console.error('[ExternalWallet] Allowance check failed:', err);
    return false;
  }
}

/* ── Provider ──────────────────────────────────── */
export function ExternalWalletProvider({ children }: { children: ReactNode }) {
  const { address: wagmiAddress, isConnected: wagmiConnected, chainId } = useAccount();
  const { connect: wagmiConnect } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { data: wagmiWalletClient } = useWagmiWalletClient();

  const [safeAddress, setSafeAddress] = useState<`0x${string}` | undefined>();
  const [apiCredentials, setApiCredentials] = useState<{ key: string; secret: string; passphrase: string } | null>(null);
  const [signer, setSigner] = useState<CompatSigner | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const initRef = useRef(false);

  // Derive Safe address when wagmi wallet connects
  const eoaAddress = wagmiConnected && wagmiAddress ? wagmiAddress : undefined;

  // Load cached session or initialize when wallet connects
  useEffect(() => {
    if (!eoaAddress) {
      setSafeAddress(undefined);
      setApiCredentials(null);
      setSigner(null);
      setIsReady(false);
      setInitError(null);
      initRef.current = false;
      return;
    }

    const safe = deriveSafeAddress(eoaAddress);
    setSafeAddress(safe);

    // Try loading cached session
    const cached = loadExtSession(eoaAddress);
    if (cached) {
      console.log('[ExternalWallet] Restored cached session for', eoaAddress);
      setApiCredentials(cached.apiCredentials);
      setIsReady(false); // will become true once signer is set
      // Sync server
      fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: cached.safeAddress,
          eoaAddress,
          apiKey: cached.apiCredentials.key,
          apiSecret: cached.apiCredentials.secret,
          apiPassphrase: cached.apiCredentials.passphrase,
          source: 'external',
        }),
      }).catch(() => {});
    } else {
      initRef.current = false; // allow fresh init
    }
  }, [eoaAddress]);

  // Create signer when wagmi wallet client is available.
  // Uses viem's native signTypedData — matches Polymarket's turnkey-safe-builder-example pattern.
  // This avoids our custom EIP-712 serialization (buildTypedDataPayload) and delegates
  // directly to viem/MetaMask which handles EIP-712 encoding correctly.
  useEffect(() => {
    if (!wagmiWalletClient || !eoaAddress) {
      setSigner(null);
      return;
    }

    const signTypedDataFn = async (domain: any, types: any, value: any) => {
      // Strip EIP712Domain if present — viem adds it internally.
      // ExchangeOrderBuilder already strips it before calling _signTypedData,
      // but we strip again defensively (matches TurnkeyEthersSigner pattern).
      const { EIP712Domain, ...typesWithoutDomain } = types;
      const primaryType = Object.keys(typesWithoutDomain)[0];

      console.log('[ExternalWallet] signTypedData called for', primaryType);

      const sig = await wagmiWalletClient.signTypedData({
        account: wagmiWalletClient.account!,
        domain,
        types: typesWithoutDomain,
        primaryType,
        message: value,
      });

      console.log('[ExternalWallet] Signature received:', sig?.substring(0, 20) + '...');
      return sig;
    };

    const s = {
      getAddress: async () => eoaAddress,
      _signTypedData: signTypedDataFn,
      signTypedData: signTypedDataFn,
      provider: wagmiWalletClient,
    };
    setSigner(s);
  }, [wagmiWalletClient, eoaAddress]);

  // Mark ready when we have signer + credentials
  useEffect(() => {
    if (signer && apiCredentials && safeAddress) {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [signer, apiCredentials, safeAddress]);

  // Auto-initialize session when wallet connects and no cached session
  useEffect(() => {
    if (!eoaAddress || !signer || !safeAddress) return;
    if (apiCredentials) return; // already have credentials (from cache)
    if (initRef.current) return;
    initRef.current = true;

    initializeSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eoaAddress, signer, safeAddress, apiCredentials]);

  const initializeSession = useCallback(async () => {
    if (!eoaAddress || !signer || !safeAddress) return;

    setIsInitializing(true);
    setInitError(null);

    try {
      // Step 1: Check on-chain allowances
      console.log('[ExternalWallet] Checking on-chain allowances for', safeAddress);
      const hasApprovals = await checkAllAllowances(safeAddress);

      if (!hasApprovals) {
        throw new Error(
          'Your Polymarket wallet does not have trading approvals set. ' +
          'Please visit polymarket.com and complete a trade first, then try connecting here.'
        );
      }

      // Step 2: Derive CLOB API credentials
      console.log('[ExternalWallet] Deriving CLOB API credentials...');
      const { ClobClient } = await import('@polymarket/clob-client');

      const tempClient = new ClobClient(CLOB_API_URL, 137, signer);

      let creds: { key: string; secret: string; passphrase: string };
      try {
        creds = await tempClient.createOrDeriveApiKey();
      } catch {
        try {
          creds = await tempClient.deriveApiKey();
        } catch {
          creds = await tempClient.createApiKey();
        }
      }

      if (!creds?.key || !creds?.secret || !creds?.passphrase) {
        throw new Error('Failed to derive API credentials — empty response from CLOB');
      }

      // Step 3: Sync CLOB's cached view of on-chain allowances
      // Without this, the CLOB may reject orders thinking the wallet lacks approvals.
      try {
        const builderConfig = new BrowserBuilderConfig();
        const authedClient = new ClobClient(
          CLOB_API_URL,
          137,
          signer,
          { key: creds.key, secret: creds.secret, passphrase: creds.passphrase },
          2,
          safeAddress,
          undefined,
          false,
          builderConfig as any
        );
        await authedClient.updateBalanceAllowance({ asset_type: 'COLLATERAL' as any });
        await authedClient.updateBalanceAllowance({ asset_type: 'CONDITIONAL' as any });
        console.log('[ExternalWallet] CLOB balance cache synced (COLLATERAL + CONDITIONAL)');
      } catch (syncErr: any) {
        console.warn('[ExternalWallet] CLOB cache sync failed (non-fatal):', syncErr?.message);
      }

      // Step 4: Save session (renumbered from Step 3)
      const session: ExternalSession = {
        version: EXT_SESSION_VERSION,
        eoaAddress,
        safeAddress,
        hasApprovals: true,
        apiCredentials: creds,
        lastChecked: Date.now(),
      };
      saveExtSession(eoaAddress, session);
      setApiCredentials(creds);

      // Step 5: Sync to server
      await fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: safeAddress,
          eoaAddress,
          apiKey: creds.key,
          apiSecret: creds.secret,
          apiPassphrase: creds.passphrase,
          source: 'external',
        }),
      }).catch(() => {});

      console.log('[ExternalWallet] Session initialized successfully');
    } catch (err: any) {
      console.error('[ExternalWallet] Session init failed:', err);
      setInitError(err.message || 'Setup failed');
    } finally {
      setIsInitializing(false);
    }
  }, [eoaAddress, signer, safeAddress]);

  const connectWallet = useCallback(() => {
    wagmiConnect({ connector: injected() });
  }, [wagmiConnect]);

  const disconnectWallet = useCallback(() => {
    if (eoaAddress) {
      localStorage.removeItem(EXT_SESSION_KEY(eoaAddress));
    }
    wagmiDisconnect();
    setSafeAddress(undefined);
    setApiCredentials(null);
    setSigner(null);
    setIsReady(false);
    setInitError(null);
    initRef.current = false;
  }, [wagmiDisconnect, eoaAddress]);

  const retry = useCallback(() => {
    initRef.current = false;
    setInitError(null);
    initializeSession();
  }, [initializeSession]);

  return (
    <ExternalWalletContext.Provider
      value={{
        eoaAddress,
        safeAddress,
        isConnected: wagmiConnected && !!eoaAddress,
        isReady,
        isInitializing,
        initError,
        apiCredentials,
        signer,
        connectWallet,
        disconnectWallet,
        retry,
      }}
    >
      {children}
    </ExternalWalletContext.Provider>
  );
}
