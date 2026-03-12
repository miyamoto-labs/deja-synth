/**
 * Execution Engine Service
 * Spawns and manages OpenClaw subagents for trading execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getSupabase } from '../supabase-server';
import { evaluateStrategy } from './strategy';
import { placeMarketOrder, getOpenPositions, closePosition } from './polymarket-real';
import { getUSDCBalance } from './wallet';
import { calculateMetrics } from './performance';

const execAsync = promisify(exec);

export interface AgentWorkerConfig {
  agentId: string;
  checkIntervalMs: number; // How often to check for signals (default: 5 minutes)
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Spawn an OpenClaw subagent worker for an agent
 */
export async function spawnAgentWorker(agentId: string): Promise<string> {
  try {
    const supabase = getSupabase();

    // Get agent details
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error || !agent) {
      throw new Error('Agent not found');
    }

    // Build subagent task description
    const task = buildAgentTask(agentId, agent);

    // Spawn subagent via OpenClaw
    console.log(`Spawning subagent for agent ${agentId}...`);
    
    const cmd = `openclaw sessions_spawn --label "easypoly-agent-${agentId}" --task "${task.replace(/"/g, '\\"')}"`;
    
    const { stdout } = await execAsync(cmd);
    
    // Parse session ID from output
    const sessionMatch = stdout.match(/session[_-]([a-f0-9-]+)/i);
    const sessionId = sessionMatch ? sessionMatch[0] : `session_${Date.now()}`;

    // Update agent with session ID
    await supabase
      .from('agents')
      .update({
        session_id: sessionId,
        status: 'RUNNING',
        started_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    console.log(`Subagent spawned: ${sessionId}`);
    return sessionId;
  } catch (error: any) {
    console.error('Error spawning agent worker:', error);
    throw new Error(`Failed to spawn agent worker: ${error.message}`);
  }
}

/**
 * Build agent task description for subagent
 */
function buildAgentTask(agentId: string, agent: any): string {
  return `
You are a trading agent for EasyPoly (Agent ID: ${agentId}, Name: ${agent.name}).

**Your Mission:**
Execute autonomous trading on Polymarket based on your strategy: ${agent.strategy_type}.

**Strategy Config:**
${JSON.stringify(agent.strategy_config, null, 2)}

**Risk Config:**
${JSON.stringify(agent.risk_config, null, 2)}

**Execution Loop (every 5 minutes):**

1. **Load Agent Status**
   - Check if status is RUNNING (if not, exit)
   - Update lastHeartbeat timestamp

2. **Evaluate Strategy**
   - Call strategy evaluation service
   - Get list of trade opportunities
   - Apply risk management filters

3. **Execute Trades**
   - For each approved signal:
     * Check wallet balance
     * Place market order via Polymarket API
     * Log trade to database
     * Update performance metrics

4. **Monitor Positions**
   - Get open positions
   - Check stop loss / take profit
   - Close positions if exit conditions met
   - Update P&L for each position

5. **Update Performance**
   - Calculate current metrics (P&L, win rate, Sharpe, etc.)
   - Update agent_performance table
   - Update leaderboard rankings

6. **Risk Checks**
   - If daily loss limit hit → pause agent
   - If max positions reached → skip new trades
   - If wallet balance too low → pause agent

7. **Sleep & Repeat**
   - Wait 5 minutes
   - Loop back to step 1

**Error Handling:**
- Transient errors (network, API timeout): retry up to 3 times
- Auth errors: pause agent, notify user to re-login
- Critical errors: pause agent, log error details

**Stop Conditions:**
- Agent status changed to PAUSED or STOPPED
- Daily loss limit exceeded
- Critical error encountered

**File Locations:**
- Strategy Service: /Users/erik/.openclaw/workspace/easypoly-landing/app/lib/services/strategy.ts
- Polymarket Service: /Users/erik/.openclaw/workspace/easypoly-landing/app/lib/services/polymarket-real.ts
- Performance Service: /Users/erik/.openclaw/workspace/easypoly-landing/app/lib/services/performance.ts
- Database: Supabase (connection via /Users/erik/.openclaw/workspace/easypoly-landing/app/lib/supabase-server.ts)

**Important:**
- Never trade more than configured position size
- Always respect risk limits
- Update heartbeat every loop iteration
- Log all trades and errors to database

Begin execution loop now. Run until stopped.
`.trim();
}

/**
 * Kill an agent worker (stop subagent)
 */
export async function killAgentWorker(sessionId: string): Promise<void> {
  try {
    console.log(`Killing agent worker: ${sessionId}`);
    
    const cmd = `openclaw subagents kill --target "${sessionId}"`;
    await execAsync(cmd);

    console.log('Agent worker killed');
  } catch (error: any) {
    console.error('Error killing agent worker:', error);
    throw new Error(`Failed to kill agent worker: ${error.message}`);
  }
}

/**
 * Check agent worker status
 */
export async function checkAgentWorkerStatus(sessionId: string): Promise<any> {
  try {
    const cmd = `openclaw subagents list --recent-minutes 60`;
    const { stdout } = await execAsync(cmd);

    // Parse subagent list output
    const lines = stdout.split('\n');
    const sessionLine = lines.find(line => line.includes(sessionId));

    if (!sessionLine) {
      return { status: 'not_found' };
    }

    return {
      status: 'running',
      sessionId,
      raw: sessionLine,
    };
  } catch (error: any) {
    console.error('Error checking agent worker status:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Agent execution loop (runs inside subagent)
 */
export async function agentExecutionLoop(
  agentId: string,
  config: AgentWorkerConfig
): Promise<void> {
  const supabase = getSupabase();
  let retryCount = 0;

  console.log(`Starting execution loop for agent ${agentId}`);

  while (true) {
    try {
      // 1. Check agent status
      const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (!agent) {
        console.error('Agent not found - exiting');
        break;
      }

      if (agent.status !== 'RUNNING') {
        console.log(`Agent status is ${agent.status} - exiting`);
        break;
      }

      // 2. Update heartbeat
      await supabase
        .from('agents')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('id', agentId);

      // 3. Evaluate strategy
      console.log('Evaluating strategy...');
      const decisions = await evaluateStrategy(agentId);

      // 4. Execute trades
      for (const decision of decisions) {
        if (!decision.signal) continue;

        try {
          console.log(`Executing trade: ${decision.signal.marketTitle} - ${decision.signal.outcome}`);

          // Get wallet
          const { data: agentData } = await supabase
            .from('agents')
            .select('wallet_id')
            .eq('id', agentId)
            .single();

          const { data: wallet } = await supabase
            .from('agent_wallets')
            .select('*')
            .eq('id', agentData?.wallet_id)
            .single();

          if (!wallet) {
            console.error('Wallet not found');
            continue;
          }

          // Check balance
          const balance = await getUSDCBalance(wallet.name);
          if (balance < decision.positionSize) {
            console.error('Insufficient balance');
            continue;
          }

          // Place order
          const order = await placeMarketOrder({
            walletAddress: wallet.address_ethereum,
            marketId: decision.signal.marketId,
            outcome: decision.signal.outcome,
            amount: decision.positionSize,
            orderType: 'market',
          });

          // Log trade
          await supabase.from('agent_trades').insert({
            agent_id: agentId,
            market_id: decision.signal.marketId,
            market_title: decision.signal.marketTitle,
            outcome: decision.signal.outcome,
            order_type: 'MARKET',
            status: 'OPEN',
            entry_amount: decision.positionSize,
            entry_price: order.price,
            entry_shares: order.shares,
            entry_timestamp: new Date().toISOString(),
            signal_source: decision.signal.source,
            signal_confidence: decision.signal.confidence,
            reason: decision.reason,
          });

          console.log(`Trade executed: ${order.orderId}`);
        } catch (error: any) {
          console.error('Error executing trade:', error);
          // Log error but continue
          await supabase.from('agent_trades').insert({
            agent_id: agentId,
            market_id: decision.signal?.marketId || 'unknown',
            market_title: decision.signal?.marketTitle || 'Unknown',
            outcome: decision.signal?.outcome || 'YES',
            status: 'FAILED',
            error: error.message,
          });
        }
      }

      // 5. Monitor positions (check for exits)
      const { data: openTrades } = await supabase
        .from('agent_trades')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'OPEN');

      for (const trade of openTrades || []) {
        // Check if should exit (stop loss / take profit)
        const position = {
          id: trade.id,
          marketId: trade.market_id,
          marketTitle: trade.market_title,
          outcome: trade.outcome,
          shares: trade.entry_shares || 0,
          entryPrice: trade.entry_price || 0,
          currentPrice: 0.5, // TODO: Get real current price
          entryValue: trade.entry_amount || 0,
          currentValue: (trade.entry_shares || 0) * 0.5,
          pnl: 0,
          pnlPercent: 0,
        };

        // Calculate current P&L
        position.pnl = position.currentValue - position.entryValue;
        position.pnlPercent = (position.pnl / position.entryValue) * 100;

        // Check exit conditions (from strategy service)
        const shouldExit = await import('./strategy').then(m => 
          m.shouldExitPosition(position, agent.risk_config)
        );

        if (shouldExit.shouldExit) {
          console.log(`Closing position: ${trade.market_title} - ${shouldExit.reason}`);

          try {
            // Close position
            const closeOrder = await closePosition(trade.id, trade.entry_shares);

            // Update trade
            await supabase
              .from('agent_trades')
              .update({
                status: 'CLOSED',
                exit_amount: closeOrder.shares * closeOrder.price,
                exit_price: closeOrder.price,
                exit_shares: closeOrder.shares,
                exit_timestamp: new Date().toISOString(),
                pnl: position.pnl,
                pnl_percent: position.pnlPercent,
              })
              .eq('id', trade.id);

            console.log(`Position closed: ${closeOrder.orderId}`);
          } catch (error: any) {
            console.error('Error closing position:', error);
          }
        }
      }

      // 6. Update performance metrics
      await calculateMetrics(agentId);

      // 7. Reset retry count on success
      retryCount = 0;

      // 8. Sleep
      console.log(`Sleeping for ${config.checkIntervalMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, config.checkIntervalMs));
    } catch (error: any) {
      console.error('Error in execution loop:', error);

      retryCount++;
      if (retryCount >= config.maxRetries) {
        console.error('Max retries exceeded - pausing agent');
        await supabase
          .from('agents')
          .update({ status: 'ERROR' })
          .eq('id', agentId);
        break;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs));
    }
  }

  console.log(`Execution loop ended for agent ${agentId}`);
}
