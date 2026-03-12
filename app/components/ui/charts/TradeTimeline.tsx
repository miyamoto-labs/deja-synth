'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Trade {
  id: string;
  side: string;
  amount: number;
  created_at: string;
}

interface TradeTimelineProps {
  trades: Trade[];
}

interface DayData {
  date: string;
  label: string;
  buy: number;
  sell: number;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function aggregateByDay(trades: Trade[]): DayData[] {
  const map = new Map<string, { buy: number; sell: number }>();

  for (const t of trades) {
    const day = new Date(t.created_at).toISOString().slice(0, 10);
    const entry = map.get(day) || { buy: 0, sell: 0 };
    const amount = Number(t.amount) || 0;
    if (t.side === 'BUY') {
      entry.buy += amount;
    } else {
      entry.sell += amount;
    }
    map.set(day, entry);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      label: formatDateShort(date),
      buy: Math.round(vals.buy * 100) / 100,
      sell: Math.round(vals.sell * 100) / 100,
    }));
}

function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const buy = payload.find((p: any) => p.dataKey === 'buy')?.value || 0;
  const sell = payload.find((p: any) => p.dataKey === 'sell')?.value || 0;
  return (
    <div className="glass-bright rounded-lg px-3 py-2 text-xs shadow-lg border border-ep-border">
      <p className="font-medium text-text-primary mb-1">{label}</p>
      {buy > 0 && (
        <p className="font-mono text-profit">
          Buy: ${buy.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      )}
      {sell > 0 && (
        <p className="font-mono text-loss">
          Sell: ${sell.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      )}
      <p className="font-mono text-text-muted mt-0.5">
        Total: ${(buy + sell).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export function TradeTimeline({ trades }: TradeTimelineProps) {
  const dayData = useMemo(() => aggregateByDay(trades), [trades]);

  if (dayData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-text-muted">
        No trade activity yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dayData} barCategoryGap="20%">
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(30, 34, 53, 0.8)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: '#505672', fontSize: 11 }}
          axisLine={{ stroke: '#1E2235' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#505672', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
          width={50}
        />
        <Tooltip
          content={<TimelineTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar
          dataKey="buy"
          stackId="a"
          fill="#00F0A0"
          radius={[0, 0, 0, 0]}
          name="Buy"
        />
        <Bar
          dataKey="sell"
          stackId="a"
          fill="#FF4060"
          radius={[4, 4, 0, 0]}
          name="Sell"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
