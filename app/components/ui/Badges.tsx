'use client';

import {
  Landmark,
  Trophy,
  Gem,
  Clapperboard,
  TrendingUp,
  Megaphone,
  CloudSun,
  Globe,
  Flag,
  Gamepad2,
  BarChart3,
  Cpu,
  Beaker,
  Dribbble,
  Layers,
  type LucideIcon,
} from 'lucide-react';

// ── Tier Badge ──────────────────────────────────
const tierConfig: Record<string, { color: string; bg: string; emoji: string }> = {
  micro:   { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.12)', emoji: '🟣' },
  small:   { color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.12)',  emoji: '🔵' },
  mid:     { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)',  emoji: '🟡' },
  whale:   { color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)',  emoji: '🟢' },
  unknown: { color: '#8B92A8', bg: 'rgba(139, 146, 168, 0.12)', emoji: '⚪' },
};

export function TierBadge({ tier, showEmoji = false }: { tier: string; showEmoji?: boolean }) {
  const config = tierConfig[tier?.toLowerCase()] || tierConfig.unknown;
  return (
    <span
      className="badge"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}20` }}
    >
      {showEmoji && <span className="text-[10px]">{config.emoji}</span>}
      {tier?.toUpperCase() || 'N/A'}
    </span>
  );
}

// ── Style Badge ──────────────────────────────────
const styleConfig: Record<string, { color: string; bg: string; icon: string }> = {
  degen:   { color: '#F472B6', bg: 'rgba(244, 114, 182, 0.12)', icon: '🎰' },
  sniper:  { color: '#F97316', bg: 'rgba(249, 115, 22, 0.12)',  icon: '🎯' },
  grinder: { color: '#818CF8', bg: 'rgba(129, 140, 248, 0.12)', icon: '⚙️' },
  whale:   { color: '#22D3EE', bg: 'rgba(34, 211, 238, 0.12)',  icon: '🐋' },
  unknown: { color: '#8B92A8', bg: 'rgba(139, 146, 168, 0.12)', icon: '❓' },
};

export function StyleBadge({ style, showIcon = false }: { style: string; showIcon?: boolean }) {
  const config = styleConfig[style?.toLowerCase()] || styleConfig.unknown;
  return (
    <span
      className="badge"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}20` }}
    >
      {showIcon && <span className="text-[10px]">{config.icon}</span>}
      {style?.toUpperCase() || 'N/A'}
    </span>
  );
}

// ── Category Badge ───────────────────────────────
const categoryConfig: Record<string, { color: string; bg: string; icon: LucideIcon }> = {
  crypto:          { color: '#F7931A', bg: 'rgba(247, 147, 26, 0.12)',  icon: Gem },
  politics:        { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)',  icon: Landmark },
  geopolitics:     { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)',   icon: Globe },
  trump:           { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)',   icon: Flag },
  'sports-nba':    { color: '#C4740E', bg: 'rgba(196, 116, 14, 0.12)', icon: Dribbble },
  'sports-soccer': { color: '#22C55E', bg: 'rgba(34, 197, 94, 0.12)',  icon: Trophy },
  'sports-other':  { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', icon: Trophy },
  esports:         { color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)',  icon: Gamepad2 },
  'fed-macro':     { color: '#EAB308', bg: 'rgba(234, 179, 8, 0.12)',  icon: TrendingUp },
  stocks:          { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', icon: BarChart3 },
  entertainment:   { color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)', icon: Clapperboard },
  'tech-ai':       { color: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)', icon: Cpu },
  weather:         { color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)', icon: CloudSun },
  science:         { color: '#A855F7', bg: 'rgba(168, 85, 247, 0.12)', icon: Beaker },
  other:           { color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.12)', icon: Layers },
  // Legacy categories (backward compat)
  sports:          { color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', icon: Trophy },
  culture:         { color: '#F472B6', bg: 'rgba(244, 114, 182, 0.12)', icon: Clapperboard },
  finance:         { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', icon: TrendingUp },
  mentions:        { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.12)', icon: Megaphone },
};

const categoryLabels: Record<string, string> = {
  'sports-nba': 'NBA',
  'sports-soccer': 'SOCCER',
  'sports-other': 'SPORTS',
  'fed-macro': 'FED & MACRO',
  'tech-ai': 'TECH & AI',
};

export function CategoryBadge({ category }: { category: string }) {
  const key = category?.toLowerCase();
  const config = categoryConfig[key];
  if (!config) return null;
  const Icon = config.icon;
  const label = categoryLabels[key] || key?.toUpperCase();
  return (
    <span
      className="badge"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}20` }}
    >
      <Icon size={11} strokeWidth={2} />
      {label}
    </span>
  );
}

// ── Status Badge ─────────────────────────────────
const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active:      { color: '#00F0A0', bg: 'rgba(0, 240, 160, 0.12)', label: 'ACTIVE' },
  won:         { color: '#00F0A0', bg: 'rgba(0, 240, 160, 0.12)', label: 'TARGET HIT' },
  hit_target:  { color: '#00F0A0', bg: 'rgba(0, 240, 160, 0.12)', label: 'TARGET HIT' },
  lost:        { color: '#FF4060', bg: 'rgba(255, 64, 96, 0.12)', label: 'LOST' },
  stopped:     { color: '#F0B000', bg: 'rgba(240, 176, 0, 0.12)', label: 'STOPPED' },
  stopped_out: { color: '#F0B000', bg: 'rgba(240, 176, 0, 0.12)', label: 'STOPPED' },
  expired:     { color: '#8B92A8', bg: 'rgba(139, 146, 168, 0.12)', label: 'EXPIRED' },
};

export function StatusBadge({ status }: { status: string }) {
  const key = status?.toLowerCase();
  const config = statusConfig[key] || statusConfig.expired;
  return (
    <span
      className="badge"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}20` }}
    >
      {key === 'active' && <span className="live-dot mr-0.5" style={{ width: 6, height: 6 }} />}
      {config.label}
    </span>
  );
}

// ── Points Tier Badge ────────────────────────────
const pointsTierConfig: Record<string, { color: string; bg: string; emoji: string }> = {
  diamond: { color: '#00D9FF', bg: 'rgba(0, 217, 255, 0.12)', emoji: '💎' },
  gold:    { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', emoji: '🏆' },
  silver:  { color: '#C0CFDA', bg: 'rgba(192, 207, 218, 0.12)', emoji: '🥈' },
  bronze:  { color: '#CD7F32', bg: 'rgba(205, 127, 50, 0.12)', emoji: '🥉' },
};

export function PointsTierBadge({ tier }: { tier: string }) {
  const config = pointsTierConfig[tier?.toLowerCase()] || pointsTierConfig.bronze;
  return (
    <span
      className="badge"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}20` }}
    >
      <span className="text-[10px]">{config.emoji}</span>
      {tier?.toUpperCase() || 'BRONZE'}
    </span>
  );
}

// ── Direction Badge ──────────────────────────────
export function DirectionBadge({ direction }: { direction: string }) {
  const isYes = direction?.toUpperCase() === 'YES';
  return (
    <span
      className="badge font-mono"
      style={{
        color: isYes ? '#00F0A0' : '#FF4060',
        background: isYes ? 'rgba(0, 240, 160, 0.12)' : 'rgba(255, 64, 96, 0.12)',
        border: `1px solid ${isYes ? '#00F0A020' : '#FF406020'}`,
      }}
    >
      {isYes ? '▲' : '▼'} {direction?.toUpperCase()}
    </span>
  );
}
