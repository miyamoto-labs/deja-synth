'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Landmark,
  Trophy,
  Gem,
  Clapperboard,
  TrendingUp,
  Dices,
  type LucideIcon,
} from 'lucide-react';
import { PickCard } from './PickCard';

const SECTION_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  politics: Landmark,
  sports: Trophy,
  crypto: Gem,
  culture: Clapperboard,
  finance: TrendingUp,
  wild: Dices,
};

interface Category {
  id: string;
  label: string;
  emoji: string;
}

interface CategorySectionProps {
  category: Category;
  picks: any[];
  defaultOpen?: boolean;
  isWild?: boolean;
  speculativeIds?: Set<string>;
}

export function CategorySection({ category, picks, defaultOpen = true, isWild = false, speculativeIds }: CategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (picks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Section header - collapsible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 group"
      >
        {SECTION_ICONS[category.id] ? (
          (() => { const Icon = SECTION_ICONS[category.id]; return <Icon size={18} strokeWidth={2} className="text-text-secondary" />; })()
        ) : (
          <span className="text-lg">{category.emoji}</span>
        )}
        <h2 className="font-display text-sm font-bold text-text-primary uppercase tracking-wider">
          {category.label}
        </h2>
        <span className="text-xs text-text-muted font-medium px-1.5 py-0.5 rounded-md bg-ep-surface/60">
          {picks.length}
        </span>

        {/* Wild picks subtitle */}
        {isWild && (
          <span className="text-[10px] text-purple-400 font-medium ml-1">
            For the bold
          </span>
        )}

        <div className="flex-1 border-b border-ep-border/30 mx-2" />

        <svg
          className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Wild picks warning */}
      {isWild && open && (
        <div className="flex items-center gap-2 text-[11px] text-purple-400/80 bg-purple-500/5 border border-purple-500/10 rounded-lg px-3 py-2">
          <span>⚠️</span>
          <span>Entertainment value, high risk. These picks are on unusual or low-volume markets.</span>
        </div>
      )}

      {/* Picks list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {picks.map((pick: any) => (
                <PickCard
                  key={pick.id}
                  pick={pick}
                  variant="grid"
                  isSpeculative={isWild || speculativeIds?.has(pick.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
