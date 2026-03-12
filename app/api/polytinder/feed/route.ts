import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

const GAMMA_API = "https://gamma-api.polymarket.com";

/**
 * GET /api/polytinder/feed
 * Returns an interleaved card feed from AI picks, AI-analyzed markets, hot markets, and copy signals.
 *
 * Query params:
 *   limit   — max cards (default: 50, max: 100)
 *   exclude — comma-separated market_ids to skip (already seen)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const excludeRaw = searchParams.get("exclude") || "";
    const excludeIds = excludeRaw ? excludeRaw.split(",").filter(Boolean) : [];

    const sb = getSupabase();
    const now = new Date().toISOString();

    // ── Fetch all four sources in parallel ──
    const [picksRes, analyzedRes, marketsRes, signalsRes] = await Promise.all([
      // 1. AI Picks — high conviction (status=active, v3 scanner denormalized)
      sb
        .from("ep_curated_picks")
        .select(
          "id, market_id, direction, conviction_score, entry_price, target_price, stop_loss, risk_reward, edge_explanation, time_horizon, question, category, price, token_id, slug"
        )
        .eq("status", "active")
        .not("question", "is", null)
        .order("conviction_score", { ascending: false })
        .limit(30),

      // 2. AI Analyzed — mid conviction (status=analyzed)
      sb
        .from("ep_curated_picks")
        .select(
          "id, market_id, direction, conviction_score, entry_price, target_price, stop_loss, risk_reward, edge_explanation, time_horizon, question, category, price, token_id, slug"
        )
        .eq("status", "analyzed")
        .not("question", "is", null)
        .order("conviction_score", { ascending: false })
        .limit(50),

      // 3. Hot Markets by volume (non-expired, min liquidity)
      sb
        .from("ep_markets_raw")
        .select(
          "market_id, question, category, volume, liquidity, yes_price, no_price, yes_token, no_token, end_date"
        )
        .eq("active", true)
        .gt("end_date", now)
        .gt("liquidity", 1000)
        .order("volume", { ascending: false })
        .limit(80),

      // 4. Copy Signals (recent, non-expired markets)
      sb
        .from("ep_trader_trades")
        .select(
          "id, market_id, direction, amount, price, ep_tracked_traders(alias, roi, win_rate, bankroll_tier), ep_markets_raw!inner(question, category, volume, liquidity, yes_price, no_price, yes_token, no_token, end_date)"
        )
        .gt("ep_markets_raw.end_date", now)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // ── Normalize into FeedCard shape ──
    interface FeedCard {
      id: string;
      type: "pick" | "analyzed" | "market" | "signal";
      market_id: string;
      question: string;
      category: string;
      volume: number;
      end_date: string | null;
      yes_price: number;
      no_price: number;
      yes_token: string;
      no_token: string;
      // Pick/Analyzed-specific
      conviction_score: number | null;
      direction: string | null;
      edge_explanation: string | null;
      entry_price: number | null;
      target_price: number | null;
      risk_reward: number | null;
      pick_id: string | null;
      time_horizon: string | null;
      // Signal-specific
      signal_id: string | null;
      trader_alias: string | null;
      trader_roi: number | null;
      trader_win_rate: number | null;
      trader_tier: string | null;
      signal_amount: number | null;
      signal_direction: string | null;
    }

    const seen = new Set<string>(excludeIds);
    const picks: FeedCard[] = [];
    const analyzed: FeedCard[] = [];
    const markets: FeedCard[] = [];
    const signals: FeedCard[] = [];

    // Helper to normalize a pick/analyzed row (v3 denormalized — no join needed)
    function normalizePick(p: any, type: "pick" | "analyzed"): FeedCard | null {
      if (!p.question) return null;
      if (seen.has(p.market_id)) return null;

      // v3 picks store token_id (YES token) — derive NO token or leave empty
      const yesToken = p.token_id || "";
      const noToken = ""; // NO token not stored in v3, but swipe card only needs the direction token
      const yesPrice = p.price || p.entry_price || 0.5;

      const card: FeedCard = {
        id: `${type}-${p.id}`,
        type,
        market_id: p.market_id,
        question: p.question,
        category: p.category || "",
        volume: 0,
        end_date: null,
        yes_price: yesPrice,
        no_price: Math.round((1 - yesPrice) * 100) / 100,
        yes_token: yesToken,
        no_token: noToken,
        conviction_score: p.conviction_score,
        direction: p.direction,
        edge_explanation: p.edge_explanation,
        entry_price: p.entry_price,
        target_price: p.target_price,
        risk_reward: p.risk_reward,
        pick_id: p.id,
        time_horizon: p.time_horizon,
        signal_id: null,
        trader_alias: null,
        trader_roi: null,
        trader_win_rate: null,
        trader_tier: null,
        signal_amount: null,
        signal_direction: null,
      };
      seen.add(p.market_id);
      return card;
    }

    // Normalize picks
    for (const p of picksRes.data || []) {
      const card = normalizePick(p, "pick");
      if (card) picks.push(card);
    }

    // Normalize analyzed
    for (const p of analyzedRes.data || []) {
      const card = normalizePick(p, "analyzed");
      if (card) analyzed.push(card);
    }

    // ── Resolve missing tokens from Gamma API ──
    // v3 picks may not have token_ids; look them up by slug so bets can execute
    const cardsNeedingTokens = [...picks, ...analyzed].filter(
      (c) => !c.yes_token
    );
    if (cardsNeedingTokens.length > 0) {
      const toResolve = cardsNeedingTokens.slice(0, 20);
      const gammaResults = await Promise.allSettled(
        toResolve.map((card) =>
          fetch(`${GAMMA_API}/markets?slug=${card.market_id}&limit=1`, {
            next: { revalidate: 0 },
          })
            .then((r) => (r.ok ? r.json() : []))
            .then((data: any[]) => ({ card, market: data[0] || null }))
        )
      );
      for (const result of gammaResults) {
        if (result.status !== "fulfilled" || !result.value.market) continue;
        const { card, market: gm } = result.value;
        // Gamma returns clobTokenIds as JSON string: '["yesId","noId"]'
        let tokens: string[] = [];
        try {
          const raw = gm.clobTokenIds || "[]";
          tokens = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch { /* ignore */ }
        if (tokens.length >= 2) {
          card.yes_token = tokens[0];
          card.no_token = tokens[1];
        }
        if (gm.outcomePrices) {
          try {
            const prices = JSON.parse(gm.outcomePrices);
            if (prices.length >= 2) {
              card.yes_price = parseFloat(prices[0]);
              card.no_price = parseFloat(prices[1]);
            }
          } catch { /* ignore */ }
        }
        if (gm.volume) card.volume = parseFloat(gm.volume) || 0;
        if (gm.endDate) card.end_date = gm.endDate;
      }
    }

    // Normalize hot markets (skip those already in picks/analyzed)
    for (const m of marketsRes.data || []) {
      if (seen.has(m.market_id)) continue;
      if (!m.yes_token || !m.no_token) continue;

      markets.push({
        id: `market-${m.market_id}`,
        type: "market",
        market_id: m.market_id,
        question: m.question || "",
        category: m.category || "",
        volume: m.volume || 0,
        end_date: m.end_date || null,
        yes_price: m.yes_price || 0.5,
        no_price: m.no_price || 0.5,
        yes_token: m.yes_token,
        no_token: m.no_token,
        conviction_score: null,
        direction: null,
        edge_explanation: null,
        entry_price: null,
        target_price: null,
        risk_reward: null,
        pick_id: null,
        time_horizon: null,
        signal_id: null,
        trader_alias: null,
        trader_roi: null,
        trader_win_rate: null,
        trader_tier: null,
        signal_amount: null,
        signal_direction: null,
      });
      seen.add(m.market_id);
    }

    // Normalize signals (skip dupes)
    for (const s of signalsRes.data || []) {
      const m = (s as any).ep_markets_raw;
      const t = (s as any).ep_tracked_traders;
      if (!m || !m.yes_token || !m.no_token) continue;
      if (seen.has(s.market_id)) continue;

      signals.push({
        id: `signal-${s.id}`,
        type: "signal",
        market_id: s.market_id,
        question: m.question || "",
        category: m.category || "",
        volume: m.volume || 0,
        end_date: m.end_date || null,
        yes_price: m.yes_price || 0.5,
        no_price: m.no_price || 0.5,
        yes_token: m.yes_token,
        no_token: m.no_token,
        conviction_score: null,
        direction: s.direction || null,
        edge_explanation: null,
        entry_price: null,
        target_price: null,
        risk_reward: null,
        pick_id: null,
        time_horizon: null,
        signal_id: s.id,
        trader_alias: t?.alias || null,
        trader_roi: t?.roi || null,
        trader_win_rate: t?.win_rate || null,
        trader_tier: t?.bankroll_tier || null,
        signal_amount: s.amount || null,
        signal_direction: s.direction || null,
      });
      seen.add(s.market_id);
    }

    // ── Interleave: [pick, analyzed, market, signal, analyzed, market, ...] ──
    // Prioritize AI-enriched cards (picks + analyzed) over raw markets
    const feed: FeedCard[] = [];
    let pi = 0,
      ai = 0,
      mi = 0,
      si = 0;
    const pattern = [
      "pick",
      "analyzed",
      "market",
      "signal",
      "analyzed",
      "market",
    ] as const;
    let patIdx = 0;

    while (feed.length < limit) {
      const source = pattern[patIdx % pattern.length];
      let card: FeedCard | undefined;

      if (source === "pick" && pi < picks.length) {
        card = picks[pi++];
      } else if (source === "analyzed" && ai < analyzed.length) {
        card = analyzed[ai++];
      } else if (source === "market" && mi < markets.length) {
        card = markets[mi++];
      } else if (source === "signal" && si < signals.length) {
        card = signals[si++];
      }

      // Fallback: try any remaining source
      if (!card) {
        if (pi < picks.length) card = picks[pi++];
        else if (ai < analyzed.length) card = analyzed[ai++];
        else if (si < signals.length) card = signals[si++];
        else if (mi < markets.length) card = markets[mi++];
      }

      if (!card) break; // All sources exhausted
      feed.push(card);
      patIdx++;
    }

    return NextResponse.json(
      {
        cards: feed,
        total: feed.length,
        sources: {
          picks: picks.length,
          analyzed: analyzed.length,
          markets: markets.length,
          signals: signals.length,
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    console.error("PolyTinder feed error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
