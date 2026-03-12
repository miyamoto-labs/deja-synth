'use client';

import { motion } from 'framer-motion';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterBar({ label, options, value, onChange, className = '' }: FilterBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-text-muted uppercase tracking-wider mr-1">
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`filter-pill ${value === opt.value ? 'active' : ''}`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className="ml-1 text-[10px] opacity-60">{opt.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Sort dropdown
interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SortDropdown({ options, value, onChange, className = '' }: SortDropdownProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-ep-card border border-ep-border rounded-lg px-3 py-1.5 text-sm text-text-primary
                   focus:outline-none focus:border-accent/50 cursor-pointer appearance-none
                   pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%238B92A8%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
