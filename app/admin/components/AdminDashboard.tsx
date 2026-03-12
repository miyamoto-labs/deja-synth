'use client';

import { useState } from 'react';
import { OverviewPanel } from './OverviewPanel';
import { BotControlPanel } from './BotControlPanel';
import { LogPanel } from './LogPanel';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'bot', label: 'Bot Control', icon: '🤖' },
  { id: 'logs', label: 'Logs', icon: '📋' },
] as const;

type TabId = typeof TABS[number]['id'];

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<TabId>('overview');

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    onLogout();
  };

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                tab === t.id
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text-secondary hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-loss hover:bg-loss/10 border border-white/10 transition"
        >
          Logout
        </button>
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewPanel />}
      {tab === 'bot' && <BotControlPanel />}
      {tab === 'logs' && <LogPanel />}
    </div>
  );
}
