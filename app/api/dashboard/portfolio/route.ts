import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

const GAMMA_URL = "https://gamma-api.polymarket.com";
const MAX_CONCURRENT = 10;

interface GammaMarketData {
  yesPrice: number;
  noPrice: number;
  yesToken: string;
  noToken: string;
  question?: string;
  resolved?: boolean;
  negRisk?: boolean;
  endDate?: string;
  eventSlug?: string;
  groupItemTitle?: string;
}

/**
 * Fetch live market data from Gamma API by slug or condition_id.
 */
async function fetchGammaMarket(id: string): Promise<GammaMarketData | null> {
  try {
    const isHex = id.startsWith("0x");
    const param = isHex ? `condition_id=${id}` : `slug=${id}`;
    const res = await fetch(`${GAMMA_URL}/markets?${param}&limit=1`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const market = data[0];
    if (!market) return null;

    const rawPrices = market.outcomePrices || "[]";
    const prices: string[] =
      typeof rawPrices === "string" ? JSON.parse(rawPrices) : rawPrices;

    const rawTokens = market.clobTokenIds || "[]";
    const tokens: string[] =
      typeof rawTokens === "string" ? JSON.parse(rawTokens) : rawTokens;

    const endDateStr = market.endDate || market.end_date_iso || "";
    const yesP = prices[0] ? parseFloat(prices[0]) : 0;
    const noP = prices[1] ? parseFloat(prices[1]) : 0;

    // Only trust Gamma's explicit resolved flag — no price heuristics.
    // Price-based guessing causes false positives on active markets.
    const effectivelyResolved = !!market.resolved;

    return {
      yesPrice: yesP,
      noPrice: noP,
      yesToken: tokens[0] || "",
      noToken: tokens[1] || "",
      question: market.question || undefined,
      resolved: effectivelyResolved,
      negRisk: !!market.negRisk,
      endDate: endDateStr,
      eventSlug: market.events?.[0]?.slug || market.eventSlug || undefined,
      groupItemTitle: market.groupItemTitle || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Batch-fetch Gamma market data for multiple slugs/condition_ids.
 */
async function batchFetchGamma(
  ids: string[]
): Promise<Record<string, GammaMarketData>> {
  const results: Record<string, GammaMarketData> = {};
  const unique = [...new Set(ids.filter(Boolean))];

  for (let i = 0; i < unique.length; i += MAX_CONCURRENT) {
    const batch = unique.slice(i, i + MAX_CONCURRENT);
    const settled = await Promise.allSettled(
      batch.map((id) => fetchGammaMarket(id))
    );
    settled.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        results[batch[idx]] = result.value;
      }
    });
  }

  return results;
}

/**
 * GET /api/dashboard/portfolio?wallet=0x...
 * Aggregates positions from Polymarket Data API + trade history from Supabase.
 * Enriches with live prices from Gamma API.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet")?.toLowerCase();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet query parameter" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // ── 1. Fetch live positions from Polymarket Data API ──────
    let positions: any[] = [];
    let positionsError = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const posRes = await fetch(
        `https://data-api.polymarket.com/positions?user=${walletAddress}&sizeThreshold=0`,
        { cache: "no-store", signal: controller.signal }
      );
      clearTimeout(timeout);
      if (posRes.ok) {
        const raw = await posRes.json();
        positions = Array.isArray(raw) ? raw : [];
      } else {
        positionsError = true;
        console.error("Polymarket positions API returned:", posRes.status);
      }
    } catch (err) {
      positionsError = true;
      console.error("Polymarket positions API error:", err);
    }

    // ── 2. Fetch trade history from ep_user_trades ────────────
    const { data: trades, error: tradesErr } = await supabase
      .from("ep_user_trades")
      .select("*")
      .eq("user_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .limit(50);

    if (tradesErr) {
      console.error("Trades query error:", tradesErr);
    }

    const tradeRows = trades || [];

    // ── 2b. Enrich trades with market questions ─────────────
    // Clean up poisoned market names from bad Gamma clobTokenIds lookup
    let enrichedTrades = tradeRows.map((t: any) => {
      if (t.market_question === "Will Joe Biden get Coronavirus before the election?") {
        return { ...t, market_question: null };
      }
      return t;
    });
    try {
      const tokenIds = [...new Set(tradeRows.map((t) => t.token_id).filter(Boolean))];
      if (tokenIds.length > 0) {
        const [{ data: yesMatches }, { data: noMatches }] = await Promise.all([
          supabase
            .from("ep_markets_raw")
            .select("question, category, yes_token, no_token, slug")
            .in("yes_token", tokenIds),
          supabase
            .from("ep_markets_raw")
            .select("question, category, yes_token, no_token, slug")
            .in("no_token", tokenIds),
        ]);

        const tokenMap = new Map<string, { question: string; category: string; slug?: string }>();
        for (const m of [...(yesMatches || []), ...(noMatches || [])]) {
          const entry = { question: m.question, category: m.category, slug: m.slug };
          if (m.yes_token) tokenMap.set(m.yes_token, entry);
          if (m.no_token) tokenMap.set(m.no_token, entry);
        }

        // Prefix fallback: token_ids in ep_user_trades may be truncated
        const unmatchedTokens = tokenIds.filter((id) => !tokenMap.has(id));
        for (const truncatedId of unmatchedTokens) {
          const { data: prefixMatch } = await supabase
            .from("ep_markets_raw")
            .select("question, category, yes_token, no_token, slug")
            .or(`yes_token.like.${truncatedId}%,no_token.like.${truncatedId}%`)
            .limit(1);

          if (prefixMatch && prefixMatch[0]) {
            const m = prefixMatch[0];
            tokenMap.set(truncatedId, { question: m.question, category: m.category, slug: m.slug });
          }
        }

        enrichedTrades = tradeRows.map((t) => ({
          ...t,
          market_question: tokenMap.get(t.token_id)?.question || t.market_question || null,
          market_category: tokenMap.get(t.token_id)?.category || t.market_category || null,
          market_slug: tokenMap.get(t.token_id)?.slug || t.market_slug || null,
        }));

        // Fallback: for trades still missing questions, also check ep_curated_picks
        const missingTokenIds = enrichedTrades
          .filter((t) => !t.market_question && t.token_id)
          .map((t) => t.token_id);

        if (missingTokenIds.length > 0) {
          const { data: pickMatches } = await supabase
            .from("ep_curated_picks")
            .select("question, token_id, category")
            .in("token_id", [...new Set(missingTokenIds)])
            .not("question", "is", null);

          if (pickMatches && pickMatches.length > 0) {
            const pickMap = new Map<string, { question: string; category: string | null }>();
            for (const p of pickMatches) {
              if (p.token_id) pickMap.set(p.token_id, { question: p.question, category: p.category });
            }
            enrichedTrades = enrichedTrades.map((t) => {
              if (!t.market_question && t.token_id && pickMap.has(t.token_id)) {
                return {
                  ...t,
                  market_question: pickMap.get(t.token_id)!.question,
                  market_category: pickMap.get(t.token_id)!.category,
                };
              }
              return t;
            });
          }
        }
      }

      // Fallback: for trades still missing data, use source-specific lookups
      // - synth-trading: source_id IS the slug
      // - pick: source_id → ep_curated_picks
      // - copytrade/auto-trade: source_id → ep_auto_trade_log
      enrichedTrades = enrichedTrades.map((t) => {
        if (t.source === "synth-trading" && t.source_id && !t.market_slug) {
          return { ...t, market_slug: t.source_id };
        }
        return t;
      });

      // pick trades: look up ep_curated_picks for slug + question
      const missingPickTrades = enrichedTrades.filter(
        (t) => t.source === "pick" && t.source_id && (!t.market_question || !t.market_slug)
      );
      if (missingPickTrades.length > 0) {
        const pickIds = [...new Set(missingPickTrades.map((t) => t.source_id))];
        const { data: pickLookup } = await supabase
          .from("ep_curated_picks")
          .select("id, slug, question")
          .in("id", pickIds);

        if (pickLookup && pickLookup.length > 0) {
          const pickMap = new Map<string, { slug: string; question?: string }>();
          for (const p of pickLookup) {
            if (p.id) pickMap.set(p.id, { slug: p.slug, question: p.question || undefined });
          }
          enrichedTrades = enrichedTrades.map((t) => {
            if (t.source === "pick" && t.source_id && pickMap.has(t.source_id)) {
              const pick = pickMap.get(t.source_id)!;
              return {
                ...t,
                market_question: t.market_question || pick.question || null,
                market_slug: t.market_slug || pick.slug || null,
              };
            }
            return t;
          });
        }
      }

      // copytrade/auto-trade trades: look up ep_auto_trade_log + ep_trader_trades fallback
      const stillMissing = enrichedTrades
        .filter((t) => (!t.market_question || !t.market_slug) && t.source_id &&
          ["copytrade", "auto-trade", "signal"].includes(t.source || ""))
        .map((t) => t.source_id);

      if (stillMissing.length > 0) {
        const uniqueIds = [...new Set(stillMissing)];
        const logMap = new Map<string, { question?: string; slug?: string }>();

        // Try ep_auto_trade_log first
        const { data: logMatches } = await supabase
          .from("ep_auto_trade_log")
          .select("signal_id, market_question, market_slug")
          .in("signal_id", uniqueIds);

        for (const l of logMatches || []) {
          if (l.signal_id) {
            logMap.set(l.signal_id, {
              question: l.market_question || undefined,
              slug: l.market_slug || undefined,
            });
          }
        }

        // Fallback: try ep_trader_trades for IDs not found in log
        const missingFromLog = uniqueIds.filter((id) => !logMap.has(id));
        if (missingFromLog.length > 0) {
          const { data: traderTrades } = await supabase
            .from("ep_trader_trades")
            .select("id, market_id, market_question")
            .in("id", missingFromLog);

          for (const tt of traderTrades || []) {
            if (tt.id) {
              logMap.set(tt.id, {
                question: tt.market_question || undefined,
                slug: tt.market_id || undefined,
              });
            }
          }
        }

        if (logMap.size > 0) {
          enrichedTrades = enrichedTrades.map((t) => {
            if (t.source_id && logMap.has(t.source_id)) {
              const log = logMap.get(t.source_id)!;
              return {
                ...t,
                market_question: t.market_question || log.question || null,
                market_slug: t.market_slug || log.slug || null,
              };
            }
            return t;
          });
        }
      }

      // Final fallback 1: Gamma slug lookup for trades that have slug but no question
      const gammaBySlug = enrichedTrades.filter(
        (t) => !t.market_question && t.market_slug
      );
      if (gammaBySlug.length > 0) {
        const slugResults: Record<string, string> = {};
        const uniqueSlugs = [...new Set(gammaBySlug.map((t) => t.market_slug as string))].slice(0, 10);
        for (const slug of uniqueSlugs) {
          try {
            const gm = await fetchGammaMarket(slug);
            if (gm?.question) slugResults[slug] = gm.question;
          } catch { /* skip */ }
        }
        enrichedTrades = enrichedTrades.map((t) => {
          if (t.market_question) return t;
          const q = t.market_slug && slugResults[t.market_slug];
          if (q) return { ...t, market_question: q };
          return t;
        });
      }

      // Final fallback 2: Gamma token_id lookup for trades still missing data
      const gammaByToken = enrichedTrades.filter(
        (t) => (!t.market_question || !t.market_slug) && t.token_id
      );
      if (gammaByToken.length > 0) {
        const unknownTokenIds = [...new Set(gammaByToken.map((t) => t.token_id))].slice(0, 10);
        const tokenResults = new Map<string, { question: string; slug: string }>();
        for (const tokenId of unknownTokenIds) {
          try {
            const res = await fetch(
              `${GAMMA_URL}/markets?clob_token_ids=${tokenId}`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (res.ok) {
              const markets = await res.json();
              if (markets?.[0]?.question) {
                tokenResults.set(tokenId, {
                  question: markets[0].question,
                  slug: markets[0].slug || "",
                });
              }
            }
          } catch { /* skip */ }
        }
        if (tokenResults.size > 0) {
          enrichedTrades = enrichedTrades.map((t) => {
            if (t.market_question && t.market_slug) return t;
            const info = t.token_id && tokenResults.get(t.token_id);
            if (info) {
              return {
                ...t,
                market_question: t.market_question || info.question,
                market_slug: t.market_slug || info.slug,
              };
            }
            return t;
          });
        }
      }
    } catch {
      // Non-critical — trades will just lack market names
    }

    // ── 3. Build initial position objects ────────────────────
    const initialPositions = positions
      .filter((p) => parseFloat(p.size || "0") > 0)
      .map((p) => {
        const currentValue = parseFloat(p.currentValue || "0");
        const initialValue = parseFloat(p.initialValue || "0");
        const pnl = currentValue - initialValue;
        const pnlPercent =
          initialValue > 0 ? (pnl / initialValue) * 100 : 0;

        const title =
          p.asset?.market_slug ||
          p.asset?.condition_id ||
          p.slug ||
          p.conditionId ||
          "Unknown Market";

        const question =
          p.title ||
          p.asset?.question ||
          p.proxyTitle ||
          formatSlug(title);

        const outcome = p.outcome || p.asset?.outcome || "";
        const slug = p.asset?.market_slug || p.slug || "";
        const conditionId = p.conditionId || p.asset?.condition_id || "";

        // Asset ID extraction with multiple fallbacks
        const assetId =
          (typeof p.asset === "string" ? p.asset : p.asset?.token_id) ||
          p.asset_id ||
          p.tokenId ||
          "";

        // negativeRisk comes directly from the Data API (always reliable).
        // Gamma may not return data for resolved markets, so this is the
        // primary source of truth for the negRisk flag.
        const negRiskFromDataApi = !!(p.negativeRisk ?? p.neg_risk);

        // redeemable comes directly from the Data API — this is the
        // authoritative source. Only positions the API marks as redeemable
        // have been resolved on-chain by the oracle. Price heuristics
        // (99.5¢ etc.) cause false positives on sports/active markets.
        const redeemableFromDataApi = !!p.redeemable;

        return {
          id: conditionId || Math.random().toString(36),
          question,
          outcome,
          outcomeIndex: typeof p.outcomeIndex === "number" ? p.outcomeIndex : (outcome.toUpperCase() === "NO" ? 1 : 0),
          size: parseFloat(p.size || "0"),
          avgPrice: parseFloat(p.avgPrice || "0"),
          curPrice: parseFloat(p.curPrice || "0"),
          currentValue: Math.round(currentValue * 100) / 100,
          initialValue: Math.round(initialValue * 100) / 100,
          pnl: Math.round(pnl * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 10) / 10,
          slug,
          assetId,
          conditionId,
          negRiskFromDataApi,
          redeemableFromDataApi,
          // Flag to indicate if assetId came from Data API or needs Gamma resolution
          _needsGamma: !assetId || parseFloat(p.curPrice || "0") === 0,
        };
      });

    // ── 3b. Deduplicate positions by assetId (token_id) ─────
    // Polymarket Data API sometimes returns duplicate records for the same position
    const seenAssets = new Set<string>();
    const dedupedPositions = initialPositions.filter((pos) => {
      if (!pos.assetId) return true; // keep positions without assetId (rare)
      if (seenAssets.has(pos.assetId)) return false;
      seenAssets.add(pos.assetId);
      return true;
    });

    // ── 4. Batch-fetch live data from Gamma API ─────────────
    // Collect slugs/conditionIds for Gamma lookups
    const gammaLookupIds: string[] = [];
    const posToGammaKey = new Map<number, string>();

    dedupedPositions.forEach((pos, idx) => {
      // Prefer slug for Gamma lookups (condition_id can match wrong markets)
      const lookupId = pos.slug || pos.conditionId;
      if (lookupId) {
        gammaLookupIds.push(lookupId);
        posToGammaKey.set(idx, lookupId);
      }
    });

    let gammaData: Record<string, GammaMarketData> = {};
    if (gammaLookupIds.length > 0) {
      try {
        gammaData = await batchFetchGamma(gammaLookupIds);
      } catch (err) {
        console.warn("Gamma batch fetch failed:", err);
      }
    }

    // ── 5a. Enrich positions with Gamma data (resolve tokens + questions) ──
    // First pass: resolve assetIds and initial prices from Gamma
    const gammaEnriched = dedupedPositions.map((pos, idx) => {
      const gammaKey = posToGammaKey.get(idx);
      const gamma = gammaKey ? gammaData[gammaKey] : null;

      let { curPrice, assetId } = pos;
      let gammaPrice: number | null = null;

      if (gamma) {
        // Determine which side this position is on.
        // For negRisk multi-outcome markets, the outcome might be a name
        // like "US" or "Israel" instead of "Yes"/"No". Use token ID
        // comparison as primary method, then fall back to outcome string.
        const outcomeUpper = pos.outcome?.toUpperCase() || "";
        let isYes: boolean;
        if (assetId && gamma.yesToken && assetId === gamma.yesToken) {
          isYes = true;
        } else if (assetId && gamma.noToken && assetId === gamma.noToken) {
          isYes = false;
        } else {
          // Fallback: for standard Yes/No or Up/Down, match directly.
          // For NegRisk named outcomes (e.g. "PARIVISION"), the outcome name
          // IS the YES side of that binary sub-market — only "NO" or "DOWN"
          // should resolve to the NO side.
          isYes = outcomeUpper !== "NO" && outcomeUpper !== "DOWN";
        }

        gammaPrice = isYes ? gamma.yesPrice : gamma.noPrice;

        if (!curPrice || curPrice === 0) {
          curPrice = gammaPrice || 0;
        }

        if (!assetId) {
          assetId = isYes ? gamma.yesToken : gamma.noToken;
          if (assetId) {
            console.log(
              `[Portfolio] Resolved assetId from Gamma for "${pos.question?.slice(0, 40)}": ${assetId.slice(0, 20)}...`
            );
          }
        }

        if (pos.question === "Unknown Market" && gamma.question) {
          pos.question = gamma.question;
        }

        // For multi-outcome markets (sports, etc.), use the team/outcome name
        // from groupItemTitle instead of generic "Yes"/"No"
        if (gamma.groupItemTitle && isYes) {
          pos.outcome = gamma.groupItemTitle;
        }
      }

      return { ...pos, curPrice, assetId, gammaPrice, gamma };
    });

    // ── 5b. Fetch CLOB best-bid prices for accurate sell pricing ──────
    // Gamma returns mid-market prices. For sells we need the best bid,
    // which is what the user would actually receive on the CLOB.
    const clobBidMap = new Map<string, number>();
    const tokenIdsToFetch = [
      ...new Set(
        gammaEnriched
          .filter((p) => p.assetId && p.curPrice > 0)
          .map((p) => p.assetId)
      ),
    ];

    if (tokenIdsToFetch.length > 0) {
      const bidFetches = tokenIdsToFetch.slice(0, MAX_CONCURRENT).map(async (tokenId) => {
        try {
          const res = await fetch(
            `https://clob.polymarket.com/price?token_id=${tokenId}&side=SELL`,
            { cache: "no-store", signal: AbortSignal.timeout(5000) }
          );
          if (!res.ok) return;
          const data = await res.json();
          const p = parseFloat(data.price);
          if (p > 0) clobBidMap.set(tokenId, p);
        } catch { /* non-critical — fall back to Gamma mid */ }
      });
      await Promise.allSettled(bidFetches);
    }

    // ── 5c. Build trade timestamp map ────────────────────────
    // Map token_id → earliest created_at (when bet was placed)
    const tradeTimestampMap = new Map<string, string>();
    for (const t of tradeRows) {
      const tid = t.token_id;
      if (!tid || !t.created_at) continue;
      const existing = tradeTimestampMap.get(tid);
      if (!existing || t.created_at < existing) {
        tradeTimestampMap.set(tid, t.created_at);
      }
    }

    // ── 5d. Build final enriched positions ───────────────────
    const enriched = gammaEnriched.map((pos) => {
      const { gammaPrice, gamma, _needsGamma, negRiskFromDataApi, redeemableFromDataApi, ...rest } = pos;

      // livePrice = CLOB best-bid if available, else Gamma mid-market.
      // The sell modal uses livePrice for market sells and proceeds estimates.
      const clobBid = pos.assetId ? clobBidMap.get(pos.assetId) : null;
      const livePrice = clobBid ?? gammaPrice ?? null;

      // Recalculate P&L — use Gamma mid (or curPrice) for portfolio valuation,
      // not the bid price (bid is what you'd receive selling, mid is fair value).
      const valuationPrice = gammaPrice ?? pos.curPrice;
      const currentValue = pos.size * valuationPrice;
      const pnl = currentValue - pos.initialValue;
      const pnlPercent =
        pos.initialValue > 0 ? (pnl / pos.initialValue) * 100 : 0;

      // Determine sell availability
      let sellDisabled = false;
      let sellDisabledReason = "";
      if (!pos.assetId) {
        sellDisabled = true;
        sellDisabledReason = "Token ID could not be resolved for this market";
      }

      // Market resolution detection:
      // Primary source: Data API's `redeemable` field — only true when the
      // oracle has called reportPayouts on-chain. This is authoritative.
      // Fallback: Gamma's resolved flag (for positions not from Data API).
      // We NO LONGER use price heuristics — they cause false positives
      // (e.g. sports markets trading at 99.5¢ are NOT resolved).
      const resolved = redeemableFromDataApi || gamma?.resolved || false;
      // negRisk: prefer Gamma, but fall back to Data API's negativeRisk field.
      // Critical: Gamma returns nothing for resolved markets, so the Data API
      // fallback is essential. Without it, negRisk defaults to false and we
      // call the wrong contract (CTF instead of NegRiskAdapter), causing reverts.
      const negRisk = gamma?.negRisk ?? negRiskFromDataApi ?? false;

      if (resolved && !sellDisabled) {
        sellDisabled = true;
        sellDisabledReason = "Market resolved — use Redeem to collect winnings";
      }

      const eventSlug = gamma?.eventSlug || '';
      const polymarketUrl = eventSlug
        ? `https://polymarket.com/event/${eventSlug}`
        : '';

      // Timestamp: when the position was first opened (earliest trade)
      const createdAt = pos.assetId ? tradeTimestampMap.get(pos.assetId) || null : null;

      return {
        ...rest,
        curPrice: valuationPrice,
        livePrice,
        assetId: pos.assetId,
        currentValue: Math.round(currentValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 10) / 10,
        sellDisabled,
        sellDisabledReason,
        resolved,
        // redeemable = on-chain oracle has finalized. Only THEN can we
        // actually call redeemPositions. `resolved` can be true earlier
        // (e.g. Gamma knows outcome) but on-chain isn't ready yet.
        redeemable: redeemableFromDataApi,
        negRisk,
        polymarketUrl,
        createdAt,
      };
    }).sort((a, b) => Math.abs(b.currentValue) - Math.abs(a.currentValue));

    // ── 6. Add redeemed/resolved positions from trade history ──
    // Positions that were redeemed disappear from the Polymarket API
    // but we still want to show them in the Closed tab.
    const existingConditionIds = new Set(enriched.map((p) => p.conditionId).filter(Boolean));
    const resolvedTrades = enrichedTrades.filter(
      (t: any) => t.realized_pnl != null && t.resolved_at
    );

    for (const trade of resolvedTrades) {
      // Skip if this position is already in the enriched list from the API
      if (trade.token_id && enriched.some((p) => p.assetId === trade.token_id)) continue;

      const won = (trade.realized_pnl || 0) > 0;
      const amount = parseFloat(trade.amount) || 0;
      const pnl = parseFloat(trade.realized_pnl) || 0;
      const pnlPercent = amount > 0 ? (pnl / amount) * 100 : 0;

      enriched.push({
        id: `trade-${trade.id}`,
        question: trade.market_question || trade.market_slug || "Resolved Trade",
        outcome: trade.direction || "",
        size: parseFloat(trade.shares) || 0,
        avgPrice: parseFloat(trade.price) || 0,
        curPrice: won ? 1 : 0,
        livePrice: null,
        currentValue: won ? parseFloat(trade.shares) || 0 : 0,
        initialValue: amount,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 10) / 10,
        slug: trade.market_slug || "",
        assetId: trade.token_id || "",
        conditionId: "",
        sellDisabled: true,
        sellDisabledReason: "Position redeemed",
        resolved: true,
        redeemable: false, // Already redeemed — from trade history
        negRisk: false,
        polymarketUrl: "",
        createdAt: trade.created_at || null,
        resolvedAt: trade.resolved_at || null,
      });
    }

    // ── 7. Compute aggregate stats ────────────────────────────
    const activePositions = enriched.filter((p) => !p.resolved);
    const totalValue = activePositions.reduce((s, p) => s + p.currentValue, 0);
    const unrealizedPnl = activePositions.reduce((s, p) => s + p.pnl, 0);
    const winning = activePositions.filter((p) => p.pnl > 0);
    const winRate =
      activePositions.length > 0
        ? (winning.length / activePositions.length) * 100
        : 0;

    // Realized P&L from resolved trades
    const resolvedTradesForStats = enrichedTrades.filter(
      (t: any) => t.realized_pnl != null && t.resolved_at && t.side === "BUY"
    );
    const realizedPnl = resolvedTradesForStats.reduce(
      (s: number, t: any) => s + (parseFloat(t.realized_pnl) || 0), 0
    );
    const tradesWon = resolvedTradesForStats.filter(
      (t: any) => parseFloat(t.realized_pnl) > 0
    ).length;
    const tradesLost = resolvedTradesForStats.filter(
      (t: any) => parseFloat(t.realized_pnl) < 0
    ).length;

    // ── 7b. Volume stats (all-time, 30d, 7d, 24h) ──────────────
    // Total volume = buys + sells (standard trading volume definition).
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let volumeAllTime = 0;
    let volumeMonth = 0;
    let volumeWeek = 0;
    let volumeDay = 0;
    let totalTradeCount = 0;

    try {
      // Only count filled trades (shares > 0, price > 0).
      // Excludes cancelled/unfilled limit orders and any non-trade records.
      const { data: allTrades } = await supabase
        .from("ep_user_trades")
        .select("amount, created_at")
        .eq("user_wallet", walletAddress)
        .gt("shares", 0)
        .gt("price", 0);

      if (allTrades) {
        totalTradeCount = allTrades.length;
        for (const t of allTrades) {
          const amt = Math.abs(parseFloat(t.amount) || 0);
          volumeAllTime += amt;
          if (t.created_at >= monthAgo) volumeMonth += amt;
          if (t.created_at >= weekAgo) volumeWeek += amt;
          if (t.created_at >= dayAgo) volumeDay += amt;
        }
      }
    } catch {
      // Non-critical — volume stats will be 0
    }

    return NextResponse.json({
      positions: enriched,
      trades: enrichedTrades,
      positionsError,
      stats: {
        totalValue: Math.round(totalValue * 100) / 100,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        tradesWon,
        tradesLost,
        winRate: Math.round(winRate * 10) / 10,
        totalTrades: totalTradeCount || enrichedTrades.length,
        activePositions: activePositions.length,
        volumeAllTime: Math.round(volumeAllTime * 100) / 100,
        volumeMonth: Math.round(volumeMonth * 100) / 100,
        volumeWeek: Math.round(volumeWeek * 100) / 100,
        volumeDay: Math.round(volumeDay * 100) / 100,
      },
    });
  } catch (err: any) {
    console.error("Portfolio API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}

/** Convert "will-trump-win-2024" → "Will Trump Win 2024" */
function formatSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
