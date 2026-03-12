"use client";

import { useEffect, useState } from "react";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="relative flex h-3 w-3">
      {ok && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={`relative inline-flex h-3 w-3 rounded-full ${
          ok ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
    </span>
  );
}

export default function SystemPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard/system");
        setData(await res.json());
      } catch (err) {
        console.error("Failed to load system data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-400">
        <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading system status...
      </div>
    );
  }

  const isRecent = data?.last_scan
    ? Date.now() - new Date(data.last_scan).getTime() < 600000 // Within 10 min
    : false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="mt-1 text-sm text-gray-400">
          Engine status, scan metrics, and diagnostics
        </p>
      </div>

      {/* Engine Status */}
      <div className="rounded-xl border border-white/5 bg-ep-card p-6">
        <div className="flex items-center gap-3">
          <StatusDot ok={isRecent} />
          <div>
            <h3 className="font-semibold">
              Engine {isRecent ? "Running" : "Idle"}
            </h3>
            <p className="text-sm text-gray-400">
              Last scan: {timeAgo(data?.last_scan)}
            </p>
          </div>
        </div>

        {data?.last_scan_data && (
          <div className="mt-4 flex gap-6 text-sm text-gray-400">
            <span>
              Input: <span className="text-white">{data.last_scan_data.input || 0}</span> opportunities
            </span>
            <span>
              Output: <span className="text-accent">{data.last_scan_data.output || 0}</span> picks
            </span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Markets Tracked", value: data?.markets_tracked || 0, icon: "M" },
          { label: "Opportunities", value: data?.opportunities_detected || 0, icon: "O" },
          { label: "Picks Generated", value: data?.picks_generated || 0, icon: "P" },
          { label: "Price Snapshots", value: data?.price_snapshots || 0, icon: "S" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-white/5 bg-ep-card p-4"
          >
            <p className="text-xs uppercase tracking-wider text-gray-500">{m.label}</p>
            <p className="mt-2 text-2xl font-bold">{m.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Recent Errors */}
      <div>
        <h2 className="text-lg font-semibold">Recent Logs</h2>
        {data?.recent_errors && data.recent_errors.length > 0 ? (
          <div className="mt-4 space-y-2">
            {data.recent_errors.map((e: any, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-white/5 bg-ep-card px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      e.event_type === "error"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {e.event_type}
                  </span>
                  <span className="text-xs text-gray-500">{timeAgo(e.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  {typeof e.event_data === "string"
                    ? e.event_data
                    : JSON.stringify(e.event_data).slice(0, 200)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No recent errors. All systems operational.</p>
        )}
      </div>
    </div>
  );
}
