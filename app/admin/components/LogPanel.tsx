'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface AuditEntry {
  event_type: string;
  event_data: any;
  source: string;
  created_at: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  error: { bg: 'bg-loss/15', text: 'text-loss' },
  warning: { bg: 'bg-yellow-400/15', text: 'text-yellow-400' },
  copy_signal_onchain: { bg: 'bg-accent/15', text: 'text-accent' },
  scan_cycle: { bg: 'bg-blue-400/15', text: 'text-blue-400' },
  conviction_scoring: { bg: 'bg-purple-400/15', text: 'text-purple-400' },
  trader_scan: { bg: 'bg-cyan-400/15', text: 'text-cyan-400' },
};

export function LogPanel() {
  const [logText, setLogText] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [subTab, setSubTab] = useState<'stdout' | 'audit'>('stdout');
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bot');
      if (res.ok) {
        const data = await res.json();
        setLogText(data.log || '');
        setAuditLogs(data.auditLogs || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [isLive, fetchLogs]);

  // Auto-scroll stdout to bottom
  useEffect(() => {
    if (subTab === 'stdout' && isLive && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logText, subTab, isLive]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setSubTab('stdout')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === 'stdout' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Stdout
          </button>
          <button
            onClick={() => setSubTab('audit')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === 'audit' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Audit Log
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
              isLive
                ? 'bg-profit/15 text-profit border border-profit/20'
                : 'bg-white/5 text-text-muted border border-white/10'
            }`}
          >
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
          <button
            onClick={fetchLogs}
            className="p-1.5 rounded hover:bg-white/5 text-text-muted hover:text-text-secondary transition"
            title="Refresh"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {subTab === 'stdout' ? (
        <div className="ep-card border border-ep-border/50 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-xs text-text-muted animate-pulse">Loading logs...</div>
          ) : logText ? (
            <pre
              ref={preRef}
              className="p-4 text-[11px] font-mono leading-relaxed text-green-400/90 bg-[#0a0f14] max-h-[600px] overflow-y-auto whitespace-pre-wrap break-all"
            >
              {logText}
              <div ref={logEndRef} />
            </pre>
          ) : (
            <div className="p-8 text-center text-xs text-text-muted">
              No stdout output. Start the bot to see logs.
            </div>
          )}
        </div>
      ) : (
        <div className="ep-card border border-ep-border/50 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-xs text-text-muted animate-pulse">Loading audit log...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">No audit log entries</div>
          ) : (
            <div className="divide-y divide-ep-border/30 max-h-[600px] overflow-y-auto">
              {auditLogs.map((entry, i) => {
                const colors = EVENT_COLORS[entry.event_type] || { bg: 'bg-white/5', text: 'text-text-muted' };
                const msg = typeof entry.event_data === 'string'
                  ? entry.event_data
                  : JSON.stringify(entry.event_data, null, 0).slice(0, 300);

                return (
                  <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-xs hover:bg-white/[0.02]">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${colors.bg} ${colors.text}`}>
                      {entry.event_type.toUpperCase().replace(/_/g, ' ').slice(0, 20)}
                    </span>
                    {entry.source && (
                      <span className="shrink-0 text-[9px] font-mono text-text-muted bg-white/5 px-1 py-0.5 rounded">
                        {entry.source}
                      </span>
                    )}
                    <span className="text-text-secondary flex-1 break-all font-mono text-[10px] leading-relaxed">
                      {msg}
                    </span>
                    <span className="shrink-0 text-text-muted font-mono text-[9px]">
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
