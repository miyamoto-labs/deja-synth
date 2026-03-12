import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TYPE_EMOJI: Record<string, string> = {
  pick: '\u{1F3AF}',    // 🎯
  signal: '\u{1F4E1}',  // 📡
  trade: '\u{2705}',    // ✅
  system: '\u{2699}',   // ⚙️
};

/**
 * POST /api/notifications/send
 * Body: {
 *   type: 'pick' | 'signal' | 'trade' | 'system',
 *   title: string,
 *   body?: string,
 *   metadata?: object,
 *   wallet?: string,      // null = broadcast
 *   telegram?: boolean,    // also send to Telegram group
 * }
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { type, title, body, metadata, wallet, telegram } = payload;

    if (!type || !title) {
      return NextResponse.json(
        { error: 'type and title required' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    // Insert notification into database
    const { data: notification, error } = await sb
      .from('ep_notifications')
      .insert({
        user_wallet: wallet ? wallet.toLowerCase() : null,
        type,
        title,
        body: body || null,
        metadata: metadata || {},
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Notification insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send to Telegram group if requested and configured
    let telegramSent = false;
    if (telegram && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const emoji = TYPE_EMOJI[type] || '\u{1F514}'; // 🔔 default
        const telegramMessage = formatTelegramMessage(emoji, type, title, body, metadata);

        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: telegramMessage,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            }),
          }
        );

        if (tgRes.ok) {
          telegramSent = true;
        } else {
          const tgErr = await tgRes.text();
          console.error('Telegram send error:', tgErr);
        }
      } catch (tgErr) {
        console.error('Telegram send failed:', tgErr);
        // Don't fail the whole request if Telegram fails
      }
    }

    return NextResponse.json({
      success: true,
      notification,
      telegramSent,
    });
  } catch (err: any) {
    console.error('Notification send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function formatTelegramMessage(
  emoji: string,
  type: string,
  title: string,
  body?: string,
  metadata?: any
): string {
  const lines: string[] = [];

  // Header
  const typeLabel =
    type === 'pick'
      ? 'New AI Pick'
      : type === 'signal'
        ? 'Copy Signal'
        : type === 'trade'
          ? 'Trade Executed'
          : 'System Update';

  lines.push(`${emoji} <b>${typeLabel}</b>`);
  lines.push('');
  lines.push(escapeHtml(title));

  if (body) {
    lines.push(escapeHtml(body));
  }

  // Add metadata details
  if (metadata) {
    if (metadata.conviction) {
      const level = metadata.conviction >= 80 ? '\u{1F7E2}' : metadata.conviction >= 60 ? '\u{1F7E1}' : '\u{1F534}';
      lines.push(`Conviction: <b>${metadata.conviction}/100</b> ${level}`);
    }
    if (metadata.direction && metadata.price) {
      lines.push(`Direction: <b>${metadata.direction}</b> at ${(metadata.price * 100).toFixed(0)}\u00A2`);
    }
  }

  lines.push('');
  lines.push('\u{26A1} <a href="https://deja.market/dashboard">Trade on Déja</a>');

  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
