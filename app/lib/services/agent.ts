/**
 * Agent Management Service
 * Core logic for managing autonomous trading agents
 */

import { getSupabase } from '../supabase-server';
import { createWallet, WalletData } from './wallet';

export interface AgentConfig {
  name: string;
  strategyType: 'TOP_SIGNALS' | 'COPY_TRADER' | 'CUSTOM';
  strategyConfig: any;
  riskConfig: RiskConfig;
}

export interface RiskConfig {
  profile: 'conservative' | 'moderate' | 'aggressive';
  positionSize: number; // % of balance per trade
  maxOpenPositions: number;
  dailyLossLimit: number; // USD
  stopLossPercent?: number; // Auto-close at -X% loss
  takeProfitPercent?: number; // Auto-close at +X% profit
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  status: 'CREATED' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
  strategyType: string;
  strategyConfig: any;
  riskConfig: any;
  walletId: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  stoppedAt?: string;
}

export interface AgentStatus {
  agent: Agent;
  balance: number;
  openPositions: number;
  totalTrades: number;
  totalPnL: number;
  winRate: number;
}

/**
 * Create a new agent
 */
export async function createAgent(
  userId: string,
  config: AgentConfig
): Promise<{ agent: Agent; wallet: WalletData }> {
  const supabase = getSupabase();

  try {
    // 1. Create wallet via MoonPay
    console.log('Creating wallet for agent:', config.name);
    const wallet = await createWallet(userId, config.name);

    // 2. Store wallet in database
    const { data: walletRecord, error: walletError } = await supabase
      .from('agent_wallets')
      .insert({
        user_id: userId,
        name: wallet.walletName,
        address_solana: wallet.addresses.solana,
        address_ethereum: wallet.addresses.ethereum,
        address_bitcoin: wallet.addresses.bitcoin,
        address_tron: wallet.addresses.tron,
        encrypted_private_key: wallet.encryptedPrivateKey,
      })
      .select()
      .single();

    if (walletError) {
      throw new Error(`Failed to store wallet: ${walletError.message}`);
    }

    // 3. Create agent record
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        user_id: userId,
        name: config.name,
        status: 'CREATED',
        strategy_type: config.strategyType,
        strategy_config: config.strategyConfig,
        risk_config: config.riskConfig,
        wallet_id: walletRecord.id,
      })
      .select()
      .single();

    if (agentError) {
      throw new Error(`Failed to create agent: ${agentError.message}`);
    }

    return { agent, wallet };
  } catch (error: any) {
    console.error('Error creating agent:', error);
    throw new Error(`Failed to create agent: ${error.message}`);
  }
}

/**
 * Start agent execution (spawn OpenClaw subagent)
 */
export async function startAgent(agentId: string): Promise<void> {
  const supabase = getSupabase();

  try {
    // 1. Get agent details
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error || !agent) {
      throw new Error('Agent not found');
    }

    if (agent.status !== 'CREATED' && agent.status !== 'PAUSED') {
      throw new Error(`Cannot start agent in ${agent.status} state`);
    }

    // 2. Spawn OpenClaw subagent for real trading execution
    const { spawnAgentWorker } = await import('./execution');
    const sessionId = await spawnAgentWorker(agentId);

    console.log('Agent started successfully:', agentId, 'session:', sessionId);
  } catch (error: any) {
    console.error('Error starting agent:', error);
    throw new Error(`Failed to start agent: ${error.message}`);
  }
}

/**
 * Pause agent execution
 */
export async function pauseAgent(agentId: string): Promise<void> {
  const supabase = getSupabase();

  try {
    const { data: agent } = await supabase
      .from('agents')
      .select('status')
      .eq('id', agentId)
      .single();

    if (agent?.status !== 'RUNNING') {
      throw new Error('Agent is not running');
    }

    await supabase.from('agents').update({ status: 'PAUSED' }).eq('id', agentId);

    console.log('Agent paused:', agentId);
  } catch (error: any) {
    console.error('Error pausing agent:', error);
    throw new Error(`Failed to pause agent: ${error.message}`);
  }
}

/**
 * Resume paused agent
 */
export async function resumeAgent(agentId: string): Promise<void> {
  const supabase = getSupabase();

  try {
    const { data: agent } = await supabase
      .from('agents')
      .select('status')
      .eq('id', agentId)
      .single();

    if (agent?.status !== 'PAUSED') {
      throw new Error('Agent is not paused');
    }

    await supabase
      .from('agents')
      .update({ status: 'RUNNING' })
      .eq('id', agentId);

    console.log('Agent resumed:', agentId);
  } catch (error: any) {
    console.error('Error resuming agent:', error);
    throw new Error(`Failed to resume agent: ${error.message}`);
  }
}

/**
 * Stop agent permanently (cannot be restarted)
 */
export async function stopAgent(agentId: string): Promise<void> {
  const supabase = getSupabase();

  try {
    // Get agent to find session ID
    const { data: agent } = await supabase
      .from('agents')
      .select('session_id')
      .eq('id', agentId)
      .single();

    if (agent?.session_id) {
      // Kill OpenClaw subagent session
      const { killAgentWorker } = await import('./execution');
      await killAgentWorker(agent.session_id);
    }

    await supabase
      .from('agents')
      .update({
        status: 'STOPPED',
        stopped_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    console.log('Agent stopped:', agentId);
  } catch (error: any) {
    console.error('Error stopping agent:', error);
    throw new Error(`Failed to stop agent: ${error.message}`);
  }
}

/**
 * Update agent configuration
 */
export async function updateAgent(
  agentId: string,
  updates: Partial<AgentConfig>
): Promise<Agent> {
  const supabase = getSupabase();

  try {
    const updateData: any = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.strategyConfig) updateData.strategy_config = updates.strategyConfig;
    if (updates.riskConfig) updateData.risk_config = updates.riskConfig;

    const { data: agent, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update agent: ${error.message}`);
    }

    return agent;
  } catch (error: any) {
    console.error('Error updating agent:', error);
    throw new Error(`Failed to update agent: ${error.message}`);
  }
}

/**
 * Get agent status and performance
 */
export async function getAgentStatus(agentId: string): Promise<AgentStatus> {
  const supabase = getSupabase();

  try {
    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found');
    }

    // Get latest performance snapshot
    const { data: performance } = await supabase
      .from('agent_performance')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Get trade stats
    const { count: totalTrades } = await supabase
      .from('agent_trades')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    const { count: openPositions } = await supabase
      .from('agent_trades')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'OPEN');

    return {
      agent,
      balance: performance?.balance || 0,
      openPositions: openPositions || 0,
      totalTrades: totalTrades || 0,
      totalPnL: performance?.total_pnl || 0,
      winRate: performance?.win_rate || 0,
    };
  } catch (error: any) {
    console.error('Error getting agent status:', error);
    throw new Error(`Failed to get agent status: ${error.message}`);
  }
}

/**
 * List all agents for a user
 */
export async function listUserAgents(userId: string): Promise<Agent[]> {
  const supabase = getSupabase();

  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list agents: ${error.message}`);
    }

    return agents || [];
  } catch (error: any) {
    console.error('Error listing agents:', error);
    throw new Error(`Failed to list agents: ${error.message}`);
  }
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const supabase = getSupabase();

  try {
    // Stop agent first if running
    const { data: agent } = await supabase
      .from('agents')
      .select('status')
      .eq('id', agentId)
      .single();

    if (agent?.status === 'RUNNING') {
      await stopAgent(agentId);
    }

    // Delete agent (cascade will handle related records)
    const { error } = await supabase.from('agents').delete().eq('id', agentId);

    if (error) {
      throw new Error(`Failed to delete agent: ${error.message}`);
    }

    console.log('Agent deleted:', agentId);
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    throw new Error(`Failed to delete agent: ${error.message}`);
  }
}
