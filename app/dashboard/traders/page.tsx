"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TraderCard,
  TraderCardSkeleton,
  SortDropdown,
  StatCard,
  StatCardSkeleton,
  DailyTop5,
  CopyConfigWizard,
  TraderActivityFeed,
} from "@/app/components/ui";
import { useUserStore } from "@/app/lib/stores/user-store";
import { usePrivy } from "@privy-io/react-auth";
import { useToast } from "@/app/components/ui/Toast";

/* ── Constants ──────────────────────────────────── */
const tierOptions = [
  { value: "all", label: "All Tiers" },
  { value: "custom", label: "My Tracked" },
  { value: "micro", label: "Micro" },
  { value: "small", label: "Small" },
  { value: "mid", label: "Mid" },
  { value: "whale", label: "Whale" },
];

const styleOptions = [
  { value: "all", label: "All Styles" },
  { value: "degen", label: "Degens" },
  { value: "sniper", label: "Snipers" },
  { value: "grinder", label: "Grinders" },
  { value: "whale", label: "Whales" },
];

const categoryOptions = [
  { value: "all", label: "All Categories" },
  { value: "crypto", label: "Crypto" },
  { value: "politics", label: "Politics" },
  { value: "geopolitics", label: "Geopolitics" },
  { value: "trump", label: "Trump" },
  { value: "sports-nba", label: "NBA" },
  { value: "sports-soccer", label: "Soccer" },
  { value: "sports-other", label: "Sports" },
  { value: "esports", label: "Esports" },
  { value: "fed-macro", label: "Fed & Macro" },
  { value: "stocks", label: "Stocks" },
  { value: "entertainment", label: "Entertainment" },
  { value: "tech-ai", label: "Tech & AI" },
  { value: "weather", label: "Weather" },
  { value: "science", label: "Science" },
  { value: "other", label: "Other" },
];

const categoryPillColors: Record<string, string> = {
  crypto: "#F7931A",
  politics: "#3B82F6",
  geopolitics: "#EF4444",
  trump: "#DC2626",
  "sports-nba": "#C4740E",
  "sports-soccer": "#22C55E",
  "sports-other": "#8B5CF6",
  esports: "#06B6D4",
  "fed-macro": "#EAB308",
  stocks: "#10B981",
  entertainment: "#EC4899",
  "tech-ai": "#6366F1",
  weather: "#38BDF8",
  science: "#A855F7",
  other: "#9CA3AF",
};

const sortOptions = [
  { value: "gem", label: "Best Gems" },
  { value: "roi", label: "Best ROI" },
  { value: "win_rate", label: "Highest Win Rate" },
  { value: "total_pnl", label: "Most Profitable" },
  { value: "composite_rank", label: "Best Rank" },
];

/* ── Dropdown select component ─────────────────── */
function FilterSelect({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-ep-card border border-ep-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary
                   focus:outline-none focus:border-accent/50 cursor-pointer appearance-none
                   pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%238B92A8%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_6px_center]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ── Page ───────────────────────────────────────── */
export default function TradersPage() {
  const [traders, setTraders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState("all");
  const [style, setStyle] = useState("all");
  const [sort, setSort] = useState("gem");
  const [category, setCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [roiTimeframe, setRoiTimeframe] = useState<"1m" | "1w" | "all">("1m");
  const [showStarred, setShowStarred] = useState(false);
  const [view, setView] = useState<"copy" | "mylist" | "whales">("copy");
  const [myListTraders, setMyListTraders] = useState<any[]>([]);
  const [myListLoading, setMyListLoading] = useState(false);

  /* ── Wallet & follows & watchlist ── */
  const walletAddress = useUserStore((s) => s.walletAddress);
  const isConnected = useUserStore((s) => s.isConnected);
  const fetchFollows = useUserStore((s) => s.fetchFollows);
  const followedTraderIds = useUserStore((s) => s.followedTraderIds);
  const toggleWatchlist = useUserStore((s) => s.toggleWatchlist);
  const isWatching = useUserStore((s) => s.isWatching);
  const watchlistTraderIds = useUserStore((s) => s.watchlistTraderIds);
  const fetchWatchlist = useUserStore((s) => s.fetchWatchlist);
  const { login } = usePrivy();
  const { toast } = useToast();
  const [connectError, setConnectError] = useState<string | null>(null);

  // Fetch follows + watchlist when wallet is connected
  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchFollows();
      fetchWatchlist();
    }
  }, [isConnected, walletAddress, fetchFollows, fetchWatchlist]);

  // Handler when Follow is clicked but wallet not connected
  const handleFollowRequiresWallet = useCallback(async () => {
    setConnectError(null);
    try {
      await login();
    } catch (err: any) {
      setConnectError(err.message || "Failed to connect wallet");
    }
  }, [login]);

  /* ── Custom address tracking ── */
  const [customAddr, setCustomAddr] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customResult, setCustomResult] = useState<{
    type: "success" | "error";
    message: string;
    trader?: any;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [wizardTrader, setWizardTrader] = useState<any>(null);

  const handleTrackWallet = async () => {
    const addr = customAddr.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setCustomResult({ type: "error", message: "Invalid address — must be 0x + 40 hex characters" });
      return;
    }
    setCustomLoading(true);
    setCustomResult(null);
    try {
      const res = await fetch("/api/traders/add-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, addedBy: walletAddress, category: customCategory || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add trader");
      setCustomResult({
        type: "success",
        message: data.isNew
          ? `Added ${data.trader.alias || addr.slice(0, 10)} — start copying or view on the Shadow page!`
          : `${data.trader.alias || addr.slice(0, 10)} is already tracked.`,
        trader: data.trader,
      });
      setCustomAddr("");
      fetchData();
    } catch (err: any) {
      setCustomResult({ type: "error", message: err.message || "Something went wrong" });
    } finally {
      setCustomLoading(false);
    }
  };

  const handleStartCopyingCustom = (trader: any) => {
    if (!walletAddress || !trader?.id) return;
    setWizardTrader(trader);
  };

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ style, sort, limit: "350", view });
      if (tier === "custom") {
        params.set("tier", "all");
        params.set("source", "user_added");
      } else {
        params.set("tier", tier);
      }
      if (category !== "all") {
        params.set("category", category);
      }
      const res = await fetch(`/api/dashboard/traders?${params}`);
      const data = await res.json();

      setTraders(data.traders || []);
      setStats({
        totalTraders: data.total_traders || 0,
        avgRoi: data.avg_roi || 0,
        avgWinRate: data.avg_win_rate || 0,
        totalPnl: data.total_tracked_pnl || 0,
        topPerformer: data.top_performer || null,
        tierBreakdown: data.tier_breakdown || {},
        styleBreakdown: data.style_breakdown || {},
      });
    } catch (err) {
      console.error("Traders fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tier, style, sort, category, view]);

  const fetchMyList = useCallback(async () => {
    if (!walletAddress) return;
    setMyListLoading(true);
    try {
      const [watchRes, followsRes] = await Promise.all([
        fetch(`/api/watchlist/list?walletAddress=${walletAddress}`),
        fetch(`/api/follows/list?walletAddress=${walletAddress}`),
      ]);
      const watchData = await watchRes.json();
      const followsData = await followsRes.json();

      const watchTraders = (watchData.watchlist || []).map((w: any) => ({
        ...w.trader,
        _listSource: "watching" as const,
      }));
      const followTraders = (followsData.follows || []).map((f: any) => ({
        ...f.trader,
        _listSource: "copying" as const,
      }));

      const seen = new Map<string, any>();
      for (const t of followTraders) {
        if (t?.id) seen.set(t.id, { ...t, _listSource: "copying" });
      }
      for (const t of watchTraders) {
        if (t?.id && !seen.has(t.id)) {
          seen.set(t.id, { ...t, _listSource: "watching" });
        } else if (t?.id && seen.has(t.id)) {
          seen.set(t.id, { ...seen.get(t.id), _listSource: "both" });
        }
      }
      setMyListTraders(Array.from(seen.values()));
    } catch (err) {
      console.error("My List fetch error:", err);
    } finally {
      setMyListLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (view === "mylist") {
      fetchMyList();
    } else {
      setLoading(true);
      fetchData();
    }
  }, [view, fetchData, fetchMyList]);

  // Auto-refresh every 60s
  useEffect(() => {
    const fn = view === "mylist" ? fetchMyList : fetchData;
    const interval = setInterval(fn, 60000);
    return () => clearInterval(interval);
  }, [fetchData, fetchMyList, view]);

  /* ── Compute displayed traders ── */
  const sourceTraders = view === "mylist" ? myListTraders : traders;
  let displayedTraders = showStarred
    ? sourceTraders.filter((t: any) => isWatching(t.id))
    : sourceTraders;
  if (view === "mylist" && category !== "all") {
    displayedTraders = displayedTraders.filter((t: any) => t.category === category);
  }
  // Apply ROI timeframe override
  if (roiTimeframe !== "1m") {
    displayedTraders = displayedTraders.map((t: any) => {
      let meta: any = {};
      try { meta = typeof t.profile_summary === "string" ? JSON.parse(t.profile_summary) : (t.profile_summary || {}); } catch { /* ignore */ }
      const roiKey = roiTimeframe === "1w" ? "roi_1w" : "roi_all";
      return { ...t, roi: meta[roiKey] ?? t.roi };
    });
  }
  const isLoadingView = view === "mylist" ? myListLoading : loading;

  return (
    <div className="py-6 space-y-5">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold">Traders</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            {stats?.totalTraders || 0} {view === "whales" ? "whale accounts by PnL" : "elite traders ranked by copyability"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition ${viewMode === "grid" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary"}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-lg transition ${viewMode === "table" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary"}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── View Tabs + Filters (compact row) ──── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-ep-card border border-ep-border/60">
          {([
            { key: "copy", label: "Copy Traders" },
            { key: "mylist", label: "My List" },
            { key: "whales", label: "Whales" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                view === tab.key
                  ? "bg-accent text-white shadow-sm"
                  : "text-text-muted hover:text-text-primary hover:bg-white/5"
              }`}
            >
              {tab.label}
              {tab.key === "mylist" && (watchlistTraderIds.length + followedTraderIds.length) > 0 && (
                <span className="ml-1 text-[10px] opacity-70">
                  {new Set([...watchlistTraderIds, ...followedTraderIds]).size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-ep-border/60" />

        {/* Filter dropdowns */}
        <FilterSelect label="Category" options={categoryOptions} value={category} onChange={setCategory} />
        <FilterSelect label="Tier" options={tierOptions} value={tier} onChange={setTier} />
        <FilterSelect label="Style" options={styleOptions} value={style} onChange={setStyle} />

        {/* Starred toggle */}
        <button
          onClick={() => setShowStarred(!showStarred)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
            showStarred
              ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40'
              : 'bg-yellow-400/5 text-yellow-400/80 border-yellow-400/20 hover:bg-yellow-400/15 hover:text-yellow-300'
          }`}
        >
          {showStarred ? '\u2605' : '\u2606'}
          {watchlistTraderIds.length > 0 && (
            <span className="text-[10px] opacity-70">{watchlistTraderIds.length}</span>
          )}
        </button>

        {/* ROI Timeframe toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-ep-card border border-ep-border/60">
          {([
            { key: "1w", label: "1W" },
            { key: "1m", label: "1M" },
            { key: "all", label: "ALL" },
          ] as const).map((tf) => (
            <button
              key={tf.key}
              onClick={() => setRoiTimeframe(tf.key)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                roiTimeframe === tf.key
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Sort — push right */}
        <div className="ml-auto">
          <SortDropdown options={sortOptions} value={sort} onChange={setSort} />
        </div>
      </div>

      {/* ── Track Any Wallet (collapsed) ─────── */}
      <details className="ep-card border border-ep-border/60 group">
        <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 select-none list-none [&::-webkit-details-marker]:hidden">
          <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <span className="font-display font-semibold text-sm text-text-primary">Track Any Wallet</span>
          <svg className="h-4 w-4 text-text-muted ml-auto transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 pt-1">
          <p className="text-[11px] text-text-muted mb-3">
            Found a trader on Twitter? Paste their Polymarket address and start copy-trading in seconds.
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customAddr}
              onChange={(e) => {
                setCustomAddr(e.target.value);
                if (customResult) setCustomResult(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && !customLoading && handleTrackWallet()}
              placeholder="0x1234...abcd"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-ep-bg border border-ep-border text-sm font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition"
            />
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="px-2 py-2 rounded-lg bg-ep-bg border border-ep-border text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/50 shrink-0"
            >
              <option value="">Category</option>
              {categoryOptions.slice(1).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={handleTrackWallet}
              disabled={customLoading || !customAddr.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 shrink-0"
            >
              {customLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Fetching...
                </>
              ) : (
                "Track"
              )}
            </button>
          </div>
          <AnimatePresence>
            {customResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${
                    customResult.type === "success"
                      ? "bg-profit/10 text-profit border border-profit/20"
                      : "bg-loss/10 text-loss border border-loss/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      {customResult.message}
                      {customResult.type === "success" && customResult.trader && (
                        <span className="ml-2 text-text-muted">
                          {(customResult.trader.trade_count || 0) >= 2000 ? '2,000+' : (customResult.trader.trade_count || 0).toLocaleString()} trades · {(customResult.trader.win_rate || 0).toFixed(0)}% WR · {customResult.trader.bankroll_tier} tier
                        </span>
                      )}
                    </div>
                    {customResult.type === "success" && customResult.trader && isConnected && (
                      <div className="flex items-center gap-2 shrink-0">
                        {followedTraderIds.includes(customResult.trader.id) ? (
                          <a
                            href="/dashboard/shadow"
                            className="px-3 py-1 rounded-md text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition"
                          >
                            View on Shadow ✓
                          </a>
                        ) : (
                          <button
                            onClick={() => handleStartCopyingCustom(customResult.trader)}
                            className="px-3 py-1 rounded-md text-[11px] font-semibold bg-accent text-white hover:bg-accent/90 transition"
                          >
                            Start Copying →
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            const trader = customResult.trader;
                            if (!trader) return;
                            const action = await toggleWatchlist(trader.id);
                            const name = trader.alias || trader.wallet_address?.slice(0, 10);
                            if (action === "added") {
                              toast("success", "Added to Watchlist", `${name} is now in your watchlist.`);
                            } else {
                              toast("info", "Removed from Watchlist", `${name} removed from watchlist.`);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                            customResult.trader && isWatching(customResult.trader.id)
                              ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/30"
                              : "bg-white/10 text-text-secondary border border-white/10 hover:text-yellow-400 hover:border-yellow-400/30"
                          }`}
                        >
                          {customResult.trader && isWatching(customResult.trader.id) ? "★ Watching" : "☆ Watchlist"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </details>

      {/* ── Wallet Connect Error ────────────── */}
      <AnimatePresence>
        {connectError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 rounded-xl bg-loss/10 text-loss border border-loss/20 text-xs font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{connectError}</span>
              <button
                onClick={() => setConnectError(null)}
                className="ml-auto text-loss/60 hover:text-loss transition"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats Row ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Traders" value={stats?.totalTraders || 0} decimals={0} />
            <StatCard label="Avg ROI" value={stats?.avgRoi || 0} suffix="%" decimals={1} colorize />
            <StatCard label="Avg Win Rate" value={stats?.avgWinRate || 0} suffix="%" decimals={1} />
            <StatCard label="Total Tracked PnL" value={stats?.totalPnl || 0} prefix="$" decimals={0} colorize />
          </>
        )}
      </div>

      {/* ── Two-Column Layout: Traders (left) + Activity (right) ── */}
      <div className="flex gap-5 items-start">
        {/* LEFT: Trader cards */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Daily Top 5 — hidden on XL since sidebar takes that role */}
          <DailyTop5 />

          {/* Trader Cards / Table */}
          {isLoadingView ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <TraderCardSkeleton key={i} />
              ))}
            </div>
          ) : displayedTraders.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedTraders.map((trader: any, i: number) => (
                  <TraderCard key={trader.id} trader={trader} rank={i + 1} onFollow={handleFollowRequiresWallet} />
                ))}
              </div>
            ) : (
              /* ── Leaderboard Table View ──────────── */
              <div className="ep-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ep-border">
                        <th className="px-4 py-3 text-left text-[10px] text-text-muted uppercase tracking-wider font-semibold">#</th>
                        <th className="px-4 py-3 text-center text-[10px] text-text-muted uppercase tracking-wider font-semibold">Gem</th>
                        <th className="px-4 py-3 text-left text-[10px] text-text-muted uppercase tracking-wider font-semibold">Trader</th>
                        <th className="px-4 py-3 text-right text-[10px] text-text-muted uppercase tracking-wider font-semibold">ROI ({roiTimeframe.toUpperCase()})</th>
                        <th className="px-4 py-3 text-right text-[10px] text-text-muted uppercase tracking-wider font-semibold">Win Rate</th>
                        <th className="px-4 py-3 text-right text-[10px] text-text-muted uppercase tracking-wider font-semibold">PnL</th>
                        <th className="px-4 py-3 text-right text-[10px] text-text-muted uppercase tracking-wider font-semibold">Trades</th>
                        <th className="px-4 py-3 text-center text-[10px] text-text-muted uppercase tracking-wider font-semibold">Tier</th>
                        <th className="px-4 py-3 text-center text-[10px] text-text-muted uppercase tracking-wider font-semibold">Style</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTraders.map((t: any, i: number) => {
                        const roiColor = t.roi > 0 ? 'text-profit' : t.roi < 0 ? 'text-loss' : 'text-text-secondary';
                        const pnlColor = t.total_pnl > 0 ? 'text-profit' : t.total_pnl < 0 ? 'text-loss' : 'text-text-secondary';
                        const tierColors: Record<string, string> = { micro: '#A78BFA', small: '#60A5FA', mid: '#FBBF24', whale: '#34D399' };
                        const styleColors: Record<string, string> = { degen: '#F472B6', sniper: '#F97316', grinder: '#818CF8', whale: '#22D3EE' };
                        const gemColors: Record<string, { color: string; emoji: string }> = {
                          diamond: { color: '#B9F2FF', emoji: '\u{1F48E}' },
                          gold: { color: '#FFD700', emoji: '\u{1F947}' },
                          silver: { color: '#C0C0C0', emoji: '\u{1F948}' },
                          bronze: { color: '#CD7F32', emoji: '\u{1F949}' },
                        };
                        const gem = gemColors[t.gem_tier] || gemColors.bronze;
                        return (
                          <tr key={t.id} className="border-b border-ep-border/50 hover:bg-ep-card-hover transition">
                            <td className="px-4 py-3 font-mono text-xs text-text-muted">{i + 1}</td>
                            <td className="px-4 py-3 text-center">
                              <span title={`${(t.gem_tier || 'bronze').toUpperCase()} gem`}>{gem.emoji}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-text-primary">{t.alias || t.wallet_address?.slice(0, 10)}</span>
                            </td>
                            <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${roiColor}`}>
                              {t.roi > 0 ? '+' : ''}{(t.roi || 0).toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                              {(t.win_rate || 0).toFixed(0)}%
                            </td>
                            <td className={`px-4 py-3 text-right font-mono text-sm ${pnlColor}`}>
                              ${Math.abs(t.total_pnl || 0) >= 1000 ? `${((t.total_pnl || 0) / 1000).toFixed(1)}K` : (t.total_pnl || 0).toFixed(0)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm text-text-secondary">
                              {(t.trade_count || 0) >= 2000 ? '2,000+' : (t.trade_count || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="badge"
                                style={{
                                  color: tierColors[t.bankroll_tier] || '#8B92A8',
                                  background: `${tierColors[t.bankroll_tier] || '#8B92A8'}18`,
                                }}
                              >
                                {(t.bankroll_tier || 'N/A').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="badge"
                                style={{
                                  color: styleColors[t.trading_style] || '#8B92A8',
                                  background: `${styleColors[t.trading_style] || '#8B92A8'}18`,
                                }}
                              >
                                {(t.trading_style || 'N/A').toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <div className="ep-card p-12 text-center">
              <div className="text-4xl mb-3">{view === "mylist" ? '\uD83D\uDCCB' : showStarred ? '\u2B50' : '\uD83D\uDC64'}</div>
              <h3 className="font-display font-semibold text-text-primary">
                {view === "mylist" ? 'Your list is empty' : showStarred ? 'No starred traders' : 'No traders found'}
              </h3>
              <p className="text-sm text-text-muted mt-1">
                {view === "mylist"
                  ? 'Star traders or start copying to build your personal list.'
                  : showStarred
                  ? 'Star traders you want to track by tapping the \u2606 icon on their card.'
                  : 'Try adjusting your filters or check back later.'}
              </p>
              {(showStarred || view === "mylist") && (
                <button
                  onClick={() => { setShowStarred(false); if (view === "mylist") setView("copy"); }}
                  className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition"
                >
                  Browse traders
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Live Activity Sidebar (wide desktop only) */}
        <div className="hidden 2xl:block w-[380px] shrink-0 sticky top-20">
          <TraderActivityFeed maxItems={40} compact />
        </div>
      </div>

      {/* Mobile/smaller desktop: Activity Feed below traders */}
      <div className="2xl:hidden">
        <TraderActivityFeed maxItems={20} compact />
      </div>

      {/* Copy Config Wizard for custom wallet tracking */}
      <AnimatePresence>
        {wizardTrader && (
          <CopyConfigWizard
            trader={wizardTrader}
            onComplete={() => {
              setWizardTrader(null);
              if (customResult?.trader) {
                setCustomResult({
                  type: "success",
                  message: `Now copying ${customResult.trader.alias || customResult.trader.wallet_address?.slice(0, 10)}! View trader on the Shadow page.`,
                  trader: customResult.trader,
                });
              }
              fetchFollows();
            }}
            onClose={() => setWizardTrader(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
