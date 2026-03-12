/* ── Web Audio Synth Sound Manager ────────────── */

class SoundManager {
  private ctx: AudioContext | null = null;
  private _enabled = false;

  get enabled() { return this._enabled; }
  set enabled(v: boolean) { this._enabled = v; }

  /** Must call after a user gesture (click) */
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      // Web Audio not available
    }
  }

  /** Short ascending arpeggio — pitch rises with combo */
  playCollect(combo: number) {
    if (!this.ctx || !this._enabled) return;
    const base = 520 + Math.min(combo, 15) * 30;
    this.tone(base, 0.04, "sine", 0);
    this.tone(base * 1.25, 0.04, "sine", 0.05);
    this.tone(base * 1.5, 0.04, "sine", 0.10);
  }

  /** Low buzzer for obstacle hit */
  playObstacle() {
    if (!this.ctx || !this._enabled) return;
    this.tone(140, 0.12, "square", 0);
  }

  /** Rising chime for combo milestones */
  playComboMilestone() {
    if (!this.ctx || !this._enabled) return;
    const notes = [440, 554, 659, 880, 1047];
    notes.forEach((f, i) => this.tone(f, 0.06, "sine", i * 0.06));
  }

  /** Shield activation */
  playShield() {
    if (!this.ctx || !this._enabled) return;
    this.tone(330, 0.15, "triangle", 0);
    this.tone(440, 0.15, "triangle", 0.08);
  }

  private tone(freq: number, dur: number, type: OscillatorType, delay: number) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    } catch {
      // Ignore errors (e.g. too many oscillators)
    }
  }
}

export const soundManager = new SoundManager();
