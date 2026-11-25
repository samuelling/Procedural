// The valley around the plot (2 MB rung): the first step outward in powers of ten. The same height field carries on past
// the plot's edge; beyond it the land is lifted into a valley whose floor follows the stream, with ridges a few hundred
// metres high either side, and a lake where the stream slows. The nearest 110 m get simple trees (a trunk and a crown
// or two); past that the forest is the ground's own colour and texture. Rings of vertices widen outward, so the mesh is
// fine at the plot's edge and coarse at the horizon.
/* global TIER */
import { fbm, rng } from './noise.js';

export function valley({ G, Hgt, strm, hs, seed, cap, low }) {
  const { abs, max, min, exp, sqrt, hypot, pow, cos, sin, PI } = Math, sm = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };   // (inside, so the lower rungs' builds drop it all)
  const R = 3000, K = low ? 34 : 48, N = low ? 64 : 128, ox = (seed % 977) * 0.37, oz = (seed % 613) * 0.53;
  const out = (x, z) => max(abs(x), abs(z)) - hs;                          // metres outside the plot
  const lake = strm && { x: hs + 700, z: strm.zc(hs + 700), rx: 380, rz: 240 };
  if (lake) lake.y = strm.lvl(lake.x - lake.rx) - 0.05;
  const inLake = (x, z) => (lake ? ((x - lake.x) / lake.rx) ** 2 + ((z - lake.z) / lake.rz) ** 2 : 9);
  const amp = G.cl && G.cl.mean != null ? min(1500, max(40, (G.cl.mean - G.cl.elev) * 0.9)) : 420;   // on Earth, how high the ridges stand over the floor is measured (the cell's mean over its lowest point); their shape is not
  const ridge = (x, z) => 1 - abs(2 * fbm(x * 0.0011 + ox, 5, z * 0.0011 + oz, 4) - 1);
  const H = (x, z) => {
    const b = Hgt(x, z), d = out(x, z); if (d <= 0) return b;
    const v = abs(strm ? z - strm.zc(x) : z), lk = inLake(x, z);
    let m = 55 * (1 - exp(-((v / 260) ** 2))) + amp * sm(350, 1900, v) * (0.45 + 0.8 * ridge(x, z)) + 180 * (fbm(x * 0.004 + oz, 2, z * 0.004 + ox, 3) - 0.5) * sm(80, 300, v);
    if (lake) m *= sm(1, 2.4, lk);                                          // the valley floor flattens round the lake
    let h = b + sm(0, 90, d) * m;
    if (lake && lk < 1.6) h = min(h, lake.y + 0.4 + (lk - 1) * 6 - (lk < 1 ? 7 * (1 - lk) : 0));   // the lake's bowl
    return h;
  };
  // the ground: K rings of 4N vertices, each ring a square a little larger than the last
  const V = [], I = [], M = 4 * N;
  for (let k = 0; k <= K; k++) {
    const h = hs * pow(R / hs, k / K), e = max(0.3, h * 0.04);
    for (let i = 0; i < M; i++) {
      const s = i % N / N * 2 - 1, side = (i / N) | 0, x = side === 0 ? s * h : side === 1 ? h : side === 2 ? -s * h : -h, z = side === 0 ? -h : side === 1 ? s * h : side === 2 ? h : -s * h;
      const y = H(x, z) - (k ? 0 : 0.02), nx = H(x - e, z) - H(x + e, z), nz = H(x, z - e) - H(x, z + e), l = hypot(nx, 2 * e, nz);
      const wet = strm ? max(0, 1 - max(0, strm.dist(x, z)) / 14) : 0;
      V.push(x, y, z, nx / l, 2 * e / l, nz / l, max(0, out(x, z)), max(wet, lake ? sm(2.2, 1, inLake(x, z)) : 0));
    }
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < M; i++) { const a = k * M + i, b = k * M + (i + 1) % M; I.push(a, a + M, b, b, a + M, b + M); }
  // the river beyond the plot, and the lake, as water the same shader draws
  const wv = [], wi = [];
  if (strm) {
    const strip = (x0, x1, n) => {
      const b = wv.length / 8;
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = lake && x > lake.x - lake.rx ? lake.y : strm.lvl(x), ww = strm.wid(x) + 0.8; for (let j = 0; j <= 4; j++) { const z = strm.zc(x) + (j / 4 * 2 - 1) * ww; wv.push(x, y, z, 0, 1, 0, y - H(x, z), x); } }
      for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { const a = b + i * 5 + j; wi.push(a, a + 1, a + 5, a + 1, a + 6, a + 5); }
    };
    strip(-R * 0.8, -hs, 140); strip(hs, lake ? lake.x : R * 0.8, 120); if (lake) strip(lake.x + lake.rx, R * 0.8, 90);
    if (lake) {
      const b = wv.length / 8, n = 64, m = 10;
      for (let r = 0; r <= m; r++) for (let i = 0; i < n; i++) { const a = i / n * PI * 2, q = r / m * 1.12, x = lake.x + cos(a) * lake.rx * q, z = lake.z + sin(a) * lake.rz * q; wv.push(x, lake.y, z, 0, 1, 0, lake.y - H(x, z), x); }
      for (let r = 0; r < m; r++) for (let i = 0; i < n; i++) { const a = b + r * n + i, c = b + r * n + (i + 1) % n; wi.push(a, c, a + n, c, c + n, a + n); }
    }
  }
  // the nearest band of forest: a trunk and a crown or a stack of them, chosen as the plot chooses its trees
  const rnd = rng(seed ^ 0xfa11), rr = (a, b) => a + (b - a) * rnd(), tot = G.trees.reduce((s, t) => s + t.n, 0);
  let n = 0;
  for (let tries = 0, want = G.trees.length ? (low ? 600 : 1300) : 0; n < want && tries < want * 4; tries++) {
    const x = rr(-hs - 110, hs + 110), z = rr(-hs - 110, hs + 110), d = out(x, z); if (d < 1.5) continue;
    if ((strm && strm.dist(x, z) < 1.2) || inLake(x, z) < 1.15) continue;
    const wet = strm ? max(0, 1 - max(0, strm.dist(x, z)) / 12) : 0.3 + 0.4 * fbm(x * 0.05, 1, z * 0.05, 2);
    let si = 0, best = -1; for (let i = 0; i < G.trees.length; i++) { const sp = G.trees[i]; if (sp.gone) continue; const f = (sp.n / tot) * (1.2 - abs(wet - sp.wet)) * rr(0.4, 1.6); if (f > best) { best = f; si = i; } }
    const sp = G.trees[si], Ht = rr(sp.H[0], sp.H[1]) * rr(0.7, 1.05), y = H(x, z), cr = min(5, sp.cr) * rr(0.7, 1.1), sd = si + rnd() * 0.98;
    cap([x, y - 0.2, z], 0.04 + 0.009 * Ht, [x, y + Ht * 0.5, z], 0.025 + 0.004 * Ht, 0, Ht * 0.5, sd, 0);
    if (sp.leaf.t === 1) {                                                  // a spire of three, narrowing up
      cap([x, y + Ht * 0.2, z], cr * 0.95, [x, y + Ht * 0.5, z], cr * 0.65, 0, 1, sd, 21);
      cap([x, y + Ht * 0.48, z], cr * 0.68, [x, y + Ht * 0.78, z], cr * 0.38, 0, 1, sd, 21);
      cap([x, y + Ht * 0.76, z], cr * 0.4, [x, y + Ht, z], cr * 0.06, 0, 1, sd, 21);
    } else for (let k = 0, m = 2 + ((rnd() * 2) | 0); k < m; k++) {          // a broad crown, in two or three lobes
      const a = rnd() * PI * 2, o = cr * 0.35 * (k ? 1 : 0), h = Ht * rr(0.58, 0.78);
      cap([x + cos(a) * o, y + h, z + sin(a) * o], cr * rr(0.55, 0.8), [x + cos(a) * o * 1.2, y + h + cr * 0.3, z + sin(a) * o * 1.2], cr * rr(0.45, 0.65), 0, 1, sd, 21);
    }
    n++;
  }
  return { far: { v: new Float32Array(V), i: new Uint16Array(I) }, farWater: wv.length ? { v: new Float32Array(wv), i: new Uint16Array(wi) } : null, farH: H, lake, farTrees: n };
}
