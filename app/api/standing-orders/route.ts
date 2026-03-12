import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const MAX_RULES_PER_USER = 5;

/* ── GET /api/standing-orders?wallet=0x... ──────────────────── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const sb = getSupabase();

    // Fetch active standing orders
    const { data: orders, error } = await sb
      .from('ep_standing_orders')
      .select('*')
      .eq('user_wallet', wallet)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get today's execution counts per order
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const orderIds = (orders || []).map((o: any) => o.id);
    let executionCounts: Record<string, number> = {};
    let totalExecutions: Record<string, number> = {};

    if (orderIds.length > 0) {
      // Today's counts
      const { data: todayCounts } = await sb
        .from('ep_standing_order_executions')
        .select('standing_order_id')
        .in('standing_order_id', orderIds)
        .eq('status', 'executed')
        .gte('created_at', todayStart.toISOString());

      for (const row of todayCounts || []) {
        executionCounts[row.standing_order_id] = (executionCounts[row.standing_order_id] || 0) + 1;
      }

      // All-time counts
      const { data: allCounts } = await sb
        .from('ep_standing_order_executions')
        .select('standing_order_id')
        .in('standing_order_id', orderIds)
        .eq('status', 'executed');

      for (const row of allCounts || []) {
        totalExecutions[row.standing_order_id] = (totalExecutions[row.standing_order_id] || 0) + 1;
      }
    }

    // Enrich orders with counts
    const enriched = (orders || []).map((order: any) => ({
      ...order,
      todayExecutions: executionCounts[order.id] || 0,
      totalExecutions: totalExecutions[order.id] || 0,
    }));

    return NextResponse.json({ orders: enriched });
  } catch (err: any) {
    console.error('Standing orders GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ── POST /api/standing-orders ──────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      wallet,
      minConviction = 80,
      maxConviction = 100,
      directionFilter = null,
      categoryFilter = null,
      amount = 10,
      dailyLimit = 5,
      totalLimit = null,
      label = null,
    } = body;

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const address = wallet.toLowerCase();
    const sb = getSupabase();

    // Validate CLOB credentials exist
    const { data: user } = await sb
      .from('ep_users')
      .select('clob_api_key')
      .eq('wallet_address', address)
      .single();

    if (!user?.clob_api_key) {
      return NextResponse.json(
        { error: 'Wallet not connected. Please connect your wallet and store CLOB credentials first.' },
        { status: 400 }
      );
    }

    // Validate field ranges
    if (minConviction < 0 || minConviction > 100 || maxConviction < 0 || maxConviction > 100) {
      return NextResponse.json({ error: 'Conviction must be 0-100' }, { status: 400 });
    }
    if (minConviction > maxConviction) {
      return NextResponse.json({ error: 'minConviction cannot exceed maxConviction' }, { status: 400 });
    }
    if (amount < 1 || amount > 1000) {
      return NextResponse.json({ error: 'Amount must be $1-$1,000' }, { status: 400 });
    }
    if (dailyLimit < 1 || dailyLimit > 50) {
      return NextResponse.json({ error: 'Daily limit must be 1-50' }, { status: 400 });
    }
    if (directionFilter && !['YES', 'NO'].includes(directionFilter)) {
      return NextResponse.json({ error: 'directionFilter must be YES, NO, or null' }, { status: 400 });
    }

    // Check rule limit
    const { count } = await sb
      .from('ep_standing_orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_wallet', address)
      .eq('active', true);

    if ((count || 0) >= MAX_RULES_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_RULES_PER_USER} active rules allowed` },
        { status: 400 }
      );
    }

    // Create
    const { data: order, error } = await sb
      .from('ep_standing_orders')
      .insert({
        user_wallet: address,
        min_conviction: minConviction,
        max_conviction: maxConviction,
        direction_filter: directionFilter,
        category_filter: categoryFilter,
        amount,
        daily_limit: dailyLimit,
        total_limit: totalLimit,
        label,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order }, { status: 201 });
  } catch (err: any) {
    console.error('Standing orders POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ── PATCH /api/standing-orders ─────────────────────────────── */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, wallet, ...updates } = body;

    if (!id || !wallet) {
      return NextResponse.json({ error: 'id and wallet required' }, { status: 400 });
    }

    const address = wallet.toLowerCase();
    const sb = getSupabase();

    // Map camelCase to snake_case
    const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.minConviction !== undefined) dbUpdates.min_conviction = updates.minConviction;
    if (updates.maxConviction !== undefined) dbUpdates.max_conviction = updates.maxConviction;
    if (updates.directionFilter !== undefined) dbUpdates.direction_filter = updates.directionFilter;
    if (updates.categoryFilter !== undefined) dbUpdates.category_filter = updates.categoryFilter;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.dailyLimit !== undefined) dbUpdates.daily_limit = updates.dailyLimit;
    if (updates.totalLimit !== undefined) dbUpdates.total_limit = updates.totalLimit;
    if (updates.label !== undefined) dbUpdates.label = updates.label;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (updates.pausedUntil !== undefined) dbUpdates.paused_until = updates.pausedUntil;

    const { data: order, error } = await sb
      .from('ep_standing_orders')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_wallet', address)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order });
  } catch (err: any) {
    console.error('Standing orders PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ── DELETE /api/standing-orders ─────────────────────────────── */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id, wallet } = body;

    if (!id || !wallet) {
      return NextResponse.json({ error: 'id and wallet required' }, { status: 400 });
    }

    const address = wallet.toLowerCase();
    const sb = getSupabase();

    // Soft-delete
    const { error } = await sb
      .from('ep_standing_orders')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_wallet', address);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Standing orders DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
