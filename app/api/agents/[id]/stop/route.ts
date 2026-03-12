/**
 * Agent Stop Route
 * POST /api/agents/[id]/stop - Stop agent permanently
 */

import { NextRequest, NextResponse } from 'next/server';
import { stopAgent } from '@/app/lib/services/agent';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    await stopAgent(agentId);

    return NextResponse.json({
      success: true,
      message: 'Agent stopped successfully',
      agentId,
    });
  } catch (error: any) {
    console.error('Error stopping agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to stop agent' },
      { status: 500 }
    );
  }
}
