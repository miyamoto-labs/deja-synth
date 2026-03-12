"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PickCard,
  PickCardSkeleton,
  FilterBar,
  SortDropdown,
  DailySuperPick,
  DailySuperPickSkeleton,
  CategorySection,
  PickTierBadge,
} from "@/app/components/ui";

// ── Categories ──────────────────────────────────
const categories = [
  { id: "all", label: "All", emoji: "📊" },
  { id: "politics", label: "Politics", emoji: "🏛️" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "crypto", label: "Crypto", emoji: "💎" },
  { id: "culture", label: "Culture", emoji: "🎬" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "wild", label: "Wild Picks", emoji: "🎲" },
];

// ── Wild Pick Detection ─────────────────────────
const wildKeywords = [
  "alien", "ufo", "supernatural", "ghost", "bigfoot",
  "conspiracy", "elvis", "mars", "time travel", "simulation",
  "zombie", "vampire", "apocalypse", "flat earth", "illuminati",
  "loch ness", "yeti", "sasquatch", "paranormal", "multiverse",
];

function isWildPick(pick: any): boolean {
  const volume = pick.market?.volume || pick.volume_24h || 0;
  const price = pick.entry_price || 0;
  const question = (pick.question || pick.market?.question || "").toLowerCase();

  // Low volume markets
  if (volume < 5000) return true;

  // Extreme prices (very likely or very unlikely)
  if (price < 0.05 || price > 0.95) return true;

  // Wild keywords in question
  if (wildKeywords.some((kw) => question.includes(kw))) return true;

  return false;
}

// ── Sorting ─────────────────────────────────────
const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "score", label: "Highest Score" },
  { value: "rr", label: "Best R/R" },
  { value: "tier", label: "By Tier" },
];

const statusOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };

function sortPicks(items: any[], sortBy: string): any[] {
  const sorted = [...items];
  switch (sortBy) {
    case "score":
      sorted.sort((a, b) => (b.composite_score || b.conviction_score || 0) - (a.composite_score || a.conviction_score || 0));
      break;
    case "rr":
      sorted.sort((a, b) => (b.risk_reward || 0) - (a.risk_reward || 0));
      break;
    case "tier":
      sorted.sort((a, b) => (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5));
      break;
    default: // newest
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return sorted;
}

// ── Category filtering ──────────────────────────
function filterPicksByCategory(picks: any[], categoryId: string): any[] {
  if (categoryId === "all") return picks;
  if (categoryId === "wild") return picks.filter(isWildPick);

  return picks.filter((p) => {
    const cat = (p.category || p.market?.category || "").toLowerCase();
    return cat === categoryId;
  });
}

// ── Category counts ─────────────────────────────
function getCategoryCounts(picks: any[]): Record<string, number> {
  const counts: Record<string, number> = { all: picks.length, wild: 0 };

  for (const p of picks) {
    const cat = (p.category || p.market?.category || "unknown").toLowerCase();
    counts[cat] = (counts[cat] || 0) + 1;
    if (isWildPick(p)) counts.wild++;
  }
  return counts;
}

// ── Tier Stats ──────────────────────────────────
function getTierStats(picks: any[]): { tier: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const p of picks) {
    const t = p.tier || "?";
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5));
}

// ═══════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════
export default function DashboardPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [superPick, setSuperPick] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);

  const fetchPicks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/dashboard/picks?${params}`);
      const data = await res.json();

      setPicks(data.picks || []);
      setSuperPick(data.superPick || null);
    } catch (err) {
      console.error("Picks fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchPicks();
  }, [fetchPicks]);

  useEffect(() => {
    const interval = setInterval(fetchPicks, 30000);
    return () => clearInterval(interval);
  }, [fetchPicks]);

  // ── Derived data ────────────────────────────
  const sortedPicks = useMemo(() => sortPicks(picks, sort), [picks, sort]);
  const categoryCounts = useMemo(() => getCategoryCounts(picks), [picks]);
  const tierStats = useMemo(() => getTierStats(picks), [picks]);
  const activePicks = useMemo(() => picks.filter((p) => p.status === "active"), [picks]);

  // Filter by active category
  const filteredPicks = useMemo(() => {
    const filtered = filterPicksByCategory(sortedPicks, activeCategory);
    return filtered;
  }, [sortedPicks, activeCategory]);

  // Group by category for "all" view
  const categoryGroups = useMemo(() => {
    if (activeCategory !== "all") return null;

    const groups: { category: typeof categories[number]; picks: any[] }[] = [];
    // Skip "all" and "wild" for grouping — they're special
    for (const cat of categories.filter((c) => c.id !== "all" && c.id !== "wild")) {
      const catPicks = filterPicksByCategory(sortedPicks, cat.id);
      if (catPicks.length > 0) {
        groups.push({ category: cat, picks: catPicks });
      }
    }

    // Wild picks always last
    const wildPicks = filterPicksByCategory(sortedPicks, "wild");
    if (wildPicks.length > 0) {
      groups.push({
        category: { id: "wild", label: "Wild Picks", emoji: "🎲" },
        picks: wildPicks,
      });
    }

    return groups;
  }, [sortedPicks, activeCategory]);

  // ── Render ──────────────────────────────────
  return (
    <div className="py-6 space-y-6">
      {/* ── Header ───────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <span>🎯</span> AI Picks
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            {picks.length} picks total · {activePicks.length} active
            {tierStats.length > 0 && (
              <span className="ml-2">
                {tierStats.map((t) => (
                  <span key={t.tier} className="inline-flex items-center gap-0.5 ml-1.5">
                    <PickTierBadge tier={t.tier} size="sm" showLabel={false} />
                    <span className="text-[10px] text-text-muted">×{t.count}</span>
                  </span>
                ))}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Daily Super Pick ─────────────────── */}
      {loading ? (
        <DailySuperPickSkeleton />
      ) : superPick ? (
        <DailySuperPick pick={superPick} />
      ) : null}

      {/* ── Category Tabs ────────────────────── */}
      <div className="space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {categories.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all
                  ${
                    isActive
                      ? cat.id === "wild"
                        ? "bg-purple-500/15 text-purple-400 border border-purple-500/25 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
                        : "bg-accent/15 text-accent border border-accent/25 shadow-[0_0_8px_rgba(0,240,160,0.1)]"
                      : "bg-ep-surface/40 text-text-muted border border-ep-border/50 hover:text-text-secondary hover:border-ep-border"
                  }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1 py-px rounded ${
                      isActive ? "bg-white/10" : "bg-ep-surface/60"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-4">
          <FilterBar label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          <div className="ml-auto">
            <SortDropdown options={sortOptions} value={sort} onChange={setSort} />
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          <PickCardSkeleton />
          <PickCardSkeleton />
          <PickCardSkeleton />
        </div>
      ) : picks.length === 0 ? (
        <EmptyState statusFilter={statusFilter} />
      ) : activeCategory === "all" && categoryGroups ? (
        /* ── Grouped "All" View ──────────────── */
        <div className="space-y-8">
          {categoryGroups.map(({ category, picks: catPicks }) => (
            <CategorySection
              key={category.id}
              category={category}
              picks={catPicks}
              defaultOpen={catPicks.length <= 10}
              isWild={category.id === "wild"}
            />
          ))}
        </div>
      ) : activeCategory === "wild" ? (
        /* ── Wild Picks View ─────────────────── */
        <div className="space-y-3">
          <CategorySection
            category={{ id: "wild", label: "Wild Picks", emoji: "🎲" }}
            picks={filteredPicks}
            defaultOpen={true}
            isWild={true}
          />
        </div>
      ) : filteredPicks.length > 0 ? (
        /* ── Single Category View ────────────── */
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {filteredPicks.map((pick: any, index: number) => (
            <PickCard
              key={pick.id}
              pick={pick}
              variant={index === 0 ? "hero" : "compact"}
            />
          ))}
        </motion.div>
      ) : (
        <EmptyState statusFilter={statusFilter} category={activeCategory} />
      )}
    </div>
  );
}

// ── Empty state ─────────────────────────────────
function EmptyState({ statusFilter, category }: { statusFilter?: string; category?: string }) {
  const catLabel = categories.find((c) => c.id === category)?.label;

  return (
    <div className="ep-card p-12 text-center">
      <div className="text-4xl mb-3">{category === "wild" ? "🎲" : "📋"}</div>
      <h3 className="font-display font-semibold text-text-primary">
        No {catLabel ? `${catLabel} ` : ""}picks found
      </h3>
      <p className="text-sm text-text-muted mt-1">
        {statusFilter && statusFilter !== "all"
          ? "Try a different filter."
          : category
          ? `No picks in this category yet. Check back soon!`
          : "The engine will generate picks once it's running."}
      </p>
    </div>
  );
}
