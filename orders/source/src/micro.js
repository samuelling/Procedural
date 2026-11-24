// Powers of ten, inward (2 MB rung). Two more worlds built from the same parts as the forest, at other scales:
//   log:  a hundred times smaller, a unit is a centimetre. 64 cm of forest floor across a rotting log: loose bark,
//         bracket fungi, a tuft of bonnet mushrooms, scarlet elf cups, acorns, twigs, fallen leaves, oak seedlings.
//   soil: ten thousand times smaller, a unit is a tenth of a millimetre. 6.4 mm of the top of the soil: sand grains,
//         a fine root with its root hairs, fungal threads that branch and drape over the grains and wrap the root,
//         pin moulds and blue-green Penicillium brushes, spores.
// The animals for each are in fx.js (woodlice, beetles, slugs and a centipede; nematodes and tardigrades).
/* global TIER */

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
  const { sin, cos, sqrt, max, abs, hypot, PI } = Math, TAU = PI * 2;
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
