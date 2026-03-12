'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  encodeFunctionData,
  erc20Abi,
} from 'viem';
import { usePrivyWallet } from '@/app/lib/contexts/PrivyWalletContext';
import { BrowserBuilderConfig } from '@/app/lib/browser-builder-config';
import {
  deriveSafeAddress,
  CLOB_API_URL, RELAYER_URL,
  USDC_TOKEN, CTF_TOKEN, EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT,
  MAX_UINT256,
} from '@/app/lib/polymarket-constants';

/* ── Types ─────────────────────────────────────── */
export interface TradingSession {
  version?: number;
  eoaAddress: string;
  safeAddress: string;
  isSafeDeployed: boolean;
  hasApiCredentials: boolean;
  hasApprovals: boolean;
  apiCredentials?: {
    key: string;
    secret: string;
    passphrase: string;
  };
  lastChecked: number;
}

export type SessionStep =
  | 'idle'
  | 'checking'
  | 'deploying'
  | 'credentials'
  | 'approvals'
  | 'complete'
  | 'error';

/* ── Helpers ───────────────────────────────────── */
const SESSION_VERSION = 6; // v6: fix relayer 401 (timestamp ms→s) + batch all 7 on-chain approvals via relayer
const SESSION_KEY = (addr: string) => `ep_trading_session_${addr.toLowerCase()}`;

function loadSession(address: string): TradingSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SESSION_KEY(address));
    if (!stored) return null;
    const session = JSON.parse(stored) as TradingSession;
    if (!session.eoaAddress || session.eoaAddress.toLowerCase() !== address.toLowerCase()) return null;
    // Reject stale sessions from before approvals were implemented
    if ((session.version || 0) < SESSION_VERSION) return null;
    return session;
  } catch {
    return null;
  }
}

function saveSession(address: string, session: TradingSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY(address), JSON.stringify(session));
}

/* ── Hook ──────────────────────────────────────── */
export function useTradingSession() {
  const { eoaAddress, ethersSigner, walletClient, publicClient, isReady } = usePrivyWallet();

  const [session, setSession] = useState<TradingSession | null>(null);
  const [currentStep, setCurrentStep] = useState<SessionStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  // Load cached session on mount or when wallet changes
  useEffect(() => {
    if (eoaAddress) {
      const cached = loadSession(eoaAddress);
      if (cached && cached.hasApiCredentials && cached.isSafeDeployed && cached.hasApprovals) {
        setSession(cached);
        setCurrentStep('complete');

        // Ensure server has the EOA → Safe mapping (needed for server-side copytrade signing)
        if (cached.safeAddress && cached.apiCredentials) {
          fetch('/api/wallet/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: cached.safeAddress,
              eoaAddress,
              apiKey: cached.apiCredentials.key,
              apiSecret: cached.apiCredentials.secret,
              apiPassphrase: cached.apiCredentials.passphrase,
            }),
          }).catch(() => {}); // Best-effort, don't block UI
        }
      } else {
        // New wallet with no cached session — clear stale state and allow fresh init
        setSession(null);
        setCurrentStep('idle');
        initRef.current = false;
      }
    } else {
      setSession(null);
      setCurrentStep('idle');
      initRef.current = false;
    }
  }, [eoaAddress]);

  const initializeSession = useCallback(async () => {
    if (!eoaAddress || !ethersSigner || !walletClient || !publicClient || !isReady) return;
    if (initRef.current) return; // Prevent double-init
    initRef.current = true;

    try {
      setError(null);
      setCurrentStep('checking');

      // ── Step 1: Import SDK modules ──
      // NOTE: We use BrowserBuilderConfig (native fetch) instead of the SDK's
      // BuilderConfig (axios) because the SDK's remote signing silently fails
      // in Next.js client bundles due to axios/crypto module resolution issues.
      const { RelayClient } = await import('@polymarket/builder-relayer-client');

      const builderConfig = new BrowserBuilderConfig();

      // ── Step 2: Derive Safe address (deterministic, no network call) ──
      const safeAddress = deriveSafeAddress(eoaAddress as `0x${string}`);

      // ── Step 3: Check if Safe is deployed ──
      // Use viem WalletClient for RelayClient (it expects a viem signer
      // to access .transport.config; ethers signers don't have that)
      const relayClient = new RelayClient(
        RELAYER_URL,
        137,
        walletClient as any,
        builderConfig as any
      );

      let isSafeDeployed = false;
      try {
        isSafeDeployed = await relayClient.getDeployed(safeAddress);
      } catch {
        // Fallback: check bytecode
        const code = await publicClient.getCode({ address: safeAddress });
        isSafeDeployed = !!code && code !== '0x';
      }

      // ── Step 4: Deploy Safe if needed ──
      if (!isSafeDeployed) {
        setCurrentStep('deploying');
        const deployResponse = await relayClient.deploy();

        // Poll until confirmed (up to ~60s: 20 polls × 3s each)
        const result = await relayClient.pollUntilState(
          deployResponse.transactionID,
          ['STATE_MINED', 'STATE_CONFIRMED'],
          'STATE_FAILED',
          20,
          3000
        );

        if ((result as any)?.state === 'STATE_FAILED') {
          throw new Error('Safe deployment failed');
        }
        isSafeDeployed = true;
      }

      // ── Step 5: Derive API credentials ──
      setCurrentStep('credentials');
      const { ClobClient } = await import('@polymarket/clob-client');

      const tempClient = new ClobClient(
        CLOB_API_URL,
        137,
        ethersSigner as any
      );

      let creds: { key: string; secret: string; passphrase: string };
      try {
        // Try createOrDeriveApiKey — handles both new and returning users
        creds = await tempClient.createOrDeriveApiKey();
      } catch (err: any) {
        console.error('[TradingSession] createOrDeriveApiKey failed:', err?.message || err);
        // Try each method individually with logging
        try {
          creds = await tempClient.deriveApiKey();
        } catch (deriveErr: any) {
          console.warn('[TradingSession] deriveApiKey failed:', deriveErr?.message);
          try {
            creds = await tempClient.createApiKey();
          } catch (createErr: any) {
            console.error('[TradingSession] createApiKey also failed:', createErr?.message);
            throw new Error(`API key setup failed: ${createErr?.message || deriveErr?.message || err?.message}`);
          }
        }
      }

      if (!creds?.key || !creds?.secret || !creds?.passphrase) {
        console.error('[TradingSession] Empty creds received');
        throw new Error('Failed to derive API credentials — empty response from CLOB');
      }

      // ── Step 6: Set all on-chain token approvals via relayer ──
      // The Safe must approve exchange contracts to spend USDC and CTF.
      // We batch all 7 approvals into a single relayClient.execute() call,
      // then sync the CLOB's cached view via updateBalanceAllowance().
      setCurrentStep('approvals');
      let hasApprovals = false;

      // Check if approvals are already set on-chain (existing Polymarket users)
      // USDC→Exchange allowance is a reliable proxy for all 7 approvals
      try {
        const allowance = await publicClient.readContract({
          address: USDC_TOKEN as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [safeAddress as `0x${string}`, EXCHANGE as `0x${string}`],
        });
        if (allowance > 0n) {
          console.log('[TradingSession] Approvals already set on-chain — skipping');
          hasApprovals = true;
        }
      } catch (checkErr: any) {
        console.warn('[TradingSession] Allowance check failed, will set approvals:', checkErr?.message);
      }

      const erc1155Abi = [{
        name: 'setApprovalForAll',
        type: 'function',
        inputs: [
          { name: 'operator', type: 'address' },
          { name: 'approved', type: 'bool' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      }] as const;

      if (!hasApprovals) try {
        // Build all 7 approval transactions
        const approvalTxs = [
          // USDC approve → CTF Contract, Exchange, NegRisk Exchange, NegRisk Adapter
          ...[CTF_TOKEN, EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT].map(spender => ({
            to: USDC_TOKEN,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [spender as `0x${string}`, MAX_UINT256],
            }),
            value: '0',
          })),
          // CTF setApprovalForAll → Exchange, NegRisk Exchange, NegRisk Adapter
          ...[EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT].map(operator => ({
            to: CTF_TOKEN,
            data: encodeFunctionData({
              abi: erc1155Abi,
              functionName: 'setApprovalForAll',
              args: [operator as `0x${string}`, true],
            }),
            value: '0',
          })),
        ];

        console.log(`[TradingSession] Submitting ${approvalTxs.length} approval txns via relayer...`);
        const txResponse = await relayClient.execute(approvalTxs);
        console.log('[TradingSession] Approval batch submitted:', txResponse.transactionID);

        // Poll for on-chain confirmation (up to ~60s: 20 polls × 3s each)
        // Note: relayer returns STATE_MINED / STATE_CONFIRMED / STATE_FAILED
        const result = await relayClient.pollUntilState(
          txResponse.transactionID,
          ['STATE_MINED', 'STATE_CONFIRMED'],
          'STATE_FAILED',
          20,
          3000
        );

        const state = (result as any)?.state;
        if (state === 'STATE_FAILED') {
          throw new Error('Approval batch FAILED on-chain');
        }
        if (!result) {
          throw new Error('Approval polling timed out — transaction may still be pending');
        }
        console.log(`[TradingSession] Approval batch confirmed: ${state}`);

        // Sync the CLOB's cached view of on-chain approvals
        try {
          const authedClient = new ClobClient(
            CLOB_API_URL,
            137,
            ethersSigner as any,
            { key: creds.key, secret: creds.secret, passphrase: creds.passphrase },
            2,
            safeAddress,
            undefined,
            false,
            builderConfig as any
          );
          await authedClient.updateBalanceAllowance({ asset_type: 'COLLATERAL' as any });
          console.log('[TradingSession] CLOB cache synced for COLLATERAL');
        } catch (syncErr: any) {
          console.warn('[TradingSession] CLOB cache sync failed (non-fatal):', syncErr?.message);
        }

        hasApprovals = true;
        console.log('[TradingSession] All token approvals set and synced');
      } catch (approvalErr: any) {
        console.error('[TradingSession] Approval setup failed:', approvalErr?.message, approvalErr);
        // Leave hasApprovals = false so session isn't cached and re-init is forced next time
      }

      // ── Step 7: Save session ──
      const newSession: TradingSession = {
        version: SESSION_VERSION,
        eoaAddress,
        safeAddress,
        isSafeDeployed,
        hasApiCredentials: true,
        hasApprovals,
        apiCredentials: creds,
        lastChecked: Date.now(),
      };
      saveSession(eoaAddress, newSession);
      setSession(newSession);

      // Also sync to Supabase (so server knows about this user)
      try {
        await fetch('/api/wallet/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: safeAddress,
            eoaAddress,
            apiKey: creds.key,
            apiSecret: creds.secret,
            apiPassphrase: creds.passphrase,
            source: 'privy',
          }),
        });
      } catch {
        // Non-critical — continue even if server sync fails
      }

      setCurrentStep('complete');
    } catch (err: any) {
      console.error('Trading session setup failed:', err);
      setError(err.message || 'Setup failed');
      setCurrentStep('error');
      initRef.current = false; // Allow retry
    }
  }, [eoaAddress, ethersSigner, walletClient, publicClient, isReady]);

  const retry = useCallback(() => {
    initRef.current = false;
    setError(null);
    setCurrentStep('idle');
    initializeSession();
  }, [initializeSession]);

  return {
    session,
    currentStep,
    error,
    initializeSession,
    retry,
    isComplete: currentStep === 'complete' && session !== null,
    safeAddress: session?.safeAddress,
    apiCredentials: session?.apiCredentials,
  };
}
