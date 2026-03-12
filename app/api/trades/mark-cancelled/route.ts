import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trades/mark-cancelled
 * Marks open/unfilled orders as cancelled in ep_user_trades.
 * Called after successfully cancelling orders on the CLOB.
 *
 * Body: { walletAddress, orderIds?: string[] }
 *   - If orderIds is provided, only those orders are cancelled.
 *   - If omitted, ALL open orders for the wallet are cancelled.
 */
export async function POST(request: Request) {
  try {
    const { walletAddress, orderIds } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing walletAddress' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();
    const now = new Date().toISOString();

    // IMPORTANT: Only cancel orders that haven't been filled (shares=0 or null).
    // Previously this bulk-updated ALL unresolved trades, incorrectly zeroing
    // realized_pnl on trades that were actually filled and awaiting resolution.
    let query = supabase
      .from('ep_user_trades')
      .update({
        realized_pnl: 0,
        resolved_at: now,
      })
      .eq('user_wallet', address)
      .is('realized_pnl', null)
      .is('resolved_at', null);

    // If specific order IDs provided, only cancel those
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      query = query.in('order_id', orderIds);
    } else {
      // Bulk cancel: only target orders with 0 shares (unfilled)
      // Do NOT cancel trades that have shares > 0 — those are filled trades
      // awaiting market resolution.
      query = query.or('shares.is.null,shares.eq.0');
    }

    const { data, error, count } = await query.select();

    if (error) {
      console.error('[mark-cancelled] Supabase error:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      cancelled: data?.length || 0,
    });
  } catch (err: any) {
    console.error('[mark-cancelled] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to mark orders as cancelled' },
      { status: 500 }
    );
  }
}
