/**
 * End-to-End Agent Trading Test
 * Tests the complete agent lifecycle:
 * 1. Create agent
 * 2. Fund wallet
 * 3. Start agent (spawns subagent)
 * 4. Execute trades
 * 5. Monitor performance
 * 6. Stop agent
 */

import { createAgent, startAgent, getAgentStatus, stopAgent } from '../app/lib/services/agent';
import { calculateMetrics } from '../app/lib/services/performance';
import { getUSDCBalance } from '../app/lib/services/wallet';

async function runE2ETest() {
  console.log('Starting E2E Agent Trading Test...\n');

  try {
    // Test User ID (replace with real user from auth)
    const testUserId = 'test-user-123';

    // 1. Create Agent
    console.log('Step 1: Creating agent...');
    const { agent, wallet } = await createAgent(testUserId, {
      name: 'TestBot E2E',
      strategyType: 'TOP_SIGNALS',
      strategyConfig: {
        minConfidence: 75,
      },
      riskConfig: {
        profile: 'moderate',
        positionSize: 5, // 5% of balance per trade
        maxOpenPositions: 3,
        dailyLossLimit: 50, // $50
        stopLossPercent: 10, // -10%
        takeProfitPercent: 20, // +20%
      },
    });

    console.log('✓ Agent created:', agent.id);
    console.log('  Wallet:', wallet.walletName);
    console.log('  Solana Address:', wallet.addresses.solana);
    console.log('  Ethereum Address:', wallet.addresses.ethereum);
    console.log();

    // 2. Fund Wallet (Manual step - display instructions)
    console.log('Step 2: Fund wallet');
    console.log('⚠️  MANUAL ACTION REQUIRED:');
    console.log('  Send USDC (Polygon) to:', wallet.addresses.ethereum);
    console.log('  Minimum: $100 USDC for testing');
    console.log('  Waiting 30 seconds for funding...');
    console.log();

    await sleep(30000); // Wait 30 seconds

    // Check balance
    const balance = await getUSDCBalance(wallet.walletName);
    console.log('  Current balance:', balance, 'USDC');

    if (balance < 10) {
      console.error('❌ Insufficient balance. Please fund wallet and re-run test.');
      return;
    }

    console.log('✓ Wallet funded\n');

    // 3. Start Agent (Spawns Subagent)
    console.log('Step 3: Starting agent...');
    await startAgent(agent.id);
    console.log('✓ Agent started (subagent spawned)\n');

    // 4. Monitor Agent for 2 minutes
    console.log('Step 4: Monitoring agent (2 minutes)...');
    const monitorDuration = 2 * 60 * 1000; // 2 minutes
    const checkInterval = 15 * 1000; // Check every 15 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < monitorDuration) {
      await sleep(checkInterval);

      // Get agent status
      const status = await getAgentStatus(agent.id);

      console.log(`  [${new Date().toISOString()}]`);
      console.log(`    Status: ${status.agent.status}`);
      console.log(`    Balance: $${status.balance.toFixed(2)}`);
      console.log(`    Open Positions: ${status.openPositions}`);
      console.log(`    Total Trades: ${status.totalTrades}`);
      console.log(`    Total P&L: $${status.totalPnL.toFixed(2)} (${status.winRate.toFixed(1)}% win rate)`);
      console.log();

      // Check if agent is still running
      if (status.agent.status !== 'RUNNING') {
        console.log(`⚠️  Agent status changed to ${status.agent.status}`);
        break;
      }
    }

    console.log('✓ Monitoring complete\n');

    // 5. Calculate Final Performance
    console.log('Step 5: Calculating final performance...');
    const metrics = await calculateMetrics(agent.id);

    console.log('  Performance Metrics:');
    console.log(`    Total P&L: $${metrics.totalPnL.toFixed(2)} (${metrics.totalPnLPercent.toFixed(2)}%)`);
    console.log(`    Total Trades: ${metrics.totalTrades}`);
    console.log(`    Win Rate: ${metrics.winRate.toFixed(1)}%`);
    console.log(`    Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
    console.log(`    Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%`);
    console.log();

    // 6. Stop Agent
    console.log('Step 6: Stopping agent...');
    await stopAgent(agent.id);
    console.log('✓ Agent stopped\n');

    // Test Summary
    console.log('='.repeat(50));
    console.log('E2E TEST COMPLETE');
    console.log('='.repeat(50));
    console.log(`Agent ID: ${agent.id}`);
    console.log(`Trades Executed: ${metrics.totalTrades}`);
    console.log(`Final P&L: $${metrics.totalPnL.toFixed(2)}`);
    console.log(`Success Rate: ${metrics.winRate.toFixed(1)}%`);
    console.log('='.repeat(50));
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run test
runE2ETest();
