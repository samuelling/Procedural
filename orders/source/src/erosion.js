// Deep time (2 MB rung): the stream carving the plot over thousands of years.
//
// When deep time begins, the valley floor a little downstream of the plot drops 16 m along a fault, as base level
// does when land is lifted or a river below cuts down. The stream now spills over a step, and from then on it cuts
// back toward the plot. Under the plot lies a bed of hard sandstone a few metres down, between soft shale and soil.
//
// On a 1 m grid 256 m across, every 25 years: the hollows are filled to find where water goes (priority flood from
// the edges); every cell drains to its steepest neighbour; the area draining through each is summed, with the stream's
// own catchment coming in at its upstream end; each cell is cut by the stream-power law, E = K A^½ S, solved
// implicitly so that it is stable at any step; K is ten times smaller in the sandstone. Then slopes too steep for
// their rock give way (shale and soil stand at about 37°, sandstone near vertical), and soil creeps.
//
// That is enough for the classic result: the hard bed holds a lip, the soft rock below is cut out from under it, and
// the waterfall walks upstream leaving a gorge behind. Rates are set so a stream this size moves its falls a few
// centimetres a year: the order of small sandstone falls, not measured for any one. Unverified.
/* global TIER */
export function mkErosion(H0, zc, bed, hs) {
  const N = 256, X0 = -128, NN = N * N, D = 16, xs0 = hs + 36, Ks = 1.3e-3, Kh = Ks / 10, dt = 25, Ain = 3e5;
  const top = bed(xs0) - 0.8, bot = top - 4.5, xs = (z) => xs0 + 5 * Math.sin(z * 0.017 + 1);
  const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }, scarp = (x, z) => D * sm((x - xs(z) + 1.5) / 3);
  const B = new Float32Array(NN), E = new Float32Array(NN), h = new Float32Array(NN), f = new Float32Array(NN), A = new Float32Array(NN), rc = new Int32Array(NN), ord = new Int32Array(NN);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = X0 + i, z = X0 + j; B[i + j * N] = H0(x, z) - scarp(x, z); }
  const ent = Math.round(Math.max(1, Math.min(N - 2, zc(X0) - X0))) * N + 1;                 // where the stream comes in
  const hard = (y) => y < top && y > bot, nb = [-1, 1, -N, N, -N - 1, -N + 1, N - 1, N + 1], ds = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414], di = [-1, 1, 0, 0, -1, 1, -1, 1];
  const hk = new Float64Array(NN), hq = new Int32Array(NN); let hn = 0;
  const push = (v, q) => { let c = hn++; while (c) { const p = (c - 1) >> 1; if (hk[p] <= v) break; hk[c] = hk[p]; hq[c] = hq[p]; c = p; } hk[c] = v; hq[c] = q; };
  const pop = () => { const q = hq[0], v = hk[--hn], w = hq[hn]; let c = 0; for (;;) { const a = 2 * c + 1; if (a >= hn) break; const b = a + 1 < hn && hk[a + 1] < hk[a] ? a + 1 : a; if (hk[b] >= v) break; hk[c] = hk[b]; hq[c] = hq[b]; c = b; } hk[c] = v; hq[c] = w; return q; };
  const route = () => {
    f.fill(-1e9); let n = 0; hn = 0;
    for (let q = 0; q < NN; q++) { const i = q % N, j = (q / N) | 0; if (!i || !j || i === N - 1 || j === N - 1) { f[q] = h[q]; rc[q] = -1; push(h[q], q); } }
    while (hn) { const q = pop(), v = f[q], i = q % N; ord[n++] = q; for (let k = 0; k < 8; k++) { const p = q + nb[k], pi = i + di[k]; if (p < 0 || p >= NN || pi < 0 || pi >= N || f[p] > -1e8) continue; f[p] = Math.max(h[p], v + 1e-4); rc[p] = q; push(f[p], p); } }
    A.fill(1); A[ent] += Ain; for (let k = NN - 1; k > 0; k--) { const q = ord[k]; if (rc[q] >= 0) A[rc[q]] += A[q]; }
  };
  const step = (years) => {
    for (let t = 0; t < years; t += dt) {
      for (let q = 0; q < NN; q++) h[q] = B[q] - E[q];
      route();
      for (let k = 0; k < NN; k++) {                                         // outlets first, so each cell's receiver is already cut
        const q = ord[k], r = rc[q]; if (r < 0) continue; const d = Math.abs(r - q) === 1 || Math.abs(r - q) === N ? 1 : 1.414, F = (hard(h[q]) ? Kh : Ks) * Math.sqrt(A[q]) * dt / d;
        const v = (h[q] + F * h[r]) / (1 + F); if (v < h[q]) { E[q] += h[q] - v; h[q] = v; }
      }
      for (let s = 0; s < 2; s++) for (let q = N; q < NN - N; q++) {          // what is too steep for its rock gives way
        const i = q % N; if (!i || i === N - 1 || A[q] > 400) continue; const sx = hard(h[q]) ? 8 : 0.75;   // the stream's own bed is the stream's to cut
        for (let k = 0; k < 4; k++) { const p = q + nb[k], m = h[p] + sx; if (h[q] > m) { E[q] += h[q] - m; h[q] = m; } }
      }
      for (let q = N + 1; q < NN - N - 1; q++) { if (hard(h[q])) continue; const l = h[q - 1] + h[q + 1] + h[q - N] + h[q + N] - 4 * h[q]; E[q] -= 0.06 * l * (l < 0 ? 1 : 0.5); }   // soil creep
    }
    water();
  };
  const at = (x, z) => { const u = x - X0, v = z - X0; if (u < 0 || v < 0 || u >= N - 1 || v >= N - 1) return 0; const i = u | 0, j = v | 0, a = u - i, b = v - j, q = i + j * N; return (E[q] * (1 - a) + E[q + 1] * a) * (1 - b) + (E[q + N] * (1 - a) + E[q + N + 1] * a) * b; };
  const low = (x, z) => scarp(x, z) + at(x, z);
  // the water's surface along the stream: the lowest ground across the channel, a little water on it, and every pool
  // filled to its lip
  const W0 = -hs - 400, WN = 1600, wl = new Float32Array(WN), wo = new Float32Array(WN);
  const water = () => {
    for (let k = 0; k < WN; k++) { const x = W0 + k; let m = 1e9, mo = 0; for (let o = -6; o <= 6; o += 0.5) { const y = H0(x, zc(x) + o) - low(x, zc(x) + o) + Math.abs(o) * 0.01; if (y < m) { m = y; mo = o; } } wl[k] = m + 0.3; wo[k] = mo; }
    for (let k = 2; k < WN - 2; k++) wo[k] = (wo[k - 2] + wo[k - 1] + wo[k] + wo[k + 1] + wo[k + 2]) / 5;   // where the deepest water runs, a little off the old line where the gorge wandered
    for (let k = WN - 2; k >= 0; k--) wl[k] = Math.max(wl[k], wl[k + 1] + 0.001);
  };
  water();
  return { E, step, low, top, bot, xs, zo: (x) => wo[Math.min(WN - 1, Math.max(0, Math.round(x - W0)))], lvl: (x) => { const u = Math.min(WN - 1.001, Math.max(0, x - W0)), k = u | 0; return wl[k] + (wl[k + 1] - wl[k]) * (u - k); }, years: 0 };
}
