/**
 * Middleware to protect API routes.
 *
 * NOTE: Admin auth (/api/admin/*) is handled inside each route handler
 * because middleware runs in Edge Runtime which doesn't support Node.js
 * crypto.createHmac. See app/lib/admin-auth.ts → requireAdmin().
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /api/agents/* endpoints (NextAuth)
  if (pathname.startsWith('/api/agents')) {
    const sessionToken = request.cookies.get('next-auth.session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/agents/:path*'],
};
