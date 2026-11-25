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
  const earth = n === 0, G = { n, name: NAMES[n % NAMES.length], kseed: n * 41 };
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
export function sunAt(G, t) { const dl = G.tilt * Math.cos(2 * Math.PI * t / G.yearD), a = G.sunA - 2 * Math.PI * t; return [Math.cos(dl) * Math.cos(a), Math.cos(dl) * Math.sin(a), Math.sin(dl)]; }
// the season at a latitude: +1 midsummer, -1 midwinter; and whether it is warming (spring) or cooling (autumn)
export function season(G, t, lat) { const ph = 2 * Math.PI * t / G.yearD, k = Math.min(1, Math.abs(lat) / 0.35) * Math.min(1, G.tilt / 0.3) * Math.sign(lat || 1); return { s: Math.cos(ph) * k, spring: -Math.sin(ph) * k > 0 }; }
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
  const F = G.species[f], r = rng(G.n * 7919 + f * 104729 + i * 31 + 3), nrm = () => (r() + r() + r() - 1.5) * 1.15;
  const hM = Math.exp(nrm() * 0.28), wM = Math.exp(nrm() * 0.2), lL = Math.exp(nrm() * 0.3), lW = Math.exp(nrm() * 0.3), dh = nrm() * (G.n === 0 ? 0.025 : 0.06), ds = nrm() * 0.12, dl = nrm() * 0.035;
  const lobes = F.leaf[2] > 0 ? Math.max(0, Math.round(F.leaf[2] + nrm() * 1.5)) : r() < 0.06 ? 3 : 0;
  const canopy = lin(hsl((F.hue + dh + 1) % 1, Math.min(0.95, Math.max(0.05, F.sat + ds)), Math.min(0.5, Math.max(0.05, F.lit + dl))));
  const bark = F.bark.map((v) => Math.min(1, v * Math.exp(nrm() * 0.25)));
  const ep = [hM > 1.3 ? 'gigantea' : hM < 0.75 ? 'nana' : '', lW > 1.35 ? 'latifolia' : lW < 0.72 ? 'angustifolia' : '', dh > 0.04 ? 'aurea' : dh < -0.04 ? 'caerulea' : '', canopy[0] > canopy[1] * 0.9 ? 'rubra' : '', bark[0] > 0.5 ? 'alba' : '', wM > 1.25 ? 'patula' : ''].filter(Boolean);
  const epithet = ep.length && r() < 0.6 ? ep[Math.floor(r() * ep.length)] : word(r, 2) + ['ensis', 'ifolia', 'a', 'ii', 'oides', 'iana', 'um'][Math.floor(r() * 7)];
  s = { f, i, name: F.genus + ' ' + epithet, hM, wM, leaf: [F.leaf[0] * lL, Math.min(0.95, F.leaf[1] * lW), lobes], canopy, bark, rough: F.barkRough, decid: F.decid || 0, fall: ((F.fall ?? 0.1) + nrm() * 0.04 + 1) % 1, code: f * 10000 + i + 1 };
  G.spc.set(key, s); return s;
}
export const nSpecies = (G) => G.species.reduce((a, f) => a + f.nSp, 0);
// how rough the ground is at each scale, as a fraction of the scale (by log2 of the scale in metres)
const RT = [[22, 0.00042], [21, 0.00055], [20, 0.0008], [19, 0.0013], [18, 0.004], [17, 0.01], [15, 0.03], [13, 0.06], [12, 0.07], [11, 0.06], [9, 0.045], [7, 0.035], [5, 0.03], [2, 0.028], [-1, 0.03], [-4, 0.048], [-7, 0.058], [-10, 0.04], [-18, 0.03]];
const frac = (l) => { for (let i = 1; i < RT.length; i++) if (l >= RT[i][0]) { const [l0, a0] = RT[i - 1], [l1, a1] = RT[i]; return a1 + (a0 - a1) * (l - l1) / (l0 - l1); } return 0.03; };
function amps(G) { return Array.from({ length: K }, (_, k) => { const l = LS - k, a = 2 ** l * frac(l); return l > 13 ? a * G.relief : a * Math.min(1.4, G.relief); }); }
const ridged = (k) => k >= RIDGE0 && k < RIDGE1;
const shape = (k, n) => (ridged(k) ? 1 - Math.abs(2 * n - 1) : n);
// mountain belts follow the ridges of octave 2: mountains crowd along long arcs, plains between
export const MASKK = 2;
const belt = (n, G) => { const b = 1 - Math.abs(2 * n - 1); const t = Math.min(1, Math.max(0, (b - 0.55) / 0.35)); return 0.25 + 1.6 * G.ridge * t * t * (3 - 2 * t); };
const masked = (k) => k >= RIDGE0 && k < 18;

// ---- octave k at a point (planet-centred metres): its lattice coordinate, folded into 0..256 ----------------------
export function rotK(k) { const a = k * GOLD, b = k * PLA * 2.1 + 0.3; return [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)]; }
const rot = (k, p) => { const [ca, sa, cb, sb] = rotK(k), x1 = ca * p[0] - sa * p[1], y1 = sa * p[0] + ca * p[1]; return [x1, cb * y1 - sb * p[2], sb * y1 + cb * p[2]]; };
export const latK = (k, p, s = sOf(k)) => rot(k, p).map((v) => m256(v / s));
export const octN = (G, k, p) => { const u = latK(k, p); return shape(k, vn3(u[0], u[1], u[2], k + G.kseed)); };
// the ground's height above the sea at a point (any radius: it is read along the radius), to octave kmax
export function H(G, p, kmax = K) { const h = H0(G, p, kmax); if (kmax < 20 || h < 0.5 || h > 2200) return h; const l = Math.hypot(...p), q = p.map((v) => v / l * G.R); return h - RIVD * river(G, q, h, climate(G, q, h).W); }
export function H0(G, p, kmax = K) {
  const l = Math.hypot(...p), q = p.map((v) => v / l * G.R); let h = G.base, m = 1;
  for (let k = 0; k < kmax; k++) { const n = octN(G, k, q); if (k === MASKK) m = belt(n, G); h += G.amp[k] * (masked(k) ? m : 1) * (n - 0.5); }
  return h;
}
function seaLevel(G) {                                                      // the base that puts the wanted share of the surface under the sea
  const r = rng(G.n + 5), v = [];
  for (let i = 0; i < 1500; i++) { const z = r() * 2 - 1, a = r() * 6.2832, s = Math.sqrt(1 - z * z); v.push(H(G, [s * Math.cos(a) * G.R, s * Math.sin(a) * G.R, z * G.R], 9)); }
  v.sort((a, b) => a - b); return -v[Math.floor(G.seaFrac * v.length)];
}
// rivers: the places where a slow noise (30 km cells) crosses one half are channels; its gradient turns that into a
// distance in metres, so a channel has a true width (wider where it is wetter), carved RIVD deep
export const RIVD = 5;
const rivN = (G, u) => { const k = K + 4 + G.kseed; return vn3(u[0], u[1], u[2], k) * 0.7 + vn3(u[0] * 2 + 11.3, u[1] * 2 + 11.3, u[2] * 2 + 11.3, k) * 0.3; };
export function river(G, p, h, W, out) {
  const wd = (8 + 70 * W * W) * ss(0.3, 0.45, W) * ss(0.5, 3, h) * (1 - ss(1600, 2200, h)); if (wd <= 0) return 0;
  const u = rot(K + 4, p).map((v) => m256(v / 30000)), n = rivN(G, u), e = 1e-4;
  const g = Math.hypot(rivN(G, [u[0] + e, u[1], u[2]]) - n, rivN(G, [u[0], u[1] + e, u[2]]) - n, rivN(G, [u[0], u[1], u[2] + e]) - n) / e / 30000, dist = Math.abs(n - 0.5) / Math.max(g, 1e-12);
  if (out) { out.dist = dist; out.wd = wd; }
  return 1 - ss(wd * 0.5, wd * 1.5, dist);
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
  const l = Math.hypot(...p), sl = (p[0] * G.axis[0] + p[1] * G.axis[1] + p[2] * G.axis[2]) / l, lat = Math.asin(sl);
  const T = G.Teq - G.Tgrad * sl * sl - 6.5 * Math.max(h, 0) / 1000 * G.g + 8 * (clim(G, 0, p) - 0.5);
  const W = Math.min(1, Math.max(0, 0.5 + 0.3 * Math.cos(lat * 6.3) + 0.9 * (clim(G, 1, p) - 0.5) + G.wet));
  return { T, W, lat };
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function forestF(G, p, h, T, W) {                                   // how much of the ground the forest takes here (0..1)
  if (h < 2) return 0; const n = clim(G, 2, p) * 0.6 + clim(G, 3, p) * 0.4;
  return ss(0.3, 0.55, W) * ss(-9, -5, T) * Math.min(1, Math.max(0, (n - 0.3 + 0.25 * (W - 0.5)) * 4));
}
export function speciesW(G, T, W) { return G.species.map((s) => Math.exp(-(((T - s.T[0]) / s.T[1]) ** 2) - (((W - s.W[0]) / s.W[1]) ** 2))); }

// ---- tree sites: a lattice 7 m apart on each face of the cube around the planet (the face the site's own direction
// points most along), so every site has one home and its place never depends on where you look from ----------------
export const TREE = 7;
export const AX = [[1, 2], [2, 0], [0, 1]];                                // the two plane axes for each face axis
export function site(G, a, sg, i, j) {
  const [b, c] = AX[a], fk = a * 2 + (sg > 0 ? 1 : 0), xb = (i + 0.15 + 0.7 * hs2(i, j, 40 + fk)) * TREE, xc = (j + 0.15 + 0.7 * hs2(i, j, 50 + fk)) * TREE, d = G.R * G.R - xb * xb - xc * xc;
  if (d <= 0) return null; const xa = sg * Math.sqrt(d); if (Math.abs(xa) < Math.max(Math.abs(xb), Math.abs(xc))) return null;
  const p = [0, 0, 0]; p[a] = xa; p[b] = xb; p[c] = xc;
  const h = H(G, p, 26); const { T, W } = climate(G, p, h), F = forestF(G, p, h, T, W) * (1 - Math.min(1, cityRho(G, p) * citySuit(h, T, W, 0) * 2.5)); if (hs2(i, j, 60 + fk) > F || river(G, p, h, W) > 0.25) return null;
  const w = speciesW(G, T, W), tot = w.reduce((x, y) => x + y, 0); if (tot < 1e-3) return null;
  let x = hs2(i, j, 70 + fk) * tot, s = 0; while (s < w.length - 1 && x > w[s]) x -= w[s++];
  const nS = G.species[s].nSp, ri = Math.floor(i * TREE / 25000), rj = Math.floor(j * TREE / 25000), base = Math.floor(hs2(ri, rj, 90 + s + fk * 20) * nS), k = Math.floor(hs2(i, j, 75 + fk) ** 2 * 9);   // this region's few, commonest first
  return { p, h, sp: s, spc: species(G, s, (base + k * 61) % nS), seed: hs2(i, j, 80 + fk) };
}

// ---- cities: on inhabited planets, a few towns and cities in each 60 km cell of the cube faces, where the land
// suits them (low, not too steep, not desert or ice). rho is how built-up a place is (0..1): a city's core is 1.
export const CITY = 60000, LOT = 30;
export function cityRho(G, p) {
  if (!G.cities) return 0;
  const ab = p.map(Math.abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], fk = a * 2 + (p[a] > 0 ? 1 : 0), u = p[b] / CITY, v = p[c] / CITY;
  let r = 0; for (let i = Math.floor(u) - 1; i <= Math.floor(u) + 1; i++) for (let j = Math.floor(v) - 1; j <= Math.floor(v) + 1; j++) {
    if (hs2(i, j, 90 + fk) > 0.45) continue;
    const cx = i + 0.2 + 0.6 * hs2(i, j, 91 + fk), cy = j + 0.2 + 0.6 * hs2(i, j, 92 + fk), R = (1500 + 10000 * hs2(i, j, 93 + fk) ** 3) / CITY, d = Math.hypot(u - cx, v - cy) / R;
    if (d < 1) r = Math.max(r, (1 - d) ** 1.4);
  }
  return r;
}
export const citySuit = (h, T, W, sl) => ss(3, 12, h) * ss(900, 500, h) * ss(-4, 2, T) * ss(0.15, 0.3, W) * ss(0.25, 0.1, sl);

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
vec4 oct(int k, vec3 q) {
  vec4 A = OT(k, 0), B = OT(k, 1), C = OT(k, 2), D = OT(k, 3); mat3 M = rotO(k); vec3 du = M * q * D.z; float n; vec3 g;
  if (dot(du, du) < 4e-6) { vec3 hx = vec3(C.x, C.w, D.x), hy = vec3(C.w, C.y, D.y), hz = vec3(D.x, D.y, C.z); g = B.xyz + vec3(dot(hx, du), dot(hy, du), dot(hz, du)); n = dot(B.xyz, du) + .5 * dot(du, vec3(dot(hx, du), dot(hy, du), dot(hz, du))); }
  else { vec4 v = vnd3(A.xyz + du, k + uKs); if (D.w > .5) { float sg = sign(2. * v.x - 1.); n = 1. - abs(2. * v.x - 1.) - A.w; g = -2. * sg * v.yzw; } else { n = v.x - A.w; g = v.yzw; } }
  return vec4(n, (transpose(M) * g) * D.z);
}
// a climate row: just the value (absolute), no near field needed at its size
float clim(int i, vec3 q) { int k = ${K} + i; vec4 A = OT(k, 0), D = OT(k, 3); vec3 u = A.xyz + rotO(k) * q * D.z; return vnd3(u, k + uKs).x * .5 + vnd3(u * 2. + 17.3, k + uKs).x * .3 + vnd3(u * 4. + 41.7, k + uKs).x * .2; }
`;
// the octave table for the camera's foot p (planet metres, on the sphere) and frame F (3 columns: local x y z in
// planet axes), packed for uOct
export function octTable(G, p, F) {
  const rows = K + CLIM, T = new Float32Array(rows * 7 * 4);
  for (let k = 0; k < rows; k++) {
    const cl = k >= K, s = cl ? CL_S[k - K] : sOf(k), [ca, sa, cb, sb] = rotK(k), R = [[ca, -sa, 0], [cb * sa, cb * ca, -sb], [sb * sa, sb * ca, cb]];
    const M = R.map((row) => [0, 1, 2].map((c) => row[0] * F[c][0] + row[1] * F[c][1] + row[2] * F[c][2]));   // lattice from local
    const o = k * 28;
    if (cl) { const u = rot(k, p).map((v) => m256(v / s)); T.set([u[0], u[1], u[2], 0], o); T.set([0, 0, 1 / s, 0], o + 12); }
    else { const t = taylor(G, k, p); T.set([...t.u, t.f0], o); T.set([...t.g, G.amp[k]], o + 4); T.set([t.h[0], t.h[1], t.h[2], t.h[3]], o + 8); T.set([t.h[4], t.h[5], 1 / s, ridged(k) ? 1 : 0], o + 12); }
    T.set([M[0][0], M[0][1], M[0][2], M[1][0]], o + 16); T.set([M[1][1], M[1][2], M[2][0], M[2][1]], o + 20); T.set([M[2][2], masked(k) ? 1 : 0, 0, 0], o + 24);
  }
  return T;
}
// the ground below the camera-local point q, relative to the ground at the foot; the mountain belt mask is octave
// MASKK's ridge, applied to the masked octaves. Shared by every shader that stands things on the ground.
export const GLSL_GROUND = `
uniform float uMaskR, uM0;   // the belt strength, and the mask's value at the foot
float beltM(float n) { float b = 1. - abs(2. * n - 1.), t = clamp((b - .55) / .35, 0., 1.); return .25 + 1.6 * uMaskR * t * t * (3. - 2. * t); }
// dh: height above the foot's ground; g: its gradient; kc: finest octave cell to include (metres); returns the mask
float ground(vec3 q, float cmin, out float dh, out vec3 g) {
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
uniform vec3 uAxis; uniform float uTeq, uTgrad, uWet, uGrav;
vec3 climate(vec3 q, float h) {   // warmth (°C), wetness (0..1), latitude (radians)
  vec3 rad = normalize(q + vec3(0., uR, 0.)); float sl = dot(rad, uAxis), lat = asin(clamp(sl, -1., 1.));
  float T = uTeq - uTgrad * sl * sl - 6.5 * max(h, 0.) / 1000. * uGrav + 8. * (clim(0, q) - .5);
  float W = clamp(.5 + .3 * cos(lat * 6.3) + .9 * (clim(1, q) - .5) + uWet, 0., 1.);
  return vec3(T, W, lat);
}
uniform vec3 uFootP; uniform mat3 uFrm; uniform int uCities;
// how built-up the place at q is (see cityRho); and whether the land suits a town
float cityRho(vec3 q) {
  if (uCities == 0) return 0.; vec3 p = uFootP + uFrm * q, ab = abs(p); int a = ab.x >= ab.y && ab.x >= ab.z ? 0 : ab.y >= ab.z ? 1 : 2, b = a == 0 ? 1 : a == 1 ? 2 : 0, c = a == 0 ? 2 : a == 1 ? 0 : 1, fk = a * 2 + (p[a] > 0. ? 1 : 0);
  vec2 uv = vec2(p[b], p[c]) / ${CITY}.; ivec2 f = ivec2(floor(uv)); float r = 0.;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { ivec2 cc = f + ivec2(i, j); if (hs2(cc, 90 + fk) > .45) continue;
    vec2 ce = vec2(cc) + .2 + .6 * vec2(hs2(cc, 91 + fk), hs2(cc, 92 + fk)); float R = (1500. + 10000. * pow(hs2(cc, 93 + fk), 3.)) / ${CITY}., d = length(uv - ce) / R;
    if (d < 1.) r = max(r, pow(1. - d, 1.4)); }
  return r;
}
uniform float uRivC;   // the channel's depth fraction at the foot
float riverM(vec3 q, float h, float W, out float dist, out float wd) {
  wd = (8. + 70. * W * W) * smoothstep(.3, .45, W) * smoothstep(.5, 3., h) * (1. - smoothstep(1600., 2200., h)); dist = 1e9; if (wd <= 0.) return 0.;
  int k = ${K} + 4; vec4 A = OT(k, 0), D = OT(k, 3); vec3 u = A.xyz + rotO(k) * q * D.z; vec4 a = vnd3(u, k + uKs), b = vnd3(u * 2. + 11.3, k + uKs);
  float n = a.x * .7 + b.x * .3; vec3 g = a.yzw * .7 + b.yzw * .6; dist = abs(n - .5) / max(length(g) * D.z, 1e-12);
  return 1. - smoothstep(wd * .5, wd * 1.5, dist);
}
float citySuit(float h, float T, float W, float sl) { return smoothstep(3., 12., h) * smoothstep(900., 500., h) * smoothstep(-4., 2., T) * smoothstep(.15, .3, W) * smoothstep(.25, .1, sl); }
float forestF(vec3 q, float h, float T, float W, float fp) {
  if (h < 2.) return 0.; float n = mix(clim(2, q), .5, smoothstep(200., 700., fp)) * .6 + mix(clim(3, q), .5, smoothstep(60., 200., fp)) * .4;
  return smoothstep(.3, .55, W) * smoothstep(-9., -5., T) * clamp((n - .3 + .25 * (W - .5)) * 4., 0., 1.) * (1. - min(1., cityRho(q) * citySuit(h, T, W, 0.) * 2.5));
}
`;
