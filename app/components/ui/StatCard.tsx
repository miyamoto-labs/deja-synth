'use client';

import { motion } from 'framer-motion';
import { LiveNumber } from './LiveNumber';

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: number; // percentage change
  icon?: React.ReactNode;
  colorize?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  trend,
  icon,
  colorize = false,
  className = '',
}: StatCardProps) {
  return (
    <motion.div
      className={`ep-card p-4 ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <LiveNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          colorize={colorize}
          size="lg"
        />
        {trend !== undefined && trend !== 0 && (
          <span
            className={`text-xs font-medium mb-1 ${
              trend > 0 ? 'text-profit' : 'text-loss'
            }`}
          >
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}
