import { NextResponse } from 'next/server';
import { promptBankr, isBankrConfigured } from '@/app/lib/bankr';

export const dynamic = 'force-dynamic';

/* ── Simple in-memory rate limiter (resets on server restart) ── */
const RATE_LIMIT_MAX = 10; // queries per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (valid.length >= RATE_LIMIT_MAX) return false;
  valid.push(now);
  rateLimitMap.set(ip, valid);
  return true;
}

/**
 * POST /api/bankr/query
 * Sends a prompt to bankr.bot AI assistant and returns the response.
 * Platform absorbs the $0.10/request cost during beta.
 * Rate limited: 10 queries per IP per hour.
 */
export async function POST(request: Request) {
  try {
    if (!isBankrConfigured()) {
      return NextResponse.json(
        { error: 'AI assistant not configured' },
        { status: 503 }
      );
    }

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 10 AI queries per hour.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing prompt' },
        { status: 400 }
      );
    }

    // Limit prompt length
    if (prompt.length > 500) {
      return NextResponse.json(
        { error: 'Prompt too long (max 500 chars)' },
        { status: 400 }
      );
    }

    const response = await promptBankr(prompt);

    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    console.error('Bankr query error:', err);
    return NextResponse.json(
      { error: err.message || 'AI query failed' },
      { status: 500 }
    );
  }
}
