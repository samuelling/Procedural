// Anywhere on Earth (2 MB rung). Pick a point on the map and a height to climb; a forest is grown for that place.
//
// What is measured and what is not:
//   measured  the Köppen-Geiger climate class at the point, from a quarter-degree grid (kg.js): it fixes whether the
//             place is tropical, dry, temperate, continental or polar, how wet its dry season is, and how warm its
//             summer. The coastline is the same grid's land and sea.
//   computed  day length and the sun's path, from the latitude and the date (the usual solar geometry).
//   measured  the height of the ground: the mean of the land in each quarter-degree cell and its lowest point, from
//             ETOPO 2022 (NOAA NCEI); a plot stands at the lowest point, a valley floor in the mountains.
//   measured  twelve monthly temperatures and rainfalls, 1961-90 normals on a half-degree grid from CRU CL 2.0
//             (Climatic Research Unit, University of East Anglia, ODbL), the temperatures carried from sea level to
//             the ground at 6.5 °C a kilometre; then nudged as little as possible (a shift, a stretch of the yearly
//             swing, a scaling of the rain) until the Köppen rules give the measured class, since the class map is a
//             later period and a finer grid. Where CRU has no cell (Antarctica), the old sketch:
//   modelled  twelve monthly temperatures and rainfalls: a zonal sketch (warmth by latitude, a yearly swing that grows
//             with latitude and with distance from the sea upwind, rain belts by latitude), then nudged as little as
//             possible until the Köppen rules give the measured class. So the numbers are the class's, made
//             plausible for the place, not a weather station's.
//   rules     climbing cools 6.5 °C a kilometre and wets a little; the class is worked out again from the new numbers.
//   tables    soils, which trees grow, and their names by region, from general knowledge: unverified sketches.
/* global TIER, LC, LE */
import { KG } from './kg.js';
import { DATA } from './data.js';

// the measured grids (see tools/pack_data.py), inflated by the browser once the page has loaded
let ELM = null, ELN = null, ELX = null, CI = null, CT = null, CP = null, CD = null, CR = null, CW = null, CS = null, CN = null, CE = null, GEN = null;
const hq = (q) => (q / 255) ** 2 * 7500 - 500;
export const ready = TIER > 3 && new Response(new Blob([Uint8Array.from(atob(DATA), (c) => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then((b) => {
  const u = new Uint8Array(b), g = kg(), E = Math.expm1, L = Math.log1p(2500), bit = (q) => (u[q >> 3] >> (7 - (q & 7))) & 1; let o = 32400, n = 0;
  CI = new Int32Array(259200).fill(-1);
  if (LC) {   // the 200 kB rung: one value for each block of LC x LC half-degree cells, LE x LE quarter-degree for the heights
    const w = 720 / LC, B = new Int32Array(w * 360 / LC); for (let q = 0; q < B.length; q++) B[q] = bit(q) ? n++ : -1; o = (B.length + 7) >> 3;
    for (let q = 0; q < 259200; q++) CI[q] = B[(((q / 720) | 0) / LC | 0) * w + (((q % 720) / LC) | 0)];
  } else for (let q = 0; q < 259200; q++) if (bit(q)) CI[q] = n++;
  const Q = new Uint8Array(n * 84); for (let k = 0; k < 84; k++) for (let c = 0, v = 0; c < n; c++) { v = (v + u[o++]) & 255; Q[c * 84 + k] = v; }
  CT = new Float32Array(n * 12); CP = new Float32Array(n * 12); CD = new Uint8Array(n * 12); CR = new Uint8Array(n * 12); CW = new Uint8Array(n * 12); CS = new Uint8Array(n * 12); CN = new Uint8Array(n * 12); CE = new Float32Array(n);
  for (let c = 0; c < n; c++) for (let k = 0, t = 0, p = 0, d = 0, r = 0, w = 0, s = 0, wn = 0, b = c * 84; k < 12; k++) { wn = (wn + Q[b + 72 + k]) & 255; CN[c * 12 + k] = wn; t = (t + Q[b + k]) & 255; p = (p + Q[b + 12 + k]) & 255; d = (d + Q[b + 24 + k]) & 255; r = (r + Q[b + 36 + k]) & 255; w = (w + Q[b + 48 + k]) & 255; s = (s + Q[b + 60 + k]) & 255; CT[c * 12 + k] = t / 2 - 60; CP[c * 12 + k] = E(p / 255 * L); CD[c * 12 + k] = d; CR[c * 12 + k] = r; CW[c * 12 + k] = w; CS[c * 12 + k] = s; }
  for (let c = 0, v = 0; c < n; c++) { v = (v + u[o++]) & 255; CE[c] = hq(v); }   // CRU's own height for each cell
  const H = LE ? 720 / LE : 720, W = LE ? 1440 / LE : 1440, bx = (x) => LE ? (((x / 1440) | 0) / LE | 0) * W + (((x % 1440) / LE) | 0) : x, gb = LE ? new Uint8Array(H * W) : g;
  if (LE) for (let x = 0; x < 1036800; x++) if (g[x]) gb[bx(x)] = 1;   // a block is land if any of its cells is
  const sp = (a, T) => { if (!LE) return a; const q = new T(1036800); for (let x = 0; x < 1036800; x++) if (g[x]) q[x] = a[bx(x)]; return q; };
  const pl = () => { const q = new Uint8Array(H * W); for (let j = 0; j < H; j++) for (let i = 0, P = 0; i < W; i++) { const x = j * W + i; if (gb[x]) { P = (P + u[o++]) & 255; q[x] = P; } else P = 0; } return sp(q, Uint8Array); };
  ELM = pl(); ELN = pl(); ELX = pl();
  const Gb = new Uint16Array(H * W); for (let k = 0; k < 9; k++) for (let x = 0; x < H * W; x++) if (gb[x] && u[o++]) Gb[x] |= 1 << k;   // which of nine tree genera the range maps put in each cell
  GEN = sp(Gb, Uint16Array);
});
// the measured mean height of the land (m) at a point, between the four nearest cells (land ones only); null where
// the point is more sea than land, or before the grids are in. Q picks the plane: ELM the mean, ELX the highest.
export const top = (lat, lon) => elev(lat, lon, ELX);
export const elev = (lat, lon, Q = ELM) => {
  if (!Q) return null; const g = kg(), v = (90 - lat) * 4 - 0.5, u = (lon + 180) * 4 - 0.5, j = Math.floor(v), i = Math.floor(u), b = v - j, a = u - i; let s = 0, w = 0;
  for (const [dj, di, k] of [[0, 0, (1 - a) * (1 - b)], [0, 1, a * (1 - b)], [1, 0, (1 - a) * b], [1, 1, a * b]]) { const x = cl(j + dj, 0, 719) * 1440 + (((i + di) % 1440) + 1440) % 1440; if (g[x]) { s += hq(Q[x]) * k; w += k; } }
  return w < 0.5 ? null : s / w;
};

export const KC = ['Af', 'Am', 'As', 'Aw', 'BSh', 'BSk', 'BWh', 'BWk', 'Cfa', 'Cfb', 'Cfc', 'Csa', 'Csb', 'Csc', 'Cwa', 'Cwb', 'Cwc', 'Dfa', 'Dfb', 'Dfc', 'Dfd', 'Dsa', 'Dsb', 'Dsc', 'Dsd', 'Dwa', 'Dwb', 'Dwc', 'Dwd', 'EF', 'ET'];
// the usual colours of Köppen maps, by class (approximate), and sea
export const KCOL = ['00f', '07f', '6af', '4af', 'fa0', 'fd6', 'f00', 'f99', 'cf5', '6f5', '3c0', 'ff0', 'cc0', '990', '9f9', '6c6', '393', '0ff', '3cf', '088', '056', 'f0f', 'c0c', '939', '969', 'abf', '57d', '45b', '308', '666', 'bbb'];

let grid = null;
export const kg = () => {
  if (grid) return grid; grid = new Uint8Array(1440 * 720); let i = 0;
  for (const m of KG.matchAll(/([A-Za-e.])(\d*)/g)) { const n = +m[2] || 1, c = m[1]; grid.fill(c === '.' ? 0 : c < 'a' ? c.charCodeAt(0) - 64 : c.charCodeAt(0) - 70, i, i + n); i += n; }
  return grid;
};
const cl = (v, a, b) => Math.max(a, Math.min(b, v)), at = (j, i) => kg()[cl(j, 0, 719) * 1440 + (((i % 1440) + 1440) % 1440)];
const cell = (lat, lon) => [cl(((90 - lat) * 4) | 0, 0, 719), ((((lon + 180) * 4) | 0) % 1440 + 1440) % 1440];

// the Köppen rules (Kottek et al. 2006): T and P are January to December, in °C and mm
export function koppen(T, P, south) {
  const { min, max } = Math;
  const Tmin = min(...T), Tmax = max(...T), Ta = T.reduce((a, b) => a + b) / 12, Pa = P.reduce((a, b) => a + b);
  const su = (m) => (south ? m < 3 || m > 8 : m > 2 && m < 9), S = P.filter((_, m) => su(m)), W = P.filter((_, m) => !su(m));
  const Ps = S.reduce((a, b) => a + b), Pw = Pa - Ps, Psmin = min(...S), Psmax = max(...S), Pwmin = min(...W), Pwmax = max(...W), Pmin = min(...P);
  if (Tmax < 10) return Tmax < 0 ? 'EF' : 'ET';
  const th = 2 * Ta + (Pw >= Pa * 2 / 3 ? 0 : Ps >= Pa * 2 / 3 ? 28 : 14);
  if (Pa < 10 * th) return (Pa <= 5 * th ? 'BW' : 'BS') + (Ta >= 18 ? 'h' : 'k');
  if (Tmin >= 18) return Pmin >= 60 ? 'Af' : Pa >= 25 * (100 - Pmin) ? 'Am' : Psmin < 60 ? 'As' : 'Aw';
  const s = Psmin < Pwmin && Pwmax > 3 * Psmin && Psmin < 40 ? 's' : Pwmin < Psmin && Psmax > 10 * Pwmin ? 'w' : 'f', n10 = T.filter((t) => t >= 10).length;
  return (Tmin > -3 ? 'C' : 'D') + s + (Tmax >= 22 ? 'a' : n10 >= 4 ? 'b' : Tmin > -38 ? 'c' : 'd');
}
const series = (Ta, A, Pa, s, south) => { const T = [], P = [], { cos, PI } = Math; for (let m = 0; m < 12; m++) { const c = cos(2 * PI * (m + 0.5 - (south ? 1.2 : 7.2)) / 12); T.push(Ta + A * c); P.push(Pa / 12 * (1 + s * c)); } return [T, P]; };

// the place: its measured class, the modelled months that fit it, and what climbing does to them
export function place(lat, lon, climb = 0) {
  const { cos, acos, abs, exp, min, max, log, PI } = Math, RAD = PI / 180;
  let [j, i] = cell(lat, lon), k = at(j, i);
  for (let r = 1; !k && r < 13; r++) for (let a = -r; a <= r && !k; a++) for (const [y, x] of [[j - r, i + a], [j + r, i + a], [j + a, i - r], [j + a, i + r]]) if (at(y, x)) { k = at(y, x); j = y; i = x; break; }   // a point at sea snaps to the nearest coast
  if (!k) return null;
  lat = 90 - (j + 0.5) / 4; lon = (i + 0.5) / 4 - 180;
  const code = KC[k - 1], south = lat < 0, al = abs(lat), ck = cos(lat * RAD) * 27.8;
  const hf = ELN ? hq(ELN[j * 1440 + i]) : null, hm = ELM ? hq(ELM[j * 1440 + i]) : null;
  let mT = null, mP = null, nud = null, mD = null, mR = null, mW = null, mS = null, mN = null;   // (wet days and sunshine are missing for a few cells)
  if (CT) {                                                                  // the measured months of the nearest half-degree cell
    const j2 = j >> 1, i2 = i >> 1; let c = CI[j2 * 720 + i2];
    for (let r = 1; c < 0 && r < 4; r++) for (let a = -r; a <= r && c < 0; a++) for (const [y, x] of [[j2 - r, i2 + a], [j2 + r, i2 + a], [j2 + a, i2 - r], [j2 + a, i2 + r]]) if (y >= 0 && y < 360 && CI[y * 720 + ((x % 720) + 720) % 720] >= 0) { c = CI[y * 720 + ((x % 720) + 720) % 720]; break; }
    if (c >= 0) {                                                            // from sea level down to the floor: up to the cell's mean height at 6.5 °C a km, then down to the floor at a lapse rate that is weaker in winter (valley inversions; a sketch after Rolland 2003, unverified)
      const g0 = max(hf, 0) / 1000, gm = max(CE[c], 0) / 1000, a = min(1, abs(lat) / 30) * (south ? -1 : 1);
      mT = [...CT.subarray(c * 12, c * 12 + 12)].map((t, m) => t - 6.5 * gm + (5.4 - 1.2 * a * cos(2 * PI * m / 12)) * (gm - g0)); mP = [...CP.subarray(c * 12, c * 12 + 12)]; mD = [...CD.subarray(c * 12, c * 12 + 12)]; mR = [...CR.subarray(c * 12, c * 12 + 12)]; const wn = [...CN.subarray(c * 12, c * 12 + 12)]; if (wn[0] < 255) mN = wn.map((v) => v / 2); const w = [...CW.subarray(c * 12, c * 12 + 12)], s = [...CS.subarray(c * 12, c * 12 + 12)]; if (w[0] < 255) mW = w; if (s[0] < 255) mS = s.map((v) => v * 5);
    }
  }
  let dn = 61; for (let r = 1; r < 61 && dn > 60; r++) for (let a = -r; a <= r; a++) if (!at(j - r, i + a) || !at(j + r, i + a) || !at(j + a, i - r) || !at(j + a, i + r)) { dn = r; break; }   // to the nearest sea
  const wf = al > 30 && al < 72 ? -1 : 1; let du = 0; while (du < 700 && at(j, i + wf * (du + 1))) du++;   // to the sea upwind: west in the westerlies, east in the trades
  const c = cl(0.65 * (1 - exp(-du * ck / 1500)) + 0.35 * (1 - exp(-dn * 27.8 / 500)), 0, 1);
  let Ta, A, Pa, s, fit, T, P;
  if (mT) {                                                                  // nudged to the class: the smallest shift, stretch and rain scaling that agree
    const Tm = mT.reduce((x, y) => x + y) / 12; let bc = koppen(mT, mP, south) === code ? 0 : 1e9; nud = bc ? null : [0, 1, 1];
    for (let dT = -10; bc && dT <= 10; dT += 0.25) for (let a = 0.7; a < 1.45; a *= 1.05) { const c0 = (dT / 2) ** 2 + 5 * log(a) ** 2; if (c0 >= bc) continue; const Tn = mT.map((t) => Tm + a * (t - Tm) + dT);
      for (let pp = 0.25; pp < 4; pp *= 1.08) { const cost = c0 + 2 * log(pp) ** 2; if (cost >= bc) continue; if (koppen(Tn, mP.map((x) => x * pp), south) === code) { bc = cost; nud = [dT, a, pp]; } } }
    const [dT, a, pp] = nud || [0, 1, 1]; T = mT.map((t) => Tm + a * (t - Tm) + dT); P = mP.map((x) => x * pp); fit = !!nud;
  } else {
  // the sketch
  const T0 = 27 - 0.0085 * al * al + (wf < 0 && !south ? 8 * (1 - c) ** 2 * exp(-(((al - 55) / 12) ** 2)) : 0) - (lat < -62 ? 15 : 0), A0 = 1 + 0.012 * al ** 1.75 * (0.3 + 1.4 * c) * (south ? 0.6 : 1);
  const P0 = (2300 * exp(-(((lat - 1) / 12) ** 2)) + 1000 * exp(-(((al - 50) / 13) ** 2)) + 250) * (1.25 - 0.65 * c), s0 = al < 28 ? 0.8 * cl(al / 12, 0, 1) : al < 46 && c < 0.35 && wf < 0 ? -0.6 : 0.35 * c;
  // the nudge: the nearest temperatures that give the measured class's temperature letters, then the nearest rainfall that
  // gives the rest
  const tOK = (T) => { const t = koppen(T, T.map(() => 300), south); return code[0] === 'B' ? max(...T) >= 10 && (T.reduce((a, b) => a + b) / 12 >= 18) === (code[2] === 'h') : code[0] === 'E' ? t === code : t[0] === code[0] && (code[0] === 'A' || t[2] === code[2]); };
  let best = null, bc = 1e9;
  for (let dT = -24; dT <= 24; dT += 0.5) for (let a = 0.2; a < 3.2; a *= 1.12) { const cost = (dT / 4) ** 2 + log(a) ** 2 * 5; if (cost >= bc) continue; const [T] = series(T0 + dT, A0 * a, 0, 0, south); if (tOK(T)) { bc = cost; best = [T0 + dT, A0 * a]; } }
  [Ta, A] = best || [T0, A0]; const Pr = code[0] === 'B' ? (2 * Ta + 14) * (code[1] === 'W' ? 1.5 : 7) : P0; best = null; bc = 1e9;
  for (let p = 0.04; p < 12; p *= 1.09) for (let s = -0.95; s <= 0.951; s += 0.05) { const cost = log(p) ** 2 + (s - s0) ** 2 * 2; if (cost >= bc) continue; const [T, P] = series(Ta, A, Pr * p, s, south); if (koppen(T, P, south) === code) { bc = cost; best = [Pr * p, s]; } }
  [Pa, s] = best || [Pr, s0]; fit = !!best;
  [T, P] = series(Ta, A, Pa, s, south); }
  const km = climb / 1000;
  T = T.map((t) => t - 6.5 * km); P = P.map((p) => p * (1 + 0.3 * min(km, 3)));
  const now = koppen(T, P, south), day = (d) => { const x = -Math.tan(lat * RAD) * Math.tan(d * RAD); return x >= 1 ? 0 : x <= -1 ? 24 : 24 / PI * acos(x); };
  // a year of days from the months (day 0 the first of January): the snow on the ground, as water, from a degree-day
  // snowpack (3 mm of melt per degree-day, inside Hock 2003's 2 to 7; snow below 1 °C), each day's swing taken from the
  // measured diurnal range; and the deciduous leaves: out once the warmth above 5 °C since the coldest day sums to 150
  // degree-days, colouring after midsummer below 10 °C, bare below 5 °C (thresholds a sketch, unverified)
  const Rg = mR || T.map(() => 8), dy = (A, d) => { const x = (d / 365 * 12 - 0.5 + 12) % 12, i = Math.floor(x), u = x - i; return A[i] * (1 - u) + A[(i + 1) % 12] * u; };
  // and the water in the soil: a bucket holding 150 mm (a sketch), filled by rain and snowmelt, emptied by Thornthwaite's
  // evaporation (1948: from the month's temperature and day length), less as the soil dries
  const swe = new Float32Array(365), soil = new Float32Array(365), TI = T.reduce((s, t) => s + (t > 0 ? (t / 5) ** 1.514 : 0), 0) || 1, ae = 6.75e-7 * TI ** 3 - 7.71e-5 * TI ** 2 + 1.792e-2 * TI + 0.49239; let sw = 0, bw = 75;
  for (let y = 0; y < 3; y++) for (let d = 0; d < 365; d++) {
    const t = dy(T, d), a = dy(Rg, d) / 2, p = dy(P, d) * 12 / 365, dc = 23.44 * Math.sin(2 * PI * (d - 80) / 365) * RAD, x = -Math.tan(lat * RAD) * Math.tan(dc), L = x >= 1 ? 0 : x <= -1 ? 24 : 24 / PI * acos(x);
    let sn = 0, ml = 0; for (let q = 0; q < 8; q++) { const v = t + a * Math.sin(2 * PI * (q + 0.5) / 8); if (v < 1) sn += 1 / 8; ml += max(0, v) / 8; }
    const m = min(sw + p * sn, 3 * ml); sw = max(0, sw + p * sn - m); swe[d] = sw;
    const pet = t > 0 ? 16 * (L / 12) * (10 * t / TI) ** ae / 30 : 0; bw = min(150, max(0, bw + p * (1 - sn) + m - pet * min(1, bw / 75))); soil[d] = bw / 150;
  }
  let ph = null; if (min(...T) < 5) { let d0 = 0, d1 = 0; for (let d = 0; d < 365; d++) { if (dy(T, d) < dy(T, d0)) d0 = d; if (dy(T, d) > dy(T, d1)) d1 = d; }
    let g = 0, lo = -1, co = -1, ba = -1; for (let k = 0; k < 365; k++) { const d = (d0 + k) % 365, t = dy(T, d); g += max(0, t - 5); if (lo < 0 && g >= 150) lo = d; }
    for (let k = 0; k < 365; k++) { const d = (d1 + k) % 365, t = dy(T, d); if (co < 0 && t < 10) co = d; if (ba < 0 && t < 5) { ba = d; break; } }
    if (lo >= 0 && co >= 0 && ba >= 0) ph = [lo, co, ba]; }
  const tm = (max(...T) - 10) / 6.5, sm = max(0.3, (max(...T) - 1) / 6.5), g0 = (max(hf, 0) + climb) / 1000;   // the treeline where the warmest month falls to 10 °C; the snowline, roughly, where it falls to 1 °C
  return { lat, lon, climb, code, now, fit, T, P, D: mD && mD.map((d, m) => d), R: mR, W: mW, S: mS, N: mN, gen: GEN ? GEN[j * 1440 + i] : null, swe, soil, ph, elev: hf, mean: hm, src: mT ? 'CRU' : 0, nud, tl: hf === null ? null : [tm * 1000, g0 + tm, sm * 1000, g0 + sm], Ta: T.reduce((a, b) => a + b) / 12, Pa: P.reduce((a, b) => a + b), c, south, day: [day(south ? 23.44 : -23.44), day(south ? -23.44 : 23.44)] };
}

// soils, by class and rainfall (unverified sketch): a name, and the colour of the soil and its litter
const soil = (p) => {
  const k = p.now, { min } = Math, g = k[0], Tmin = min(...p.T);
  return g === 'E' ? (k === 'EF' ? ['ice, no soil', [0.8, 0.82, 0.86]] : ['tundra gley over permafrost', [0.2, 0.18, 0.15]])
    : g === 'A' ? (k === 'Af' || k === 'Am' ? ['ferralsol: deep, red, washed of nutrients', [0.42, 0.16, 0.07]] : ['red tropical soil (lixisol)', [0.45, 0.22, 0.1]])
    : g === 'B' ? (k[1] === 'W' ? ['desert soil: pale, stony, salty in places', [0.62, 0.5, 0.36]] : k[2] === 'k' ? ['chestnut steppe soil (kastanozem)', [0.3, 0.22, 0.15]] : ['red-brown steppe soil', [0.45, 0.28, 0.16]])
    : k[1] === 's' ? ['red Mediterranean soil (terra rossa)', [0.42, 0.2, 0.1]]
    : g === 'C' ? (k[2] === 'a' ? ['red-yellow forest soil (acrisol)', [0.45, 0.28, 0.12]] : ['brown earth (cambisol)', [0.22, 0.14, 0.08]])
    : Tmin < -20 || k[2] === 'c' || k[2] === 'd' ? ['podzol' + (Tmin < -20 ? ', permafrost beneath' : ''), [0.2, 0.17, 0.15]]
    : p.Pa < 550 && k[2] === 'a' ? ['black earth (chernozem)', [0.08, 0.06, 0.05]] : ['grey-brown forest soil (luvisol)', [0.2, 0.15, 0.1]];
};
const realm = (lat, lon) => lon > 110 && lat < -10 ? 'au' : lon > -120 && lon < -30 && lat < 13 + (lon < -75 ? 10 : 0) ? 'sa' : lon < -50 ? 'na' : lon > -20 && lon < 52 && lat < 35 ? 'af' : lon > -25 && lon < 60 && lat >= 35 ? 'eu' : 'as';
const SEC = { s: 'dry summer', w: 'dry winter' };
export const describe = (k) => ({ Af: 'tropical rainforest', Am: 'tropical monsoon', As: 'tropical savanna, dry summer', Aw: 'tropical savanna', BWh: 'hot desert', BWk: 'cold desert', BSh: 'hot steppe', BSk: 'cold steppe', EF: 'ice cap', ET: 'tundra' })[k]
  || (k[1] === 's' ? 'Mediterranean' : k[0] === 'C' ? (k[1] === 'w' ? 'subtropical, dry winter' : k[2] === 'a' ? 'humid subtropical' : k[2] === 'b' ? 'oceanic' : 'subpolar oceanic') : k[2] === 'a' || k[2] === 'b' ? 'continental' : 'subarctic') + (k[0] === 'D' && k[1] !== 'f' ? ', ' + SEC[k[1]] : '') + (k[0] === 'D' || k[1] === 's' ? ', ' + { a: 'hot', b: 'warm', c: 'cool', d: 'very cold' }[k[2]] + (k[2] === 'd' ? ' winter' : ' summer') : '');

// the forest for a place: species chosen by class and region (unverified sketch), sized by warmth and rain
export function earthGenome(p, G0, pool) {
  const { min, max, abs, round } = Math;
  const { oak, birch, pine, spruce, giant, hemlock, maple, aspen, beech, larch, redwood, sp } = pool, k = p.now, g = k[0], r = realm(p.lat, p.lon), Tmin = min(...p.T), Tmax = max(...p.T);
  // species the forests here need that the temperate pool lacks
  const holm = sp({ ...oak(0), id: 'holm', nm: r === 'na' ? 'Live oak' : r === 'eu' || (r === 'af' && p.lat > 20) ? 'Holm oak' : r === 'af' ? 'African olive' : 'Evergreen oak', H: [8, 14], cr: 4, wet: 0.35, ev: 1, leaf: { t: 2, sz: 0.55, per: 7, o: 2, a: [0.05, 0.12, 0.05], b: [0.14, 0.22, 0.09], dr: 0.1 }, bark: { t: 0, sc: 0.7, a: [0.3, 0.27, 0.24], b: [0.1, 0.09, 0.08] } });
  const stone = sp({ ...pine(0), id: 'stone', nm: 'Stone pine', H: [10, 17], cr: 5, clear: [0.6, 0.75] });
  const euc = sp({ ...birch(0), id: 'euc', nm: r === 'au' ? 'Eucalyptus' : 'Eucalyptus (planted)', H: [22, 36], cr: 4, wet: 0.4, clear: [0.45, 0.6], ev: 1, leaf: { t: 2, sz: 0.8, per: 3.5, o: 2, a: [0.18, 0.24, 0.14], b: [0.35, 0.4, 0.26], dr: 0.75 }, bark: { t: 3, sc: 1.4, a: [0.88, 0.84, 0.76], b: [0.5, 0.44, 0.36] } });
  const acacia = sp({ ...pine(0), id: 'acacia', nm: r === 'au' ? 'Wattle' : 'Umbrella thorn', H: [5, 9], cr: 4.5, wet: 0.25, clear: [0.35, 0.5], stub: 0, ev: 1, leaf: { t: 2, sz: 0.4, per: 8, o: 2, a: [0.12, 0.2, 0.06], b: [0.3, 0.36, 0.12], dr: 0 }, bark: { t: 0, sc: 0.6, a: [0.25, 0.2, 0.17], b: [0.08, 0.07, 0.06] } });
  const juniper = sp({ ...spruce(0), id: 'juniper', nm: 'Juniper', H: [3, 7], cr: 1.6, wet: 0.2, clear: [0, 0.1], leaf: { t: 5, sz: 0.5, per: 6, o: 1, a: [0.07, 0.13, 0.1], b: [0.16, 0.24, 0.18], dr: 0 }, bark: { t: 2, sc: 0.5, a: [0.42, 0.3, 0.24], b: [0.2, 0.14, 0.11] } });
  const emer = sp({ ...oak(0), id: 'emer', nm: r === 'as' ? 'Dipterocarp' : r === 'af' ? 'Mahogany' : 'Kapok', H: [42, 56], cr: 8, wet: 0.7, fl: 1.6, clear: [0.62, 0.74], ev: 1, leaf: { t: 0, sz: 1.3, per: 4, o: 2, a: [0.05, 0.16, 0.04], b: [0.16, 0.3, 0.08], dr: 0.2 }, bark: { t: 3, sc: 1.3, a: [0.6, 0.58, 0.52], b: [0.3, 0.29, 0.26] } });
  const canopy = sp({ ...oak(0), id: 'canopy', nm: r === 'as' ? 'Fig' : 'Rainforest tree', H: [20, 30], cr: 4.5, wet: 0.75, fl: 1, clear: [0.45, 0.6], ev: 1, leaf: { t: 0, sz: 1.35, per: 4.5, o: 2, a: [0.03, 0.12, 0.03], b: [0.12, 0.26, 0.06], dr: 0.3 }, bark: { t: 3, sc: 1, a: [0.5, 0.48, 0.42], b: [0.22, 0.2, 0.17] } });
  const palm = sp({ ...pine(0), id: 'palm', nm: 'Palm', sap: 2, H: [9, 18], cr: 3, wet: 0.7, rt: 0.02, dv: 2, fl: 0.4, clear: [0.94, 0.97], stub: 0, ev: 1, ax: [{ st: 1, tr: 0.7, to: 0.06 }], leaf: { t: 3, sz: 3.4, per: 9, o: 0, a: [0.06, 0.18, 0.04], b: [0.18, 0.34, 0.07], dr: 0.3 }, bark: { t: 1, sc: 0.5, a: [0.45, 0.4, 0.32], b: [0.2, 0.17, 0.13] } });
  const dwarf = sp({ ...birch(0), id: 'dwarf', nm: 'Dwarf birch', sap: 0, H: [0.4, 1.1], cr: 0.6, wet: 0.6, clear: [0, 0.05], leaf: { ...birch(0).leaf, sz: 0.25, per: 14 } });
  const nb = sp({ ...beech(0), nm: 'Southern beech' }), tall = (s, f) => (n) => ({ ...s(n), H: s(0).H.map((h) => h * f) });
  const warm = cl(p.T.filter((t) => t >= 10).length / 6, 0.3, 1), wetf = cl(p.Pa / 900, 0.15, 1.3), dens = cl(p.Pa / 700, 0.05, 1.2);
  const H = (s) => tall(s, (0.55 + 0.45 * warm) * (0.7 + 0.3 * min(1, wetf)));
  let trees, base = 'mixed';
  if (g === 'E') { trees = k === 'ET' ? [dwarf(90)] : []; base = 'aspen'; }
  else if (k[1] === 'W') { const n = round(cl(p.Pa / 50, 0, 6)); trees = n ? [(k[2] === 'h' ? acacia : juniper)(n)] : []; base = 'aspen'; }
  else if (k[1] === 'S') { trees = k[2] === 'h' ? [(r === 'au' ? euc : acacia)(10)] : [juniper(5), (r === 'na' ? pine : r === 'as' ? larch : oak)(3)]; base = 'aspen'; }
  else if (g === 'A') { if (k === 'Af' || k === 'Am') { trees = [H(emer)(6), H(canopy)(30), palm(k === 'Am' ? 14 : 8)]; base = 'cloud'; } else { trees = r === 'au' ? [euc(14), acacia(8)] : r === 'af' ? [acacia(14), H(canopy)(4)] : [H(canopy)(20), palm(6), acacia(4)]; base = 'aspen'; } }
  else if (k[1] === 's' && g === 'C') { trees = r === 'au' ? [euc(22), acacia(6)] : r === 'na' && p.lon < -120 && p.lat > 36 && p.lat < 42 && k === 'Csb' ? [redwood(12), giant(6), holm(4)] : r === 'na' && p.lon < -115 && p.Pa > 800 ? [H(giant)(15), H(hemlock)(20), maple(6)] : [holm(26), (r === 'na' ? pine : stone)(8)]; base = r === 'na' && p.lon < -115 && p.Pa > 800 ? 'oldgrowth' : 'pine'; }
  else if (g === 'C' && k[2] === 'a') { trees = r === 'au' ? [euc(26), acacia(4)] : r === 'na' ? [H(oak)(18), H(pine)(20), maple(5)] : r === 'as' ? [holm(18), H(pine)(10), maple(6)] : r === 'sa' || r === 'af' ? [holm(16), palm(4), H(canopy)(8)] : [H(oak)(16), H(pine)(10), holm(6)]; }
  else if (g === 'C' && k[2] === 'b') { trees = r === 'au' ? (p.lon > 160 ? [H(nb)(28), giant(4)] : [H(euc)(24), H(nb)(6)]) : r === 'sa' ? [H(nb)(30)] : r === 'na' && p.lon < -115 ? [H(giant)(15), H(hemlock)(22), maple(8)] : r === 'af' ? [holm(14), H(euc)(8)] : [H(beech)(20), H(oak)(10), birch(6)]; base = r === 'na' && p.lon < -115 ? 'oldgrowth' : 'beech'; }
  else if (g === 'C') { trees = [H(birch)(28), H(spruce)(8)]; base = 'boreal'; }
  else if (k[2] === 'a') { trees = [H(oak)(18), H(maple)(10), birch(6), H(pine)(6)]; }
  else if (k[2] === 'b') { trees = r === 'as' && p.lon > 100 ? [H(pine)(14), H(oak)(10), birch(10), H(larch)(6)] : [H(spruce)(22), H(pine)(10), birch(10), H(aspen)(8), oak(4)]; base = 'boreal'; }
  else if (k[2] === 'c') { trees = r === 'as' && p.lon > 90 ? [H(larch)(45), birch(8), H(pine)(6)] : [H(spruce)(50), birch(10), H(pine)(8)]; base = 'boreal'; }
  else { trees = [H(larch)(40), birch(4)]; base = 'larch'; }
  // measured: where the range maps cover the place, a species whose genus they do not put here is left out
  const GI = { oak: 0, holm: 0, beech: 1, spruce: 2, pine: 3, stone: 3, birch: 4, dwarf: 4, larch: 6, maple: 7 }, cov = p.gen > 0, out = [];
  if (cov) { const k2 = trees.filter((t) => { const q = GI[t.id]; if (q === undefined || (p.gen >> q) & 1) return 1; out.push(t.nm.toLowerCase()); return 0; }); if (k2.length) trees = k2; else out.length = 0; }
  trees = trees.map((t) => (t.id === 'maple' ? { ...t, nm: r === 'na' ? (p.lon < -115 ? 'Bigleaf maple' : 'Sugar maple') : r === 'eu' ? 'Sycamore maple' : 'Maple' } : t));   // the maple of the region (names unverified)
  trees = trees.map((t) => ({ ...t, n: max(t.n ? 1 : 0, round(t.n * (g === 'B' || g === 'E' ? 1 : cl(dens, 0.35, 1.15)))) }));
  const [snm, sc] = soil(p), B = G0[base], dry = g === 'B' || k[1] === 's' || k === 'Aw' || k === 'As', snow = cl(-Tmin / 5, 0, 1) * cl(p.Pa / 300, 0.2, 1);
  const lit = sc.map((v) => v * 1.3), grass = g === 'E' ? 900 : k[1] === 'S' || k === 'Aw' || k === 'As' ? 1400 : k[1] === 'W' ? 120 : B.floor.grass[0];
  const lat = Math.abs(p.lat).toFixed(1) + '°' + (p.lat < 0 ? 'S' : 'N') + ' ' + Math.abs(p.lon).toFixed(1) + '°' + (p.lon < 0 ? 'W' : 'E'), hr = (h) => { const m = round(h * 60); return ((m / 60) | 0) + ' h ' + String(m % 60).padStart(2, '0'); };
  const txt = lat + (p.climb ? ', ' + p.climb.toLocaleString() + ' m up' : '') + ' · ' + p.now + ' ' + describe(p.now) + (p.now !== p.code ? ' (' + p.code + ' at the foot)' : ' (measured)') + ' · ' + p.Ta.toFixed(1) + ' °C a year, ' + round(min(...p.T)) + ' to ' + round(Tmax) + ' by month, ' + round(p.Pa).toLocaleString() + ' mm' + (p.src ? ' (measured, CRU 1961–90' + (LC ? ', ' + LC / 2 + '° cells' : '') + (p.nud && (p.nud[0] || p.nud[1] !== 1 || p.nud[2] !== 1) ? ', nudged ' + (p.nud[0] >= 0 ? '+' : '') + p.nud[0] + ' °C, swing ×' + p.nud[1].toFixed(2) + ', rain ×' + p.nud[2].toFixed(2) + ' to fit the class' : '') + ')' : ' (modelled)') + (p.elev !== null && p.elev !== undefined ? ' · ground ' + round(max(p.elev, 0)).toLocaleString() + ' m (measured' + (LE ? ', ' + LE / 4 + '° cells' : '') + ')' : '') + ' · daylight ' + hr(p.day[0]) + ' in ' + (p.south ? 'June' : 'December') + ', ' + hr(p.day[1]) + ' in ' + (p.south ? 'December' : 'June') + ' · ' + snm + (cov ? ' · trees from the range maps (Little; Caudullo et al. 2017)' + (out.length ? ', ' + out.join(' and ') + ' left out: not native here' : '') : ' · trees a sketch (no range map covers here)');
  return { ...B, nm: 'Earth, ' + lat, cl: { ...p, txt, az: 0, snow, dec: g === 'A' ? (k === 'Aw' || k === 'As' ? 0.4 : 0) : k[1] === 's' || k === 'BSh' || k === 'BWh' ? 0.2 : (r === 'au' ? 0.1 : 1), soil: sc },
    land: { ...B.land, stream: p.Pa > 700 && g !== 'B' && g !== 'E' ? [1.1, 6, 0.2, 4] : undefined, ra: dry ? [0.55, 0.45, 0.36] : B.land.ra, log: round(B.land.log * cl(dens, 0, 1)) },
    air: { ...B.air, fog: B.air.fog * (k === 'Af' || k === 'Am' ? 1.15 : dry ? 0.5 : 1), haze: dry ? [0.86, 0.8, 0.7] : B.air.haze, aur: abs(p.lat) > 58 ? 1 : 0 },
    floor: { ...B.floor, lit, la: g === 'E' ? 0.1 : B.floor.la, moss: g === 'E' ? 0.8 : dry ? 0.05 : cl(B.floor.moss * wetf, 0, 1), fern: [round((k === 'Af' || k === 'Am' ? 520 : dry || g === 'E' ? 0 : B.floor.fern[0]) * cl(wetf, 0, 1)), B.floor.fern[1]], grass: [grass, B.floor.grass[1]],
      ga: dry ? [0.42, 0.36, 0.16] : B.floor.ga, gb: dry ? [0.7, 0.6, 0.3] : B.floor.gb, shroom: round(B.floor.shroom * cl(wetf - 0.3, 0, 1)), flower: g === 'E' || k[1] === 'S' ? 120 : B.floor.flower || 0 },
    trees, life: { deer: g === 'B' || g === 'E' ? 0 : 3, birds: round(cl(p.Pa / 60, 4, 30)), hare: 2, fox: k === 'EF' ? 0 : 1 } };
}
