// Phenotype from genotype: reads a genome and grows the block. Everything drawn is a tapered capsule,
// 12 floats: x0 y0 z0 r0, x1 y1 z1 r1, path0 path1 id kind.
// kinds: 0 smooth dendrite · 1 spiny dendrite · 2 axon · 3 soma · 4 nucleus · 5 vessel · 6 glia · 7 frame · 8 felt
// Solid kinds come first in the buffer; nuclei, frame and felt follow, because they are drawn as added light.
const { PI, sin, cos, hypot, abs, max, min, round, pow, exp, log, sqrt } = Math, TAU = PI * 2;

export const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function build(G, seed, q = 1, nucCap = 50000) {
  const rnd = rng(seed), rr = (a, b) => a + (b - a) * rnd(), pick = (v) => (Array.isArray(v) ? rr(v[0], v[1]) : v);
  const gs = () => sqrt(-2 * log(1 - rnd())) * cos(TAU * rnd());
  const [W, D] = G.size, hw = W / 2, hd = D / 2;
  const ly = []; let yy = 0;
  for (const [nm, t, den, nr, fo] of G.layers) { ly.push({ nm, top: yy, bot: yy - t, den, nr, fo }); yy -= t; }
  const T = -yy, solid = [], light = [];
  const seg = (a, ra, b, rb, d0, d1, id, k) => (k === 4 || k > 6 ? light : solid).push(a[0], a[1], a[2], ra, b[0], b[1], b[2], rb, d0, d1, id, k);
  const yIn = (L, f0, f1) => ly[L].bot + (ly[L].top - ly[L].bot) * rr(f0, f1);
  const st = { cells: 0, neurite: 0, nuclei: 0, vessel: 0, felt: 0 };

  // frame: the block's edges and its layer boundaries
  for (let i = 0; i <= ly.length; i++) {
    const y = i < ly.length ? ly[i].top : -T, c = [[-hw, y, -hd], [hw, y, -hd], [hw, y, hd], [-hw, y, hd]];
    for (let j = 0; j < 4; j++) seg(c[j], 0.3, c[(j + 1) % 4], 0.3, 0, 0, i && i < ly.length ? 1 : 0, 7);
  }
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) seg([x, 0, z], 0.3, [x, -T, z], 0.3, 0, 0, 0, 7);

  // vessels: penetrating vessels from the pia, and a capillary lattice they feed
  const nodes = [], path = (a, b, r0, r1, n, wig) => {
    let p = a, s = 0; const sd = rnd() * 100, m = [0, 1, 2].map((i) => (a[i] + b[i]) / 2 + gs() * wig);   // a bowed path through one control point
    for (let i = 1; i <= n; i++) {
      const f = i / n, u = 1 - f, c = [0, 1, 2].map((i) => u * u * a[i] + 2 * u * f * m[i] + f * f * b[i]);
      const l = hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]);
      seg(p, r0 + (r1 - r0) * (i - 1) / n, c, r0 + (r1 - r0) * f, s, s + l, sd, 5); s += l; p = c; st.vessel += l;
    }
  };
  const [cs, cp] = G.vessels.cap, nx = round(W / cs), ny = round(T / cs), nz = round(D / cs), node = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    node[i + nx * (j + ny * k)] = [-hw + (i + 0.5 + rr(-0.35, 0.35)) * W / nx, -(j + 0.5 + rr(-0.35, 0.35)) * T / ny, -hd + (k + 0.5 + rr(-0.35, 0.35)) * D / nz];
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const a = node[i + nx * (j + ny * k)]; nodes.push(a);
    for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      if (i + di < nx && j + dj < ny && k + dk < nz && rnd() < cp) path(a, node[i + di + nx * (j + dj + ny * (k + dk))], 2.2, 2.2, 5, cs * 0.14);
    }
  }
  for (let n = round(W * D / G.vessels.pen ** 2); n > 0; n--) {
    const x = rr(-hw, hw) * 0.92, z = rr(-hd, hd) * 0.92, dep = T * rr(0.55, 1), r = rr(6, 10), m = round(dep / 45);
    let p = [x, 6, z];
    for (let i = 1; i <= m; i++) {
      const c = [x + gs() * 9, -dep * i / m, z + gs() * 9], ra = r * (1 - 0.6 * (i - 1) / m), rb = r * (1 - 0.6 * i / m);
      path(p, c, ra, rb, 2, 2); p = c;
      let best = 0, bd = 1e9; for (const nd of nodes) { const d = hypot(nd[0] - c[0], nd[1] - c[1], nd[2] - c[2]); if (d < bd) bd = d, best = nd; }
      if (bd < cs * 1.3) path(c, best, 3.2, 2.4, 4, 10);
    }
  }

  // nuclei: every cell body in the block, at each layer's own density (thinned to fit the budget)
  let total = 0; for (const l of ly) total += l.den * 1e3 * W * D * (l.top - l.bot) * 1e-9;
  const keep = min(1, nucCap * q / total);
  for (const l of ly) {
    for (let n = round(l.den * 1e3 * W * D * (l.top - l.bot) * 1e-9 * keep); n > 0; n--) {
      const p = [rr(-hw, hw), rr(l.bot, l.top), rr(-hd, hd)], r = l.nr * rr(0.8, 1.2);
      seg(p, r, p, r, 0, 0, rnd(), 4); st.nuclei++;
    }
  }
  st.nucKeep = keep;

  // felt: the unlabelled fibres that fill the neuropil, running the way each layer's fibres run
  // (0 any way · 1 radial · 2 tangential · 3 along z · 4 along x)
  for (const l of ly) {
    for (let n = round((G.felt || 0) * 1e3 * W * D * (l.top - l.bot) * 1e-9 * q); n > 0; n--) {
      let p = [rr(-hw, hw), rr(l.bot, l.top), rr(-hd, hd)], a = rnd() * TAU, sg = rnd() < 0.5 ? -1 : 1, s = 0; const id = rnd();
      let d = l.fo === 1 ? [gs() * 0.25, sg, gs() * 0.25] : l.fo === 2 ? [cos(a), gs() * 0.15, sin(a)] : l.fo === 3 ? [gs() * 0.08, gs() * 0.08, sg] : l.fo === 4 ? [sg, gs() * 0.08, gs() * 0.08] : [gs(), gs(), gs()];
      for (let i = 0; i < 4; i++) {
        d = d.map((v) => v + gs() * 0.12); const dl = hypot(d[0], d[1], d[2]) || 1, c = p.map((v, j) => v + d[j] / dl * 28);
        if (c[1] > -1 || c[1] < 1 - T || abs(c[0]) > hw || abs(c[2]) > hd) break;
        seg(p, 0.26, c, 0.26, s, s + 28, id, 8); p = c; s += 28; st.felt++;
      }
    }
  }

  // cells: grow each arbor tip by tip, all tips advancing together so a budget cuts evenly
  const units = [], pl = G.plane;
  const grow = (g0, o, R, id, phi, cap) => {
    const nx_ = -sin(phi), nz_ = cos(phi);
    const flat = (d, fl) => { if (fl) { const c = (d[0] * nx_ + d[2] * nz_) * fl; d[0] -= c * nx_; d[2] -= c * nz_; } const l = hypot(d[0], d[1], d[2]) || 1; d[0] /= l; d[1] /= l; d[2] /= l; return d; };
    const dir = (el, fl) => { const e = el * PI / 2, a = rnd() * TAU; return flat([cos(e) * cos(a), sin(e), cos(e) * sin(a)], fl); };
    let tips = [], count = 0;
    for (let n = round(pick(g0.n ?? 1)); n > 0; n--) {
      const d = g0.tv ? g0.tv.slice() : dir(rr(g0.el[0], g0.el[1]), g0.fl);
      tips.push({ p: [o[0] + d[0] * R * 0.8, o[1] + d[1] * R * 0.8, o[2] + d[2] * R * 0.8], d, r: g0.r, len: pick(g0.L), s: R * 0.8, o: 0, g: g0, tv: g0.tv || [0, 1, 0] });
    }
    while (tips.length && count < cap) {
      const next = [];
      for (const t of tips) {
        let g = t.g;
        if (g.tuft && !t.tf) { // has the tip reached the depth where it changes character?
          if (t.yAt === undefined) t.yAt = yIn(...g.tuft.at);
          if ((g.tr || 0) >= 0 ? t.p[1] > t.yAt : t.p[1] < t.yAt) {
            const tg = { ...g, ...g.tuft, tuft: null };
            if (tg.ax) {
              for (let j = 0; j < tg.fork; j++) { const sg = tg.fork > 1 ? (j ? -1 : 1) : rnd() < 0.5 ? -1 : 1, d = tg.ax.map((v) => v * sg); next.push({ p: t.p, d, r: t.r, len: pick(tg.L), s: t.s, o: 0, g: tg, tv: d, tf: 1 }); }
              continue;
            }
            t.g = g = tg; t.len = pick(tg.L); t.o = 0; t.tf = 1; t.tv = [0, 1, 0];
          }
        }
        const s = g.st, tr = g.tr || 0, to = g.to || 0, d = flat([t.d[0] + t.tv[0] * tr + gs() * to, t.d[1] + t.tv[1] * tr + gs() * to, t.d[2] + t.tv[2] * tr + gs() * to], g.fl);
        const p = [t.p[0] + d[0] * s, t.p[1] + d[1] * s, t.p[2] + d[2] * s];
        if (p[1] > -2) { p[1] = -2 - rnd() * 2; d[1] = -abs(d[1]) * 0.2; }              // the pia turns it aside
        if (p[1] < 1 - T || abs(p[0]) > hw || abs(p[2]) > hd) continue;                  // cut at the block's faces
        const r1 = max(0.2, t.r * (g.tp || 0.98));
        seg(t.p, t.r, p, r1, t.s, t.s + s, id, g.k); count++; st.neurite += s;
        t.p = p; t.d = d; t.r = r1; t.s += s; t.len -= s;
        if (t.len <= 0) continue;
        if (rnd() < (g.br || 0) * s) {
          if (g.c) { // a side branch with its own rules; calibre shared by Rall's 3/2 law
            const cg = { ...g, ...g.c, c: g.c.c || null, tuft: g.c.tuft || null }, cd = dir(rr(cg.el[0], cg.el[1]), cg.fl), sf = g.sf || 0.86;
            next.push({ p, d: cd, r: max(0.2, t.r * pow(1 - sf, 2 / 3)), len: pick(cg.L), s: t.s, o: 0, g: cg, tv: cg.hd ? cd : [0, 1, 0], tf: t.tf });
            t.r *= pow(sf, 2 / 3);
          } else if (t.o < (g.bo || 0)) { // an even split
            const ba = (g.ba || 0.6) * rr(0.7, 1.3), sf = g.sf || 0.5, bs = g.bs || 0.8;
            let e = g.fl ? [nx_, 0, nz_] : [gs(), gs(), gs()];
            let c = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]]; const cl = hypot(c[0], c[1], c[2]) || 1;
            if (rnd() < 0.5) c = c.map((v) => -v);
            const a = d.map((v, i) => v * cos(ba) + c[i] / cl * sin(ba)), b = d.map((v, i) => v * cos(ba) - c[i] / cl * sin(ba));
            next.push({ ...t, d: b, r: max(0.2, t.r * pow(1 - sf, 2 / 3)), len: t.len * bs, o: t.o + 1 });
            t.d = a; t.r = max(0.2, t.r * pow(sf, 2 / 3)); t.len *= bs; t.o++;
          }
        }
        next.push(t);
      }
      tips = next;
    }
  };

  G.cells.forEach((C, ti) => {
    for (let n = max(1, round(C.n * q)); n > 0; n--) {
      const L = Array.isArray(C.ly[0]) ? C.ly[0][(rnd() * C.ly[0].length) | 0] : C.ly[0];
      const o = [C.edge ? 2 - hw : rr(-hw, hw) * 0.96, yIn(L, C.ly[1], C.ly[2]), rr(-hd, hd) * 0.96];
      const id = C.x ? rnd() * 100 : units.length, R = C.so ? C.so[0] * rr(0.9, 1.1) : 0, e = C.so ? C.so[1] : 1;
      if (!C.x) units.push({ x: o[0], y: o[1], z: o[2], t: C.id, ti, I: !!C.I, in: !!C.in, b: C.b || 0, hue: rnd(), th: C.h || 0, layer: L });
      if (R) seg([o[0], o[1] - (e - 1) * R * 0.5, o[2]], R, [o[0], o[1] + (e - 1) * R * 1.3, o[2]], e > 1 ? R * 0.45 : R, 0, 0, id, C.x ? 6 : 3);
      const phi = pl === undefined ? rnd() * PI : pl;
      for (const g of C.ar) grow(g, o, R, id, phi, (C.cap || 520) * (q < 1 ? 0.8 : 1));
      if (C.ef) { // astrocyte endfoot on the nearest capillary
        let best = 0, bd = 1e9; for (const nd of nodes) { const d = hypot(nd[0] - o[0], nd[1] - o[1], nd[2] - o[2]); if (d < bd) bd = d, best = nd; }
        if (bd < 90) { const m = [(o[0] + best[0]) / 2 + gs() * 3, (o[1] + best[1]) / 2 + gs() * 3, (o[2] + best[2]) / 2 + gs() * 3]; seg(o, 0.8, m, 0.6, 0, 0, id, 6); seg(m, 0.6, best, 0.6, 0, 0, id, 6); seg(best, 3.4, best, 3.4, 0, 0, id, 6); }
      }
      st.cells++;
    }
  });

  const inst = new Float32Array(solid.length + light.length); inst.set(solid); inst.set(light, solid.length);
  return { inst, count: inst.length / 12, opaque: solid.length / 12, units, ly, T, W, D, st };
}
