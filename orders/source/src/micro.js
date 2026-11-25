// Powers of ten, inward (2 MB rung). Two more worlds built from the same parts as the forest, at other scales:
//   log:  a hundred times smaller, a unit is a centimetre. 64 cm of forest floor across a rotting log: loose bark,
//         bracket fungi, a tuft of bonnet mushrooms, scarlet elf cups, acorns, twigs, fallen leaves, oak seedlings.
//   soil: ten thousand times smaller, a unit is a tenth of a millimetre. 6.4 mm of the top of the soil: sand grains,
//         a fine root with its root hairs, fungal threads that branch and drape over the grains and wrap the root,
//         pin moulds and blue-green Penicillium brushes, spores.
// The animals for each are in fx.js (woodlice, beetles, slugs and a centipede; nematodes and tardigrades).
/* global TIER */

// the leaf: a vein runs across as a low ridge of long cells; the rest is a sheet of jigsaw-shaped cells (drawn in the shader)
export function leafLand(Hgt, rnd) { const z0 = (rnd() - 0.5) * 20, ph = rnd() * 6.28; const zc = (x) => z0 + 3 * Math.sin(x * 0.03 + ph); return { Hgt: (x, z) => Hgt(x, z) + 3.2 * Math.exp(-(((z - zc(x)) / 7) ** 2)), vein: zc }; }

// under the bark (a unit is a millimetre): the sapwood of a dead spruce where the bark has come away, and on it the
// engraving one family of bark beetles left. A pair met in a chamber; she cut a gallery each way along the grain and
// laid an egg in a niche on either side every millimetre or so; each grub ate its own tunnel out across the grain,
// wider as it grew, and pupated in an oval chamber at the end. The oldest eggs are nearest the chamber, so those
// tunnels are longest. A strip of bark still clings along one side, and the tunnels run on beneath it.
export function barkLand(Hgt, rnd, hs) {
  const { sin, cos, sqrt, max, min, abs, PI } = Math, N = 384, C = 2 * hs / N, D = new Float32Array(N * N), rr = (a, b) => a + (b - a) * rnd(), gs = () => sqrt(-2 * Math.log(1 - rnd())) * cos(2 * PI * rnd());
  const cut = (x0, z0, x1, z1, r, d) => {                                   // gouge a groove of radius r and depth d from one point to the next
    const i0 = max(0, ((min(x0, x1) - r + hs) / C) | 0), i1 = min(N - 1, ((max(x0, x1) + r + hs) / C) | 0), j0 = max(0, ((min(z0, z1) - r + hs) / C) | 0), j1 = min(N - 1, ((max(z0, z1) + r + hs) / C) | 0), dx = x1 - x0, dz = z1 - z0, L = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = -hs + i * C, z = -hs + j * C, t = max(0, min(1, ((x - x0) * dx + (z - z0) * dz) / L)), e = Math.hypot(x - x0 - dx * t, z - z0 - dz * t) / r; if (e < 1) D[i + j * N] = max(D[i + j * N], d * (1 - e * e * e * e)); }
  };
  const zb0 = hs * rr(0.3, 0.5), ph = rnd() * 6, zb = (x) => zb0 + 2.5 * sin(x * 0.11 + ph) + 1.2 * sin(x * 0.37 + ph * 2);   // the torn edge of the bark
  const xn = rr(-8, 8), zn = rr(-hs * 0.45, -hs * 0.1), mother = [], larvae = [];
  cut(xn - 1.6, zn, xn + 1.6, zn + 0.4, 2.4, 1.1);                           // the nuptial chamber
  for (const e of [-1, 1]) {                                                 // two mother galleries, one each way along the grain
    let x = xn, z = zn, side = rnd() < 0.5 ? -1 : 1; const L = rr(22, 29);
    for (let l = 0; l < L; l += 0.5) {
      const nx = x + e * 0.5, nz = z + gs() * 0.06; cut(x, z, nx, nz, 1.5, 0.95); x = nx; z = nz;
      if (l > 2 && rnd() < 0.36) {                                           // an egg niche, and the grub's tunnel out from it
        side = -side; const age = 1 - l / L, Lg = 6 + age * rr(14, 24), g = []; let gx = x, gz = z + side * 1.4, h = side * PI / 2 + gs() * 0.15 - e * 0.1;
        for (let m = 0; m < Lg; m += 0.45) { h += gs() * 0.09; const r = 0.22 + 0.85 * m / 28, ux = gx + cos(h) * 0.45, uz = gz + sin(h) * 0.45; if (abs(uz) > hs + 2) break; cut(gx, gz, ux, uz, r, 0.45 + 0.35 * m / 28); g.push([gx, gz, r]); gx = ux; gz = uz; }
        const r = 0.22 + 0.85 * Lg / 28; if (age > 0.35) cut(gx - cos(h) * 0.6, gz - sin(h) * 0.6, gx + cos(h) * 0.9, gz + sin(h) * 0.9, r * 1.5, 1);   // the pupal chamber
        larvae.push({ x: gx, z: gz, h, r, age, egg: [x, z + side * 1.3], g });
      }
      mother.push([x, z]);
    }
  }
  for (let k = 0; k < 14; k++) { const x = rr(-hs, hs), z = rr(-hs, zb0 - 4); cut(x, z, x, z, 0.5, 3); }   // ambrosia beetles' pinholes, straight into the wood
  for (let k = 0; k < 2; k++) { const E = D.slice(); for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const q = i + j * N; D[q] = (E[q] * 4 + E[q - 1] + E[q + 1] + E[q - N] + E[q + N]) / 8; } }   // soften the gouged edges a little
  const dep = (x, z) => { const u = (x + hs) / C, v = (z + hs) / C, i = max(0, min(N - 2, u | 0)), j = max(0, min(N - 2, v | 0)), a = min(1, max(0, u - i)), b = min(1, max(0, v - j)), q = i + j * N; return (D[q] * (1 - a) + D[q + 1] * a) * (1 - b) + (D[q + N] * (1 - a) + D[q + N + 1] * a) * b; };
  const holes = []; for (let k = 0; k < 10; k++) { const x = rr(-hs + 3, hs - 3), z = zb(x) + rr(3, hs - zb(x)); if (z < hs - 1.5) holes.push([x, z, rr(0.9, 1.2)]); }   // round exit holes, where an older brood flew
  const bark = (x, z) => { const t = z - zb(x); if (t < 0) return -1e9; let k = 1; for (const h of holes) { const e = Math.hypot(x - h[0], z - h[1]) / h[2]; if (e < 1.3) k = min(k, max(0, (e - 0.85) / 0.45)); } return k * (5.5 * Math.min(1, t / 0.7) + 0.6 * sin(x * 0.7 + sin(z * 0.9)) * sin(z * 0.5)); };   // 5 to 6 mm of bark, its broken edge steep
  return { Hgt: (x, z) => max(Hgt(x, z) - dep(x, z), Hgt(x, z) + bark(x, z)), bark: { zb, xn, zn, mother, larvae, dep } };
}

// the log is part of the ground, so animals, seedlings, leaves and your feet all go over it
export function logLand(Hgt, rnd, hs) {
  const { sin, sqrt, max, abs, PI } = Math, TAU = PI * 2;
  const z0 = (rnd() - 0.5) * 14, k = (rnd() - 0.5) * 0.4, ph = rnd() * TAU;
  const zc = (x) => z0 + x * k + 1.6 * sin(x * 0.09 + ph), R = (x) => 12.5 * (1 + 0.07 * sin(x * 0.27 + ph) + 0.04 * sin(x * 0.71));
  const H0 = Hgt, cy = (x) => H0(x, zc(x)) + R(x) * 0.4;                   // more than half its girth stands above the litter
  const top = (x, z) => { const d = abs(z - zc(x)) / Math.sqrt(1 + k * k), r = R(x); return d < r ? cy(x) + sqrt(r * r - d * d) : -1e9; };
  return { Hgt: (x, z) => max(H0(x, z), top(x, z) - 0.3), log: { zc, R, cy, k, ph, hs } };
}

export function microBuild(world, c) {
  const { sin, cos, sqrt, max, abs, hypot, PI } = Math, TAU = PI * 2, atan2s = Math.atan2;
  const { cap, card, Hgt, hs, rnd, blockers, low, log, rocks } = c, rr = (a, b) => a + (b - a) * rnd(), gs = () => sqrt(-2 * Math.log(1 - rnd())) * cos(TAU * rnd());
  const up = (p, h) => [p[0], p[1] + h, p[2]];
  if (world === 'log') {
    const { zc, R, cy } = log, sd = 0 + 0.5;
    let prev = null;
    for (let x = -hs - 12; x <= hs + 12; x += 4) {                         // the log: grey wood, and over most of it the old bark
      const p = [x, cy(x), zc(x)], r = R(x);
      if (prev) {
        cap(prev[0], prev[1], p, r, 0, 1, sd, 1);
        if (sin(x * 0.19 + log.ph * 3) + 0.5 * sin(x * 0.53) > -0.4) cap(prev[0], prev[1] * 1.035, p, r * 1.035, 0, 1, sd, 0);
      }
      prev = [p, r];
    }
    const on = (x, a) => { const r = R(x), z = zc(x); return [x, cy(x) + sin(a) * r, z + cos(a) * r]; };   // a point on the log's surface, a = 0 one side, PI/2 the top
    for (let i = 0; i < 9; i++) {                                         // bracket fungi in tiers up one flank
      const x = rr(-hs + 6, hs - 6), a = rnd() < 0.5 ? rr(0.05, 0.6) : rr(2.5, 3.1), s = rr(1.6, 3.2);
      for (let j = 0; j < 3; j++) { const p = on(x + j * 0.3, a + j * 0.22), o = [0, 0, cos(a) > 0 ? 1 : -1]; cap(p, s * (1 - j * 0.2), [p[0], p[1] - 0.2, p[2] + o[2] * s * 1.3], s * 0.35, 0, 1, rr(0.5, 0.95), 3); }
    }
    for (let i = 0, x0 = rr(-hs + 10, hs - 10); i < 14; i++) {           // a tuft of bonnets on the top, thin stems and grey-brown caps
      const x = x0 + gs() * 2.5, a = PI / 2 + gs() * 0.35, p = on(x, a), h = rr(2.5, 5.5), t = [p[0] + gs() * 0.6, p[1] + h, p[2] + gs() * 0.6];
      cap(p, 0.12, t, 0.09, 0, h, rr(0.5, 0.74), 2); cap(up(t, -0.4), rr(0.5, 1), up(t, 0.25), 0.12, 0, 0, rr(0.42, 0.74), 3);
    }
    for (let i = 0; i < 12; i++) {                                        // scarlet elf cups on the ground by the log
      const x = rr(-hs + 3, hs - 3), z = zc(x) + (rnd() < 0.5 ? -1 : 1) * (R(x) + rr(1, 6)), y = Hgt(x, z), s = rr(0.8, 1.8);
      cap([x, y + 0.1, z], s, [x, y + s * 0.35, z], s * 0.75, 0, 0, rr(0.05, 0.35), 3);
    }
    for (let i = 0; i < 14; i++) {                                        // acorns, some still in their cups
      const x = rr(-hs + 2, hs - 2), z = rr(-hs + 2, hs - 2), y = Hgt(x, z), a = rnd() * TAU, d = [cos(a), 0.15, sin(a)];
      cap([x, y + 0.7, z], 0.7, [x + d[0] * 1.2, y + 0.75, z + d[2] * 1.2], 0.55, 0, 0, rr(0.76, 0.9), 3);
      if (rnd() < 0.5) cap([x - d[0] * 0.2, y + 0.75, z - d[2] * 0.2], 0.78, [x + d[0] * 0.25, y + 0.85, z + d[2] * 0.25], 0.6, 0, 0, sd, 1);
    }
    for (let i = 0; i < 16; i++) {                                        // twigs
      const x = rr(-hs, hs), z = rr(-hs, hs), a = rnd() * TAU, l = rr(6, 22), r = rr(0.18, 0.45), b = [x + cos(a) * l, 0, z + sin(a) * l];
      cap([x, Hgt(x, z) + r, z], r, [b[0], Hgt(b[0], b[2]) + r * 0.8, b[2]], r * 0.7, 0, 1, sd, rnd() < 0.5 ? 1 : 0);
    }
    for (let i = 0, n = low ? 160 : 320; i < n; i++) {                    // fallen leaves, lying where they landed, a few on the log
      const x = rr(-hs, hs), z = rr(-hs, hs), y = Hgt(x, z) + 0.06 + rnd() * 0.12, a = rnd() * TAU, t = gs() * 0.12;
      card([x, y, z], rr(4, 8.5), [cos(a), t, sin(a)], 8, rr(0.5, 1), [gs() * 0.1, 1, gs() * 0.1], 0, rnd());
    }
    return;
  }
  if (world === 'range') return c.bark.draw(cap);
  if (world === 'bark') {
    const { larvae, mother, xn, zn, zb } = c.bark, at = (x, z, h) => [x, Hgt(x, z) + h, z];
    for (const L of larvae) {
      const ca = cos(L.h), sa = sin(L.h), r = L.r, Q = (u, v, h) => at(L.x + ca * u - sa * v, L.z + sa * u + ca * v, h);
      if (L.age < 0.1) { cap(at(L.egg[0] - 0.2, L.egg[1], 0.3), 0.28, at(L.egg[0] + 0.2, L.egg[1], 0.3), 0.26, 0, 0, 0.5, 8); continue; }   // an egg still in its niche
      if (L.age < 0.35) {                                                    // a grub: white, legless, curled into a C, the brown head forward
        const s = r * 0.95; let p = Q(-s * 1.9, 0, s); for (let i = 1; i <= 5; i++) { const a = i / 5 * 2.2 - 1.1, q = Q(-s * 1.9 + i * s * 0.7, sin(a) * s * 0.5, s * (0.85 + 0.25 * cos(a))); cap(p, s * (0.75 + 0.2 * sin(i * 0.6)), q, s * (0.8 + 0.15 * sin(i * 0.6 + 0.6)), 0, 0, 0.5, 8); p = q; }
        cap(p, s * 0.55, Q(s * 1.9, 0, s * 0.75), s * 0.5, 0, 0, 0.5, 7); continue;
      }
      if (L.age < 0.5) {                                                     // a pupa: white, legs and wing pads folded against it
        cap(Q(-1.2, 0, 0.9), 0.6, Q(0.6, 0, 1), 0.85, 0, 0, 0.5, 8); cap(Q(0.6, 0, 1), 0.85, Q(1.3, 0, 0.85), 0.7, 0, 0, 0.5, 8);
        for (const e of [-1, 1]) cap(Q(0.9, e * 0.55, 1.2), 0.22, Q(-0.4, e * 0.7, 1.15), 0.18, 0, 0, 0.5, 8); continue;
      }
      if (L.age < 0.7) { cap(Q(-1, 0, 0.9), 0.8, Q(0.4, 0, 0.95), 0.88, 0, 0, 0.5, 11); cap(Q(0.4, 0, 0.95), 0.88, Q(1.25, 0, 0.85), 0.75, 0, 0, 0.5, 11); }   // a young adult, still pale, not yet out
    }
    { const m = mother[mother.length - 1], p = mother[mother.length - 3]; const d = [m[0] - p[0], m[1] - p[1]], l = hypot(d[0], d[1]) || 1, u = [d[0] / l, d[1] / l];   // the mother, still at work at the end of her gallery
      cap(at(m[0] - u[0] * 2.6, m[1] - u[1] * 2.6, 0.95), 0.85, at(m[0] - u[0] * 0.8, m[1] - u[1] * 0.8, 1), 0.92, 0, 0, 0.5, 15); cap(at(m[0] - u[0] * 0.8, m[1] - u[1] * 0.8, 1), 0.92, at(m[0] + u[0] * 0.5, m[1] + u[1] * 0.5, 0.9), 0.78, 0, 0, 0.5, 15); }
    for (let i = 0; i < 16; i++) { const x = rr(-hs, hs), z = zb(x) + rr(-0.6, 0.4), r = rr(0.2, 0.7); cap(at(x, z, r * 0.6), r, at(x + 0.1, z, r * 0.7), r, 0, 0, 0.92, 3); }   // beads of resin along the torn edge
    { // a fan of white mycelium, the honey fungus, spreading from one corner along and across the grain
      const ox = rnd() < 0.5 ? -hs : hs, oz = -hs + rr(2, 10), tips = []; for (let i = 0; i < (low ? 16 : 30); i++) tips.push([ox, oz + gs(), (ox < 0 ? 0 : PI) + (ox < 0 ? 1 : -1) * rr(0.05, 1.2), low ? 40 : 60, 0.07]);
      while (tips.length) { let [x, z, h, n, r] = tips.pop(); for (; n > 0; n--) { h += gs() * 0.12; const nx = x + cos(h) * 0.6, nz = z + sin(h) * 0.6; if (abs(nx) > hs || abs(nz) > hs || nz > zb(nx) - 0.5) break; cap(at(x, z, 0.04), r, at(nx, nz, 0.04), r * 0.99, 0, 0, 0.5, 8); x = nx; z = nz; r *= 0.99; if (rnd() < 0.1 && tips.length < 260) tips.push([x, z, h + (rnd() < 0.5 ? -1 : 1) * rr(0.2, 0.5), n * 0.7, r]); } }
    }
    for (let i = 0; i < 3; i++) {                                           // black bootlaces of the same fungus, its rhizomorphs, running along the grain and forking
      let x = rnd() < 0.5 ? -hs - 1 : hs + 1, z = rr(-hs + 3, zb(0) - 4), h = x < 0 ? gs() * 0.2 : PI + gs() * 0.2, r = rr(0.32, 0.48);
      for (let k = 0; k < 80; k++) { h += gs() * 0.1 - 0.06 * sin(h) * (x < 0 ? 1 : -1); const nx = x + cos(h) * 1.8, nz = z + sin(h) * 1.8; if (abs(nx) > hs + 1 || abs(nz) > hs || nz > zb(nx) - 1) break; cap(at(x, z, r * 0.6), r, at(nx, nz, r * 0.6), r, 0, 0, 0.5, 18); x = nx; z = nz; if (k === 22 && rnd() < 0.7) { let bx = x, bz = z, bh = h + (rnd() < 0.5 ? -0.6 : 0.6); for (let m = 0; m < 17; m++) { bh += gs() * 0.12; const qx = bx + cos(bh) * 1.8, qz = bz + sin(bh) * 1.8; if (abs(qx) > hs || abs(qz) > hs || qz > zb(qx) - 1) break; cap(at(bx, bz, r * 0.45), r * 0.7, at(qx, qz, r * 0.45), r * 0.65, 0, 0, 0.5, 18); bx = qx; bz = qz; } } }
    }
    blockers.push({ x: xn, z: zn, r: 2 });
    return;
  }
  if (world === 'leaf') {
    const surf = (x, z) => Hgt(x, z);
    for (let i = 0, n = low ? 18 : 32; i < n; i++) {                       // stomata: two kidney-shaped guard cells round a dark pore
      const x = rr(-hs + 3, hs - 3), z = rr(-hs + 3, hs - 3); if (abs(z - c.vein(x)) < 9) { i--; continue; }
      const a = rnd() * TAU, ca = cos(a), sa = sin(a), y = surf(x, z), P = (u, v, h) => [x + ca * u - sa * v, y + h, z + sa * u + ca * v];
      cap(P(-1.4, 0, 0.15), 0.35, P(1.4, 0, 0.15), 0.35, 0, 0, 0.5, 13);
      for (const e of [-1, 1]) { cap(P(-1.7, e * 0.25, 0.3), 0.45, P(-0.6, e * 0.85, 0.55), 0.62, 0, 1, 0.5, 12); cap(P(-0.6, e * 0.85, 0.55), 0.62, P(0.6, e * 0.85, 0.55), 0.62, 0, 1, 0.5, 12); cap(P(0.6, e * 0.85, 0.55), 0.62, P(1.7, e * 0.25, 0.3), 0.45, 0, 1, 0.5, 12); }
      c.stomata.push([x, z]);
    }
    for (let i = 0; i < (low ? 6 : 11); i++) {                            // hairs: a few cells end to end, tapering, curving over
      const x = rr(-hs + 4, hs - 4), z = rr(-hs + 4, hs - 4), a = rnd() * TAU, L = rr(22, 42), cv = rr(0.6, 1.2); let p = [x, surf(x, z) - 0.3, z];
      for (let k = 0; k < 5; k++) { const t = (k + 1) / 5, q = [x + cos(a) * L * t * 0.7, surf(x, z) + L * sin((1 - t * cv * 0.6) * PI / 2) * 0.6 * t + L * 0.08, z + sin(a) * L * t * 0.7]; cap(p, 1.6 * (1 - k * 0.18), q, 1.6 * (1 - (k + 1) * 0.18) + 0.1, 0, 1, 0.5, 8); p = q; }
    }
    for (let i = 0; i < (low ? 5 : 9); i++) {                             // glandular hairs: a short stalk and a golden head of oil
      const x = rr(-hs + 3, hs - 3), z = rr(-hs + 3, hs - 3), y = surf(x, z), h = rr(4, 7), t = [x + gs() * 0.5, y + h, z + gs() * 0.5];
      cap([x, y, z], 0.6, t, 0.5, 0, 1, 0.5, 8); cap(t, rr(2, 2.8), [t[0], t[1] + 0.4, t[2]], rr(2, 2.8), 0, 0, 0.92, 3);
    }
    for (let i = 0; i < 3; i++) {                                         // pollen grains, spiny, blown here
      const x = rr(-hs + 4, hs - 4), z = rr(-hs + 4, hs - 4), r = rr(2, 2.8), o = [x, surf(x, z) + r * 0.9, z];
      cap(o, r, o, r, 0, 0, 0.88, 3); for (let k = 0; k < 26; k++) { const u = rnd() * 2 - 1, a = rnd() * TAU, d = [sqrt(1 - u * u) * cos(a), u, sqrt(1 - u * u) * sin(a)]; cap([o[0] + d[0] * r, o[1] + d[1] * r, o[2] + d[2] * r], 0.22, [o[0] + d[0] * (r + 0.8), o[1] + d[1] * (r + 0.8), o[2] + d[2] * (r + 0.8)], 0.04, 0, 0, 0.88, 3); }
    }
    { // a fungal spore that has germinated: its thread wanders over the cells, branches once, and finds its way into a stoma
      const st = c.stomata[(rnd() * c.stomata.length) | 0] || [0, 0]; let x = st[0] + rr(-30, 30), z = st[1] + rr(-30, 30); x = Math.max(-hs + 2, Math.min(hs - 2, x)); z = Math.max(-hs + 2, Math.min(hs - 2, z));
      cap([x, surf(x, z) + 1.3, z], 1.3, [x + 1.5, surf(x, z) + 1.3, z + 0.6], 1.2, 0, 0, 0.7, 3);
      for (let k = 0; k < 120; k++) { const dx = st[0] - x, dz = st[1] - z, d = hypot(dx, dz); if (d < 0.6) break; const a = atan2s(dz, dx) + gs() * 0.6, nx = x + Math.cos(a) * 0.9, nz = z + Math.sin(a) * 0.9; cap([x, surf(x, z) + 0.35, z], 0.28, [nx, surf(nx, nz) + (hypot(st[0] - nx, st[1] - nz) < 1 ? -0.4 : 0.35), nz], 0.28, 0, 1, 0.2, 8); x = nx; z = nz; }
    }
    for (let i = 0; i < (low ? 120 : 260); i++) {                         // bacteria: short rods, in loose colonies
      const cx = rr(-hs, hs), cz = rr(-hs, hs); for (let k = 0; k < 6; k++) { const x = cx + gs() * 0.8, z = cz + gs() * 0.8, a = rnd() * TAU, y = surf(x, z) + 0.12; cap([x, y, z], 0.1, [x + cos(a) * 0.35, y, z + sin(a) * 0.35], 0.1, 0, 0, 0.5, 9); }
      i += 5;
    }
    return;
  }
  if (world === 'soil') {
    const grains = []; for (const a of rocks) for (let i = 0; i < a.length; i += 12) grains.push([a[i], a[i + 1], a[i + 2], a[i + 3]]);
    const surf = (x, z) => { let y = Hgt(x, z); for (const g of grains) { const d = hypot(x - g[0], z - g[2]); if (d < g[3]) y = max(y, g[1] + sqrt(g[3] * g[3] - d * d) * 0.85); } return y; };   // over the grains, not through them
    // a fine root crossing the plot, its tip behind a cloud of root hairs
    const root = []; let x = -hs - 4, z = rr(-hs * 0.4, hs * 0.4), a = rr(-0.2, 0.2);
    while (x < hs * 0.55) { root.push([x, z]); a += gs() * 0.08; x += cos(a) * 2; z += sin(a) * 2; }
    root.forEach((p, i) => {
      const r = 2.3 - 1.2 * i / root.length, q = root[i + 1]; if (!q) return;
      cap([p[0], surf(p[0], p[1]) + r * 0.5, p[1]], r, [q[0], surf(q[0], q[1]) + r * 0.5, q[1]], r, 0, 1, 0.3, 2);
      blockers.push({ x: p[0], z: p[1], r });
      if (i > root.length * 0.45) for (let k = 0; k < (low ? 6 : 14); k++) {   // root hairs: single cells, each a thin tube out from the root
        const b = rnd() * TAU, h = rr(2, 7), o = [p[0] + gs() * 0.8, surf(p[0], p[1]) + r * 0.5 + sin(b) * r, p[1] + cos(b) * r];
        cap(o, 0.07, [o[0] + gs() * 1.2, o[1] + sin(b) * h * 0.8, o[2] + cos(b) * h], 0.05, 0, 1, 0.3, 2);
      }
    });
    // fungal threads: each grows tip-first, keeps roughly its heading, branches now and then, follows the surface over
    // grains, and where it meets the root it wraps it
    const tips = []; for (let i = 0; i < (low ? 14 : 26); i++) tips.push([rr(-hs, hs), rr(-hs, hs), rnd() * TAU, low ? 50 : 90]);
    while (tips.length) {
      const t = tips.pop(); let [x0, z0, h, n] = t;
      for (; n > 0; n--) {
        h += gs() * 0.28; const x1 = x0 + cos(h) * 0.9, z1 = z0 + sin(h) * 0.9; if (abs(x1) > hs || abs(z1) > hs) break;
        const nr = root.find((p) => hypot(p[0] - x1, p[1] - z1) < 2.6), y0 = surf(x0, z0) + 0.08, y1 = nr ? surf(x1, z1) + 2.2 + gs() * 0.3 : surf(x1, z1) + 0.08;
        cap([x0, y0, z0], 0.07, [x1, y1, z1], 0.07, 0, 1, 0.2, 8); x0 = x1; z0 = z1;
        if (rnd() < 0.05 && tips.length < 400) tips.push([x0, z0, h + (rnd() < 0.5 ? -1 : 1) * rr(0.5, 1.1), n * 0.6]);
        if (rnd() < 0.012) cap([x0, y1 + 0.2, z0], 0.25, [x0, y1 + 0.3, z0], 0.25, 0, 0, rr(0.6, 0.72), 3);   // a spore resting on the thread
      }
    }
    for (let i = 0; i < (low ? 14 : 28); i++) {                           // pin mould: a stalk a millimetre or two tall, a black ball of spores on top
      const x = rr(-hs + 2, hs - 2), z = rr(-hs + 2, hs - 2), y = surf(x, z), h = rr(7, 18), t = [x + gs() * 0.8, y + h, z + gs() * 0.8];
      cap([x, y, z], 0.07, t, 0.06, 0, h, 0.2, 2); cap(t, rr(0.35, 0.55), up(t, 0.05), rr(0.35, 0.55), 0, 0, 0.5, rnd() < 0.25 ? 8 : 13);
    }
    for (let i = 0; i < (low ? 3 : 6); i++) {                             // Penicillium: little brushes whose bristles are chains of blue-green spores
      const cx = rr(-hs + 6, hs - 6), cz = rr(-hs + 6, hs - 6);
      for (let j = 0; j < 7; j++) {
        const x = cx + gs() * 1.5, z = cz + gs() * 1.5, y = surf(x, z), h = rr(2.5, 4.5), t = [x, y + h, z]; cap([x, y, z], 0.05, t, 0.05, 0, h, 0.2, 2);
        for (let b = 0; b < 4; b++) { const a = b / 4 * TAU + rnd(), d = [cos(a) * 0.35, 0.5, sin(a) * 0.35]; let p = t; for (let s = 0; s < 6; s++) { const q = [p[0] + d[0] * 0.28, p[1] + d[1] * 0.28, p[2] + d[2] * 0.28]; cap(q, 0.12, q, 0.12, 0, 0, 0.5, 19); p = q; } }
      }
    }
  }
}
