export type Kind = 'butterfly' | 'flower' | 'tree';
export type Side = 'Left' | 'Right';
export type Point = { x: number; y: number; z?: number };
export type Hand = {
  side: Side; points: Point[]; center: Point; open: boolean; index: boolean;
  thumb: boolean; folded: boolean; pinch: number; pair: boolean; angle: number;
  relaxedOpen?: boolean; palmSize?: number;
};
export type Context = { kind: Kind | null; side: Side | null; locked: boolean };
export type Signal = {
  hands: Hand[]; intent: Kind | null; side: Side | null; tip?: Point;
  aperture: number; rise: number; rotation: number; label: string; time: number;
};
export const clamp = (n: number, low = 0, high = 1) => Math.min(high, Math.max(low, n));
const deltaAngle = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function classify(points: Point[], side: Side, aspect = 4 / 3): Hand {
  const dist = (a: Point, b: Point) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const scale = Math.max(.025, dist(points[0], points[9]));
  const extended = [8, 12, 16, 20].map(t =>
    dist(points[t], points[0]) > dist(points[t - 2], points[0]) * 1.19 &&
    dist(points[t], points[t - 3]) > scale * .48);
  const thumb = dist(points[4], points[17]) > dist(points[3], points[17]) * 1.13 &&
    dist(points[4], points[5]) > scale * .38;
  // Dedicated relaxed open-palm gate for flower switching; original life rules stay unchanged.
  const relaxed=[8,12,16,20].filter(t=>dist(points[t],points[0])>dist(points[t-2],points[0])*1.06&&dist(points[t],points[t-3])>scale*.32).length;
  const relaxedOpen=relaxed>=3&&dist(points[4],points[5])>scale*.22;
  const folded = !extended[1] && !extended[2] && !extended[3];
  const pinch = dist(points[4], points[8]) / scale;
  const center = { x: (points[0].x + points[9].x) / 2, y: (points[0].y + points[9].y) / 2 };
  const acrossX = (points[5].x - points[17].x) * (side === 'Left' ? 1 : -1);
  const acrossZ = ((points[5].z ?? 0) - (points[17].z ?? 0)) * (side === 'Left' ? 1 : -1);
  const yaw = Math.atan2(acrossZ, Math.abs(acrossX) + .025);
  const roll = Math.atan2((points[0].x - points[9].x) * aspect, points[0].y - points[9].y);
  return { points, side, center, thumb, folded, pinch, relaxedOpen, palmSize:scale,
    open: extended.every(Boolean) && thumb,
    index: extended[0] && folded,
    pair: folded && ((extended[0] && thumb) || (pinch < .32 && dist(points[8], points[0]) > scale * .75)),
    angle: yaw * 1.4 + roll * 1.3 };
}

type Lift = { start: number; last: number; base: number; max: number; angle: number; rotation: number };
export class GestureEngine {
  private lifts = new Map<Side, Lift>();
  private candidate = ''; private since = 0;
  reset() { this.lifts.clear(); this.candidate = ''; this.since = 0; }

  update(hands: Hand[], t: number, context: Context = { kind: null, side: null, locked: false }): Signal {
    for (const side of ['Left', 'Right'] as Side[]) {
      const hand = hands.find(h => h.side === side);
      const old = this.lifts.get(side);
      if (hand?.open) {
        if (!old || t - old.last > 550) {
          this.lifts.set(side, { start: t, last: t, base: hand.center.y, max: 0, angle: hand.angle, rotation: 0 });
        } else {
          if (t - old.start < 250) old.base = Math.max(old.base, hand.center.y);
          else old.max = Math.max(old.max, clamp((old.base - hand.center.y) / .32));
          old.rotation += deltaAngle(hand.angle, old.angle);
          old.angle = hand.angle; old.last = t;
        }
      } else if (old && t - old.last > 550) this.lifts.delete(side);
    }
    const valid = (h: Hand, kind: Kind): boolean => {
      if (kind === 'butterfly') return h.side === 'Left' && h.index;
      if (kind === 'flower') return h.side === 'Right' && (h.pair || (context.kind === 'flower' && context.side === h.side && h.folded && h.pinch < .44));
      return h.side === 'Left' && h.open;
    };
    let selected: Hand | undefined;
    let intent: Kind | null = null;
    // Valid owner retains control; otherwise tree > flower > butterfly, right hand wins ties.
    const owner = hands.find(h => h.side === context.side);
    if (owner && context.kind && valid(owner, context.kind)) { selected = owner; intent = context.kind; }
    else {
      for (const kind of ['tree', 'flower', 'butterfly'] as Kind[]) {
        const ordered = [...hands].sort((a, b) => Number(b.side === 'Right') - Number(a.side === 'Right'));
        selected = ordered.find(h => valid(h, kind));
        if (selected) { intent = kind; break; }
      }
    }
    const key = intent && selected ? intent + ':' + selected.side : '';
    if (key !== this.candidate) { this.candidate = key; this.since = t; }
    const stable = !!key && t - this.since >= 180;
    const lift = selected ? this.lifts.get(selected.side) : undefined;
    return {
      hands, intent: stable && !context.locked ? intent : null,
      side: selected?.side ?? null, tip: selected?.points[8],
      aperture: selected ? clamp((selected.pinch - .2) / 1.15) : 0,
      rise: lift?.max ?? 0, rotation: lift?.rotation ?? 0, time: t,
      label: selected ? (selected.side === 'Left' ? '左' : '右') + '手 · ' +
        (intent === 'butterfly' ? '食指' : intent === 'flower' ? '双指' : '抬升') + (stable ? '' : ' · 稳定中') : '等待手势',
    };
  }
}

