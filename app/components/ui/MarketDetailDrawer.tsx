'use client';

import {
  createContext, useContext, useState, useCallback, useEffect, useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CategoryBadge, TierBadge, StyleBadge } from './Badges';
import { ActionButton } from './ActionButton';
import { useTradePanel } from './TradePanel';
import { useUserStore } from '@/app/lib/stores/user-store';
import { CATEGORY_COLORS } from '@/app/dashboard/markets/constants';

/* ── Types ─────────────────────────────────────── */

interface MarketOutcome {
  label: string;
  yes_price: number;
  market_id: string;
  yes_token: string;
  no_token: string;
  volume?: number;
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

interface PricePoint { t: number; p: number; }
interface OrderLevel { price: number; size: number; }
interface Trade { side: string; price: number; size: number; timestamp: number; outcome: string; }
interface ActivityTrade {
  side: string;
  price: number;
  size: number;
  timestamp: number;
  outcome: string;
  trader: { username: string; name: string; wallet: string; profileImage: string; };
  enrichment: {
    id: string;
    alias: string;
    wallet_address: string;
    roi: number;
    win_rate: number;
    bankroll_tier: string;
    trading_style: string;
    total_pnl: number;
  } | null;
}

/* ── Helpers ───────────────────────────────────── */

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatSize(v: number): string {
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function timeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  if (days > 30) return `${Math.floor(days / 30)}mo left`;
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h left`;
  return '<1h left';
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Context ───────────────────────────────────── */

interface MarketDetailContextType {
  isOpen: boolean;
  market: Market | null;
  openDetail: (market: Market) => void;
  closeDetail: () => void;
}

const MarketDetailContext = createContext<MarketDetailContextType>({
  isOpen: false,
  market: null,
  openDetail: () => {},
  closeDetail: () => {},
});

export function useMarketDetail() {
  return useContext(MarketDetailContext);
}

/* ── Provider ──────────────────────────────────── */

export function MarketDetailProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);

  const openDetail = useCallback((m: Market) => {
    setMarket(m);
    setIsOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setMarket(null), 300);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeDetail();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, closeDetail]);

  return (
    <MarketDetailContext.Provider value={{ isOpen, market, openDetail, closeDetail }}>
      {children}
      <MarketDetailDrawer />
    </MarketDetailContext.Provider>
  );
}

/* ── Time Range Config ─────────────────────────── */

const TIME_RANGES = [
  { label: '1H', interval: '1h', fidelity: 1 },
  { label: '6H', interval: '6h', fidelity: 5 },
  { label: '1D', interval: '1d', fidelity: 15 },
  { label: '1W', interval: '1w', fidelity: 60 },
  { label: 'ALL', interval: 'max', fidelity: 360 },
];

/* ── Main Drawer Component ─────────────────────── */

function MarketDetailDrawer() {
  const { isOpen, market, closeDetail } = useMarketDetail();
  const { openTrade } = useTradePanel();

  const handleBet = (side: 'YES' | 'NO') => {
    if (!market) return;
    closeDetail();
    setTimeout(() => {
      openTrade({
        type: 'market',
        side,
        market: {
          market_id: market.market_id,
          question: market.question,
          yes_price: market.yes_price,
          no_price: market.no_price,
          yes_token: market.yes_token || '',
          no_token: market.no_token || '',
          outcomes: market.is_multi && market.outcomes ? market.outcomes.map((o) => ({
            label: o.label,
            yes_price: o.yes_price,
            market_id: o.market_id,
            yes_token: o.yes_token,
            no_token: o.no_token,
          })) : undefined,
        },
      });
    }, 100);
  };

  return (
    <AnimatePresence>
      {isOpen && market && (
        <motion.div
          className="fixed inset-0 z-[60] flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeDetail}
          />

          {/* Drawer panel */}
          <motion.div
            className="relative w-full sm:w-[480px] h-full bg-ep-bg border-l border-ep-border overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex flex-col min-h-full">
              {/* ── Header ── */}
              <div className="sticky top-0 z-10 bg-ep-bg/95 backdrop-blur-sm border-b border-ep-border p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-base font-bold text-text-primary leading-snug">
                      {market.question}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5">
                      <CategoryBadge category={market.category || 'other'} />
                      {market.end_date && (
                        <span className="text-[10px] font-mono text-text-muted">
                          {timeRemaining(market.end_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={closeDetail}
                    className="p-1.5 rounded-lg hover:bg-ep-surface/60 text-text-muted hover:text-text-primary transition flex-shrink-0"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ── Price Summary ── */}
              <div className="px-4 py-3 border-b border-ep-border/50">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">YES</span>
                    <span className="font-mono font-bold text-profit text-lg">
                      {(market.yes_price * 100).toFixed(0)}¢
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">NO</span>
                    <span className="font-mono font-bold text-loss text-lg">
                      {(market.no_price * 100).toFixed(0)}¢
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-text-muted">Vol</span>
                    <span className="font-mono font-semibold text-text-secondary">
                      {formatVolume(market.volume || 0)}
                    </span>
                  </div>
                  {market.volume_24h ? (
                    <div className="flex items-center gap-1">
                      <span className="text-text-muted">24h</span>
                      <span className="font-mono font-semibold text-text-secondary">
                        {formatVolume(market.volume_24h)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1">
                    <span className="text-text-muted">Liq</span>
                    <span className="font-mono font-semibold text-text-secondary">
                      {formatVolume(market.liquidity || 0)}
                    </span>
                  </div>
                </div>
                {/* Probability bar */}
                <div className="w-full h-1.5 rounded-full bg-ep-surface/60 overflow-hidden flex mt-3">
                  <div
                    className="h-full rounded-l-full"
                    style={{
                      width: `${market.yes_price * 100}%`,
                      background: 'var(--color-profit, #00F0A0)',
                    }}
                  />
                  <div
                    className="h-full rounded-r-full"
                    style={{
                      width: `${market.no_price * 100}%`,
                      background: 'var(--color-loss, #FF4060)',
                    }}
                  />
                </div>
              </div>

              {/* ── Price Chart ── */}
              <PriceChartSection tokenId={market.yes_token} />

              {/* ── Order Book ── */}
              <OrderBookSection tokenId={market.yes_token} />

              {/* ── Market Activity ── */}
              <MarketActivitySection conditionId={market.condition_id} />

              {/* ── Trade Buttons (sticky bottom) ── */}
              <div className="sticky bottom-0 bg-ep-bg/95 backdrop-blur-sm border-t border-ep-border p-4 mt-auto">
                <div className="flex gap-3">
                  <ActionButton variant="yes" size="md" fullWidth onClick={() => handleBet('YES')}>
                    Bet {market.yes_label || 'YES'}
                  </ActionButton>
                  <ActionButton variant="no" size="md" fullWidth onClick={() => handleBet('NO')}>
                    Bet {market.no_label || 'NO'}
                  </ActionButton>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Price Chart Section ───────────────────────── */

function PriceChartSection({ tokenId }: { tokenId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [activeRange, setActiveRange] = useState(2); // default 1D
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenId || !containerRef.current) return;

    let chart: any = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;

    setLoading(true);

    const range = TIME_RANGES[activeRange];

    // Fetch price history
    fetch('/api/clob/price-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenIds: [tokenId],
        interval: range.interval,
        fidelity: range.fidelity,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !containerRef.current) return;

        const history: PricePoint[] = data.histories?.[tokenId] || [];
        if (history.length < 2) {
          setLoading(false);
          return;
        }

        // Dynamic import lightweight-charts
        import('lightweight-charts').then(({ createChart, ColorType, LineStyle, BaselineSeries }) => {
          if (cancelled || !containerRef.current) return;

          // Clear any existing chart
          if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
          }

          chart = createChart(containerRef.current!, {
            layout: {
              background: { type: ColorType.Solid, color: 'transparent' },
              textColor: '#505672',
              fontFamily: "'General Sans', system-ui, sans-serif",
              fontSize: 10,
            },
            grid: {
              vertLines: { color: 'rgba(30, 34, 53, 0.5)' },
              horzLines: { color: 'rgba(30, 34, 53, 0.5)' },
            },
            width: containerRef.current!.clientWidth,
            height: 200,
            rightPriceScale: {
              borderColor: '#1E2235',
              scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
              borderColor: '#1E2235',
              timeVisible: true,
              secondsVisible: false,
            },
            crosshair: {
              vertLine: {
                color: 'rgba(0, 240, 160, 0.3)',
                style: LineStyle.Dashed,
                labelBackgroundColor: '#151823',
              },
              horzLine: {
                color: 'rgba(0, 240, 160, 0.3)',
                style: LineStyle.Dashed,
                labelBackgroundColor: '#151823',
              },
            },
            handleScroll: true,
            handleScale: true,
          });

          const isUp = history[history.length - 1].p >= history[0].p;
          const lineColor = isUp ? '#00F0A0' : '#FF4060';
          const fillTop = isUp ? 'rgba(0, 240, 160, 0.18)' : 'rgba(255, 64, 96, 0.18)';
          const fillBot = isUp ? 'rgba(0, 240, 160, 0.02)' : 'rgba(255, 64, 96, 0.02)';

          // Use baseline series (v5 addSeries API) with base at 0 for area fill effect
          const series = chart.addSeries(BaselineSeries, {
            topFillColor1: fillTop,
            topFillColor2: fillBot,
            topLineColor: lineColor,
            bottomFillColor1: 'transparent',
            bottomFillColor2: 'transparent',
            bottomLineColor: lineColor,
            baseValue: { type: 'price' as const, price: 0 },
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBackgroundColor: lineColor,
            crosshairMarkerBorderColor: '#08090E',
            priceFormat: {
              type: 'custom' as const,
              formatter: (price: number) => `${(price * 100).toFixed(1)}¢`,
            },
          });

          // Convert unix timestamps to lightweight-charts format
          // Deduplicate & sort — CLOB API can return duplicate timestamps
          const seen = new Set<number>();
          const chartData = history
            .slice()
            .sort((a, b) => a.t - b.t)
            .filter((pt) => {
              if (seen.has(pt.t)) return false;
              seen.add(pt.t);
              return true;
            })
            .map((pt) => ({
              time: pt.t as any, // UTCTimestamp
              value: pt.p,
            }));

          series.setData(chartData);
          chart.timeScale().fitContent();
          chartRef.current = chart;

          // Responsive resize
          observer = new ResizeObserver(() => {
            if (containerRef.current && chart) {
              chart.applyOptions({ width: containerRef.current.clientWidth });
            }
          });
          observer.observe(containerRef.current!);

          setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [tokenId, activeRange]);

  return (
    <div className="px-4 py-3 border-b border-ep-border/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Price Chart
        </span>
        <div className="flex gap-1">
          {TIME_RANGES.map((range, i) => (
            <button
              key={range.label}
              onClick={() => setActiveRange(i)}
              className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded transition ${
                i === activeRange
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-ep-surface/60'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ minHeight: 200 }}>
        {loading && (
          <div className="flex items-center justify-center h-[200px]">
            <div className="animate-spin h-5 w-5 border-2 border-accent/30 border-t-accent rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Order Book Section ────────────────────────── */

function OrderBookSection({ tokenId }: { tokenId: string }) {
  const [bids, setBids] = useState<OrderLevel[]>([]);
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [spread, setSpread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenId) return;
    let cancelled = false;

    fetch(`/api/clob/book?token_id=${tokenId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setBids((data.bids || []).slice(0, 8));
        setAsks((data.asks || []).slice(0, 8));
        setSpread(data.spread || 0);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tokenId]);

  const maxSize = Math.max(
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size),
    1
  );

  return (
    <div className="px-4 py-3 border-b border-ep-border/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Order Book
        </span>
        {spread > 0 && (
          <span className="text-[10px] font-mono text-text-muted">
            Spread: {(spread * 100).toFixed(1)}¢
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-ep-surface/40 animate-pulse" />
          ))}
        </div>
      ) : bids.length === 0 && asks.length === 0 ? (
        <div className="text-xs text-text-muted text-center py-4">No orders available</div>
      ) : (
        <div className="space-y-0.5">
          {/* Asks (reversed so highest price at top) */}
          {[...asks].reverse().map((a, i) => (
            <div key={`ask-${i}`} className="flex items-center gap-2 h-6 text-[11px] font-mono relative">
              <div
                className="absolute right-0 top-0 bottom-0 rounded-sm opacity-15"
                style={{
                  width: `${(a.size / maxSize) * 100}%`,
                  background: '#FF4060',
                }}
              />
              <span className="w-12 text-right text-text-muted relative z-10">
                {formatSize(a.size)}
              </span>
              <span className="flex-1 text-right text-loss font-semibold relative z-10">
                {(a.price * 100).toFixed(1)}¢
              </span>
            </div>
          ))}

          {/* Spread divider */}
          <div className="flex items-center justify-center py-1">
            <div className="flex-1 h-px bg-ep-border/50" />
            <span className="px-2 text-[10px] font-mono text-text-muted">
              {(spread * 100).toFixed(1)}¢ spread
            </span>
            <div className="flex-1 h-px bg-ep-border/50" />
          </div>

          {/* Bids */}
          {bids.map((b, i) => (
            <div key={`bid-${i}`} className="flex items-center gap-2 h-6 text-[11px] font-mono relative">
              <div
                className="absolute left-0 top-0 bottom-0 rounded-sm opacity-15"
                style={{
                  width: `${(b.size / maxSize) * 100}%`,
                  background: '#00F0A0',
                }}
              />
              <span className="flex-1 text-profit font-semibold relative z-10">
                {(b.price * 100).toFixed(1)}¢
              </span>
              <span className="w-12 text-text-muted relative z-10">
                {formatSize(b.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Market Activity Section ───────────────────── */

function MarketActivitySection({ conditionId }: { conditionId?: string }) {
  const [trades, setTrades] = useState<ActivityTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const { walletAddress, isFollowing, fetchFollows, followedTraderIds } = useUserStore();
  const [trackingIds, setTrackingIds] = useState<Set<string>>(new Set());
  const [shadowingIds, setShadowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!conditionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    fetch(`/api/clob/activity?conditionId=${conditionId}&limit=20`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTrades(data.trades || []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [conditionId]);

  const handleTrack = async (username: string, wallet: string) => {
    if (!wallet || trackingIds.has(username)) return;
    setTrackingIds((prev) => new Set(prev).add(username));

    try {
      await fetch('/api/traders/add-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet }),
      });
      // Refresh trades to pick up enrichment
      if (conditionId) {
        const res = await fetch(`/api/clob/activity?conditionId=${conditionId}&limit=20`);
        const data = await res.json();
        setTrades(data.trades || []);
      }
    } catch {
      // Silently fail
    } finally {
      setTrackingIds((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  };

  const handleShadow = async (traderId: string, username: string) => {
    if (!walletAddress || shadowingIds.has(username)) return;
    setShadowingIds((prev) => new Set(prev).add(username));

    try {
      await fetch('/api/follows/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          traderId,
          action: 'shadow',
        }),
      });
      await fetchFollows();
    } catch {
      // Silently fail
    } finally {
      setShadowingIds((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  };

  return (
    <div className="px-4 py-3">
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-3">
        Market Activity
      </span>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-ep-surface/40 animate-pulse" />
          ))}
        </div>
      ) : !conditionId ? (
        <div className="text-xs text-text-muted text-center py-4">Activity unavailable</div>
      ) : trades.length === 0 ? (
        <div className="text-xs text-text-muted text-center py-4">No recent activity</div>
      ) : (
        <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
          {trades.map((t, i) => {
            const isEnriched = !!t.enrichment;
            const traderId = t.enrichment?.id;
            const isAlreadyFollowing = traderId ? isFollowing(traderId) : false;
            const hasWallet = !!t.trader.wallet;
            const displayName = t.trader.username !== 'anon'
              ? t.trader.username
              : t.trader.wallet
                ? `${t.trader.wallet.slice(0, 6)}...${t.trader.wallet.slice(-4)}`
                : 'anon';
            const isTracking = trackingIds.has(t.trader.username);
            const isShadowing = shadowingIds.has(t.trader.username);

            return (
              <div
                key={i}
                className="py-2 border-b border-ep-border/20 last:border-0"
              >
                {/* Line 1: Trade info */}
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span
                    className={`w-7 font-bold ${
                      t.side === 'BUY' ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {t.side}
                  </span>
                  <span className="text-text-muted">{t.outcome || 'Yes'}</span>
                  <span className="text-text-primary font-semibold">
                    {(t.price * 100).toFixed(1)}¢
                  </span>
                  <span className="text-text-secondary">
                    ${t.size >= 1000 ? `${(t.size / 1000).toFixed(1)}K` : t.size < 1 ? t.size.toFixed(2) : t.size.toFixed(0)}
                  </span>
                  <span className="ml-auto text-text-muted text-[10px]">
                    {timeAgo(t.timestamp)}
                  </span>
                </div>

                {/* Line 2: Trader identity + action */}
                <div className="flex items-center gap-1.5 mt-1">
                  {hasWallet ? (
                    <a
                      href={`https://polymarket.com/profile/${t.trader.wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-text-secondary font-medium truncate max-w-[140px] hover:text-accent transition-colors inline-flex items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {displayName}
                      <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-[11px] text-text-secondary font-medium truncate max-w-[140px]">
                      {displayName}
                    </span>
                  )}

                  {/* ROI badge (if enriched) */}
                  {isEnriched && t.enrichment!.roi != null && (
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{
                        color: t.enrichment!.roi >= 0 ? '#00F0A0' : '#FF4060',
                      }}
                    >
                      {t.enrichment!.roi >= 0 ? '+' : ''}
                      {(t.enrichment!.roi * 100).toFixed(0)}%
                    </span>
                  )}

                  {/* Tier + Style badges (if enriched) */}
                  {isEnriched && t.enrichment!.bankroll_tier && (
                    <TierBadge tier={t.enrichment!.bankroll_tier} />
                  )}
                  {isEnriched && t.enrichment!.trading_style && (
                    <StyleBadge style={t.enrichment!.trading_style} />
                  )}

                  {/* Action button (push to far right) */}
                  <div className="ml-auto flex-shrink-0">
                    {isAlreadyFollowing ? (
                      <span className="text-[10px] text-text-muted font-medium px-1.5 py-0.5">
                        ✓ Following
                      </span>
                    ) : isEnriched && traderId ? (
                      <button
                        onClick={() => handleShadow(traderId, t.trader.username)}
                        disabled={isShadowing}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition disabled:opacity-50"
                      >
                        {isShadowing ? '...' : '👁 Shadow'}
                      </button>
                    ) : hasWallet && t.trader.username !== 'anon' ? (
                      <button
                        onClick={() => handleTrack(t.trader.username, t.trader.wallet)}
                        disabled={isTracking}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-ep-surface/60 text-text-secondary hover:bg-ep-surface hover:text-text-primary transition disabled:opacity-50"
                      >
                        {isTracking ? '...' : '+ Track'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
