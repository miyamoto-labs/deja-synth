import { getSupabase } from "@/app/lib/supabase-server";

const CLOB_HOST = "https://clob.polymarket.com";
const GAMMA_URL = "https://gamma-api.polymarket.com";

// ── Types ────────────────────────────────────────

export interface RawRewardMarket {
  conditionId: string;
  rewardsDaily: number;
  rewardsMaxSpread: number;
  rewardsMinSize: number;
  /** Token IDs from the reward endpoint — may be nested in assets */
  assets?: { asset_id: string }[];
  token?: string;
}

export interface ScoredMarket {
  condition_id: string;
  question: string;
  slug: string;
  end_date: string | null;
  yes_token: string;
  no_token: string;
  daily_reward: number;
  max_spread: number;
  min_size: number;
  midpoint: number;
  spread: number;
  price_std_dev: number;
  mm_score: number;
  risk_tier: "low" | "medium" | "high";
  est_apy: number;
  fill_risk: number;
  reward_per_1k: number;
  side_required: string;
  days_remaining: number;
  competing_liquidity: number;
  scored_at: string;
}

export interface EarnStats {
  total_markets: number;
  avg_mm_score: number;
  best_apy: number;
  total_daily_rewards: number;
}

// ── Scoring Algorithm ─────────────────────────────

function computeRiskTier(midpoint: number): "low" | "medium" | "high" {
  const dist = Math.abs(midpoint - 0.5);
  if (dist >= 0.4) return "low";    // < 0.10 or > 0.90
  if (dist >= 0.25) return "medium"; // 0.10–0.25 or 0.75–0.90
  return "high";                     // 0.25–0.65
}

export function computeMMScore(market: {
  dailyReward: number;
  competingLiquidity: number;
  midpoint: number;
  spread: number;
  maxSpread: number;
  minSize: number;
  priceStdDev: number;
  daysRemaining: number;
}): number {
  // Yield (20%): 1% daily relative to liquidity = score 100
  const yieldScore = Math.min(
    100,
    market.competingLiquidity > 0
      ? (market.dailyReward / market.competingLiquidity) * 10000
      : 0
  );

  // Safety (25%): how far from 50/50 — closer to 0 or 1 is safer
  const safetyScore = Math.abs(market.midpoint - 0.5) * 2 * 100;

  // Competition (20%): wider spread relative to max = less competition
  const competitionScore =
    market.maxSpread > 0
      ? Math.min(100, (market.spread / market.maxSpread) * 100)
      : 50;

  // Efficiency (20%): reward per dollar of minimum size
  const efficiencyScore = Math.min(
    100,
    market.minSize > 0 ? (market.dailyReward / market.minSize) * 20 : 0
  );

  // Stability (10%): lower price volatility = higher score
  const stabilityScore = Math.max(0, 100 - market.priceStdDev * 1000);

  // Time (5%): sweet spot is 14–90 days remaining
  let timeScore: number;
  if (market.daysRemaining < 3) timeScore = 10;
  else if (market.daysRemaining < 14)
    timeScore = 10 + ((market.daysRemaining - 3) / 11) * 90;
  else if (market.daysRemaining <= 90) timeScore = 100;
  else timeScore = Math.max(20, 100 - (market.daysRemaining - 90) * 0.5);

  return (
    yieldScore * 0.2 +
    safetyScore * 0.25 +
    competitionScore * 0.2 +
    efficiencyScore * 0.2 +
    stabilityScore * 0.1 +
    timeScore * 0.05
  );
}

// ── External API Helpers ──────────────────────────

async function fetchRewardMarkets(): Promise<RawRewardMarket[]> {
  const res = await fetch(`${CLOB_HOST}/rewards/markets`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CLOB rewards/markets: ${res.status}`);
  const data = await res.json();
  // The endpoint may return an array or { data: [...] }
  return Array.isArray(data) ? data : data?.data || [];
}

async function fetchMidpoints(
  tokenIds: string[]
): Promise<Record<string, number>> {
  if (tokenIds.length === 0) return {};
  const res = await fetch(`${CLOB_HOST}/midpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokenIds.map((id) => ({ token_id: id }))),
    cache: "no-store",
  });
  if (!res.ok) return {};
  const raw: Record<string, string> = await res.json();
  const result: Record<string, number> = {};
  for (const [id, val] of Object.entries(raw)) {
    const n = parseFloat(val);
    if (!isNaN(n)) result[id] = n;
  }
  return result;
}

async function fetchPriceStdDev(tokenId: string): Promise<number> {
  try {
    const url = `${CLOB_HOST}/prices-history?market=${tokenId}&interval=1d&fidelity=60`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return 0.05; // fallback
    const data = await res.json();
    const history: { t: number; p: number }[] = data?.history || [];
    if (history.length < 5) return 0.05;
    const prices = history.map((pt) =>
      typeof pt.p === "string" ? parseFloat(pt.p as any) : pt.p
    );
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance =
      prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length;
    return Math.sqrt(variance);
  } catch {
    return 0.05;
  }
}

interface GammaMarket {
  conditionId?: string;
  question?: string;
  slug?: string;
  endDate?: string;
  clobTokenIds?: string;
  volume?: string;
  liquidity?: string;
}

async function fetchGammaMetadata(
  conditionId: string
): Promise<GammaMarket | null> {
  try {
    const res = await fetch(
      `${GAMMA_URL}/markets?condition_id=${conditionId}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const arr = await res.json();
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  } catch {
    return null;
  }
}

// ── Main Scoring Pipeline ─────────────────────────

export async function fetchAndScoreAllMarkets(): Promise<{
  markets: ScoredMarket[];
  stats: EarnStats;
  scored_at: string;
}> {
  const supabase = getSupabase();
  const now = new Date();

  // 1. Fetch reward markets from CLOB
  const rewardMarkets = await fetchRewardMarkets();
  if (rewardMarkets.length === 0) {
    return {
      markets: [],
      stats: { total_markets: 0, avg_mm_score: 0, best_apy: 0, total_daily_rewards: 0 },
      scored_at: now.toISOString(),
    };
  }

  // 2. Gather all token IDs for midpoint batch fetch
  const allTokenIds: string[] = [];
  const conditionToReward = new Map<string, RawRewardMarket>();

  for (const rm of rewardMarkets) {
    const cid =
      rm.conditionId ||
      (rm as any).condition_id ||
      (rm as any).conditionID;
    if (!cid) continue;
    conditionToReward.set(cid, rm);
  }

  // 3. Fetch Gamma metadata for all markets (batched, 5 at a time)
  const conditionIds = [...conditionToReward.keys()];
  const gammaCache = new Map<string, GammaMarket>();

  for (let i = 0; i < conditionIds.length; i += 5) {
    const batch = conditionIds.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((cid) => fetchGammaMetadata(cid))
    );
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value) {
        gammaCache.set(batch[j], r.value);
        // Parse token IDs
        try {
          const raw = r.value.clobTokenIds || "[]";
          const tokens: string[] =
            typeof raw === "string" ? JSON.parse(raw) : raw;
          if (tokens[0]) allTokenIds.push(tokens[0]);
        } catch {}
      }
    }
  }

  // 4. Batch fetch midpoints
  const midpoints = await fetchMidpoints(allTokenIds);

  // 5. Score each market
  const scored: ScoredMarket[] = [];

  for (const [conditionId, reward] of conditionToReward) {
    const gamma = gammaCache.get(conditionId);
    const dailyReward =
      reward.rewardsDaily ||
      (reward as any).rewards_daily ||
      (reward as any).daily_reward ||
      0;
    const maxSpread =
      reward.rewardsMaxSpread ||
      (reward as any).rewards_max_spread ||
      (reward as any).max_spread ||
      0.04;
    const minSize =
      reward.rewardsMinSize ||
      (reward as any).rewards_min_size ||
      (reward as any).min_size ||
      25;

    // Parse token IDs
    let yesToken = "";
    let noToken = "";
    if (gamma?.clobTokenIds) {
      try {
        const raw = gamma.clobTokenIds;
        const tokens: string[] =
          typeof raw === "string" ? JSON.parse(raw) : raw;
        yesToken = tokens[0] || "";
        noToken = tokens[1] || "";
      } catch {}
    }

    // Get midpoint from batch
    const midpoint = yesToken ? midpoints[yesToken] ?? 0.5 : 0.5;

    // Fetch price std dev (for stability scoring)
    const priceStdDev = yesToken
      ? await fetchPriceStdDev(yesToken)
      : 0.05;

    // Compute derived values
    const endDate = gamma?.endDate || null;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((new Date(endDate).getTime() - now.getTime()) / 86400000))
      : 30;

    const competingLiquidity = parseFloat(gamma?.liquidity || "0") || 10000;
    const spread = maxSpread; // approximate — actual spread from order book would be more accurate
    const fillRisk = (1 - Math.abs(midpoint - 0.5) * 2) * 100;
    const estApy =
      competingLiquidity > 0
        ? (dailyReward / competingLiquidity) * 365 * 100
        : 0;
    const rewardPer1k =
      competingLiquidity > 0
        ? (dailyReward / competingLiquidity) * 1000
        : 0;

    const mmScore = computeMMScore({
      dailyReward,
      competingLiquidity,
      midpoint,
      spread,
      maxSpread,
      minSize,
      priceStdDev,
      daysRemaining,
    });

    const riskTier = computeRiskTier(midpoint);

    scored.push({
      condition_id: conditionId,
      question: gamma?.question || "Unknown market",
      slug: gamma?.slug || "",
      end_date: endDate,
      yes_token: yesToken,
      no_token: noToken,
      daily_reward: dailyReward,
      max_spread: maxSpread,
      min_size: minSize,
      midpoint,
      spread,
      price_std_dev: priceStdDev,
      mm_score: Math.round(mmScore * 10) / 10,
      risk_tier: riskTier,
      est_apy: Math.round(estApy * 10) / 10,
      fill_risk: Math.round(fillRisk * 10) / 10,
      reward_per_1k: Math.round(rewardPer1k * 100) / 100,
      side_required: "both",
      days_remaining: daysRemaining,
      competing_liquidity: competingLiquidity,
      scored_at: now.toISOString(),
    });
  }

  // Sort by MM score descending
  scored.sort((a, b) => b.mm_score - a.mm_score);

  // 6. Upsert into Supabase
  if (scored.length > 0) {
    const { error } = await supabase.from("lp_market_scores").upsert(
      scored.map((m) => ({
        condition_id: m.condition_id,
        question: m.question,
        slug: m.slug,
        end_date: m.end_date,
        yes_token: m.yes_token,
        no_token: m.no_token,
        daily_reward: m.daily_reward,
        max_spread: m.max_spread,
        min_size: m.min_size,
        midpoint: m.midpoint,
        spread: m.spread,
        price_std_dev: m.price_std_dev,
        mm_score: m.mm_score,
        risk_tier: m.risk_tier,
        est_apy: m.est_apy,
        fill_risk: m.fill_risk,
        reward_per_1k: m.reward_per_1k,
        side_required: m.side_required,
        days_remaining: m.days_remaining,
        competing_liquidity: m.competing_liquidity,
        scored_at: now.toISOString(),
        updated_at: now.toISOString(),
      })),
      { onConflict: "condition_id" }
    );
    if (error) console.error("Supabase upsert error:", error);
  }

  // 7. Compute stats
  const stats: EarnStats = {
    total_markets: scored.length,
    avg_mm_score:
      scored.length > 0
        ? Math.round(
            (scored.reduce((sum, m) => sum + m.mm_score, 0) / scored.length) *
              10
          ) / 10
        : 0,
    best_apy:
      scored.length > 0
        ? Math.max(...scored.map((m) => m.est_apy))
        : 0,
    total_daily_rewards: Math.round(
      scored.reduce((sum, m) => sum + m.daily_reward, 0) * 100
    ) / 100,
  };

  return { markets: scored, stats, scored_at: now.toISOString() };
}

// ── Cache Layer ───────────────────────────────────

export async function getCachedOrRefresh(maxAgeHours = 4): Promise<{
  markets: ScoredMarket[];
  stats: EarnStats;
  scored_at: string;
}> {
  const supabase = getSupabase();

  // Check the most recent scored_at
  const { data: latest } = await supabase
    .from("lp_market_scores")
    .select("scored_at")
    .order("scored_at", { ascending: false })
    .limit(1)
    .single();

  const lastScoredAt = latest?.scored_at
    ? new Date(latest.scored_at)
    : null;
  const ageMs = lastScoredAt
    ? Date.now() - lastScoredAt.getTime()
    : Infinity;
  const maxAgeMs = maxAgeHours * 3600 * 1000;

  // If cache is fresh, return from DB
  if (ageMs < maxAgeMs && lastScoredAt) {
    const { data: markets } = await supabase
      .from("lp_market_scores")
      .select("*")
      .order("mm_score", { ascending: false });

    const rows = (markets || []) as ScoredMarket[];

    const stats: EarnStats = {
      total_markets: rows.length,
      avg_mm_score:
        rows.length > 0
          ? Math.round(
              (rows.reduce((sum, m) => sum + Number(m.mm_score), 0) /
                rows.length) *
                10
            ) / 10
          : 0,
      best_apy:
        rows.length > 0
          ? Math.max(...rows.map((m) => Number(m.est_apy)))
          : 0,
      total_daily_rewards: Math.round(
        rows.reduce((sum, m) => sum + Number(m.daily_reward), 0) * 100
      ) / 100,
    };

    return {
      markets: rows,
      stats,
      scored_at: lastScoredAt.toISOString(),
    };
  }

  // Otherwise, refresh
  return fetchAndScoreAllMarkets();
}
