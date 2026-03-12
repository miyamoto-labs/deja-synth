/* ── Snake Game Types ─────────────────────────── */

/** Coordinate mapping from BotRaceView's drawChart each frame */
export interface FrameData {
  priceToY: (price: number) => number;
  timeToX: (time: number) => number;
  cometX: number;
  cometY: number;
  cometPrice: number;
  minPrice: number;
  maxPrice: number;
  minTime: number;
  maxTime: number;
  chartW: number;
  chartH: number;
  padding: { top: number; bottom: number; left: number; right: number };
  isWinning: boolean;
  /** Offset from the top of the BotRaceView card to the chart area (header height) */
  chartOffsetTop: number;
}

/* ── Item Types ── */
export type CollectibleType =
  | "xp_coin"       // +10 XP
  | "xp_gem"        // +25 XP
  | "streak_star"   // +1 combo
  | "shield"        // blocks next obstacle
  | "jackpot_boost"; // bonus XP

export type ObstacleType =
  | "spike"    // breaks combo
  | "drain";   // -5 XP

export type ItemType = CollectibleType | ObstacleType;

export interface GameItem {
  id: string;
  type: ItemType;
  price: number;         // BTC price level
  spawnTime: number;     // timestamp when spawned
  screenX: number;       // current rendered x
  screenY: number;       // current rendered y
  collected: boolean;
  hitTime: number;       // timestamp when collected (-1 = not yet)
  radius: number;        // collision radius px
  bobPhase: number;      // idle animation offset
}

export interface GameState {
  items: GameItem[];
  score: number;
  combo: number;
  maxCombo: number;
  shieldActive: boolean;
  shieldExpiry: number;
  jackpotBoostActive: boolean;
  itemsCollected: number;
  obstaclesHit: number;
  phase: "active" | "ended";
}

export interface GameRoundSummary {
  score: number;
  maxCombo: number;
  itemsCollected: number;
  obstaclesHit: number;
}

/* ── HUD State (batched to React) ── */
export interface HudState {
  score: number;
  combo: number;
  shieldActive: boolean;
  flashText: string | null;
  flashColor: string;
}

export const OBSTACLES: ObstacleType[] = ["spike", "drain"];

export function isObstacle(type: ItemType): type is ObstacleType {
  return type === "spike" || type === "drain";
}
