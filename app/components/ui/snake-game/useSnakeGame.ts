import { useRef, useState, useCallback } from "react";
import type { FrameData, GameItem, GameState, GameRoundSummary, HudState } from "./types";
import { isObstacle } from "./types";
import {
  spawnItem,
  getSpawnInterval,
  getItemDef,
  MAX_ITEMS,
  MAX_ITEMS_MOBILE,
  ITEM_DRIFT_PX_PER_SEC,
} from "./collectibles";
import { createParticles, spawnBurst, tickParticles } from "./particles";
import { soundManager } from "./sounds";
import type { GameParticle } from "./particles";

/* ── Constants ── */
const COMET_RADIUS = 22; // comet collision radius px
const HUD_UPDATE_MS = 150; // batch HUD updates

function comboMultiplier(combo: number): number {
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

export interface SnakeGameAPI {
  /** Current HUD state (batched React updates) */
  hud: HudState;
  /** Particle array ref for the overlay to draw */
  particlesRef: React.RefObject<GameParticle[]>;
  /** Items array ref for the overlay to draw */
  itemsRef: React.RefObject<GameItem[]>;
  /** Screen flash state */
  flash: { color: string; opacity: number } | null;
  /** Round summary (set when round ends) */
  summary: GameRoundSummary | null;
  /** Tick the game — call from overlay RAF */
  tick: (frameData: FrameData) => void;
  /** Start a new round */
  start: () => void;
  /** End current round */
  end: () => GameRoundSummary;
  /** Is the game active? */
  active: boolean;
}

export function useSnakeGame(isMobile: boolean): SnakeGameAPI {
  const [hud, setHud] = useState<HudState>({
    score: 0,
    combo: 0,
    shieldActive: false,
    flashText: null,
    flashColor: "#F59E0B",
  });
  const [flash, setFlash] = useState<{ color: string; opacity: number } | null>(null);
  const [summary, setSummary] = useState<GameRoundSummary | null>(null);
  const [active, setActive] = useState(false);

  // Per-frame state in refs to avoid re-renders
  const stateRef = useRef<GameState>({
    items: [],
    score: 0,
    combo: 0,
    maxCombo: 0,
    shieldActive: false,
    shieldExpiry: 0,
    jackpotBoostActive: false,
    itemsCollected: 0,
    obstaclesHit: 0,
    phase: "ended",
  });
  const itemsRef = useRef<GameItem[]>([]);
  const particlesRef = useRef<GameParticle[]>(createParticles());
  const lastSpawnRef = useRef(0);
  const nextSpawnIntervalRef = useRef(10_000);
  const roundStartRef = useRef(0);
  const lastHudUpdateRef = useRef(0);
  const frameCountRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const flashTextTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const maxItems = isMobile ? MAX_ITEMS_MOBILE : MAX_ITEMS;
  const particleCount = isMobile ? 8 : 14;

  const start = useCallback(() => {
    const now = Date.now();
    stateRef.current = {
      items: [],
      score: 0,
      combo: 0,
      maxCombo: 0,
      shieldActive: false,
      shieldExpiry: 0,
      jackpotBoostActive: false,
      itemsCollected: 0,
      obstaclesHit: 0,
      phase: "active",
    };
    itemsRef.current = [];
    particlesRef.current = createParticles();
    lastSpawnRef.current = now;
    nextSpawnIntervalRef.current = 4000 + Math.random() * 3000;
    roundStartRef.current = now;
    frameCountRef.current = 0;
    setSummary(null);
    setActive(true);
    setHud({ score: 0, combo: 0, shieldActive: false, flashText: null, flashColor: "#F59E0B" });

    // Initialize sound
    soundManager.init();
  }, []);

  const end = useCallback((): GameRoundSummary => {
    const s = stateRef.current;
    s.phase = "ended";
    const result: GameRoundSummary = {
      score: s.score,
      maxCombo: s.maxCombo,
      itemsCollected: s.itemsCollected,
      obstaclesHit: s.obstaclesHit,
    };
    setSummary(result);
    setActive(false);
    return result;
  }, []);

  const showFlashText = useCallback((text: string, color: string) => {
    clearTimeout(flashTextTimerRef.current);
    setHud((h) => ({ ...h, flashText: text, flashColor: color }));
    flashTextTimerRef.current = setTimeout(() => {
      setHud((h) => ({ ...h, flashText: null }));
    }, 1200);
  }, []);

  const screenFlash = useCallback((color: string) => {
    clearTimeout(flashTimerRef.current);
    setFlash({ color, opacity: 0.25 });
    flashTimerRef.current = setTimeout(() => setFlash(null), 200);
  }, []);

  const tick = useCallback(
    (fd: FrameData) => {
      const s = stateRef.current;
      if (s.phase !== "active") return;

      const now = Date.now();
      const elapsed = now - roundStartRef.current;
      frameCountRef.current++;

      // ── Spawn logic ──
      if (
        now - lastSpawnRef.current > nextSpawnIntervalRef.current &&
        itemsRef.current.length < maxItems
      ) {
        const item = spawnItem(fd.cometPrice, fd.minPrice, fd.maxPrice);
        itemsRef.current.push(item);
        s.items = itemsRef.current;
        lastSpawnRef.current = now;
        nextSpawnIntervalRef.current = getSpawnInterval(elapsed);
      }

      // ── Offset for header (overlay covers full card, coords are chart-relative) ──
      const offsetY = fd.chartOffsetTop;

      // ── Update item positions & collision detection ──
      for (let i = itemsRef.current.length - 1; i >= 0; i--) {
        const item = itemsRef.current[i];

        // Y position from price (add offsetY to shift into overlay coordinate space)
        item.screenY = fd.priceToY(item.price) + offsetY;

        // X position: spawn ahead of comet, drift left toward and past it
        const age = now - item.spawnTime;
        const spawnX = fd.cometX + fd.chartW * 0.25; // spawn 25% of chart width ahead
        const driftSec = age / 1000;
        item.screenX = spawnX - driftSec * ITEM_DRIFT_PX_PER_SEC;

        // Remove if off screen left
        if (item.screenX < -40) {
          itemsRef.current.splice(i, 1);
          continue;
        }

        // Skip if already collected (keep for death animation)
        if (item.collected) {
          // Remove after animation (500ms)
          if (item.hitTime > 0 && now - item.hitTime > 500) {
            itemsRef.current.splice(i, 1);
          }
          continue;
        }

        // ── Collision check ──
        const cometYWithOffset = fd.cometY + offsetY;
        const dx = fd.cometX - item.screenX;
        const dy = cometYWithOffset - item.screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < item.radius + COMET_RADIUS) {
          item.collected = true;
          item.hitTime = now;
          const def = getItemDef(item.type);

          if (isObstacle(item.type)) {
            // ── Obstacle hit ──
            if (s.shieldActive) {
              s.shieldActive = false;
              spawnBurst(particlesRef.current, item.screenX, item.screenY, "96, 165, 250", particleCount);
              soundManager.playShield();
              showFlashText("SHIELD BLOCKED!", "#60A5FA");
            } else {
              if (item.type === "spike") {
                s.combo = 0;
              } else if (item.type === "drain") {
                s.score = Math.max(0, s.score - 5);
              }
              s.obstaclesHit++;
              spawnBurst(particlesRef.current, item.screenX, item.screenY, def.glowColor, particleCount);
              soundManager.playObstacle();
              screenFlash("#FF4060");
              showFlashText(def.label, def.color);
            }
          } else {
            // ── Collectible ──
            const mult = comboMultiplier(s.combo);
            switch (item.type) {
              case "xp_coin":
                s.score += Math.round(10 * mult);
                break;
              case "xp_gem":
                s.score += Math.round(25 * mult);
                break;
              case "streak_star":
                s.combo += 1; // extra combo on top of the +1 below
                break;
              case "shield":
                s.shieldActive = true;
                s.shieldExpiry = now + 60_000;
                break;
              case "jackpot_boost":
                s.jackpotBoostActive = true;
                s.score += Math.round(15 * mult);
                break;
            }
            s.combo += 1;
            s.maxCombo = Math.max(s.maxCombo, s.combo);
            s.itemsCollected++;

            spawnBurst(particlesRef.current, item.screenX, item.screenY, def.glowColor, particleCount);
            soundManager.playCollect(s.combo);

            // Combo milestone
            if (s.combo > 0 && s.combo % 5 === 0) {
              soundManager.playComboMilestone();
              showFlashText(`${s.combo}x COMBO!`, "#00F0A0");
            } else {
              showFlashText(def.label, def.color);
            }
          }
        }
      }

      s.items = itemsRef.current;

      // ── Tick particles ──
      tickParticles(particlesRef.current);

      // ── Shield expiry ──
      if (s.shieldActive && now > s.shieldExpiry) {
        s.shieldActive = false;
      }

      // ── Batch HUD update ──
      if (now - lastHudUpdateRef.current > HUD_UPDATE_MS) {
        lastHudUpdateRef.current = now;
        setHud({
          score: s.score,
          combo: s.combo,
          shieldActive: s.shieldActive,
          flashText: null, // managed by showFlashText
          flashColor: "#F59E0B",
        });
      }
    },
    [maxItems, particleCount, showFlashText, screenFlash]
  );

  return {
    hud,
    particlesRef: particlesRef as React.RefObject<GameParticle[]>,
    itemsRef: itemsRef as React.RefObject<GameItem[]>,
    flash,
    summary,
    tick,
    start,
    end,
    active,
  };
}
