// The horizon (2 MB rung, Earth only): the land round a real place out to 120 km, so the mountains you would see from
// the plot are there in the distance, and zooming out to the range carries on from what was already on the skyline.
// Measured: the mean, lowest and highest heights of each quarter-degree cell (ETOPO 2022), between the four nearest
// cells. Modelled: the shape inside a cell, ridged noise that stays near the mean and reaches toward the cell's highest
// point on its crests. The Earth curves away (with the usual allowance for the air bending light, a radius of 1.15 R),
// so a 3,000 m peak 150 km off stands about 1,500 m lower. Square rings of vertices, finer near, coarser far; the
// same vertex layout and shader as the valley.
/* global TIER */
import { fbm } from './noise.js';
import { elev, top } from './earth.js';

export function horizon(c) {
  const { abs, max, min, hypot, pow, cos, PI } = Math, sm = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const R0 = 2600, R1 = 120000, K = 56, N = 64, M = 4 * N, kl = cos(c.lat * PI / 180) * 111200, g = max(c.elev, 0) + (c.climb || 0);
  const ll = (x, z) => [c.lat - z / 111200, c.lon + x / kl];               // north is -z, east +x, as on the range
  const H = (x, z) => {
    const [la, lo] = ll(x, z), m = elev(la, lo), d = hypot(x, z), cv = d * d / (2 * 1.15 * 6371000);
    if (m === null) return [-g - cv, 1];                                     // the sea
    const t = top(la, lo), r = 1 - abs(2 * fbm(x * 0.00016 + 3.1, 7, z * 0.00016 + 1.7, 4) - 1);
    return [(m + max(0, t - m) * (r * r * 1.25 - 0.3)) - g - cv, 0];
  };
  const V = [], I = [];
  for (let k = 0; k <= K; k++) {
    const h = R0 * pow(R1 / R0, k / K), e = max(30, h * 0.03), w = sm(R0, R0 * 2.5, h);
    for (let i = 0; i < M; i++) {
      const s = i % N / N * 2 - 1, side = (i / N) | 0, x = side === 0 ? s * h : side === 1 ? h : side === 2 ? -s * h : -h, z = side === 0 ? -h : side === 1 ? s * h : side === 2 ? h : -s * h;
      const y0 = (x, z) => { const [y] = H(x, z); return y * w - (1 - w) * 40; };   // near its inner edge the band sinks below the valley's rim
      const [, sea] = H(x, z), y = y0(x, z), nx = y0(x - e, z) - y0(x + e, z), nz = y0(x, z - e) - y0(x, z + e), l = hypot(nx, 2 * e, nz);
      V.push(x, y, z, nx / l, 2 * e / l, nz / l, h, sea);
    }
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < M; i++) { const a = k * M + i, b = k * M + (i + 1) % M; I.push(a, a + M, b, b, a + M, b + M); }
  return { v: new Float32Array(V), i: new Uint16Array(I) };
}
