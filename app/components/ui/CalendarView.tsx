"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useMarketDetail } from "./MarketDetailDrawer";
import { CATEGORIES, CATEGORY_COLORS } from "@/app/dashboard/markets/constants";

// ── Types ────────────────────────────────────────
interface MarketOutcome {
  label: string;
  yes_price: number;
  market_id: string;
  yes_token: string;
  no_token: string;
  volume: number;
}

interface Market {
  market_id: string;
  condition_id?: string;
  question: string;
  category: string;
  subcategory?: string;
  is_multi?: boolean;
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  outcomes?: MarketOutcome[];
  outcome_count?: number;
  volume: number;
  volume_24h?: number;
  liquidity: number;
  end_date: string;
  hotness?: number;
}

// ── Helpers ──────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.emoji])
);

const DOW_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells: (Date | null)[] = [];

  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function groupByDay(markets: Market[]): Map<string, Market[]> {
  const groups = new Map<string, Market[]>();
  for (const m of markets) {
    if (!m.end_date) continue;
    const key = m.end_date.slice(0, 10);
    const list = groups.get(key) || [];
    list.push(m);
    groups.set(key, list);
  }
  // Sort each day's markets by volume desc
  for (const [, list] of groups) {
    list.sort((a, b) => b.volume - a.volume);
  }
  return groups;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function countBadgeColor(n: number): string {
  if (n <= 10) return "bg-profit/20 text-profit";
  if (n <= 50) return "bg-amber-500/20 text-amber-400";
  return "bg-orange-500/20 text-orange-400";
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// ── Flash price component ───────────────────────
function FlashPrice({ price, className }: { price: number; className?: string }) {
  const prev = useRef(price);
  const [flash, setFlash] = useState("");
  useEffect(() => {
    if (prev.current === price) return;
    setFlash(price > prev.current ? "animate-tick-up" : "animate-tick-down");
    prev.current = price;
    const t = setTimeout(() => setFlash(""), 600);
    return () => clearTimeout(t);
  }, [price]);
  return (
    <span className={`${className || ""} ${flash}`}>
      {Math.round(price * 100)}¢
    </span>
  );
}

// ── Props ────────────────────────────────────────
interface CalendarViewProps {
  markets: Market[];
  loading: boolean;
  month: Date;
  onMonthChange: (d: Date) => void;
  livePrices?: Record<string, number>;
}

// ── Component ────────────────────────────────────
export function CalendarView({ markets, loading, month, onMonthChange, livePrices }: CalendarViewProps) {
  const { openDetail } = useMarketDetail();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!expandedDay) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setExpandedDay(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedDay]);

  const year = month.getFullYear();
  const mo = month.getMonth();

  const cells = useMemo(() => getCalendarCells(year, mo), [year, mo]);
  const grouped = useMemo(() => groupByDay(markets), [markets]);

  const prevMonth = () => onMonthChange(new Date(year, mo - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, mo + 1, 1));
  const goToday = () => onMonthChange(new Date());

  const MAX_PREVIEWS = 3;

  return (
    <div className="space-y-3">
      {/* ── Controls ────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
          Event Expiry Calendar
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-ep-card border border-ep-border text-text-muted hover:text-text-primary hover:border-accent/40 transition"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-ep-surface/60 text-text-muted hover:text-text-primary transition"
              aria-label="Previous month"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10 4L6 8L10 12" />
              </svg>
            </button>
            <span className="text-sm font-medium text-text-primary min-w-[120px] text-center">
              {MONTHS[mo]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-ep-surface/60 text-text-muted hover:text-text-primary transition"
              aria-label="Next month"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 4L10 8L6 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Day-of-week header ──────────────── */}
      <div className="grid grid-cols-7 border-b border-ep-border/30">
        {DOW_FULL.map((d, i) => (
          <div key={i} className="py-1.5 text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{DOW_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* ── Calendar grid ───────────────────── */}
      {loading ? (
        <div className="grid grid-cols-7 gap-px bg-ep-border/20 rounded-lg overflow-hidden">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[80px] sm:min-h-[110px] bg-ep-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-ep-border/20 rounded-lg overflow-hidden">
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[110px] bg-ep-card/30" />;
            }

            const key = dateKey(date);
            const dayMarkets = grouped.get(key) || [];
            const today = isToday(date);
            const count = dayMarkets.length;

            return (
              <div
                key={key}
                className={`min-h-[80px] sm:min-h-[110px] p-1 sm:p-1.5 bg-ep-card flex flex-col transition ${
                  today ? "ring-1 ring-accent/50 bg-accent/5" : ""
                }`}
              >
                {/* Day number + count */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-[11px] font-mono ${
                      today ? "text-accent font-bold" : "text-text-muted"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded-full leading-none ${countBadgeColor(count)}`}
                    >
                      {count}
                    </span>
                  )}
                </div>

                {/* Market previews */}
                <div className="flex-1 space-y-px overflow-hidden">
                  {dayMarkets.slice(0, MAX_PREVIEWS).map((m) => {
                    const price = livePrices?.[m.yes_token] ?? m.yes_price;
                    const emoji = CATEGORY_EMOJI[m.category] || "📊";
                    const borderColor = CATEGORY_COLORS[m.category] || "#8B92A8";

                    return (
                      <button
                        key={m.market_id}
                        onClick={() => openDetail(m)}
                        className="w-full flex items-center gap-1 px-1 py-0.5 rounded text-left hover:bg-ep-surface/60 transition group"
                        style={{ borderLeft: `2px solid ${borderColor}` }}
                      >
                        <span className="text-[10px] leading-none shrink-0">{emoji}</span>
                        <span className="text-[10px] text-text-muted group-hover:text-text-primary truncate flex-1 leading-tight">
                          {truncate(m.question, 22)}
                        </span>
                        <FlashPrice price={price} className="text-[10px] font-mono text-profit shrink-0 leading-none" />
                      </button>
                    );
                  })}
                  {count > MAX_PREVIEWS && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDay(expandedDay === key ? null : key);
                      }}
                      className="text-[9px] text-accent hover:text-accent/80 pl-1 leading-tight block hover:underline cursor-pointer"
                    >
                      +{count - MAX_PREVIEWS} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Day detail modal ─────────────────── */}
      {expandedDay && (() => {
        const dayMarkets = grouped.get(expandedDay) || [];
        const [y, m, d] = expandedDay.split("-").map(Number);
        const label = `${MONTHS[m - 1]} ${d}`;
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setExpandedDay(null)}
          >
            <div
              ref={popoverRef}
              className="w-[calc(100vw-2rem)] sm:w-[360px] max-h-[70vh] overflow-y-auto bg-ep-card border border-ep-border rounded-xl shadow-2xl p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-semibold text-text-primary">
                  {label} — {dayMarkets.length} markets expiring
                </span>
                <button
                  onClick={() => setExpandedDay(null)}
                  className="text-text-muted hover:text-text-primary text-sm p-1"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-0.5">
                {dayMarkets.map((mk) => {
                  const p = livePrices?.[mk.yes_token] ?? mk.yes_price;
                  const em = CATEGORY_EMOJI[mk.category] || "📊";
                  const bc = CATEGORY_COLORS[mk.category] || "#8B92A8";
                  return (
                    <button
                      key={mk.market_id}
                      onClick={() => { openDetail(mk); setExpandedDay(null); }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left hover:bg-ep-surface/60 transition group"
                      style={{ borderLeft: `2px solid ${bc}` }}
                    >
                      <span className="text-xs leading-none shrink-0">{em}</span>
                      <span className="text-xs text-text-muted group-hover:text-text-primary truncate flex-1 leading-tight">
                        {truncate(mk.question, 50)}
                      </span>
                      <FlashPrice price={p} className="text-xs font-mono text-profit shrink-0 leading-none" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
