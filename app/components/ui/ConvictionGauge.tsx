'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ConvictionGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function getConvictionColor(score: number) {
  if (score >= 80) return { color: '#00F0A0', bg: 'rgba(0, 240, 160, 0.12)', label: 'HIGH' };
  if (score >= 60) return { color: '#F0B000', bg: 'rgba(240, 176, 0, 0.12)', label: 'MED' };
  return { color: '#FF4060', bg: 'rgba(255, 64, 96, 0.12)', label: 'LOW' };
}

export function ConvictionGauge({
  score,
  size = 'md',
  showLabel = true,
  className = '',
}: ConvictionGaugeProps) {
  const [mounted, setMounted] = useState(false);
  const { color, bg, label } = getConvictionColor(score);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dimensions = {
    sm: { width: 48, height: 48, stroke: 3, fontSize: 'text-xs', labelSize: 'text-[8px]' },
    md: { width: 72, height: 72, stroke: 4, fontSize: 'text-lg', labelSize: 'text-[10px]' },
    lg: { width: 100, height: 100, stroke: 5, fontSize: 'text-2xl', labelSize: 'text-xs' },
  };

  const d = dimensions[size];
  const radius = (d.width - d.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = d.width / 2;

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <svg width={d.width} height={d.height} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={d.stroke}
        />
        {/* Animated fill */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={d.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: mounted ? offset : circumference }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          style={{
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      {/* Score number in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold ${d.fontSize}`} style={{ color }}>
          {score}
        </span>
        {showLabel && size !== 'sm' && (
          <span className={`${d.labelSize} font-semibold tracking-wider opacity-60`} style={{ color }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// Simple bar variant
export function ConvictionBar({
  score,
  className = '',
}: {
  score: number;
  className?: string;
}) {
  const { color } = getConvictionColor(score);

  return (
    <div className={`gauge-track w-full ${className}`}>
      <motion.div
        className="gauge-fill"
        style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  );
}
