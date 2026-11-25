// Powers of ten, outward (2 MB rung): a mountain range 640 km across, ten thousand times bigger than the plot. A unit
// is ten kilometres, and heights are drawn ten times taller than they are, as relief maps do (a unit a km).
// The land is raised in belts, then worn down by its rivers: each pass fills the hollows to find where water would go,
// routes every cell to its steepest neighbour, adds up the area draining through each, and cuts each cell in
// proportion to the square root of that area times its slope (the stream-power law), with a little creep that rounds
// the ridges. What is left in the hollows becomes lakes; where enough land drains, a river is drawn.
/* global TIER */
import { fbm } from './noise.js';

const HIST = new Map();   // each range's wearing-down, kept a stage at a time so it can be played back
export function rangeLand(rnd, hs, stage = 10) {
  const { sin, cos, sqrt, max, min, abs, exp, PI } = Math, N = 256, C = 2 * hs / (N - 1), NN = N * N, U = 1;   // units per km of height
  const h = new Float32Array(NN), f = new Float32Array(NN), A = new Float32Array(NN), rc = new Int32Array(NN), ord = new Int32Array(NN);
  const ox = rnd() * 99, oz = rnd() * 99, belts = [], kh = ox + ',' + oz;
  for (let k = 0; k < 3; k++) belts.push([(rnd() - 0.5) * hs, (rnd() - 0.5) * hs, rnd() * PI, 6 + rnd() * 7, 2 + rnd() * 1.4, rnd() * 9]);   // centre, strike, half-width, height (km), phase
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -hs + i * C, z = -hs + j * C, wx = x + 6 * fbm(x * 0.03 + ox, 0, z * 0.03, 3), wz = z + 6 * fbm(x * 0.03, 5, z * 0.03 + oz, 3);
    let u = 0; for (const b of belts) { const cs = cos(b[2]), sn = sin(b[2]), a = (wx - b[0]) * cs + (wz - b[1]) * sn, d = -(wx - b[0]) * sn + (wz - b[1]) * cs; u = max(u, b[4] * exp(-((d / b[3]) ** 2)) * (0.65 + 0.35 * sin(a * 0.09 + b[5]))); }
    const r = 1 - abs(fbm(x * 0.32 + ox, 2, z * 0.32 + oz, 4) * 2 - 1);                                    // ridged: sharp crests a few tens of km apart
    h[i + j * N] = 0.2 + u * (0.3 + 0.8 * r * r) + 0.3 * fbm(x * 0.06, 7, z * 0.06, 3) + 0.18 * fbm(x * 0.7, 3, z * 0.7, 3);
  }
  const nb = [-1, 1, -N, N, -N - 1, -N + 1, N - 1, N + 1], dd = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
  const edge = (q) => { const i = q % N, j = (q / N) | 0; return i === 0 || j === 0 || i === N - 1 || j === N - 1; };
  const fill = () => {                                                       // priority flood from the edges: the lowest surface water can drain over
    const hp = [], push = (q, v) => { hp.push([v, q]); let c = hp.length - 1; while (c) { const p = (c - 1) >> 1; if (hp[p][0] <= hp[c][0]) break; [hp[p], hp[c]] = [hp[c], hp[p]]; c = p; } };
    const pop = () => { const t = hp[0], l = hp.pop(); if (hp.length) { hp[0] = l; let c = 0; for (;;) { const a = 2 * c + 1, b = a + 1; let m = c; if (a < hp.length && hp[a][0] < hp[m][0]) m = a; if (b < hp.length && hp[b][0] < hp[m][0]) m = b; if (m === c) break; [hp[m], hp[c]] = [hp[c], hp[m]]; c = m; } } return t; };
    f.fill(-1); let n = 0;
    for (let q = 0; q < NN; q++) if (edge(q)) { f[q] = h[q]; push(q, h[q]); rc[q] = -1; }
    while (hp.length) { const [v, q] = pop(); ord[n++] = q; const i = q % N; for (let k = 0; k < 8; k++) { const p = q + nb[k], pi = i + (k === 0 || k === 4 || k === 6 ? -1 : k === 1 || k === 5 || k === 7 ? 1 : 0); if (p < 0 || p >= NN || pi < 0 || pi >= N || f[p] >= 0) continue; f[p] = max(h[p], v + 1e-5); rc[p] = q; push(p, f[p]); } }
    return n;
  };
  const st = HIST.get(kh) || [];
  if (!st.length) for (let it = 0; it < 30; it++) {                                          // the rivers wear the land down
    if (it % 3 === 0) st.push(h.slice());
    const n = fill(); A.fill(1);
    for (let k = n - 1; k > 0; k--) { const q = ord[k]; if (rc[q] >= 0) A[rc[q]] += A[q]; }   // highest first: each cell passes on what drains through it
    for (let k = 1; k < n; k++) { const q = ord[k], r = rc[q]; if (r < 0) continue; const s = (f[q] - f[r]) / (C * 10), e = min(0.035 * sqrt(A[q]) * s, max(0, h[q] - f[r] - 0.002)); h[q] -= e; }
    const g = h.slice(); for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const q = i + j * N; h[q] += 0.06 * ((g[q - 1] + g[q + 1] + g[q - N] + g[q + N]) / 4 - g[q]); }   // creep
    if (it === 29) { st.push(h.slice()); HIST.set(kh, st); }
  }
  h.set(st[Math.max(0, Math.min(10, stage))]);
  fill(); A.fill(1); for (let k = NN - 1; k > 0; k--) { const q = ord[k]; if (rc[q] >= 0) A[rc[q]] += A[q]; }
  const lake = new Uint8Array(NN); for (let q = 0; q < NN; q++) if (f[q] - h[q] > 0.1) lake[q] = 1; else h[q] = f[q];   // deep hollows hold lakes; the shallow ones silt up
  const at = (F, x, z) => { const u = (x + hs) / C, v = (z + hs) / C, i = max(0, min(N - 2, u | 0)), j = max(0, min(N - 2, v | 0)), a = min(1, max(0, u - i)), b = min(1, max(0, v - j)), q = i + j * N; return (F[q] * (1 - a) + F[q + 1] * a) * (1 - b) + (F[q + N] * (1 - a) + F[q + N + 1] * a) * b; };
  const Hgt = (x, z) => at(f, x, z) * U, L = new Float32Array(lake), wet = (x, z) => at(L, x, z);
  // rivers, where more than about 600 km² drains through, traced from each source down to the edge, a lake or a bigger
  // river, then smoothed so they bend instead of following the grid; drawn wider than they are (half a km to 2) so they show
  const T = 96, done = new Uint8Array(NN), xy = (q) => [-hs + (q % N) * C, -hs + ((q / N) | 0) * C];
  const src = []; for (let q = 0; q < NN; q++) if (A[q] >= T && !lake[q]) { let up = 0; for (let k = 0; k < 8; k++) { const p = q + nb[k]; if (p >= 0 && p < NN && rc[p] === q && A[p] >= T) up = 1; } if (!up) src.push(q); }
  const draw = (cap) => {
    for (const s0 of src) {
      let q = s0, P = [], W = []; while (q >= 0 && !lake[q]) { P.push(xy(q)); W.push(A[q]); if (done[q]) break; done[q] = 1; q = rc[q]; } if (q >= 0) { P.push(xy(q)); W.push(A[q]); }
      for (let it = 0; it < 2; it++) { const Q = [P[0]], V = [W[0]]; for (let k = 0; k < P.length - 1; k++) { const a = P[k], b = P[k + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); V.push(W[k], W[k + 1]); } Q.push(P[P.length - 1]); V.push(W[W.length - 1]); P = Q; W = V; }
      for (let k = 0; k < P.length - 1; k++) { const a = P[k], b = P[k + 1], w = min(0.1, 0.02 + 0.0025 * sqrt(W[k])); cap([a[0], Hgt(a[0], a[1]) + 0.004, a[1]], w, [b[0], Hgt(b[0], b[1]) + 0.004, b[1]], w, 0, 0, 0.5, 19); }
    }
    for (let k = 0; k < 26; k++) {                                          // cumulus building over the high ground in the afternoon
      let x = 0, z = 0, t = 0; do { x = (rnd() - 0.5) * 2 * hs * 0.9; z = (rnd() - 0.5) * 2 * hs * 0.9; } while (Hgt(x, z) < 1.2 + rnd() * 1.2 && ++t < 40);
      const y = 2.6 + rnd() * 0.3; for (let m = 0; m < 7; m++) { const r = 0.25 + rnd() * 0.45, a = rnd() * PI * 2, d = rnd() * 0.9; cap([x + cos(a) * d, y + r * 0.4 + rnd() * 0.3, z + sin(a) * d], r, [x + cos(a) * d + 0.2, y + r * 0.5, z + sin(a) * d], r * 0.9, 0, 0, 0.5, 8); }
    }
  };
  return { Hgt, wet, range: { draw } };
}
