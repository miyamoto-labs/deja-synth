import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { requireAdmin } from '@/app/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/metrics
 * Dashboard metrics from Supabase tables.
 */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const sb = getSupabase();
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run all queries in parallel
    const [
      marketsRes,
      activePicksRes,
      picks7dRes,
      tradersRes,
      signals24hRes,
      errorsRes,
      lastScanRes,
      wonRes,
      lostRes,
    ] = await Promise.all([
      // 1. Markets tracked
      sb.from('ep_markets_raw').select('id', { count: 'exact', head: true }).eq('active', true),
      // 2. Active picks
      sb.from('ep_curated_picks').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      // 3. Picks generated (7d)
      sb.from('ep_curated_picks').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      // 4. Tracked traders
      sb.from('ep_tracked_traders').select('id', { count: 'exact', head: true }).eq('active', true),
      // 5. Copy signals (24h)
      sb.from('ep_trader_trades').select('id', { count: 'exact', head: true }).gte('created_at', h24),
      // 6. Recent errors (last 10)
      sb.from('ep_audit_log')
        .select('event_type, event_data, source, created_at')
        .eq('event_type', 'error')
        .order('created_at', { ascending: false })
        .limit(10),
      // 7. Last scan
      sb.from('ep_audit_log')
        .select('event_data, created_at')
        .or('event_type.eq.scan_cycle,event_type.eq.conviction_scoring')
        .order('created_at', { ascending: false })
        .limit(1),
      // 8. Won picks
      sb.from('ep_curated_picks').select('id', { count: 'exact', head: true }).eq('status', 'won'),
      // 9. Lost picks
      sb.from('ep_curated_picks').select('id', { count: 'exact', head: true }).eq('status', 'lost'),
    ]);

    const marketsTracked = marketsRes.count || 0;
    const activePicks = activePicksRes.count || 0;
    const picks7d = picks7dRes.count || 0;
    const trackedTraders = tradersRes.count || 0;
    const copySignals24h = signals24hRes.count || 0;
    const recentErrors = errorsRes.data || [];
    const lastScan = lastScanRes.data?.[0] || null;
    const won = wonRes.count || 0;
    const lost = lostRes.count || 0;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    return NextResponse.json({
      marketsTracked,
      activePicks,
      picks7d,
      trackedTraders,
      copySignals24h,
      recentErrors,
      lastScanTime: lastScan?.created_at || null,
      winRate,
      won,
      lost,
      timestamp: now.toISOString(),
    });
  } catch (err: any) {
    console.error('Admin metrics error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
