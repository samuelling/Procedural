// Under the lake and into the rock (2 MB rung): two worlds at the forest's own scale, a unit a metre.
//
//   lake  64 m of a lake bed, 8 m at its deepest, under a surface at height 0. Lily pads float in the shallows,
//         pondweed stands up from the silt, sunken logs and boulders lie about; perch shoal and pike hunt them.
//         The light is the water's: green fog, moving caustics on the bed, and from below the surface Snell's window,
//         a bright disc of sky 97° across, with silver mirror beyond it.
//   cave  its rock is in cave3.js; here, what grows in it: where water drips, a stalactite hangs and a stalagmite
//         grows under it, meeting as a column where the gap is small; soda straws cluster on the roof.
/* global TIER */
export function lakeLand(Hgt, hs) {
  return (x, z) => { const r = Math.hypot(x / hs, z / hs * 1.15); return Hgt(x, z) * 0.6 - 1.2 - 7 * Math.max(0, 1 - r * r) ** 0.8; };
}

// a flat sheet of water at height y, with each vertex's depth, cut away (in the shader) where it is under the ground
export function sheet(Hgt, y, x0, x1, z0, z1, n) {
  const v = [], ix = []; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * j / n; v.push(x, y, z, 0, 1, 0, y - Hgt(x, z), x); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = i + j * (n + 1); ix.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
  return { v: new Float32Array(v), i: new Uint16Array(ix) };
}

export function underBuild(world, c) {
  const { cap, card, Hgt, hs, rnd, low } = c, rr = (a, b) => a + (b - a) * rnd(), { cos, sin, PI } = Math;
  if (world === 'lake' && c.sea) {                                         // the kelp forest's floor: sea urchins grazing on the rock
    for (let i = 0; i < (low ? 60 : 120); i++) { const x = rr(-hs, hs), z = rr(-hs, hs), y = Hgt(x, z), r = rr(0.04, 0.08); cap([x, y + r * 0.6, z], r, [x, y + r * 0.7, z], r, 0, 0, 0.5, 13); for (let k = 0; k < 6; k++) { const a = rnd() * 6.28, e = rnd() * 0.8; cap([x, y + r, z], 0.006, [x + cos(a) * r * 2.4, y + r + sin(e) * r * 2, z + sin(a) * r * 2.4], 0.003, 0, 0, 0.5, 13); } }
    return;
  }
  if (world === 'lake') {
    for (let i = 0, n = low ? 90 : 170; i < n; i++) {                      // lily pads where it is shallow, a few in flower
      const x = rr(-hs, hs), z = rr(-hs, hs); if (Hgt(x, z) < -2.6) continue; const a = rnd() * PI * 2, s = rr(0.22, 0.4);
      card([x, -0.015, z], s, [cos(a), 0, sin(a)], 0, 0.9, [0, 1, 0], 6, rnd()); if (rnd() < 0.08) card([x + 0.1, 0.05, z], 0.12, [0, 1, 0], 6, 1, [cos(a), 0, sin(a)], 6, rnd());
    }
    return;
  }
  // where water drips: a stalactite above, a stalagmite below, or a column where they meet; soda straws by some
  for (const [x, F, R, z] of c.cave.drips.slice(0, low ? 90 : 170)) {
    const g = R - F, lt = g * rr(0.05, 0.3), lm = g * rr(0.03, 0.25), rt = rr(0.05, 0.18), rm = rr(0.1, 0.3);
    if (lt + lm > g * 0.7 && rnd() < 0.6) { cap([x, F - 0.1, z], rm * 1.4, [x, R + 0.1, z], rt * 1.2, 0, 0, 0.5, 8); continue; }   // a column
    cap([x, R + 0.05, z], rt, [x, R - lt, z], 0.012, 0, 0, 0.5, 8); cap([x, F - 0.1, z], rm, [x, F + lm, z], rm * 0.45, 0, 0, 0.5, 8);
    if (rnd() < 0.25) for (let j = 0; j < 10; j++) { const a = rnd() * 6.28, d = rr(0.2, 0.7); cap([x + cos(a) * d, R + 0.05, z + sin(a) * d], 0.006, [x + cos(a) * d, R - rr(0.05, 0.45), z + sin(a) * d], 0.005, 0, 0, 0.5, 8); }
  }
}
