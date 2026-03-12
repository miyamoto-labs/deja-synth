import { NextResponse } from 'next/server';
import { getSystemHealth } from '@/app/lib/monitoring/alerts';

export async function GET() {
  try {
    const health = await getSystemHealth();
    
    const statusCode = health.status === 'healthy' ? 200 
      : health.status === 'degraded' ? 200 
      : 503;
    
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
