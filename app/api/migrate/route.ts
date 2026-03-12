import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/migrate
 * One-time migration to create ep_user_follows table.
 * Uses upsert pattern since we can't run DDL via PostgREST.
 * DELETE THIS ROUTE AFTER RUNNING THE MIGRATION VIA SUPABASE DASHBOARD.
 */
export async function GET() {
  try {
    const supabase = getSupabase();

    // Try to read from the table to check if it exists
    const { error: readError } = await supabase
      .from('ep_user_follows')
      .select('id')
      .limit(1);

    if (readError && readError.code === 'PGRST205') {
      // Table doesn't exist — need to create it manually
      return NextResponse.json({
        status: 'table_missing',
        message: 'ep_user_follows table does not exist. Please run the SQL migration manually in Supabase Dashboard > SQL Editor.',
        sql: `CREATE TABLE IF NOT EXISTS ep_user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  trader_id UUID NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  auto_trade BOOLEAN NOT NULL DEFAULT false,
  amount_per_trade NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  max_daily_trades INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_wallet, trader_id)
);
CREATE INDEX IF NOT EXISTS idx_ep_user_follows_wallet ON ep_user_follows(user_wallet) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ep_user_follows_auto ON ep_user_follows(auto_trade) WHERE active = true AND auto_trade = true;`,
      });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'ep_user_follows table already exists!',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
