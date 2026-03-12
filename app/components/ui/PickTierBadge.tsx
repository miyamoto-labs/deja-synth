'use client';

import { motion } from 'framer-motion';

const tierConfig: Record<string, { emoji: string; color: string; bg: string; border: string; label: string; glow?: string }> = {
  S: { emoji: '🔥', color: '#FF4060', bg: 'rgba(255, 64, 96, 0.12)', border: 'rgba(255, 64, 96, 0.25)', label: 'Elite', glow: '0 0 12px rgba(255, 64, 96, 0.3)' },
  A: { emoji: '💎', color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.25)', label: 'Strong', glow: '0 0 8px rgba(96, 165, 250, 0.2)' },
  B: { emoji: '📈', color: '#00F0A0', bg: 'rgba(0, 240, 160, 0.12)', border: 'rgba(0, 240, 160, 0.25)', label: 'Decent' },
  C: { emoji: '🤔', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.25)', label: 'Marginal' },
  D: { emoji: '⚠️', color: '#8B92A8', bg: 'rgba(139, 146, 168, 0.12)', border: 'rgba(139, 146, 168, 0.25)', label: 'Weak' },
};

interface PickTierBadgeProps {
  tier: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function PickTierBadge({ tier, size = 'md', showLabel = true, className = '' }: PickTierBadgeProps) {
  const config = tierConfig[tier?.toUpperCase()] || tierConfig.D;
  const upperTier = tier?.toUpperCase() || '?';

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  };

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center font-bold rounded-lg whitespace-nowrap ${sizeClasses[size]} ${className}`}
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow: config.glow || 'none',
      }}
    >
      <span>{config.emoji}</span>
      <span>{upperTier}</span>
      {showLabel && size !== 'sm' && (
        <span className="font-medium opacity-70">{config.label}</span>
      )}
    </motion.span>
  );
}
