'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWalletConnect } from '@/app/lib/hooks/useWalletConnect';
import { useUserStore } from '@/app/lib/stores/user-store';

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || 'https://easypoly-bot-production.up.railway.app';

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ep-bg" />}>
      <ConnectPageInner />
    </Suspense>
  );
}

function ConnectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const telegramUserId = searchParams.get('userId');
  const isTelegramFlow = !!telegramUserId;

  const { walletAddress, isConnected, hasCredentials, hydrate } = useUserStore();
  const { connect, disconnect } = useWalletConnect();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'linking' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const linkAttempted = useRef(false);

  // Hydrate wallet state on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Telegram flow: if already connected, auto-link to bot
  useEffect(() => {
    if (isTelegramFlow && isConnected && hasCredentials && walletAddress && status === 'idle' && !linkAttempted.current) {
      linkAttempted.current = true;
      linkWalletToBot(walletAddress);
    }
  }, [isTelegramFlow, isConnected, hasCredentials, walletAddress, status]);

  // Normal flow: redirect to dashboard if already connected
  useEffect(() => {
    if (!isTelegramFlow && isConnected && hasCredentials && status === 'idle') {
      router.push('/dashboard');
    }
  }, [isTelegramFlow, isConnected, hasCredentials, status, router]);

  // Fetch stored creds from our API and send to bot
  async function linkWalletToBot(address: string) {
    setStatus('linking');
    try {
      // Get stored credentials from our API
      const credsRes = await fetch(`/api/wallet/creds?wallet=${address.toLowerCase()}`);
      if (!credsRes.ok) throw new Error('Could not retrieve wallet credentials');
      const creds = await credsRes.json();

      // Send to Telegram bot
      const botRes = await fetch(`${BOT_URL}/callback/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId,
          walletAddress: address.toLowerCase(),
          apiKey: creds.key,
          apiSecret: creds.secret,
          apiPassphrase: creds.passphrase,
        }),
      });

      if (!botRes.ok) throw new Error('Failed to link wallet to Telegram');

      setStatus('success');
    } catch (err: any) {
      console.error('Link error:', err);
      setError(err.message || 'Failed to link wallet');
      setStatus('error');
    }
  }

  async function handleConnect() {
    try {
      setStatus('connecting');
      setError('');
      const address = await connect();

      if (isTelegramFlow && address) {
        // After connecting, link to bot
        await linkWalletToBot(address);
      } else {
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 1500);
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Unknown error');
      setStatus('error');
    }
  }

  function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  return (
    <div className="min-h-screen bg-ep-bg text-text-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background mesh */}
      <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-accent">Easy</span>
              <span className="text-text-primary">Poly</span>
            </h1>
            <p className="text-text-secondary mt-2 text-sm">
              {isTelegramFlow ? 'Link your wallet to Telegram' : 'Connect your wallet to start trading'}
            </p>
          </motion.div>
        </div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="ep-card p-6 rounded-2xl"
        >
          <AnimatePresence mode="wait">
            {/* --- Idle state --- */}
            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {isTelegramFlow ? (
                  <>
                    <div className="space-y-3">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        To bet from Telegram, you need a <strong className="text-text-primary">trading wallet</strong> the bot can sign orders with.
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Go back to Telegram and tap <strong className="text-text-primary">Create Trading Wallet</strong> — or connect your browser wallet below for dashboard access only.
                      </p>
                    </div>

                    <a
                      href="https://t.me/EasypolyQuickbot"
                      className="btn-accent w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.97 9.291c-.145.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z" />
                      </svg>
                      Back to Telegram (Create Wallet)
                    </a>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-ep-border/50" /></div>
                      <div className="relative flex justify-center text-[10px]"><span className="bg-ep-bg px-3 text-text-muted uppercase tracking-wider">or link browser wallet</span></div>
                    </div>

                    <button
                      onClick={handleConnect}
                      className="w-full py-2.5 rounded-xl bg-ep-surface border border-ep-border text-sm text-text-secondary hover:border-accent/30 transition flex items-center justify-center gap-2"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                      </svg>
                      Connect Browser Wallet (Dashboard Only)
                    </button>

                    <p className="text-[10px] text-text-muted text-center">
                      Browser wallets can&apos;t auto-sign orders from Telegram
                    </p>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Connect your Polygon wallet to place trades directly from the dashboard. Your funds stay in your wallet — we never hold your money.
                      </p>
                    </div>

                    <button
                      onClick={handleConnect}
                      className="btn-accent w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                      </svg>
                      Connect Wallet
                    </button>

                    <p className="text-[10px] text-text-muted text-center uppercase tracking-wider">
                      MetaMask &bull; Coinbase Wallet &bull; Rabby &bull; Trust Wallet
                    </p>
                  </>
                )}
              </motion.div>
            )}

            {/* --- Connecting state --- */}
            {status === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-5 py-4"
              >
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
                  <div className="absolute inset-3 rounded-full bg-accent/10 flex items-center justify-center">
                    <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Sign in your wallet</p>
                  <p className="text-xs text-text-secondary mt-1">
                    This derives your Polymarket API credentials securely.
                    <br />Your private key never leaves your wallet.
                  </p>
                </div>
              </motion.div>
            )}

            {/* --- Linking to Telegram state --- */}
            {status === 'linking' && (
              <motion.div
                key="linking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-5 py-4"
              >
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
                  <div className="absolute inset-3 rounded-full bg-accent/10 flex items-center justify-center">
                    <span className="text-xl">🔗</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Linking to Telegram...</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Sending your credentials to the bot securely.
                  </p>
                </div>
              </motion.div>
            )}

            {/* --- Success state --- */}
            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-4 py-4"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-profit/10 border border-profit/20 flex items-center justify-center">
                  <svg className="h-8 w-8 text-profit" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    {isTelegramFlow ? 'Wallet Linked!' : 'Wallet Connected!'}
                  </h2>
                  {walletAddress && (
                    <p className="text-xs font-mono text-text-secondary mt-1">
                      {truncateAddress(walletAddress)}
                    </p>
                  )}
                  <p className="text-xs text-text-muted mt-2">
                    {isTelegramFlow
                      ? 'Go back to Telegram to set up your trading wallet and start betting!'
                      : 'Redirecting to dashboard...'}
                  </p>
                </div>
                {isTelegramFlow && (
                  <a
                    href="https://t.me/EasypolyQuickbot"
                    className="btn-accent inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all hover:scale-[1.02]"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.97 9.291c-.145.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z" />
                    </svg>
                    Back to Telegram
                  </a>
                )}
              </motion.div>
            )}

            {/* --- Error state --- */}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="rounded-xl bg-loss/5 border border-loss/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <svg className="h-4 w-4 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-loss">Connection Failed</p>
                      <p className="text-xs text-text-secondary mt-1">{error}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setStatus('idle');
                    setError('');
                    linkAttempted.current = false;
                  }}
                  className="w-full py-2.5 rounded-xl bg-ep-surface border border-ep-border text-sm text-text-primary hover:border-accent/30 transition"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Security info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-6 grid grid-cols-3 gap-3"
        >
          {[
            { icon: '🔒', label: 'Private key stays in your wallet' },
            { icon: '🛡️', label: 'Credentials encrypted at rest' },
            { icon: '💰', label: 'Your funds, your control' },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 rounded-xl bg-ep-surface/50 border border-ep-border/50">
              <span className="text-lg">{item.icon}</span>
              <p className="text-[10px] text-text-muted mt-1 leading-tight">{item.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6 text-center"
        >
          <a
            href={isTelegramFlow ? 'https://t.me/EasypolyQuickbot' : '/dashboard'}
            className="text-xs text-text-muted hover:text-accent transition"
          >
            {isTelegramFlow ? '← Back to Telegram' : '← Back to Dashboard'}
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
