/**
 * Agent Pause Route
 * POST /api/agents/[id]/pause - Pause agent execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { pauseAgent } from '@/app/lib/services/agent';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    await pauseAgent(agentId);

    return NextResponse.json({
      success: true,
      message: 'Agent paused successfully',
      agentId,
    });
  } catch (error: any) {
    console.error('Error pausing agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to pause agent' },
      { status: 500 }
    );
  }
}
