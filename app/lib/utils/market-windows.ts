/**
 * 5-minute market window alignment utilities.
 * Shared between client (chart labels) and server (API routes).
 */

const INTERVAL = 5; // 5-minute windows

/** Get the UTC-aligned timestamp (seconds) for the current 5m window */
export function getCurrentWindowTimestamp(intervalMinutes = INTERVAL): number {
  const now = new Date();
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const minuteAligned = Math.floor(totalMinutes / intervalMinutes) * intervalMinutes;
  const windowStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    Math.floor(minuteAligned / 60), minuteAligned % 60, 0
  ));
  return Math.floor(windowStart.getTime() / 1000);
}

/** Get the UTC-aligned timestamp (seconds) for the next 5m window */
export function getNextWindowTimestamp(intervalMinutes = INTERVAL): number {
  return getCurrentWindowTimestamp(intervalMinutes) + intervalMinutes * 60;
}

/** Format a window timestamp into a human-readable time range, e.g. "14:30 - 14:35 UTC" */
export function formatWindowTimeRange(timestampSeconds: number, intervalMinutes = INTERVAL): string {
  const start = new Date(timestampSeconds * 1000);
  const end = new Date((timestampSeconds + intervalMinutes * 60) * 1000);

  const fmt = (d: Date) =>
    `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;

  return `${fmt(start)} - ${fmt(end)} UTC`;
}

/** Build the Polymarket slug for a given asset and window timestamp */
export function buildMarketSlug(asset: 'btc' | 'eth', timestampSeconds: number, intervalMinutes = INTERVAL): string {
  return `${asset}-updown-${intervalMinutes}m-${timestampSeconds}`;
}

/** Extract asset from a market string like "BTC-5m" or "ETH-5m" */
export function marketToAsset(market: string): 'btc' | 'eth' {
  return market.toLowerCase().startsWith('eth') ? 'eth' : 'btc';
}

/** Convert market string to Binance symbol */
export function marketToBinanceAsset(market: string): 'btcusdt' | 'ethusdt' {
  return market.toLowerCase().startsWith('eth') ? 'ethusdt' : 'btcusdt';
}
