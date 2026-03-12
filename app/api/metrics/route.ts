import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabase();
  try {
    // Count active agents
    const { count: activeAgents } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'RUNNING');
    
    // Count total trades in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: totalTrades } = await supabase
      .from('agent_trades')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);
    
    // Calculate win rate
    const { data: trades } = await supabase
      .from('agent_trades')
      .select('pnl')
      .gte('created_at', oneDayAgo)
      .not('pnl', 'is', null);
    
    const wins = trades?.filter(t => (t.pnl || 0) > 0).length || 0;
    const winRate = trades && trades.length > 0 ? (wins / trades.length) * 100 : 0;
    
    return NextResponse.json({
      activeAgents: activeAgents || 0,
      totalTrades24h: totalTrades || 0,
      winRate: winRate.toFixed(2),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
