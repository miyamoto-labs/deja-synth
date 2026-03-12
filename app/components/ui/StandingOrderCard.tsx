"use client";

import { useState } from "react";

interface StandingOrder {
  id: string;
  min_conviction: number;
  max_conviction: number;
  direction_filter: string | null;
  category_filter: string[] | null;
  amount: number;
  daily_limit: number;
  total_limit: number | null;
  active: boolean;
  paused_until: string | null;
  pause_reason: string | null;
  label: string | null;
  created_at: string;
  todayExecutions: number;
  totalExecutions: number;
}

interface StandingOrderCardProps {
  order: StandingOrder;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function StandingOrderCard({ order, onToggle, onEdit, onDelete }: StandingOrderCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isPaused = order.paused_until && new Date(order.paused_until) > new Date();
  const progressPct = order.daily_limit > 0
    ? Math.min(100, (order.todayExecutions / order.daily_limit) * 100)
    : 0;

  const convictionLabel = order.min_conviction === order.max_conviction
    ? `${order.min_conviction}%`
    : order.max_conviction === 100
      ? `${order.min_conviction}%+`
      : `${order.min_conviction}-${order.max_conviction}%`;

  return (
    <div className={`ep-card p-5 space-y-4 ${!order.active ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Lightning icon */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isPaused ? "bg-yellow-500/10" : order.active ? "bg-accent/10" : "bg-ep-border/30"
          }`}>
            <svg className={`w-5 h-5 ${
              isPaused ? "text-yellow-500" : order.active ? "text-accent" : "text-text-muted"
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {order.label || "Standing Order"}
            </h3>
            <p className="text-xs text-text-muted">
              Created {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Status badge + toggle */}
        <div className="flex items-center gap-2">
          {isPaused ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500/10 text-yellow-500">
              PAUSED
            </span>
          ) : order.active ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent">
              ACTIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ep-border/50 text-text-muted">
              OFF
            </span>
          )}

          {/* Toggle switch */}
          <button
            onClick={() => onToggle(!order.active)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              order.active ? "bg-accent" : "bg-ep-border"
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              order.active ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>
      </div>

      {/* Pause warning */}
      {isPaused && order.pause_reason && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
          <svg className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-yellow-500/90">{order.pause_reason}</p>
        </div>
      )}

      {/* Rule details */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ep-border/20 text-xs">
          <span className="text-text-muted">Conviction</span>
          <span className="font-semibold text-text-primary">&ge; {convictionLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ep-border/20 text-xs">
          <span className="text-text-muted">Amount</span>
          <span className="font-semibold text-text-primary">${order.amount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ep-border/20 text-xs">
          <span className="text-text-muted">Daily</span>
          <span className="font-semibold text-text-primary">{order.daily_limit}/day</span>
        </div>
        {order.direction_filter && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
            order.direction_filter === "YES" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}>
            <span className="font-semibold">{order.direction_filter} only</span>
          </div>
        )}
        {order.category_filter && order.category_filter.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ep-border/20 text-xs">
            <span className="text-text-muted">Categories:</span>
            <span className="font-semibold text-text-primary">{order.category_filter.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Progress bar — today's executions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">
            Today: {order.todayExecutions}/{order.daily_limit} trades
          </span>
          <span className="text-text-muted">
            Total: {order.totalExecutions} executed
          </span>
        </div>
        <div className="h-1.5 bg-ep-border/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-ep-border/20">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-accent hover:bg-accent/5 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Edit
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-red-400">Delete this rule?</span>
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              className="px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded text-xs font-medium text-text-muted hover:text-text-primary transition"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-red-400 hover:bg-red-500/5 transition ml-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
