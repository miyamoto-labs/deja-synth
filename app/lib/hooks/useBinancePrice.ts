'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ── Types ──────────────────────────────────────── */
export interface PricePoint {
  time: number;
  price: number;
}

export interface BinancePriceData {
  currentPrice: number;
  connected: boolean;
  pricesRef: React.MutableRefObject<PricePoint[]>;
  latestPriceRef: React.MutableRefObject<{ price: number; time: number }>;
  smoothPriceRef: React.MutableRefObject<{ price: number; time: number }>;
}

/* ── Module-level singleton connections ─────────── */
interface SharedConnection {
  ws: WebSocket | null;
  subscribers: Set<() => void>;
  prices: PricePoint[];
  latestPrice: { price: number; time: number };
  smoothPrice: { price: number; time: number };
  currentPrice: number;
  connected: boolean;
  lastStored: number;
}

const connections = new Map<string, SharedConnection>();

function getOrCreateConnection(asset: string): SharedConnection {
  if (connections.has(asset)) return connections.get(asset)!;

  const conn: SharedConnection = {
    ws: null,
    subscribers: new Set(),
    prices: [],
    latestPrice: { price: 0, time: 0 },
    smoothPrice: { price: 0, time: 0 },
    currentPrice: 0,
    connected: false,
    lastStored: 0,
  };

  connections.set(asset, conn);
  return conn;
}

function connectWebSocket(asset: string) {
  const conn = getOrCreateConnection(asset);
  if (conn.ws && conn.ws.readyState <= WebSocket.OPEN) return;

  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${asset}@trade`);

  ws.onopen = () => {
    conn.connected = true;
    conn.subscribers.forEach((notify) => notify());
  };

  ws.onclose = () => {
    conn.connected = false;
    conn.ws = null;
    conn.subscribers.forEach((notify) => notify());

    // Reconnect if subscribers still exist
    if (conn.subscribers.size > 0) {
      setTimeout(() => connectWebSocket(asset), 2000);
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const price = parseFloat(data.p);
      const now = Date.now();

      conn.latestPrice = { price, time: now };
      conn.currentPrice = price;

      // Store historical point every 1 second
      if (now - conn.lastStored > 1000) {
        conn.lastStored = now;
        conn.prices.push({ time: now, price });

        const fiveMinAgo = now - 5 * 60 * 1000;
        conn.prices = conn.prices.filter((p) => p.time > fiveMinAgo);
      }

      conn.subscribers.forEach((notify) => notify());
    } catch {
      // skip invalid
    }
  };

  conn.ws = ws;
}

function disconnectIfNoSubscribers(asset: string) {
  const conn = connections.get(asset);
  if (!conn) return;

  if (conn.subscribers.size === 0) {
    conn.ws?.close();
    conn.ws = null;
    connections.delete(asset);
  }
}

/* ── Hook ───────────────────────────────────────── */
export function useBinancePrice(asset: 'btcusdt' | 'ethusdt' | 'solusdt'): BinancePriceData {
  const [, forceUpdate] = useState(0);

  // Local refs that mirror the shared connection data
  // These refs are stable across renders so canvas draw loops can use them
  const pricesRef = useRef<PricePoint[]>([]);
  const latestPriceRef = useRef<{ price: number; time: number }>({ price: 0, time: 0 });
  const smoothPriceRef = useRef<{ price: number; time: number }>({ price: 0, time: 0 });
  const [currentPrice, setCurrentPrice] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const conn = getOrCreateConnection(asset);
    let rafId: number | null = null;
    let pendingUpdate = false;

    const flushUpdate = () => {
      rafId = null;
      pendingUpdate = false;
      // Sync shared data to local refs (refs are instant, no re-render)
      pricesRef.current = conn.prices;
      latestPriceRef.current = conn.latestPrice;
      // Only trigger re-render via setState
      setCurrentPrice(conn.currentPrice);
      setConnected(conn.connected);
    };

    const notify = () => {
      // Always sync refs immediately (no re-render cost)
      pricesRef.current = conn.prices;
      latestPriceRef.current = conn.latestPrice;
      // Throttle state updates to ~60fps using rAF to avoid flooding React
      if (!pendingUpdate) {
        pendingUpdate = true;
        rafId = requestAnimationFrame(flushUpdate);
      }
    };

    conn.subscribers.add(notify);
    connectWebSocket(asset);

    // Initial sync (immediate)
    flushUpdate();

    return () => {
      conn.subscribers.delete(notify);
      if (rafId !== null) cancelAnimationFrame(rafId);
      disconnectIfNoSubscribers(asset);
    };
  }, [asset]);

  return {
    currentPrice,
    connected,
    pricesRef,
    latestPriceRef,
    smoothPriceRef,
  };
}
