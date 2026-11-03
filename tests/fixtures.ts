import type { Point, Side } from '../src/gestures';

// Synthetic landmarks only: exercises classification, never used by the production app.
export function landmarks(pose: 'index' | 'pair' | 'pinch' | 'open' | 'fist', side: Side = 'Left', y = .65, opening = 1, rotation = 0): Point[] {
  const p: Point[] = Array.from({ length: 21 }, () => ({ x: .5, y: .7, z: 0 }));
  p[0] = { x: .5, y: .8, z: 0 };
  const xs = [.44, .5, .55, .6];
  for (let f = 0; f < 4; f++) {
    const base = 5 + f * 4, x = xs[f];
    const extended = pose === 'open' || (f === 0 && pose !== 'fist' && pose !== 'pinch');
    p[base] = { x, y: .62, z: 0 };
    p[base + 1] = { x, y: .50, z: 0 };
    p[base + 2] = { x, y: extended ? .39 : .64, z: 0 };
    p[base + 3] = { x, y: extended ? .29 : .72, z: 0 };
  }
  p[1] = { x: .43, y: .75, z: 0 };
  p[2] = { x: .39, y: .70, z: 0 };
  p[3] = { x: .39, y: .65, z: 0 };
  p[4] = { x: .48, y: .66, z: 0 };
  if (pose === 'open' || pose === 'pair') p[4] = { x: .25, y: .54, z: 0 };
  if (pose === 'pair' || pose === 'pinch') {
    // Position thumb near index for a pinch, wide enough for full bloom at aperture=1.
    const tip = pose === 'pinch' ? { x: .40, y: .53, z: 0 } : p[8];
    p[8] = tip;
    p[4] = { x: tip.x - (.015 + opening * .19), y: tip.y + opening * .10, z: 0 };
    p[3] = { x: .40, y: .65, z: 0 };
  }
  return p.map(point => {
    const dx = point.x - .5, dy = point.y - .71;
    return { x: .5 + (dx * Math.cos(rotation) - dy * Math.sin(rotation)) * (side === 'Left' ? 1 : -1),
      y: y + dx * Math.sin(rotation) + dy * Math.cos(rotation), z: point.z };
  });
}
