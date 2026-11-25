// Under the lake and into the rock (2 MB rung): two worlds at the forest's own scale, a unit a metre.
//
//   lake  64 m of a lake bed, 8 m at its deepest, under a surface at height 0. Lily pads float in the shallows,
//         pondweed stands up from the silt, sunken logs and boulders lie about; perch shoal and pike hunt them.
//         The light is the water's: green fog, moving caustics on the bed, and from below the surface Snell's window,
//         a bright disc of sky 97° across, with silver mirror beyond it.
//   cave  a limestone cave. The ground is the floor and the rock between passages; a second surface, drawn as rock,
//         is the roof. Passages are dissolved tubes that wander and join, lens-shaped in section the way water-filled
//         passages are, opening into a chamber whose roof has fallen in to the sky. Where water drips, a stalactite
//         hangs and a stalagmite grows under it, meeting as a column where the gap is small; soda straws cluster on
//         the roof; a pool lies in the lowest part of the chamber. Bats fly under the roof. You carry a lamp.
/* global TIER */
export function lakeLand(Hgt, hs) {
  return (x, z) => { const r = Math.hypot(x / hs, z / hs * 1.15); return Hgt(x, z) * 0.6 - 1.2 - 7 * Math.max(0, 1 - r * r) ** 0.8; };
}

export function caveLand(Hgt, rnd, hs) {
  const { sin, cos, max, min, hypot, PI } = Math, N = 256, C = 2 * hs / N, M = new Float32Array(N * N), O = new Float32Array(N * N), rr = (a, b) => a + (b - a) * rnd();
  const stamp = (x0, z0, x1, z1, w, oh) => {
    const i0 = max(0, ((min(x0, x1) - w + hs) / C) | 0), i1 = min(N - 1, ((max(x0, x1) + w + hs) / C) | 0), j0 = max(0, ((min(z0, z1) - w + hs) / C) | 0), j1 = min(N - 1, ((max(z0, z1) + w + hs) / C) | 0), dx = x1 - x0, dz = z1 - z0, L = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = -hs + i * C, z = -hs + j * C, t = max(0, min(1, ((x - x0) * dx + (z - z0) * dz) / L)), e = hypot(x - x0 - dx * t, z - z0 - dz * t) / w; if (e < 1) { const q = i + j * N, m = 1 - e * e; if (m > M[q]) { M[q] = m; O[q] = max(O[q], oh); } } }
  };
  const cx = rr(-6, 6), cz = rr(-6, 6), sky = [cx + rr(-3, 3), cz + rr(-3, 3)];
  for (let a = 0; a < PI * 2; a += 0.2) stamp(cx, cz, cx + cos(a) * 11, cz + sin(a) * 8, 6, 9);   // the chamber
  for (let k = 0; k < 4; k++) {                                              // passages wandering out from it, to the plot's edges
    let x = cx, z = cz, h = k * PI / 2 + rr(-0.5, 0.5); const w = rr(1.8, 3.2), oh = rr(2.6, 4.5);
    for (let s = 0; s < 40 && Math.abs(x) < hs + 2 && Math.abs(z) < hs + 2; s++) { h += rr(-0.35, 0.35); const nx = x + cos(h) * 1.5, nz = z + sin(h) * 1.5; stamp(x, z, nx, nz, w * (0.8 + 0.4 * sin(s * 0.7)), oh); x = nx; z = nz;
      if (s === 14 && rnd() < 0.7) { let bx = x, bz = z, bh = h + (rnd() < 0.5 ? 1.2 : -1.2); for (let q = 0; q < 14; q++) { bh += rr(-0.4, 0.4); const qx = bx + cos(bh) * 1.4, qz = bz + sin(bh) * 1.4; stamp(bx, bz, qx, qz, w * 0.6, oh * 0.7); bx = qx; bz = qz; } } }
  }
  const at = (F, x, z) => { const u = (x + hs) / C, v = (z + hs) / C, i = max(0, min(N - 2, u | 0)), j = max(0, min(N - 2, v | 0)), a = min(1, max(0, u - i)), b = min(1, max(0, v - j)), q = i + j * N; return (F[q] * (1 - a) + F[q + 1] * a) * (1 - b) + (F[q + N] * (1 - a) + F[q + N + 1] * a) * b; };
  const T = 9, pool = [cx + rr(-4, 4), cz + rr(-3, 3)];
  const fl = (x, z) => Hgt(x, z) - 1 - 0.9 * Math.max(0, 1 - hypot(x - pool[0], z - pool[1]) / 4.5) ** 1.5;   // the floor, with a hollow for the pool
  const m = (x, z) => at(M, x, z), oh = (x, z) => at(O, x, z) * (0.85 + 0.3 * sin(x * 0.3) * cos(z * 0.27));
  const ground = (x, z) => fl(x, z) + (1 - m(x, z)) ** 1.6 * T;            // floor in the passages, the rock's top between them
  const raw = (x, z) => fl(x, z) + T - m(x, z) ** 0.6 * (T - oh(x, z)), hole = (x, z) => hypot(x - sky[0], z - sky[1]) < 2.6;
  const roof = (x, z) => m(x, z) < 0.02 || hole(x, z) ? 1e9 : raw(x, z);
  return { Hgt: ground, cave: { m, roof, raw, hole, fl, sky, pool, cx, cz, T } };
}

// a flat sheet of water at height y, with each vertex's depth, cut away (in the shader) where it is under the ground
export function sheet(Hgt, y, x0, x1, z0, z1, n) {
  const v = [], ix = []; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * j / n; v.push(x, y, z, 0, 1, 0, y - Hgt(x, z), x); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = i + j * (n + 1); ix.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
  return { v: new Float32Array(v), i: new Uint16Array(ix) };
}

export function underBuild(world, c) {
  const { cap, card, Hgt, hs, rnd, low } = c, rr = (a, b) => a + (b - a) * rnd(), { cos, sin, hypot, PI } = Math;
  if (world === 'lake') {
    for (let i = 0, n = low ? 90 : 170; i < n; i++) {                      // lily pads where it is shallow, a few in flower
      const x = rr(-hs, hs), z = rr(-hs, hs); if (Hgt(x, z) < -2.6) continue; const a = rnd() * PI * 2, s = rr(0.22, 0.4);
      card([x, -0.015, z], s, [cos(a), 0, sin(a)], 0, 0.9, [0, 1, 0], 6, rnd()); if (rnd() < 0.08) card([x + 0.1, 0.05, z], 0.12, [0, 1, 0], 6, 1, [cos(a), 0, sin(a)], 6, rnd());
    }
    return;
  }
  const { roof, raw, hole, fl, m, sky } = c.cave, near = (x, z) => m(x, z) > 0 || m(x + 1.2, z) > 0 || m(x - 1.2, z) > 0 || m(x, z + 1.2) > 0 || m(x, z - 1.2) > 0;
  // a roof of rock, as a mesh of its own: where there is a passage, its underside
  const n = low ? 90 : 128, S = 2 * hs, v = [], ix = [], k = 1 / 0.3, id = new Int32Array((n + 1) * (n + 1)).fill(-1);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = -hs + S * i / n, z = -hs + S * j / n; if (!near(x, z) || hole(x, z)) continue; const y = raw(x, z), e = 0.25, nx = (raw(x + e, z) - y) / e, nz = (raw(x, z + e) - y) / e, l = Math.hypot(nx, 1, nz);   // carried a little past the passage's edge so it meets the rock's top
    id[i + j * (n + 1)] = v.length / 8; v.push(x * k, y * k, z * k, nx / l, -1 / l, nz / l, 0, 0);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = id[i + j * (n + 1)], b = id[i + 1 + j * (n + 1)], d = id[i + (j + 1) * (n + 1)], e = id[i + 1 + (j + 1) * (n + 1)]; if (a < 0 || b < 0 || d < 0 || e < 0) continue; ix.push(a, b, d, b, e, d); }
  c.cave.roofMesh = { v: new Float32Array(v), i: new Uint16Array(ix) };
  // where water drips: a stalactite above, a stalagmite below, or a column where they meet
  for (let i = 0, tries = 0; i < (low ? 70 : 140) && tries < 4000; tries++) {
    const x = rr(-hs, hs), z = rr(-hs, hs), R = roof(x, z), F = fl(x, z); if (R > 1e8 || m(x, z) < 0.35 || hypot(x - sky[0], z - sky[1]) < 4) continue; const g = R - F; if (g < 0.8) continue; i++;
    const lt = g * rr(0.05, 0.3), lm = g * rr(0.03, 0.25), rt = rr(0.05, 0.18), rm = rr(0.1, 0.3);
    if (lt + lm > g * 0.8 && rnd() < 0.6) { cap([x, F - 0.1, z], rm * 1.4, [x, R + 0.1, z], rt * 1.2, 0, 0, 0.5, 8); continue; }   // a column
    cap([x, R + 0.05, z], rt, [x, R - lt, z], 0.012, 0, 0, 0.5, 8); cap([x, F - 0.1, z], rm, [x, F + lm, z], rm * 0.45, 0, 0, 0.5, 8);
  }
  for (let i = 0; i < (low ? 8 : 16); i++) {                                // soda straws: thin hollow tubes in clusters on the roof
    const x0 = rr(-hs, hs), z0 = rr(-hs, hs); if (roof(x0, z0) > 1e8 || m(x0, z0) < 0.5) continue;
    for (let j = 0; j < 14; j++) { const x = x0 + rr(-0.6, 0.6), z = z0 + rr(-0.6, 0.6), R = roof(x, z); if (R > 1e8) continue; cap([x, R + 0.02, z], 0.006, [x, R - rr(0.05, 0.5), z], 0.005, 0, 0, 0.5, 8); }
  }
}
