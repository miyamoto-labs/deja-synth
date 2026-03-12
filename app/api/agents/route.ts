/**
 * Agent CRUD API Routes
 * POST /api/agents - Create agent
 * GET /api/agents - List user's agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAgent, listUserAgents } from '@/app/lib/services/agent';

/**
 * POST /api/agents
 * Create a new agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Get userId from session/auth
    const userId = body.userId || 'mock-user-id';

    // Validate required fields
    if (!body.name || !body.strategyType || !body.riskConfig) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create agent
    const result = await createAgent(userId, {
      name: body.name,
      strategyType: body.strategyType,
      strategyConfig: body.strategyConfig || {},
      riskConfig: body.riskConfig,
    });

    return NextResponse.json({
      agentId: result.agent.id,
      name: result.agent.name,
      status: result.agent.status,
      wallet: {
        walletId: result.wallet.walletId,
        addresses: result.wallet.addresses,
        encryptedPrivateKey: result.wallet.encryptedPrivateKey,
      },
      createdAt: result.agent.createdAt,
    });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create agent' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents
 * List user's agents
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from session/auth
    const userId = request.nextUrl.searchParams.get('userId') || 'mock-user-id';

    const agents = await listUserAgents(userId);

    return NextResponse.json({
      agents: agents.map((agent: any) => ({
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        strategyType: agent.strategy_type || agent.strategyType,
        createdAt: agent.created_at || agent.createdAt,
        startedAt: agent.started_at || agent.startedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error listing agents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list agents' },
      { status: 500 }
    );
  }
}
