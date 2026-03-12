'use client';

import { useEffect, useState, useCallback } from 'react';

interface Metrics {
  marketsTracked: number;
  activePicks: number;
  picks7d: number;
  trackedTraders: number;
  copySignals24h: number;
  recentErrors: { event_type: string; event_data: any; source: string; created_at: string }[];
  lastScanTime: string | null;
  winRate: number;
  won: number;
  lost: number;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="ep-card p-4 border border-ep-border/50">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono text-text-primary">{value}</div>
      {sub && <div className="text-[10px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function OverviewPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/metrics');
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ep-card p-4 border border-ep-border/50">
              <div className="h-3 w-20 bg-white/5 rounded animate-pulse mb-2" />
              <div className="h-7 w-16 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return <div className="ep-card p-8 text-center text-text-muted">Failed to load metrics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Markets Tracked" value={metrics.marketsTracked} />
        <MetricCard label="Active Picks" value={metrics.activePicks} sub={`${metrics.picks7d} generated (7d)`} />
        <MetricCard label="Tracked Traders" value={metrics.trackedTraders} />
        <MetricCard label="Copy Signals (24h)" value={metrics.copySignals24h} />
        <MetricCard label="Win Rate" value={`${metrics.winRate}%`} sub={`${metrics.won}W / ${metrics.lost}L`} />
        <MetricCard
          label="Last Scan"
          value={metrics.lastScanTime ? timeAgo(metrics.lastScanTime) : 'Never'}
          sub={metrics.lastScanTime ? new Date(metrics.lastScanTime).toLocaleTimeString() : ''}
        />
      </div>

      {/* Recent Errors */}
      <div className="ep-card border border-ep-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-ep-border/50 flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">Recent Errors</span>
          <span className="text-[10px] font-mono text-text-muted">{metrics.recentErrors.length}</span>
        </div>
        {metrics.recentErrors.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-text-muted">No recent errors</div>
        ) : (
          <div className="divide-y divide-ep-border/30 max-h-[300px] overflow-y-auto">
            {metrics.recentErrors.map((err, i) => {
              const msg = typeof err.event_data === 'string'
                ? err.event_data
                : JSON.stringify(err.event_data).slice(0, 200);
              return (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-xs">
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-loss/15 text-loss">ERROR</span>
                  <span className="text-text-secondary flex-1 break-all">{msg}</span>
                  <span className="shrink-0 text-text-muted font-mono">{timeAgo(err.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
