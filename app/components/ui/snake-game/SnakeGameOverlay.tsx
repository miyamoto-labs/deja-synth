"use client";

import { useRef, useEffect, useCallback } from "react";
import type { FrameData, GameRoundSummary } from "./types";
import { isObstacle } from "./types";
import { getItemDef } from "./collectibles";
import { drawParticles } from "./particles";
import { soundManager } from "./sounds";
import { useSnakeGame } from "./useSnakeGame";
import { useSnakeGameStore } from "@/app/lib/stores/snake-game-store";

/* ── Props ── */
interface SnakeGameOverlayProps {
  frameData: FrameData | null;
  arcadePhase: "pick" | "live" | "resolving";
  activeBet: {
    side: "UP" | "DOWN";
    entryPrice: number;
    amount: number;
    shares: number;
    market: string;
    marketEndTime: number;
  } | null;
  onRoundEnd: (summary: GameRoundSummary) => void;
}

/* ── Draw item sprites ── */
function drawItem(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  radius: number,
  color: string,
  glowColor: string,
  bob: number,
  scale: number,
) {
  const r = radius * scale;
  const by = y + Math.sin(bob) * 3; // bob offset

  ctx.save();

  // Glow halo
  const glow = ctx.createRadialGradient(x, by, 0, x, by, r * 2);
  glow.addColorStop(0, `rgba(${glowColor}, 0.25)`);
  glow.addColorStop(1, `rgba(${glowColor}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, by, r * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.min(1, scale);

  switch (type) {
    case "xp_coin": {
      // Gold circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, by, r, 0, Math.PI * 2);
      ctx.fill();
      // Inner highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(x - r * 0.2, by - r * 0.2, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "xp_gem": {
      // Diamond (rotated square)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, by - r);
      ctx.lineTo(x + r * 0.7, by);
      ctx.lineTo(x, by + r);
      ctx.lineTo(x - r * 0.7, by);
      ctx.closePath();
      ctx.fill();
      // Sparkle center
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(x, by, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "streak_star": {
      // 5-pointed star
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2 + bob * 0.3;
        const method = i === 0 ? "moveTo" : "lineTo";
        ctx[method](x + Math.cos(angle) * r, by + Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "shield": {
      // Hexagon
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const method = i === 0 ? "moveTo" : "lineTo";
        ctx[method](x + Math.cos(angle) * r, by + Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
      // Inner glow
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(x, by, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "jackpot_boost": {
      // Lightning bolt
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, by - r);
      ctx.lineTo(x + r * 0.5, by - r * 0.1);
      ctx.lineTo(x, by - r * 0.1);
      ctx.lineTo(x + r * 0.3, by + r);
      ctx.lineTo(x - r * 0.5, by + r * 0.1);
      ctx.lineTo(x, by + r * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "spike": {
      // Red X
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, by - r * 0.6);
      ctx.lineTo(x + r * 0.6, by + r * 0.6);
      ctx.moveTo(x + r * 0.6, by - r * 0.6);
      ctx.lineTo(x - r * 0.6, by + r * 0.6);
      ctx.stroke();
      break;
    }
    case "drain": {
      // Red circle with minus
      ctx.fillStyle = color;
      ctx.globalAlpha *= 0.7;
      ctx.beginPath();
      ctx.arc(x, by, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, by);
      ctx.lineTo(x + r * 0.4, by);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/* ── Component ── */
export function SnakeGameOverlay({
  frameData,
  arcadePhase,
  activeBet,
  onRoundEnd,
}: SnakeGameOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const startedRef = useRef(false);
  const endedRef = useRef(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const game = useSnakeGame(isMobile);
  const store = useSnakeGameStore();

  // Sync sound setting
  useEffect(() => {
    soundManager.enabled = store.soundEnabled;
  }, [store.soundEnabled]);

  // Start game when live phase begins
  useEffect(() => {
    if (arcadePhase === "live" && activeBet && !startedRef.current) {
      startedRef.current = true;
      endedRef.current = false;
      game.start();
    }
  }, [arcadePhase, activeBet, game]);

  // End game when leaving live phase
  useEffect(() => {
    if (arcadePhase !== "live" && startedRef.current && !endedRef.current) {
      endedRef.current = true;
      startedRef.current = false;
      const summary = game.end();

      // Persist stats
      store.updateHighScore(summary.score);
      store.updateBestCombo(summary.maxCombo);
      store.addXp(summary.score);
      store.addRound();

      onRoundEnd(summary);
    }
  }, [arcadePhase, game, onRoundEnd, store]);

  // Drawing loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !frameData) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Tick game logic
    game.tick(frameData);

    const items = game.itemsRef.current;
    const particles = game.particlesRef.current;
    const now = Date.now();

    // ── Draw items ──
    if (items) {
      for (const item of items) {
        const def = getItemDef(item.type);
        const bob = now / 600 + item.bobPhase;

        // Collection animation: shrink over 300ms
        let scale = 1;
        if (item.collected && item.hitTime > 0) {
          const elapsed = now - item.hitTime;
          scale = Math.max(0, 1 - elapsed / 300);
          if (scale <= 0) continue;
        }

        // Fade in over first 500ms
        if (!item.collected) {
          const age = now - item.spawnTime;
          if (age < 500) {
            scale = age / 500;
          }
        }

        // Pulse for obstacles
        if (isObstacle(item.type) && !item.collected) {
          scale *= 0.85 + 0.15 * Math.sin(now / 300 + item.bobPhase);
        }

        drawItem(
          ctx,
          item.type,
          item.screenX,
          item.screenY,
          item.radius,
          def.color,
          def.glowColor,
          bob,
          scale,
        );
      }
    }

    // ── Draw particles ──
    if (particles) {
      drawParticles(ctx, particles);
    }

    // ── Screen flash ──
    if (game.flash) {
      ctx.fillStyle =
        game.flash.color === "#FF4060"
          ? `rgba(255, 64, 96, ${game.flash.opacity})`
          : `rgba(96, 165, 250, ${game.flash.opacity})`;
      ctx.fillRect(0, 0, w, h);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [frameData, game]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* ── HUD ── */}
      {game.active && (
        <>
          {/* Score — top left, offset to not overlap UP banner */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="bg-ep-bg/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-accent/20">
              <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">XP</span>
              <span className="text-sm font-mono font-bold text-accent">{game.hud.score}</span>
            </div>

            {/* Combo */}
            {game.hud.combo >= 2 && (
              <div className="bg-ep-bg/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-accent/20">
                <span className="text-sm font-mono font-bold text-accent">
                  {game.hud.combo}x
                </span>
                <span className="text-[10px] text-text-muted ml-1">COMBO</span>
              </div>
            )}

            {/* Shield */}
            {game.hud.shieldActive && (
              <div className="bg-ep-bg/80 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-blue-400/30">
                <span className="text-sm">🛡️</span>
              </div>
            )}
          </div>

          {/* Flash text — bottom center */}
          {game.hud.flashText && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 animate-bounce">
              <span
                className="text-sm font-bold font-mono px-3 py-1 rounded-lg bg-ep-bg/80 backdrop-blur-sm"
                style={{ color: game.hud.flashColor }}
              >
                {game.hud.flashText}
              </span>
            </div>
          )}
        </>
      )}

      {/* ── Round Summary ── */}
      {game.summary && game.summary.score > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-ep-card/95 backdrop-blur-sm rounded-2xl p-5 border border-accent/20 text-center shadow-card">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Game Bonus</p>
            <p className="text-2xl font-mono font-bold text-accent">+{game.summary.score} XP</p>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-text-secondary">
              <span>Best Combo: {game.summary.maxCombo}x</span>
              <span>Collected: {game.summary.itemsCollected}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sound toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          soundManager.init();
          store.toggleSound();
        }}
        className="absolute bottom-2 right-2 pointer-events-auto w-7 h-7 rounded-full bg-ep-bg/60 backdrop-blur-sm border border-ep-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        style={{ zIndex: 6 }}
      >
        <span className="text-xs">{store.soundEnabled ? "🔊" : "🔇"}</span>
      </button>
    </div>
  );
}
