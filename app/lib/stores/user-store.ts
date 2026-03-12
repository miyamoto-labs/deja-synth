'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── Follow record ─────────────────────────────── */
export interface FollowRecord {
  traderId: string;
  autoTrade: boolean;
  amountPerTrade: number;
  maxDailyTrades: number;
  // Copy direction
  copyBuy: boolean;
  copySell: boolean;
  // Sizing mode
  sizingMode: 'fixed' | 'percentage';
  sizingValue: number;
  // Spend & size limits
  totalSpendLimit: number | null;
  totalSpent: number;
  maxPerTrade: number | null;
  minTradeSize: number | null;
  maxPerMarket: number | null;
  // Slippage (price tolerance %)
  slippageBuyPct: number;
  slippageSellPct: number;
  // Stop Loss / Take Profit (% from entry, null = disabled)
  stopLossPct: number | null;
  takeProfitPct: number | null;
  // Extra % below SL trigger for GTC limit sell (default 15)
  slBufferPct: number;
}

/* ── Standing order record (cached) ───────────── */
export interface StandingOrderRecord {
  id: string;
  minConviction: number;
  maxConviction: number;
  directionFilter: string | null;
  amount: number;
  dailyLimit: number;
  active: boolean;
  label: string | null;
  todayExecutions: number;
}

/* ── Subscription types ────────────────────────── */
export type SubscriptionTier = 'free' | 'pro' | 'whale';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

/* ── State interface ───────────────────────────── */
interface UserState {
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  hasCredentials: boolean;
  hasAutoTrading: boolean;

  // Copytrade wallet (server-generated for fast execution)
  copytradeWallet: string | null;

  // Subscription
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  isPro: boolean;

  // Quick Trade preferences
  quickTradeEnabled: boolean;
  customPresets: number[];

  // Follows
  followedTraderIds: string[];
  follows: FollowRecord[];

  // Watchlist
  watchlistTraderIds: string[];

  // Standing Orders (cached summary)
  standingOrderCount: number;

  // Onboarding
  hasCompletedOnboarding: boolean;
  hasSeenArcadeTour: boolean;

  // ── Actions ─────────────────────────────────
  setConnecting: (connecting: boolean) => void;
  setConnected: (address: string, hasCreds: boolean) => void;
  disconnect: () => void;

  // Copytrade wallet
  setCopytradeWallet: (address: string | null) => void;
  generateCopytradeWallet: () => Promise<string | null>;

  // Subscription
  setSubscription: (tier: SubscriptionTier, status: SubscriptionStatus) => void;
  fetchSubscription: () => Promise<void>;

  // Quick trade
  setQuickTradeEnabled: (enabled: boolean) => void;
  setCustomPresets: (presets: number[]) => void;

  // Follows
  setFollows: (follows: FollowRecord[]) => void;
  isFollowing: (traderId: string) => boolean;
  fetchFollows: () => Promise<void>;

  // Watchlist
  isWatching: (traderId: string) => boolean;
  fetchWatchlist: () => Promise<void>;
  toggleWatchlist: (traderId: string) => Promise<'added' | 'removed'>;

  // Standing Orders
  fetchStandingOrderCount: () => Promise<void>;

  // Onboarding
  setOnboardingComplete: () => void;
  setArcadeTourSeen: () => void;

  /** Re-check stored wallet on page load */
  hydrate: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      walletAddress: null,
      isConnected: false,
      isConnecting: false,
      hasCredentials: false,
      hasAutoTrading: false,

      // Subscription defaults
      subscriptionTier: 'free' as SubscriptionTier,
      subscriptionStatus: 'none' as SubscriptionStatus,
      isPro: true, // Free during beta — everyone gets full access

      // Copytrade wallet
      copytradeWallet: null,

      // Quick Trade defaults
      quickTradeEnabled: false,
      customPresets: [5, 10, 25, 50, 100],

      // Follows defaults
      followedTraderIds: [],
      follows: [],

      // Watchlist defaults
      watchlistTraderIds: [],

      // Standing Orders
      standingOrderCount: 0,

      // Onboarding
      hasCompletedOnboarding: false,
      hasSeenArcadeTour: false,

      /* ── Wallet actions ─────────────────────── */
      setConnecting: (connecting) => set({ isConnecting: connecting }),

      setConnected: (address, hasCreds) =>
        set({
          walletAddress: address.toLowerCase(),
          isConnected: true,
          isConnecting: false,
          hasCredentials: hasCreds,
        }),

      disconnect: () =>
        set({
          walletAddress: null,
          isConnected: false,
          isConnecting: false,
          hasCredentials: false,
          hasAutoTrading: false,
          copytradeWallet: null,
          subscriptionTier: 'free' as SubscriptionTier,
          subscriptionStatus: 'none' as SubscriptionStatus,
          isPro: true, // Free during beta
        }),

      /* ── Copytrade wallet actions ──────────────── */
      setCopytradeWallet: (address) => set({ copytradeWallet: address }),

      generateCopytradeWallet: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return null;

        try {
          const res = await fetch('/api/wallet/generate-copytrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress }),
          });
          const data = await res.json();
          if (data.success && data.copytradeWallet) {
            set({ copytradeWallet: data.copytradeWallet });
            return data.copytradeWallet;
          }
          return null;
        } catch {
          return null;
        }
      },

      /* ── Subscription actions ────────────────── */
      setSubscription: (tier, status) =>
        set({
          subscriptionTier: tier,
          subscriptionStatus: status,
          isPro: true, // Free during beta
        }),

      fetchSubscription: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return;

        try {
          const res = await fetch(`/api/subscription/status?wallet=${walletAddress}`);
          if (res.ok) {
            const data = await res.json();
            const tier = (data.tier || 'free') as SubscriptionTier;
            const status = (data.status || 'none') as SubscriptionStatus;
            set({
              subscriptionTier: tier,
              subscriptionStatus: status,
              isPro: true, // Free during beta
            });
          }
        } catch {
          // Network error — keep cached state
        }
      },

      /* ── Quick trade actions ────────────────── */
      setQuickTradeEnabled: (enabled) => set({ quickTradeEnabled: enabled }),

      setCustomPresets: (presets) => set({ customPresets: presets }),

      /* ── Onboarding actions ──────────────────── */
      setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),
      setArcadeTourSeen: () => set({ hasSeenArcadeTour: true }),

      /* ── Follow actions ─────────────────────── */
      setFollows: (follows) =>
        set({
          follows,
          followedTraderIds: follows.map((f) => f.traderId),
        }),

      isFollowing: (traderId) => get().followedTraderIds.includes(traderId),

      fetchFollows: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return;

        try {
          const res = await fetch(`/api/follows/list?walletAddress=${walletAddress}`);
          if (res.ok) {
            const data = await res.json();
            const records: FollowRecord[] = (data.follows || []).map((f: any) => ({
              traderId: f.trader_id,
              autoTrade: f.auto_trade,
              amountPerTrade: f.amount_per_trade,
              maxDailyTrades: f.max_daily_trades,
              copyBuy: f.copy_buy ?? true,
              copySell: f.copy_sell ?? false,
              sizingMode: f.sizing_mode ?? 'fixed',
              sizingValue: f.sizing_value ?? f.amount_per_trade ?? 10,
              totalSpendLimit: f.total_spend_limit ?? null,
              totalSpent: f.total_spent ?? 0,
              maxPerTrade: f.max_per_trade ?? null,
              minTradeSize: f.min_trade_size ?? null,
              maxPerMarket: f.max_per_market ?? null,
              slippageBuyPct: f.slippage_buy_pct ?? 10.0,
              slippageSellPct: f.slippage_sell_pct ?? 10.0,
              stopLossPct: f.stop_loss_pct ?? null,
              takeProfitPct: f.take_profit_pct ?? null,
              slBufferPct: f.sl_buffer_pct ?? 15,
            }));
            set({
              follows: records,
              followedTraderIds: records.map((r) => r.traderId),
            });
          }
        } catch {
          // Network error — keep cached state
        }
      },

      /* ── Watchlist actions ────────────────────── */
      isWatching: (traderId) => get().watchlistTraderIds.includes(traderId),

      fetchWatchlist: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return;

        try {
          const res = await fetch(`/api/watchlist/list?walletAddress=${walletAddress}`);
          if (res.ok) {
            const data = await res.json();
            const ids = (data.watchlist || []).map((w: any) => w.trader_id);
            set({ watchlistTraderIds: ids });
          }
        } catch {
          // Network error — keep cached state
        }
      },

      toggleWatchlist: async (traderId) => {
        const { walletAddress } = get();
        if (!walletAddress) return 'removed';

        try {
          const res = await fetch('/api/watchlist/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, traderId }),
          });
          const data = await res.json();

          if (data.success) {
            // Optimistic update
            const current = get().watchlistTraderIds;
            if (data.action === 'added') {
              set({ watchlistTraderIds: [...current, traderId] });
            } else {
              set({ watchlistTraderIds: current.filter((id) => id !== traderId) });
            }
            return data.action as 'added' | 'removed';
          }
        } catch {
          // Network error
        }
        return 'removed';
      },

      /* ── Standing Order actions ───────────────── */
      fetchStandingOrderCount: async () => {
        const { walletAddress, isPro } = get();
        if (!walletAddress) return;

        try {
          const res = await fetch(`/api/standing-orders?wallet=${walletAddress}`);
          if (res.ok) {
            const data = await res.json();
            set({ standingOrderCount: (data.orders || []).length });
          }
        } catch {
          // Network error — keep cached state
        }
      },

      /* ── Hydrate ────────────────────────────── */
      hydrate: async () => {
        const { walletAddress, hasCompletedOnboarding } = get();
        if (!walletAddress) return;

        // Migration: existing users who connected before onboarding was added
        // skip the wizard if they already have credentials stored
        if (!hasCompletedOnboarding && get().hasCredentials) {
          set({ hasCompletedOnboarding: true });
        }

        // Verify wallet is still available in browser
        // For Privy users: no window.ethereum check needed — Privy manages auth
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            const accounts: string[] = await window.ethereum.request({
              method: 'eth_accounts',
            });
            const connected = accounts.some(
              (a: string) => a.toLowerCase() === walletAddress.toLowerCase()
            );
            if (!connected) {
              // Don't disconnect Privy users (they have a trading session, not MetaMask)
              const hasPrivySession = Array.from(
                { length: localStorage.length },
                (_, i) => localStorage.key(i)
              ).some((k) => k?.startsWith('ep_trading_session_'));
              if (!hasPrivySession) {
                set({ isConnected: false, isConnecting: false });
                return;
              }
            }
          } catch {
            // If ethereum check fails, don't disconnect — could be Privy user
          }
        }

        // Check server-side credential status + copytrade wallet
        try {
          const res = await fetch(`/api/wallet/status?address=${walletAddress}`);
          if (res.ok) {
            const data = await res.json();
            set({
              hasCredentials: data.hasCredentials,
              hasAutoTrading: !!data.hasAutoTrading,
              isConnected: true,
              copytradeWallet: data.copytradeWallet || null,
            });
          }
        } catch {
          // Network error — keep local state
        }

        // Fetch subscription + follows + watchlist + standing orders if connected
        get().fetchSubscription();
        get().fetchFollows();
        get().fetchWatchlist();
        get().fetchStandingOrderCount();
      },
    }),
    {
      name: 'ep-user',
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        hasCredentials: state.hasCredentials,
        copytradeWallet: state.copytradeWallet,
        subscriptionTier: state.subscriptionTier,
        subscriptionStatus: state.subscriptionStatus,
        isPro: state.isPro,
        quickTradeEnabled: state.quickTradeEnabled,
        customPresets: state.customPresets,
        followedTraderIds: state.followedTraderIds,
        watchlistTraderIds: state.watchlistTraderIds,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSeenArcadeTour: state.hasSeenArcadeTour,
      }),
    }
  )
);
