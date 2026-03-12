/**
 * Agent Resume Route
 * POST /api/agents/[id]/resume - Resume paused agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { resumeAgent } from '@/app/lib/services/agent';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    await resumeAgent(agentId);

    return NextResponse.json({
      success: true,
      message: 'Agent resumed successfully',
      agentId,
    });
  } catch (error: any) {
    console.error('Error resuming agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resume agent' },
      { status: 500 }
    );
  }
}
