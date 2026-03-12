/**
 * Individual Agent API Routes
 * GET /api/agents/[id] - Get agent details
 * PATCH /api/agents/[id] - Update agent
 * DELETE /api/agents/[id] - Delete agent
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentStatus,
  updateAgent,
  deleteAgent,
} from '@/app/lib/services/agent';

/**
 * GET /api/agents/[id]
 * Get agent details and status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const status = await getAgentStatus(agentId);

    return NextResponse.json({
      agentId: status.agent.id,
      name: status.agent.name,
      status: status.agent.status,
      strategyType: (status.agent as any).strategy_type || status.agent.strategyType,
      balance: status.balance,
      performance: {
        totalPnL: status.totalPnL,
        winRate: status.winRate,
        totalTrades: status.totalTrades,
        openPositions: status.openPositions,
      },
      startedAt: (status.agent as any).started_at || status.agent.startedAt,
      createdAt: (status.agent as any).created_at || status.agent.createdAt,
    });
  } catch (error: any) {
    console.error('Error getting agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get agent' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]
 * Update agent configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json();

    const updates: any = {};
    if (body.name) updates.name = body.name;
    if (body.strategyConfig) updates.strategyConfig = body.strategyConfig;
    if (body.riskConfig) updates.riskConfig = body.riskConfig;

    const agent = await updateAgent(agentId, updates);

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      status: agent.status,
      updatedAt: (agent as any).updated_at || agent.updatedAt,
    });
  } catch (error: any) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]
 * Delete agent permanently
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    await deleteAgent(agentId);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
