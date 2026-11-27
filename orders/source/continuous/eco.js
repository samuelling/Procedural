// The living world near you, kept as numbers that answer to each other. Nothing here is scripted: a birth, a hunt,
// a starved winter, a sapling getting its chance in a gap: each happens when the numbers bring it about.
//
// Animals. Each 1 km square of open country (a "range") keeps a herd of grazers and, where they hunt there, their
// predators: named individuals, female and male, born in spring to parents who must both be alive, ageing, and dying
// of age, of hunger in a bad year, or to the hunters. Each carries four genes from both parents with a little change:
// its size, its speed, its wariness and its coat. Selection is not written in, it falls out of the bookkeeping: the
// hunters catch the slow, the young and the old; big bodies hold heat in a cold winter but starve first when the grass
// is short; the wary are caught less but feed less, so have fewer young; speed costs condition. The coat does nothing,
// so it only drifts. The hunters live by their kills: a well-fed pack raises pups, a hungry one starves, a pack leaves
// country that has run out of prey and arrives where the herd has grown; their own speed is inherited too.
// Under them, the plants and the small things: grass that grows back with rain and warmth and is shared by the grazers
// and the insects, insects that eat grass and leaves, and birds that eat the insects; each a pool for the square, so the
// grazers compete with the insects for grass, and a summer of insects means more birds (and more birdsong). Where the
// wolves have killed, the herd keeps away for a year or two, so the seedlings there escape browsing (see the stands).
//
// Plants. Near you every tree is an individual (stands of 16 x 16 tree sites, 112 m across): it grows by the light
// that reaches it past taller neighbours and the water it gets in competition with every crown near it, and by its
// kind (a beech or fir grows on in shade where a birch or pine gives up); trees that cannot keep up die, stand as
// snags and fall; mature trees seed the ground round them, and a seed takes where there is light, water and room, and
// where the grazers do not eat it first. Fire, beaver ponds and insect years feed into the same sums.
//
// Lifespans, litters, speeds and the rest are sketched from the animals' natural history, not fitted; the dynamics are
// the textbook ones (logistic regrowth, a predator's kill rate that levels off as prey get common), not a calibrated
// model of any real place. Away from you nothing is computed; come back and the years you were gone are caught up.
import { AX, H, hs2, climate, forestF, cityRho, citySuit, river, site, siteP } from './planet.js';

const { floor, max, min, abs, hypot, sin, cos, sqrt, exp, atan2, PI } = Math, rnd = Math.random;
const rr = (a, b) => a + (b - a) * rnd(), cl = (v, a = 0, b = 1) => min(b, max(a, v)), gs = () => sqrt(-2 * Math.log(1 - rnd())) * cos(2 * PI * rnd());
export const HS = 1000, PATCH = 16, TREE = 7, TF = 0.04;   // TF: the share of a hunter's year spent on one range's herd (its territory is many ranges)
const NM1 = 'Al Bri Ca Da El Fa Ha Is Ka Li Mo Ne Or Ra Sa Ta Ur Va Wy Yo'.split(' '), NM2 = 'ba da ra na la ric wen mund ka so li th gar ne ya ro'.split(' ');

// ---- who lives where. A kind: name, plural, young, [female, male], lifespan (years), age of maturity, young a year,
// adult size (a red deer is 1), neck, body length, leg, coat, running speed (m/s); hunters also how many keep together
// and how many prey of a red deer's size each needs a year -----------------------------------------------------------
const A = (nm, pl, yg, sx, life, mat, lit, sz, neck, len, L, col, run, grp = 0, need = 0, more = {}) => ({ nm, pl, yg, sx, life, mat, lit, sz, neck, len, L, col, run, grp, need, ...more });
const G_ = {
  red: A('red deer', 'red deer', 'calf', ['hind', 'stag'], 15, 2, 1, 1, 0.55, 1.1, 1, [0.36, 0.19, 0.09], 13),
  wtd: A('white-tailed deer', 'white-tailed deer', 'fawn', ['doe', 'buck'], 10, 1.5, 1.6, 0.85, 0.5, 1, 1, [0.4, 0.25, 0.13], 13),
  elk: A('elk', 'elk', 'calf', ['cow', 'bull'], 15, 2, 1, 1.3, 0.55, 1.2, 1.05, [0.42, 0.3, 0.18], 13),
  bison: A('bison', 'bison', 'calf', ['cow', 'bull'], 20, 3, 1, 1.7, 0.25, 1.4, 0.75, [0.15, 0.09, 0.05], 15),
  cari: A('caribou', 'caribou', 'calf', ['cow', 'bull'], 15, 2, 1, 1.05, 0.45, 1.1, 1, [0.34, 0.3, 0.26], 15),
  rein: A('reindeer', 'reindeer', 'calf', ['cow', 'bull'], 15, 2, 1, 1, 0.45, 1.1, 0.95, [0.36, 0.32, 0.28], 15),
  musk: A('musk ox', 'musk oxen', 'calf', ['cow', 'bull'], 20, 3, 1, 1.3, 0.2, 1.2, 0.6, [0.1, 0.07, 0.05], 11),
  gnu: A('wildebeest', 'wildebeest', 'calf', ['cow', 'bull'], 20, 2, 1, 1.15, 0.45, 1.2, 1, [0.17, 0.15, 0.13], 20),
  guan: A('guanaco', 'guanacos', 'chulengo', ['female', 'male'], 20, 2, 1, 1, 1.3, 1, 1.1, [0.56, 0.38, 0.22], 15),
  brock: A('red brocket', 'red brockets', 'fawn', ['doe', 'buck'], 12, 1.5, 1, 0.6, 0.4, 0.9, 0.85, [0.45, 0.2, 0.08], 12),
  saiga: A('saiga', 'saiga', 'calf', ['female', 'male'], 10, 1, 1.7, 0.65, 0.35, 0.95, 0.9, [0.62, 0.5, 0.35], 20),
  chit: A('chital', 'chital', 'fawn', ['doe', 'stag'], 12, 1.5, 1, 0.8, 0.5, 1, 1, [0.52, 0.28, 0.11], 18, 0, 0, { spots: 1 }),
  sika: A('sika deer', 'sika deer', 'fawn', ['hind', 'stag'], 15, 1.5, 1, 0.75, 0.5, 1, 0.95, [0.4, 0.24, 0.12], 13, 0, 0, { spots: 1 }),
  roo: A('red kangaroo', 'red kangaroos', 'joey', ['doe', 'buck'], 15, 2, 1, 0.85, 0.5, 0.9, 1.1, [0.55, 0.3, 0.17], 15),
  mam: A('woolly mammoth', 'woolly mammoths', 'calf', ['cow', 'bull'], 60, 12, 0.25, 2.6, 0.3, 1.3, 0.9, [0.24, 0.13, 0.06], 10),
  hipp: A('Hipparion', 'Hipparion', 'foal', ['mare', 'stallion'], 20, 2, 1, 1, 0.65, 1.1, 1.05, [0.45, 0.35, 0.24], 16),
  eoh: A('dawn horse', 'dawn horses', 'foal', ['mare', 'stallion'], 8, 1, 1, 0.4, 0.4, 1, 0.9, [0.36, 0.25, 0.14], 9),
  saur: A('sauropod', 'sauropods', 'hatchling', ['female', 'male'], 70, 15, 3, 4, 2.6, 1.6, 0.9, [0.3, 0.3, 0.25], 5),
  arth: A('Arthropleura', 'Arthropleura', 'juvenile', ['female', 'male'], 6, 1.5, 3, 1, 0.01, 2.4, 0.3, [0.18, 0.07, 0.04], 1),
  any: A('grazer', 'grazers', 'calf', ['female', 'male'], 12, 2, 1, 1, 0.5, 1, 1, null, 13),
};
const H_ = {
  wolf: A('grey wolf', 'wolves', 'pup', ['she-wolf', 'wolf'], 10, 2, 5, 0.8, 0.15, 1, 1, [0.24, 0.22, 0.2], 14, 6, 15),
  lion: A('lion', 'lions', 'cub', ['lioness', 'lion'], 14, 3, 3, 1.1, 0.15, 1.1, 1, [0.6, 0.45, 0.25], 19, 7, 18),
  puma: A('cougar', 'cougars', 'kitten', ['female', 'male'], 12, 2.5, 2.5, 0.8, 0.15, 1.05, 0.95, [0.55, 0.42, 0.28], 18, 1, 22),
  jag: A('jaguar', 'jaguars', 'cub', ['female', 'male'], 12, 3, 2, 0.85, 0.15, 1.05, 0.9, [0.62, 0.45, 0.18], 18, 1, 20, { spots: 1 }),
  tiger: A('tiger', 'tigers', 'cub', ['tigress', 'tiger'], 14, 3.5, 3, 1.15, 0.15, 1.15, 1, [0.7, 0.38, 0.12], 17, 1, 30),
  dingo: A('dingo', 'dingoes', 'pup', ['female', 'male'], 9, 1.5, 5, 0.6, 0.15, 0.95, 1, [0.66, 0.45, 0.25], 15, 5, 14),
  clion: A('cave lion', 'cave lions', 'cub', ['lioness', 'lion'], 14, 3, 2.5, 1.2, 0.15, 1.1, 1, [0.6, 0.5, 0.35], 17, 4, 18),
  homo: A('Homotherium', 'Homotherium', 'cub', ['female', 'male'], 14, 3, 2.5, 1, 0.15, 1.05, 1.05, [0.55, 0.43, 0.3], 16, 4, 18),
  hyd: A('hyaenodont', 'hyaenodonts', 'pup', ['female', 'male'], 10, 1.5, 3, 0.5, 0.15, 1, 0.9, [0.3, 0.25, 0.2], 9, 2, 12),
  allo: A('Allosaurus', 'Allosaurus', 'hatchling', ['female', 'male'], 25, 10, 6, 2.2, 0.3, 1.3, 1.1, [0.32, 0.28, 0.2], 9, 2, 3),
  any: A('hunter', 'hunters', 'young', ['female', 'male'], 10, 2, 4, 0.8, 0.15, 1, 1, null, 14, 5, 15),
};
// which pair, from where on the Earth (degrees) and its climate, or from the age; on an invented world its own pair
function kinds(G, u, T, W) {
  if (G.fauna && G.fauna.none) return null;
  const E = G.E || 0;
  if (!G.real) return E === 310 ? [G_.arth, null] : E ? [{ ...G_.any, ...pick(E) }, E === 310 ? null : H_.any] : [G_.any, H_.any];
  const la = Math.asin(u[2]) * 180 / PI, lo = atan2(u[1], u[0]) * 180 / PI, In = (a, b, c, d) => la >= a && la <= b && lo >= c && lo <= d;
  if (E >= 310) return E === 310 ? [G_.arth, null] : null;
  if (E >= 150) return [G_.saur, H_.allo];
  if (E >= 50) return [G_.eoh, H_.hyd];
  if (E >= 3) return [G_.hipp, H_.homo];
  if (E > 0 && (T < 6 || abs(la) > 45)) return [G_.mam, In(10, 90, -170, -50) ? H_.wolf : H_.clion];
  if (In(-48, -34, 165, 180) || In(-26, -12, 43, 51) || In(63, 67, -25, -13)) return null;   // New Zealand, Madagascar, Iceland: no native grazing herds
  if (In(59, 84, -75, -10)) return [G_.musk, H_.wolf];                     // Greenland
  if (T < -3 || abs(la) > 60) return [lo < -30 && lo > -170 ? G_.cari : G_.rein, H_.wolf];
  if (In(-45, -10, 112, 155)) return [G_.roo, H_.dingo];
  if (In(30, 46, 129, 146)) return [G_.sika, null];                        // Japan: its wolves are gone
  if (In(15, 75, -170, -50)) return lo > -108 && lo < -95 && W < 0.55 ? [G_.bison, H_.wolf] : lo < -100 ? [G_.elk, H_.puma] : [G_.wtd, H_.wolf];
  if (In(-56, 15, -120, -30)) return la < -20 ? [G_.guan, H_.puma] : [G_.brock, H_.jag];
  if (In(-36, 36, -20, 52)) return [G_.gnu, H_.lion];
  if (In(34, 72, -12, 42)) return [G_.red, H_.wolf];
  if (In(-12, 32, 60, 150)) return [G_.chit, H_.tiger];
  if (In(35, 56, 42, 125) && W < 0.5) return [G_.saiga, H_.wolf];
  return [G_.red, H_.wolf];
}
const plural = (w) => w.replace(/f$/, 've') + 's';
const pick = (E) => ({ 0.02: { nm: 'woolly grazer', sz: 1.5 }, 3: {}, 50: { sz: 0.55 }, 150: { sz: 3.2, neck: 2.6, len: 1.6, life: 60, mat: 12 } })[E] || {};
export const kindsAt = kinds;

// ---- one animal ------------------------------------------------------------------------------------------------------
function born(R, k, hunter, age, mom, dad, x, z) {
  const gene = (i) => (mom ? (i === 3 ? cl((mom.gn[3] + dad.gn[3]) / 2 + gs() * 0.035) : cl((mom.gn[i] + dad.gn[i]) / 2 * exp(gs() * 0.05), 0.55, 1.7)) : i === 3 ? cl(0.5 + gs() * 0.08) : exp(gs() * 0.04));
  const d = { k, hunter, age, life: k.life * rr(0.7, 1.15), male: rnd() < 0.5, nm: NM1[(rnd() * 20) | 0] + NM2[(rnd() * 16) | 0], gn: [gene(0), gene(1), gene(2), gene(3)], gen: mom ? max(mom.gen, dad.gen) + 1 : 0,
    x: x ?? (mom ? mom.x : R.hx) + rr(-25, 25), z: z ?? (mom ? mom.z : R.hz) + rr(-25, 25), a: rnd() * 6.28, mode: 0, t: rr(1, 8), tg: null, v: 0, ph: rnd() * 9, sd: rnd(), dead: -1, why: '', run: 0, mom: mom || null };
  d.tg = [d.x, d.z]; (hunter ? R.pack : R.herd).push(d); return d;
}
const alive = (a) => a.filter((d) => d.dead < 0);
const adult = (d) => d.age >= d.k.mat;
export const who = (d) => (d.nm ? d.nm + ' the ' : 'a ') + (d.age < d.k.mat * 0.6 ? d.k.yg : d.k.sx[+d.male]), Who = (d) => who(d).replace(/^a /, 'A ');
const sizeAt = (d) => d.k.sz * d.gn[0] * (0.42 + 0.58 * min(1, d.age / d.k.mat));
const speedOf = (d) => d.k.run * d.gn[1] * (d.age < d.k.mat * 0.5 ? 0.82 : d.age > d.life * 0.85 ? 0.85 : 1);

export const drawn = [];
export function mkEco() {
  const ranges = new Map(), stands = new Map(), sites = new Map(), log = [];
  let near = [], gid = '', yearD = 365.2422, Sx = {};
  const say = (R, s) => { if (R.near) { log.push({ s, t: performance.now() }); if (log.length > 30) log.shift(); } R.ev.unshift(s); if (R.ev.length > 12) R.ev.pop(); };

  // ---- a range: its ground, its grass, insects and birds, and its animals, made when you first come near ---------------
  function range(G, a, sg, i, j) {
    const fk = a * 2 + (sg > 0 ? 1 : 0), key = `${fk}:${i}:${j}`; let R = ranges.get(key); if (R !== undefined) return R;
    const [b, c] = AX[a], p = [0, 0, 0]; p[b] = (i + 0.2 + 0.6 * hs2(i, j, 171 + fk)) * HS; p[c] = (j + 0.2 + 0.6 * hs2(i, j, 172 + fk)) * HS; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c];
    R = null;
    if (d > 0) { p[a] = sg * sqrt(d); const h = H(G, p, 20), cm = climate(G, p, h), u = p.map((v) => v / G.R);
      if (h > 0.5) { const fF = forestF(G, p, h, cm.T, cm.W), ok = cityRho(G, p) * citySuit(h, cm.T, cm.W, 0) < 0.05 && river(G, p, h, cm.W) < 0.1, kk = kinds(G, u, cm.T, cm.W);
        const gK = cl(cm.W * 1.5) * cl((cm.T + 8) / 22) * (1 - 0.7 * fF);    // how much grass the square grows
        R = { key, p, h, T: cm.T, W: cm.W, fF, gK, warm: cl((cm.T + 10) / 22), cold: cl((3 - cm.T) / 14), south: u[2] < 0, grass: 0.75, ins: 0.6, birds: 0.3, herd: [], pack: [], ev: [], fear: [], hx: 0, hz: 0, kp: 0, fed: 1, lean: 0, t: G.t, near: false, hunt: null, cool: rr(20, 90) };
        if (kk && ok && h > 2 && cm.T > -14 && cm.W > 0.15 && fF < 0.85) { R.g = kk[0]; R.h = kk[1];
          R.K = max(6, Math.round(60 * gK / R.g.sz ** 0.75)); const n = floor(R.K * rr(0.45, 0.85));
          for (let k = 0; k < n; k++) born(R, R.g, false, rr(0, R.g.life * 0.75) * rnd());
          if (n > 1) { R.herd[0].male = false; R.herd[1].male = true; R.herd[0].age = R.herd[1].age = R.g.mat * 1.5; }
          if (R.h && hs2(i, j, 174 + fk) < 0.6 && n > 6) { const np = R.h.grp > 1 ? 2 + floor(rnd() * (R.h.grp - 1)) : 1 + (rnd() < 0.5 ? 1 : 0); for (let k = 0; k < np; k++) { const w = born(R, R.h, true, k < 2 ? R.h.mat * rr(1.2, 2.5) : rr(0.5, R.h.life * 0.6), null, null, R.hx + rr(80, 160) * (k % 2 ? 1 : -1), R.hz + rr(-60, 60)); if (k < 2) w.male = !!k; } }
        }
      }
    }
    ranges.set(key, R); return R;
  }

  // ---- the books for one range, a step of dy years -------------------------------------------------------------------
  function step(R, dy, t0, wall) {
    const H0 = alive(R.herd), P0 = alive(R.pack), N = H0.length, Pa = P0.filter(adult).length, g = R.g, h = R.h;
    // grass, insects, birds: logistic regrowth; the grazers and the insects both eat the grass; the birds eat insects
    const q = R.grass / (R.grass + 0.25), eat = g ? H0.reduce((s, d) => s + sizeAt(d) ** 0.75, 0) * q / (100 * max(R.gK, 0.05)) : 0;
    R.grass = cl(R.grass + dy * (2.2 * R.grass * (1 - R.grass) * R.warm + 0.03 - eat - 0.45 * R.ins * R.grass), 0.01, 1);
    R.ins = cl(R.ins + dy * (R.ins * (2.6 * (0.6 * R.grass + 0.4 * R.fF) * R.warm - 1 - 1.7 * R.birds) + 0.02), 0.01, 3);
    R.birds = cl(R.birds + dy * (R.birds * (1.8 * R.ins / (R.ins + 0.6) - 0.9) + 0.01), 0.01, 2);
    if (!g) return;
    const yr = (t0 / yearD + (R.south ? 0.5 : 0)) % 1, yr1 = ((t0 + dy * yearD) / yearD + (R.south ? 0.5 : 0)) % 1, spring = yr < 0.4 && yr1 >= 0.4;
    for (const d of R.herd.concat(R.pack)) { if (d.dead >= 0) { d.dead += dy; continue; } d.age += dy;
      // the hazard of the year for this one
      const hz = d.hunter ? 0.05 + 0.9 * (1 - cl(R.fed)) ** 2 + 0.15 * max(0, d.gn[1] - 1) + 0.1 * max(0, d.gn[0] - 1)
        : 0.03 + 1.2 * (1 - q) ** 2 * d.gn[0] ** 1.4 * (0.75 + 0.25 * d.gn[1]) + R.cold * 0.35 * max(0, 1.35 - d.gn[0]) + (d.age < 1 ? 0.12 : 0) + max(0, N / R.K - 1.6) * 0.3;
      if (rnd() < 1 - exp(-(hz + (d.age > d.life ? 2 : 0)) * dy)) { d.dead = 0; d.mode = 9; d.why = d.age > d.life ? 'died of old age' : (d.hunter ? R.fed < 0.6 : q < 0.65) ? 'starved' : R.cold > 0.3 && !(yr > 0.4 && yr < 0.75) ? 'died in the winter' : d.age < 1 ? 'died young' : 'died'; if (d.nm && (d.age >= d.k.mat || rnd() < 0.2)) say(R, Who(d) + ' ' + d.why); }
    }
    // spring: the grazers' young, then the hunters'
    if (spring) {
      const males = H0.filter((d) => d.male && adult(d) && d.dead < 0); let nb = 0;
      if (males.length) for (const m of H0) if (!m.male && adult(m) && m.dead < 0 && rnd() < 0.9 * q * (1.2 - 0.2 * m.gn[2]) * cl(1.7 - N / R.K) && R.herd.length < 90) { const n = 1 + (rnd() < g.lit - 1 ? 1 : 0) + (g.lit > 2 && rnd() < g.lit - 2 ? 1 : 0); for (let k = 0; k < n; k++) { born(R, g, false, 0.01, m, males[(rnd() * males.length) | 0]); nb++; } }
      else if (H0.some((d) => !d.male && adult(d))) say(R, `No ${g.sx[1]} is left here, so no ${plural(g.yg)} are born`);
      if (nb) say(R, `${nb} ${nb > 1 ? plural(g.yg) + ' were' : g.yg + ' was'} born this spring`);
      if (h && Pa >= 2) { const f = P0.find((d) => !d.male && adult(d)), m = P0.find((d) => d.male && adult(d));
        if (f && m && R.fed > 0.45 && P0.length < max(2, h.grp * 1.3)) { const n = max(0, Math.round(h.lit * cl(R.fed) * rr(0.5, 1.2))); for (let k = 0; k < n; k++) born(R, h, true, 0.01, f, m); if (n) say(R, `${Who(f)} raised ${n} ${n > 1 ? plural(h.yg) : h.yg}`); }
        if (h.grp > 1 && Pa > h.grp * 1.2) { const y = P0.filter((d) => adult(d) && d.age < d.k.mat * 2).slice(0, 2); for (const d of y) R.pack.splice(R.pack.indexOf(d), 1); if (y.length) say(R, `${y.length > 1 ? 'Two young ' + h.pl : 'A young ' + h.nm} left to find ground of their own`); }
      }
    }
    // the hunters' kills: a rate that rises with the prey and levels off; who is caught is weighted to the slow,
    // the young and the old, and to the herd's less wary
    if (h && Pa) {
      R.kp += dy * Pa * h.need * TF * 1.25 / g.sz * N / (N + 5);
      R.fed = max(0, R.fed - dy * R.fed);
      while (R.kp >= 1 && N && !(R.near && wall)) { R.kp -= 1; const v = victim(R, alive(R.herd)); if (v) kill(R, v, null); else break; }
      if (N < 2) { R.lean += dy; if (R.lean > 0.5) { say(R, `The ${h.pl} moved on: there was nothing left to hunt`); R.pack = R.pack.filter((d) => d.dead >= 0); R.lean = 0; } } else R.lean = 0;
    } else if (h && !P0.length && N > 0.55 * R.K && rnd() < dy * 0.45) {
      const n = h.grp > 1 ? 2 + floor(rnd() * 2) : 1 + (rnd() < 0.5 ? 1 : 0); for (let k = 0; k < n; k++) { const w = born(R, h, true, rr(1, 2.5) * h.mat, null, null, R.hx + rr(-300, 300), R.hz + rr(-300, 300)); if (k < 2) w.male = !!k; }
      say(R, n > 1 ? `${n} ${h.pl} came in from outside` : `A ${h.nm} came in from outside`); R.fed = 0.8;
    }
    if (N < 2 && R.grass > 0.5 && rnd() < dy * 0.4) { for (let k = 0; k < 2; k++) born(R, g, false, rr(1.2, 3) * g.mat, null, null, R.hx + rr(-200, 200), R.hz + rr(-200, 200)).male = !!k; say(R, `Two ${g.pl} wandered in`); }
    // the dead are cleared away in a few weeks; the fear of a place fades in a year or two
    R.herd = R.herd.filter((d) => d.dead < 0.06); R.pack = R.pack.filter((d) => d.dead < 0.06);
    for (const f of R.fear) f.v -= dy * 0.7; R.fear = R.fear.filter((f) => f.v > 0);
    if (R.fear.length) { let bx = R.hx, bz = R.hz, bf = 9; for (let k = 0; k < 6; k++) { const x = rr(-250, 250), z = rr(-250, 250), f = fearAt(R, x, z) + hypot(x - R.hx, z - R.hz) / 400; if (f < bf) { bf = f; bx = x; bz = z; } } R.hx += (bx - R.hx) * cl(dy * 4); R.hz += (bz - R.hz) * cl(dy * 4); }
  }
  const fearAt = (R, x, z) => R.fear.reduce((s, f) => s + f.v * exp(-((x - f.x) ** 2 + (z - f.z) ** 2) / 12000), 0);
  function victim(R, H0) {
    let tot = 0; const w = H0.map((d) => { const v = (d.age < d.k.mat * 0.5 ? 2.5 : d.age > d.life * 0.8 ? 2 : 1) * exp(-3 * (d.gn[1] - 1) - 1.5 * (d.gn[2] - 1)); tot += v; return v; });
    let x = rnd() * tot; for (let k = 0; k < H0.length; k++) if ((x -= w[k]) <= 0) return H0[k]; return H0[H0.length - 1];
  }
  function kill(R, v, by) {
    v.dead = 0; v.mode = 9; v.why = 'killed'; R.fed += min(1, sizeAt(v) / R.g.sz) / max(0.3, alive(R.pack).filter(adult).length * R.h.need * TF / R.g.sz) * 1.6;
    R.fear.push({ x: v.x, z: v.z, v: 1.2 }); if (R.fear.length > 8) R.fear.shift();
    if (v.nm && (rnd() < 0.5 || by)) say(R, `${by ? Who(by) : `The ${R.h.pl}`} ${R.h.grp > 1 ? 'pulled down' : 'killed'} ${who(v)}`);
  }

  // ---- what they do, second by second, near you: graze, wander, rest; run from you and from the hunters; the hunters
  // patrol, stalk, chase and feed. A chase is decided by speed: the hunter's against its quarry's, from the start it got
  function behave(G, R, dt, cam) {
    const t = performance.now() / 1000, H0 = alive(R.herd), P0 = alive(R.pack), chase = R.hunt;
    const camD = (d) => hypot(d.x - cam[0], d.z - cam[1]);
    for (const d of H0) {
      let fx = 0, fz = 0, fear = 0;
      if (cam[2] < 25) { const dc = camD(d), fl = 32 * d.gn[2]; if (dc < fl) { fx += (d.x - cam[0]) / dc; fz += (d.z - cam[1]) / dc; fear = 1; } }
      for (const w of P0) { const dw = hypot(d.x - w.x, d.z - w.z), fl = (w.mode === 7 ? 70 : 28) * d.gn[2]; if (dw < fl) { fx += (d.x - w.x) / dw * 2; fz += (d.z - w.z) / dw * 2; fear = 1; } }
      if (fear || (chase && chase.v === d)) { d.mode = 2; d.a = atan2(fx, fz) || d.a; d.run = (d.run || 0) + dt; const v = speedOf(d) * (d.run > 12 ? 0.75 : 1) * (chase && chase.v === d ? chase.st : 1); d.x += Math.sin(d.a) * v * dt; d.z += Math.cos(d.a) * v * dt; d.v = v; d.t = rr(4, 9); continue; }
      d.run = 0;
      if ((d.t -= dt) < 0) { const r = rnd(); d.mode = r < 0.45 ? 0 : r < 0.85 ? 1 : 3; d.t = d.mode === 3 ? rr(20, 60) : rr(4, 20);
        if (d.mode === 1) { const a = rnd() * 6.28, rad = rr(10, 60); d.tg = [R.hx + cos(a) * rad, R.hz + sin(a) * rad]; if (ground(G, R, d.tg[0], d.tg[1]) < 1) d.tg = [d.x, d.z]; } }
      if (d.mode === 1) { const dx = d.tg[0] - d.x, dz = d.tg[1] - d.z, l = hypot(dx, dz); if (l < 1) d.mode = 0; else { d.a = atan2(dx, dz); d.v = 1.2 * d.gn[1]; d.x += dx / l * d.v * dt; d.z += dz / l * d.v * dt; } } else d.v = 0;
    }
    // the hunters
    if (!chase && P0.length && H0.length && (R.cool -= dt) < 0) {   // when hungry enough, the pack picks one and goes for it
      if (R.kp > 0.6 || rnd() < (R.kp < 0 ? 0.08 : 0.3)) { const v = victim(R, H0); R.hunt = { v, t: 0, st: rr(0.88, 1.08), phase: 0 }; } R.cool = rr(60, 200);
    }
    for (const w of P0) {
      if (R.hunt && R.hunt.v.dead < 0) {
        const v = R.hunt.v, dx = v.x - w.x, dz = v.z - w.z, l = hypot(dx, dz) || 1; w.a = atan2(dx, dz);
        const sp = l > 45 && R.hunt.phase === 0 ? 1.6 : speedOf(w); if (l <= 45) R.hunt.phase = 1; w.mode = R.hunt.phase ? 7 : 1; w.v = sp;
        w.x += dx / l * min(l, sp * dt); w.z += dz / l * min(l, sp * dt);
        if (l < 2) { kill(R, v, w); R.kp -= 1; R.hunt = null; for (const o of P0) { o.mode = 8; o.t = rr(40, 90); o.tg = [v.x + rr(-3, 3), v.z + rr(-3, 3)]; } break; }
        continue;
      }
      if (w.mode === 7) { w.mode = 1; w.t = rr(5, 15); }
      if ((w.t -= dt) < 0) { w.mode = w.mode === 8 ? 3 : rnd() < 0.5 ? 3 : 1; w.t = rr(10, 40); const a = rnd() * 6.28, rad = rr(90, 180); w.tg = [R.hx + cos(a) * rad, R.hz + sin(a) * rad]; }
      if (w.mode === 1 || w.mode === 8) { const dx = w.tg[0] - w.x, dz = w.tg[1] - w.z, l = hypot(dx, dz); if (l > 1.5) { w.a = atan2(dx, dz); w.v = 1.4 * w.gn[1]; w.x += dx / l * w.v * dt; w.z += dz / l * w.v * dt; } else w.v = 0; } else w.v = 0;
    }
    if (R.hunt) { R.hunt.t += dt; const v = R.hunt.v;
      if (v.dead >= 0) R.hunt = null;
      else if (R.hunt.phase && R.hunt.t > 30 || R.hunt.t > 90) { if (R.hunt.phase && v.nm) say(R, `${Who(v)} got away from the ${R.h.pl}`); R.hunt = null; }
    }
  }

  // ---- stands: every tree near you as a living thing --------------------------------------------------------------
  const SHADE = { Abies: 0.9, Picea: 0.8, Tsuga: 0.95, Fagus: 0.95, Acer: 0.8, Tilia: 0.8, Taxus: 0.95, Carpinus: 0.85, Thuja: 0.85, Ilex: 0.9, Sequoia: 0.7, Pseudotsuga: 0.5, Nothofagus: 0.6,
    Pinus: 0.25, Betula: 0.15, Larix: 0.15, Populus: 0.1, Salix: 0.15, Eucalyptus: 0.25, Quercus: 0.45, Juniperus: 0.3, Acacia: 0.2, Fraxinus: 0.4, Castanea: 0.5, Carya: 0.5, Liriodendron: 0.25, Platanus: 0.3, Adansonia: 0.2, Carnegiea: 0.2 };
  const tolOf = (G, sp) => { const f = G.species[sp]; return f ? SHADE[f.genus] ?? 0.5 : 0.5; };
  function stand(G, a, sg, pi, pj) {
    const fk = a * 2 + (sg > 0 ? 1 : 0), key = `${fk}:${pi}:${pj}`; let P = stands.get(key); if (P) return P;
    P = { key, a, sg, fk, pi, pj, t: G.t, list: [] };
    for (let i = pi * PATCH; i < (pi + 1) * PATCH; i++) for (let j = pj * PATCH; j < (pj + 1) * PATCH; j++) {
      const k = ((a * 2 + (sg > 0 ? 1 : 0)) * 2000003 + i) * 2000003 + j, t = site(G, a, sg, i, j);
      if (t) { t.W = climate(G, t.p, t.h).W; const s = { k, i, j, t, sp: t.sp, spc: t.spc, seed: t.seed, max: 0.75 + t.seed * 0.5, tol: tolOf(G, t.sp), hT: G.species[t.sp].h * t.spc.hM, sz: 0, age: 0, snag: -1, ok: 1, P };
        s.sz = s.max * rr(0.55, 1); s.age = rr(20, 160); sites.set(k, s); P.list.push(s); }
      else sites.set(k, { k, i, j, t: null, P, empty: 1 });
    }
    stands.set(key, P); return P;
  }
  function grow(G, P, dy, Rget) {                                            // a year (or less) in the life of a stand
    const nb = (s, r, f) => {                                                // the sites round one, found once (when all are loaded) and kept
      if (!s.nb) { const L = []; let all = 1; for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) { if (!di && !dj) continue; const o = sites.get(s.k + di * 2000003 + dj); if (o) L.push(o, hypot(di, dj) * TREE); else all = 0; } if (!all) { for (let k = 0; k < L.length; k += 2) { const o = L[k]; if (!o.empty && o.snag < 0) f(o, L[k + 1]); } return; } s.nb = L; }
      const L = s.nb; for (let k = 0; k < L.length; k += 2) { const o = L[k]; if (!o.empty && o.snag < 0) f(o, L[k + 1]); } };
    const R = Rget(P), browse = R && R.g ? 0.7 * min(1.5, alive(R.herd).length / R.K) : 0, def = R ? 1 - 0.3 * max(0, R.ins - 1) : 1, fire = Sx.fireAge;
    for (const s of P.list) {
      if (s.snag >= 0) { s.snag += dy; if (s.snag > 3 + s.seed * 5) { s.dead = 1; } continue; }
      if (fire) { const ba = fire(s.t.p); if (ba >= 0 && ba < dy * yearD + 1 && ba > 0.12) { s.snag = 0; continue; } }
      if (R && s.rk !== R.key) { const D = s.t.p.map((v, k) => v - R.p[k]); s.ex = D[0] * R.ea[0] + D[1] * R.ea[1] + D[2] * R.ea[2]; s.ez = D[0] * R.eb[0] + D[1] * R.eb[1] + D[2] * R.eb[2]; s.rk = R.key; }
      const hi = s.sz * s.hT; let shade = 0, dem = s.sz * s.sz;
      nb(s, 2, (o, d) => { const ho = o.sz * o.hT; if (ho > hi) shade += o.sz * o.sz * (1 - d / 17) * 0.55; if (d < 11) dem += o.sz * o.sz * (1 - d / 12); });
      const light = exp(-shade), water = min(1, (s.t.W ?? 0.6) * 4 / max(dem, 0.3)), v = (light ** (1 - 0.85 * s.tol)) * water * def;
      s.light = light; s.water = water; s.age += dy;
      s.sz = min(s.max, s.sz + dy * 0.05 * v * (1.15 - s.sz / s.max));
      const m = 0.004 + 0.14 * max(0, 0.2 - v) / 0.2 * (1 - 0.6 * s.tol) + 0.1 * max(0, 0.6 - water) + (s.age > 250 + 250 * s.tol ? 0.03 : 0) + (s.sz < 0.12 ? browse * (1 - (R ? min(1, fearAtP(R, s)) : 0)) * 0.5 : 0);
      if (rnd() < 1 - exp(-m * dy)) { if (s.sz < 0.15) s.dead = 1; else s.snag = 0; continue; }
      if (s.sz > 0.55 * s.max && v > 0.15 && rnd() < dy * 1.2) {             // a seed falls somewhere near
        const o = sites.get(s.k + floor(rr(-3, 4)) * 2000003 + floor(rr(-3, 4)));
        if (o && o.empty && !o.fail) { if (!o.t) { const q = siteP(G, a0(o), sg0(o), o.i, o.j); if (!q) { o.fail = 1; continue; } o.t = q; }
          let sh = 0; nb(o, 2, (n, d) => { sh += n.sz * n.sz * (1 - d / 17) * 0.55; });
          if (rnd() < o.t.F * 1.4 * exp(-sh) ** (1 - 0.85 * s.tol) * min(1, o.t.W * 3)) {
            Object.assign(o, { empty: 0, t: { p: o.t.p, h: o.t.h, W: o.t.W, sp: s.sp, spc: s.spc, seed: o.t.seed, F: o.t.F }, sp: s.sp, spc: s.spc, seed: o.t.seed, max: 0.75 + o.t.seed * 0.5, tol: s.tol, hT: s.hT, sz: 0.02, age: 0, snag: -1, born: 1 });
            P.list.push(o);
          }
        }
      }
    }
    if (P.list.some((s) => s.dead)) P.list = P.list.filter((s) => { if (!s.dead) return true; Object.assign(s, { empty: 1, dead: 0, snag: -1, sz: 0 }); return false; });
  }
  const a0 = (o) => o.P.a, sg0 = (o) => o.P.sg;
  const fearAtP = (R, s) => fearAt(R, s.ex ?? 0, s.ez ?? 0);

  return {
    log, ranges,
    // advance: dD days of the world's time and dt seconds of yours
    tick(G, S, F, dt, wall, camH) {
      Sx = S; const T0 = performance.now(); let T1 = T0;
      const id = G.id + ':' + (G.E || 0); if (id !== gid) { gid = id; ranges.clear(); stands.clear(); sites.clear(); }
      yearD = G.yearD || 365.2422; if (!G.species || !G.species.length || G.lifeless || S.hc > 6000 || S.cy > 2e5) { near = []; return; }
      const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1;
      // the ranges round you
      const i0 = floor(foot[b] / HS), j0 = floor(foot[c] / HS), nr = [];
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const R = range(G, a, sg, i, j); if (R) nr.push(R); }
      for (const R of near) R.near = false;
      near = nr;
      const ea = [0, 1, 2].map((k) => F[0][k]), eb = [0, 1, 2].map((k) => F[2][k]);
      for (const R of near) {
        R.near = true; R.ea = ea; R.eb = eb;
        // catch up the years since it was last seen, then this frame's share; a month a step at most
        let gap = (G.t - R.t) / yearD; if (gap > 300) gap = 300; let t0 = G.t - gap * yearD;
        while (gap > 1e-9) { const dy = min(gap, 1 / 12); step(R, dy, t0, wall && gap < 0.1); t0 += dy * yearD; gap -= dy; }
        R.t = G.t;
        const D = R.p.map((v, k) => v - foot[k]), cx = -(D[0] * ea[0] + D[1] * ea[1] + D[2] * ea[2]), cz = -(D[0] * eb[0] + D[1] * eb[1] + D[2] * eb[2]); R.cam = [cx, cz];
        if (R.g && wall && dt > 0) behave(G, R, min(dt, 0.1), [cx, cz, camH]);
      }
      T1 = performance.now();
      // the stands round you (within about 250 m), a few new ones a frame
      const pi0 = floor(foot[b] / TREE / PATCH), pj0 = floor(foot[c] / TREE / PATCH), here = []; let made = 0, bud = 2500;   // bud: tree-years a frame; a stand behind is caught up later
      for (let pi = pi0 - 2; pi <= pi0 + 2; pi++) for (let pj = pj0 - 2; pj <= pj0 + 2; pj++) {
        const key = `${a * 2 + (sg > 0 ? 1 : 0)}:${pi}:${pj}`; let P = stands.get(key); if (!P) { if (made++) continue; P = stand(G, a, sg, pi, pj); } here.push(P);
      }
      here.sort((x, y) => x.t - y.t);
      for (const P of here) { if (G.t - P.t > 200 * yearD) P.t = G.t - 200 * yearD;
        while ((G.t - P.t) / yearD >= 0.25 && bud > 0) { const dy = min((G.t - P.t) / yearD, 1); grow(G, P, dy, (P) => rangeOf(G, P)); P.t += dy * yearD; bud -= P.list.length + 1; } }
      this.prof = [T1 - T0, performance.now() - T1, made];
      if (sites.size > 120000) { for (const [k, P] of stands) if (abs(P.pi - pi0) > 3 || abs(P.pj - pj0) > 3) { for (let i = P.pi * PATCH; i < (P.pi + 1) * PATCH; i++) for (let j = P.pj * PATCH; j < (P.pj + 1) * PATCH; j++) sites.delete(((P.a * 2 + (P.sg > 0 ? 1 : 0)) * 2000003 + i) * 2000003 + j); stands.delete(k); } }
      if (ranges.size > 400) for (const [k, R] of ranges) if (!R || !R.near) { ranges.delete(k); if (ranges.size < 300) break; }
    },
    near: () => near, _step: (R, dy, t0) => step(R, dy, t0, false), _behave: behave,
    // a tree site as it stands now: undefined if this site is not in a stand being kept, null if nothing stands
    site(k) { const s = sites.get(k); if (!s) return undefined; if (s.empty) return null; return s; },
    birdsAt(p) { let best = null, bd = 4e6; for (const R of near) { const d = (R.p[0] - p[0]) ** 2 + (R.p[1] - p[1]) ** 2 + (R.p[2] - p[2]) ** 2; if (d < bd) { bd = d; best = R; } } return best ? best.birds / 0.3 : 1; },
    // what is here, in a line: the herd, the hunters, the grass, the insects, the birds, the stand
    here(S) {
      let R = null, bd = 9e12, Rg = null, bg = 2.6e6; const foot = S.foot; for (const r of near) { const d = (r.p[0] - foot[0]) ** 2 + (r.p[1] - foot[1]) ** 2 + (r.p[2] - foot[2]) ** 2; if (d < bd) { bd = d; R = r; } if (r.g && d < bg) { bg = d; Rg = r; } }
      if (!R) return ''; const R0 = R; R = Rg || R;
      const H0 = alive(R.herd), P0 = alive(R.pack), yg = H0.filter((d) => d.age < 1).length, gen = H0.length ? max(...H0.map((d) => d.gen)) : 0;
      const m = (i) => H0.length ? H0.reduce((s, d) => s + d.gn[i], 0) / H0.length : 1, pc = (v) => (v >= 1 ? '+' : '−') + abs(Math.round((v - 1) * 100)) + '%';
      let s = R.g ? `${H0.length} ${H0.length === 1 ? R.g.nm : R.g.pl}${yg ? ` (${yg} ${yg > 1 ? plural(R.g.yg) : R.g.yg})` : ''}` + (R.h ? `, ${P0.length} ${P0.length === 1 ? R.h.nm : R.h.pl}` : '') + (gen ? ` · generation ${gen}: size ${pc(m(0))}, speed ${pc(m(1))}, wariness ${pc(m(2))}` : '') + ' · ' : '';
      s += `grass ${Math.round(R0.grass * 100)}% · insects ${R0.ins.toFixed(1)} · birds ${(R0.birds / 0.3).toFixed(1)}×`;
      return s;
    },
    stand(S) { let n = 0, yg = 0, sn = 0, L = 0; for (const P of stands.values()) for (const s of P.list) { if (s.snag >= 0) sn++; else { n++; if (s.sz < 0.25) yg++; L += s.light ?? 1; } } return n ? `${n.toLocaleString()} trees near you, ${yg} young, ${sn} snags, ${Math.round(100 * L / n)}% of the light reaching the average crown` : ''; },
    look(i) { return drawn[i]; },
  };
  function rangeOf(G, P) { let best = null, bd = 9e12; const s = P.list[0]; if (!s) return null; const p = s.t.p; for (const R of near) { const d = (R.p[0] - p[0]) ** 2 + (R.p[1] - p[1]) ** 2 + (R.p[2] - p[2]) ** 2; if (d < bd) { bd = d; best = R; } } return best && bd < 2.5e6 ? best : null; }
  function ground(G, R, x, z) { const q = R.p.map((v, k) => v + R.ea[k] * x + R.eb[k] * z), l = hypot(...q); return H(G, q.map((v) => v / l * G.R), 16); }
}
