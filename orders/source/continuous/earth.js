// The measured maps (earthdata.js, packed by tools/earthpack.py), unpacked once: the Earth's ground and sea floor,
// its lakes, its climate and where nine tree genera grow; and the ground of the Moon, Mars, Venus and Mercury. Each
// map becomes a grid of floats here (for the camera, picking and placing) and a texture (for drawing).
import { inflateSync } from 'fflate';
import { EARTH } from './earthdata.js';
import { LIGHTS } from './lightdata.js';
import { PATCHES } from './patchdata.js';

const { floor, max, min, sqrt, hypot, asin, atan2, PI, abs } = Math;
let raw = null, hdr = null;
function sec(name) {
  if (!raw) { const b = atob(EARTH), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); raw = inflateSync(u); const n = raw[0] | raw[1] << 8 | raw[2] << 16 | raw[3] << 24; hdr = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + n))); hdr.base = 4 + n; }
  const s = hdr.find((x) => x.name === name); return { ...s, b: raw.subarray(hdr.base + s.off, hdr.base + s.off + s.len) };
}
// undo the median edge predictor: residuals mod m back to values (signed, centred on 0)
function unmed(r, w, h, m, hi, lo = 0) {
  const q = new Int32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, A = i ? q[k - 1] : 0, B = j ? q[k - w] : 0, C = i && j ? q[k - w - 1] : 0;
    const p = C >= max(A, B) ? min(A, B) : C <= min(A, B) ? max(A, B) : A + B - C;
    let v = (hi ? r[k] | hi[k] << 8 : r[k]) + p - lo; v = ((v % m) + m) % m + lo; q[k] = v;   // the values lie in lo .. lo + m
  }
  return q;
}
// a grid that also remembers how its value is read: bicubic (Catmull-Rom) in longitude and latitude
export class Grid {
  constructor(w, h, ch = 1) { this.w = w; this.h = h; this.ch = ch; this.a = new Float32Array(w * h * ch); }
  at(i, j, c = 0) { const w = this.w; i = ((i % w) + w) % w; j = j < 0 ? 0 : j >= this.h ? this.h - 1 : j; return this.a[(j * w + i) * this.ch + c]; }
  xy(u) { const lat = asin(max(-1, min(1, u[2]))), lon = atan2(u[1], u[0]); return [(lon / PI + 1) * 0.5 * this.w - 0.5, (0.5 - lat / PI) * this.h - 0.5]; }
  cubic(u, c = 0) {
    const [x, y] = this.xy(u), i = floor(x), j = floor(y), fx = x - i, fy = y - j;
    const wt = (t) => [((-t + 2) * t - 1) * t / 2, ((3 * t - 5) * t * t + 2) / 2, ((-3 * t + 4) * t + 1) * t / 2, (t - 1) * t * t / 2], wx = wt(fx), wy = wt(fy);
    let s = 0; for (let b = 0; b < 4; b++) { let r = 0; for (let a = 0; a < 4; a++) r += wx[a] * this.at(i - 1 + a, j - 1 + b, c); s += wy[b] * r; } return s;
  }
  lin(u, c = 0) { const [x, y] = this.xy(u), i = floor(x), j = floor(y), fx = x - i, fy = y - j; return (this.at(i, j, c) * (1 - fx) + this.at(i + 1, j, c) * fx) * (1 - fy) + (this.at(i, j + 1, c) * (1 - fx) + this.at(i + 1, j + 1, c) * fx) * fy; }
  cubicC(u) {                                                               // channel 0, clamped as the shaders clamp it
    const [x, y] = this.xy(u), i = floor(x), j = floor(y), fx = x - i, fy = y - j;
    const wt = (t) => [((-t + 2) * t - 1) * t / 2, ((3 * t - 5) * t * t + 2) / 2, ((-3 * t + 4) * t + 1) * t / 2, (t - 1) * t * t / 2], wx = wt(fx), wy = wt(fy);
    let s = 0, lo = 1e9, hi = -1e9; for (let b = 0; b < 4; b++) { let r = 0; for (let a = 0; a < 4; a++) { const v = this.at(i - 1 + a, j - 1 + b); r += wx[a] * v; if ((a === 1 || a === 2) && (b === 1 || b === 2)) { if (v < lo) lo = v; if (v > hi) hi = v; } } s += wy[b] * r; }
    return lo > 0 ? max(s, lo) : hi < 0 ? min(s, hi) : s;
  }
  near(u, c = 0) { const [x, y] = this.xy(u); return this.at(floor(x + 0.5), floor(y + 0.5), c); }
}
// relief: how rough the ground is round each cell (the spread of its 3 x 3 neighbourhood), as a multiplier for the
// invented detail laid over the measured ground (0.05 on a plain, up to 1.6 in high mountains)
// (into channel 3 of grid o, whose cells are f of g's a side; each is read over its own cells and a margin of one)
function relief(g, o, f) {
  const { w } = g, a = g.a, ch = g.ch;
  for (let J = 0; J < o.h; J++) for (let I = 0; I < o.w; I++) {
    let s = 0, s2 = 0, n = 0; const j0 = J * f - 1, i0 = I * f - 1;
    for (let j = j0; j <= j0 + f + 1; j++) { const jj = j < 0 ? 0 : j >= g.h ? g.h - 1 : j; for (let i = i0; i <= i0 + f + 1; i++) { const v = a[(jj * w + ((i + w) % w)) * ch]; s += v; s2 += v * v; n++; } }
    const sd = sqrt(max(0, s2 / n - (s / n) ** 2)); o.a[(J * o.w + I) * o.ch + 3] = min(1.6, max(0.05, sd / 260));
  }
}
let EARTHD = null;
// the Earth: heights (6'), lake surfaces, relief; climate (half-degree); the nine genera (quarter-degree)
export function earth() {
  if (EARTHD) return EARTHD;
  const L = sec('land'), Sx = sec('sea'), Lk = sec('lake'), Lv = sec('lakes'), C = sec('clim'), Gn = sec('gen');
  const W = L.w, Hh = L.h, q = unmed(L.b, W, Hh, 256, null, -8), s = unmed(Sx.b, Sx.w, Sx.h, 256), lv = new Int16Array(Lv.b.buffer.slice(Lv.b.byteOffset, Lv.b.byteOffset + Lv.b.length));
  const g = new Grid(W, Hh, 2), a = g.a, f = W / Sx.w, lake = Lk.b;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, v = q[k]; let h;
    if (v > 0) h = (v / 2.3) ** 2;
    else if (v === 0) h = lv[lake[k]] - 15;                                 // a lake: its bed 15 m under its surface
    else { const x = (i + 0.5) / f - 0.5, y = (j + 0.5) / f - 0.5, i0 = floor(x), j0 = floor(y), fx = x - i0, fy = y - j0, S = (ii, jj) => -(((s[min(Sx.h - 1, max(0, jj)) * Sx.w + ((ii % Sx.w) + Sx.w) % Sx.w]) / 0.45) ** 2);
      h = (S(i0, j0) * (1 - fx) + S(i0 + 1, j0) * fx) * (1 - fy) + (S(i0, j0 + 1) * (1 - fx) + S(i0 + 1, j0 + 1) * fx) * fy; }
    a[k * 2] = h; a[k * 2 + 1] = -1e4;
  }
  // the coast: next to land the sea is no deeper than the land beside it is high, so the shore falls between the
  // cells, where the map puts it; next to the sea low land stands at least 2 m up
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (q[k] !== -1) continue; let m = 1e9;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj < 0 || jj >= Hh) continue; const kk = jj * W + ((i + di + W) % W); if (q[kk] > 0) m = min(m, a[kk * 2]); }
    if (m < 1e9) { a[k * 2] = max(a[k * 2], -max(2, m)); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj < 0 || jj >= Hh) continue; const kk = jj * W + ((i + di + W) % W); if (q[kk] > 0) a[kk * 2] = max(a[kk * 2], 2); } }
  }
  // lake surfaces, on their own cells; the land round a lake stands at least 15 m over it, as its bed lies 15 m under,
  // so the shore falls between the cells, where the map puts it
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const k = j * W + i, id = lake[k]; if (!id) continue; const L0 = lv[id]; a[k * 2 + 1] = L0;
    for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const jj = j + b; if (jj < 0 || jj >= Hh) continue; const kk = jj * W + ((i + c + W) % W); if (q[kk] > 0 && !lake[kk]) a[kk * 2] = max(a[kk * 2], L0 + 15); } }
  // climate: sea-level mean temperature, the seasonal swing (signed: + when July is warmer), the year's rain (mm)
  const n = C.w * C.h, cl = new Grid(C.w, C.h, 4), T = unmed(C.b.subarray(0, n), C.w, C.h, 256), A = unmed(C.b.subarray(n, 2 * n), C.w, C.h, 256), P = unmed(C.b.subarray(2 * n, 3 * n), C.w, C.h, 256);
  for (let k = 0; k < n; k++) { const t = T[k], ab = A[k], p = P[k]; cl.a[k * 4] = (t - 128) / 2; cl.a[k * 4 + 1] = (ab - 128) / 2; cl.a[k * 4 + 2] = (p / 2.5) ** 2; }
  relief(g, cl, W / C.w);
  const gm = Gn.w * Gn.h, gen = new Uint16Array(gm); for (let k = 0; k < gm; k++) gen[k] = Gn.b[k] | Gn.b[gm + k] << 8;
  EARTHD = { g, cl, r: cl, gen, gw: Gn.w, gh: Gn.h, cell: 2 * PI * 6.371e6 / W };
  return EARTHD;
}
// the Earth's lights at night (lightdata.js, from NASA's Black Marble 2016): sixth-of-a-degree cells, linear light 0 .. 1
let LIT = null;
export function lights() {
  if (LIT) return LIT; const b = atob(LIGHTS), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); const q = inflateSync(u), a = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) a[i] = (q[i] / 15) ** 3; return (LIT = { w: 2160, h: 1080, a });
}
// the fine ground round the Go-to places (patchdata.js, from ETOPO 2022 15"): what the 6' map misses there, in metres,
// tapered to nothing at each patch's edges; read bicubic, with how much of it is there (for holding back the invented
// octaves it replaces)
let PAT = null;
export function patches() {
  if (PAT) return PAT; const b = atob(PATCHES), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); const r = inflateSync(u), hl = r[0] | r[1] << 8 | r[2] << 16 | r[3] << 24;
  const H = JSON.parse(new TextDecoder().decode(r.subarray(4, 4 + hl))), N = H.N, nn = N * N, M = H.n * nn, lo = r.subarray(4 + hl, 4 + hl + M), hi = r.subarray(4 + hl + M, 4 + hl + 2 * M), a = new Float32Array(M), R = PI / 180;
  for (let i = 0; i < H.n; i++) { const q = unmed(lo.subarray(i * nn, (i + 1) * nn), N, N, 65536, hi.subarray(i * nn, (i + 1) * nn), -32768); for (let k = 0; k < nn; k++) a[i * nn + k] = q[k] * H.step; }
  return (PAT = { n: H.n, N, d: H.d * R, o: H.o.map(([la, lo]) => [la * R, lo * R]), a });
}
const sst = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function patchAt(Pt, u) {
  const lat = asin(max(-1, min(1, u[2]))), lon = atan2(u[1], u[0]), N = Pt.N;
  for (let i = 0; i < Pt.n; i++) { const [la0, lo0] = Pt.o[i]; let dl = lon - lo0; dl -= 2 * PI * floor((dl + PI) / (2 * PI)); const x = dl / Pt.d, y = (la0 - lat) / Pt.d; if (x < 0 || y < 0 || x > N - 1 || y > N - 1) continue;
    const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, wt = (t) => [((-t + 2) * t - 1) * t / 2, ((3 * t - 5) * t * t + 2) / 2, ((-3 * t + 4) * t + 1) * t / 2, (t - 1) * t * t / 2], wx = wt(fx), wy = wt(fy), A = Pt.a, o = i * N * N;
    let h = 0; for (let b = 0; b < 4; b++) { const jj = min(N - 1, max(0, iy - 1 + b)); let r = 0; for (let c = 0; c < 4; c++) r += wx[c] * A[o + jj * N + min(N - 1, max(0, ix - 1 + c))]; h += wy[b] * r; }
    return { h, w: sst(0, 10, x) * sst(N - 1, N - 11, x) * sst(0, 10, y) * sst(N - 1, N - 11, y), i }; }
  return null;
}
const BODIES = new Map();
// a rocky body's ground: a one-degree map of height (above the lowest point, plus a margin: nothing there is under
// any sea), and its relief
export function body(name, R) {
  if (BODIES.has(name)) return BODIES.get(name);
  const S = sec(name), n = S.w * S.h, q = unmed(S.b.subarray(0, n), S.w, S.h, 65536, S.b.subarray(n, 2 * n)), g = new Grid(S.w, S.h, 4);
  for (let k = 0; k < n; k++) { g.a[k * 4] = q[k] * S.step; g.a[k * 4 + 1] = -1e4; }
  relief(g, g, 1); const D = { g, r: g, base: S.base, cell: 2 * PI * R / S.w }; BODIES.set(name, D); return D;
}
// the genus bits at a direction (quarter-degree cells)
export function genAt(D, u) { const lat = asin(max(-1, min(1, u[2]))), lon = atan2(u[1], u[0]), i = min(D.gw - 1, floor((lon / PI + 1) * 0.5 * D.gw)), j = min(D.gh - 1, floor((0.5 - lat / PI) * D.gh)); return D.gen[j * D.gw + i]; }
export const latlon = (u) => [asin(max(-1, min(1, u[2]))) * 180 / PI, atan2(u[1], u[0]) * 180 / PI];
void hypot; void abs;
