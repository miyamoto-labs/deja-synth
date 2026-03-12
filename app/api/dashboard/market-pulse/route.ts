import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/market-pulse
 *
 * Returns market pulse data:
 *  - movers: markets with biggest YES price change in last 24h
 *  - volume_leaders: highest volume markets
 *  - fresh_markets: newest markets added recently
 */
export async function GET() {
  try {
    const sb = getSupabase();
    const now = new Date();
    const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const h6ago = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

    // ── Fetch in parallel ──
    const [marketsRes, snapshotsOldRes, snapshotsNewRes] = await Promise.all([
      // All active markets with current prices
      sb
        .from("ep_markets_raw")
        .select(
          "market_id, question, category, volume, liquidity, yes_price, no_price, yes_token, no_token, end_date"
        )
        .eq("active", true)
        .gt("end_date", now.toISOString())
        .gt("liquidity", 1000)
        .order("volume", { ascending: false })
        .limit(200),

      // Oldest snapshots per market from ~24h ago (for baseline price)
      sb
        .from("ep_price_snapshots")
        .select("market_id, price, volume, timestamp")
        .eq("outcome", "YES")
        .gte("timestamp", h24ago)
        .lte("timestamp", new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()) // 20-24h ago window
        .order("timestamp", { ascending: true })
        .limit(500),

      // Latest snapshots from last 6h (current-ish)
      sb
        .from("ep_price_snapshots")
        .select("market_id, price, volume, timestamp")
        .eq("outcome", "YES")
        .gte("timestamp", h6ago)
        .order("timestamp", { ascending: false })
        .limit(500),
    ]);

    const markets = marketsRes.data || [];
    const oldSnaps = snapshotsOldRes.data || [];
    const newSnaps = snapshotsNewRes.data || [];

    // Build market lookup
    const marketMap = new Map<string, any>();
    for (const m of markets) {
      marketMap.set(m.market_id, m);
    }

    // Build baseline prices (first snapshot per market from ~24h ago)
    const baseline = new Map<string, { price: number; volume: number }>();
    for (const s of oldSnaps) {
      if (!baseline.has(s.market_id)) {
        baseline.set(s.market_id, { price: s.price, volume: s.volume });
      }
    }

    // Build current prices (latest snapshot per market)
    const current = new Map<string, { price: number; volume: number }>();
    for (const s of newSnaps) {
      if (!current.has(s.market_id)) {
        current.set(s.market_id, { price: s.price, volume: s.volume });
      }
    }

    // ── Compute movers: biggest absolute price change ──
    interface PulseCard {
      market_id: string;
      question: string;
      category: string;
      yes_price: number;
      no_price: number;
      yes_token: string;
      no_token: string;
      volume: number;
      liquidity: number;
      end_date: string | null;
      price_change: number; // absolute cents change
      price_direction: "up" | "down";
      volume_24h_change: number; // percentage
      tag: "mover" | "volume" | "new";
    }

    const movers: PulseCard[] = [];
    for (const [mid, old] of Array.from(baseline)) {
      const cur = current.get(mid);
      const mkt = marketMap.get(mid);
      if (!cur || !mkt) continue;

      const priceDelta = (cur.price - old.price) * 100; // in cents
      const absChange = Math.abs(priceDelta);
      if (absChange < 2) continue; // skip tiny moves

      const volChange =
        old.volume > 0 ? ((cur.volume - old.volume) / old.volume) * 100 : 0;

      movers.push({
        market_id: mid,
        question: mkt.question,
        category: mkt.category || "Other",
        yes_price: mkt.yes_price,
        no_price: mkt.no_price,
        yes_token: mkt.yes_token,
        no_token: mkt.no_token,
        volume: mkt.volume,
        liquidity: mkt.liquidity,
        end_date: mkt.end_date,
        price_change: Math.round(absChange),
        price_direction: priceDelta > 0 ? "up" : "down",
        volume_24h_change: Math.round(volChange),
        tag: "mover",
      });
    }

    // Sort by biggest move
    movers.sort((a, b) => b.price_change - a.price_change);

    // ── Volume leaders (not already in movers) ──
    const moverIds = new Set(movers.map((m) => m.market_id));
    const volumeLeaders: PulseCard[] = markets
      .filter((m: any) => !moverIds.has(m.market_id))
      .slice(0, 6)
      .map((m: any) => ({
        market_id: m.market_id,
        question: m.question,
        category: m.category || "Other",
        yes_price: m.yes_price,
        no_price: m.no_price,
        yes_token: m.yes_token,
        no_token: m.no_token,
        volume: m.volume,
        liquidity: m.liquidity,
        end_date: m.end_date,
        price_change: 0,
        price_direction: "up" as const,
        volume_24h_change: 0,
        tag: "volume" as const,
      }));

    return NextResponse.json(
      {
        movers: movers.slice(0, 8),
        volume_leaders: volumeLeaders,
        stats: {
          markets_tracked: markets.length,
          movers_count: movers.length,
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("Market pulse error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
