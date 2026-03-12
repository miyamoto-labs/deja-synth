import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

const GAMMA_URL = "https://gamma-api.polymarket.com";

/**
 * POST /api/trades/resolve
 * Resolves unresolved BUY trades for a user by checking Polymarket market outcomes.
 * Called lazily when user views their portfolio.
 *
 * Body: { walletAddress: string }
 *
 * For each unresolved BUY trade:
 * 1. Look up market slug via ep_markets_raw (token_id → slug)
 * 2. Check Gamma API if market is resolved
 * 3. If resolved, calculate realized P&L and update the trade
 */
export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // ── 1. Fetch unresolved BUY trades ──
    const { data: unresolvedTrades, error: fetchErr } = await supabase
      .from("ep_user_trades")
      .select("id, token_id, direction, amount, price, shares, created_at, source_id, source, market_slug")
      .eq("user_wallet", address)
      .eq("side", "BUY")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(20); // cap to avoid long-running requests

    if (fetchErr || !unresolvedTrades || unresolvedTrades.length === 0) {
      return NextResponse.json({ resolved: 0 });
    }

    // ── 2. Look up market info for each token_id ──
    const tokenIds = [...new Set(unresolvedTrades.map((t) => t.token_id).filter(Boolean))];
    if (tokenIds.length === 0) {
      return NextResponse.json({ resolved: 0 });
    }

    // Find markets matching these tokens (exact match first, then prefix)
    const [{ data: yesMatches }, { data: noMatches }] = await Promise.all([
      supabase
        .from("ep_markets_raw")
        .select("slug, condition_id, yes_token, no_token, end_date")
        .in("yes_token", tokenIds),
      supabase
        .from("ep_markets_raw")
        .select("slug, condition_id, yes_token, no_token, end_date")
        .in("no_token", tokenIds),
    ]);

    // Build token → market lookup
    const tokenMarketMap = new Map<
      string,
      { slug: string; conditionId: string; yesToken: string; noToken: string; endDate: string }
    >();
    for (const m of [...(yesMatches || []), ...(noMatches || [])]) {
      const entry = {
        slug: m.slug,
        conditionId: m.condition_id,
        yesToken: m.yes_token,
        noToken: m.no_token,
        endDate: m.end_date,
      };
      if (m.yes_token) tokenMarketMap.set(m.yes_token, entry);
      if (m.no_token) tokenMarketMap.set(m.no_token, entry);
    }

    // Prefix fallback: token_ids in ep_user_trades may be truncated
    const unmatchedTokens = tokenIds.filter((id) => !tokenMarketMap.has(id));
    for (const truncatedId of unmatchedTokens) {
      const { data: prefixMatch } = await supabase
        .from("ep_markets_raw")
        .select("slug, condition_id, yes_token, no_token, end_date")
        .or(`yes_token.like.${truncatedId}%,no_token.like.${truncatedId}%`)
        .limit(1);

      if (prefixMatch && prefixMatch[0]) {
        const m = prefixMatch[0];
        const entry = {
          slug: m.slug,
          conditionId: m.condition_id,
          yesToken: m.yes_token,
          noToken: m.no_token,
          endDate: m.end_date,
        };
        tokenMarketMap.set(truncatedId, entry);
      }
    }

    // Gamma token_id fallback for tokens not in ep_markets_raw
    const stillUnmatched = tokenIds.filter((id) => !tokenMarketMap.has(id));
    for (const tokenId of stillUnmatched.slice(0, 10)) {
      try {
        // Also check if trade already has market_slug from DB
        const tradeWithSlug = unresolvedTrades.find(
          (t) => t.token_id === tokenId && t.market_slug
        );
        if (tradeWithSlug?.market_slug) {
          // Use existing slug to fetch from Gamma
          const res = await fetch(`${GAMMA_URL}/markets/slug/${tradeWithSlug.market_slug}`, {
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const market = await res.json();
            const rawTokens = market.clobTokenIds || "[]";
            const tokens: string[] = typeof rawTokens === "string" ? JSON.parse(rawTokens) : rawTokens;
            tokenMarketMap.set(tokenId, {
              slug: tradeWithSlug.market_slug,
              conditionId: market.conditionId || "",
              yesToken: tokens[0] || "",
              noToken: tokens[1] || "",
              endDate: market.endDate || "",
            });
            continue;
          }
        }
        // Direct token_id lookup via Gamma
        const res = await fetch(`${GAMMA_URL}/markets?clob_token_ids=${tokenId}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const markets = await res.json();
          if (markets?.[0]) {
            const market = markets[0];
            const rawTokens = market.clobTokenIds || "[]";
            const tokens: string[] = typeof rawTokens === "string" ? JSON.parse(rawTokens) : rawTokens;
            tokenMarketMap.set(tokenId, {
              slug: market.slug || "",
              conditionId: market.conditionId || "",
              yesToken: tokens[0] || "",
              noToken: tokens[1] || "",
              endDate: market.endDate || "",
            });
          }
        }
      } catch { /* skip */ }
    }

    // ── 3. Group trades by market slug ──
    const slugToTrades = new Map<string, typeof unresolvedTrades>();
    const noSlugTrades: typeof unresolvedTrades = [];

    for (const trade of unresolvedTrades) {
      const market = tokenMarketMap.get(trade.token_id);
      if (!market?.slug) {
        noSlugTrades.push(trade);
        continue;
      }
      const existing = slugToTrades.get(market.slug) || [];
      existing.push(trade);
      slugToTrades.set(market.slug, existing);
    }

    // ── 4. Check each market's resolution status via Gamma API ──
    let resolvedCount = 0;
    const now = new Date().toISOString();

    // Process max 10 slugs per call to keep response time reasonable
    const slugsToCheck = [...slugToTrades.keys()].slice(0, 10);

    for (const slug of slugsToCheck) {
      try {
        const res = await fetch(`${GAMMA_URL}/markets/slug/${slug}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;

        const market = await res.json();

        // Parse outcome prices
        const outcomePrices =
          typeof market.outcomePrices === "string"
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices || [];

        const yesPrice = parseFloat(outcomePrices[0] || "0");
        const noPrice = parseFloat(outcomePrices[1] || "0");

        // Check resolution: Gamma flag OR price at definitive level (>=0.995)
        const effectivelyResolved =
          !!market.resolved || yesPrice >= 0.995 || noPrice >= 0.995;
        if (!effectivelyResolved) continue;

        const yesWon = yesPrice > 0.5;

        // Resolve each trade for this market
        const tradesToResolve = slugToTrades.get(slug) || [];
        for (const trade of tradesToResolve) {
          const marketInfo = tokenMarketMap.get(trade.token_id);
          if (!marketInfo) continue;

          // Determine if user's token is the YES or NO side
          const isYesToken = trade.token_id === marketInfo.yesToken;
          const userWon = (isYesToken && yesWon) || (!isYesToken && !yesWon);

          // P&L: If won, shares pay out $1 each. If lost, shares worth $0.
          const pnl = userWon
            ? Number(trade.shares) * 1 - Number(trade.amount)
            : -Number(trade.amount);

          // Update trade in DB
          await supabase
            .from("ep_user_trades")
            .update({
              realized_pnl: Math.round(pnl * 100) / 100,
              resolved_at: now,
              market_slug: slug,
            })
            .eq("id", trade.id);

          resolvedCount++;
        }
      } catch {
        // Skip this market — will retry next time
        continue;
      }
    }

    // ── 5. Handle trades without slugs — resolve via source-specific lookup ──
    // Build slug map from different source types:
    // - synth-trading: source_id IS the slug
    // - pick: source_id → ep_curated_picks.id → slug
    // - copytrade/auto-trade/signal: source_id → ep_auto_trade_log.signal_id → market_slug
    const tradeSlugMap = new Map<string, { slug: string; question?: string }>();

    // 5a. synth-trading: source_id IS the slug
    for (const t of noSlugTrades) {
      if ((t as any).source === "synth-trading" && t.source_id) {
        tradeSlugMap.set(t.id, { slug: t.source_id });
      }
    }

    // 5b. pick: lookup from ep_curated_picks
    const pickTrades = noSlugTrades.filter(
      (t) => (t as any).source === "pick" && t.source_id && !tradeSlugMap.has(t.id)
    );
    if (pickTrades.length > 0) {
      const pickIds = [...new Set(pickTrades.map((t) => t.source_id as string))];
      const { data: picks } = await supabase
        .from("ep_curated_picks")
        .select("id, slug, question")
        .in("id", pickIds);

      const pickMap = new Map<string, { slug: string; question?: string }>();
      for (const p of picks || []) {
        if (p.id && p.slug) pickMap.set(p.id, { slug: p.slug, question: p.question || undefined });
      }
      for (const t of pickTrades) {
        const pick = pickMap.get(t.source_id as string);
        if (pick) tradeSlugMap.set(t.id, pick);
      }
    }

    // 5c. copytrade/auto-trade: lookup from ep_auto_trade_log + ep_trader_trades fallback
    const copyTrades = noSlugTrades.filter(
      (t) => !tradeSlugMap.has(t.id) && t.source_id &&
        ["copytrade", "auto-trade", "signal"].includes((t as any).source || "")
    );
    if (copyTrades.length > 0) {
      const signalIds = [...new Set(copyTrades.map((t) => t.source_id as string))];

      // Try ep_auto_trade_log first
      const { data: logEntries } = await supabase
        .from("ep_auto_trade_log")
        .select("signal_id, market_slug, market_question")
        .in("signal_id", signalIds)
        .not("market_slug", "is", null);

      const logMap = new Map<string, { slug: string; question?: string }>();
      for (const l of logEntries || []) {
        if (l.signal_id && l.market_slug) {
          logMap.set(l.signal_id, { slug: l.market_slug, question: l.market_question || undefined });
        }
      }

      // Fallback: try ep_trader_trades for IDs not found in log
      const missingIds = signalIds.filter((id) => !logMap.has(id));
      if (missingIds.length > 0) {
        const { data: traderTrades } = await supabase
          .from("ep_trader_trades")
          .select("id, market_id, market_question")
          .in("id", missingIds);

        for (const tt of traderTrades || []) {
          if (tt.id && tt.market_id) {
            logMap.set(tt.id, { slug: tt.market_id, question: tt.market_question || undefined });
          }
        }
      }

      for (const t of copyTrades) {
        const entry = logMap.get(t.source_id as string);
        if (entry) tradeSlugMap.set(t.id, entry);
      }
    }

    // 5d. Resolve all trades that now have slugs
    const slugsToResolve = [...new Set([...tradeSlugMap.values()].map((v) => v.slug))].slice(0, 10);
    const slugResolutions = new Map<string, { yesWon: boolean; yesToken: string; noToken: string; question: string }>();

    for (const slug of slugsToResolve) {
      try {
        const res = await fetch(`${GAMMA_URL}/markets/slug/${slug}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const market = await res.json();

        const outcomePrices =
          typeof market.outcomePrices === "string"
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices || [];
        const yesPrice = parseFloat(outcomePrices[0] || "0");
        const noPrice = parseFloat(outcomePrices[1] || "0");
        const effectivelyResolved =
          !!market.resolved || yesPrice >= 0.995 || noPrice >= 0.995;
        if (!effectivelyResolved) continue;

        const rawTokens = market.clobTokenIds || "[]";
        const tokens: string[] =
          typeof rawTokens === "string" ? JSON.parse(rawTokens) : rawTokens;

        slugResolutions.set(slug, {
          yesWon: yesPrice > 0.5,
          yesToken: tokens[0] || "",
          noToken: tokens[1] || "",
          question: market.question || slug,
        });
      } catch {
        continue;
      }
    }

    // Apply resolutions to trades
    for (const trade of noSlugTrades) {
      const info = tradeSlugMap.get(trade.id);
      if (!info) continue;
      const resolution = slugResolutions.get(info.slug);
      if (!resolution) continue;

      // Determine win/loss — first try token match, then direction fallback
      const isYesToken = trade.token_id === resolution.yesToken;
      const isNoToken = trade.token_id === resolution.noToken;
      let userWon: boolean;
      if (isYesToken || isNoToken) {
        userWon = (isYesToken && resolution.yesWon) || (isNoToken && !resolution.yesWon);
      } else {
        // Fallback: use trade direction
        const dir = (trade.direction || "").toUpperCase();
        if (dir === "YES" || dir === "UP") {
          userWon = resolution.yesWon;
        } else {
          userWon = !resolution.yesWon;
        }
      }

      const pnl = userWon
        ? Number(trade.shares) * 1 - Number(trade.amount)
        : -Number(trade.amount);

      await supabase
        .from("ep_user_trades")
        .update({
          realized_pnl: Math.round(pnl * 100) / 100,
          resolved_at: now,
          market_slug: info.slug,
        })
        .eq("id", trade.id);

      resolvedCount++;
    }

    // ── 6. Handle old trades without market data (older than 7 days) ──
    // Mark very old unresolved trades as "unknown" so they don't get retried forever
    for (const trade of noSlugTrades) {
      const ageMs = Date.now() - new Date(trade.created_at).getTime();
      if (ageMs > 7 * 24 * 60 * 60 * 1000) {
        await supabase
          .from("ep_user_trades")
          .update({ resolved_at: now })
          .eq("id", trade.id);
      }
    }

    return NextResponse.json({ resolved: resolvedCount });
  } catch (err: any) {
    console.error("Trade resolve error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to resolve trades" },
      { status: 500 }
    );
  }
}
