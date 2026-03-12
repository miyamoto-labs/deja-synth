import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/copytrade/activity?wallet=0x...&limit=30
 *
 * Returns recent copytrade activity for a user — executed, failed, and skipped trades.
 * Powers the "Copy Trade Activity" section on the portfolio page.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    const sb = getSupabase();

    const { data: activity, error } = await sb
      .from('ep_auto_trade_log')
      .select('id, signal_id, trader_id, status, order_id, amount, market_slug, market_question, side, direction, price, trader_alias, error_message, created_at')
      .eq('user_wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Enrich activity items missing market_question
    let items = activity || [];
    const unknownSlugs = items
      .filter((a) => !a.market_question && a.market_slug)
      .map((a) => a.market_slug as string);

    if (unknownSlugs.length > 0) {
      const uniqueSlugs = [...new Set(unknownSlugs)];
      // Look up questions from ep_markets_raw by slug
      const { data: marketMatches } = await sb
        .from("ep_markets_raw")
        .select("slug, question")
        .in("slug", uniqueSlugs)
        .not("question", "is", null);

      if (marketMatches && marketMatches.length > 0) {
        const slugMap = new Map<string, string>();
        for (const m of marketMatches) {
          if (m.slug && m.question) slugMap.set(m.slug, m.question);
        }

        // Also persist for future queries
        items = items.map((a) => {
          if (!a.market_question && a.market_slug && slugMap.has(a.market_slug)) {
            const q = slugMap.get(a.market_slug)!;
            // Fire-and-forget update
            sb.from("ep_auto_trade_log")
              .update({ market_question: q })
              .eq("id", a.id)
              .then(() => {});
            return { ...a, market_question: q };
          }
          return a;
        });
      }
    }

    // Compute summary stats
    const executedCount = items.filter((a) => a.status === 'executed').length;
    const failedCount = items.filter((a) => a.status === 'failed').length;
    const skippedCount = items.filter((a) => a.status === 'skipped').length;

    return NextResponse.json({
      activity: items,
      stats: {
        total: items.length,
        executed: executedCount,
        failed: failedCount,
        skipped: skippedCount,
      },
    });
  } catch (err: any) {
    console.error('Copytrade activity error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch activity' }, { status: 500 });
  }
}
