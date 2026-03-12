'use client';

import { motion } from 'framer-motion';
import {
  Flame,
  LayoutGrid,
  Landmark,
  Gem,
  Trophy,
  Clapperboard,
  TrendingUp,
  CloudSun,
  type LucideIcon,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hot: Flame,
  all: LayoutGrid,
  politics: Landmark,
  crypto: Gem,
  sports: Trophy,
  culture: Clapperboard,
  finance: TrendingUp,
  weather: CloudSun,
};

interface CategoryTileProps {
  id: string;
  label: string;
  emoji: string;
  color: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

export function CategoryTile({ id, label, emoji, color, count, isActive, onClick }: CategoryTileProps) {
  const Icon = CATEGORY_ICONS[id];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border px-4 py-2.5 sm:px-5 sm:py-3 min-w-[90px] sm:min-w-[110px] transition-colors relative overflow-hidden"
      style={{
        borderColor: isActive ? `${color}50` : 'var(--ep-border)',
        background: isActive ? `${color}10` : 'var(--ep-surface)',
        boxShadow: isActive ? `0 0 16px ${color}20` : 'none',
      }}
    >
      {/* Top accent border */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-opacity"
        style={{
          background: color,
          opacity: isActive ? 1 : 0,
        }}
      />

      {Icon ? (
        <Icon
          size={18}
          strokeWidth={isActive ? 2 : 1.5}
          style={{
            color: isActive ? color : 'var(--text-muted)',
            opacity: isActive ? 1 : 0.6,
          }}
        />
      ) : (
        <span className="text-lg sm:text-xl" style={{ filter: isActive ? 'none' : 'grayscale(0.4)' }}>
          {emoji}
        </span>
      )}
      <span
        className="text-[11px] sm:text-xs font-semibold whitespace-nowrap"
        style={{ color: isActive ? color : 'var(--text-secondary)' }}
      >
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          className="text-[9px] sm:text-[10px] font-mono px-1.5 py-px rounded-full"
          style={{
            background: isActive ? `${color}20` : 'rgba(255,255,255,0.06)',
            color: isActive ? color : 'var(--text-muted)',
          }}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}
