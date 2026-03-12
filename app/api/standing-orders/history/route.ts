import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/standing-orders/history?wallet=0x...&limit=50
 * Returns execution history for a user's standing orders.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const orderId = searchParams.get('orderId'); // optional: filter to specific standing order

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const sb = getSupabase();

    let query = sb
      .from('ep_standing_order_executions')
      .select('*')
      .eq('user_wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (orderId) {
      query = query.eq('standing_order_id', orderId);
    }

    const { data: executions, error } = await query;
    if (error) throw error;

    // Enrich with pick data
    const pickIds = Array.from(new Set((executions || []).map((e: any) => e.pick_id)));
    let picksMap: Record<string, any> = {};

    if (pickIds.length > 0) {
      const { data: picks } = await sb
        .from('ep_curated_picks')
        .select('id, market_id, direction, conviction_score')
        .in('id', pickIds);

      for (const p of picks || []) {
        picksMap[p.id] = p;
      }

      // Get market questions
      const marketIds = Array.from(new Set((picks || []).map((p: any) => p.market_id)));
      if (marketIds.length > 0) {
        const { data: markets } = await sb
          .from('ep_markets_raw')
          .select('market_id, question, category')
          .in('market_id', marketIds);

        const marketsMap: Record<string, any> = {};
        for (const m of markets || []) {
          marketsMap[m.market_id] = m;
        }

        // Attach market data to picks
        for (const p of Object.values(picksMap)) {
          p.market = marketsMap[p.market_id] || null;
        }
      }
    }

    const enriched = (executions || []).map((e: any) => ({
      ...e,
      pick: picksMap[e.pick_id] || null,
    }));

    return NextResponse.json({ executions: enriched });
  } catch (err: any) {
    console.error('Standing orders history error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
