"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MarketCard,
  MarketCardSkeleton,
  SortDropdown,
  CategoryTile,
  SubcategoryChips,
  FeaturedMarketBanner,
  StatCard,
  ViewToggle,
  CalendarView,
} from "@/app/components/ui";
import { BarChart3, Zap, DollarSign, Vault, Search } from "lucide-react";
import {
  CATEGORIES,
  SUBCATEGORIES,
  SORT_OPTIONS,
  CATEGORY_COLORS,
} from "./constants";
import { useMarketPrices } from "@/app/lib/hooks/useMarketPrices";

const PAGE_SIZE = 50;

interface MarketOutcome {
  label: string;
  yes_price: number;
  market_id: string;
  yes_token: string;
  no_token: string;
  volume: number;
}

interface Market {
  market_id: string;
  condition_id?: string;
  question: string;
  category: string;
  subcategory?: string;
  is_multi?: boolean;
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  outcomes?: MarketOutcome[];
  outcome_count?: number;
  volume: number;
  volume_24h?: number;
  liquidity: number;
  end_date: string;
  hotness?: number;
}

function formatTotalVolume(markets: Market[]): string {
  const total = markets.reduce((sum, m) => sum + (m.volume || 0), 0);
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `$${(total / 1_000).toFixed(0)}K`;
  return `$${total.toFixed(0)}`;
}

export default function MarketsPage() {
  // View mode
  const [view, setView] = useState<"grid" | "calendar">("grid");

  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeCategory, setActiveCategory] = useState("hot");
  const [activeSubcategory, setActiveSubcategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("hot");

  // Calendar-specific state
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarMarkets, setCalendarMarkets] = useState<Market[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [subcategoryCounts, setSubcategoryCounts] = useState<Record<string, number>>({});
  const [trendingTags, setTrendingTags] = useState<{ tag: string; volume_24h: number }[]>([]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Reset subcategory when category changes
  useEffect(() => {
    setActiveSubcategory("");
  }, [activeCategory]);

  const fetchMarkets = useCallback(
    async (offset = 0, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          sort,
        });
        if (activeCategory !== "all") params.set("category", activeCategory);
        if (activeSubcategory) params.set("subcategory", activeSubcategory);
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(`/api/dashboard/markets?${params}`);
        const data = await res.json();

        if (append) {
          setMarkets((prev) => [...prev, ...(data.markets || [])]);
        } else {
          setMarkets(data.markets || []);
        }
        setTotal(data.total || 0);
        setHasMore(data.hasMore || false);
        if (data.category_counts) setCategoryCounts(data.category_counts);
        if (data.subcategory_counts) setSubcategoryCounts(data.subcategory_counts);
        if (data.trending_tags) setTrendingTags(data.trending_tags);
      } catch (err) {
        console.error("Markets fetch error:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeCategory, activeSubcategory, debouncedSearch, sort]
  );

  // Refetch on filter changes
  useEffect(() => {
    fetchMarkets(0, false);
  }, [fetchMarkets]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchMarkets(0, false), 60_000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // Calendar data fetch
  useEffect(() => {
    if (view !== "calendar") return;

    const startDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const endDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    let cancelled = false;
    setCalendarLoading(true);

    const params = new URLSearchParams({
      mode: "calendar",
      start_date: toISO(startDate),
      end_date: toISO(endDate),
      sort: "hot",
    });
    if (activeCategory !== "all" && activeCategory !== "hot")
      params.set("category", activeCategory);
    if (activeSubcategory) params.set("subcategory", activeSubcategory);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/dashboard/markets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setCalendarMarkets(data.markets || []);
          if (data.category_counts) setCategoryCounts(data.category_counts);
          if (data.subcategory_counts) setSubcategoryCounts(data.subcategory_counts);
          if (data.trending_tags) setTrendingTags(data.trending_tags);
        }
      })
      .catch((err) => console.error("Calendar fetch error:", err))
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, calendarMonth, activeCategory, activeSubcategory, debouncedSearch]);

  // Infinite scroll
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchMarkets(markets.length, true);
        }
      },
      { rootMargin: "400px" }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, markets.length, fetchMarkets]);

  // Derived
  const activeCatConfig = CATEGORIES.find((c) => c.id === activeCategory);
  const activeCatColor = activeCatConfig?.color || "#8B92A8";
  const subcategories = SUBCATEGORIES[activeCategory] || [];
  const showSubcategories =
    activeCategory !== "hot" && activeCategory !== "all" && subcategories.length > 0;

  // ── Live CLOB prices (polls every 10s) ──
  const priceSource = view === "calendar" ? calendarMarkets : markets;
  const livePrices = useMarketPrices(priceSource);

  const enrichedMarkets = useMemo(() => {
    if (Object.keys(livePrices).length === 0) return markets;
    return markets.map((m) => {
      if (!m.is_multi) {
        // Binary market — overlay YES midpoint, derive NO
        const liveYes = m.yes_token ? livePrices[m.yes_token] : undefined;
        if (liveYes === undefined) return m;
        return { ...m, yes_price: liveYes, no_price: Math.max(0, 1 - liveYes) };
      }
      // Multi-choice — overlay each outcome's YES midpoint
      if (m.outcomes) {
        const updatedOutcomes = m.outcomes.map((o) => {
          const liveYes = o.yes_token ? livePrices[o.yes_token] : undefined;
          if (liveYes === undefined) return o;
          return { ...o, yes_price: liveYes };
        });
        const top = updatedOutcomes.reduce((a, b) => (a.yes_price > b.yes_price ? a : b));
        return {
          ...m,
          outcomes: updatedOutcomes,
          yes_price: top.yes_price,
          no_price: 1 - top.yes_price,
        };
      }
      return m;
    });
  }, [markets, livePrices]);

  // ── Aggregate stats ──
  const stats = useMemo(() => {
    const vol = enrichedMarkets.reduce((s, m) => s + (m.volume || 0), 0);
    const vol24h = enrichedMarkets.reduce((s, m) => s + (m.volume_24h || 0), 0);
    const liq = enrichedMarkets.reduce((s, m) => s + (m.liquidity || 0), 0);
    return { volume: vol, volume24h: vol24h, liquidity: liq };
  }, [enrichedMarkets]);

  // Featured markets: top 5 by hotness (only in Hot view)
  const featuredMarkets =
    activeCategory === "hot" && !debouncedSearch
      ? enrichedMarkets
          .filter((m) => (m.hotness ?? 0) >= 5)
          .slice(0, 5)
      : [];

  // Active filter label for breadcrumb
  const activeSubLabel = subcategories.find((s) => s.id === activeSubcategory)?.label;

  return (
    <div className="py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BarChart3 size={22} strokeWidth={2} className="text-text-secondary" /> Markets
        </h1>
        <p className="text-xs sm:text-sm text-text-muted mt-1">
          {total === 0 && !loading && "Browse prediction markets"}
          {loading && total === 0 && "Loading markets..."}
          {total > 0 && "Browse and trade prediction markets"}
        </p>
      </div>

      {/* Aggregate Stats */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Active Markets"
            value={total}
            icon={<BarChart3 size={16} strokeWidth={2} className="text-accent" />}
          />
          <StatCard
            label="24h Volume"
            value={stats.volume24h}
            prefix="$"
            decimals={stats.volume24h >= 1_000_000 ? 1 : 0}
            suffix={stats.volume24h >= 1_000_000 ? "M" : stats.volume24h >= 1_000 ? "K" : ""}
            icon={<Zap size={16} strokeWidth={2} className="text-yellow-400" />}
          />
          <StatCard
            label="Total Volume"
            value={stats.volume >= 1_000_000 ? stats.volume / 1_000_000 : stats.volume >= 1_000 ? stats.volume / 1_000 : stats.volume}
            prefix="$"
            decimals={stats.volume >= 1_000_000 ? 1 : 0}
            suffix={stats.volume >= 1_000_000 ? "M" : stats.volume >= 1_000 ? "K" : ""}
            icon={<DollarSign size={16} strokeWidth={2} className="text-green-400" />}
          />
          <StatCard
            label="Liquidity"
            value={stats.liquidity >= 1_000_000 ? stats.liquidity / 1_000_000 : stats.liquidity >= 1_000 ? stats.liquidity / 1_000 : stats.liquidity}
            prefix="$"
            decimals={stats.liquidity >= 1_000_000 ? 1 : 0}
            suffix={stats.liquidity >= 1_000_000 ? "M" : stats.liquidity >= 1_000 ? "K" : ""}
            icon={<Vault size={16} strokeWidth={2} className="text-blue-400" />}
          />
        </div>
      )}

      {/* Category Tiles */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {CATEGORIES.map((cat) => (
          <CategoryTile
            key={cat.id}
            id={cat.id}
            label={cat.label}
            emoji={cat.emoji}
            color={cat.color}
            count={
              cat.id === "hot" || cat.id === "all"
                ? undefined
                : categoryCounts[cat.id]
            }
            isActive={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* Subcategory Chips */}
      <AnimatePresence mode="wait">
        {showSubcategories && (
          <SubcategoryChips
            key={activeCategory}
            categoryLabel={activeCatConfig?.label || ""}
            subcategories={subcategories}
            activeSubcategory={activeSubcategory}
            onSelect={setActiveSubcategory}
            color={activeCatColor}
            counts={subcategoryCounts}
          />
        )}
      </AnimatePresence>

      {/* Trending Tags */}
      {trendingTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[11px] text-text-muted font-semibold uppercase tracking-wider shrink-0">Trending</span>
          {trendingTags.map(({ tag, volume_24h }) => (
            <button
              key={tag}
              onClick={() => setActiveSubcategory(activeSubcategory === tag ? "" : tag)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition border ${
                activeSubcategory === tag
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-ep-card text-text-secondary border-ep-border/50 hover:border-accent/30 hover:text-text-primary"
              }`}
            >
              {tag.replace(/_/g, " ")}
              <span className="ml-1.5 text-[10px] text-text-muted">
                ${volume_24h >= 1_000_000 ? `${(volume_24h / 1_000_000).toFixed(1)}M` : volume_24h >= 1_000 ? `${(volume_24h / 1_000).toFixed(0)}K` : volume_24h.toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Search + Sort + Breadcrumb */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-ep-card border border-ep-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            {view === "grid" && (
              <SortDropdown
                options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={sort}
                onChange={setSort}
              />
            )}
          </div>
        </div>

        {/* Active filter breadcrumb */}
        {(activeSubLabel || debouncedSearch) && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {activeCatConfig && activeCategory !== "hot" && activeCategory !== "all" && (
              <span style={{ color: activeCatColor }}>
                {activeCatConfig.label}
              </span>
            )}
            {activeSubLabel && (
              <>
                <span className="opacity-40">›</span>
                <span style={{ color: activeCatColor }}>{activeSubLabel}</span>
              </>
            )}
            {debouncedSearch && (
              <>
                <span className="opacity-40">·</span>
                <span>"{debouncedSearch}"</span>
              </>
            )}
            <button
              onClick={() => {
                setActiveSubcategory("");
                setSearch("");
              }}
              className="ml-1 px-1.5 py-0.5 rounded bg-ep-surface/60 hover:bg-ep-surface text-text-muted hover:text-text-primary transition text-[10px]"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Featured carousel (Hot view, grid only) */}
      {view === "grid" && (
        <AnimatePresence>
          {featuredMarkets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <FeaturedMarketBanner markets={featuredMarkets as any} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Content — Grid or Calendar */}
      <AnimatePresence mode="wait">
        {view === "calendar" ? (
          <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <CalendarView
              markets={calendarMarkets}
              loading={calendarLoading}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              livePrices={livePrices}
            />
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {loading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <MarketCardSkeleton key={i} />
                ))}
              </div>
            ) : enrichedMarkets.length === 0 ? (
              <div className="ep-card p-12 text-center">
                <div className="flex justify-center mb-3"><Search size={36} strokeWidth={1.5} className="text-text-muted" /></div>
                <h3 className="font-display font-semibold text-text-primary">
                  No markets found
                </h3>
                <p className="text-sm text-text-muted mt-1">
                  {debouncedSearch
                    ? "Try a different search term."
                    : "No active markets in this category."}
                </p>
              </div>
            ) : (
              <>
                <motion.div
                  key={`${activeCategory}-${activeSubcategory}-${debouncedSearch}-${sort}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid md:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {enrichedMarkets.map((m, i) => (
                    <motion.div
                      key={m.market_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
                    >
                      <MarketCard market={m} />
                    </motion.div>
                  ))}
                </motion.div>

                {/* Infinite scroll sentinel */}
                <div ref={loadMoreRef} className="flex justify-center py-4">
                  {loadingMore && (
                    <span className="flex items-center gap-2 text-sm text-text-muted">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading more...
                    </span>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
