// Phenotype from genotype: reads a genome and grows the plot. Three kinds of thing come out:
//   capsules (12 floats: x0 y0 z0 r0, x1 y1 z1 r1, path0 path1 species.seed kind): wood, logs, mushrooms
//   cards    (12 floats: x y z size, ux uy uz type.shade, nx ny nz palette.seed): leaf clusters, fronds, grass
//   meshes   the ground, the plot's cut sides, and a few stones that are placed many times
import { rng, fbm } from './noise.js';
const { PI, sin, cos, hypot, abs, max, min, round, pow, exp, log, sqrt, floor } = Math, TAU = PI * 2, RAD = PI / 180;
const nrm = (v) => { const l = hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const perp = (n, u) => { const k = n[0] * u[0] + n[1] * u[1] + n[2] * u[2]; return nrm([n[0] - u[0] * k, n[1] - u[1] * k, n[2] - u[2] * k]); };
const UP = [0, 1, 0];

// a stone: a noisy sphere cut by a few random planes
function stone(sd, sub, rnd) {
  const t = (1 + sqrt(5)) / 2;
  let P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
  let Fc = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const mid = new Map(), m = (a, b) => { const k = a < b ? a * 65536 + b : b * 65536 + a; if (!mid.has(k)) { mid.set(k, P.length); P.push(nrm([P[a][0] + P[b][0], P[a][1] + P[b][1], P[a][2] + P[b][2]])); } return mid.get(k); }, N = [];
    for (const [a, b, c] of Fc) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); N.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    Fc = N;
  }
  const cuts = []; for (let i = 0; i < 7; i++) cuts.push([nrm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]), 0.62 + rnd() * 0.33]);
  const pos = P.map((d) => {
    let r = 1 + 0.76 * (fbm(d[0] * 1.4 + sd, d[1] * 1.4, d[2] * 1.4, 3) - 0.5) + 0.12 * (fbm(d[0] * 5 + sd, d[1] * 5, d[2] * 5, 2) - 0.5);
    for (const [n, k] of cuts) { const c = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]; if (c > 0.05) r = min(r, k / c); }
    return [d[0] * r, d[1] * r, d[2] * r];
  });
  const nr = pos.map(() => [0, 0, 0]);
  for (const [a, b, c] of Fc) { const n = cross([pos[b][0] - pos[a][0], pos[b][1] - pos[a][1], pos[b][2] - pos[a][2]], [pos[c][0] - pos[a][0], pos[c][1] - pos[a][1], pos[c][2] - pos[a][2]]); for (const i of [a, b, c]) { nr[i][0] += n[0]; nr[i][1] += n[1]; nr[i][2] += n[2]; } }
  const v = new Float32Array(pos.length * 8);
  pos.forEach((p, i) => { const n = nrm(nr[i]); v.set([p[0], p[1], p[2], n[0], n[1], n[2], 1, 0], i * 8); });
  return { v, i: new Uint16Array(Fc.flat()) };
}

// den scales every species' stem count; above 1 the trees are also allowed to stand closer
/* global TIER */
import { tl } from './fx.js';
export function build(G, seed, q = 1, den = 1, stand) {
  let rnd = rng(seed); const rr = (a, b) => a + (b - a) * rnd(), gs = () => sqrt(-2 * log(1 - rnd())) * cos(TAU * rnd());
  const S = G.size, hs = S / 2, L = G.land, F = G.floor, ox = rnd() * 100, oz = rnd() * 100, low = q < 1;
  // the two fields everything else reads: height of the ground, and how wet it is (hollows are wetter)
  let Hgt = (x, z) => L.amp * 2 * (fbm(x * L.f + ox, 0, z * L.f + oz, 4) - 0.5) + L.tilt * x + L.amp * 0.3 * (fbm(x * L.f * 3.3 + oz, 9, z * L.f * 3.3 + ox, 2) - 0.5);
  let wet = (x, z) => min(1, max(0, fbm(x * 0.045 + oz + 31, 3, z * 0.045 + ox, 3) * 1.5 - 0.25 - Hgt(x, z) / (L.amp * 6)));
  // above the 20 kB rung a stream crosses the plot. It falls steadily from one side to the other, the land is drawn
  // down to it over a few metres to make a valley, it widens into a pool, and everything nearby is wetter.
  let strm = null;
  if (TIER > 2 && L.stream) {
    const [sw, sa, sp, sr] = L.stream, H0 = Hgt, W0 = wet, ph = rnd() * TAU, px = sp * hs, sm = (t) => { t = min(1, max(0, t)); return t * t * (3 - 2 * t); };
    const zc = (x) => sa * (sin(x * 0.085 + ph) + 0.45 * sin(x * 0.21 + ph * 2.3)), wid = (x) => sw + sr * exp(-(((x - px) / (sr * 0.9 + 1)) ** 2));
    let y0 = 1e9; for (let x = -hs; x <= hs; x += 2) y0 = min(y0, H0(x, zc(x)) + 0.006 * (x + hs));
    const bed = (x) => y0 - 0.3 - 0.006 * (x + hs), dist = (x, z) => abs(z - zc(x)) - wid(x);           // metres outside the water's edge
    Hgt = (x, z) => { const d = dist(x, z), w = wid(x), b = bed(x); return d < 0 ? b - 0.55 * sqrt(w / sw) * (1 - ((d + w) / w) ** 2) : b + (H0(x, z) - b) * sm(d / 7); };
    wet = (x, z) => max(W0(x, z), 1 - max(0, dist(x, z)) / 6);
    // beavers (2 MB rung): a dam just below the pool holds the water back, and it spreads over the low ground behind
    const fl = TIER > 3 && stand && stand.world ? stand.world.dam : 0, xd = px + sr + 3, lvl = (x) => max(bed(x) - 0.1, fl > 0 && x < xd ? bed(xd) - 0.1 + fl * 0.9 : -1e9);
    strm = { zc, wid, lvl, dist, xd, px, fl, deep: (x, z) => fl > 0 && dist(x, z) > 0 && lvl(x) - Hgt(x, z) > 0.12 };
  }
  const caps = [], cards = [], st = { trees: 0, wood: 0, leaves: 0, rocks: 0, under: 0 };
  const cap = (a, ra, b, rb, s0, s1, id, k) => caps.push(a[0], a[1], a[2], ra, b[0], b[1], b[2], rb, s0, s1, id, k);
  const card = (p, size, u, type, ao, n, pal, sd) => cards.push(p[0], p[1], p[2], size, u[0], u[1], u[2], type + min(1, max(0, ao)) * 0.98, n[0], n[1], n[2], pal + min(0.98, sd));
  const placed = [], blockers = [], damp = [];

  // ---- stones, in outcrops: where a noise field is high
  const rocks = [[], [], [], []];
  const rock = (m, x, z, s, sq, moss) => {
    const a = rnd() * TAU, t = gs() * 0.2, ax = nrm([gs(), 0, gs()]), sa = sin(a / 2), ca = cos(a / 2), sb = sin(t / 2), cb = cos(t / 2), b = [ax[0] * sb, 0, ax[2] * sb, cb];
    const qt = [ca * b[0] + sa * b[2], sa * b[3], ca * b[2] - sa * b[0], ca * b[3]];   // yaw about y, after a small tilt
    rocks[m].push(x, Hgt(x, z) - s * sq * 0.3, z, s, qt[0], qt[1], qt[2], qt[3], sq, moss, rnd(), 0); st.rocks++;
  };
  for (let n = round(L.rock[0] * (low ? 0.7 : 1)), tries = 0; n > 0 && tries < 4000; tries++) {
    const x = rr(-hs + 1, hs - 1), z = rr(-hs + 1, hs - 1); if (fbm(x * 0.06 + ox + 50, 1, z * 0.06 + oz, 2) < 0.47) continue;
    const s = L.rock[1] * exp(gs() * 0.55); rock((rnd() * 3) | 0, x, z, s, rr(0.55, 0.95), rnd());
    placed.push({ x, z, cr: s * 1.1 }); blockers.push({ x, z, r: s }); damp.push([x + gs() * s, z + gs() * s]); n--;
    for (let j = 0; j < 3; j++) rock(3, x + gs() * s * 1.4, z + gs() * s * 1.4, rr(0.08, 0.26), 0.6, rr(0.4, 1));
  }
  for (let n = round(L.peb * (low ? 0.5 : 1)); n > 0; n--) rock(3, rr(-hs, hs), rr(-hs, hs), rr(0.04, 0.14), rr(0.5, 0.9), rnd());
  if (TIER > 2 && strm) for (let n = low ? 30 : 56; n > 0; n--) {                       // stones in and along the stream
    const x = rr(-hs + 1, hs - 1), z = strm.zc(x) + gs() * (strm.wid(x) * 0.7 + 0.4); if (abs(z) < hs - 1) rock((rnd() * 4) | 0, x, z, rr(0.12, 0.5) * (rnd() < 0.15 ? 2.2 : 1), rr(0.5, 0.9), rr(0.3, 1));
  }

  if (TIER > 3 && strm && strm.fl > 0) {                                     // the dam itself, and the lodge in the pool: sticks
    const X0 = strm.xd, lx = strm.px, lz = strm.zc(lx) + strm.wid(lx) * 0.45, ly = strm.lvl(lx), id = () => floor(rnd() * G.trees.length) + rnd() * 0.98;
    for (let k = round(12 + 30 * strm.fl); k > 0; k--) { const X = X0 + gs() * 0.5, Z = strm.zc(X0) + gs() * (strm.wid(X0) + 1.2), y = Hgt(X, Z) + rr(0, 0.25 + strm.fl * 0.8), a = PI / 2 + rr(-0.5, 0.5), l = rr(0.6, 1.6); cap([X - cos(a) * l, y + rr(-0.1, 0.1), Z - sin(a) * l], rr(0.05, 0.11), [X + cos(a) * l, y + rr(-0.1, 0.1), Z + sin(a) * l], rr(0.04, 0.08), 0, 1, id(), 1); }
    for (let k = 16; k > 0; k--) { const a = rnd() * TAU; cap([lx + cos(a) * 1.2, ly - 0.15, lz + sin(a) * 1.2], 0.07, [lx + gs() * 0.2, ly + 0.6, lz + gs() * 0.2], 0.05, 0, 1, id(), 1); }
  }

  // ---- trees
  const tree = (sp, si, x, z, Ht, sap, dd) => {                             // dd: dead, standing: no leaves, no twigs, grey wood
    const y0 = Hgt(x, z) - 0.2, segs = [], A = sp.ax, lf = sp.leaf, sc = sap ? 0.45 : 1, maxSeg = (sap ? 90 : 1500) * (low ? 0.6 : 1);
    const cb = rr(sp.clear[0], sp.clear[1]) * (sap ? 0.4 : 1), sid = si + rnd() * 0.98;
    const leafAt = (p, d, ao) => {
      const a = rnd() * TAU; let u, n;
      if (lf.t === 1) { const sd = nrm(cross(d, UP)), g = rnd() < 0.5 ? -1 : 1; u = nrm([sd[0] * g + d[0] * 0.55, -lf.dr * rr(0.4, 1.2), sd[2] * g + d[2] * 0.55]); n = perp(UP, u); }   // a flat spray lying out to one side
      else if (lf.t === 5) { u = nrm([d[0] + gs() * 0.35, d[1] + 0.25 + gs() * 0.35, d[2] + gs() * 0.35]); n = perp([cos(a), gs() * 0.5, sin(a)], u); }                        // a tuft along the twig
      else { u = nrm([d[0] * 0.5 + cos(a) * 0.8, d[1] * 0.5 - lf.dr + gs() * 0.3, d[2] * 0.5 + sin(a) * 0.8]); n = perp([gs() * 0.45, 1, gs() * 0.45], u); }                   // leaves held out to the light
      card([p[0] + gs() * 0.1, p[1] + gs() * 0.1, p[2] + gs() * 0.1], lf.sz * rr(0.75, 1.25), u, lf.t, ao, n, si, rnd()); st.leaves++;
    };
    let tips = [{ p: [x, y0, z], d: nrm([gs() * 0.04, 1, gs() * 0.04]), len: Ht, L0: Ht, o: 0, par: -1, s: 0, acc: rnd(), az: rnd() * TAU, fresh: 1 }];
    while (tips.length && segs.length < maxSeg) {
      const next = [];
      for (const t of tips) {
        const R = A[t.o], pos = 1 - t.len / t.L0, tr = (R.tr || 0) + (R.up || 0) * pos * pos, w = R.to * (t.o ? 1 : 0.4);
        const d = nrm([t.d[0] + gs() * R.to, t.d[1] + tr + gs() * w, t.d[2] + gs() * R.to]), sl = min(R.st * sc, t.len);
        const p = [t.p[0] + d[0] * sl, t.p[1] + d[1] * sl, t.p[2] + d[2] * sl];
        if (t.o && p[1] < Hgt(p[0], p[2]) + 0.25) continue;                       // a branch stops at the ground
        const i = segs.length; segs.push({ a: t.p, b: p, par: t.par, o: t.o, s0: t.s, s1: t.s + sl, load: 0.6, cont: -1 });
        if (!t.fresh) segs[t.par].cont = i;
        const mid = [(t.p[0] + p[0]) / 2, (t.p[1] + p[1]) / 2, (t.p[2] + p[2]) / 2];
        t.p = p; t.d = d; t.par = i; t.fresh = 0; t.s += sl; t.len -= sl;
        if (!t.dead && (t.o >= lf.o || (t.o === lf.o - 1 && pos > 0.62))) {         // foliage, and the load it puts on the wood below
          let n = sl * lf.per * (sap ? 0.7 : 1); n = floor(n) + (rnd() < n % 1 ? 1 : 0);
          for (; n > 0; n--) { if (TIER < 4 || !dd) leafAt(rnd() < 0.5 ? mid : p, d, 0.4 + 0.6 * sqrt(pos)); segs[i].load++; }
        }
        const C = A[t.o + 1];
        if (C && !t.dead) {
          t.acc += sl;
          while (t.acc >= C.in * sc) {                                             // a node: buds set out by the phyllotaxis
            t.acc -= C.in * sc; t.az += C.ph * RAD;
            const cr = t.o ? pos : (pos - cb) / (1 - cb), live = t.o ? pos > 0.12 : pos >= cb;
            if (!live && !(sp.stub && !t.o && pos > 0.1 && rnd() < 0.45)) continue;
            const e1 = nrm(cross(d, abs(d[1]) < 0.9 ? UP : [1, 0, 0])), e2 = cross(d, e1);
            for (let k = 0; k < (live ? C.wh : 1); k++) {
              const az = t.az + k * TAU / C.wh + gs() * 0.15, an = (C.an[0] + (C.an[1] - C.an[0]) * max(0, cr) + gs() * 6) * RAD, ca = cos(an), sa = sin(an), cz = cos(az), sz = sin(az);
              const cd = [d[0] * ca + (e1[0] * cz + e2[0] * sz) * sa, d[1] * ca + (e1[1] * cz + e2[1] * sz) * sa, d[2] * ca + (e1[2] * cz + e2[2] * sz) * sa];
              const shp = C.sh === 0 ? 1 - 0.82 * cr : C.sh === 1 ? 0.3 + 0.7 * sin(PI * pow(cr, 0.75)) : C.sh === 3 ? 0.25 + 0.75 * pow(cr, 1.4) : 0.75;
              const len = live ? t.L0 * C.len * shp * rr(0.75, 1.2) * (t.o ? 1 - pos * 0.5 : 1) : rr(0.3, 1);
              if (len > C.st * sc * 0.8) next.push({ p, d: cd, len, L0: len, o: live ? t.o + 1 : A.length - 1, par: i, s: t.s, acc: rnd() * C.in, az: rnd() * TAU, fresh: 1, dead: !live });
            }
          }
        }
        if (t.len > 1e-3) next.push(t); else if (!t.dead) { if (TIER < 4 || !dd) { leafAt(p, d, 1); leafAt(p, d, 1); } segs[i].load += 2; }
      }
      tips = next;
    }
    // the pipe model: each piece of wood is as thick as everything it carries requires
    for (let i = segs.length - 1; i > 0; i--) if (segs[i].par >= 0) segs[segs[i].par].load += segs[i].load;
    const R = (i) => sp.rt * pow(segs[i].load, 1 / sp.dv), fl = (s) => 1 + sp.fl * exp(-s / 0.5);
    segs.forEach((g, i) => {
      const r0 = R(i) * (g.o ? 1 : fl(g.s0)), r1 = (g.cont >= 0 ? R(g.cont) : sp.rt * 0.7) * (g.o ? 1 : fl(g.s1));
      if (TIER > 3 && dd && g.o > 1) return;
      cap(g.a, r0, g.b, min(r0, r1), g.s0, g.s1, sid, TIER > 3 && dd ? (dd > 1 ? 18 : 1) : 0); st.wood += g.s1 - g.s0;
    });
    const Rb = R(0) * (1 + sp.fl);
    for (let k = 3 + floor(rnd() * 4), a0 = rnd() * TAU; k > 0 && !sap; k--) {      // surface roots
      const a = a0 + k * 2.2 + gs() * 0.3, l1 = Rb * 2.2, l2 = l1 + rr(0.5, 1.6), g = (l) => [x + cos(a) * l, Hgt(x + cos(a) * l, z + sin(a) * l), z + sin(a) * l];
      const p1 = g(l1), p2 = g(l2); p1[1] += Rb * 0.1; p2[1] -= 0.06;
      cap([x, y0 + Rb * 1.3, z], Rb * 0.42, p1, Rb * 0.2, 0, l1, sid, 0); cap(p1, Rb * 0.2, p2, 0.02, l1, l2, sid, 0);
    }
    blockers.push({ x, z, r: Rb }); if (!sap) damp.push([x + gs() * 0.6, z + gs() * 0.6]);
  };
  const gap = 0.42 / sqrt(max(den, 1));
  // above 200 kB every tree is a record that outlives this build: species, place, age, height, its own seed, and
  // whether it is alive (0), dead and standing (1) or fallen (2). The forest can then be regrown a year or a century on.
  const trees = [];
  const grow1 = TIER > 3 && ((t) => {
    const deco = (t, c0) => {                                    // what lives on a tree: brackets and woodpecker holes on the dead, beard lichen and nests on the living
    if (G.span || t.H < 5) return;
    const gy = Hgt(t.x, t.z), n = (caps.length - c0) / 12, at = () => c0 + ((rnd() * n) | 0) * 12;
    if (t.st) {
      for (let k = 2 + ((rnd() * 5) | 0); k > 0; k--) {
        const y = gy + rr(0.4, min(4, t.H * 0.4)), q = rnd() * TAU, c = cos(q), s = sin(q); let r = 0, X, Z;
        for (let i = c0; i < c0 + n * 12; i += 12) {                           // the trunk where it crosses this height: the stoutest limb that does
          const f = (y - caps[i + 1]) / (caps[i + 5] - caps[i + 1]), w = caps[i + 3] + (caps[i + 7] - caps[i + 3]) * f;
          if (f >= 0 && f <= 1 && w > r) { r = w; X = caps[i] + (caps[i + 4] - caps[i]) * f; Z = caps[i + 2] + (caps[i + 6] - caps[i + 2]) * f; }
        }
        if (!r) continue;
        if (rnd() < 0.3) cap([X + c * (r - 0.07), y, Z + s * (r - 0.07)], 0.04, [X + c * (r - 0.03), y, Z + s * (r - 0.03)], 0.04, 0, 1, 0.5, 13);
        else cap([X + c * r * 0.7, y, Z + s * r * 0.7], 0.1, [X + c * (r + 0.11), y - 0.02, Z + s * (r + 0.11)], 0.03, 0, 1, rr(0.45, 0.98), 3);
      }
      return;
    }
    if (G.floor.moss >= 0.6) for (let k = min(60, n >> 3); k > 0; k--) {
      const i = at(); if (caps[i + 11] !== 0 || caps[i + 3] > 0.07 || caps[i + 1] < gy + 2.5) continue;
      const f = rnd(), p = [caps[i] + (caps[i + 4] - caps[i]) * f, caps[i + 1] + (caps[i + 5] - caps[i + 1]) * f, caps[i + 2] + (caps[i + 6] - caps[i + 2]) * f];
      cap(p, 0.012, [p[0] + gs() * 0.05, p[1] - rr(0.2, 0.8), p[2] + gs() * 0.05], 0.004, 0, 1, 0.5, 2);
    }
    if (t.H > 8 && rnd() < 0.15) for (let k = 40; k > 0; k--) {
      const i = at(), y = caps[i + 1]; if (caps[i + 11] !== 0 || caps[i + 3] < 0.03 || caps[i + 3] > 0.14 || y < gy + 3 || y > gy + 10) continue;
      const c = [caps[i], y + caps[i + 3] + 0.02, caps[i + 2]];
      for (let j = 0; j < 20; j++) { const q = j / 10 * TAU + rnd(), R = j < 10 ? 0.07 : 0.1, h = j < 10 ? 0 : 0.035; cap([c[0] + cos(q) * R, c[1] + h, c[2] + sin(q) * R], 0.014, [c[0] + cos(q + 0.9) * R, c[1] + h + gs() * 0.01, c[2] + sin(q + 0.9) * R], 0.012, 0, 1, rnd(), 1); }
      for (let j = 0; j < 3; j++) { const q = j / 3 * TAU; cap([c[0] + cos(q) * 0.025, c[1] + 0.03, c[2] + sin(q) * 0.025], 0.02, [c[0] + cos(q) * 0.03, c[1] + 0.035, c[2] + sin(q) * 0.03], 0.017, 0, 1, 0.5, 8); }
      st.nests = (st.nests || 0) + 1; break;
    }
  };
    const sp = G.trees[t.si], keep = rnd; rnd = rng(t.sd);
    if (t.st === 2) {
      const len = t.H * 0.75, r = 0.05 + 0.011 * t.H; let p = [t.x, Hgt(t.x, t.z) + r * 0.6, t.z];
      for (let k = 1; k <= 5; k++) { const l = len * k / 5, X = t.x + cos(t.a) * l, Z = t.z + sin(t.a) * l, c = [X, Hgt(X, Z) + r * 0.6, Z]; cap(p, r * (1 - 0.12 * (k - 1)), c, r * (1 - 0.12 * k), l - len / 5, l, t.si + 0.5, t.burnt ? 18 : 1); p = c; blockers.push({ x: X, z: Z, r: r * 0.8 }); damp.push([X, Z]); }
    } else { const c0 = caps.length; tree(sp, t.si, t.x, t.z, t.H, t.H < 5, t.st === 1 ? (t.burnt ? 2 : 1) : 0); deco(t, c0); placed.push({ x: t.x, z: t.z, cr: t.H < 5 ? 0.7 : sp.cr * min(1, t.H / sp.H[0]) }); if (!t.st && t.H >= 5) st.trees++;
      if (sp.spo && !t.st && t.H >= 5 && rnd() < sp.spo) {                   // moss in fruit: a bristle with a spore capsule on top
        const y = Hgt(t.x, t.z) + t.H * 0.96, h = rr(3, 6), x2 = t.x + gs() * 0.4, z2 = t.z + gs() * 0.4; cap([t.x, y, t.z], 0.05, [x2, y + h, z2], 0.035, 0, 1, 0.9, 2); cap([x2, y + h, z2], 0.2, [x2 + gs() * 0.2, y + h + 0.9, z2], 0.16, 0, 1, 0.7, 3);
      } }
    rnd = keep; trees.push(t);
  });
  if (TIER > 3 && stand) { for (const t of stand) grow1(t); rnd = rng(seed ^ 0x5eed); }
  else G.trees.forEach((sp, si) => {
    const plant = (n, sap) => {
      for (let tries = 0; n > 0 && tries < 3000; tries++) {
        const x = rr(-hs + 2, hs - 2), z = rr(-hs + 2, hs - 2), cr = sap ? 0.7 : sp.cr;
        if (rnd() > 1 - abs(wet(x, z) - sp.wet) * 1.6 || (TIER > 2 && strm && strm.dist(x, z) < 1)) continue;                    // each species keeps to the moisture it likes
        if (placed.some((o) => hypot(o.x - x, o.z - z) < (o.cr + cr) * gap)) continue;
        if (TIER > 3) { const T = tl(sp), hm = rr(sp.H[0], sp.H[1]), age = sap ? rr(3, 9) : T[0] * rr(0.2, 0.75); grow1({ si, x, z, hm, age, H: sap ? min(4.6, max(1.2, hm * (1 - exp(-age * T[1])))) : max(5.2, hm * (1 - exp(-age * T[1]))), sd: (rnd() * 1e9) | 0, st: 0 }); n--; continue; }
        tree(sp, si, x, z, sap ? rr(1.4, 4) : rr(sp.H[0], sp.H[1]), sap); placed.push({ x, z, cr }); if (!sap) st.trees++; n--;
      }
    };
    plant(round(sp.n * den * (low ? 0.65 : 1)), 0); plant(round((sp.sap || 0) * den * (low ? 0.5 : 1)), 1);
  });
  if (TIER > 3 && !stand) rnd = rng(seed ^ 0x5eed);
  if (TIER > 3 && !G.span) for (let n = low ? 6 : 14, tries = 0; n > 0 && tries < 3000; tries++) {   // builders: orb webs strung between neighbouring trunks
    const a = trees[(rnd() * trees.length) | 0], b = trees[(rnd() * trees.length) | 0]; if (!a || a === b || a.st > 1 || b.st > 1 || a.H < 4 || b.H < 4) continue; const d = hypot(a.x - b.x, a.z - b.z); if (d < 1.2 || d > 3.6) continue;
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, cy = Hgt(cx, cz) + rr(0.9, 2.2), ux = (b.x - a.x) / d, uz = (b.z - a.z) / d, R = min(0.34, d * 0.24), N = 14, M = N * 9;
    const pt = (ang, r) => [cx + ux * cos(ang) * r, cy + sin(ang) * r, cz + uz * cos(ang) * r], th = (p, q) => cap(p, 0.0025, q, 0.0025, 0, 1, 0.5, 2);
    th([a.x, cy + R, a.z], pt(PI * 0.75, R)); th([a.x, cy - R * 0.6, a.z], pt(PI * 1.2, R)); th([b.x, cy + R, b.z], pt(PI * 0.25, R)); th([b.x, cy - R * 0.6, b.z], pt(-PI * 0.2, R));   // guy lines to the trunks
    for (let i = 0; i < N; i++) { const q = i / N * TAU; th(pt(q, 0.02), pt(q, R)); th(pt(q, R), pt(q + TAU / N, R)); }                                                                    // spokes and frame
    for (let i = 0; i < M; i++) th(pt(i / N * TAU, R * (0.12 + 0.85 * i / M)), pt((i + 1) / N * TAU, R * (0.12 + 0.85 * (i + 1) / M)));                                                      // the sticky spiral, laid outward
    n--;
  }                          // whatever is strewn after the trees is the same however they stand

  // a clearing to stand in: the spot near the middle that is furthest from any trunk
  let open = [0, 0], od = 0;
  for (let k = 0; k < 200; k++) { const x = rr(-hs * 0.45, hs * 0.45), z = TIER > 2 && strm ? strm.zc(x) + (rnd() < 0.5 ? -1 : 1) * (strm.wid(x) + rr(2.5, 5)) : rr(-hs * 0.45, hs * 0.45); let d = 1e9; for (const o of placed) d = min(d, hypot(o.x - x, o.z - z) - o.cr * 0.3); if (d > od) od = d, open = [x, z]; }

  // ---- dead wood, mushrooms
  for (let n = L.log; n > 0; n--) {
    const x = rr(-hs + 6, hs - 6), z = rr(-hs + 6, hs - 6), a = rnd() * TAU, len = rr(4, 10), r = rr(0.13, 0.3), id = floor(rnd() * G.trees.length) + rnd() * 0.98;
    let p = [x, Hgt(x, z) + r * 0.6, z];
    for (let k = 1; k <= 5; k++) {
      const l = len * k / 5, X = x + cos(a) * l, Z = z + sin(a) * l, c = [X, Hgt(X, Z) + r * 0.6, Z];
      cap(p, r * (1 - 0.06 * k), c, r * (1 - 0.06 * (k + 1)), l - len / 5, l, id, 1); p = c;
      blockers.push({ x: X, z: Z, r: r * 0.8 }); damp.push([X + gs() * 0.3, Z + gs() * 0.3]);
      if (rnd() < 0.5) { const b = rnd() * TAU, q2 = [c[0] + cos(b) * 0.5, c[1] + rr(0.2, 0.7), c[2] + sin(b) * 0.5]; cap(c, r * 0.3, q2, r * 0.16, 0, 0.7, id, 1); }
      if (rnd() < 0.6) rock(3, X + gs() * 0.25, Z + gs() * 0.25, rr(0.1, 0.3), 0.5, 1);
    }
  }
  for (let n = L.stump; n > 0; n--) { const x = rr(-hs + 4, hs - 4), z = rr(-hs + 4, hs - 4), y = Hgt(x, z), r = rr(0.18, 0.4), h = rr(0.3, 1); cap([x, y - 0.2, z], r * 1.25, [x, y + h, z], r, 0, h, floor(rnd() * G.trees.length) + rnd() * 0.98, 1); blockers.push({ x, z, r }); damp.push([x, z]); }
  for (let n = round(F.shroom * (low ? 0.6 : 1)); n > 0 && damp.length; n--) {
    const s = damp[(rnd() * damp.length) | 0], x = s[0] + gs() * 0.45, z = s[1] + gs() * 0.45, y = Hgt(x, z) - 0.01, h = rr(0.05, 0.15), sd = rnd();
    cap([x, y, z], 0.014, [x + gs() * 0.01, y + h, z + gs() * 0.01], 0.01, 0, h, sd, 2); cap([x, y + h - 0.004, z], h * 0.5, [x, y + h + h * 0.22, z], h * 0.1, 0, 0, sd, 3);
  }

  // ---- the floor: ferns where it is damp, grass where it is open
  for (let n = round(F.fern[0] * (low ? 0.6 : 1)), tries = 0; n > 0 && tries < 20000; tries++) {
    const x = rr(-hs + 0.5, hs - 0.5), z = rr(-hs + 0.5, hs - 0.5); if (rnd() > 1.15 - abs(wet(x, z) - F.fern[1]) * 2.4 || (TIER > 2 && strm && strm.dist(x, z) < 0.2) || (TIER > 3 && stand && stand.world && (stand.world.char(x, z) > 0.5 || (strm && strm.deep(x, z))))) continue;
    const y = Hgt(x, z), nf = 5 + floor(rnd() * 5), sz = rr(0.5, 1.1), a0 = rnd() * TAU; n--; st.under++;
    for (let k = 0; k < nf; k++) {
      const a = a0 + k / nf * TAU + gs() * 0.25, el = rr(25, 60) * RAD, c = cos(a), s = sin(a), ce = cos(el), se = sin(el);
      card([x, y, z], sz * rr(0.75, 1.15), [c * ce, se, s * ce], 3, 0.55 + 0.45 * rnd(), [-se * c, ce, -se * s], 6, rnd());
    }
  }
  for (let n = round(F.grass[0] * (low ? 0.5 : 1)), tries = 0; n > 0 && tries < 20000; tries++) {
    const x = rr(-hs + 0.3, hs - 0.3), z = rr(-hs + 0.3, hs - 0.3); if (rnd() > 1.1 - abs(wet(x, z) - F.grass[1]) * 2) continue;
    if (blockers.some((o) => hypot(o.x - x, o.z - z) < o.r + 0.2) || (TIER > 2 && strm && strm.dist(x, z) < 0.2) || (TIER > 3 && stand && stand.world && (stand.world.char(x, z) > 0.5 || (strm && strm.deep(x, z))))) continue;
    const y = Hgt(x, z) - 0.02, a = rnd() * TAU, sz = rr(0.25, 0.55); n--; st.under++;
    for (let k = 0; k < 2; k++) card([x, y, z], sz, nrm([gs() * 0.12, 1, gs() * 0.12]), 4, 0.7, [cos(a + k * 1.6), 0, sin(a + k * 1.6)], 7, rnd());
  }

  if (TIER > 3 && F.flower) for (let n = round(F.flower * (low ? 0.5 : 1)), tries = 0; n > 0 && tries < 9000; tries++) {   // flowers, in drifts
    const x = rr(-hs + 0.5, hs - 0.5), z = rr(-hs + 0.5, hs - 0.5); if (fbm(x * 0.11 + ox, 7, z * 0.11 + oz, 2) < 0.52 || (strm && strm.dist(x, z) < 0.3)) continue;
    for (let k = 1 + ((rnd() * 3) | 0); k > 0; k--) { const a = rnd() * TAU, X = x + gs() * 0.2, Z = z + gs() * 0.2; card([X, Hgt(X, Z) + rr(0.12, 0.34), Z], rr(0.14, 0.26), [cos(a), 0.15, sin(a)], 6, 0.95, nrm([gs() * 0.25, 1, gs() * 0.25]), 7, rnd()); } n--; st.under++;
  }
  // ---- the water's edge: rushes, and the surface itself as a strip that follows the channel
  let water = null;
  if (TIER > 2 && strm) {
    for (let n = low ? 110 : 220; n > 0; n--) {
      const x = rr(-hs + 0.5, hs - 0.5), z = strm.zc(x) + (rnd() < 0.5 ? -1 : 1) * (strm.wid(x) + rr(-0.3, 0.55)); if (abs(z) > hs - 0.5) continue;
      const y = Hgt(x, z) - 0.03, a = rnd() * TAU, sz = rr(0.7, 1.5); st.under++;
      for (let k = 0; k < 2; k++) card([x, y, z], sz, nrm([gs() * 0.1, 1, gs() * 0.1]), 4, 0.8, [cos(a + k * 1.6), 0, sin(a + k * 1.6)], 7, rnd());
    }
    const wv = [], wi = [], nx = 128, ny = strm.fl > 0 ? 16 : 8;
    for (let i = 0; i <= nx; i++) { const x = -hs + S * i / nx, y = strm.lvl(x), ww = strm.wid(x) + 0.6 + (x < strm.xd ? strm.fl * 10 : 0); for (let j = 0; j <= ny; j++) { const z = min(hs, max(-hs, strm.zc(x) + (j / ny * 2 - 1) * ww)); wv.push(x, y, z, 0, 1, 0, y - Hgt(x, z), x); } }
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const a = i * (ny + 1) + j; wi.push(a, a + 1, a + ny + 1, a + 1, a + ny + 2, a + ny + 1); }
    water = { v: new Float32Array(wv), i: new Uint16Array(wi) };
  }

  // ---- the ground itself, shaded where things stand on it, and the plot's cut sides
  const n = low ? 80 : 128, w = n + 1, V = [], I = [];
  let yb = 1e9;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = -hs + S * i / n, z = -hs + S * j / n, y = Hgt(x, z), e = 0.3, nn = nrm([Hgt(x - e, z) - Hgt(x + e, z), 2 * e, Hgt(x, z - e) - Hgt(x, z + e)]);
    let ao = 1; for (const o of blockers) { const d = hypot(o.x - x, o.z - z), s = o.r * 2 + 0.3; if (d < s * 3) ao *= 1 - 0.62 * exp(-d * d / (2 * s * s)); }
    V.push(x, y, z, nn[0], nn[1], nn[2], TIER > 3 && stand && stand.world ? max(0.3, ao) * (1 - 0.8 * stand.world.char(x, z)) : max(0.3, ao), wet(x, z)); yb = min(yb, y);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = i + j * w; I.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
  const nTop = I.length; yb -= 4;
  for (const [f, nx, nz, rev] of [[(k) => k, 0, -1, 0], [(k) => k + n * w, 0, 1, 1], [(k) => k * w, -1, 0, 1], [(k) => k * w + n, 1, 0, 0]]) {
    const b = V.length / 8;
    for (let k = 0; k <= n; k++) { const s = f(k) * 8, x = V[s], y = V[s + 1], z = V[s + 2]; V.push(x, y, z, nx, 0, nz, 0, 0, x, yb, z, nx, 0, nz, y - yb, 0); }
    for (let k = 0; k < n; k++) { const a = b + k * 2; rev ? I.push(a, a + 1, a + 2, a + 2, a + 1, a + 3) : I.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  }

  // colours and bark settings, by palette slot: one per species, then ferns and grass
  const pal = { la: new Float32Array(24), lb: new Float32Array(24), ba: new Float32Array(24), bb: new Float32Array(24), bp: new Float32Array(32) };
  G.trees.forEach((sp, i) => { pal.la.set(sp.leaf.a, i * 3); pal.lb.set(sp.leaf.b, i * 3); pal.ba.set(sp.bark.a, i * 3); pal.bb.set(sp.bark.b, i * 3); pal.bp.set([sp.bark.t, sp.bark.sc, 0, 0], i * 4); });
  pal.la.set(F.fa, 18); pal.lb.set(F.fb, 18); pal.la.set(F.ga, 21); pal.lb.set(F.gb, 21);
  const sr = rng(seed ^ 0x77);
  return { caps: new Float32Array(caps), cards: new Float32Array(cards), rocks: rocks.map((r) => new Float32Array(r)), stones: [stone(1, 3, sr), stone(9, 3, sr), stone(17, 3, sr), stone(23, 1, sr)],
    land: { v: new Float32Array(V), i: new Uint16Array(I), nTop }, Hgt, S, pal, st, open, water, strm, block: blockers, trees };
}
