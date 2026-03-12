import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/list?wallet=0x...&limit=20&unread_only=false
 * Returns user-specific + broadcast notifications, ordered by recency.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const unreadOnly = searchParams.get('unread_only') === 'true';

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const sb = getSupabase();

    // Fetch user-specific + broadcast notifications
    let query = sb
      .from('ep_notifications')
      .select('*')
      .or(`user_wallet.eq.${wallet},user_wallet.is.null`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Notifications list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count unread
    const { count } = await sb
      .from('ep_notifications')
      .select('*', { count: 'exact', head: true })
      .or(`user_wallet.eq.${wallet},user_wallet.is.null`)
      .eq('read', false);

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: count || 0,
    });
  } catch (err: any) {
    console.error('Notifications list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
