import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const revalidate = 60;

const GAMMA_URL = "https://gamma-api.polymarket.com";

// ── Map Polymarket tags → our categories ─────────
const TAG_TO_CATEGORY: Record<string, string> = {
  politics: "politics",
  geopolitics: "politics",
  elections: "politics",
  "global-elections": "politics",
  "world-elections": "politics",
  "us-presidential-election": "politics",
  trump: "politics",
  iran: "politics",
  "middle-east": "politics",
  israel: "politics",
  world: "politics",
  primaries: "politics",

  sports: "sports",
  soccer: "sports",
  nba: "sports",
  basketball: "sports",
  nfl: "sports",
  football: "sports",
  baseball: "sports",
  mlb: "sports",
  nhl: "sports",
  ufc: "sports",
  tennis: "sports",
  golf: "sports",
  "formula-1": "sports",
  boxing: "sports",
  hockey: "sports",
  cricket: "sports",
  mma: "sports",

  crypto: "crypto",
  "crypto-prices": "crypto",
  bitcoin: "crypto",
  ethereum: "crypto",
  solana: "crypto",
  altcoins: "crypto",
  defi: "crypto",
  memecoins: "crypto",

  "pop-culture": "culture",
  tech: "culture",
  "big-tech": "culture",
  ai: "culture",
  entertainment: "culture",
  music: "culture",
  movies: "culture",
  celebrities: "culture",
  "social-media": "culture",

  finance: "finance",
  "pre-market": "finance",
  economy: "finance",
  "fed-funds": "finance",
  stocks: "finance",
  "interest-rates": "finance",

  weather: "weather",
  temperature: "weather",
  climate: "weather",
  science: "weather",
  earthquake: "weather",
  hurricanes: "weather",
};

// Priority order for when an event has multiple tags
const CATEGORY_PRIORITY = ["sports", "politics", "crypto", "finance", "culture", "weather"];

function tagToCategory(tags: { slug: string }[]): string {
  if (!tags?.length) return "other";

  const matched = new Set<string>();
  for (const t of tags) {
    const cat = TAG_TO_CATEGORY[t.slug];
    if (cat) matched.add(cat);
  }

  for (const cat of CATEGORY_PRIORITY) {
    if (matched.has(cat)) return cat;
  }
  return matched.size > 0 ? [...matched][0] : "other";
}

function tagToSubcategory(tags: { slug: string }[], category: string): string {
  // Use the most specific Polymarket tag as subcategory
  const SUB_TAGS: Record<string, Record<string, string[]>> = {
    politics: {
      elections: ["elections", "global-elections", "world-elections", "primaries", "us-presidential-election"],
      geopolitics: ["geopolitics", "iran", "middle-east", "israel", "world"],
      trump: ["trump"],
    },
    sports: {
      nba: ["nba", "basketball", "nba-finals", "nba-champion"],
      nfl: ["nfl", "football"],
      soccer: ["soccer", "premier-league", "la-liga", "champions-league"],
      mlb: ["mlb", "baseball"],
      combat: ["ufc", "boxing", "mma"],
      other: ["nhl", "hockey", "tennis", "golf", "formula-1", "cricket"],
    },
    crypto: {
      bitcoin: ["bitcoin"],
      ethereum: ["ethereum"],
      altcoins: ["solana", "altcoins"],
      defi_web3: ["defi"],
      memecoins: ["memecoins"],
      prices: ["crypto-prices"],
    },
    culture: {
      tech_ai: ["tech", "big-tech", "ai"],
      entertainment: ["pop-culture", "entertainment", "movies", "celebrities"],
      music: ["music"],
      social_media: ["social-media"],
    },
    finance: {
      fed_rates: ["fed-funds", "interest-rates"],
      stocks: ["stocks", "pre-market"],
      economy: ["economy"],
    },
    weather: {
      temperature: ["temperature"],
      earthquakes: ["earthquake"],
      hurricanes: ["hurricanes"],
      climate: ["climate", "science"],
    },
  };

  const subs = SUB_TAGS[category];
  if (!subs) return "general";

  const tagSlugs = new Set(tags.map((t) => t.slug));
  for (const [sub, slugs] of Object.entries(subs)) {
    for (const s of slugs) {
      if (tagSlugs.has(s)) return sub;
    }
  }
  return "general";
}

// ── Hotness Formula ──────────────────────────────
function computeHotness(e: {
  volume: number;
  volume_24h: number;
  competitive: number;
  end_date: string;
}): number {
  const recentVol = Math.log10(Math.max(e.volume_24h || 1, 1));
  const totalVol = Math.log10(Math.max(e.volume || 1, 1));
  const vol = recentVol * 0.7 + totalVol * 0.3;

  // Competitive = how contested (0-1, higher = more uncertain)
  const comp = Math.max(e.competitive || 0, 0.05);

  const msLeft = new Date(e.end_date).getTime() - Date.now();
  const daysLeft = Math.max(msLeft / 86_400_000, 0);
  const urgency = 1 + 2 / (1 + daysLeft / 7);

  return vol * comp * urgency;
}

// ── Types ────────────────────────────────────────
interface GammaTag {
  slug: string;
  label: string;
}

interface GammaMarket {
  id: number;
  question: string;
  slug: string;
  conditionId: string;
  outcomePrices: string;
  clobTokenIds: string;
  volume: string | number;
  volumeNum: number;
  volume24hr: number;
  liquidity: string | number;
  liquidityNum: number;
  endDate: string;
  active: boolean;
  closed: boolean;
  negRisk: boolean;
  groupItemTitle?: string;
  sportsMarketType?: string;
}

interface GammaEvent {
  id: number;
  title: string;
  slug: string;
  volume: number;
  volume24hr: number;
  liquidity: number;
  competitive: number;
  endDate: string;
  startDate: string;
  negRisk: boolean;
  active: boolean;
  closed: boolean;
  tags: GammaTag[];
  markets: GammaMarket[];
}

interface ParsedOutcome {
  label: string;
  yes_price: number;
  market_id: string;
  yes_token: string;
  no_token: string;
  volume: number;
}

interface ParsedEvent {
  event_id: string;
  condition_id: string;
  question: string;
  category: string;
  subcategory: string;
  is_multi: boolean;
  // For single markets (is_multi=false)
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  yes_label?: string;
  no_label?: string;
  // For multi-choice (is_multi=true)
  outcomes: ParsedOutcome[];
  outcome_count: number;
  // Common
  volume: number;
  volume_24h: number;
  liquidity: number;
  end_date: string;
  competitive: number;
}

function parseMarketTokens(m: GammaMarket) {
  const prices =
    typeof m.outcomePrices === "string"
      ? JSON.parse(m.outcomePrices || "[]")
      : m.outcomePrices || [];
  const tokens =
    typeof m.clobTokenIds === "string"
      ? JSON.parse(m.clobTokenIds || "[]")
      : m.clobTokenIds || [];
  return {
    yes_price: prices[0] ? parseFloat(prices[0]) : 0.5,
    no_price: prices[1] ? parseFloat(prices[1]) : 0.5,
    yes_token: tokens[0] || "",
    no_token: tokens[1] || "",
  };
}

function parseEvent(e: GammaEvent): ParsedEvent | null {
  const liveMarkets = (e.markets || []).filter(
    (m) => m.active && !m.closed && m.endDate
  );
  if (liveMarkets.length === 0) return null;

  const category = tagToCategory(e.tags);
  const subcategory = tagToSubcategory(e.tags, category);
  const endDate = e.endDate || liveMarkets[0]?.endDate || "";

  // Check if ended
  if (endDate && endDate < new Date().toISOString()) return null;

  const isMulti = e.negRisk && liveMarkets.length > 1;

  if (isMulti) {
    // Multi-choice: parse each outcome
    const outcomes: ParsedOutcome[] = liveMarkets
      .map((m) => {
        const { yes_price, yes_token, no_token } = parseMarketTokens(m);
        return {
          label: m.groupItemTitle || m.question,
          yes_price,
          market_id: m.slug || m.conditionId,
          yes_token,
          no_token,
          volume: m.volumeNum || 0,
        };
      })
      .filter((o) => o.yes_price >= 0.005) // hide < 0.5% outcomes
      .sort((a, b) => b.yes_price - a.yes_price);

    if (outcomes.length === 0) return null;

    return {
      event_id: e.slug || String(e.id),
      condition_id: liveMarkets[0].conditionId,
      question: e.title,
      category,
      subcategory,
      is_multi: true,
      yes_price: outcomes[0].yes_price,
      no_price: 1 - outcomes[0].yes_price,
      yes_token: outcomes[0].yes_token,
      no_token: outcomes[0].no_token,
      outcomes: outcomes.slice(0, 6), // top 6 outcomes in response
      outcome_count: outcomes.length,
      volume: e.volume || 0,
      volume_24h: e.volume24hr || 0,
      liquidity: e.liquidity || 0,
      end_date: endDate,
      competitive: e.competitive || 0,
    };
  } else {
    // Single binary market
    const m = liveMarkets[0];
    const { yes_price, no_price, yes_token, no_token } = parseMarketTokens(m);

    // Skip resolved single markets
    if (yes_price < 0.03 || yes_price > 0.97) return null;

    // For sports markets, parse team names from event title ("Team A vs. Team B")
    let yes_label: string | undefined;
    let no_label: string | undefined;
    if (category === 'sports') {
      const vsMatch = (e.title || '').match(/^(.+?)\s+vs\.?\s+(.+)$/i);
      if (vsMatch) {
        yes_label = vsMatch[1].trim();
        no_label = vsMatch[2].trim();
      }
    }

    return {
      event_id: e.slug || String(e.id),
      condition_id: m.conditionId,
      question: e.title || m.question,
      category,
      subcategory,
      is_multi: false,
      yes_price,
      no_price,
      yes_token,
      no_token,
      ...(yes_label ? { yes_label } : {}),
      ...(no_label ? { no_label } : {}),
      outcomes: [],
      outcome_count: 1,
      volume: e.volume || m.volumeNum || 0,
      volume_24h: e.volume24hr || m.volume24hr || 0,
      liquidity: e.liquidity || m.liquidityNum || 0,
      end_date: endDate,
      competitive: e.competitive || 0,
    };
  }
}

// ── GET handler ──────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const category = params.get("category")?.toLowerCase() || "";
    const subcategory = params.get("subcategory")?.toLowerCase() || "";
    const search = params.get("search") || "";
    const sort = params.get("sort") || "hot";
    const mode = params.get("mode") || ""; // "calendar" for calendar view
    const rangeStart = params.get("start_date") || "";
    const rangeEnd = params.get("end_date") || "";
    const offset = parseInt(params.get("offset") || "0", 10);
    const limit = Math.min(parseInt(params.get("limit") || "50", 10), 100);

    // Fetch events in parallel (3 pages × 500 = 1500 events)
    const PAGE = 500;
    const PAGES = 3;

    const fetches = Array.from({ length: PAGES }, (_, i) => {
      const gp = new URLSearchParams({
        active: "true",
        closed: "false",
        limit: String(PAGE),
        offset: String(i * PAGE),
        order: "volume24hr",
        ascending: "false",
      });
      return fetch(`${GAMMA_URL}/events?${gp}`, {
        next: { revalidate: 60 },
      });
    });

    const responses = await Promise.all(fetches);
    const failed = responses.find((r) => !r.ok);
    if (failed) {
      return NextResponse.json(
        { error: "Failed to fetch from Gamma" },
        { status: 502 }
      );
    }

    const pages = await Promise.all(responses.map((r) => r.json()));
    const rawEvents: GammaEvent[] = pages.flat();

    // Deduplicate
    const seen = new Set<number>();
    const deduped = rawEvents.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Parse events → our format
    let events = deduped
      .map(parseEvent)
      .filter((e): e is ParsedEvent => e !== null);

    // Volume floor — kill dead fish markets
    events = events.filter(e => e.volume_24h > 1000 || e.volume > 50000);

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      events = events.filter(
        (e) =>
          e.question.toLowerCase().includes(q) ||
          e.outcomes.some((o) => o.label.toLowerCase().includes(q))
      );
    }

    // Category counts (before filtering)
    const category_counts: Record<string, number> = {};
    for (const e of events) {
      category_counts[e.category] = (category_counts[e.category] || 0) + 1;
    }

    // Category filter
    if (category && category !== "all" && category !== "hot") {
      events = events.filter((e) => e.category === category);
    }

    // Subcategory counts (after category filter)
    const subcategory_counts: Record<string, number> = {};
    for (const e of events) {
      subcategory_counts[e.subcategory] =
        (subcategory_counts[e.subcategory] || 0) + 1;
    }

    // Trending tags — top subcategories by 24h volume
    const subcatVolume: Record<string, number> = {};
    for (const e of events) {
      if (e.subcategory) {
        subcatVolume[e.subcategory] = (subcatVolume[e.subcategory] || 0) + (e.volume_24h || 0);
      }
    }
    const trending_tags = Object.entries(subcatVolume)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, vol]) => ({ tag, volume_24h: vol }));

    // Subcategory filter
    if (subcategory) {
      events = events.filter((e) => e.subcategory === subcategory);
    }

    // Score hotness
    const scored = events.map((e) => ({
      ...e,
      hotness: computeHotness(e),
    }));

    // Sort
    switch (sort) {
      case "newest":
        scored.sort(
          (a, b) =>
            new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
        );
        break;
      case "ending_soon":
        scored.sort(
          (a, b) =>
            new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
        );
        break;
      case "volume":
        scored.sort((a, b) => b.volume - a.volume);
        break;
      case "competitive":
        scored.sort((a, b) => b.competitive - a.competitive);
        break;
      default: // hot
        scored.sort((a, b) => b.hotness - a.hotness);
    }

    // Fetch active staff picks
    const sb = getSupabase();
    const { data: picks } = await sb
      .from("ep_curated_picks")
      .select("slug, direction, tier, composite_score")
      .eq("status", "active");
    const pickMap = new Map((picks || []).map((p: any) => [p.slug, p]));

    // Calendar mode: return all markets in date range (no pagination)
    if (mode === "calendar" && rangeStart && rangeEnd) {
      const rs = new Date(rangeStart);
      const re = new Date(rangeEnd);
      re.setHours(23, 59, 59, 999);

      const calMarkets = scored.filter((e) => {
        const d = new Date(e.end_date);
        return d >= rs && d <= re;
      });

      const mapMarket = (e: (typeof scored)[0]) => {
        const pick = pickMap.get(e.event_id);
        return {
          market_id: e.event_id,
          condition_id: e.condition_id,
          question: e.question,
          category: e.category,
          subcategory: e.subcategory,
          is_multi: e.is_multi,
          yes_price: e.yes_price,
          no_price: e.no_price,
          yes_token: e.yes_token,
          no_token: e.no_token,
          ...(e.yes_label ? { yes_label: e.yes_label } : {}),
          ...(e.no_label ? { no_label: e.no_label } : {}),
          outcomes: e.is_multi ? e.outcomes : undefined,
          outcome_count: e.outcome_count,
          volume: e.volume,
          volume_24h: e.volume_24h,
          liquidity: e.liquidity,
          end_date: e.end_date,
          hotness: Math.round(e.hotness * 100) / 100,
          ...(pick ? { staff_pick: { direction: pick.direction, tier: pick.tier } } : {}),
        };
      };

      return NextResponse.json(
        {
          markets: calMarkets.map(mapMarket),
          total: calMarkets.length,
          hasMore: false,
          category_counts,
          subcategory_counts,
          trending_tags,
        },
        {
          headers: {
            "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

    // Paginate
    const total = scored.length;
    const page = scored.slice(offset, offset + limit);

    return NextResponse.json(
      {
        markets: page.map((e) => {
          const pick = pickMap.get(e.event_id);
          return {
            market_id: e.event_id,
            condition_id: e.condition_id,
            question: e.question,
            category: e.category,
            subcategory: e.subcategory,
            is_multi: e.is_multi,
            yes_price: e.yes_price,
            no_price: e.no_price,
            yes_token: e.yes_token,
            no_token: e.no_token,
            ...(e.yes_label ? { yes_label: e.yes_label } : {}),
            ...(e.no_label ? { no_label: e.no_label } : {}),
            outcomes: e.is_multi ? e.outcomes : undefined,
            outcome_count: e.outcome_count,
            volume: e.volume,
            volume_24h: e.volume_24h,
            liquidity: e.liquidity,
            end_date: e.end_date,
            hotness: Math.round(e.hotness * 100) / 100,
            ...(pick ? { staff_pick: { direction: pick.direction, tier: pick.tier } } : {}),
          };
        }),
        total,
        hasMore: offset + page.length < total,
        category_counts,
        subcategory_counts,
        trending_tags,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("Markets API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
