import { clamp, type Context, type Kind, type Point, type Side, type Signal } from './gestures';
export type { Kind } from './gestures';
export type Phase = 'idle' | 'scatter' | 'drift' | 'gather' | 'materialize' | 'alive';
export const codes = { butterfly: 0, flower: 1, tree: 2 };
export class Life {
  kind: Kind | null = null;
  previous: Kind | null = null;
  side: Side | null = null;
  phase: Phase = 'idle';
  clock = 0; time = 0; morph = 0; dispersion = 1; opacity = 0;
  bloom = .25; growth = 0; rotation = 0;
  oldBloom = .25; oldGrowth = 0; oldRotation = 0;
  reveal = 0; oldReveal = 0;
  position: Point = { x: .5, y: .5 };
  oldPosition: Point = { x: .5, y: .5 };
  private cooldown = 0;
  private velocity = { x: 0, y: 0 };
  get locked() { return this.phase === 'scatter' || this.phase === 'drift' || this.phase === 'gather'; }
  get context(): Context { return { kind: this.kind, side: this.side, locked: this.locked }; }
  reset() {
    this.kind = null; this.previous = null; this.side = null; this.phase = 'idle';
    this.clock = 0; this.morph = 0; this.dispersion = 1; this.opacity = 0;
    this.bloom = .25; this.growth = 0; this.rotation = 0; this.cooldown = 0;
    this.reveal = 0; this.oldReveal = 0;
    this.position = { x: .5, y: .5 }; this.velocity = { x: 0, y: 0 };
  }
  private change(kind: Kind, side: Side) {
    this.previous = this.kind; this.oldBloom = this.bloom;
    this.oldGrowth = this.growth; this.oldRotation = this.rotation;
    this.oldReveal = this.reveal; this.reveal = 0;
    this.oldPosition = { ...this.position };
    this.kind = kind; this.side = side; this.clock = 0;
    this.phase = this.previous ? 'scatter' : 'gather';
    this.dispersion = this.previous ? 0 : 1; this.morph = this.previous ? 0 : 1;
    this.bloom = .1; this.growth = .10; this.rotation = 0;
    this.position = { x: .5, y: .5 }; this.velocity = { x: 0, y: 0 };
  }
  step(dt: number, signal?: Signal, now = performance.now()) {
    this.time += dt; this.clock += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    const fresh = !!signal && now - signal.time < 650;
    if (fresh && signal.intent && signal.side && !this.locked && !this.cooldown) {
      if (signal.intent !== this.kind) this.change(signal.intent, signal.side);
      else this.side = signal.side;
    }
    if (!this.kind) return;
    const smooth = (v: number, target: number, rate: number) => v + (target - v) * (1 - Math.exp(-dt * rate));
    if (fresh && signal.side === this.side) {
      if (this.kind === 'flower' && signal.hands.some(h => h.side === this.side && (h.pair || (h.folded && h.pinch < .44))))
        this.bloom = smooth(this.bloom, signal.aperture, 5);
      if (this.kind === 'tree' && signal.hands.some(h => h.side === this.side && h.open)) {
        this.growth = smooth(this.growth, Math.max(this.growth, .1 + signal.rise * .9), 5);
        this.rotation = smooth(this.rotation, signal.rotation, 6);
      }
      if (this.kind === 'butterfly' && signal.tip && signal.hands.some(h => h.side === 'Left' && h.index)) {
        const target = { x: clamp(signal.tip.x, .12, .88), y: clamp(signal.tip.y - .045, .16, .82) };
        for (const axis of ['x', 'y'] as const) {
          // Exponential filter is stable at variable frame rates and reaches 95% in ~136 ms.
          // It deliberately avoids a second long spring delay after camera inference.
          this.position[axis] = smooth(this.position[axis], target[axis], 22);
        }
      }
    }
    this.opacity = smooth(this.opacity, 1, 4);
    if (this.phase === 'scatter') {
      this.dispersion = clamp((this.clock - .22) / .72);
      if (this.clock >= .94) { this.phase = 'drift'; this.clock = 0; }
    } else if (this.phase === 'drift') {
      this.dispersion = 1; this.morph = clamp(this.clock / .22);
      if (this.clock >= .22) { this.phase = 'gather'; this.clock = 0; this.morph = 1; }
    } else if (this.phase === 'gather') {
      this.dispersion = 1 - clamp(this.clock / 1.2);
      if (this.clock >= 1.2) { this.phase = 'materialize'; this.clock = 0; this.dispersion = 0; this.cooldown = .12; }
    } else if (this.phase === 'materialize') {
      this.reveal = clamp(this.clock / 1.15);
      if (this.reveal >= 1) { this.phase = 'alive'; this.clock = 0; }
    }
  }
}

