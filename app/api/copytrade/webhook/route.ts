import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { getTrackedWallets } from '@/app/lib/tracked-wallets';
import {
  TRANSFER_SINGLE_TOPIC,
  ADDRESS_ZERO,
  decodeTransferSingle,
  isExchangeOperator,
} from '@/app/lib/ctf-decoder';

export const dynamic = 'force-dynamic';

const GAMMA_API = 'https://gamma-api.polymarket.com';

/**
 * POST /api/copytrade/webhook
 *
 * Receives Alchemy Custom Webhook events for CTF TransferSingle on Polygon.
 * Decodes on-chain trades, resolves to markets, inserts signals, and triggers
 * the copytrade processor — all within seconds of on-chain settlement.
 *
 * Alchemy retries on non-2xx, so we return 200 quickly and process in-band.
 */
export async function POST(request: Request) {
  try {
    const t0 = Date.now();

    // ── 1. Read body ────────────────────────────────────
    const rawBody = await request.text();

    // ── 2. Parse payload ──────────────────────────────
    const payload = JSON.parse(rawBody);
    const logs: any[] = payload?.event?.data?.block?.logs || [];

    if (logs.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No logs' });
    }

    // ── 3. Load tracked wallets + Supabase ────────────
    const tWallets = Date.now();
    const [trackedWallets, sb] = await Promise.all([
      getTrackedWallets(),
      Promise.resolve(getSupabase()),
    ]);
    console.log(`[webhook] phase=load_wallets duration_ms=${Date.now() - tWallets} wallet_count=${trackedWallets.size}`);

    let inserted = 0;
    let skippedMintBurn = 0;
    let skippedNotExchange = 0;
    let skippedNotTracked = 0;
    let skippedNoMarket = 0;
    let skippedDuplicate = 0;

    // ── 4. Process each log ───────────────────────────
    for (const log of logs) {
      const topics: string[] = log.topics || [];
      const data: string = log.data || '0x';
      const txHash: string = log.transaction?.hash || '';
      const logIndex: number = typeof log.index === 'number' ? log.index : parseInt(log.index, 10);

      // Sanity: must be a TransferSingle event
      if (!topics[0] || topics[0].toLowerCase() !== TRANSFER_SINGLE_TOPIC.toLowerCase()) {
        continue;
      }

      // Decode event
      const decoded = decodeTransferSingle(topics, data);

      // Skip mint/burn (zero address)
      if (
        decoded.from.toLowerCase() === ADDRESS_ZERO.toLowerCase() ||
        decoded.to.toLowerCase() === ADDRESS_ZERO.toLowerCase()
      ) {
        skippedMintBurn++;
        continue;
      }

      // Skip non-exchange operators (direct transfers, not trades)
      if (!isExchangeOperator(decoded.operator)) {
        skippedNotExchange++;
        continue;
      }

      // ── 5. Check if from/to is a tracked trader ─────
      const fromTrader = trackedWallets.get(decoded.from.toLowerCase());
      const toTrader = trackedWallets.get(decoded.to.toLowerCase());

      if (!fromTrader && !toTrader) {
        skippedNotTracked++;
        continue;
      }

      // Determine trade direction:
      // - Tracked wallet in `to` = BUY (tokens flowing to trader)
      // - Tracked wallet in `from` = SELL (tokens flowing from trader)
      const isBuy = !!toTrader;
      const traderId = isBuy ? toTrader! : fromTrader!;
      const tradeType = isBuy ? 'entry' : 'exit';

      // ── 6. Resolve CTF tokenId → market ─────────────
      const tokenIdStr = decoded.tokenId;
      const tMarket = Date.now();
      let marketSource = 'cache';

      // Check ep_markets_raw for yes_token or no_token match
      const { data: marketMatch, error: marketErr } = await sb
        .from('ep_markets_raw')
        .select('market_id, question, slug, yes_token, no_token, yes_price, no_price')
        .or(`yes_token.eq.${tokenIdStr},no_token.eq.${tokenIdStr}`)
        .limit(1)
        .maybeSingle();

      let marketId: string | null = null;
      let direction: 'YES' | 'NO' = 'YES';
      let marketQuestion: string | null = null;

      if (marketMatch) {
        marketId = marketMatch.market_id;
        direction = marketMatch.yes_token === tokenIdStr ? 'YES' : 'NO';
        marketQuestion = marketMatch.question;
      } else {
        // Fallback: try Gamma API
        marketSource = 'gamma';
        try {
          const gammaRes = await fetch(
            `${GAMMA_API}/markets?clob_token_ids=${tokenIdStr}&limit=1`,
            { cache: 'no-store' },
          );
          if (gammaRes.ok) {
            const gammaData = await gammaRes.json();
            const gm = Array.isArray(gammaData) ? gammaData[0] : gammaData;
            if (gm) {
              marketId = gm.condition_id || gm.slug;
              marketQuestion = gm.question;
              // Parse clob token IDs to determine direction
              try {
                const tokens = typeof gm.clobTokenIds === 'string'
                  ? JSON.parse(gm.clobTokenIds)
                  : gm.clobTokenIds || [];
                direction = tokens[0] === tokenIdStr ? 'YES' : 'NO';
              } catch {
                direction = 'YES';
              }
            }
          }
        } catch (err) {
          console.warn('[webhook] Gamma fallback failed:', err);
        }
      }

      console.log(`[webhook] phase=market_resolve token_id=${tokenIdStr.slice(0, 12)} source=${marketSource} duration_ms=${Date.now() - tMarket}`);

      if (!marketId) {
        skippedNoMarket++;
        console.warn(`[webhook] Unknown token ID ${tokenIdStr} — no market found`);
        continue;
      }

      // ── 7. Fetch live CLOB price ────────────────────
      const tPrice = Date.now();
      let price = 0;
      try {
        const side = isBuy ? 'BUY' : 'SELL';
        const priceRes = await fetch(
          `https://clob.polymarket.com/price?token_id=${tokenIdStr}&side=${side}`,
          { cache: 'no-store' },
        );
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          price = parseFloat(priceData.price) || 0;
        }
      } catch {
        // Use market cache price as fallback
        if (marketMatch) {
          price = direction === 'YES'
            ? parseFloat(marketMatch.yes_price) || 0
            : parseFloat(marketMatch.no_price) || 0;
        }
      }

      console.log(`[webhook] phase=clob_price token_id=${tokenIdStr.slice(0, 12)} price=${price} duration_ms=${Date.now() - tPrice}`);

      // ── 8. Insert into ep_trader_trades ─────────────
      // tx_hash + log_index unique index provides idempotency
      const dollarAmount = decoded.shares * (price || 0.5);

      const tInsert = Date.now();
      const { error: insertErr } = await sb
        .from('ep_trader_trades')
        .insert({
          trader_id: traderId,
          market_id: marketId,
          direction,
          trade_type: tradeType,
          amount: Math.round(dollarAmount * 100) / 100,
          price: price || 0,
          timestamp: new Date().toISOString(),
          tx_hash: txHash,
          log_index: logIndex,
          source: 'alchemy_webhook',
        });

      if (insertErr) {
        // 23505 = unique constraint violation (duplicate tx_hash + log_index)
        if (insertErr.code === '23505') {
          skippedDuplicate++;
          continue;
        }
        console.error('[webhook] Insert error:', insertErr.message);
        continue;
      }

      console.log(`[webhook] phase=signal_insert trader=${traderId.slice(0, 8)} duration_ms=${Date.now() - tInsert}`);
      inserted++;
      console.log(
        `[webhook] Signal: ${tradeType.toUpperCase()} ${direction} ` +
        `by trader ${traderId.slice(0, 8)} on ${(marketQuestion || marketId).slice(0, 40)} ` +
        `(${decoded.shares.toFixed(1)} shares @ ${(price * 100).toFixed(0)}¢) ` +
        `tx:${txHash.slice(0, 10)}`,
      );
    }

    // ── 9. Trigger processor (fire-and-forget) ────────
    if (inserted > 0) {
      const tTrigger = Date.now();
      const processUrl = `${getBaseUrl(request)}/api/copytrade/process`;
      fetch(processUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          'x-trigger-source': 'webhook',
        },
      }).catch((err) => {
        console.warn('[webhook] Failed to trigger processor:', err.message);
      });
      console.log(`[webhook] phase=trigger_processor duration_ms=${Date.now() - tTrigger}`);
    }

    const totalMs = Date.now() - t0;
    console.log(`[webhook] phase=complete total_ms=${totalMs} logs=${logs.length} inserted=${inserted} skipped_dup=${skippedDuplicate} skipped_no_market=${skippedNoMarket}`);

    return NextResponse.json({
      processed: logs.length,
      inserted,
      skipped: {
        mintBurn: skippedMintBurn,
        notExchange: skippedNotExchange,
        notTracked: skippedNotTracked,
        noMarket: skippedNoMarket,
        duplicate: skippedDuplicate,
      },
    });
  } catch (err: any) {
    console.error('[webhook] Error:', err.message);
    // Return 200 even on error to prevent Alchemy from retrying bad payloads
    // (retries would fail the same way). Log for debugging.
    return NextResponse.json(
      { error: err.message, note: 'Returning 200 to prevent retry loops' },
      { status: 200 },
    );
  }
}

/**
 * Derive the base URL from the incoming request for fire-and-forget triggers.
 */
function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
