'use client';

import { useEffect, useState, useCallback } from 'react';

interface BotStatus {
  status: 'stopped' | 'running' | 'crashed';
  mode: string;
  pid?: number;
  startedAt?: string;
  stoppedAt?: string;
  uptimeSeconds?: number;
  exitCode?: number | null;
  error?: string;
}

const MODES = [
  { id: 'full', label: 'Full Pipeline', desc: 'Scan + Score + Broadcast + On-Chain Monitor' },
  { id: 'onchain-only', label: 'On-Chain Only', desc: 'Real-time copy trade detection' },
  { id: 'scan-only', label: 'Scan Only', desc: 'One market scan cycle, then exit' },
  { id: 'shadow-only', label: 'Shadow Only', desc: 'Trader scanning + copy detection' },
  { id: 'resolve-only', label: 'Resolve Only', desc: 'Check active picks for W/L' },
];

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remainMins}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export function BotControlPanel() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [selectedMode, setSelectedMode] = useState('onchain-only');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'restart' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bot');
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data);
        // Sync selected mode with running mode
        if (data.status === 'running' && data.mode && data.mode !== 'unknown') {
          setSelectedMode(data.mode);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActing(true);
    setConfirmAction(null);
    try {
      const res = await fetch('/api/admin/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, mode: selectedMode }),
      });
      const data = await res.json();
      if (data.success) {
        setToast(`Command "${action}" queued — watcher will execute shortly`);
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast(`Error: ${data.error || 'Unknown error'}`);
        setTimeout(() => setToast(null), 5000);
      }
      // Refresh status after a short delay
      setTimeout(fetchStatus, 2000);
    } catch {} finally {
      setActing(false);
    }
  };

  const isRunning = botStatus?.status === 'running';
  const isStopped = botStatus?.status === 'stopped' || botStatus?.status === 'crashed';
  const statusColor = isRunning ? 'text-profit' : botStatus?.status === 'crashed' ? 'text-loss' : 'text-text-muted';
  const statusBg = isRunning ? 'bg-profit' : botStatus?.status === 'crashed' ? 'bg-loss' : 'bg-text-muted';

  if (loading) {
    return (
      <div className="ep-card p-6 border border-ep-border/50">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-white/10 animate-pulse" />
          <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="ep-card p-5 border border-ep-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${statusBg} ${isRunning ? 'animate-pulse' : ''}`} />
            <span className={`text-lg font-bold font-display ${statusColor}`}>
              {botStatus?.status === 'running' ? 'Running' : botStatus?.status === 'crashed' ? 'Crashed' : 'Stopped'}
            </span>
            {isRunning && botStatus?.mode && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/30">
                {botStatus.mode.toUpperCase()}
              </span>
            )}
          </div>
          {isRunning && botStatus?.uptimeSeconds !== undefined && (
            <span className="text-xs font-mono text-text-muted">
              Up {formatUptime(botStatus.uptimeSeconds)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-text-muted">PID</span>
            <div className="font-mono text-text-primary">{botStatus?.pid || '—'}</div>
          </div>
          <div>
            <span className="text-text-muted">Started</span>
            <div className="font-mono text-text-primary">
              {botStatus?.startedAt ? new Date(botStatus.startedAt).toLocaleTimeString() : '—'}
            </div>
          </div>
          <div>
            <span className="text-text-muted">Mode</span>
            <div className="font-mono text-text-primary">{botStatus?.mode || '—'}</div>
          </div>
          {botStatus?.error && (
            <div>
              <span className="text-text-muted">Error</span>
              <div className="font-mono text-loss">{botStatus.error}</div>
            </div>
          )}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="ep-card p-5 border border-ep-border/50">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-3">Bot Mode</div>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                selectedMode === m.id
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-white/[0.02] border-white/10 text-text-secondary hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={m.id}
                checked={selectedMode === m.id}
                onChange={() => setSelectedMode(m.id)}
                className="accent-accent"
              />
              <div>
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-[10px] text-text-muted">{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isStopped && (
          <button
            onClick={() => handleAction('start')}
            disabled={acting}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-profit text-black hover:bg-profit/90 disabled:opacity-50 transition"
          >
            {acting ? 'Starting...' : `Start (${MODES.find(m => m.id === selectedMode)?.label})`}
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={() => setConfirmAction('stop')}
              disabled={acting}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-loss/15 text-loss border border-loss/30 hover:bg-loss/25 disabled:opacity-50 transition"
            >
              Stop
            </button>
            <button
              onClick={() => setConfirmAction('restart')}
              disabled={acting}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/25 disabled:opacity-50 transition"
            >
              Restart
            </button>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`p-3 rounded-xl text-sm font-medium border ${
          toast.startsWith('Error')
            ? 'bg-loss/10 border-loss/30 text-loss'
            : 'bg-accent/10 border-accent/30 text-accent'
        }`}>
          {toast}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative ep-card p-6 border border-ep-border max-w-sm w-full">
            <h3 className="font-display font-bold text-lg text-text-primary mb-2">
              {confirmAction === 'stop' ? 'Stop Bot?' : 'Restart Bot?'}
            </h3>
            <p className="text-sm text-text-muted mb-4">
              {confirmAction === 'stop'
                ? 'This will send SIGTERM to the bot process. It will stop detecting trades.'
                : `This will stop and restart the bot in "${selectedMode}" mode.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-text-muted hover:text-text-secondary hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(confirmAction)}
                disabled={acting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 ${
                  confirmAction === 'stop'
                    ? 'bg-loss text-white hover:bg-loss/90'
                    : 'bg-yellow-400 text-black hover:bg-yellow-400/90'
                }`}
              >
                {acting ? 'Working...' : confirmAction === 'stop' ? 'Stop' : 'Restart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
