import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || 'all';

    // Calculate time window
    let timeFilter: string | null = null;
    if (timeframe === '7d') {
      timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeframe === '30d') {
      timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Fetch leaderboard data
    let query = supabase
      .from('agent_leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .limit(50);

    if (timeFilter) {
      query = query.gte('updated_at', timeFilter);
    }

    const { data: leaderboard, error } = await query;

    if (error) throw error;

    // Separate humans and agents
    const humans = (leaderboard || []).filter((entry) => entry.type === 'HUMAN');
    const agents = (leaderboard || []).filter((entry) => entry.type === 'AGENT');

    // Format response
    const formatEntry = (entry: any) => ({
      rank: entry.rank,
      type: entry.type,
      entityId: entry.entity_id,
      entityName: entry.entity_name,
      totalPnL: entry.total_pnl || 0,
      totalPnLPercent: entry.total_pnl_percent || 0,
      winRate: entry.win_rate || 0,
      totalTrades: entry.total_trades || 0,
      sharpeRatio: entry.sharpe_ratio || 0,
    });

    return NextResponse.json({
      humans: humans.map(formatEntry),
      agents: agents.map(formatEntry),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch leaderboard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
