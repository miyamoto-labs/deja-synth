/**
 * Strategy Engine Service
 * Evaluates signals and determines which trades to execute
 */

import { getSupabase } from '../supabase-server';
import { Agent, RiskConfig } from './agent';
import { Position, Market, getMarketPrice } from './polymarket';

export interface Signal {
  marketId: string;
  marketTitle: string;
  outcome: 'YES' | 'NO';
  confidence: number; // 0-100
  source: string;
  reasoning: string;
  expectedValue?: number;
  recommendedSize?: number;
}

export interface TradeDecision {
  shouldTrade: boolean;
  signal?: Signal;
  positionSize: number; // USDC amount
  reason: string;
}

/**
 * Evaluate top signals from EasyPoly
 */
export async function evaluateSignals(
  agentId: string
): Promise<Signal[]> {
  try {
    const supabase = getSupabase();

    // Get agent config
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) throw new Error('Agent not found');

    const strategyConfig = agent.strategy_config as any;
    const minConfidence = strategyConfig?.minConfidence || 70;

    // TODO: Fetch real signals from EasyPoly API
    // For now, return mock signals
    const mockSignals: Signal[] = [
      {
        marketId: 'bitcoin-above-68k-on-february-9',
        marketTitle: 'Bitcoin above $68k on February 9',
        outcome: 'YES',
        confidence: 78,
        source: 'EasyPoly Top Signals',
        reasoning: 'Strong momentum, low IV, high volume',
        expectedValue: 0.15,
      },
    ];

    return mockSignals.filter((s) => s.confidence >= minConfidence);
  } catch (error: any) {
    console.error('Error evaluating signals:', error);
    return [];
  }
}

/**
 * Evaluate copy trade opportunities
 */
export async function evaluateCopyTrade(
  agentId: string,
  traderId: string
): Promise<Signal[]> {
  try {
    const supabase = getSupabase();

    // Get agent config
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) throw new Error('Agent not found');

    // TODO: Fetch trader's positions from Polymarket API
    // For now, return empty array
    const signals: Signal[] = [];

    console.log(`Copy trading ${traderId} - found ${signals.length} signals`);
    return signals;
  } catch (error: any) {
    console.error('Error evaluating copy trade:', error);
    return [];
  }
}

/**
 * Evaluate custom strategy rules
 */
export async function evaluateCustomRules(
  agentId: string,
  rules: any,
  marketData: Market[]
): Promise<Signal[]> {
  try {
    // Custom rule evaluation logic
    // This would parse user-defined rules and evaluate them against market data
    const signals: Signal[] = [];

    console.log(`Evaluating custom rules for agent ${agentId}`);
    return signals;
  } catch (error: any) {
    console.error('Error evaluating custom rules:', error);
    return [];
  }
}

/**
 * Check if should enter a position (risk management)
 */
export async function shouldEnterPosition(
  agentId: string,
  signal: Signal,
  currentPositions: Position[],
  riskConfig: RiskConfig
): Promise<TradeDecision> {
  try {
    const supabase = getSupabase();

    // 1. Check max open positions
    if (currentPositions.length >= riskConfig.maxOpenPositions) {
      return {
        shouldTrade: false,
        positionSize: 0,
        reason: `Max open positions reached (${riskConfig.maxOpenPositions})`,
      };
    }

    // 2. Check daily loss limit
    const dailyPnL = await getDailyPnL(agentId);
    if (dailyPnL <= -riskConfig.dailyLossLimit) {
      return {
        shouldTrade: false,
        positionSize: 0,
        reason: `Daily loss limit hit ($${riskConfig.dailyLossLimit})`,
      };
    }

    // 3. Check if already have position in this market
    const existingPosition = currentPositions.find(
      (p) => p.marketId === signal.marketId
    );
    if (existingPosition) {
      return {
        shouldTrade: false,
        positionSize: 0,
        reason: 'Already have position in this market',
      };
    }

    // 4. Calculate position size
    const { data: wallet } = await supabase
      .from('agent_wallets')
      .select('*')
      .eq('id', (await supabase.from('agents').select('wallet_id').eq('id', agentId).single()).data?.wallet_id)
      .single();

    if (!wallet) {
      return {
        shouldTrade: false,
        positionSize: 0,
        reason: 'Wallet not found',
      };
    }

    // Get wallet balance (would normally call wallet service)
    const balance = 1000; // TODO: Get real balance from wallet service

    const positionSize = await calculatePositionSize(
      signal,
      balance,
      riskConfig
    );

    if (positionSize < 1) {
      return {
        shouldTrade: false,
        positionSize: 0,
        reason: 'Position size too small (min $1)',
      };
    }

    // 5. All checks passed
    return {
      shouldTrade: true,
      signal,
      positionSize,
      reason: 'All risk checks passed',
    };
  } catch (error: any) {
    console.error('Error checking position entry:', error);
    return {
      shouldTrade: false,
      positionSize: 0,
      reason: `Error: ${error.message}`,
    };
  }
}

/**
 * Calculate position size based on strategy
 */
export async function calculatePositionSize(
  signal: Signal,
  balance: number,
  riskConfig: RiskConfig
): Promise<number> {
  // Method 1: Fixed percentage of balance
  const fixedSize = balance * (riskConfig.positionSize / 100);

  // Method 2: Kelly Criterion (if expected value provided)
  if (signal.expectedValue && signal.confidence) {
    const winProb = signal.confidence / 100;
    const lossProb = 1 - winProb;
    const odds = 1 / (await getMarketPrice(signal.marketId, signal.outcome));
    
    // Kelly fraction: (bp - q) / b
    // b = odds, p = win prob, q = loss prob
    const kellyFraction = (odds * winProb - lossProb) / odds;
    
    // Use fractional Kelly (more conservative)
    const conservativeKelly = Math.max(0, kellyFraction * 0.5);
    const kellySize = balance * conservativeKelly;

    // Use smaller of fixed or Kelly
    return Math.min(fixedSize, kellySize);
  }

  return fixedSize;
}

/**
 * Get daily P&L for an agent
 */
async function getDailyPnL(agentId: string): Promise<number> {
  try {
    const supabase = getSupabase();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: trades } = await supabase
      .from('agent_trades')
      .select('pnl')
      .eq('agent_id', agentId)
      .gte('entry_timestamp', startOfDay.toISOString())
      .not('pnl', 'is', null);

    if (!trades || trades.length === 0) return 0;

    return trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  } catch (error: any) {
    console.error('Error getting daily P&L:', error);
    return 0;
  }
}

/**
 * Check if should exit a position (stop loss / take profit)
 */
export async function shouldExitPosition(
  position: Position,
  riskConfig: RiskConfig
): Promise<{ shouldExit: boolean; reason: string }> {
  try {
    // Check stop loss
    if (riskConfig.stopLossPercent && position.pnlPercent <= -riskConfig.stopLossPercent) {
      return {
        shouldExit: true,
        reason: `Stop loss triggered (-${riskConfig.stopLossPercent}%)`,
      };
    }

    // Check take profit
    if (riskConfig.takeProfitPercent && position.pnlPercent >= riskConfig.takeProfitPercent) {
      return {
        shouldExit: true,
        reason: `Take profit triggered (+${riskConfig.takeProfitPercent}%)`,
      };
    }

    return {
      shouldExit: false,
      reason: 'No exit conditions met',
    };
  } catch (error: any) {
    console.error('Error checking position exit:', error);
    return {
      shouldExit: false,
      reason: `Error: ${error.message}`,
    };
  }
}

/**
 * Main strategy evaluation loop
 */
export async function evaluateStrategy(
  agentId: string
): Promise<TradeDecision[]> {
  try {
    const supabase = getSupabase();

    // Get agent
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) throw new Error('Agent not found');

    // Get current positions
    const { data: trades } = await supabase
      .from('agent_trades')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'OPEN');

    const currentPositions: Position[] = trades?.map((t) => ({
      id: t.id,
      marketId: t.market_id,
      marketTitle: t.market_title,
      outcome: t.outcome,
      shares: t.entry_shares || 0,
      entryPrice: t.entry_price || 0,
      currentPrice: 0.5, // TODO: Get real current price
      entryValue: t.entry_amount || 0,
      currentValue: (t.entry_shares || 0) * 0.5,
      pnl: t.pnl || 0,
      pnlPercent: t.pnl_percent || 0,
    })) || [];

    // Evaluate based on strategy type
    let signals: Signal[] = [];

    if (agent.strategy_type === 'TOP_SIGNALS') {
      signals = await evaluateSignals(agentId);
    } else if (agent.strategy_type === 'COPY_TRADER') {
      const traderIds = agent.strategy_config?.traderIds || [];
      for (const traderId of traderIds) {
        const traderSignals = await evaluateCopyTrade(agentId, traderId);
        signals.push(...traderSignals);
      }
    } else if (agent.strategy_type === 'CUSTOM') {
      signals = await evaluateCustomRules(
        agentId,
        agent.strategy_config?.rules,
        []
      );
    }

    // Evaluate each signal with risk management
    const decisions: TradeDecision[] = [];
    for (const signal of signals) {
      const decision = await shouldEnterPosition(
        agentId,
        signal,
        currentPositions,
        agent.risk_config
      );
      if (decision.shouldTrade) {
        decisions.push(decision);
      }
    }

    console.log(`Evaluated strategy for ${agentId}: ${decisions.length} trade opportunities`);
    return decisions;
  } catch (error: any) {
    console.error('Error evaluating strategy:', error);
    return [];
  }
}
