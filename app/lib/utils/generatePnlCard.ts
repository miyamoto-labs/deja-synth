/**
 * Generate a shareable PnL card as a PNG blob using Canvas API.
 * 1200×630 — standard OG/social media card ratio.
 */

export interface PnlCardData {
  question: string;
  outcome: string;
  pnl: number;
  pnlPercent: number;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  resolved?: boolean;
  createdAt?: string | null;
}

// Colors matching the EasyPoly design system
const COLORS = {
  bg: '#08090E',
  bgGrad: '#0F1118',
  surface: '#151823',
  border: '#1E2235',
  accent: '#00F0A0',
  profit: '#00F0A0',
  loss: '#FF4060',
  textPrimary: '#E8ECF4',
  textSecondary: '#8B92A8',
  textMuted: '#505672',
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(' ');
  let line = '';
  let linesDrawn = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + (line ? ' ' : '') + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      linesDrawn++;
      if (linesDrawn >= maxLines) {
        ctx.fillText(line + '...', x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const scale = s / 512;

  // Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, 120 * scale, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.accent;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 6 * scale;
  ctx.stroke();

  // Middle circle
  ctx.beginPath();
  ctx.arc(cx, cy, 80 * scale, 0, Math.PI * 2);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 8 * scale;
  ctx.stroke();

  // Inner filled circle
  ctx.beginPath();
  ctx.arc(cx, cy, 40 * scale, 0, Math.PI * 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.accent;
  ctx.fill();

  // Sparkline
  ctx.beginPath();
  ctx.moveTo(cx - 140 * scale, cy + 60 * scale);
  ctx.lineTo(cx - 80 * scale, cy + 20 * scale);
  ctx.lineTo(cx - 20 * scale, cy - 20 * scale);
  ctx.lineTo(cx + 40 * scale, cy - 60 * scale);
  ctx.lineTo(cx + 100 * scale, cy - 100 * scale);
  ctx.lineTo(cx + 140 * scale, cy - 140 * scale);
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 10 * scale;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Dot at end
  ctx.beginPath();
  ctx.arc(cx + 140 * scale, cy - 140 * scale, 8 * scale, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.accent;
  ctx.fill();
}

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export async function generatePnlCard(data: PnlCardData): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const PAD = 60;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background gradient ──
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLORS.bg);
  grad.addColorStop(1, COLORS.bgGrad);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  for (let x = PAD; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── Top bar: Logo + watermark ──
  drawLogo(ctx, PAD, 36, 48);

  // "EasyPoly" text next to logo
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText('Easy', PAD + 58, 68);
  const easyW = ctx.measureText('Easy').width;
  ctx.fillStyle = COLORS.accent;
  ctx.fillText('Poly', PAD + 58 + easyW, 68);

  // Watermark
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'right';
  ctx.fillText('deja.market', W - PAD, 68);
  ctx.textAlign = 'left';

  const isProfit = data.pnl >= 0;
  const accentColor = isProfit ? COLORS.profit : COLORS.loss;

  // ── Market question ──
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  let nextY = wrapText(ctx, data.question, PAD, 130, W - PAD * 2, 34, 2);

  // ── Outcome badge ──
  nextY += 8;
  const outcomeText = data.outcome.toUpperCase();
  const isYes = outcomeText !== 'NO' && outcomeText !== 'DOWN';
  const badgeColor = isYes ? COLORS.profit : COLORS.loss;

  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  const badgeTextW = ctx.measureText(outcomeText).width;
  const badgePadX = 16;
  const badgeH = 28;
  const badgeW = badgeTextW + badgePadX * 2;

  drawRoundedRect(ctx, PAD, nextY, badgeW, badgeH, 6);
  ctx.fillStyle = badgeColor;
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = badgeColor;
  ctx.fillText(outcomeText, PAD + badgePadX, nextY + 20);

  // Status label
  if (data.resolved) {
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(isProfit ? 'RESOLVED — WON' : 'RESOLVED — LOST', PAD + badgeW + 16, nextY + 20);
  }

  // ── Big PnL number ──
  nextY += badgeH + 30;
  const pnlSign = isProfit ? '+' : '';
  const pnlText = `${pnlSign}$${Math.abs(data.pnl).toFixed(2)}`;

  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = accentColor;
  ctx.fillText(pnlText, PAD, nextY + 60);

  // PnL percent next to it
  const pnlTextW = ctx.measureText(pnlText).width;
  const pctText = `${pnlSign}${data.pnlPercent.toFixed(1)}%`;
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText(pctText, PAD + pnlTextW + 20, nextY + 56);
  ctx.globalAlpha = 1;

  // ── Stats row ──
  nextY += 100;

  // Stats background
  drawRoundedRect(ctx, PAD, nextY, W - PAD * 2, 70, 12);
  ctx.fillStyle = COLORS.surface;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const stats = [
    { label: 'Entry', value: `${(data.avgPrice * 100).toFixed(1)}¢` },
    { label: 'Current', value: `${(data.curPrice * 100).toFixed(1)}¢` },
    { label: 'Shares', value: data.size.toFixed(1) },
    { label: 'Value', value: `$${data.currentValue.toFixed(2)}` },
  ];

  const statW = (W - PAD * 2) / stats.length;
  stats.forEach((stat, i) => {
    const sx = PAD + statW * i + statW / 2;

    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText(stat.label, sx, nextY + 28);

    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText(stat.value, sx, nextY + 52);

    // Divider
    if (i < stats.length - 1) {
      ctx.beginPath();
      ctx.moveTo(PAD + statW * (i + 1), nextY + 14);
      ctx.lineTo(PAD + statW * (i + 1), nextY + 56);
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
  ctx.textAlign = 'left';

  // ── Timestamp ──
  if (data.createdAt) {
    nextY += 86;
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(`Opened ${timeAgoShort(data.createdAt)}`, PAD, nextY);
  }

  // ── Bottom accent bar ──
  const barGrad = ctx.createLinearGradient(0, 0, W, 0);
  barGrad.addColorStop(0, accentColor);
  barGrad.addColorStop(1, isProfit ? '#00C080' : '#CC3050');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, H - 6, W, 6);

  // ── Glow effect behind PnL ──
  const glowGrad = ctx.createRadialGradient(PAD + 200, 340, 0, PAD + 200, 340, 300);
  glowGrad.addColorStop(0, accentColor);
  glowGrad.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 200, W, 300);
  ctx.globalAlpha = 1;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
