// The circuit. Wiring comes from the genome's connection rules and distance; each cell then fires as a
// Poisson process whose rate is a normalization equation: its excitatory drive, squared, divided by itself
// plus a suppressive pool fed by the inhibitory cells. Adaptation ends bursts. Time is display time:
// conduction is slowed several hundred-fold so you can watch it travel.
import { rng } from './grow.js';
const { exp, hypot, max, round } = Math, BIN = 0.01, NB = 256;

export function makeNet(G, units, seed) {
  const N = units.length, P = G.net, rnd = rng(seed ^ 0x51ed27), sel = (k) => units.map((u, i) => i).filter((i) => (k === 'E' ? !units[i].I && !units[i].in : units[i].t === k));
  const e = new Float32Array(N), s = new Float32Array(N), a = new Float32Array(N), last = new Float32Array(N).fill(-9);
  const tex = new Float32Array(N * 8).fill(-9);   // row 0: last two spike times per cell · row 1: Brainbow hue, type hue
  units.forEach((u, i) => { tex[N * 4 + i * 4] = u.hue; tex[N * 4 + i * 4 + 1] = u.th; });
  const out = units.map(() => []);
  let syn = 0;
  for (const [pre, post, w, k, sx, sz] of P.conn) {
    const A = sel(pre), B = sel(post); if (!B.length) continue;
    for (const i of A) for (let made = 0, tr = 0; tr < k * 14 && made < k; tr++) {
      const j = B[(rnd() * B.length) | 0], u = units[i], v = units[j]; if (j === i) continue;
      const dx = (v.x - u.x) / (sx || P.sig[0]), dz = (v.z - u.z) / (sz || P.sig[1]);
      if (rnd() < exp(-0.5 * (dx * dx + dz * dz))) { out[i].push(j, u.I ? -w : w, max(1, round((0.04 + hypot(v.x - u.x, v.y - u.y, v.z - u.z) / P.v) / BIN))); made++; syn++; }
    }
  }
  const bins = Array.from({ length: NB }, () => []), due = [];
  let cur = 0, acc = 0, T = 0;
  const de = exp(-BIN / 0.1), ds = exp(-BIN / 0.18), da = exp(-BIN / 1.6);
  const fire = (i, on) => {
    tex[i * 4 + 1] = tex[i * 4]; tex[i * 4] = last[i] = T; a[i] += 1;
    const o = out[i]; for (let k = 0; k < o.length; k += 3) bins[(cur + o[k + 2]) % NB].push(o[k], o[k + 1]);
    on && on(i);
  };
  const tick = (on) => {
    const b = bins[cur]; for (let k = 0; k < b.length; k += 2) { if (b[k + 1] > 0) e[b[k]] += b[k + 1]; else s[b[k]] -= b[k + 1]; } b.length = 0;
    cur = (cur + 1) % NB; T += BIN;
    for (let k = due.length - 2; k >= 0; k -= 2) if (due[k + 1] <= T) { fire(due[k], on); due.splice(k, 2); }
    for (let i = 0; i < N; i++) {
      e[i] *= de; s[i] *= ds; a[i] *= da;
      const u = units[i]; if (T - last[i] < 0.07) continue;
      let r = u.b;
      if (!u.in) { const x = max(0, e[i] + u.b - P.ka * a[i]), sn = P.ks * s[i]; r = P.rm * x * x / (P.sg * P.sg + x * x + sn * sn); }
      if (rnd() < r * BIN) fire(i, on);
    }
  };
  return {
    N, tex, syn, get t() { return T; },
    step(dt, on) { acc += Math.min(dt, 0.1); while (acc >= BIN) { acc -= BIN; tick(on); } },
    // a volley in the input fibres around (x, z)
    stim(x, z) {
      const [rx, rz] = P.stim; let n = 0;
      units.forEach((u, i) => { if (u.in) { const dx = (u.x - x) / rx, dz = (u.z - z) / rz; if (rnd() < exp(-0.5 * (dx * dx + dz * dz))) { n++; for (let k = 0; k < 3; k++) due.push(i, T + 0.02 + rnd() * 0.05 + k * 0.08); } } });
      return n;
    },
  };
}
