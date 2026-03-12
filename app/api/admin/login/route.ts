import { NextResponse } from 'next/server';
import { signAdminToken, adminCookieOptions } from '@/app/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/login
 * Body: { password: string }
 * Sets httpOnly admin_session cookie on success.
 */
export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminPw = process.env.ADMIN_PASSWORD;

    if (!adminPw) {
      return NextResponse.json(
        { error: 'Admin access not configured' },
        { status: 503 }
      );
    }

    if (!password || password !== adminPw) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const token = signAdminToken();
    const opts = adminCookieOptions();

    const response = NextResponse.json({ success: true });
    response.cookies.set(opts.name, token, {
      maxAge: opts.maxAge,
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Login failed' },
      { status: 500 }
    );
  }
}
