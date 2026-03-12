import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

const GAMMA_URL = "https://gamma-api.polymarket.com";

/**
 * POST /api/trades/fix-resolve
 * Admin endpoint: resets trades that were incorrectly resolved with realized_pnl=0
 * (caused by mark-cancelled bulk update) and re-resolves them with correct P&L.
 *
 * Body: { walletAddress: string }
 *
 * Steps:
 * 1. Find all BUY trades with realized_pnl=0 (likely from mark-cancelled)
 * 2. Reset them to unresolved (realized_pnl=null, resolved_at=null)
 * 3. Enrich each with market_slug from source:
 *    - synth-trading: source_id IS the slug
 *    - pick: source_id → ep_curated_picks.id → slug
 *    - copytrade: source_id → ep_auto_trade_log.signal_id → market_slug
 * 4. Look up Gamma for each slug → get resolution + token mapping
 * 5. Calculate correct P&L and re-resolve
 */
export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();
    const now = new Date().toISOString();
    const log: string[] = [];

    // ── 1. Find all unresolved BUY trades (pnl=null OR pnl=0) ──
    const { data: nullTrades } = await supabase
      .from("ep_user_trades")
      .select("*")
      .eq("user_wallet", address)
      .eq("side", "BUY")
      .is("resolved_at", null);

    const { data: zeroTrades } = await supabase
      .from("ep_user_trades")
      .select("*")
      .eq("user_wallet", address)
      .eq("side", "BUY")
      .eq("realized_pnl", 0);

    // Combine and deduplicate
    const tradeMap = new Map<string, any>();
    for (const t of [...(nullTrades || []), ...(zeroTrades || [])]) {
      tradeMap.set(t.id, t);
    }
    const badTrades = [...tradeMap.values()];

    if (badTrades.length === 0) {
      return NextResponse.json({ message: "No trades to fix", log: ["No unresolved or zero-pnl BUY trades found"] });
    }

    log.push(`Found ${badTrades.length} trades to fix (${(nullTrades || []).length} unresolved, ${(zeroTrades || []).length} with pnl=0)`);

    // ── 2. Reset all to unresolved ──
    const tradeIds = badTrades.map((t) => t.id);
    await supabase
      .from("ep_user_trades")
      .update({ realized_pnl: null, resolved_at: null })
      .in("id", tradeIds);

    log.push(`Reset ${tradeIds.length} trades to unresolved`);

    // ── 3. Enrich with market_slug based on source type ──
    const tradeSlugMap = new Map<string, string>(); // trade.id → slug

    // 3a. synth-trading trades: source_id IS the slug
    const synthTrades = badTrades.filter((t) => t.source === "synth-trading" && t.source_id);
    for (const t of synthTrades) {
      tradeSlugMap.set(t.id, t.source_id);
    }
    if (synthTrades.length > 0) {
      log.push(`${synthTrades.length} synth-trading trades: source_id is slug`);
    }

    // 3b. pick trades: source_id → ep_curated_picks.id → slug
    const pickTrades = badTrades.filter((t) => t.source === "pick" && t.source_id);
    if (pickTrades.length > 0) {
      const pickIds = [...new Set(pickTrades.map((t) => t.source_id))];
      const { data: picks } = await supabase
        .from("ep_curated_picks")
        .select("id, slug, question, token_id")
        .in("id", pickIds);

      const pickMap = new Map<string, { slug: string; question: string; tokenId: string }>();
      for (const p of picks || []) {
        if (p.id && p.slug) {
          pickMap.set(p.id, { slug: p.slug, question: p.question || "", tokenId: p.token_id || "" });
        }
      }

      for (const t of pickTrades) {
        const pick = pickMap.get(t.source_id);
        if (pick?.slug) {
          tradeSlugMap.set(t.id, pick.slug);
        }
      }
      log.push(`${pickTrades.length} pick trades: looked up ${pickMap.size} slugs from ep_curated_picks`);
    }

    // 3c. copytrade/auto-trade trades: source_id → look up in multiple tables
    // For 'copytrade' source: ep_auto_trade_log.signal_id (the copytrade processor writes here)
    // For 'auto-trade' source: ep_trader_trades.id (AutoTradeQueue uses trader trade IDs directly)
    const copyTrades = badTrades.filter(
      (t) => (t.source === "copytrade" || t.source === "auto-trade" || t.source === "signal") && t.source_id
    );
    if (copyTrades.length > 0) {
      const signalIds = [...new Set(copyTrades.map((t) => t.source_id))];

      // Try ep_auto_trade_log first (copytrade processor writes here)
      const { data: logEntries } = await supabase
        .from("ep_auto_trade_log")
        .select("signal_id, market_slug, market_question")
        .in("signal_id", signalIds);

      const logMap = new Map<string, { slug: string; question?: string }>();
      for (const l of logEntries || []) {
        if (l.signal_id && l.market_slug) {
          logMap.set(l.signal_id, { slug: l.market_slug, question: l.market_question || undefined });
        }
      }

      // For IDs not found in auto_trade_log, try ep_trader_trades (raw signal source)
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
        log.push(`Fallback: found ${(traderTrades || []).filter(t => t.market_id).length} slugs from ep_trader_trades`);
      }

      for (const t of copyTrades) {
        const entry = logMap.get(t.source_id);
        if (entry?.slug) {
          tradeSlugMap.set(t.id, entry.slug);
        }
      }
      log.push(`${copyTrades.length} copytrade/auto-trade trades: found ${[...logMap.values()].filter(v => v.slug).length} slugs`);
    }

    // 3d. Remaining trades: try all remaining source_ids against ep_trader_trades
    const remainingWithSourceId = badTrades.filter((t) => !tradeSlugMap.has(t.id) && t.source_id);
    if (remainingWithSourceId.length > 0) {
      const remainingIds = [...new Set(remainingWithSourceId.map((t) => t.source_id))];
      const { data: ttFallback } = await supabase
        .from("ep_trader_trades")
        .select("id, market_id, market_question")
        .in("id", remainingIds);

      for (const tt of ttFallback || []) {
        if (tt.id && tt.market_id) {
          // Find all trades with this source_id
          for (const t of remainingWithSourceId) {
            if (t.source_id === tt.id && !tradeSlugMap.has(t.id)) {
              tradeSlugMap.set(t.id, tt.market_id);
            }
          }
        }
      }
      log.push(`Catch-all ep_trader_trades: found ${(ttFallback || []).filter(t => t.market_id).length} additional slugs`);
    }

    // 3e. Remaining trades with no slug — try token_id → ep_markets_raw
    // Note: ep_user_trades may have TRUNCATED token_ids (numeric column precision)
    // while ep_markets_raw stores full IDs. Use prefix matching with `like`.
    const noSlugTrades = badTrades.filter((t) => !tradeSlugMap.has(t.id) && t.token_id);
    if (noSlugTrades.length > 0) {
      const tokenIds = [...new Set(noSlugTrades.map((t) => t.token_id))];

      // First try exact match
      const [{ data: yesMatches }, { data: noMatches }] = await Promise.all([
        supabase.from("ep_markets_raw").select("slug, yes_token, no_token").in("yes_token", tokenIds),
        supabase.from("ep_markets_raw").select("slug, yes_token, no_token").in("no_token", tokenIds),
      ]);

      const tokenSlugMap = new Map<string, string>();
      for (const m of [...(yesMatches || []), ...(noMatches || [])]) {
        if (m.slug) {
          if (m.yes_token) tokenSlugMap.set(m.yes_token, m.slug);
          if (m.no_token) tokenSlugMap.set(m.no_token, m.slug);
        }
      }

      // For remaining: try prefix matching (token_ids may be truncated)
      const stillMissingTokens = tokenIds.filter((id) => !tokenSlugMap.has(id));
      if (stillMissingTokens.length > 0) {
        for (const truncatedId of stillMissingTokens) {
          const { data: prefixYes } = await supabase
            .from("ep_markets_raw")
            .select("slug, yes_token, no_token")
            .like("yes_token", `${truncatedId}%`)
            .limit(1);

          if (prefixYes && prefixYes[0]?.slug) {
            tokenSlugMap.set(truncatedId, prefixYes[0].slug);
            continue;
          }

          const { data: prefixNo } = await supabase
            .from("ep_markets_raw")
            .select("slug, yes_token, no_token")
            .like("no_token", `${truncatedId}%`)
            .limit(1);

          if (prefixNo && prefixNo[0]?.slug) {
            tokenSlugMap.set(truncatedId, prefixNo[0].slug);
          }
        }
        log.push(`Prefix match: found ${stillMissingTokens.filter(id => tokenSlugMap.has(id)).length}/${stillMissingTokens.length} via ep_markets_raw prefix`);
      }

      for (const t of noSlugTrades) {
        const slug = tokenSlugMap.get(t.token_id);
        if (slug) tradeSlugMap.set(t.id, slug);
      }
      log.push(`${noSlugTrades.length} no-slug trades: found ${tokenSlugMap.size} via ep_markets_raw`);
    }

    log.push(`Total trades with slugs: ${tradeSlugMap.size}/${badTrades.length}`);

    // ── 4. Batch Gamma lookups for all unique slugs ──
    const allSlugs = [...new Set(tradeSlugMap.values())];
    const slugData = new Map<string, {
      yesWon: boolean;
      yesToken: string;
      noToken: string;
      question: string;
      resolved: boolean;
    }>();

    for (const slug of allSlugs) {
      try {
        const res = await fetch(`${GAMMA_URL}/markets/slug/${slug}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          log.push(`Gamma 404 for slug: ${slug}`);
          continue;
        }
        const market = await res.json();

        const outcomePrices =
          typeof market.outcomePrices === "string"
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices || [];
        const yesPrice = parseFloat(outcomePrices[0] || "0");
        const noPrice = parseFloat(outcomePrices[1] || "0");

        const effectivelyResolved =
          !!market.resolved || yesPrice >= 0.995 || noPrice >= 0.995;

        const rawTokens = market.clobTokenIds || "[]";
        const tokens: string[] =
          typeof rawTokens === "string" ? JSON.parse(rawTokens) : rawTokens;

        slugData.set(slug, {
          yesWon: yesPrice > 0.5,
          yesToken: tokens[0] || "",
          noToken: tokens[1] || "",
          question: market.question || slug,
          resolved: effectivelyResolved,
        });

        log.push(`Gamma: ${slug} → resolved=${effectivelyResolved}, yesPrice=${yesPrice}, yesWon=${yesPrice > 0.5}`);
      } catch (e: any) {
        log.push(`Gamma error for ${slug}: ${e.message}`);
      }
    }

    // ── 5. Re-resolve each trade with correct P&L ──
    let fixedCount = 0;
    let stillUnresolved = 0;
    const results: Array<{ id: string; slug: string; won: boolean; pnl: number }> = [];

    for (const trade of badTrades) {
      const slug = tradeSlugMap.get(trade.id);
      if (!slug) {
        log.push(`Trade ${trade.id.slice(0, 8)}: no slug found (source=${trade.source}, source_id=${trade.source_id})`);
        stillUnresolved++;
        continue;
      }

      const gamma = slugData.get(slug);
      if (!gamma) {
        log.push(`Trade ${trade.id.slice(0, 8)}: slug ${slug} not in Gamma data`);
        stillUnresolved++;
        continue;
      }

      if (!gamma.resolved) {
        log.push(`Trade ${trade.id.slice(0, 8)}: ${slug} not yet resolved — leaving unresolved`);
        stillUnresolved++;
        continue;
      }

      // Determine if user's token is YES or NO
      const isYesToken = trade.token_id === gamma.yesToken;
      const isNoToken = trade.token_id === gamma.noToken;

      // If we can't match the token, try direction
      let userWon: boolean;
      if (isYesToken || isNoToken) {
        userWon = (isYesToken && gamma.yesWon) || (isNoToken && !gamma.yesWon);
      } else {
        // Fallback: use trade direction
        const dir = (trade.direction || "").toUpperCase();
        if (dir === "YES" || dir === "UP") {
          userWon = gamma.yesWon;
        } else if (dir === "NO" || dir === "DOWN") {
          userWon = !gamma.yesWon;
        } else {
          log.push(`Trade ${trade.id.slice(0, 8)}: can't determine side (token doesn't match Gamma, no direction)`);
          stillUnresolved++;
          continue;
        }
        log.push(`Trade ${trade.id.slice(0, 8)}: used direction fallback (${dir})`);
      }

      const amount = parseFloat(trade.amount) || 0;
      const shares = parseFloat(trade.shares) || 0;
      const pnl = userWon ? shares * 1.0 - amount : -amount;
      const roundedPnl = Math.round(pnl * 100) / 100;

      // Update in DB (ep_user_trades has: realized_pnl, resolved_at, market_slug — but NOT market_question)
      const { error: updateErr } = await supabase
        .from("ep_user_trades")
        .update({
          realized_pnl: roundedPnl,
          resolved_at: now,
          market_slug: slug,
        })
        .eq("id", trade.id);

      if (updateErr) {
        log.push(`DB ERROR for ${trade.id.slice(0, 8)}: ${updateErr.message}`);
        stillUnresolved++;
        continue;
      }

      // Verify the update persisted
      const { data: verify } = await supabase
        .from("ep_user_trades")
        .select("realized_pnl, resolved_at")
        .eq("id", trade.id)
        .single();

      const verifiedPnl = verify?.realized_pnl;
      const verifiedResolved = verify?.resolved_at;
      log.push(`Verified ${trade.id.slice(0, 8)}: pnl=${verifiedPnl}, resolved_at=${verifiedResolved ? 'SET' : 'NULL'}`);

      results.push({ id: trade.id.slice(0, 8), slug, won: userWon, pnl: roundedPnl });
      fixedCount++;
    }

    log.push(`Fixed: ${fixedCount}, Still unresolved: ${stillUnresolved}`);

    return NextResponse.json({
      fixed: fixedCount,
      stillUnresolved,
      total: badTrades.length,
      results,
      log,
    });
  } catch (err: any) {
    console.error("[fix-resolve] Error:", err);
    return NextResponse.json({ error: err.message || "Fix failed" }, { status: 500 });
  }
}
