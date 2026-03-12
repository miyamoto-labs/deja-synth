import { getSupabase } from '@/app/lib/supabase-server';

/**
 * Cached lookup: lowercase wallet address → trader UUID.
 * Survives across warm Vercel invocations (module-scope cache).
 * Refreshes on cold starts or after TTL expires.
 */

let walletCache: Map<string, string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Returns a Map of lowercase wallet addresses → trader IDs.
 * Cached with 60s TTL to avoid hitting the DB on every webhook event.
 */
export async function getTrackedWallets(): Promise<Map<string, string>> {
  const now = Date.now();
  if (walletCache && now < cacheExpiry) {
    return walletCache;
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('ep_tracked_traders')
    .select('id, wallet_address');

  if (error) {
    console.error('[tracked-wallets] Failed to load:', error.message);
    // Return stale cache if available, empty map otherwise
    return walletCache || new Map();
  }

  const map = new Map<string, string>();
  for (const trader of data || []) {
    if (trader.wallet_address) {
      map.set(trader.wallet_address.toLowerCase(), trader.id);
    }
  }

  walletCache = map;
  cacheExpiry = now + CACHE_TTL_MS;
  console.log(`[tracked-wallets] Loaded ${map.size} tracked wallets`);
  return map;
}
