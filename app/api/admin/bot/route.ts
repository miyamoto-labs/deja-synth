import { NextResponse, NextRequest } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { requireAdmin } from '@/app/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Bot control via Supabase command queue.
 *
 * The admin panel (Vercel) writes commands to `ep_bot_commands`.
 * A watcher script on the Mac Mini polls that table and executes them.
 * Status is read from `ep_bot_status` (single row, upserted by the watcher).
 * Logs come from `ep_audit_log` (already written by the bot).
 */

/* ── GET /api/admin/bot — status + logs ────────── */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const sb = getSupabase();

    const [statusRes, auditRes, logRes] = await Promise.all([
      // Current bot status (single row)
      sb.from('ep_bot_status')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1),

      // Recent audit log entries
      sb.from('ep_audit_log')
        .select('event_type, event_data, source, created_at')
        .order('created_at', { ascending: false })
        .limit(30),

      // Recent bot stdout log entries
      sb.from('ep_bot_log')
        .select('line, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const row = statusRes.data?.[0];
    const status = row?.status || 'stopped';
    const mode = row?.mode || 'none';
    const pid = row?.pid || null;
    const startedAt = row?.started_at || null;
    const stoppedAt = row?.stopped_at || null;
    const error = row?.error || null;

    // Compute uptime
    let uptimeSeconds = 0;
    if (status === 'running' && startedAt) {
      uptimeSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    }

    // Build log output (reversed since we fetched desc)
    const logLines = (logRes.data || []).reverse().map((r: any) => r.line);
    const logOutput = logLines.join('\n');

    return NextResponse.json({
      status,
      mode,
      pid,
      startedAt,
      stoppedAt,
      error,
      uptimeSeconds,
      log: logOutput,
      auditLogs: auditRes.data || [],
    });
  } catch (err: any) {
    console.error('Bot status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ── POST /api/admin/bot — queue a command ──────── */
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { action, mode } = body;

    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'start', 'stop', or 'restart'" },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    // Write command to queue
    const { error: insertErr } = await sb
      .from('ep_bot_commands')
      .insert({
        action,
        mode: mode || 'full',
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (insertErr) {
      console.error('Failed to queue command:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Command '${action}' queued (mode: ${mode || 'full'}). Watcher will execute shortly.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process request' }, { status: 500 });
  }
}
