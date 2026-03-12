'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { usePrivyWallet } from '@/app/lib/contexts/PrivyWalletContext';
import { useTradingSession, type SessionStep } from '@/app/lib/hooks/useTradingSession';
import { useExternalWallet } from '@/app/lib/contexts/ExternalWalletContext';
import { useUsdcBalance } from '@/app/lib/hooks/useUsdcBalance';
import { WithdrawModal } from './WithdrawModal';

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const STEP_LABELS: Record<SessionStep, string> = {
  idle: '',
  checking: 'Checking wallet...',
  deploying: 'Deploying Safe...',
  credentials: 'Deriving keys...',
  approvals: 'Setting approvals...',
  complete: '',
  error: 'Setup failed',
};

interface WalletConnectButtonProps {
  variant?: 'header' | 'inline';
}

export function WalletConnectButton({ variant = 'header' }: WalletConnectButtonProps) {
  const { login, logout, ready: privyReady, authenticated, exportWallet } = usePrivy();
  const { eoaAddress, isReady: walletReady, isExternalWallet } = usePrivyWallet();
  const { currentStep, error, initializeSession, retry, isComplete, safeAddress } = useTradingSession();
  const ext = useExternalWallet();

  const { balance, formatted: balanceFormatted, loading: balanceLoading } = useUsdcBalance();
  const [showMenu, setShowMenu] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  // Auto-initialize Privy trading session when wallet is ready (once per session)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('trading-session-dismissed') === 'true';
  });

  useEffect(() => {
    if (walletReady && !isComplete && currentStep === 'idle' && !dismissed) {
      initializeSession();
    }
  }, [walletReady, isComplete, currentStep, initializeSession, dismissed]);

  // --- Not ready yet (Privy loading) ---
  if (!privyReady) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-ep-surface/50 px-3 py-1.5 text-xs text-text-muted">
        <div className="h-3 w-3 rounded-full border border-text-muted/30 border-t-text-muted animate-spin" />
      </div>
    );
  }

  // --- Privy: Setting up trading session ---
  if (authenticated && !isComplete && currentStep !== 'idle' && currentStep !== 'error') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent">
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="hidden sm:inline">{STEP_LABELS[currentStep]}</span>
      </div>
    );
  }

  // --- Privy: Setup error (user dismissed or failed) ---
  if (authenticated && currentStep === 'error') {
    // Remember dismissal so we don't auto-prompt again this session
    if (!dismissed) {
      setDismissed(true);
      sessionStorage.setItem('trading-session-dismissed', 'true');
    }
    return (
      <button
        onClick={retry}
        className="flex items-center gap-2 rounded-lg bg-loss/10 border border-loss/20 px-3 py-1.5 text-xs text-loss hover:bg-loss/20 transition"
      >
        <span className="hidden sm:inline">{error || 'Setup failed'}</span>
        <span className="sm:hidden">Retry</span>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
      </button>
    );
  }

  // --- External wallet: initializing ---
  if (!authenticated && ext.isConnected && ext.isInitializing) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent">
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="hidden sm:inline">Connecting wallet...</span>
      </div>
    );
  }

  // --- External wallet: init error ---
  if (!authenticated && ext.isConnected && ext.initError) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={ext.retry}
          className="flex items-center gap-2 rounded-lg bg-loss/10 border border-loss/20 px-3 py-1.5 text-xs text-loss hover:bg-loss/20 transition"
        >
          <span className="hidden sm:inline truncate max-w-[160px]">{ext.initError}</span>
          <span className="sm:hidden">Retry</span>
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>
        <button
          onClick={ext.disconnectWallet}
          className="text-[10px] text-text-muted hover:text-loss transition px-1"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // --- Connected state (Privy OR External wallet) ---
  const privyConnected = authenticated && isComplete && (safeAddress || eoaAddress);
  const extConnected = !authenticated && ext.isReady && ext.safeAddress;

  if (privyConnected || extConnected) {
    const isExt = !!extConnected && !privyConnected;
    const displayAddress = isExt ? ext.safeAddress! : (safeAddress || eoaAddress || '');
    const displayEoa = isExt ? ext.eoaAddress : eoaAddress;

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 rounded-lg bg-ep-surface border border-ep-border px-3 py-1.5 text-xs font-mono text-text-primary hover:border-accent/30 transition"
        >
          <span className="h-2 w-2 rounded-full bg-profit shrink-0" />
          <span className="hidden sm:inline">{truncateAddress(displayAddress)}</span>
          <span className="sm:hidden">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          </span>
        </button>

        {/* Dropdown menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-ep-surface border border-ep-border shadow-card overflow-hidden z-50"
            >
              {/* Connection type badge */}
              {isExt && (
                <div className="px-4 py-1.5 bg-accent/5 border-b border-ep-border">
                  <span className="text-[10px] text-accent font-medium">External Wallet</span>
                </div>
              )}

              {/* USDC Balance */}
              <div className="px-4 py-3 border-b border-ep-border">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">USDC Balance</p>
                <p className="text-lg font-mono font-bold text-text-primary mt-0.5">
                  {balanceLoading ? (
                    <span className="text-text-muted text-sm">Loading...</span>
                  ) : (
                    balanceFormatted ?? '$0.00'
                  )}
                </p>
                {balance !== null && balance < 1 && (
                  <p className="text-[10px] text-yellow-400 mt-1">
                    Fund your wallet to start trading
                  </p>
                )}
              </div>

              {/* Trading Wallet */}
              <div className="px-4 py-2.5 border-b border-ep-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Trading Wallet</p>
                    <p className="text-[11px] font-mono text-text-secondary mt-0.5">
                      {truncateAddress(displayAddress)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(displayAddress);
                      setCopiedAddress(true);
                      setTimeout(() => setCopiedAddress(false), 2000);
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-ep-surface border border-ep-border hover:border-accent/30 text-text-muted hover:text-accent transition"
                  >
                    {copiedAddress ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mt-1.5">
                  Send USDC.e (Polygon) to this address to fund your account
                </p>
              </div>

              {/* Status */}
              <div className="px-4 py-2 border-b border-ep-border">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-profit" />
                  <span className="text-[10px] text-profit">Trading enabled</span>
                </div>
                {displayEoa && displayAddress && displayEoa !== displayAddress && (
                  <p className="text-[10px] text-text-muted mt-1">EOA: {truncateAddress(displayEoa)}</p>
                )}
              </div>

              {/* Withdraw */}
              <button
                onClick={() => {
                  setWithdrawOpen(true);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2.5 text-left text-xs text-text-secondary hover:text-accent hover:bg-accent/5 transition flex items-center gap-2 border-b border-ep-border"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Withdraw USDC
              </button>

              {/* Export Private Key — only for Privy embedded wallets */}
              {!isExt && !isExternalWallet && (
                <button
                  onClick={() => {
                    exportWallet();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-text-secondary hover:text-yellow-400 hover:bg-yellow-400/5 transition flex items-center gap-2 border-b border-ep-border"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  Export Private Key
                </button>
              )}

              {/* Disconnect / Log Out */}
              <button
                onClick={() => {
                  if (isExt) {
                    ext.disconnectWallet();
                  } else {
                    logout();
                  }
                  setShowMenu(false);
                }}
                className="w-full px-4 py-3 text-left text-xs text-loss hover:bg-loss/5 transition"
              >
                {isExt ? 'Disconnect' : 'Log Out'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Withdraw Modal */}
        <WithdrawModal
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
        />
      </div>
    );
  }

  // --- Authenticated but session incomplete + dismissed: show setup button ---
  if (authenticated && !isComplete && dismissed) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setDismissed(false);
            sessionStorage.removeItem('trading-session-dismissed');
            initializeSession();
          }}
          className="btn-accent px-3 py-1.5 text-xs font-semibold"
        >
          Set Up Trading
        </button>
        <button
          onClick={() => logout()}
          className="text-[10px] text-text-muted hover:text-loss transition px-1"
        >
          Log Out
        </button>
      </div>
    );
  }

  // --- Disconnected state: Log In + Connect Polymarket ---
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => login()}
        className={
          variant === 'inline'
            ? 'btn-accent w-full px-4 py-2.5 text-sm font-semibold'
            : 'btn-accent px-3 py-1.5 text-xs font-semibold'
        }
      >
        <svg className="h-3.5 w-3.5 mr-1.5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        Log In
      </button>
    </div>
  );
}
