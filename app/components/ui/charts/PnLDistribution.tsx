'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

interface Position {
  id: string;
  question: string;
  pnl: number;
  pnlPercent: number;
}

interface PnLDistributionProps {
  positions: Position[];
}

function PnLTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-bright rounded-lg px-3 py-2 text-xs shadow-lg border border-ep-border">
      <p className="font-medium text-text-primary mb-1 max-w-[220px] leading-snug">
        {d.fullName}
      </p>
      <p className={`font-mono font-bold ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
        {d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(2)}
      </p>
      <p className={`font-mono ${d.pnl >= 0 ? 'text-profit/70' : 'text-loss/70'}`}>
        {d.pnlPercent >= 0 ? '+' : ''}
        {d.pnlPercent.toFixed(1)}%
      </p>
    </div>
  );
}

export function PnLDistribution({ positions }: PnLDistributionProps) {
  const chartData = useMemo(() => {
    return positions
      .filter((p) => Math.abs(p.pnl) > 0.001)
      .sort((a, b) => b.pnl - a.pnl)
      .map((p) => ({
        name:
          p.question.length > 22
            ? p.question.slice(0, 22) + '...'
            : p.question,
        fullName: p.question,
        pnl: Math.round(p.pnl * 100) / 100,
        pnlPercent: p.pnlPercent,
      }));
  }, [positions]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-text-muted">
        No P&L data to display
      </div>
    );
  }

  const chartHeight = Math.max(180, chartData.length * 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
      >
        <XAxis
          type="number"
          tick={{ fill: '#505672', fontSize: 11 }}
          axisLine={{ stroke: '#1E2235' }}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#8B92A8', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <ReferenceLine x={0} stroke="#1E2235" strokeWidth={1} />
        <Tooltip
          content={<PnLTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="pnl" radius={4} barSize={18} animationDuration={800}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.pnl >= 0 ? '#00F0A0' : '#FF4060'}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
