'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = [
  '#00F0A0', // accent green
  '#60A5FA', // blue
  '#F0B000', // amber
  '#A78BFA', // violet
  '#F472B6', // pink
  '#22D3EE', // cyan
  '#F97316', // orange
  '#34D399', // emerald
];

interface Position {
  id: string;
  question: string;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PortfolioCompositionProps {
  positions: Position[];
  totalValue: number;
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-bright rounded-lg px-3 py-2 text-xs shadow-lg border border-ep-border">
      <p className="font-medium text-text-primary mb-1 max-w-[200px] leading-snug">
        {d.fullName}
      </p>
      <p className="font-mono text-text-secondary">
        ${d.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
      <p className={`font-mono ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
        {d.pnl >= 0 ? '+' : ''}
        {d.pnlPercent.toFixed(1)}%
      </p>
    </div>
  );
}

export function PortfolioComposition({ positions, totalValue }: PortfolioCompositionProps) {
  const chartData = useMemo(() => {
    return positions
      .filter((p) => p.currentValue > 0)
      .sort((a, b) => b.currentValue - a.currentValue)
      .map((p) => ({
        name: p.question.length > 28 ? p.question.slice(0, 28) + '...' : p.question,
        fullName: p.question,
        value: p.currentValue,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent,
      }));
  }, [positions]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm text-text-muted">
        No positions to display
      </div>
    );
  }

  return (
    <div>
      {/* Chart with center overlay */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              animationBegin={200}
              animationDuration={800}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">
            Total
          </span>
          <span className="font-mono text-lg font-bold text-text-primary">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
        {chartData.slice(0, 6).map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-[10px] text-text-muted truncate max-w-[120px]">
              {item.name}
            </span>
          </div>
        ))}
        {chartData.length > 6 && (
          <span className="text-[10px] text-text-muted">
            +{chartData.length - 6} more
          </span>
        )}
      </div>
    </div>
  );
}
