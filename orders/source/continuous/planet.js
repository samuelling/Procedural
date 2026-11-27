// A planet, from its genome. Everything about a world (its size, its pull, its air, its sea, its star, which plants
// grow there and how they are built) comes from a seed through the rules below, so each planet is the same every
// visit and different from every other.
//
// The ground is one height field over the sphere: K octaves of three-dimensional value noise, each half the size of
// the last, from about 4,000 km down to a few micrometres, read where the noise meets the planet's surface. Each
// octave lives in its own lattice of 256 cells a side, turned its own way, and everything is measured from the point
// under the camera, so a grain of sand beside you is as precise as a continent. The same function exists twice: here
// in double precision (for the camera, picking and placing) and in GLSL (for drawing). They agree to the bit in the
// lattice hash and to float precision elsewhere.

import { earth, body, genAt, patches, patchAt, lights } from './earth.js';
import { sunReal } from './ephem.js';
import { RIVERS } from './riverdata.js';
export { earth, body, genAt };
export const K = 40, LS = 22, GOLD = 2.39996323, PLA = 1.32471795724;
export const sOf = (k) => 2 ** (LS - k);
export const RIDGE0 = 4, RIDGE1 = 14;                                      // octaves 262 km to 512 m are ridged: mountains
export const CLIM = 5;                                                     // extra rows: two climate fields, two forest-patch fields, rivers

// ---- randomness ----------------------------------------------------------------------------------------------------
export const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// the noise lattice hash (8 bits a coordinate) and the site hash (20 bits a coordinate): the same bits as the shaders'
export const hsh3 = (x, y, z, k) => { let h = (Math.imul((x + 17 * k) & 255, 374761393) + Math.imul((y + 91 * k) & 255, 668265263) + Math.imul((z + 53 * k) & 255, -2048144777)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h & 16777215) / 16777215; };
export const hs2 = (i, j, k) => { i &= 1048575; j &= 1048575; let h = Math.imul(i ^ Math.imul(k, -1640531535), -2048144789) ^ Math.imul(j + Math.imul(k, 7919), -1028477387); h ^= h >>> 15; h = Math.imul(h, 739982445); h ^= h >>> 12; h = Math.imul(h, 695872825); h ^= h >>> 15; return (h >>> 8) / 16777216; };
const fade = (f) => f * f * f * (f * (f * 6 - 15) + 10);
export function vn3(x, y, z, k) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), u = fade(x - ix), v = fade(y - iy), w = fade(z - iz);
  const c = (a, b, d) => hsh3(ix + a, iy + b, iz + d, k), l = (a, b, t) => a + (b - a) * t;
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const m256 = (v) => ((v % 256) + 256) % 256;

// ---- the genome -----------------------------------------------------------------------------------------------------
// physics: radius, gravity, air (how thick, what colour it scatters), star (colour, size), sea (how much, what liquid),
// warmth and wetness, clouds, rings and moons. genetics: a handful of plant species, each a body plan (see trees.js).
const NAMES = ['Sylva', 'Ochre', 'Velin', 'Thule', 'Mirra', 'Cauda', 'Ostra', 'Pell', 'Varga', 'Nemo'];
const hsl = (h, s, l) => { const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; };
const lin = (c) => c.map((v) => v ** 2.2);
export function genome(n) {
  const r = rng(n * 977 + 13), pick = (a) => a[Math.floor(r() * a.length)], lerp = (a, b) => a + (b - a) * r();
  const earth = n === 0, G = { n, id: n, E: 0, name: NAMES[n % NAMES.length], kseed: n * 41 };
  G.R = earth ? 6.371e6 : lerp(2.2e6, 8.5e6);
  G.g = earth ? 1 : +(lerp(0.38, 1.9)).toFixed(2);                        // surface gravity, in Earth gravities
  G.relief = (earth ? 1 : lerp(0.6, 1.7)) * G.g ** -0.7;                   // weaker pull, taller mountains
  G.seaFrac = earth ? 0.62 : pick([0.15, 0.35, 0.5, 0.7, 0.85]);
  G.ridge = earth ? 1 : lerp(0.4, 1.6);
  G.Hs = 8000 / G.g * (earth ? 1 : lerp(0.7, 1.4));                       // scale height of the air: weaker pull, deeper air
  G.air = earth ? 1 : pick([0.35, 0.7, 1, 1.4, 2.2]);                     // how thick, relative to Earth's
  const sc = earth ? [5.8, 13.5, 33.1] : pick([[5.8, 13.5, 33.1], [30, 16, 6], [12, 30, 14], [22, 8, 30], [8, 24, 30], [28, 22, 9]]);
  G.beta = sc.map((v) => v * 1e-6 * G.air);                                // what the air scatters: blue (Rayleigh), or ochre, teal, violet haze
  G.starK = earth ? 5800 : pick([3400, 4300, 5200, 5800, 6600, 8500]);     // the star's colour temperature
  const bb = (T) => { const t = T / 100; const R = t <= 66 ? 1 : 1.29 * (t - 60) ** -0.133, Gc = t <= 66 ? 0.39 * Math.log(t) - 0.63 : 1.13 * (t - 60) ** -0.0755, B = t >= 66 ? 1 : t <= 19 ? 0 : 0.543 * Math.log(t - 10) - 1.19; return [R, Gc, B].map((v) => Math.max(0, Math.min(1, v))); };
  G.sunCol = lin(bb(G.starK)).map((v) => v * 2.6);
  G.sunSize = earth ? 0.0047 : lerp(0.003, 0.02);
  G.Teq = earth ? 28 : lerp(-5, 45); G.Tgrad = earth ? 45 : lerp(25, 60); G.wet = earth ? 0 : lerp(-0.35, 0.3);
  G.cloud = earth ? 0.38 : lerp(0.15, 0.65); G.cloudBase = 1500 / G.g; G.cloudTop = 4000 / G.g;
  G.liquid = earth ? [0.01, 0.04, 0.06] : pick([[0.01, 0.04, 0.06], [0.05, 0.03, 0.005], [0.01, 0.05, 0.03], [0.04, 0.01, 0.05], [0.002, 0.002, 0.004]]);
  const gh = earth ? 0.27 : pick([0.27, 0.22, 0.12, 0.05, 0.85, 0.75, 0.5, 0.95, 0.33]);   // the hue plants take: green, olive, amber, red, violet, teal...
  G.leafHue = gh;
  G.grass = lin(hsl(gh, 0.45, 0.32)); G.grassDry = lin(hsl(earth ? 0.14 : (gh + 0.08) % 1, 0.35, 0.45));
  G.soil = lin(hsl(earth ? 0.08 : r(), earth ? 0.22 : lerp(0.1, 0.45), earth ? 0.17 : lerp(0.15, 0.4)));
  G.rock = lin(hsl(earth ? 0.08 : r(), earth ? 0.05 : lerp(0, 0.25), earth ? 0.42 : lerp(0.3, 0.55)));
  G.sand = lin(hsl(earth ? 0.11 : r() * 0.2, earth ? 0.4 : 0.4, earth ? 0.7 : lerp(0.5, 0.75)));
  { const m = Math.max(...G.liquid); G.liqA = G.liquid.map((v) => 0.015 + 0.15 * (1 - v / m) ** 1.5); G.liqC = G.liquid.map((v) => v / m * 0.06); }
  G.rings = earth ? 0 : r() < 0.3 ? lerp(1.6, 2.6) : 0; G.ringTilt = r() * 0.5;
  G.moons = earth ? [[0.0045, 0.9, 0.3, 0.7]] : Array.from({ length: Math.floor(r() * 3.2) }, () => [lerp(0.003, 0.03), r() * 6.28, lerp(-0.6, 0.8), r()]);
  G.cities = earth || r() < 0.4;
  G.species = flora(G, r); for (const s of G.species) s.canopy = lin(hsl(s.hue, s.sat, s.lit));
  // the axis the planet spins on, and where its star is, in the planet's own frame
  // its day, its tilt and its year: the star crosses the sky once a day and swings north and south once a year
  G.dayH = earth ? 24 : Math.round(lerp(9, 60)); G.tilt = earth ? 0.409 : lerp(0, 0.75); G.yearD = earth ? 365 : Math.round(lerp(90, 900)); G.sunA = earth ? 0.5 : r() * 6.28;
  G.aurora = lin(hsl(earth ? 0.36 : r(), 0.9, 0.55));
  G.axis = [0, 0, 1]; G.sunDir = sunAt(G, 0);
  G.amp = amps(G); G.base = 0; G.base = seaLevel(G);
  return G;
}

// the plants: 5 to 8 species, each a body plan and the climate it needs. On Sylva they are Earth's own forms.
// where the star is (planet axes) at time t, in the planet's own days from the start; day 0 is midsummer in the north
export function sunAt(G, t) { if (G.real) return sunReal(G.real, t); const dl = G.tilt * Math.cos(2 * Math.PI * t / G.yearD), a = G.sunA - 2 * Math.PI * t; return [Math.cos(dl) * Math.cos(a), Math.cos(dl) * Math.sin(a), Math.sin(dl)]; }
// the season at a latitude: +1 midsummer, -1 midwinter; and whether it is warming (spring) or cooling (autumn)
export function season(G, t, lat) {
  if (G.real) { const d0 = Math.asin(sunReal(G.real, t)[2]), d1 = Math.asin(sunReal(G.real, t + 1)[2]), k = Math.min(1, Math.abs(lat) / 0.35) * Math.min(1, G.tilt / 0.3) * Math.sign(lat || 1); return { s: Math.sin(d0) / Math.max(0.05, Math.sin(G.tilt)) * k, spring: (d1 - d0) * k > 0 }; }
  const ph = 2 * Math.PI * t / G.yearD, k = Math.min(1, Math.abs(lat) / 0.35) * Math.min(1, G.tilt / 0.3) * Math.sign(lat || 1); return { s: Math.cos(ph) * k, spring: -Math.sin(ph) * k > 0 }; }
const FORMS = ['broad', 'cone', 'palm', 'column', 'umbrella', 'weep', 'orb', 'spire'];
// The plants: families, each a body plan and the climate it suits, and inside each family hundreds of species, every
// one a small mutation of its family's genes (taller or squatter, paler or redder, broader or finer leaves, its own
// climate). On Sylva the families are Earth's own forms under their real genus names; elsewhere they are invented.
const SYL = ['ka', 'lo', 'ri', 'tha', 'mel', 'vor', 'si', 'na', 'ul', 'pe', 'dra', 'quo', 'ze', 'mi', 'or', 'bel', 'tu', 'xa', 'en', 'gal', 'phy', 'ro', 'sa', 'cle'];
const word = (r, n) => { let w = ''; for (let i = 0; i < n; i++) w += SYL[Math.floor(r() * SYL.length)]; return w; };
const cap = (w) => w[0].toUpperCase() + w.slice(1);
function flora(G, r) {
  const lerp = (a, b) => a + (b - a) * r(), S = [];
  if (G.n === 0) {
    const E = [
      { name: 'oak', genus: 'Quercus', form: 'broad', T: [13, 7], W: [0.6, 0.25], h: 22, spread: 0.55, depth: 4, kids: 3, droop: 0, leaf: [0.09, 0.45, 5], hue: 0.25, sat: 0.55, lit: 0.17, bark: [0.09, 0.075, 0.06], barkRough: 1, decid: 1, fall: 0.08 },
      { name: 'beech', genus: 'Fagus', form: 'broad', T: [9, 5], W: [0.75, 0.2], h: 26, spread: 0.4, depth: 4, kids: 3, droop: 0.1, leaf: [0.08, 0.55, 0], hue: 0.27, sat: 0.6, lit: 0.2, bark: [0.3, 0.29, 0.27], barkRough: 0.2, decid: 1, fall: 0.07 },
      { name: 'birch', genus: 'Betula', form: 'broad', T: [3, 7], W: [0.55, 0.3], h: 18, spread: 0.28, depth: 4, kids: 2, droop: 0.35, leaf: [0.05, 0.6, 0], hue: 0.24, sat: 0.6, lit: 0.24, bark: [0.75, 0.73, 0.68], barkRough: 0.4, decid: 1, fall: 0.14 },
      { name: 'maple', genus: 'Acer', form: 'broad', T: [10, 6], W: [0.65, 0.25], h: 20, spread: 0.5, depth: 4, kids: 3, droop: 0, leaf: [0.1, 0.9, 5], hue: 0.26, sat: 0.6, lit: 0.18, bark: [0.22, 0.2, 0.18], barkRough: 0.6, decid: 1, fall: 0.01 },
      { name: 'willow', genus: 'Salix', form: 'weep', T: [11, 8], W: [0.8, 0.2], h: 15, spread: 0.6, depth: 3, kids: 3, droop: 0.8, leaf: [0.08, 0.18, 0], hue: 0.22, sat: 0.45, lit: 0.24, bark: [0.18, 0.15, 0.12], barkRough: 0.9, decid: 1, fall: 0.15 },
      { name: 'spruce', genus: 'Picea', form: 'cone', T: [0, 7], W: [0.6, 0.3], h: 28, spread: 0.2, depth: 2, kids: 5, droop: 0.4, leaf: [0.02, 0.06, 0], hue: 0.38, sat: 0.4, lit: 0.1, bark: [0.12, 0.08, 0.06], barkRough: 0.7 },
      { name: 'pine', genus: 'Pinus', form: 'umbrella', T: [8, 10], W: [0.4, 0.3], h: 24, spread: 0.5, depth: 3, kids: 3, droop: 0, leaf: [0.06, 0.05, 0], hue: 0.3, sat: 0.4, lit: 0.13, bark: [0.3, 0.15, 0.08], barkRough: 1 },
      { name: 'fig', genus: 'Ficus', form: 'broad', T: [26, 5], W: [0.85, 0.15], h: 38, spread: 0.7, depth: 4, kids: 3, droop: 0, leaf: [0.16, 0.4, 0], hue: 0.3, sat: 0.6, lit: 0.13, bark: [0.35, 0.32, 0.26], barkRough: 0.3 },
      { name: 'palm', genus: 'Arecaria', form: 'palm', T: [26, 6], W: [0.6, 0.3], h: 16, spread: 0, depth: 1, kids: 14, droop: 0.6, leaf: [1.0, 0.12, 0], hue: 0.25, sat: 0.55, lit: 0.18, bark: [0.35, 0.3, 0.22], barkRough: 0.5 },
      { name: 'acacia', genus: 'Acacia', form: 'umbrella', T: [24, 6], W: [0.35, 0.15], h: 9, spread: 0.9, depth: 4, kids: 2, droop: 0, leaf: [0.04, 0.5, 0], hue: 0.22, sat: 0.4, lit: 0.17, bark: [0.2, 0.15, 0.1], barkRough: 0.8 },
      { name: 'cactus', genus: 'Cereus', form: 'column', T: [22, 7], W: [0.22, 0.1], h: 7, spread: 0.3, depth: 1, kids: 3, droop: 0, leaf: [0.05, 0.3, 0], hue: 0.3, sat: 0.35, lit: 0.2, bark: [0.18, 0.32, 0.15], barkRough: 0.2 },
    ];
    E.forEach((f) => { f.nSp = 150 + Math.floor(r() * 500); }); return E;
  }
  const n = 10 + Math.floor(r() * 7);
  for (let i = 0; i < n; i++) {
    const form = FORMS[Math.floor(r() * FORMS.length)], Tc = G.Teq - G.Tgrad * r() * 0.8, gen = cap(word(r, 2 + Math.floor(r() * 2)));
    S.push({ name: gen.toLowerCase() + ' family', genus: gen, form, T: [Tc, lerp(4, 10)], W: [lerp(0.25, 0.9), lerp(0.15, 0.35)], h: lerp(6, 34) * G.g ** -0.5, spread: lerp(0.2, 0.9), depth: 2 + Math.floor(r() * 3), kids: 2 + Math.floor(r() * 4),
      droop: lerp(-0.2, 0.8), leaf: [lerp(0.02, 0.25), lerp(0.08, 0.8), Math.floor(r() * 4) * (r() < 0.5 ? 1 : 0) + (r() < 0.2 ? 5 : 0)], hue: (G.leafHue + lerp(-0.08, 0.08) + 1) % 1, sat: lerp(0.3, 0.75), lit: lerp(0.1, 0.28),
      bark: lin(hsl(r(), lerp(0, 0.4), lerp(0.1, 0.6))), barkRough: r(), decid: r() < 0.4 ? 1 : 0, fall: r(), nSp: 120 + Math.floor(r() * 520) });
  }
  return S;
}
// species i of family f: its own genes, and a name that says something about them
export function species(G, f, i) {
  const key = f * 100000 + i; G.spc = G.spc || new Map(); let s = G.spc.get(key); if (s) return s;
  const F = G.species[f], r = rng(G.n * 7919 + f * 104729 + i * 31 + 3 + Math.round((G.E || 0) * 1000) * 7), nrm = () => (r() + r() + r() - 1.5) * 1.15;
  const hM = Math.exp(nrm() * 0.28), wM = Math.exp(nrm() * 0.2), lL = Math.exp(nrm() * 0.3), lW = Math.exp(nrm() * 0.3), dh = nrm() * (G.n === 0 || G.real ? 0.025 : 0.06), ds = nrm() * 0.12, dl = nrm() * 0.035;
  const lobes = F.leaf[2] > 0 ? Math.max(0, Math.round(F.leaf[2] + nrm() * 1.5)) : r() < 0.06 ? 3 : 0;
  const canopy = lin(hsl((F.hue + dh + 1) % 1, Math.min(0.95, Math.max(0.05, F.sat + ds)), Math.min(0.5, Math.max(0.05, F.lit + dl))));
  const bark = F.bark.map((v) => Math.min(1, v * Math.exp(nrm() * 0.25)));
  const ep = [hM > 1.3 ? 'gigantea' : hM < 0.75 ? 'nana' : '', lW > 1.35 ? 'latifolia' : lW < 0.72 ? 'angustifolia' : '', dh > 0.04 ? 'aurea' : dh < -0.04 ? 'caerulea' : '', canopy[0] > canopy[1] * 0.9 ? 'rubra' : '', bark[0] > 0.5 ? 'alba' : '', wM > 1.25 ? 'patula' : ''].filter(Boolean);
  const epithet = ep.length && r() < 0.6 ? ep[Math.floor(r() * ep.length)] : word(r, 2) + ['ensis', 'ifolia', 'a', 'ii', 'oides', 'iana', 'um'][Math.floor(r() * 7)];
  s = { f, i, name: F.names ? F.names[i % F.names.length] : F.genus + ' ' + epithet, hM, wM, leaf: [F.leaf[0] * lL, Math.min(0.95, F.leaf[1] * lW), lobes], canopy, bark, rough: F.barkRough, decid: F.decid || 0, fall: ((F.fall ?? 0.1) + nrm() * 0.04 + 1) % 1, code: f * 10000 + i + 1 };
  G.spc.set(key, s); return s;
}
export const nSpecies = (G) => G.species.reduce((a, f) => a + f.nSp, 0);
// how rough the ground is at each scale, as a fraction of the scale (by log2 of the scale in metres)
const RT = [[22, 0.00042], [21, 0.00055], [20, 0.0008], [19, 0.0013], [18, 0.004], [17, 0.01], [15, 0.03], [13, 0.06], [12, 0.07], [11, 0.06], [9, 0.045], [7, 0.035], [5, 0.03], [2, 0.028], [-1, 0.03], [-4, 0.048], [-7, 0.058], [-10, 0.04], [-18, 0.03]];
const frac = (l) => { for (let i = 1; i < RT.length; i++) if (l >= RT[i][0]) { const [l0, a0] = RT[i - 1], [l1, a1] = RT[i]; return a1 + (a0 - a1) * (l - l1) / (l0 - l1); } return 0.03; };
export function amps(G) { return Array.from({ length: K }, (_, k) => { const l = LS - k, a = 2 ** l * frac(l); return G.dat && k < G.kdat ? 0 : l > 13 ? a * G.relief : a * Math.min(1.4, G.relief); }); }
const ridged = (k) => k >= RIDGE0 && k < RIDGE1;
const shape = (k, n) => (ridged(k) ? 1 - Math.abs(2 * n - 1) : n);
// mountain belts follow the ridges of octave 2: mountains crowd along long arcs, plains between
export const MASKK = 2;
const belt = (n, G) => { const b = 1 - Math.abs(2 * n - 1); const t = Math.min(1, Math.max(0, (b - 0.55) / 0.35)); return 0.25 + 1.6 * G.ridge * t * t * (3 - 2 * t); };
const masked = (k, G) => G && G.dat ? k >= G.kdat && k < KD : k >= RIDGE0 && k < 18;

// ---- octave k at a point (planet-centred metres): its lattice coordinate, folded into 0..256 ----------------------
export function rotK(k) { const a = k * GOLD, b = k * PLA * 2.1 + 0.3; return [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)]; }
const rot = (k, p) => { const [ca, sa, cb, sb] = rotK(k), x1 = ca * p[0] - sa * p[1], y1 = sa * p[0] + ca * p[1]; return [x1, cb * y1 - sb * p[2], sb * y1 + cb * p[2]]; };
export const latK = (k, p, s = sOf(k)) => rot(k, p).map((v) => m256(v / s));
export const octN = (G, k, p) => { const u = latK(k, p); return shape(k, vn3(u[0], u[1], u[2], k + G.kseed)); };
// the ground's height above the sea at a point (any radius: it is read along the radius), to octave kmax
export function H(G, p, kmax = K) { const h = H0(G, p, kmax); if (kmax < 20 || h < 0.5 || h > 2200) return h; const l = Math.hypot(...p), q = p.map((v) => v / l * G.R); return h - RIVD * river(G, q, h, climate(G, q, h).W); }
export function H0(G, p, kmax = K) {
  const l = Math.hypot(...p), q = p.map((v) => v / l * G.R);
  if (G.dat) return dataGround(G, q, kmax);
  return (G.pl ? drift(G, q, kmax).h : coarseH(G, q, kmax)) + fineH(G, q, kmax);
}
// ---- measured worlds: the ground is the map (bicubic between its cells, never dipping below the lowest of the four
// cells round it on land, nor rising above the highest at sea, so a valley floor stays a floor), with the invented
// octaves finer than the map's cells laid over it, as rough as the map is rough there; near the shore the invented
// part is held back, so the coast stays where the map has it
export const dataH = (G, u) => G.dat.g.cubicC(u) + (G.base || 0);
export const reliefAt = (G, u) => G.dat.r.lin(u, 3);
export const damp = (hd, d) => (hd > 0) === (d < 0) ? d * (0.04 + 0.96 * ss(0, 80, Math.abs(hd))) : d;
// near a Go-to place on the Earth the measured fine ground is added (patchAt), and holds back the invented octaves it replaces
export const pdamp = (k, w) => 1 - w * Math.min(1, Math.max(0, (sOf(k) - 250) / 750));
export const patchOf = (G, u) => (G.real === 'earth' && !G.E ? patchAt(patches(), u) : null);
function dataGround(G, q, kmax) {
  const l = Math.hypot(...q), u = q.map((v) => v / l), pt = patchOf(G, u), hd = dataH(G, u) + (pt ? pt.h : 0), m = reliefAt(G, u), wp = pt ? pt.w : 0;
  let c = 0; for (let k = G.kdat; k < Math.min(kmax, KD); k++) c += G.amp[k] * pdamp(k, wp) * (octN(G, k, q) - 0.5);
  return hd + damp(hd, m * c) + fineH(G, q, kmax) + (G.crP && kmax > 12 ? craters(G, q) : 0);
}
// craters, on the airless worlds: invented, finer than their maps (24 km cells down to 95 m), each a bowl with a raised
// rim, on the same cube-face lattice the trees use (so the shaders can find each from the camera's foot exactly)
export const CRS = [24000, 6000, 1500, 375, 93.75];
export function craters(G, p) {
  const ab = p.map(Math.abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], fk = a * 2 + (p[a] > 0 ? 1 : 0); let h = 0;
  for (let s = 0; s < CRS.length; s++) { const S = CRS[s], u = p[b] / S, v = p[c] / S, iu = Math.floor(u), iv = Math.floor(v), k = 200 + s * 8 + fk;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const ci = iu + i, cj = iv + j; if (hs2(ci, cj, k) > G.crP) continue;
      const cx = ci + 0.2 + 0.6 * hs2(ci, cj, k + 1), cy = cj + 0.2 + 0.6 * hs2(ci, cj, k + 2), r = 0.1 + 0.38 * hs2(ci, cj, k + 3) ** 2, dd = Math.hypot(u - cx, v - cy) / r; if (dd > 2.2) continue;
      const dep = 0.34 * r * S * (0.3 + 0.7 * hs2(ci, cj, k + 4)), rim = 0.25 * dep; h += dd < 1 ? dep * (dd * dd - 1) + rim : rim * Math.exp(-(dd - 1) * 3.2); } }
  return h;
}
// the lake surface over a point, if there is one (else -1e4)
export const lakeAt = (G, u) => G.dat ? G.dat.g.near(u, 1) : -1e4;
// the ground is two parts: the coarse octaves (4,000 km down to 32 m: continents, ranges, hills, all the mountain belts)
// ride on the plates; the fine ones (16 m down) are the same everywhere, so they need not move
export const KD = 18;
function coarseH(G, q, kmax) { let h = G.base, m = 1; for (let k = 0; k < Math.min(kmax, KD); k++) { const n = octN(G, k, q); if (k === MASKK) m = belt(n, G); h += G.amp[k] * (masked(k, G) ? m : 1) * (n - 0.5); } return h; }
function fineH(G, q, kmax) { let h = 0; for (let k = KD; k < kmax; k++) h += G.amp[k] * (octN(G, k, q) - 0.5); return h; }

// ---- continental drift. Today's surface is cut into NPL plates (the cells round NPL centres); in an age past each
// plate stood turned about its own pole by its own rate times the age. A point then belongs to a plate if, turned back
// to today, it falls in that plate's cell; where none claims it there was ocean floor, where two do they had collided
// and stand raised in a mountain belt. Within BAND of a cell's edge plates blend, so nothing is cut.
export const NPL = 12, BAND = 60000, EDGE = 700000, OCEAN = -3500, PB = K + CLIM, PROWS = KD + 2;
const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const tr = (M) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => M[j][i]));
export function plates(G0, E) {
  const r = rng(G0.n * 733 + 9), c = [], R = [];
  for (let i = 0; i < NPL; i++) {
    const z = 1 - (2 * i + 1) / NPL + (r() - 0.5) * 0.25, a = i * GOLD + (r() - 0.5) * 0.6, s = Math.sqrt(Math.max(0, 1 - z * z)); c.push([s * Math.cos(a) * G0.R, s * Math.sin(a) * G0.R, Math.max(-1, Math.min(1, z)) * G0.R]);
    const pz = r() * 2 - 1, pa = r() * 6.2832, ps = Math.sqrt(1 - pz * pz), e = [ps * Math.cos(pa), ps * Math.sin(pa), pz];
    const th = (0.15 + 0.45 * r()) * (r() < 0.5 ? -1 : 1) * E * Math.PI / 180, C = Math.cos(th), S = Math.sin(th), V = 1 - C;   // 0.15 to 0.6 degrees a million years
    R.push([[C + e[0] * e[0] * V, e[0] * e[1] * V - e[2] * S, e[0] * e[2] * V + e[1] * S], [e[1] * e[0] * V + e[2] * S, C + e[1] * e[1] * V, e[1] * e[2] * V - e[0] * S], [e[2] * e[0] * V - e[1] * S, e[2] * e[1] * V + e[0] * S, C + e[2] * e[2] * V]]);
  }
  return { c, R, Ri: R.map(tr), mc: R.map((M) => c.map((v) => mv(M, v))) };   // mc[i][j]: centre j carried by plate i's turn
}
// how far inside its cell (turned back) each plate's claim on q reaches, in metres (negative: outside)
export function margins(G, q) {
  const P = G.pl, out = [];
  for (let i = 0; i < NPL; i++) { const M = P.mc[i], o = M[i], dO = Math.hypot(q[0] - o[0], q[1] - o[1], q[2] - o[2]); let m = 1e12;
    const t = mv(P.Ri[i], q), w = EDGE * (octN(G, 3, t) * 0.65 + octN(G, 4, t) * 0.35 - 0.5);   // edges that wander, as rifts and sutures do (each edge bent one way from both sides)
    for (let j = 0; j < NPL; j++) if (j !== i) m = Math.min(m, (Math.hypot(q[0] - M[j][0], q[1] - M[j][1], q[2] - M[j][2]) - dO) * 0.5 + (i < j ? w : -w));
    out.push(m); }
  return out;
}
const sst = (x) => { const t = Math.min(1, Math.max(0, (x + BAND) / (2 * BAND))); return t * t * (3 - 2 * t); };
// the coarse ground at q in an age with drift: the plates' own grounds, blended, over ocean floor, raised where they meet
export function drift(G, q, kmax = K, mg = margins(G, q)) {
  let T = 0, S = 0, W = 0, tmax = 0, tsec = 0, msec = 0, best = 0, mbest = 0;
  for (let i = 0; i < NPL; i++) { const t = sst(mg[i]); if (t <= 0) continue;
    const c = coarseH(G, mv(G.pl.Ri[i], q), kmax), w = t * Math.exp(Math.max(-30, Math.min(30, mg[i] / 1.5e5))); T += t; S += w * c; W += w;   // where two claim, the one further inside its own cell rides over
    if (t > tmax) { tsec = tmax; msec = mbest; tmax = t; mbest = mg[i]; best = i; } else if (t > tsec) { tsec = t; msec = mg[i]; } }
  const hl = W > 0 ? S / W : OCEAN, oc = Math.min(1, Math.max(0, (1 - T - 0.25) / 0.6)), ocs = oc * oc * (3 - 2 * oc), up = 2600 * Math.min(1, Math.max(0, T - 1)) * Math.exp(-Math.max(msec, 0) / 4e5);
  return { h: hl + (OCEAN - hl) * ocs + up, best, T };
}
// the plate a point stands on in an age (the strongest claim), and that point carried to another age on that plate
export const plateOf = (G, q) => { if (!G.pl) return 0; const m = margins(G, q); let b = 0; for (let i = 1; i < NPL; i++) if (m[i] > m[b]) b = i; return b; };
export const carry = (Gfrom, Gto, p) => { const i = plateOf(Gfrom, p), q = Gfrom.pl ? mv(Gfrom.pl.Ri[i], p) : p; return { p: Gto.pl ? mv(Gto.pl.R[i], q) : q, today: q, i, M: (v) => { const w = Gfrom.pl ? mv(Gfrom.pl.Ri[i], v) : v; return Gto.pl ? mv(Gto.pl.R[i], w) : w; } }; };
function seaLevel(G) {                                                      // the base that puts the wanted share of the surface under the sea
  const r = rng(G.n + 5), v = [];
  for (let i = 0; i < 1500; i++) { const z = r() * 2 - 1, a = r() * 6.2832, s = Math.sqrt(1 - z * z); v.push(H(G, [s * Math.cos(a) * G.R, s * Math.sin(a) * G.R, z * G.R], 9)); }
  v.sort((a, b) => a - b); return -v[Math.floor(G.seaFrac * v.length)];
}
// rivers: the places where a slow noise (30 km cells) crosses one half are channels; its gradient turns that into a
// distance in metres, so a channel has a true width (wider where it is wetter), carved RIVD deep
export const RIVD = 5;
const rivN = (G, u) => { const k = K + 4 + G.kseed; return vn3(u[0], u[1], u[2], k) * 0.7 + vn3(u[0] * 2 + 11.3, u[1] * 2 + 11.3, u[2] * 2 + 11.3, k) * 0.3; };
// the real rivers on today's Earth (riverdata.js: the major ones, good to about 2 km): segments between unit vectors,
// bucketed by whole degrees, each with a channel width by its Natural Earth rank (round numbers, metres)
const RW = [0, 1500, 900, 600, 400, 300, 200, 150, 120, 100]; let RV = null;
export function rivers() {
  if (RV) return RV; const B = new Map(), uv = (lo, la) => { const a = la * Math.PI / 180, b = lo * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; };
  for (const ln of RIVERS.split(';')) { const m = ln.indexOf('|'), r = +ln[0], nm = ln.slice(1, m); let x = 0, y = 0, pr = null;
    for (const t of ln.slice(m + 1).split(' ')) { const c = t.split(','); x += +c[0]; y += +c[1]; const lo = x * 0.02, la = y * 0.02;
      if (pr) { const sg = { a: uv(pr[0], pr[1]), b: uv(lo, la), w: RW[r], nm };
        for (let i = Math.floor(Math.min(pr[0], lo)); i <= Math.floor(Math.max(pr[0], lo)); i++) for (let j = Math.floor(Math.min(pr[1], la)); j <= Math.floor(Math.max(pr[1], la)); j++) { const k = i * 1000 + j; if (!B.has(k)) B.set(k, []); B.get(k).push(sg); } }
      pr = [lo, la]; } }
  return (RV = B);
}
export function segD(u, a, b) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = Math.min(1, Math.max(0, ((u[0] - a[0]) * ab[0] + (u[1] - a[1]) * ab[1] + (u[2] - a[2]) * ab[2]) / Math.max(ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2], 1e-18))); return Math.hypot(u[0] - a[0] - ab[0] * t, u[1] - a[1] - ab[1] * t, u[2] - a[2] - ab[2] * t) * 6.371e6; }
export function realRiver(p, R = 1) {   // the nearest real river within R degrees of p: { d metres, w width, nm name, sg }
  const l = Math.hypot(...p), u = p.map((v) => v / l), la = Math.asin(u[2]) * 180 / Math.PI, lo = Math.atan2(u[1], u[0]) * 180 / Math.PI, B = rivers(); let best = null, bd = 1e12;
  for (let i = Math.floor(lo) - R; i <= Math.floor(lo) + R; i++) for (let j = Math.floor(la) - R; j <= Math.floor(la) + R; j++) for (const sg of B.get(i * 1000 + j) || []) { const d = segD(u, sg.a, sg.b); if (d < bd) { bd = d; best = sg; } }
  return best && { d: bd, w: best.w, nm: best.nm, sg: best };
}
export function river(G, p, h, W, out) {
  let r0 = 0; if (G.real === 'earth' && !G.E) { const rr = realRiver(p, 0); if (rr && rr.d < rr.w * 2) { r0 = 1 - ss(rr.w * 0.5, rr.w * 0.5 + Math.max(40, rr.w * 0.25), rr.d); if (out) { out.dist = rr.d; out.wd = rr.w; } } }
  const wd = (8 + 70 * W * W) * ss(0.3, 0.45, W) * ss(0.5, 3, h) * (1 - ss(1600, 2200, h)); if (wd <= 0) return r0;
  const u = rot(K + 4, p).map((v) => m256(v / 30000)), n = rivN(G, u), e = 1e-4;
  const g = Math.hypot(rivN(G, [u[0] + e, u[1], u[2]]) - n, rivN(G, [u[0], u[1] + e, u[2]]) - n, rivN(G, [u[0], u[1], u[2] + e]) - n) / e / 30000, dist = Math.abs(n - 0.5) / Math.max(g, 1e-12);
  const r1 = 1 - ss(wd * 0.5, wd * 1.5, dist); if (r1 < r0) return r0;
  if (out) { out.dist = dist; out.wd = wd; }
  return r1;
}
// the octave's value, gradient and curvature (lattice units) at a point, for the shaders' near field
export function taylor(G, k, p) {
  const u = latK(k, p), f = (a, b, c) => shape(k, vn3(a, b, c, k + G.kseed)), e = 1e-4, [x, y, z] = u, f0 = f(x, y, z);
  const fx1 = f(x + e, y, z), fx0 = f(x - e, y, z), fy1 = f(x, y + e, z), fy0 = f(x, y - e, z), fz1 = f(x, y, z + e), fz0 = f(x, y, z - e), e2 = e * e;
  const xy = (f(x + e, y + e, z) - f(x + e, y - e, z) - f(x - e, y + e, z) + f(x - e, y - e, z)) / (4 * e2), xz = (f(x + e, y, z + e) - f(x + e, y, z - e) - f(x - e, y, z + e) + f(x - e, y, z - e)) / (4 * e2), yz = (f(x, y + e, z + e) - f(x, y + e, z - e) - f(x, y - e, z + e) + f(x, y - e, z - e)) / (4 * e2);
  return { u, f0, g: [(fx1 - fx0) / (2 * e), (fy1 - fy0) / (2 * e), (fz1 - fz0) / (2 * e)], h: [(fx1 - 2 * f0 + fx0) / e2, (fy1 - 2 * f0 + fy0) / e2, (fz1 - 2 * f0 + fz0) / e2, xy, xz, yz] };
}

// ---- climate: warmth from latitude and height, wetness from latitude belts and a slow noise ----------------------
// the climate fields are four more noise rows: warmth and wetness (1,200 and 450 km) and forest patches (900 and 260 m)
export const CL_S = [1.2e6, 4.5e5, 900, 260, 30000];
export const clim = (G, i, p) => { const s = CL_S[i], q = rot(K + i, p).map((v) => m256(v / s)), k = K + i + G.kseed, f = (a, o) => vn3(q[0] * a + o, q[1] * a + o, q[2] * a + o, k); return f(1, 0) * 0.5 + f(2, 17.3) * 0.3 + f(4, 41.7) * 0.2; };
export function climate(G, p, h) {
  if (G.dat && G.dat.cl) {                                                // measured: the year's mean (brought to this height), its rain, the summer's warmth
    const l = Math.hypot(...p), u = p.map((v) => v / l), c = G.dat.cl, T0 = c.lin(u, 0), A = c.lin(u, 1), P = c.lin(u, 2), sl = u[2];
    const T = T0 + (G.Teq - 28) - (G.Tgrad - 45) * sl * sl - 6.5 * Math.max(h, 0) / 1000;
    const W = Math.min(1, Math.max(0, 0.42 + 0.22 * Math.log2(Math.max(P, 1) / Math.max(20 * (T + 7), 40)) + G.wet));
    return { T, W, lat: Math.asin(sl), Ts: T + Math.abs(A), A, P };
  }
  const l = Math.hypot(...p), sl = (p[0] * G.axis[0] + p[1] * G.axis[1] + p[2] * G.axis[2]) / l, lat = Math.asin(sl);
  const T = G.Teq - G.Tgrad * sl * sl - (G.lapse ?? 6.5) * Math.max(h, 0) / 1000 * G.g + 8 * (clim(G, 0, p) - 0.5);
  const W = Math.min(1, Math.max(0, 0.5 + 0.3 * Math.cos(lat * 6.3) + 0.9 * (clim(G, 1, p) - 0.5) + G.wet));
  return { T, W, lat };
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function forestF(G, p, h, T, W) {                                   // how much of the ground the forest takes here (0..1)
  if (h < 2) return 0; const n = clim(G, 2, p) * 0.6 + clim(G, 3, p) * 0.4;
  if (G.dat && G.dat.cl) { const tg = ss(7, 11, climate(G, p, h).Ts);   // measured: the forest thins out from the wet to the dry (savanna, maquis, prairie), with scattered trees and cacti even in dry lands
    return Math.max(ss(0.38, 0.66, W) * tg * Math.min(1, Math.max(0, (n - 0.3 + 0.25 * (W - 0.5)) * 4)), 0.03 * ss(0.05, 0.18, W) * (1 - ss(0.35, 0.5, W)) * tg); }
  return ss(0.3, 0.55, W) * (G.dat && G.dat.cl ? ss(7, 11, climate(G, p, h).Ts) : ss(-9, -5, T)) * Math.min(1, Math.max(0, (n - 0.3 + 0.25 * (W - 0.5)) * 4));
}
export function speciesW(G, T, W) { return G.species.map((s) => Math.exp(-(((T - s.T[0]) / s.T[1]) ** 2) - (((W - s.W[0]) / s.W[1]) ** 2))); }

// ---- tree sites: a lattice 7 m apart on each face of the cube around the planet (the face the site's own direction
// points most along), so every site has one home and its place never depends on where you look from ----------------
export const TREE = 7;
export const AX = [[1, 2], [2, 0], [0, 1]];                                // the two plane axes for each face axis
// trees in a town: along the streets' edges and in the parks, a few in yards, none on the building plots (the same 30 m
// lots, streets and parks as city.js), blended in as the place gets built up
function townF(G, p, F, h, T, W) {
  const u = cityRho(G, p) * citySuit(h, T, W, 0, G), wild = F * (1 - Math.min(0.85, u * 1.6)); if (u < 0.04) return wild;
  const ab = p.map(Math.abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], x = p[b] / LOT, y = p[c] / LOT, lx = Math.floor(x), ly = Math.floor(y), fx = x - lx, fy = y - ly;
  const sx = (lx & 3) === 0, sy = (ly + 1000000) % 5 === 0, park = hs2(Math.trunc(lx / 4), Math.trunc(ly / 5), 123) < 0.12, edge = (sx && (fx < 0.18 || fx > 0.82)) || (sy && (fy < 0.18 || fy > 0.82));
  const tf = (sx || sy ? (edge ? 0.7 : 0) : park ? 0.65 : 0.12) * Math.min(1, F * 2 + 0.35); return wild + (tf - wild) * Math.min(1, u * 4);
}
export function site(G, a, sg, i, j) {
  const [b, c] = AX[a], fk = a * 2 + (sg > 0 ? 1 : 0), xb = (i + 0.15 + 0.7 * hs2(i, j, 40 + fk)) * TREE, xc = (j + 0.15 + 0.7 * hs2(i, j, 50 + fk)) * TREE, d = G.R * G.R - xb * xb - xc * xc;
  if (d <= 0) return null; const xa = sg * Math.sqrt(d); if (Math.abs(xa) < Math.max(Math.abs(xb), Math.abs(xc))) return null;
  const p = [0, 0, 0]; p[a] = xa; p[b] = xb; p[c] = xc;
  const h = H(G, p, 26); const { T, W } = climate(G, p, h), F = townF(G, p, forestF(G, p, h, T, W), h, T, W); if (hs2(i, j, 60 + fk) > F || river(G, p, h, W) > 0.25) return null;
  let w = speciesW(G, T, W), pr = null; if (G.present) { pr = G.present(G, p.map((v) => v / G.R), h, T, W); w = w.map((x, n) => pr.ok[n] ? x : 0); }   // measured worlds: only the families that grow here
  const tot = w.reduce((x, y) => x + y, 0); if (tot < 1e-3) return null;
  let x = hs2(i, j, 70 + fk) * tot, s = 0; while (s < w.length - 1 && x > w[s]) x -= w[s++];
  const Fm = G.species[s], ix = pr && Fm.idx && Fm.idx[pr.r] || [0, Fm.nSp], nS = ix[1], ri = Math.floor(i * TREE / 25000), rj = Math.floor(j * TREE / 25000), base = Math.floor(hs2(ri, rj, 90 + s + fk * 20) * nS), k = Math.floor(hs2(i, j, 75 + fk) ** 2 * 9);   // this region's few, commonest first
  return { p, h, sp: s, spc: species(G, s, ix[0] + (base + k * 61) % nS), seed: hs2(i, j, 80 + fk) };
}

// a site's ground and how well a tree would do there (the forest's own density, 0..1), whether or not one stands
// there now: where a seed lands (eco.js)
export function siteP(G, a, sg, i, j) {
  const [b, c] = AX[a], fk = a * 2 + (sg > 0 ? 1 : 0), xb = (i + 0.15 + 0.7 * hs2(i, j, 40 + fk)) * TREE, xc = (j + 0.15 + 0.7 * hs2(i, j, 50 + fk)) * TREE, d = G.R * G.R - xb * xb - xc * xc;
  if (d <= 0) return null; const xa = sg * Math.sqrt(d); if (Math.abs(xa) < Math.max(Math.abs(xb), Math.abs(xc))) return null;
  const p = [0, 0, 0]; p[a] = xa; p[b] = xb; p[c] = xc;
  const h = H(G, p, 26); if (h < 0.5) return null; const { T, W } = climate(G, p, h);
  if (river(G, p, h, W) > 0.25) return null;
  return { p, h, T, W, F: townF(G, p, forestF(G, p, h, T, W), h, T, W), seed: hs2(i, j, 80 + fk) };
}

// ---- cities: on inhabited planets, a few towns and cities in each 60 km cell of the cube faces, where the land
// suits them (low, not too steep, not desert or ice). rho is how built-up a place is (0..1): a city's core is 1.
export const CITY = 60000, LOT = 30;
// On today's Earth, how built-up a place is comes from its measured light at night (lights(): sixth-of-a-degree cells
// of NASA's Black Marble, read bilinear): dim cells are country, bright ones town, only the brightest the high-rise
// cores; inside a cell, neighbourhoods and open ground vary on a 2 km noise. The streets and buildings are invented.
// what 18 km light cells cannot tell from their suburbs: the high-rise cores of the big cities (latitude, longitude,
// radius in km, how tall 0..1: Manhattan 1, Paris's even six storeys .62), approximate, placed from the cities' plans
const CNAMES = 'New York (Midtown);Lower Manhattan;Jersey City;Downtown Brooklyn;Boston;Back Bay, Boston;Philadelphia;Washington;Baltimore;Pittsburgh;Atlanta;Midtown Atlanta;Miami;Charlotte;Chicago Loop;Detroit;Cleveland;Minneapolis;St. Louis;Kansas City;Houston;Dallas;Austin;Denver;Phoenix;the Las Vegas Strip;Los Angeles;San Diego;San Francisco;Seattle;Portland;Vancouver;Toronto;Montreal;Calgary;Mexico City;Panama City;São Paulo;Rio de Janeiro;Buenos Aires;Santiago;Lima;Bogotá;Caracas;the City of London;Canary Wharf;Westminster;Paris;La Défense;Berlin;Madrid;Barcelona;Rome;Milan;Vienna;Munich;Frankfurt;Amsterdam;Brussels;Moscow;Moscow City;St Petersburg;Istanbul;Levent, Istanbul;Warsaw;Stockholm;Athens;Lisbon;Prague;Budapest;Kyiv;Copenhagen;Dublin;Manchester;Zurich;Hamburg;Cairo;Lagos;Johannesburg;Sandton;Nairobi;Cape Town;Casablanca;Addis Ababa;Kinshasa;Accra;Downtown Dubai;Dubai Marina;Abu Dhabi;Doha;Riyadh;Tel Aviv;Tehran;Karachi;South Mumbai;Lower Parel, Mumbai;Bandra Kurla, Mumbai;New Delhi;Gurgaon;Bangalore;Chennai;Kolkata;Dhaka;Hyderabad;Marunouchi, Tokyo;Shinjuku;Shibuya;Minato, Tokyo;Osaka;Seoul;Gangnam, Seoul;Beijing CBD;Beijing;Lujiazui, Shanghai;Shanghai;Central, Hong Kong;Kowloon;Shenzhen;Guangzhou;Chongqing;Taipei;Singapore;Bangkok;Kuala Lumpur;Jakarta;Makati, Manila;Ho Chi Minh City;Hanoi;Wuhan;Chengdu;Tianjin;Sydney;Melbourne;Brisbane;Perth;Auckland'.split(';');
export const CORES = '40.755,-73.984,2.2,1;40.708,-74.010,1,1;40.718,-74.035,.7,.85;40.693,-73.987,.6,.8;42.355,-71.060,1.1,.9;42.348,-71.082,.6,.8;39.952,-75.165,1,.9;38.900,-77.030,1.3,.7;39.289,-76.612,.7,.8;40.441,-80.000,.6,.85;33.757,-84.390,1,.9;33.785,-84.384,.7,.85;25.770,-80.193,1,.9;35.227,-80.843,.6,.85;41.881,-87.630,1.6,1;42.331,-83.046,.7,.85;41.499,-81.694,.6,.8;44.977,-93.270,.7,.85;38.627,-90.193,.6,.8;39.100,-94.583,.6,.8;29.758,-95.367,1,.95;32.780,-96.800,1,.9;30.268,-97.743,.7,.85;39.745,-104.990,.8,.85;33.449,-112.074,.6,.75;36.115,-115.173,1.5,.85;34.050,-118.255,1,.9;32.716,-117.162,.6,.8;37.790,-122.400,1,.95;47.608,-122.335,.9,.9;45.520,-122.678,.6,.8;49.283,-123.120,1,.9;43.650,-79.381,1.4,.95;45.503,-73.570,.9,.85;51.047,-114.068,.7,.85;19.427,-99.160,2,.8;8.980,-79.520,1,.9;-23.560,-46.650,2.5,.85;-22.905,-43.180,1.2,.85;-34.603,-58.380,1.8,.85;-33.425,-70.620,1.2,.85;-12.090,-77.030,1,.75;4.650,-74.060,1.2,.8;10.500,-66.880,1,.8;51.514,-.085,1,.9;51.505,-.020,.5,.95;51.507,-.128,1.5,.6;48.857,2.345,3,.62;48.892,2.238,.6,.9;52.515,13.390,2,.65;40.420,-3.695,1.8,.7;41.390,2.165,2,.65;41.898,12.480,1.5,.55;45.475,9.190,1.5,.75;48.208,16.372,1.5,.6;48.140,11.575,1.2,.6;50.112,8.675,.8,.9;52.372,4.895,1.2,.55;50.847,4.355,1,.65;55.752,37.617,2.5,.75;55.749,37.537,.5,1;59.935,30.325,2,.6;41.010,28.980,1.5,.6;41.080,29.010,.8,.85;52.230,21.005,1,.8;59.330,18.065,1,.6;37.980,23.730,1.5,.6;38.715,-9.140,1,.6;50.085,14.425,1,.55;47.500,19.050,1.5,.6;50.450,30.523,1.2,.7;55.678,12.570,1,.55;53.347,-6.260,.8,.55;53.480,-2.243,.7,.75;47.373,8.540,.8,.6;53.550,9.993,1,.65;30.045,31.235,2,.75;6.450,3.395,1,.8;-26.204,28.045,1,.85;-26.107,28.056,.6,.8;-1.286,36.820,.8,.8;-33.920,18.425,.7,.8;33.590,-7.610,1,.7;9.010,38.760,1,.7;-4.320,15.310,1,.65;5.555,-.200,.8,.65;25.195,55.275,2,1;25.080,55.140,.8,1;24.490,54.365,1,.9;25.320,51.530,.8,.95;24.690,46.685,1.2,.85;32.075,34.785,1,.85;35.700,51.410,2,.7;24.860,67.010,1.5,.7;18.930,72.830,1.5,.85;19.000,72.825,.8,.9;19.065,72.865,.6,.85;28.630,77.220,1.5,.6;28.495,77.090,1,.85;12.975,77.595,1.2,.75;13.060,80.260,1.2,.7;22.570,88.360,1.5,.7;23.780,90.410,2,.75;17.440,78.380,1,.8;35.681,139.767,1.2,.9;35.690,139.695,.8,.95;35.659,139.701,.5,.85;35.660,139.745,1,.85;34.700,135.495,1.2,.9;37.567,126.978,1.5,.85;37.500,127.035,1.5,.9;39.910,116.460,1.5,.95;39.910,116.400,2,.6;31.238,121.502,1,1;31.230,121.470,2,.8;22.282,114.160,1.2,1;22.305,114.172,1.5,.9;22.540,114.055,2,.95;23.120,113.320,1.5,.9;29.560,106.575,1.5,.9;25.035,121.560,1.5,.85;1.283,103.851,1.2,.95;13.745,100.540,2,.9;3.155,101.712,1.2,.95;-6.210,106.820,2,.9;14.555,121.025,1,.9;10.775,106.700,1.2,.85;21.025,105.850,1,.7;30.590,114.300,1.5,.85;30.660,104.065,1.5,.85;39.125,117.200,1.2,.85;-33.867,151.207,1.2,.9;-37.815,144.963,1.2,.9;-27.470,153.025,.8,.85;-31.953,115.858,.7,.8;-36.848,174.765,.7,.8'.split(';').map((s, i) => { const [la, lo, r, t] = s.split(',').map(Number), a = la * Math.PI / 180, b = lo * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a), r * 1000, t, CNAMES[i]]; });
export function coreAt(p) {
  const l = Math.hypot(...p); let c = 0; for (const k of CORES) { const d = Math.hypot(p[0] / l - k[0], p[1] / l - k[1], p[2] / l - k[2]) * 6.371e6; if (d < k[3]) c = Math.max(c, k[4] * ss(k[3], k[3] * 0.35, d)); } return c;
}
export function litRho(G, p) {
  const l = Math.hypot(...p), L = lights(), x = (Math.atan2(p[1], p[0]) / (2 * Math.PI) + 0.5) * L.w - 0.5, y = (0.5 - Math.asin(p[2] / l) / Math.PI) * L.h - 0.5, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const g = (a, b) => L.a[Math.min(L.h - 1, Math.max(0, b)) * L.w + ((a % L.w) + L.w) % L.w], v = g(i, j) * (1 - fx) * (1 - fy) + g(i + 1, j) * fx * (1 - fy) + g(i, j + 1) * (1 - fx) * fy + g(i + 1, j + 1) * fx * fy;
  const b = ss(0.45, 0.85, v), n = vn3(p[0] / 1800, p[1] / 1800, p[2] / 1800, 77), c = coreAt(p); return Math.max(b * Math.min(1, Math.max(0, 0.25 + 1.1 * n)) * 0.55, c * (0.85 + 0.15 * n));
}
export function cityRho(G, p) {
  if (!G.cities) return 0;
  if (G.real === 'earth' && !G.E) return litRho(G, p);
  const ab = p.map(Math.abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], fk = a * 2 + (p[a] > 0 ? 1 : 0), u = p[b] / CITY, v = p[c] / CITY;
  let r = 0; for (let i = Math.floor(u) - 1; i <= Math.floor(u) + 1; i++) for (let j = Math.floor(v) - 1; j <= Math.floor(v) + 1; j++) {
    if (hs2(i, j, 90 + fk) > 0.45) continue;
    const cx = i + 0.2 + 0.6 * hs2(i, j, 91 + fk), cy = j + 0.2 + 0.6 * hs2(i, j, 92 + fk), R = (1500 + 10000 * hs2(i, j, 93 + fk) ** 3) / CITY, d = Math.hypot(u - cx, v - cy) / R;
    if (d < 1) r = Math.max(r, (1 - d) ** 1.4);
  }
  return r;
}
// whether the land suits a town: on an invented world low, mild, wet and flat ground; on today's Earth the lights have
// already said where people live, so only land that is not too steep (pass G)
export const citySuit = (h, T, W, sl, G) => G && G.real === 'earth' && !G.E ? ss(0.5, 2, h) * ss(0.35, 0.15, sl) : ss(3, 12, h) * ss(900, 500, h) * ss(-4, 2, T) * ss(0.15, 0.3, W) * ss(0.25, 0.1, sl);

// ---- the same, for the shaders ----------------------------------------------------------------------------------------
// uOct: per octave one row of 7 texels: lattice offset at the camera's foot and the value there; the gradient and
// amplitude; the curvature (6); 1/size and whether ridged; and the octave's turn, already composed with the frame
// (camera-local axes to planet axes), so a shader works in camera-local metres throughout.
export const GLSL_NOISE = `
uniform highp sampler2D uOct; uniform int uKs; uniform float uR;
#define OT(k, i) texelFetch(uOct, ivec2(i, k), 0)
float hsh3(ivec3 c, int k) { uint x = uint((c.x + 17 * k) & 255), y = uint((c.y + 91 * k) & 255), z = uint((c.z + 53 * k) & 255); uint h = x * 374761393u + y * 668265263u + z * 2246822519u; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h & 16777215u) / 16777215.; }
float hs2(ivec2 c, int k) { uint i = uint(c.x & 1048575), j = uint(c.y & 1048575), kk = uint(k); uint h = (i ^ (kk * 2654435761u)) * 2246822507u ^ (j + kk * 7919u) * 3266489909u; h ^= h >> 15u; h *= 739982445u; h ^= h >> 12u; h *= 695872825u; h ^= h >> 15u; return float(h >> 8u) / 16777216.; }
vec4 vnd3(vec3 u, int k) {
  vec3 i = floor(u), f = u - i, w = f * f * f * (f * (f * 6. - 15.) + 10.), dw = 30. * f * f * (f * (f - 2.) + 1.); ivec3 c = ivec3(i);
  float a = hsh3(c, k), b = hsh3(c + ivec3(1, 0, 0), k), cc = hsh3(c + ivec3(0, 1, 0), k), d = hsh3(c + ivec3(1, 1, 0), k), e = hsh3(c + ivec3(0, 0, 1), k), g = hsh3(c + ivec3(1, 0, 1), k), h = hsh3(c + ivec3(0, 1, 1), k), j = hsh3(c + ivec3(1, 1, 1), k);
  float k0 = a, k1 = b - a, k2 = cc - a, k3 = e - a, k4 = a - b - cc + d, k5 = a - cc - e + h, k6 = a - b - e + g, k7 = -a + b + cc - d + e - g - h + j;
  return vec4(k0 + k1 * w.x + k2 * w.y + k3 * w.z + k4 * w.x * w.y + k5 * w.y * w.z + k6 * w.z * w.x + k7 * w.x * w.y * w.z,
    dw * vec3(k1 + k4 * w.y + k6 * w.z + k7 * w.y * w.z, k2 + k5 * w.z + k4 * w.x + k7 * w.z * w.x, k3 + k6 * w.x + k5 * w.y + k7 * w.x * w.y));
}
float sOf(int k) { return exp2(float(${LS} - k)); }
mat3 rotO(int k) { vec4 a = OT(k, 4), b = OT(k, 5); float c = OT(k, 6).x; return mat3(a.x, a.w, b.z, a.y, b.x, b.w, a.z, b.y, c); }   // rows as written: lattice = M * local
// octave k at q (camera-local metres from the camera's foot on the sphere): its value less the value at the foot, and
// its gradient (camera-local, per metre). Near the foot (a five-hundredth of a cell) it is the octave's own Taylor
// series, so no octave ever has to resolve a millimetre against a continent's coordinates.
vec4 octR(int r, int k, vec3 q);
vec4 oct(int k, vec3 q) { return octR(k, k, q); }
vec4 octR(int r, int k, vec3 q) {
  vec4 A = OT(r, 0), B = OT(r, 1), C = OT(r, 2), D = OT(r, 3); mat3 M = rotO(r); vec3 du = M * q * D.z; float n; vec3 g;
  if (dot(du, du) < 4e-6) { vec3 hx = vec3(C.x, C.w, D.x), hy = vec3(C.w, C.y, D.y), hz = vec3(D.x, D.y, C.z); g = B.xyz + vec3(dot(hx, du), dot(hy, du), dot(hz, du)); n = dot(B.xyz, du) + .5 * dot(du, vec3(dot(hx, du), dot(hy, du), dot(hz, du))); }
  else { vec4 v = vnd3(A.xyz + du, k + uKs); if (D.w > .5) { float sg = sign(2. * v.x - 1.); n = 1. - abs(2. * v.x - 1.) - A.w; g = -2. * sg * v.yzw; } else { n = v.x - A.w; g = v.yzw; } }
  return vec4(n, (transpose(M) * g) * D.z);
}
// a climate row: just the value (absolute), no near field needed at its size
float clim(int i, vec3 q) { int k = ${K} + i; vec4 A = OT(k, 0), D = OT(k, 3); vec3 u = A.xyz + rotO(k) * q * D.z; return vnd3(u, k + uKs).x * .5 + vnd3(u * 2. + 17.3, k + uKs).x * .3 + vnd3(u * 4. + 41.7, k + uKs).x * .2; }
`;
// the octave table for the camera's foot p (planet metres, on the sphere) and frame F (3 columns: local x y z in
// planet axes), packed for uOct
// With drift (an age past), the coarse rows are turned onto the plate under the camera, and after them come each
// plate's own coarse rows, its centres as it carried them, its claim's edge near the camera and its height there.
function octRow(G, T, o, k, p, F, full) {
  const cl = k >= K, s = cl ? CL_S[k - K] : sOf(k), [ca, sa, cb, sb] = rotK(k), R = [[ca, -sa, 0], [cb * sa, cb * ca, -sb], [sb * sa, sb * ca, cb]];
  const M = R.map((row) => [0, 1, 2].map((c) => row[0] * F[c][0] + row[1] * F[c][1] + row[2] * F[c][2]));   // lattice from local
  if (cl) { const u = rot(k, p).map((v) => m256(v / s)); T.set([u[0], u[1], u[2], 0], o); T.set([0, 0, 1 / s, 0], o + 12); }
  else if (full) { const t = taylor(G, k, p); T.set([...t.u, t.f0], o); T.set([...t.g, G.amp[k]], o + 4); T.set([t.h[0], t.h[1], t.h[2], t.h[3]], o + 8); T.set([t.h[4], t.h[5], 1 / s, ridged(k) ? 1 : 0], o + 12); }
  else { const u = latK(k, p); T.set([...u, shape(k, vn3(u[0], u[1], u[2], k + G.kseed))], o); T.set([0, 0, 0, G.amp[k]], o + 4); T.set([0, 0, 1 / s, ridged(k) ? 1 : 0], o + 12); }
  T.set([M[0][0], M[0][1], M[0][2], M[1][0]], o + 16); T.set([M[1][1], M[1][2], M[2][0], M[2][1]], o + 20); T.set([M[2][2], masked(k, G) ? 1 : 0, 0, 0], o + 24);
}
const beltAt = (G, q) => belt(octN(G, MASKK, q), G);
export function octTable(G, p, F) {
  const rows = K + CLIM + (G.pl ? NPL * PROWS : 0), T = new Float32Array(rows * 7 * 4);
  if (!G.pl) { for (let k = 0; k < K + CLIM; k++) octRow(G, T, k * 28, k, p, F, true); T.m0 = G.dat ? reliefAt(G, p.map((v) => v / G.R)) : beltAt(G, p); return T; }
  const P = G.pl, mg = margins(G, p); let cam = 0; for (let i = 1; i < NPL; i++) if (mg[i] > mg[cam]) cam = i;
  const turn = (i) => ({ q: mv(P.Ri[i], p), F: F.map((v) => mv(P.Ri[i], v)) }), C = turn(cam), Cf = coarseH(G, C.q, K);
  for (let k = 0; k < K + CLIM; k++) { const t = k < KD ? C : { q: p, F }; octRow(G, T, k * 28, k, t.q, t.F, true); }
  const e = 10, ga = margins(G, p.map((v, i) => v + F[0][i] * e)), gb = margins(G, p.map((v, i) => v + F[2][i] * e));
  for (let i = 0; i < NPL; i++) {
    const t = turn(i), r = PB + i * PROWS, near = mg[i] > -BAND - 8000;   // the near field is only wanted where the plate reaches the camera
    for (let k = 0; k < KD; k++) octRow(G, T, (r + k) * 28, k, t.q, t.F, near);
    P.mc[i].forEach((c, j) => T.set([c[0], c[1], c[2], 0], (r + KD) * 28 + j * 4));
    T.set([(ga[i] - mg[i]) / e, 0, (gb[i] - mg[i]) / e, mg[i]], (r + KD + 1) * 28 + 5 * 4);
    T.set([beltAt(G, t.q), coarseH(G, t.q, K) - Cf, 0, 0], (r + KD + 1) * 28 + 6 * 4);
  }
  const D = drift(G, p, K, mg); T.m0 = beltAt(G, C.q); T.cam = cam; T.K0 = D.h - Cf; T.Oc = OCEAN - Cf;
  return T;
}
// the ground below the camera-local point q, relative to the ground at the foot; the mountain belt mask is octave
// MASKK's ridge, applied to the masked octaves. Shared by every shader that stands things on the ground.
export const GLSL_GROUND = `
uniform float uMaskR, uM0;   // the belt strength, and the mask's value at the foot
float beltM(float n) { float b = 1. - abs(2. * n - 1.), t = clamp((b - .55) / .35, 0., 1.); return .25 + 1.6 * uMaskR * t * t * (3. - 2. * t); }
// dh: height above the foot's ground; g: its gradient; kc: finest octave cell to include (metres); returns the mask
uniform int uNpl, uPlC; uniform float uK0, uOc; uniform vec3 uFootD; uniform mat3 uFrmD;   // drift: plates (0: none), the camera's, the ground at the foot and the ocean floor (both less the camera plate's own)
float pMargin(int i, vec3 p, vec3 q) {
  int r = ${PB} + i * ${PROWS}; vec4 L = OT(r + ${KD + 1}, 5);
  if (dot(q, q) < 2.5e7) return L.w + dot(L.xyz, q);                     // near the camera: its edge, linearised (exact enough, and steady)
  vec3 o = OT(r + ${KD} + i / 7, i - i / 7 * 7).xyz; float dO = length(p - o), m = 1e12;
  float w = ${EDGE}. * ((OT(r + 3, 0).w + octR(r + 3, 3, q).x) * .65 + (OT(r + 4, 0).w + octR(r + 4, 4, q).x) * .35 - .5);
  for (int j = 0; j < ${NPL}; j++) { if (j >= uNpl) break; if (j == i) continue; m = min(m, (length(p - OT(r + ${KD} + j / 7, j - j / 7 * 7).xyz) - dO) * .5 + (i < j ? w : -w)); }
  return m;
}
float coarseRel(int r0, vec3 q, float cmin, float m0, out float dh, out vec3 g) {
  dh = 0.; g = vec3(0.); float m = m0;
  for (int k = 0; k < ${KD}; k++) {
    float s = sOf(k), w = clamp(s / cmin - 1.5, 0., 1.); if (w <= 0.) break;
    vec4 o = octR(r0 + k, k, q); float a = OT(r0 + k, 1).w;
    if (k == ${MASKK}) m = beltM(OT(r0 + k, 0).w + o.x);
    if (OT(r0 + k, 6).y > .5) { dh += a * w * (m * o.x + (m - m0) * (OT(r0 + k, 0).w - .5)); g += a * w * m * o.yzw; }
    else { dh += a * w * o.x; g += a * w * o.yzw; }
  }
  return m;
}
// measured worlds (uDw 1): the map's ground under the camera as its Taylor series, from the map farther off; the map's
// relief scales the invented octaves finer than its cells; near the shore the invented part is held back (see dataGround)
uniform int uDw, uKd; uniform highp sampler2D uDat, uRel; uniform float uDh0, uDm0, uDbase, uDcell; uniform vec3 uDg; uniform mat3 uDH; uniform vec2 uDsz;
vec4 cubW(float t) { return vec4(((-t + 2.) * t - 1.) * t, (3. * t - 5.) * t * t + 2., ((-3. * t + 4.) * t + 1.) * t, (t - 1.) * t * t) * .5; }
// the measured fine ground near a Go-to place (see patchAt in earth.js): its height, slope, and how much of it is there.
// Where in the patch a point lies comes from the camera's foot (exact, from the CPU) and how that changes per metre:
// GPU asin and atan are good to about 1e-4, a kilometre on the ground, which put the drawn ground a few hundred
// metres off the one walked on. Linear over the 44 km is off by tens of metres at the edges, nothing near the camera.
uniform int uPon; uniform vec4 uPo; uniform vec2 uPx0; uniform vec3 uPJx, uPJy; uniform float uPt0, uPw0; uniform highp sampler2D uPat;
float patchG(vec3 q, out vec3 gq, out float wp) {
  gq = vec3(0.); wp = 0.; if (uPon == 0) return 0.;
  vec2 x = uPx0 + vec2(dot(uPJx, q), dot(uPJy, q)); if (x.x < 0. || x.y < 0. || x.x > 95. || x.y > 95.) return 0.;
  ivec2 i = ivec2(min(floor(x), vec2(94.))); vec2 f = x - vec2(i); int r0 = int(uPo.w);   // bilinear, four reads: height, and the slope interpolated so the light stays smooth
  vec4 a = texelFetch(uPat, ivec2(i.x, i.y + r0), 0), b = texelFetch(uPat, ivec2(i.x + 1, i.y + r0), 0), c = texelFetch(uPat, ivec2(i.x, i.y + 1 + r0), 0), e = texelFetch(uPat, ivec2(i.x + 1, i.y + 1 + r0), 0);
  vec4 v = mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
  vec2 sx = smoothstep(0., 10., x) * smoothstep(95., 85., x); wp = sx.x * sx.y;
  gq = v.y * uPJx + v.z * uPJy;
  return v.x; }
float pdampG(float s, float w) { return 1. - w * clamp((s - 250.) / 750., 0., 1.); }
vec2 dTC(vec3 u) { return vec2(atan(u.y, u.x) / 6.28318531 + .5, .5 - asin(clamp(u.z, -1., 1.)) / 3.14159265); }
float dTex(vec3 u) {
  vec2 x = dTC(u) * uDsz - .5, i = floor(x), f = x - i; vec4 wx = cubW(f.x), wy = cubW(f.y); float s = 0., lo = 1e9, hi = -1e9; int W = int(uDsz.x), Hh = int(uDsz.y);
  for (int b = 0; b < 4; b++) { float r = 0.; int jj = clamp(int(i.y) - 1 + b, 0, Hh - 1);
    for (int a = 0; a < 4; a++) { int ii = int(i.x) - 1 + a; ii = ii < 0 ? ii + W : ii >= W ? ii - W : ii; float v = texelFetch(uDat, ivec2(ii, jj), 0).x; r += wx[a] * v; if ((a == 1 || a == 2) && (b == 1 || b == 2)) { lo = min(lo, v); hi = max(hi, v); } }
    s += wy[b] * r; }
  return lo > 0. ? max(s, lo) : hi < 0. ? min(s, hi) : s;
}
float lakeL(vec3 q) { if (uDw == 0) return -1e4; vec2 x = dTC(normalize(uFootD + uFrmD * q)) * uDsz; return texelFetch(uDat, ivec2(clamp(x, vec2(0.), uDsz - 1.)), 0).y; }
uniform float uCrP; uniform vec3 uCf[5]; uniform ivec3 uCb[5];
float craterG(vec3 q, float cmin, out vec3 gq) {   // the craters at q (see craters() in planet.js), and their gradient
  vec3 D = uFrmD * q, P = uFootD + D, ab = abs(P); int a = ab.x >= ab.y && ab.x >= ab.z ? 0 : ab.y >= ab.z ? 1 : 2, b = a == 0 ? 1 : a == 1 ? 2 : 0, c = a == 0 ? 2 : a == 1 ? 0 : 1, fk = a * 2 + (P[a] > 0. ? 1 : 0);
  float h = 0.; vec3 gP = vec3(0.);
  for (int s = 0; s < 5; s++) { float S = ${CRS[0]}. / pow(4., float(s)), w = clamp(S / (cmin * 3.) - 1., 0., 1.); if (w <= 0.) break; int k = 200 + s * 8 + fk;
    vec2 tc = vec2(uCf[s][b] + D[b] / S, uCf[s][c] + D[c] / S), fl = floor(tc), fr = tc - fl; ivec2 c0 = ivec2(fl) + ivec2(uCb[s][b], uCb[s][c]);
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { ivec2 cc = c0 + ivec2(i, j); if (hs2(cc, k) > uCrP) continue;
      vec2 ce = vec2(i, j) + .2 + .6 * vec2(hs2(cc, k + 1), hs2(cc, k + 2)), dv = fr - ce; float r = .1 + .38 * pow(hs2(cc, k + 3), 2.), dl = length(dv), dd = dl / r; if (dd > 2.2) continue;
      float dep = .34 * r * S * (.3 + .7 * hs2(cc, k + 4)), rim = .25 * dep, hh, hd;
      if (dd < 1.) { hh = dep * (dd * dd - 1.) + rim; hd = 2. * dep * dd; } else { float e = exp(-(dd - 1.) * 3.2); hh = rim * e; hd = -3.2 * rim * e; }
      h += w * hh; vec2 gd = w * hd * dv / (max(dl, 1e-6) * r * S); gP[b] += gd.x; gP[c] += gd.y; } }
  gq = transpose(uFrmD) * gP; return h;
}
float dDamp(float hd, float d) { return (hd > 0.) == (d < 0.) ? d * (.04 + .96 * smoothstep(0., 80., abs(hd))) : d; }
float groundD(vec3 q, float cmin, out float dh, out vec3 g) {
  float r = length(q), tw = smoothstep(3000., 6000., r), hd = uDh0, m = uDm0; vec3 gd = uDg;
  if (tw < 1.) { vec3 Hq = uDH * q; hd = uDh0 + dot(uDg, q) + .5 * dot(q, Hq); gd = uDg + Hq; }
  if (tw > 0.) { vec3 p = uFootD + uFrmD * q, u = normalize(p); float e = uDcell * .3, h0 = dTex(u) + uDbase, hx = dTex(normalize(p + uFrmD[0] * e)) + uDbase, hz = dTex(normalize(p + uFrmD[2] * e)) + uDbase;
    hd = mix(hd, h0, tw); gd = mix(gd, vec3((hx - h0) / e, 0., (hz - h0) / e), tw); m = mix(m, texture(uRel, dTC(u)).w, tw); }
  vec3 gpt; float wpt, pt = patchG(q, gpt, wpt); hd += pt; gd += gpt;
  float c = 0., c0 = 0., f = 0.; vec3 gc = vec3(0.), gF = vec3(0.);
  for (int k = 0; k < ${K}; k++) { if (k < uKd) continue; float s = sOf(k), w = clamp(s / cmin - 1.5, 0., 1.); if (w <= 0.) break;
    vec4 o = oct(k, q); float a = OT(k, 1).w * w, n0 = OT(k, 0).w - .5;
    if (k < ${KD}) { c += a * pdampG(s, wpt) * (n0 + o.x); c0 += a * pdampG(s, uPw0) * n0; gc += a * pdampG(s, wpt) * o.yzw; } else { f += a * o.x; gF += a * o.yzw; } }
  float d = m * c, dd = dDamp(hd, d);
  dh = (hd + dd) - (uDh0 + uPt0 + dDamp(uDh0 + uPt0, uDm0 * c0)) + f; g = gd + m * gc * (abs(d) > 1e-6 ? dd / d : 1.) + gF;
  if (uCrP > 0.) { vec3 g1, g0; dh += craterG(q, cmin, g1) - craterG(vec3(0.), cmin, g0); g += g1; }
  return m;
}
float ground(vec3 q, float cmin, out float dh, out vec3 g) {
  if (uDw > 0) return groundD(q, cmin, dh, g);
  if (uNpl > 0) {
    float dF = 0.; vec3 gF = vec3(0.);
    for (int k = ${KD}; k < ${K}; k++) { float s = sOf(k), w = clamp(s / cmin - 1.5, 0., 1.); if (w <= 0.) break; vec4 o = oct(k, q); float a = OT(k, 1).w; dF += a * w * o.x; gF += a * w * o.yzw; }
    vec3 p = uFootD + uFrmD * q; float T = 0., S = 0., W = 0., tmax = 0., tsec = 0., msec = 0., mb = 0., mr = uM0; vec3 Gs = vec3(0.);
    for (int i = 0; i < ${NPL}; i++) { if (i >= uNpl) break;
      float mg = pMargin(i, p, q), t = smoothstep(-${BAND}., ${BAND}., mg); if (t <= 0.) continue;
      float c, mm; vec3 gc;
      if (i == uPlC) mm = coarseRel(0, q, cmin, uM0, c, gc);
      else { int r = ${PB} + i * ${PROWS}; vec4 X = OT(r + ${KD + 1}, 6); mm = coarseRel(r, q, cmin, X.x, c, gc); c += X.y; }
      float wt = t * exp(clamp(mg / 1.5e5, -30., 30.)); T += t; S += wt * c; W += wt; Gs += wt * gc;
      if (t > tmax) { tsec = tmax; msec = mb; tmax = t; mb = mg; mr = mm; } else if (t > tsec) { tsec = t; msec = mg; }
    }
    float hl = W > 0. ? S / W : uOc, oc = smoothstep(.25, .85, 1. - T), up = 2600. * clamp(T - 1., 0., 1.) * exp(-max(msec, 0.) / 4e5);
    dh = mix(hl, uOc, oc) + up - uK0 + dF; g = (W > 0. ? Gs / W : vec3(0.)) * (1. - oc) + gF;
    return mr;
  }
  dh = 0.; g = vec3(0.); float m = uM0;
  for (int k = 0; k < ${K}; k++) {
    float s = sOf(k), w = clamp(s / cmin - 1.5, 0., 1.); if (w <= 0.) break;
    vec4 o = oct(k, q); float a = OT(k, 1).w;
    if (k == ${MASKK}) m = beltM(OT(k, 0).w + o.x);
    if (OT(k, 6).y > .5) { dh += a * w * (m * o.x + (m - uM0) * (OT(k, 0).w - .5)); g += a * w * m * o.yzw; }
    else { dh += a * w * o.x; g += a * w * o.yzw; }
  }
  return m;
}
`;
// the GLSL climate, mirroring climate() and forestF(); uAxis is the planet's axis in camera-local axes
export const GLSL_CLIMATE = () => `
uniform vec3 uAxis; uniform float uTeq, uTgrad, uWet, uGrav, uLapse, uSph; uniform int uCl; uniform highp sampler2D uClim;
float gTs = 99., gSeas = 0.;                                               // (set by climate: on measured worlds, the summer's warmth and this moment's seasonal swing)
vec3 climate(vec3 q, float h) {   // warmth (°C), wetness (0..1), latitude (radians)
  if (uCl > 0) { vec3 u = normalize(uFootD + uFrmD * q); vec4 c = texture(uClim, dTC(u)); float sl = u.z;
    float T = c.x + uTeq - 28. - (uTgrad - 45.) * sl * sl - 6.5 * max(h, 0.) / 1000., W = clamp(.42 + .22 * log2(max(c.z, 1.) / max(20. * (T + 7.), 40.)) + uWet, 0., 1.);
    gTs = T + abs(c.y); gSeas = c.y * uSph; return vec3(T, W, asin(clamp(sl, -1., 1.))); }
  vec3 rad = normalize(q + vec3(0., uR, 0.)); float sl = dot(rad, uAxis), lat = asin(clamp(sl, -1., 1.));
  float T = uTeq - uTgrad * sl * sl - uLapse * max(h, 0.) / 1000. * uGrav + 8. * (clim(0, q) - .5);
  float W = clamp(.5 + .3 * cos(lat * 6.3) + .9 * (clim(1, q) - .5) + uWet, 0., 1.);
  return vec3(T, W, lat);
}
uniform vec3 uFootP; uniform mat3 uFrm; uniform int uCities;
// how built-up the place at q is (see cityRho); and whether the land suits a town
uniform highp sampler2D uLitC; uniform vec4 uCore[6]; uniform float uCoreR[6];   // the six city cores nearest you: direction, how tall; radius
float cityRho(vec3 q) {
  if (uCities == 0) return 0.; vec3 p = uFootP + uFrm * q, ab = abs(p);
  // today's Earth: its measured light (see litRho)
  if (uCities == 2) { float L = texture(uLitC, dTC(normalize(p))).r, n = vnd3(p / 1800., 77).x, cr = 0.; for (int i = 0; i < 6; i++) cr = max(cr, uCore[i].w * (1. - smoothstep(uCoreR[i] * .35, uCoreR[i], length(normalize(p) - uCore[i].xyz) * 6.371e6))); return max(smoothstep(.45, .85, L) * clamp(.25 + 1.1 * n, 0., 1.) * .55, cr * (.85 + .15 * n)); } int a = ab.x >= ab.y && ab.x >= ab.z ? 0 : ab.y >= ab.z ? 1 : 2, b = a == 0 ? 1 : a == 1 ? 2 : 0, c = a == 0 ? 2 : a == 1 ? 0 : 1, fk = a * 2 + (p[a] > 0. ? 1 : 0);
  vec2 uv = vec2(p[b], p[c]) / ${CITY}.; ivec2 f = ivec2(floor(uv)); float r = 0.;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { ivec2 cc = f + ivec2(i, j); if (hs2(cc, 90 + fk) > .45) continue;
    vec2 ce = vec2(cc) + .2 + .6 * vec2(hs2(cc, 91 + fk), hs2(cc, 92 + fk)); float R = (1500. + 10000. * pow(hs2(cc, 93 + fk), 3.)) / ${CITY}., d = length(uv - ce) / R;
    if (d < 1.) r = max(r, pow(1. - d, 1.4)); }
  return r;
}
uniform float uRivC;   // the channel's depth fraction at the foot
uniform vec4 uRA[24], uRB[24]; uniform int uRn;   // the real rivers' segments nearest you: ends (camera-local metres), width
float riverR(vec3 q, out float dist, out float wd) { dist = 1e9; wd = 0.; for (int i = 0; i < 24; i++) { if (i >= uRn) break; vec3 a = uRA[i].xyz, ab = uRB[i].xyz - a; float t = clamp(dot(q - a, ab) / max(dot(ab, ab), 1e-6), 0., 1.), d = length(q - a - ab * t); if (d < dist) { dist = d; wd = uRA[i].w; } }
  return wd > 0. ? 1. - smoothstep(wd * .5, wd * .5 + max(40., wd * .25), dist) : 0.; }
float riverM(vec3 q, float h, float W, out float dist, out float wd) {
  float dR, wR, rR = riverR(q, dR, wR);
  wd = (8. + 70. * W * W) * smoothstep(.3, .45, W) * smoothstep(.5, 3., h) * (1. - smoothstep(1600., 2200., h)); dist = 1e9; if (wd <= 0.) { dist = dR; wd = wR; return rR; }
  int k = ${K} + 4; vec4 A = OT(k, 0), D = OT(k, 3); vec3 u = A.xyz + rotO(k) * q * D.z; vec4 a = vnd3(u, k + uKs), b = vnd3(u * 2. + 11.3, k + uKs);
  float n = a.x * .7 + b.x * .3; vec3 g = a.yzw * .7 + b.yzw * .6; dist = abs(n - .5) / max(length(g) * D.z, 1e-12);
  float r1 = 1. - smoothstep(wd * .5, wd * 1.5, dist); if (rR > r1) { dist = dR; wd = wR; return rR; } return r1;
}
float citySuit(float h, float T, float W, float sl) { if (uCities == 2) return smoothstep(.5, 2., h) * smoothstep(.35, .15, sl); return smoothstep(3., 12., h) * smoothstep(900., 500., h) * smoothstep(-4., 2., T) * smoothstep(.15, .3, W) * smoothstep(.25, .1, sl); }
float forestF(vec3 q, float h, float T, float W, float fp) {
  if (h < 2.) return 0.; float n = mix(clim(2, q), .5, smoothstep(200., 700., fp)) * .6 + mix(clim(3, q), .5, smoothstep(60., 200., fp)) * .4;
  return (uCl > 0 ? smoothstep(.38, .66, W) * smoothstep(7., 11., gTs) : smoothstep(.3, .55, W) * smoothstep(-9., -5., T)) * clamp((n - .3 + .25 * (W - .5)) * 4., 0., 1.) * (1. - min(.85, cityRho(q) * citySuit(h, T, W, 0.) * 1.6));
}
`;

// ---- deep time: the same planet, an age ago. The continents stand elsewhere (drift, above), the sea stands higher or lower, the climate is warmer or colder, and the plants are other plants: each family
// has the age it arose and the age it died out, and those alive have drifted (taller, paler, broader-leaved) with
// every species a different one, its own name. On Sylva the families and their dates are Earth's.
export const AGES = [0, 0.02, 3, 50, 150, 310, 385, 450];
export const ageName = (E) => E === 0 ? 'today' : E < 0.1 ? 'the last ice age, 20,000 years ago' : `${E} million years ago`;
const SYLVA_PAST = { 0.02: [-6, -120, 8, 0], 3: [2, 20, 0, 0], 50: [10, 60, -12, 0.05], 150: [7, 120, -12, 0], 310: [2, 60, 5, 0.12], 385: [6, 100, -5, 0], 450: [3, 150, 0, -0.1] };   // warmer (°C), sea higher (m), pole-to-equator gradient, wetter
const SYLVA_SPAN = { Quercus: 56, Fagus: 80, Betula: 70, Acer: 60, Salix: 65, Picea: 140, Pinus: 150, Ficus: 80, Arecaria: 90, Acacia: 25, Cereus: 30 };
const SYLVA_OLD = [
  { name: 'ginkgo', genus: 'Ginkgo', form: 'broad', T: [12, 9], W: [0.55, 0.3], h: 25, spread: 0.45, depth: 4, kids: 2, droop: 0, leaf: [0.06, 0.9, 2], hue: 0.24, sat: 0.5, lit: 0.2, bark: [0.3, 0.27, 0.22], barkRough: 0.7, decid: 1, fall: 0.15, o: 270, x: 0.5 },
  { name: 'monkey puzzle', genus: 'Araucaria', form: 'umbrella', T: [17, 9], W: [0.5, 0.3], h: 40, spread: 0.35, depth: 3, kids: 4, droop: 0.2, leaf: [0.04, 0.25, 0], hue: 0.33, sat: 0.45, lit: 0.12, bark: [0.3, 0.25, 0.2], barkRough: 0.8, o: 230, x: 1 },
  { name: 'cycad', genus: 'Cycas', form: 'palm', T: [24, 7], W: [0.45, 0.25], h: 4, spread: 0, depth: 1, kids: 16, droop: 0.3, leaf: [0.9, 0.1, 0], hue: 0.3, sat: 0.5, lit: 0.14, bark: [0.25, 0.2, 0.12], barkRough: 0.9, o: 280, x: 1 },
  { name: 'tree fern', genus: 'Dicksonia', form: 'palm', T: [18, 7], W: [0.85, 0.2], h: 8, spread: 0, depth: 1, kids: 14, droop: 0.5, leaf: [1.6, 0.14, 0], hue: 0.28, sat: 0.55, lit: 0.18, bark: [0.15, 0.1, 0.07], barkRough: 1, o: 200, x: 1 },
  { name: 'tree fern', genus: 'Psaronius', form: 'palm', T: [24, 8], W: [0.75, 0.25], h: 10, spread: 0, depth: 1, kids: 12, droop: 0.4, leaf: [2, 0.14, 0], hue: 0.3, sat: 0.5, lit: 0.16, bark: [0.18, 0.12, 0.08], barkRough: 1, o: 330, x: 250 },
  { name: 'scale tree', genus: 'Lepidodendron', form: 'spire', T: [25, 8], W: [0.85, 0.2], h: 35, spread: 0.3, depth: 3, kids: 2, droop: -0.1, leaf: [0.12, 0.06, 0], hue: 0.36, sat: 0.45, lit: 0.13, bark: [0.25, 0.28, 0.2], barkRough: 0.3, o: 360, x: 295 },
  { name: 'giant horsetail', genus: 'Calamites', form: 'column', T: [22, 8], W: [0.92, 0.15], h: 15, spread: 0.2, depth: 2, kids: 6, droop: 0, leaf: [0.08, 0.05, 0], hue: 0.3, sat: 0.4, lit: 0.16, bark: [0.35, 0.33, 0.25], barkRough: 0.2, o: 360, x: 250 },
  { name: 'cordaite', genus: 'Cordaites', form: 'broad', T: [18, 9], W: [0.6, 0.3], h: 30, spread: 0.4, depth: 3, kids: 3, droop: 0.1, leaf: [0.5, 0.18, 0], hue: 0.3, sat: 0.45, lit: 0.14, bark: [0.2, 0.16, 0.12], barkRough: 0.6, o: 320, x: 250 },
  { name: 'first tree', genus: 'Archaeopteris', form: 'cone', T: [22, 10], W: [0.6, 0.3], h: 25, spread: 0.3, depth: 3, kids: 4, droop: 0.2, leaf: [0.03, 0.6, 0], hue: 0.32, sat: 0.45, lit: 0.15, bark: [0.25, 0.2, 0.15], barkRough: 0.8, o: 385, x: 359 },
  { name: 'cladoxylopsid', genus: 'Wattieza', form: 'palm', T: [24, 8], W: [0.75, 0.25], h: 8, spread: 0, depth: 1, kids: 10, droop: 0.1, leaf: [0.8, 0.1, 0], hue: 0.3, sat: 0.45, lit: 0.17, bark: [0.22, 0.18, 0.12], barkRough: 0.7, o: 390, x: 375 },
  { name: 'giant fungus', genus: 'Prototaxites', form: 'column', T: [18, 12], W: [0.45, 0.35], h: 8, spread: 0.05, depth: 1, kids: 1, droop: 0, leaf: [0.01, 0.1, 0], hue: 0.1, sat: 0.2, lit: 0.35, bark: [0.55, 0.5, 0.42], barkRough: 0.3, o: 420, x: 370 },
];
const ages = new Map();
export function ageWorld(G0, E) {
  if (!E) return G0; const key = `${G0.n}@${E}`; if (ages.has(key)) return ages.get(key);
  const r = rng(G0.n * 6151 + Math.round(E * 100)), lerp = (a, b) => a + (b - a) * r(), syl = G0.n === 0 || G0.real === 'earth';
  const G = { ...G0, E, id: key, ageName: ageName(E), cities: false, spc: new Map() };
  const [dT, dS, dG, dW] = syl ? SYLVA_PAST[E] : [E < 0.1 ? -lerp(3, 9) : lerp(-6, 12), E < 0.1 ? -lerp(40, 150) : lerp(-80, 200), lerp(-12, 8), lerp(-0.1, 0.15)];
  G.Teq += dT; G.Tgrad = Math.max(15, G.Tgrad + dG); G.wet += dW; G.base = G0.base - dS; G.pl = G0.real ? undefined : plates(G0, E); G.maskless = E >= 40;
  // who was alive: on Sylva the dated families; elsewhere each family gets an age of origin, and there are families
  // long gone, invented the same way as the living ones
  let fam;
  if (syl) fam = [...G0.species.map((f) => ({ ...f, o: f.o ?? SYLVA_SPAN[f.genus], x: 0 })), ...SYLVA_OLD.filter((f) => !G0.species.some((g) => g.genus === f.genus)).map((f) => ({ ...f }))];
  else { const q = rng(G0.n * 991 + 4), first = 380 + q() * 300;   // when this planet's land first went green
    fam = G0.species.map((f) => ({ ...f, o: 5 + q() ** 1.6 * (first - 5), x: 0 }));
    for (let i = 0; i < (G0.species.length ? 9 : 0); i++) { const o = 60 + q() * (first - 60), base = G0.species[Math.floor(q() * G0.species.length)], gen = base.genus.slice(0, 3) + ['opsis', 'odon', 'ites', 'axylon', 'aria', 'ella'][Math.floor(q() * 6)];
      fam.push({ ...base, name: gen.toLowerCase() + ' family', genus: cap(gen), form: FORMS[Math.floor(q() * FORMS.length)], h: base.h * (0.6 + q() * 1.2), hue: (base.hue + (q() - 0.5) * 0.15 + 1) % 1, leaf: [base.leaf[0] * (0.5 + q() * 2), base.leaf[1], base.leaf[2]], T: [base.T[0] + (q() - 0.5) * 12, base.T[1]], o, x: Math.max(0.5, o - 40 - q() * 200), nSp: 120 + Math.floor(q() * 400) }); } }
  G.species = fam.filter((f) => f.o >= E && f.x < E).slice(0, G0.real ? 90 : 16).map((f) => {   // drifted, a little, by how long ago
    const k = Math.min(1, E / 100), d = (a) => (r() - 0.5) * 2 * a * k;
    const s = { ...f, h: f.h * Math.exp(d(0.25)), hue: (f.hue + d(0.03) + 1) % 1, lit: Math.max(0.06, f.lit + d(0.03)), leaf: [f.leaf[0] * Math.exp(d(0.3)), f.leaf[1], f.leaf[2]], nSp: f.nSp || 150 + Math.floor(r() * 500) };
    s.canopy = lin(hsl(s.hue, s.sat, s.lit)); return s; });
  // what covers the open ground: grass came late; before land plants, bare rock and crusts
  G.ground = G0.lifeless ? 'bare' : E >= 430 ? 'bare' : E >= 40 ? 'ferns' : 'grass';
  if (G.ground === 'ferns' && !G0.lifeless) G.grass = lin(hsl(syl ? 0.3 : G0.leafHue, 0.45, 0.22));
  if (G.ground === 'bare' && !G0.lifeless) { G.grass = G0.soil.map((v, i) => v * 0.7 + G0.rock[i] * 0.3); G.grassDry = G0.rock; }
  // the animals of the age
  G.fauna = syl ? ({ 0.02: { scale: 1.5, neck: 0.4, col: [0.22, 0.12, 0.06] }, 3: {}, 50: { scale: 0.55 }, 150: { scale: 3.2, neck: 2.6, len: 1.6, hscale: 2.2 }, 310: { legs: 6, neck: 0.01, len: 2.4, L: 0.3, scale: 1, col: [0.18, 0.07, 0.04], noHunt: 1, span: 0.35 }, 385: { none: 1 }, 450: { none: 1 } })[E]
    : E > 300 || G0.lifeless ? { none: 1 } : { scale: lerp(0.5, 3), neck: lerp(0.3, 2.5) };
  G.birds = syl ? E < 160 && E !== 385 || E === 310 : E < 200 && !G0.lifeless;
  G.whales = E < 40;
  ages.set(key, G); return G;
}

// ---- the other planets of a planet's own system: each a genome of its own, held to what its place says. Its size is
// what it looks like from afar; its warmth, its star's size in its sky and the length of its year follow from how far
// out it is; small worlds keep little air, hot ones lose their seas, cold ones freeze them; life only where it could be.
export function sibling(Gh, k, p) {
  const n = 1000 + Gh.n * 16 + k, G = genome(n), r = rng(n * 53 + 1), x = p.ra;   // x: its distance over its home's
  G.id = n; G.k = k; G.home = Gh.n; G.sysYr = x ** 1.5; G.name = cap(word(r, 2 + Math.floor(r() * 2)));
  G.R = p.R; G.g = +Math.max(0.15, Math.min(2.2, (p.R / 6.371e6) * (0.75 + 0.4 * r()))).toFixed(2); G.relief = (0.6 + 1.1 * r()) * G.g ** -0.7;
  G.starK = Gh.starK; G.sunCol = Gh.sunCol; G.sunSize = Gh.sunSize / x; G.yearD = Math.round(Gh.yearD * x ** 1.5 * (Gh.dayH / G.dayH));
  const T = (Gh.Teq + 273) / Math.sqrt(x) - 273, air0 = G.air; G.Teq = T; G.Tgrad = 20 + 30 * r();
  G.air = p.R < 3.2e6 ? 0.05 + 0.25 * r() : T > 150 ? 2.2 : G.air; G.beta = G.beta.map((v) => v / air0 * G.air); G.Hs = 8000 / G.g * (0.7 + 0.7 * r());
  G.cloud = G.air < 0.4 ? 0.02 : T > 150 ? 0.85 : G.cloud; G.cloudBase = 1500 / G.g; G.cloudTop = 4000 / G.g;
  if (T > 90) { G.seaFrac = 0.04; G.liquid = [0.06, 0.012, 0.002]; G.wet = -0.45; }   // too hot for seas: dry rock, a little lava
  else if (T < -45) { G.seaFrac = 0.3; G.liquid = [0.55, 0.6, 0.66]; G.wet = -0.2; } // too cold: frozen seas
  { const m = Math.max(...G.liquid); G.liqA = G.liquid.map((v) => 0.015 + 0.15 * (1 - v / m) ** 1.5); G.liqC = G.liquid.map((v) => v / m * 0.06); }
  G.lifeless = !(T > -25 && T < 50 && G.air >= 0.5);
  if (G.lifeless) { G.species = []; G.ground = 'bare'; G.grass = G.soil.map((v, i) => v * 0.6 + G.rock[i] * 0.4); G.grassDry = G.rock; G.fauna = { none: 1 }; G.birds = false; G.whales = false; }
  G.cities = false; G.moons = []; G.rings = 0; G.mouths = [];
  G.amp = amps(G); G.base = 0; G.base = seaLevel(G);
  return G;
}
