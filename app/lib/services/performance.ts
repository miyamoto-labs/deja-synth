/**
 * Performance Tracking Service
 * Calculates and updates agent performance metrics
 */

import { getSupabase } from '../supabase-server';

export interface PerformanceMetrics {
  agentId: string;
  timestamp: string;
  balance: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  weeklyPnL: number;
  weeklyPnLPercent: number;
  monthlyPnL: number;
  monthlyPnLPercent: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinSize: number;
  avgLossSize: number;
  sharpeRatio: number;
  maxDrawdown: number;
  rank?: number;
}

/**
 * Calculate all performance metrics for an agent
 */
export async function calculateMetrics(agentId: string): Promise<PerformanceMetrics> {
  try {
    const supabase = getSupabase();

    // Get all trades
    const { data: trades } = await supabase
      .from('agent_trades')
      .select('*')
      .eq('agent_id', agentId)
      .order('entry_timestamp', { ascending: true });

    if (!trades || trades.length === 0) {
      return getDefaultMetrics(agentId);
    }

    // Calculate basic stats
    const closedTrades = trades.filter((t) => t.status === 'CLOSED' && t.pnl !== null);
    const wins = closedTrades.filter((t) => (t.pnl || 0) > 0);
    const losses = closedTrades.filter((t) => (t.pnl || 0) < 0);

    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

    const avgWinSize = wins.length > 0
      ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length
      : 0;

    const avgLossSize = losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length)
      : 0;

    // Calculate time-based P&L
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyTrades = closedTrades.filter(
      (t) => new Date(t.exit_timestamp || t.entry_timestamp) >= oneDayAgo
    );
    const weeklyTrades = closedTrades.filter(
      (t) => new Date(t.exit_timestamp || t.entry_timestamp) >= oneWeekAgo
    );
    const monthlyTrades = closedTrades.filter(
      (t) => new Date(t.exit_timestamp || t.entry_timestamp) >= oneMonthAgo
    );

    const dailyPnL = dailyTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const weeklyPnL = weeklyTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const monthlyPnL = monthlyTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Get wallet balance
    const { data: agent } = await supabase
      .from('agents')
      .select('wallet_id')
      .eq('id', agentId)
      .single();

    // Assume starting balance of $1000 (or fetch from wallet service)
    const startingBalance = 1000;
    const currentBalance = startingBalance + totalPnL;

    const totalPnLPercent = (totalPnL / startingBalance) * 100;
    const dailyPnLPercent = (dailyPnL / currentBalance) * 100;
    const weeklyPnLPercent = (weeklyPnL / currentBalance) * 100;
    const monthlyPnLPercent = (monthlyPnL / currentBalance) * 100;

    // Calculate Sharpe Ratio
    const sharpeRatio = calculateSharpeRatio(closedTrades);

    // Calculate Max Drawdown
    const maxDrawdown = calculateMaxDrawdown(trades);

    const metrics: PerformanceMetrics = {
      agentId,
      timestamp: new Date().toISOString(),
      balance: currentBalance,
      totalPnL,
      totalPnLPercent,
      dailyPnL,
      dailyPnLPercent,
      weeklyPnL,
      weeklyPnLPercent,
      monthlyPnL,
      monthlyPnLPercent,
      totalTrades: closedTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      avgWinSize,
      avgLossSize,
      sharpeRatio,
      maxDrawdown,
    };

    // Store metrics
    await storeMetrics(metrics);

    return metrics;
  } catch (error: any) {
    console.error('Error calculating metrics:', error);
    return getDefaultMetrics(agentId);
  }
}

/**
 * Calculate Sharpe Ratio
 * (Average return - risk-free rate) / Standard deviation of returns
 */
function calculateSharpeRatio(trades: any[]): number {
  if (trades.length < 2) return 0;

  const returns = trades.map((t) => {
    const entryValue = t.entry_amount || 0;
    return entryValue > 0 ? ((t.pnl || 0) / entryValue) * 100 : 0;
  });

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Assume 0% risk-free rate
  const riskFreeRate = 0;

  return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
}

/**
 * Calculate Maximum Drawdown
 * Largest peak-to-trough decline in portfolio value
 */
function calculateMaxDrawdown(trades: any[]): number {
  if (trades.length === 0) return 0;

  let peak = 1000; // Starting balance
  let maxDrawdown = 0;
  let currentBalance = 1000;

  for (const trade of trades) {
    if (trade.status === 'CLOSED' && trade.pnl !== null) {
      currentBalance += trade.pnl;

      if (currentBalance > peak) {
        peak = currentBalance;
      }

      const drawdown = ((peak - currentBalance) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }

  return maxDrawdown;
}

/**
 * Store metrics to database
 */
async function storeMetrics(metrics: PerformanceMetrics): Promise<void> {
  try {
    const supabase = getSupabase();

    await supabase.from('agent_performance').insert({
      agent_id: metrics.agentId,
      timestamp: metrics.timestamp,
      balance: metrics.balance,
      total_pnl: metrics.totalPnL,
      total_pnl_percent: metrics.totalPnLPercent,
      daily_pnl: metrics.dailyPnL,
      daily_pnl_percent: metrics.dailyPnLPercent,
      weekly_pnl: metrics.weeklyPnL,
      weekly_pnl_percent: metrics.weeklyPnLPercent,
      monthly_pnl: metrics.monthlyPnL,
      monthly_pnl_percent: metrics.monthlyPnLPercent,
      total_trades: metrics.totalTrades,
      wins: metrics.wins,
      losses: metrics.losses,
      win_rate: metrics.winRate,
      avg_win_size: metrics.avgWinSize,
      avg_loss_size: metrics.avgLossSize,
      sharpe_ratio: metrics.sharpeRatio,
      max_drawdown: metrics.maxDrawdown,
      rank: metrics.rank,
    });

    console.log(`Metrics stored for agent ${metrics.agentId}`);
  } catch (error: any) {
    console.error('Error storing metrics:', error);
  }
}

/**
 * Get default metrics (for new agents)
 */
function getDefaultMetrics(agentId: string): PerformanceMetrics {
  return {
    agentId,
    timestamp: new Date().toISOString(),
    balance: 1000,
    totalPnL: 0,
    totalPnLPercent: 0,
    dailyPnL: 0,
    dailyPnLPercent: 0,
    weeklyPnL: 0,
    weeklyPnLPercent: 0,
    monthlyPnL: 0,
    monthlyPnLPercent: 0,
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgWinSize: 0,
    avgLossSize: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
  };
}

/**
 * Get agent performance for a specific timeframe
 */
export async function getAgentPerformance(
  agentId: string,
  timeframe: 'day' | 'week' | 'month' | 'all' = 'all'
): Promise<PerformanceMetrics[]> {
  try {
    const supabase = getSupabase();

    let startDate = new Date(0); // Beginning of time

    if (timeframe === 'day') {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (timeframe === 'week') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === 'month') {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const { data: metrics } = await supabase
      .from('agent_performance')
      .select('*')
      .eq('agent_id', agentId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: true });

    return metrics || [];
  } catch (error: any) {
    console.error('Error getting agent performance:', error);
    return [];
  }
}

/**
 * Update leaderboard rankings
 */
export async function updateLeaderboard(): Promise<void> {
  try {
    const supabase = getSupabase();

    // Get all agents with their latest performance
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .eq('status', 'RUNNING');

    if (!agents) return;

    const leaderboardEntries = [];

    for (const agent of agents) {
      // Get latest performance
      const { data: perf } = await supabase
        .from('agent_performance')
        .select('*')
        .eq('agent_id', agent.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (perf) {
        leaderboardEntries.push({
          type: 'AGENT',
          entity_id: agent.id,
          entity_name: agent.name,
          total_pnl: perf.total_pnl,
          total_pnl_percent: perf.total_pnl_percent,
          win_rate: perf.win_rate,
          total_trades: perf.total_trades,
          sharpe_ratio: perf.sharpe_ratio,
          max_drawdown: perf.max_drawdown,
        });
      }
    }

    // Sort by total P&L %
    leaderboardEntries.sort((a, b) => b.total_pnl_percent - a.total_pnl_percent);

    // Assign ranks
    leaderboardEntries.forEach((entry, index) => {
      (entry as any).rank = index + 1;
    });

    // Clear existing leaderboard
    await supabase.from('agent_leaderboard').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new leaderboard
    await supabase.from('agent_leaderboard').insert(leaderboardEntries);

    console.log(`Leaderboard updated: ${leaderboardEntries.length} entries`);
  } catch (error: any) {
    console.error('Error updating leaderboard:', error);
  }
}

/**
 * Get leaderboard rankings
 */
export async function getLeaderboard(
  limit: number = 100
): Promise<any[]> {
  try {
    const supabase = getSupabase();

    const { data: leaderboard } = await supabase
      .from('agent_leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .limit(limit);

    return leaderboard || [];
  } catch (error: any) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}
