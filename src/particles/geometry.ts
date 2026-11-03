import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

// Deterministic buffers: all particle identities survive every species transition.
export function random(seed: number) { const n = Math.sin(seed * 127.1 + 78.233) * 43758.5453; return n - Math.floor(n); }
const tau = Math.PI * 2;
const bezier = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

export type Branch = { a: Vector3; b: Vector3; curve: Vector3; radius: number; depth: number; start: number; end: number };
export function branches(): Branch[] {
  const result: Branch[] = [];
  function grow(a: Vector3, dir: Vector3, length: number, depth: number, seed: number, start: number) {
    const b = a.clone().addScaledVector(dir, length);
    const end = start + (depth === 0 ? .23 : .13);
    const curve = a.clone().lerp(b,.5).add(new Vector3(Math.sin(seed)*length*.26,0,Math.cos(seed)*length*.20));
    result.push({ a, b, curve, radius: .16 * .61 ** depth, depth, start, end });
    if (depth >= 5) return;
    const count = depth < 2 ? 3 : 2;
    for (let k = 0; k < count; k++) {
      const angle = seed * 2.399 + k * tau / count;
      const spread = .65 + random(seed + k * 7) * .4;
      const next = new Vector3(dir.x * .65 + Math.cos(angle) * spread, .65 + random(seed + k) * .45, dir.z * .65 + Math.sin(angle) * spread).normalize();
      grow(b, next, length * (.59 + random(seed * 3 + k) * .25), depth + 1, seed * 3 + k + 5, end);
    }
  }
  grow(new Vector3(0, -2.3, 0), new Vector3(.06, 1, .02).normalize(), 1.45, 0, 3, 0);
  return result;
}
export function branchPoint(b:Branch,t:number) {
  return b.a.clone().multiplyScalar((1-t)*(1-t)).addScaledVector(b.curve,2*(1-t)*t).addScaledVector(b.b,t*t);
}
export function wingPoint(u:number,radial:number,side:number,lower:boolean):[number,number,number] {
  const t=u<.5?u*2:(u-.5)*2;
  let x:number,y:number;
  if(!lower){
    x=u<.5?bezier(.04,.45,2.05,1.72,t):bezier(1.72,1.57,.4,.04,t);
    y=u<.5?bezier(.08,1.5,1.72,.48,t):bezier(.48,-.13,-.24,.08,t);
  }else{
    x=u<.5?bezier(.03,.68,1.55,.84,t):bezier(.84,.37,.12,.03,t);
    y=u<.5?bezier(-.06,-.12,-.78,-1.1,t):bezier(-1.1,-1.55,-.53,-.06,t);
  }
  return [x*radial*side,y*radial,Math.sin(radial*Math.PI)*.16];
}

export function particleGeometry(count: number) {
  const geometry = new BufferGeometry();
  const butterfly = new Float32Array(count * 4);
  const flower = new Float32Array(count * 4);
  const tree = new Float32Array(count * 4);
  const seeds = new Float32Array(count * 4);
  const positions = new Float32Array(count * 3);
  const limbs = branches();
  const tips = limbs.filter(l => l.depth >= 3);
  const weights = limbs.map(b => b.a.distanceTo(b.b) * (b.depth < 3 ? 3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) {
    const a = random(i * 8 + 1), b = random(i * 8 + 2), c = random(i * 8 + 3), d = random(i * 8 + 4);
    seeds.set([a, b, c, d], i * 4);
    let x = 0, y = 0, z = 0, type = 0;
    if (a < .89) {
      const side = b < .5 ? -1 : 1, lower = c < .36;
      let u = random(i + 988);
      // A minority of particles sample exact veins and rims rather than uniform fill.
      if (d < .17) u = Math.floor(u * 12) / 12 + (a - .5) * .005;
      const radial = d > .81 ? .985 + a * .015 : Math.sqrt(random(i + 558));
      const t = u < .5 ? u * 2 : (u - .5) * 2;
      if (!lower) {
        x = u < .5 ? bezier(.04, .45, 2.05, 1.72, t) : bezier(1.72, 1.57, .4, .04, t);
        y = u < .5 ? bezier(.08, 1.5, 1.72, .48, t) : bezier(.48, -.13, -.24, .08, t);
      } else {
        x = u < .5 ? bezier(.03, .68, 1.55, .84, t) : bezier(.84, .37, .12, .03, t);
        y = u < .5 ? bezier(-.06, -.12, -.78, -1.1, t) : bezier(-1.1, -1.55, -.53, -.06, t);
      }
      x *= radial * side; y *= radial;
      z = Math.sin(radial * Math.PI) * .16 + (random(i + 8) - .5) * .035;
      type = 1;
    } else if (a < .95) {
      const r = .038 * Math.sin(b * Math.PI) + .015;
      x = Math.cos(c * tau) * r; y = (b - .5) * .8; z = Math.sin(c * tau) * r;
    } else if (a < .97) {
      const side = b < .5 ? -1 : 1;
      x = side * (.03 + c * .25); y = .35 + c * .48; z = Math.sin(c * Math.PI) * .07;
    } else { type = 2; x = (b - .5) * .5; y = -c * 1.8; z = (d - .5) * .5; }
    butterfly.set([x, y, z, type], i * 4);

    if (a < .91) {
      const layer = Math.floor(b * 5), petals = 5 + layer * 2;
      const petal = Math.floor(c * petals);
      const v = d < .18 ? .97 + random(i + 45) * .03 : Math.sqrt(random(i + 55));
      const cross = d > .88 ? (c < .5 ? -.99 : .99) : (random(i + 99) * 2 - 1);
      flower.set([petal * tau / petals + layer * .55, v, cross, layer], i * 4);
    } else if (a < .96) flower.set([b * tau, c, d, -1], i * 4);
    else flower.set([b * tau, c, d, -2], i * 4);

    if (a < .28) {
      let target = b * total, index = 0;
      while (index < limbs.length - 1 && target > weights[index]) target -= weights[index++];
      const limb = limbs[index];
      const along = c;
      const p = branchPoint(limb,along);
      const dir = limb.b.clone().sub(limb.a).normalize();
      const normal = new Vector3().crossVectors(dir, new Vector3(0, 0, 1)).normalize();
      const binormal = new Vector3().crossVectors(dir, normal);
      const r = limb.radius * (1 - along * .45) * (.5 + random(i + 23) * .5);
      p.addScaledVector(normal, Math.cos(d * tau) * r).addScaledVector(binormal, Math.sin(d * tau) * r);
      tree.set([p.x, p.y, p.z, limb.start + (limb.end - limb.start) * along], i * 4);
    } else {
      const limb = tips[Math.floor(b * tips.length)];
      const r = Math.cbrt(c) * (.30 + random(i + 36) * .30);
      const angle = d * tau, vertical = random(i + 76) * 2 - 1;
      tree.set([limb.b.x + Math.cos(angle) * r, limb.b.y + vertical * r * .9, limb.b.z + Math.sin(angle) * r,
        Math.min(.99, limb.end + .04 + c * .08)], i * 4);
    }
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aButterfly', new BufferAttribute(butterfly, 4));
  geometry.setAttribute('aFlower', new BufferAttribute(flower, 4));
  geometry.setAttribute('aTree', new BufferAttribute(tree, 4));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  return geometry;
}
