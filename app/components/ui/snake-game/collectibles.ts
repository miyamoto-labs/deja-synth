import type { ItemType, GameItem } from "./types";

/* ── Item Definitions ────────────────────────── */
export interface ItemDef {
  type: ItemType;
  weight: number;      // spawn probability weight
  radius: number;      // collision radius px
  color: string;       // primary draw color
  glowColor: string;   // glow rgba string
  label: string;       // flash text on collect
}

export const ITEM_DEFS: ItemDef[] = [
  { type: "xp_coin",       weight: 40, radius: 16, color: "#F59E0B", glowColor: "245, 158, 11", label: "+10 XP" },
  { type: "xp_gem",        weight: 15, radius: 18, color: "#A78BFA", glowColor: "167, 139, 250", label: "+25 XP" },
  { type: "streak_star",   weight: 20, radius: 16, color: "#00F0A0", glowColor: "0, 240, 160", label: "STREAK!" },
  { type: "shield",        weight: 10, radius: 18, color: "#60A5FA", glowColor: "96, 165, 250", label: "SHIELD!" },
  { type: "jackpot_boost", weight: 5,  radius: 18, color: "#00F0A0", glowColor: "0, 240, 160", label: "JACKPOT BOOST!" },
  { type: "spike",         weight: 8,  radius: 20, color: "#FF4060", glowColor: "255, 64, 96", label: "OUCH!" },
  { type: "drain",         weight: 2,  radius: 20, color: "#FF4060", glowColor: "255, 64, 96", label: "-5 XP" },
];

const TOTAL_WEIGHT = ITEM_DEFS.reduce((s, d) => s + d.weight, 0);

export function getItemDef(type: ItemType): ItemDef {
  return ITEM_DEFS.find((d) => d.type === type)!;
}

/* ── Weighted random pick ────────────────────── */
export function pickRandomType(): ItemType {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const def of ITEM_DEFS) {
    r -= def.weight;
    if (r <= 0) return def.type;
  }
  return "xp_coin";
}

/* ── Spawn a new item ─────────────────────────── */
let nextId = 0;

export function spawnItem(
  currentPrice: number,
  minPrice: number,
  maxPrice: number,
): GameItem {
  const type = pickRandomType();
  const def = getItemDef(type);

  // Bias spawn price toward current price (within 30% of visible range)
  const range = maxPrice - minPrice;
  const band = range * 0.3;
  const lo = Math.max(minPrice + range * 0.1, currentPrice - band);
  const hi = Math.min(maxPrice - range * 0.1, currentPrice + band);
  const price = lo + Math.random() * (hi - lo);

  return {
    id: `item-${++nextId}`,
    type,
    price,
    spawnTime: Date.now(),
    screenX: 0,
    screenY: 0,
    collected: false,
    hitTime: -1,
    radius: def.radius,
    bobPhase: Math.random() * Math.PI * 2,
  };
}

/* ── Spawn timing ─────────────────────────────── */
const BASE_INTERVAL_MS = 6_000; // 6 seconds base
const MIN_INTERVAL_MS = 3_000;  // 3 seconds minimum

/** Get next spawn interval — accelerates over time */
export function getSpawnInterval(elapsedMs: number): number {
  // Decrease by 1s per minute elapsed
  const reduction = Math.floor(elapsedMs / 60_000) * 1000;
  const interval = BASE_INTERVAL_MS - reduction;
  // Add some randomness (±2s)
  const jitter = (Math.random() - 0.5) * 4000;
  return Math.max(MIN_INTERVAL_MS, interval + jitter);
}

export const MAX_ITEMS = 6;
export const MAX_ITEMS_MOBILE = 4;

/** Drift speed — items spawn ahead of comet and drift left past it (px per second) */
export const ITEM_DRIFT_PX_PER_SEC = 30;
