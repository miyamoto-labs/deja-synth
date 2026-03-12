import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/app/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/logout
 * Clears the admin_session cookie.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    maxAge: 0,
    httpOnly: true,
    path: '/',
  });
  return response;
}
