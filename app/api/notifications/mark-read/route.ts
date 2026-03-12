import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/mark-read
 * Body: { wallet: string, notificationIds: string[] | 'all' }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, notificationIds } = body;

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const sb = getSupabase();
    const address = wallet.toLowerCase();

    if (notificationIds === 'all') {
      // Mark all user-specific + broadcast notifications as read
      await sb
        .from('ep_notifications')
        .update({ read: true })
        .or(`user_wallet.eq.${address},user_wallet.is.null`)
        .eq('read', false);
    } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Mark specific notifications as read
      await sb
        .from('ep_notifications')
        .update({ read: true })
        .in('id', notificationIds);
    } else {
      return NextResponse.json({ error: 'notificationIds required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Mark-read error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
