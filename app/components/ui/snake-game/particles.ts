/* ── Particle System ──────────────────────────── */

export interface GameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;     // 1.0 → 0.0
  size: number;
  color: string;    // rgba color string e.g. "245, 158, 11"
}

const MAX_PARTICLES = 100;

export function createParticles(): GameParticle[] {
  return [];
}

/** Spawn a burst of particles at (x, y) in the given color */
export function spawnBurst(
  particles: GameParticle[],
  x: number,
  y: number,
  color: string,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 1.5 + Math.random() * 3;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      size: 1.5 + Math.random() * 2,
      color,
    });
  }

  // Cap total
  if (particles.length > MAX_PARTICLES) {
    particles.splice(0, particles.length - MAX_PARTICLES);
  }
}

/** Tick all particles, removing dead ones. Returns updated array. */
export function tickParticles(particles: GameParticle[]): GameParticle[] {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // gravity
    p.vx *= 0.98; // friction
    p.life -= 0.025;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
  return particles;
}

/** Draw all particles on the given context */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: GameParticle[],
): void {
  for (const p of particles) {
    const a = p.life * 0.8;
    ctx.fillStyle = `rgba(${p.color}, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
}
