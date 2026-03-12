'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── Types ──────────────────────────────────────── */
interface OrderLevel {
  price: number;
  size: number;
}

interface OrderBookData {
  bids: OrderLevel[];
  asks: OrderLevel[];
  spread: number | null;
  lastTradePrice: number | null;
}

interface ArcadeOrderBookProps {
  tokenId: string | null;
  assetLabel?: string;
}

/* ── Component ─────────────────────────────────── */
export function ArcadeOrderBook({ tokenId, assetLabel = 'BTC' }: ArcadeOrderBookProps) {
  const [book, setBook] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBook = useCallback(async () => {
    if (!tokenId) return;

    try {
      const res = await fetch(`/api/polymarket/orderbook?tokenId=${encodeURIComponent(tokenId)}`);
      if (res.ok) {
        const data = await res.json();
        setBook(data);
      }
    } catch {
      // Silent — order book will show stale data
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    if (!tokenId) return;
    setLoading(true);
    fetchBook();
    const iv = setInterval(fetchBook, 8000); // Poll every 8 seconds
    return () => clearInterval(iv);
  }, [tokenId, fetchBook]);

  if (!tokenId) {
    return (
      <div className="ep-card p-4">
        <p className="text-[10px] text-text-muted text-center">No active market</p>
      </div>
    );
  }

  // Find max size for bar widths
  const allSizes = [...(book?.bids || []), ...(book?.asks || [])].map((l) => l.size);
  const maxSize = Math.max(...allSizes, 1);

  return (
    <div className="ep-card overflow-hidden">
      <div className="px-3 py-2 border-b border-ep-border flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">
          Order Book
        </h3>
        <span className="text-[9px] text-text-muted">{assetLabel} 5m</span>
      </div>

      {loading && !book ? (
        <div className="p-6 text-center">
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
        </div>
      ) : !book ? (
        <div className="p-4 text-center">
          <p className="text-[10px] text-text-muted">No order book data</p>
        </div>
      ) : (
        <div className="text-[10px] font-mono">
          {/* Header */}
          <div className="grid grid-cols-3 px-3 py-1 text-text-muted border-b border-ep-border">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total $</span>
          </div>

          {/* Asks (reversed so lowest ask is at bottom, closest to spread) */}
          <div className="divide-y divide-ep-border/30">
            {(book.asks || []).slice().reverse().map((level, i) => (
              <div key={`ask-${i}`} className="relative grid grid-cols-3 px-3 py-0.5 items-center">
                <div
                  className="absolute inset-0 bg-loss/[0.06]"
                  style={{ width: `${(level.size / maxSize) * 100}%`, right: 0, left: 'auto' }}
                />
                <span className="relative text-loss">{(level.price * 100).toFixed(1)}c</span>
                <span className="relative text-right text-text-secondary">
                  {level.size.toFixed(1)}
                </span>
                <span className="relative text-right text-text-muted">
                  ${(level.price * level.size).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Spread */}
          {book.spread !== null && (
            <div className="px-3 py-1.5 text-center border-y border-ep-border bg-ep-surface/30">
              <span className="text-text-muted">Spread: </span>
              <span className="text-accent font-semibold">
                {(book.spread * 100).toFixed(1)}c
              </span>
              {book.lastTradePrice !== null && (
                <span className="text-text-muted ml-2">
                  Last: {(book.lastTradePrice * 100).toFixed(1)}c
                </span>
              )}
            </div>
          )}

          {/* Bids */}
          <div className="divide-y divide-ep-border/30">
            {(book.bids || []).map((level, i) => (
              <div key={`bid-${i}`} className="relative grid grid-cols-3 px-3 py-0.5 items-center">
                <div
                  className="absolute inset-0 bg-profit/[0.06]"
                  style={{ width: `${(level.size / maxSize) * 100}%`, right: 0, left: 'auto' }}
                />
                <span className="relative text-profit">{(level.price * 100).toFixed(1)}c</span>
                <span className="relative text-right text-text-secondary">
                  {level.size.toFixed(1)}
                </span>
                <span className="relative text-right text-text-muted">
                  ${(level.price * level.size).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
