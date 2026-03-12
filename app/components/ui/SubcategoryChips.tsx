'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface SubcategoryChipsProps {
  categoryLabel: string;
  subcategories: { id: string; label: string }[];
  activeSubcategory: string; // "" = all
  onSelect: (id: string) => void;
  color: string;
  counts?: Record<string, number>;
}

export function SubcategoryChips({
  categoryLabel,
  subcategories,
  activeSubcategory,
  onSelect,
  color,
  counts,
}: SubcategoryChipsProps) {
  const chips = [{ id: "", label: `All ${categoryLabel}` }, ...subcategories];

  return (
    <AnimatePresence mode="wait">
      {subcategories.length > 0 && (
        <motion.div
          key={categoryLabel}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {chips.map((chip, i) => {
              const isActive = activeSubcategory === chip.id;
              const count = chip.id ? counts?.[chip.id] : undefined;
              return (
                <motion.button
                  key={chip.id || 'all'}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  onClick={() => onSelect(chip.id)}
                  className="filter-pill whitespace-nowrap flex items-center gap-1"
                  style={
                    isActive
                      ? {
                          borderColor: `${color}60`,
                          background: `${color}14`,
                          color: color,
                        }
                      : undefined
                  }
                >
                  {chip.label}
                  {count !== undefined && count > 0 && (
                    <span className="text-[10px] opacity-60">{count}</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
