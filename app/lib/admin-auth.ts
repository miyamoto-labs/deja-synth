/**
 * Admin authentication — HMAC-signed cookie.
 * Single-user internal tool. Password from ADMIN_PASSWORD env var.
 *
 * NOTE: This module uses Node.js crypto and must NOT be imported in
 * Edge Runtime (middleware). Auth checks live in route handlers via requireAdmin().
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecret(): string {
  return process.env.ADMIN_PASSWORD || '';
}

/** Create a signed token: "{timestamp}.{hmac}" */
export function signAdminToken(): string {
  const ts = Date.now().toString();
  const hmac = createHmac('sha256', getSecret()).update(ts).digest('hex');
  return `${ts}.${hmac}`;
}

/** Verify a signed token. Returns true if valid and not expired. */
export function verifyAdminToken(token: string): boolean {
  if (!getSecret()) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [ts, sig] = parts;
  const expected = createHmac('sha256', getSecret()).update(ts).digest('hex');

  // Timing-safe comparison
  if (sig.length !== expected.length) return false;
  const valid = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid) return false;

  // Check expiry (7 days)
  const age = Date.now() - parseInt(ts, 10);
  if (isNaN(age) || age < 0 || age > MAX_AGE_SECONDS * 1000) return false;

  return true;
}

/** Cookie options for Set-Cookie header */
export function adminCookieOptions(maxAge: number = MAX_AGE_SECONDS) {
  return {
    name: COOKIE_NAME,
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

/**
 * Guard for route handlers. Returns a 401 NextResponse if not authed, or null if OK.
 * Usage:
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 */
export function requireAdmin(request: { cookies: { get(name: string): { value: string } | undefined } }): NextResponse | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized - admin login required' }, { status: 401 });
  }
  return null;
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
