/**
 * Agent Start Route
 * POST /api/agents/[id]/start - Start agent execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { startAgent } from '@/app/lib/services/agent';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    await startAgent(agentId);

    return NextResponse.json({
      success: true,
      message: 'Agent started successfully',
      agentId,
    });
  } catch (error: any) {
    console.error('Error starting agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start agent' },
      { status: 500 }
    );
  }
}
