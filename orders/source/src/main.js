/* global TIER */
import { GENOMES, mutate, extra } from './genome.js';
import { build } from './grow.js';
import { rng } from './noise.js';
import { mkRenderer, pick } from './gl.js';
import { mkAudio } from './audio.js';
import { mkLife, MORE, succeed, mkFire } from './fx.js';
import { place, earthGenome, kg, KCOL, ready } from './earth.js';

const { sin, cos, tan, asin, min, max, round, exp, hypot, pow, PI } = Math, RAD = PI / 180, $ = (id) => document.getElementById(id);
const canvas = $('c'), clamp = (x, a, b) => min(b, max(a, x)), mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const coarse = matchMedia('(pointer: coarse)').matches, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const Q = coarse ? 0.5 : 1, F = 1 / tan(25 * RAD);

let R;
try { R = mkRenderer(canvas, coarse); } catch (e) { R = null; console.error(e); }
if (!R) { $('err').hidden = false; $('err').textContent = 'This needs WebGL 2, which this browser did not provide. Try a current Chrome, Safari, Firefox or Edge.'; throw new Error('no WebGL 2'); }

let key = 'mixed', seed = 4821, mut = 0, G, B, audio = null, sound = 0, day = 0.3, den = 1;
let yaw = 0, pitch = 0.03, rad = 13, tgt = [0, 0, 0], idle = 9, time = 0, scale = 1, ema = 0.016, fr = 0, dirty = 1;
const V = new Float32Array(16), LV = new Float32Array(16), SM = new Float32Array(16), IV = new Float32Array(9), K = [1, 1], keys = {}, eye = [0, 0, 0];
const f = { V, K, IV, cam: eye, SM, LV, LK: [1 / 58, 1 / 58], LNF: [1, 190], wd: [0.8, 0.6, 0.1], fog: [0.01, 0.07, 0], t: 0, moss: 0.3, focus: 10, shafts: 1, shadow: 1, wx: [0, 0, 0.3, 0], se: [0, 0, 0, 0], pts: [] };
// above the 20 kB rung: weather [cloud cover, fog, rain, snow], the season, and what lives here
const WXS = { clear: [0.3, 1, 0, 0], cloud: [0.76, 1.4, 0, 0], mist: [0.62, 4.5, 0, 0], rain: [1, 2.4, 1, 0], snow: [1, 2.6, 0, 1] }, WXN = Object.keys(WXS), SEA = ['Spring', 'Summer', 'Autumn', 'Winter'];
// the 2 MB rung keeps time: a clock that can stand still, run in days, in seasons or in decades; a chronicle of what
// happens; and an animal the camera can be told to follow
const TIMES = ['still', 'days', 'seasons', 'decades', 'millennia'];
let fire = null, world = null, smoke = 0, fireT = 0;
const env = { get stand() { return stand; }, get world() { return world; }, get fire() { return fire; } };   // what the animals can see of the forest
let fz = 0, fly = null, tap = [0, 0, 0], fp = 0, fd = 8;   // fp: walking in first person; fd: how far away the thing in the middle of the view is
// walking, as in Ashland: feet on the ground at wp, eyes 1.7 m up; gravity, a hop, trunks and boulders in the way, water that drags
const wp = [0, 0, 0], wv = [0, 0, 0], jv = [0, 0], EYE = 1.7;
let ong = 1, hov = 0, flo = 0, bob = 0, stepD = 0, sneak = 0, col = [], joy = null, joy0 = [0, 0];
const stick = () => { const j = $('joy'); j.hidden = joy === null; j.style.left = joy0[0] + 'px'; j.style.top = joy0[1] + 'px'; j.firstChild.style.transform = 'translate(' + jv[0] * 30 + 'px,' + jv[1] * 30 + 'px)'; };   // fz: looking closely at a point off the ground; fly: where the camera is easing to
let stand = null, clock = 0, dayPh = 0.33, yearF = 0.3, year = 1, decT = 0, fol = null, folI = -1;
// years of forest: growth, death and seeding; browsing by however many deer there are; the dam silts or rises; now and
// then, in a dry year, a fire that is over before anyone looks
const pass = (n) => {
  let ev = 0;
  for (let i = 0; i < n; i++) {
    year++; const e = { deer: LIFE.counts.deer || 0, year, deep: B.strm && B.strm.deep, fire, fear: LIFE.fear }; ev += succeed(stand, G, B, rng(seed + year * 7), say, e); if (e.mast) LIFE.fat = 1;
    fire.rest(1, stand); if (!LIFE.counts.beavers && world.dam > 0) { world.dam = max(0, world.dam - 0.06); ev++; }
    if (n > 1 && Math.random() < 0.016 * (1.4 - G.floor.moss)) { const t = stand[(Math.random() * stand.length) | 0]; fire.light(t.x, t.z); for (let k = 0; k < 400 && fire.n; k++) fire.step(1, f.wd, 0, Math.random, stand, G); say('Fire went through: ' + fire.killed + ' trees killed'); fire.killed = 0; ev++; }
  }
  return ev;
};
// the tape: before each stride the forest, its species, the dam and the cut ground are kept, so time can run backwards.
// The animals are not kept: they carry on as they are.
const tape = []; let rew = 0, ff = 0;
const spool = () => { tape.push({ year, stand: structuredClone([...stand]), trees: structuredClone(G.trees), hist: G.hist && structuredClone(G.hist), dam: world.dam, E: G.ero && G.ero.E && G.ero.E.slice(), ey: G.ero && G.ero.years }); if (tape.length > 400) tape.shift(); };
const unspool = (s) => { year = s.year; stand = s.stand; G.trees = s.trees; if (s.hist) G.hist = s.hist; world.dam = s.dam; if (s.E) { G.ero.E.set(s.E); G.ero.years = s.ey; G.ero.step(0); } grow(1, 1); };
// deep time: 250 years a stride. The stream cuts; trees whose ground fell away or went under water are lost; the forest
// lives 25 of those years, enough to fill the gaps
const deep = () => {
  const e = G.ero; spool(); const was = stand.map((t) => e.low(t.x, t.z)); e.step(250); e.years += 250;
  const n0 = stand.length; for (let i = stand.length - 1; i >= 0; i--) { const t = stand[i]; if (e.low(t.x, t.z) - was[i] > 0.6 || B.strm.lvl(t.x) > B.Hgt(t.x, t.z) + 0.2) stand.splice(i, 1); }
  if (stand.length < n0) say((n0 - stand.length) + ' trees went into the gorge'); year += 225; pass(25); grow(1, 1);
};
const strike = () => { const a = stand.filter((t) => !t.st && t.H > 8), t = a[(Math.random() * a.length) | 0]; if (!t) return; flash = 1; if (audio) audio.boom(); if (f.wx[0] < 0.5) { fire.light(t.x, t.z); fireT = 0; say('Lightning set ' + G.trees[t.si].nm.toLowerCase() + ' alight'); } else say('Lightning struck, but the wood was too wet to burn'); };
// the tree of life: each species a line from the year it arose to the year it was lost; a branch joins it to its parent
const tol = () => {
  const e = $('evo'); if (TIER < 4 || e.hasAttribute('hidden')) return;
  const H = G.hist || G.trees.map((s) => ({ nm: s.nm, born: 0, col: s.leaf.b })), rows = [], W = 300, L = 112, X = (y) => L + (W - L - 6) * y / max(year, 1);
  const dfs = (i) => { rows.push(i); H.forEach((h, j) => { if (h.par === i) dfs(j); }); }; H.forEach((h, i) => { if (h.par === undefined) dfs(i); });
  const Y = (i) => 9 + rows.indexOf(i) * 13, c = (h) => 'rgb(' + h.col.map((v) => round(255 * pow(clamp(v * 1.6, 0, 1), 0.4545))).join(' ') + ')';
  e.setAttribute('viewBox', '0 0 ' + W + ' ' + (rows.length * 13 + 14)); e.style.height = rows.length * 13 + 14 + 'px';
  e.innerHTML = rows.map((i) => { const h = H[i], x0 = X(h.born), x1 = X(h.gone || year);
    return (h.par !== undefined ? '<path d="M' + x0 + ' ' + Y(h.par) + 'V' + Y(i) + '" stroke="' + c(h) + '" stroke-dasharray="2 2"/>' : '') + '<path d="M' + x0 + ' ' + Y(i) + 'H' + x1 + '" stroke="' + c(h) + '" stroke-width="3"/>'
      + (h.gone && !h.to ? '<text x="' + (x1 + 2) + '" y="' + (Y(i) + 3) + '">†</text>' : '') + '<text x="' + (L - 4) + '" y="' + (Y(i) + 3) + '" text-anchor="end"' + (h.gone ? ' opacity=".5"' : '') + '>' + h.nm + '</text>'; }).join('')
    + '<text x="' + L + '" y="' + (rows.length * 13 + 11) + '">0</text><text x="' + (W - 6) + '" y="' + (rows.length * 13 + 11) + '" text-anchor="end">year ' + year + '</text>';
};
const say = (s) => { if (TIER < 4) return; const li = document.createElement('li'), L = $('log'); li.textContent = 'Year ' + year.toLocaleString() + (clock >= 3 ? '' : ', ' + SEA[season].toLowerCase()) + ' · ' + s; L.prepend(li); while (L.children.length > 4) L.lastChild.remove(); };
const snd = (k) => { if (TIER > 3 && audio && sound) audio.ev(k); };
let flash = 0, wx = 'clear', season = 1, LIFE = null, fogK = 1, night = 0, rainA = 0, snowA = 0;
if (TIER > 2) for (const k in MORE) { GENOMES[k].land.stream = MORE[k].stream; GENOMES[k].life = MORE[k].life; if (TIER > 3) GENOMES[k].floor.flower = MORE[k].flower; }
if (TIER > 3) { Object.assign(GENOMES, extra()); GENOMES.boreal.air.aur = GENOMES.larch.air.aur = 1; }

const m = (TIER > 3 ? /^#?([a-z]+)-(\d+)(?:-m(\d+))?(?:-d(\d+))?(?:@(-?[\d.]+),(-?[\d.]+),(\d+))?$/ : /^#?([a-z]+)-(\d+)(?:-m(\d+))?(?:-d(\d+))?$/).exec(location.hash);
let here = null;   // the place on Earth, once one is chosen
const earthAt = (lat, lon, climb) => { here = place(lat, lon, climb); if (here) GENOMES.earth = earthGenome(here, GENOMES, extra.pool); return here; };
if (TIER > 3 && m && m[1] === 'earth' && m[5]) { earthAt(+m[5], +m[6], +m[7]); ready.then(() => { if (key === 'earth' && earthAt(+m[5], +m[6], +m[7])) grow(); }); }   // grown at once from the sketch, then again from the measured grids as soon as they are in
if (m && GENOMES[m[1]]) { key = m[1]; seed = +m[2]; mut = +(m[3] || 0); den = clamp(+(m[4] || 100) / 100, 0.25, 2); }

function lookAt(M, e, t) {
  const fx = t[0] - e[0], fy = t[1] - e[1], fz = t[2] - e[2], fl = hypot(fx, fy, fz), d = [fx / fl, fy / fl, fz / fl], sl = hypot(d[2], d[0]), s = [-d[2] / sl, 0, d[0] / sl];
  const u = [s[1] * d[2] - s[2] * d[1], s[2] * d[0] - s[0] * d[2], s[0] * d[1] - s[1] * d[0]];
  M.set([s[0], u[0], -d[0], 0, s[1], u[1], -d[1], 0, s[2], u[2], -d[2], 0, -(s[0] * e[0] + s[1] * e[1] + s[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), d[0] * e[0] + d[1] * e[1] + d[2] * e[2], 1]);
}

// ---- the sun: where it is at this time of day, and what colour the light and the air are
function sun3() {
  const A = G.air, t0 = asin(pow((A.sun[0] - 6) / 62, 1 / 1.2)) / PI, dc = clamp(day, 0, 1), oc = TIER > 2 ? sstep(0.5, 1, f.wx[2]) : 0;
  let el = 6 + 62 * pow(sin(PI * dc), 1.2) - Math.abs(day - dc) * 160, az = (A.sun[1] + (day - t0) * 170) * RAD;   // past either end of the day the sun goes under
  if (TIER > 3 && G.cl) {                                                   // on Earth: the real sun for this latitude and season, the slider running from 3 in the morning to 9 at night
    const la = G.cl.lat * RAD, dl = 23.44 * sin(2 * PI * (yearF - 0.054)) * (G.cl.south ? -1 : 1) * RAD, H = (day * 18 + 3 - 12) * 15 * RAD, se = sin(la) * sin(dl) + cos(la) * cos(dl) * cos(H);   // the sun's declination through the year (year 0 the first of March, the start of spring); the season here is local
    el = asin(clamp(se, -1, 1)) / RAD; az = G.cl.az === 0 ? -Math.atan2(sin(H), cos(H) * sin(la) - Math.tan(dl) * cos(la)) : A.sun[1] * RAD + Math.atan2(sin(H), cos(H) * sin(la) - Math.tan(dl) * cos(la));   // a real place: south is +z, east +x, as on the range
  }
  const k = sstep(5, 38, el), grey = (c) => c.map((v) => v * (0.3 + 0.7 * k));
  night = TIER > 3 ? sstep(3, -7, el) : 0;
  if (night > 0.5) { el = 40; az += PI; }                                  // after dark the light is the moon's, from the other side
  el *= RAD; f.sun = [cos(el) * sin(az), sin(el), cos(el) * cos(az)];
  f.sunC = night > 0.5 ? [0.22, 0.3, 0.46].map((v) => v * (night * 2 - 1) * (1 - 0.7 * oc)) : mix3([3.6, 1.5, 0.45], [3.3, 3.1, 2.8], k).map((v) => v * (0.5 + 0.5 * k) * (1 - 0.84 * oc) * (1 - night * 2));
  f.skyC = mix3(mix3([0.1, 0.14, 0.32], A.sky, k), grey([0.4, 0.44, 0.5]), oc * 0.85); f.horC = mix3(mix3([0.95, 0.5, 0.26], A.haze, k).map((v) => v * (0.7 + 0.3 * k)), grey([0.6, 0.63, 0.66]), oc * 0.85);
  if (night > 0) { f.skyC = mix3(f.skyC, [0.012, 0.02, 0.05], night); f.horC = mix3(f.horC, [0.03, 0.045, 0.08], night); }
  f.se[2] = night * (A.aur ? 1.5 : 1);
  if (TIER > 3 && smoke > 0.01) { f.skyC = mix3(f.skyC, [0.28, 0.2, 0.14], smoke * 0.7); f.horC = mix3(f.horC, [0.55, 0.3, 0.12], smoke * 0.75); f.sunC = mix3(f.sunC, [1.6, 0.6, 0.2], smoke * 0.7); }   // smoke: a brown sky and a red sun
  if (TIER > 3 && flash > 0.01) { f.skyC = f.skyC.map((v) => v + flash * 2.5); f.horC = f.horC.map((v) => v + flash * 3); }   // lightning lights the whole sky
  f.shafts = min(1.5, G.air.fog * fogK * 75) * (0.6 + 0.6 * (1 - k)) * (1 - 0.7 * oc) * (1 - night * 0.6);
  if (TIER > 3 && G.world === 'lake') { f.sunC = f.sunC.map((v, i) => v * [0.45, 0.8, 0.75][i]); f.shafts *= 0.3; }   // under water the sunlight is green and its beams faint
}
function sun2() {
  const A = G.air, t0 = asin(pow((A.sun[0] - 6) / 62, 1 / 1.2)) / PI, el = (6 + 62 * pow(sin(PI * day), 1.2)) * RAD, az = (A.sun[1] + (day - t0) * 170) * RAD, k = sstep(5 * RAD, 38 * RAD, el);
  f.sun = [cos(el) * sin(az), sin(el), cos(el) * cos(az)];
  f.sunC = mix3([3.6, 1.5, 0.45], [3.3, 3.1, 2.8], k).map((v) => v * (0.5 + 0.5 * k));
  f.skyC = mix3([0.1, 0.14, 0.32], A.sky, k); f.horC = mix3([0.95, 0.5, 0.26], A.haze, k).map((v) => v * (0.7 + 0.3 * k));
  f.shafts = min(1.5, A.fog * 75) * (0.6 + 0.6 * (1 - k));
}
function setSun() {
  const A = G.air; if (TIER > 2) sun3(); else sun2();
  const C = [0, 12, 0], e = [C[0] + f.sun[0] * 95, C[1] + f.sun[1] * 95, C[2] + f.sun[2] * 95]; lookAt(LV, e, C);
  // world to shadow-map coordinates: the sun's view, squeezed into a unit cube
  const E = 58, n = f.LNF[0], d = f.LNF[1] - n;
  for (let c = 0; c < 4; c++) { SM[c * 4] = LV[c * 4] * 0.5 / E; SM[c * 4 + 1] = LV[c * 4 + 1] * 0.5 / E; SM[c * 4 + 2] = -LV[c * 4 + 2] / d; SM[c * 4 + 3] = 0; }
  SM[12] += 0.5; SM[13] += 0.5; SM[14] -= n / d; SM[15] = 1;
  dirty = 1;
  if (audio) audio.set(A.wind, TIER > 3 && G.life && !G.life.birds ? 0 : f.sun[1]);   // birds sing more the higher the sun; none where there are no birds
}

// ---- grow a plot from the current genome
function grow(keepView, aged) {
  if (!(TIER > 3 && aged)) G = mut ? mutate(GENOMES[key], rng(mut)) : GENOMES[key];   // a forest that has been living keeps the species it has evolved
  if (TIER > 3 && !aged) G = { ...G, trees: G.trees.map((s) => ({ ...s })) };
  if (TIER > 3 && !aged && !G.span && !G.world) f.pk = null;                // a new forest of your own: nothing is waiting any more
  if (TIER > 3 && !aged && G.span && f.si) { const s = f.si, l = s.log; G = { ...G, cl: s.cl, sd: l && (LAD.indexOf(G.world) > 1 || G.world === 'bark') ? l[0].sd : 0, oak: s.oak, home: f.pk && f.pk.G };   // a world further in or out is made of where you went from
    if (l && G.world === 'log') G.trees.push({ ...s.sp, n: 0 });
    if (l && G.world === 'bark') { const n = s.sp.nm.toLowerCase(); G.blurb = 'A unit here is a millimetre: a thousand times smaller, where the bark has come away from the fallen ' + n + ' you dived at.' + ([1, 5].includes(s.sp.leaf.t) ? '' : ' The galleries are drawn as a spruce engraver beetle cuts them; a ' + n + '’s own bark beetles cut theirs differently, and that is not drawn yet.'); } }        // this log's own wood and bark
  const t0 = performance.now(); if (TIER > 3 && !aged) world = { dam: 0, char: (x, z) => (fire ? fire.at(x, z) : 0) };
  if (TIER > 3 && aged) stand.world = world;                                 // the regrowth is told where it has burnt and how high the dam stands
  B = build(G, (TIER > 3 && G.sd) || seed, Q, den, TIER > 3 && aged ? stand : undefined);
  if (TIER > 3 && B.cave) { const c = B.cave; B.xm = c.meshes; B.ref = 2; B.Hgt = (x, z) => c.floorAt(x, B.ref, z); }   // in the cave the ground is whatever floor lies below you
  if (TIER > 3) f.cv = G.world === 'cave' ? [0, 1.3] : [0, 0];
  R.load(B, G);
  if (TIER > 3 && !aged) fire = mkFire(B.S, B.strm);
  if (TIER > 3) { col = B.trees.filter((t) => t.st < 2 && t.H > 1.5).map((t) => [t.x, t.z, 0.05 + 0.011 * t.H, B.Hgt(t.x, t.z) + t.H]); for (const a of B.rocks) for (let i = 0; i < a.length; i += 12) if (a[i + 3] > 0.35) col.push([a[i], a[i + 2], a[i + 3] * 0.8, a[i + 1] + a[i + 3] * 0.7]); }
  if (TIER > 3) { stand = B.trees; if (!aged && !f.pk) { year = 1; tape.length = 0; rew = 0; fol = null; $('log').textContent = ''; $('b-fol').textContent = 'Follow'; } }
  f.fog = [G.air.fog, TIER > 3 && G.world === 'lake' ? 0 : 0.07, 0]; f.moss = G.floor.moss; f.wd = [0.8, 0.6, G.air.wind * 0.18];
  if (!keepView) {
    day = asin(pow((G.air.sun[0] - 6) / 62, 1 / 1.2)) / PI; $('day').value = round(day * 1000);
    tgt = [B.open[0], 0, B.open[1]]; rad = 9; pitch = 0.03; yaw = (G.air.sun[1] + 180 + 28) * RAD;      // start low among the trunks, looking toward the light
    if (TIER > 3 && G.world) { tgt = G.world === 'range' && B.spot ? B.spot : [0, 0, 0]; rad = G.world == 'leaf' ? 80 : G.world == 'range' ? 72 : 38; pitch = G.world == 'leaf' ? 0.75 : G.world == 'range' ? 0.5 : 0.42; }
    if (TIER > 3 && G.world === 'lake') { tgt = [6, -6, 4]; rad = 10; pitch = 0.06; }   // on the lake bed, looking along it
  }
  if (TIER > 2) { if (TIER > 3 && aged && LIFE) LIFE.world(B); else LIFE = mkLife(B, G, rng(seed + 7), coarse, say, snd, env); if (!keepView && B.strm) { yaw = (tgt[2] > B.strm.zc(tgt[0]) ? 0 : PI) + 0.3; pitch = 0.17; rad = 11; } }
  if (TIER > 3 && G.world === 'cave' && !keepView) { const s = B.cave.start; fp = 0; B.ref = B.cave.floorAt(s[0], 8, s[1]) + 1; eye[0] = s[0]; eye[2] = s[1]; walking(1); yaw = s[2]; pitch = 0.05; }   // you start on your feet just inside the way in, lamp lit, facing down it
  setSun();
  $('l1').textContent = G.nm + (mut ? ' · mutant ' + mut : '') + ' · seed ' + seed;
  $('l2').textContent = JSON.stringify(GENOMES[key]).length.toLocaleString() + ' bytes of genome → ' + B.st.trees + ' trees · ' + (B.st.wood / 1000).toFixed(1) + ' km of wood · '
    + (B.cards.length / 12).toLocaleString() + ' leaf clusters, fronds and tufts · ' + B.st.rocks + ' stones'
    + (TIER > 2 ? ' · ' + Object.entries(LIFE.counts).filter((e) => e[1]).map((e) => e[1] + ' ' + e[0]).join(' · ') : '') + ' · grown in ' + round(performance.now() - t0) + ' ms';
  if (TIER > 3 && G.cl) $('l2').textContent = G.cl.txt + ' · ' + B.st.trees + ' trees';
  if (TIER > 3 && G.span) $('l2').textContent = (G.blurb || 'A unit here is a millimetre: the same grammar, a thousand times smaller.') + ' ' + G.span + ' across.';
  const css = (c) => 'rgb(' + c.map((v) => round(255 * pow(clamp(v * 1.6, 0, 1), 0.4545))).join(' ') + ')';
  if (TIER > 3) tol();
  $('lg').innerHTML = G.trees.map((s) => '<li><i style="background:' + css(s.leaf.b) + '"></i>' + (TIER > 3 ? (s.gone ? '<s>' + s.nm + '</s>' : s.nm) + (s.par ? ' <small>← ' + s.par.toLowerCase() + ', year ' + s.born + '</small>' : '') : s.nm) + '</li>').join('');
  for (const b of document.querySelectorAll('[data-g]')) b.setAttribute('aria-pressed', b.dataset.g === key);
  try { history.replaceState(null, '', '#' + key + '-' + seed + (mut ? '-m' + mut : '') + (den !== 1 ? '-d' + round(den * 100) : '') + (TIER > 3 && key === 'earth' ? '@' + here.lat + ',' + here.lon + ',' + here.climb : '')); } catch (e) { /* the frame may refuse; the page works without it */ }
}

// ---- camera: orbits a point that walks on the ground
const inside = (x, z) => Math.abs(x) < B.S / 2 && Math.abs(z) < B.S / 2;
function view() {
  if (TIER > 3 && fp) {                                                     // walking: the eye is where you stand, and looks where you turn
    const cp = cos(pitch), b = Math.abs(sin(bob)), h = EYE * (sneak ? 0.82 : 1);
    eye[0] = wp[0] + cos(yaw) * sin(bob) * 0.012; eye[1] = wp[1] + h + b * 0.045 - 0.02; eye[2] = wp[2] - sin(yaw) * sin(bob) * 0.012;   // the head rises and sways a little with each step
    if (TIER > 3) eye[1] = min(eye[1], G.world === 'lake' ? -0.2 : B.cave ? B.cave.ceilAt(eye[0], wp[1] + 0.3, eye[2]) - 0.15 : 1e9);   // under the water, under the roof
    lookAt(V, eye, [eye[0] - sin(yaw) * cp, eye[1] - sin(pitch), eye[2] - cos(yaw) * cp]); IV.set([V[0], V[4], V[8], V[1], V[5], V[9], V[2], V[6], V[10]]);
    tgt[0] = wp[0]; tgt[2] = wp[2]; return;
  }
  if (TIER > 3 && B.cave) B.ref = tgt[1] + 0.5;
  const gy = B.Hgt(tgt[0], tgt[2]) + 1.5; if (!(TIER > 3 && fz)) tgt[1] += (gy - tgt[1]) * 0.2;
  // above the horizon the eye orbits the point; below it the eye stays level and the gaze tilts up into the canopy
  const up = max(pitch, 0), cp = cos(up); eye[0] = tgt[0] + rad * cp * sin(yaw); eye[1] = tgt[1] + rad * sin(up); eye[2] = tgt[2] + rad * cp * cos(yaw);
  if (inside(eye[0], eye[2])) eye[1] = max(eye[1], B.Hgt(eye[0], eye[2]) + 0.35);
  if (TIER > 3 && G.world === 'lake') eye[1] = min(eye[1], -0.25);
  lookAt(V, eye, [tgt[0], tgt[1] + rad * tan(max(-pitch, 0)), tgt[2]]); IV.set([V[0], V[4], V[8], V[1], V[5], V[9], V[2], V[6], V[10]]);
}
const walk = (r, fw) => {   // along the ground: right and forward as the camera sees them
  const fx = -V[2], fz2 = -V[10], l = hypot(fx, fz2) || 1, h = B.S / 2 - 0.5;
  if (TIER > 3) { fz = 0; fly = null; if (fp) return; }
  tgt[0] = clamp(tgt[0] + V[0] * r + fx / l * fw, -h, h); tgt[2] = clamp(tgt[2] + V[8] * r + fz2 / l * fw, -h, h);
};
const perPx = () => rad / (F * canvas.clientHeight / 2);
// walking (2 MB rung): WASD to move, the mouse to look; Space and C to rise and sink, Shift to run
const walking = (on) => {
  if (!(on ^ fp)) return; const d = [-V[2], -V[6], -V[10]];
  if (on) { fp = 1; wp[0] = clamp(eye[0], -B.S / 2 + 0.5, B.S / 2 - 0.5); wp[2] = clamp(eye[2], -B.S / 2 + 0.5, B.S / 2 - 0.5); wp[1] = B.Hgt(wp[0], wp[2]); wv.fill(0); ong = 1; hov = 0; yaw = Math.atan2(-d[0], -d[2]); pitch = clamp(asin(-d[1]), -1.2, 1.2); fz = 0; fly = null; fol = null; $('b-fol').textContent = 'Follow'; }
  else { fp = 0; flo = 0; if (document.pointerLockElement) document.exitPointerLock(); tgt = [clamp(wp[0] - sin(yaw) * 3, -B.S / 2, B.S / 2), wp[1] + EYE, clamp(wp[2] - cos(yaw) * 3, -B.S / 2, B.S / 2)]; rad = 3; pitch = max(0.03, pitch); fz = 1; }
  $('b-walk').setAttribute('aria-pressed', !!fp); $('hint').textContent = fp ? HW : HO; $('hint').hidden = false; idle = 0;
};
// double-tap or double-click anything to fly up to it: the depth under the finger gives the point, and the camera
// settles a hand's breadth away, focused on it
const look = (x, y) => {
  const r = canvas.getBoundingClientRect(), u = (x - r.left) / r.width, v = 1 - (y - r.top) / r.height, z = pick(u, v); if (!(z > 0.12 && z < 250)) return;
  const vx = (u * 2 - 1) / K[0] * z, vy = (v * 2 - 1) / K[1] * z, p = [0, 1, 2].map((i) => eye[i] + IV[i] * vx + IV[i + 3] * vy - IV[i + 6] * z), b = [eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]], l = hypot(...b);
  const rr = clamp(z * 0.2, 0.22, 4); fol = null; idle = 0;
  if (fp) { hov = 1; wv.fill(0); fly = [[p[0] + b[0] / l * rr, p[1] + b[1] / l * rr - EYE * (sneak ? 0.82 : 1), p[2] + b[2] / l * rr], rad, Math.atan2(b[0], b[2]), asin(b[1] / l)]; return; }
  fz = 1; fly = [p, rr, Math.atan2(b[0], b[2]), max(0.02, asin(b[1] / l))];
};

// ---- frame
let prev = performance.now();
function frame(now) {
  const dt = min(0.1, max(0, (now - prev) / 1000)); prev = now;
  ema += (dt - ema) * 0.05;
  if (++fr % 40 === 0) { if (ema > 0.034 && scale > 0.45) scale *= 0.85; else if (ema < 0.015 && scale < 1) scale = min(1, scale * 1.12); }
  const dpr = min(devicePixelRatio || 1, 2) * scale, w = max(2, round(canvas.clientWidth * dpr)), h = max(2, round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  K[0] = F * h / w; K[1] = F; time += dt; f.t = calm ? 0 : time;
  idle += dt; if (idle > 6 && !calm) yaw += dt * 0.025;
  const sp = max(2, rad * 0.6) * dt, kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), kf = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (kx || kf) { walk(kx * sp, kf * sp); idle = 0; }
  if (TIER > 3 && fp) {
    if (B.cave) B.ref = wp[1] + 1.2;                                        // in the cave, the floor that counts is the one under your feet
    let fx = kx + jv[0], fw = kf - jv[1]; const run = keys.ShiftLeft || keys.ShiftRight || hypot(jv[0], jv[1]) > 0.92, n = hypot(fx, fw) || 1, st = B.strm;
    sneak = !run && (keys.KeyZ || (hypot(jv[0], jv[1]) > 0.12 && hypot(jv[0], jv[1]) < 0.55)) ? 1 : 0;
    if (fx || fw || keys.Space) { fly = null; if (hov && !flo) { hov = 0; ong = 0; } idle = 0; }
    const depth = st ? max(0, st.lvl(wp[0]) - B.Hgt(wp[0], wp[2])) * (st.dist(wp[0], wp[2]) < 0 ? 1 : 0) : 0, sp = (run ? 6.2 : sneak ? 1.6 : 3.6) * (depth > 0.2 ? 1 - min(0.5, depth * 0.4) : 1) * (flo ? 1.6 : 1);
    const tx = (-sin(yaw) * fw + cos(yaw) * fx) / n * sp * min(1, n), tz = (-cos(yaw) * fw - sin(yaw) * fx) / n * sp * min(1, n), gr = min(1, dt * 12);
    wv[0] += (tx - wv[0]) * gr; wv[2] += (tz - wv[2]) * gr;
    const h = B.S / 2 - 0.4, deep = (x, z) => st && st.dist(x, z) < 0 && st.lvl(x) - B.Hgt(x, z) > 1.15 && !flo;
    let nx = clamp(wp[0] + wv[0] * dt, -h, h), nz = clamp(wp[2] + wv[2] * dt, -h, h);
    if (TIER > 3 && !G.world && (deep(nx, wp[2]) || deep(nx, nz))) { under('lake'); nx = wp[0]; nz = wp[2]; }   // walk into deep water and you go under
    if (deep(nx, wp[2])) nx = wp[0]; if (deep(nx, nz)) nz = wp[2];
    if (TIER > 3 && B.mouth && hypot(nx - B.mouth[0], nz - B.mouth[1]) < 1.7) under('cave');   // into the cave mouth
    if (TIER > 3 && !flo) { if (B.Hgt(nx, wp[2]) > wp[1] + 1.1) nx = wp[0]; if (B.Hgt(nx, nz) > wp[1] + 1.1) nz = wp[2]; }   // a rise of more than a metre is a cliff: you can drop down one, not walk up it                       // deep water is not for walking into
    for (const c of col) if (wp[1] < c[3]) { const dx = nx - c[0], dz = nz - c[1], d = hypot(dx, dz), m = c[2] + 0.3; if (d < m) { nx = c[0] + dx / (d || 1e-4) * m; nz = c[1] + dz / (d || 1e-4) * m; } }   // round trunks and boulders: slide past them
    const moved = hypot(nx - wp[0], nz - wp[2]); wp[0] = nx; wp[2] = nz;
    const g = B.Hgt(nx, nz);
    if (flo || hov) { if (flo) wp[1] += ((keys.Space || keys.KeyE ? 1 : 0) - (keys.KeyC || keys.KeyQ ? 1 : 0)) * sp * dt; wp[1] = clamp(wp[1], g, 60); wv[1] = 0; ong = wp[1] <= g + 0.01; }
    else if (!ong || wp[1] > g + 0.03) { wv[1] -= 14 * dt; wp[1] += wv[1] * dt; if (wp[1] <= g) { wp[1] = g; if (!ong && wv[1] < -3 && audio && audio.step) audio.step(depth > 0.1 ? 4 : 2, 1); wv[1] = 0; ong = 1; } else if (wp[1] > g + 0.12) ong = 0; }
    else wp[1] += (g - wp[1]) * min(1, dt * 18);                                                                        // step up and down the ground gently
    if (ong && !flo && moved / max(dt, 1e-4) > 0.5) {                                                                     // footsteps: what is underfoot decides how they sound
      bob += moved * (run ? 2.6 : 3.4); stepD += moved;
      if (stepD > (run ? 1.05 : 0.72)) { stepD = 0; const tw = !sneak && Math.random() < 0.04; if (audio && audio.step) audio.step(depth > 0.05 ? 4 : f.wx[1] > 0.5 ? 3 : Math.random() < G.floor.la * 0.6 + (season === 2 ? 0.35 : 0) ? 1 : 0, (run ? 1.3 : sneak ? 0.35 : 0.8) + (tw ? 1 : 0), tw); if (tw) LIFE.noise = 2.5; }
    } else bob *= 0.9;
    LIFE.noise = max(LIFE.noise * 0.97, !(fx || fw) ? 0.45 : sneak ? 0.5 : run ? 1.6 : 1);                          // how close the animals let you come
    if (fr % 10 === 0) { const z = pick(0.5, 0.5); if (z > 0.1 && z < 250) fd = z; }                                   // focus on whatever is in the middle of the view
  }
  let yrs = 0, moved = 0;
  if (TIER > 3) {
    if (clock === 1 || clock === 2) {                                      // a day is an eighth of a year: the sun crosses, night falls, seasons turn
      const YL = clock === 1 ? 480 : 64, y0 = Math.floor(yearF); yrs = dt / YL; dayPh = (dayPh + dt * 8 / YL) % 1; day = dayPh < 0.75 ? -0.12 + dayPh / 0.75 * 1.24 : 1.12; $('day').value = round(day * 1000); moved = 1;
      yearF += yrs; const se = Math.floor((yearF % 1) * 4); if (se !== season) setSea(se);
      if (Math.floor(yearF) > y0) { if (f.pk) year++; else if (pass(1)) grow(1, 1); }                   // the trees are a year older too
    } else if (rew) { if ((decT += dt) > 0.6) { decT = 0; const s = tape.pop(); if (s) unspool(s); if (!tape.length) { rew = 0; $('b-rw').setAttribute('aria-pressed', 'false'); say('Back at the start of the tape'); } } }   // running the tape backwards
    else if (clock === 3 && (decT += dt) > [3, 0.8, 0.25][ff]) { decT = 0; if (f.pk) year += 5; else { spool(); pass(5); LIFE.lapse(5); grow(1, 1); } }   // five years at a stride, for the animals too
    else if (clock === 4 && (decT += dt) > [2.5, 0.9, 0.35][ff]) { decT = 0; if (f.pk) year += 250; else deep(); }
    if (fol) { if (fol.mode === 9 && fol.dead > 12) { fol = null; $('b-fol').textContent = 'Follow'; } else { tgt[0] = clamp(fol.x, -B.S / 2, B.S / 2); tgt[2] = clamp(fol.z, -B.S / 2, B.S / 2); idle = 0; } }
    if (LIFE.dirty) { LIFE.dirty = 0; grow(1, 1); }                         // a beaver felled something
    if (fire.n) {                                                          // fire: it runs on the wind until rain, water or burnt ground stops it
      fire.step(dt, f.wd, f.wx[0], Math.random, stand, G); fireT += dt;
      if (!fire.n) { say('The fire burned out: ' + fire.killed + ' trees killed'); fire.killed = 0; grow(1, 1); } else if (fireT > 6) { fireT = 0; grow(1, 1); }
    }
    smoke += (min(1, fire.n / 25) - smoke) * min(1, dt * 0.5);
    if (fr % 30 === 0) { const gn = LIFE.genes(); $('l3').textContent = 'Year ' + year + ' · ' + SEA[season] + ' · ' + Object.entries(LIFE.counts).map((e) => e[1] + ' ' + e[0]).join(' · ') + ' · ' + stand.filter((t) => !t.st && t.H >= 5).length + ' trees' + (gn ? ' · ' + gn : ''); }
  }
  if (TIER > 3 && fly) { const e = 1 - exp(-min(dt, 0.1) * 5); for (let i = 0; i < 3; i++) (fp ? wp : tgt)[i] += (fly[0][i] - (fp ? wp : tgt)[i]) * e; rad += (fly[1] - rad) * e; if (fp && hypot(fly[0][0] - wp[0], fly[0][1] - wp[1], fly[0][2] - wp[2]) < 0.004) fly = null; yaw += (((fly[2] - yaw + PI * 3) % (PI * 2)) - PI) * e; pitch += (fly[3] - pitch) * e; dirty = 1; if (Math.abs(fly[1] - rad) < 0.003) fly = null; }
  view();
  if (TIER > 2) {                                                          // weather moves toward what was asked for; rain wets, snow settles, both pass slowly
    const w = WXS[wx], go = (i, to, r) => { const d = to - f.wx[i]; f.wx[i] += clamp(d, -r * dt, r * dt); return Math.abs(d) > 1e-3; };
    let ch = go(2, w[0], 0.12); ch = go(0, w[2], w[2] ? 0.3 : 0.04) || ch; ch = go(1, max(w[3], TIER > 3 && G.cl && G.cl.tl ? 0.95 * clamp(-mon() / 3, 0, 1) * clamp(G.cl.Pa / 300, 0.2, 1) : season === 3 ? 0.95 * (TIER > 3 && G.cl ? G.cl.snow : 1) : 0), w[3] ? 0.08 : 0.03) || ch;   // on Earth, snow lies when this month freezes
    const d = w[1] - fogK; if (Math.abs(d) > 1e-3) { fogK += clamp(d, -dt * 0.7, dt * 0.7); ch = 1; } f.fog[0] = G.air.fog * fogK * (1 + 5 * smoke); if (smoke > 0.01) ch = 1;
    rainA += clamp(w[2] - rainA, -dt * 0.5, dt * 0.5); snowA += clamp(w[3] - snowA, -dt * 0.5, dt * 0.5); f.wx[3] = rainA;
    if (TIER > 3) { if (rainA > 0.8 && Math.random() < dt * 0.09) { flash = 1; if (audio) audio.boom(); } if (flash > 0.01) { flash *= Math.exp(-dt * 7) * (Math.random() < 0.3 ? 1.6 : 1); flash = min(flash, 1); ch = 1; } }
    if (ch || moved) setSun();
    const wa = 0.64 + 0.7 * sin(time * 0.017), ws = G.air.wind * (1 + 1.6 * rainA + 0.8 * snowA + (wx === 'cloud' ? 0.4 : 0)); f.wd[0] = cos(wa); f.wd[1] = sin(wa); f.wd[2] = ws * 0.18;   // the wind backs and veers, and rises with the weather
    f.pts.length = 0;
    if (rainA > 0.01) f.pts.push([1, 0.011, rainA, coarse ? 2500 : 6000]);
    if (snowA > 0.01) f.pts.push([2, 0.03, snowA, coarse ? 2500 : 5000]);
    if (TIER > 3) {
      if (night > 0.2 && season < 2 && !w[2]) f.pts.push([3, 0.1, night, 400]);            // fireflies on warm nights
      if (season === 2) f.pts.push([4, 0.055, 1, coarse ? 250 : 600]);                       // leaves coming down
      if (season < 2 && night < 0.5 && rainA < 0.1) f.pts.push([5, 0.018, 0.6 * (1 - night * 2), 500]);   // seeds and midges in the light
    }
    R.life(LIFE.out, LIFE.step(calm ? 0 : dt, time, eye, night, yrs, season, f.wx[1]));
    if (audio && fr % 12 === 0) { audio.set(ws, 1 - night); audio.fx(rainA, B.strm ? clamp(1 - B.strm.dist(eye[0], eye[2]) / 16, 0, 1) : 0, night, season, TIER > 3 ? smoke : 0, TIER > 3 && key === 'earth' ? 'earth' + G.cl.now[0] : key, day); }
  }
  if (TIER > 3) { const c = G.cl, t = c && c.tl, s = max(f.wx[1], f.se[1] * 0.6), m = t && max(0, mon()) / 6.5;   // the snowline: on Earth the higher of where this month freezes and where it never thaws, else fixed
    f.tl = t ? [t[0], t[1], min(t[2], m * 1000), min(t[3], t[1] - t[0] / 1000 + m)].map((v, i) => i > 1 ? v * (1 - 0.7 * f.wx[1]) : v) : [460, 1.85, 900 - 630 * s, 2.95 - 1.77 * f.se[1]]; }
  if (TIER > 3) { f.nf = rad > 300 && !fp ? [2, 9000] : [0.1, 4000]; f.fog[0] = G.air.fog * fogK * (1 + 5 * smoke) * (fp || G.span ? 1 : clamp(70 / rad, 0.08, 1)); }   // from high up the valley's air is clear
  f.focus = TIER > 3 && fp ? f.focus + (fd - f.focus) * 0.15 : rad; f.shadow = dirty || fr % (ema < 0.02 ? 2 : 6) === 0; dirty = 0;   // the shadow map follows the wind when there is time for it
  if (TIER > 3) glideStep(now);
  R.draw(f);
  if (TIER > 3 && snapNext) { const g = snapNext; snapNext = null; g(); }   // the last frame of a world, kept to dissolve from
  requestAnimationFrame(frame);
}

// ---- controls
const pts = new Map();
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); idle = 0; $('hint').hidden = true;
  if (TIER > 3 && fp && coarse && joy === null && e.clientX < innerWidth * 0.42) { joy = e.pointerId; joy0 = [e.clientX, e.clientY]; jv[0] = jv[1] = 0; stick(); return; }   // the left thumb walks, the right looks
  if (TIER > 3) { const now = performance.now(); const lk = document.pointerLockElement === canvas, r = canvas.getBoundingClientRect(), x = lk ? r.left + r.width / 2 : e.clientX, y = lk ? r.top + r.height / 2 : e.clientY;
    if (pts.size === 1 && now - tap[2] < 320 && hypot(x - tap[0], y - tap[1]) < 30) look(x, y); else if (fp && !coarse && !lk && e.button === 0) canvas.requestPointerLock?.();   // a click while walking takes the mouse for looking; Esc gives it back
    tap = [x, y, now];  } });
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; idle = 0;
  if (pts.size === 1) {
    if (TIER > 3 && fp) { if (joy === e.pointerId) { jv[0] = clamp((e.clientX - joy0[0]) / 60, -1, 1); jv[1] = clamp((e.clientY - joy0[1]) / 60, -1, 1); stick(); return; } yaw -= dx * 0.005; pitch = clamp(pitch + dy * 0.005, -1.45, 1.45); }
    else if (e.buttons & 2 || e.shiftKey) walk(-dx * perPx(), dy * perPx() * 2);
    else { yaw -= dx * 0.006; pitch = clamp(pitch + dy * 0.006, -1.3, 1.5); }
    p[0] = e.clientX; p[1] = e.clientY;
  } else if (pts.size === 2) {
    const o = [...pts.values()].find((v) => v !== p), d0 = hypot(p[0] - o[0], p[1] - o[1]);
    p[0] = e.clientX; p[1] = e.clientY;
    if (TIER > 3 && fp) { const m = (hypot(p[0] - o[0], p[1] - o[1]) - d0) * 0.01; wp[0] -= sin(yaw) * m; wp[2] -= cos(yaw) * m; return; }   // two fingers apart walk forward
    rad = clamp(rad * d0 / max(1, hypot(p[0] - o[0], p[1] - o[1])), TIER > 3 ? 0.2 : 1.5, 190); if (TIER > 3) fly = null;
    walk(-dx * perPx() / 2, dy * perPx());
  }
});
const up = (e) => { pts.delete(e.pointerId); if (TIER > 3 && joy === e.pointerId) { joy = null; jv[0] = jv[1] = 0; stick(); } };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (TIER > 3 && fp) { const m = -e.deltaY * 0.003, cp = cos(pitch); wp[0] -= sin(yaw) * cp * m; wp[1] = max(B.Hgt(wp[0], wp[2]), wp[1] - sin(pitch) * m); wp[2] -= cos(yaw) * cp * m; fly = null; hov = 1; return; } rad = clamp(rad * exp(e.deltaY * 0.0012), TIER > 3 ? 0.2 : 1.5, 190); if (TIER > 3) fly = null; idle = 0; $('hint').hidden = true; }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
if (TIER > 3) {
  addEventListener('mousemove', (e) => { if (fp && document.pointerLockElement === canvas) { yaw -= e.movementX * 0.0022; pitch = clamp(pitch + e.movementY * 0.0022, -1.45, 1.45); idle = 0; } });
  document.addEventListener('pointerlockchange', () => { $('xh').hidden = document.pointerLockElement !== canvas; });
}

// powers of ten (2 MB rung): + goes a step further in, − a step out, as one continuous zoom. Going in, the view closes on
// the spot you are looking at until it is as near as the next world's whole plot is wide; then that world takes over,
// seen from exactly that distance in its own units, and the last frame of the old one dissolves into it. Going out
// runs the other way: the bigger world arrives seen from as close as you were, and pulls back. Between the plot and
// the range, the valley around the plot carries the first part of the way.
const LAD = ['range', '', 'log', 'moss', 'soil', 'leaf'], STEP = [1e4, 100, 10, 10, 10];
let home = 'mixed', dive = 0, gl = null, snapNext = null;
const glide = (r1, p1, ms, then, T) => { gl = [performance.now(), rad, r1, pitch, p1, ms, then, [...tgt], T]; };
const glideStep = (now) => { if (!gl) return; const [t0, ra, rb, pa, pb, ms, then, T0, T] = gl, u = min(1, (now - t0) / ms), e = u * u * (3 - 2 * u); rad = ra * Math.pow(rb / ra, e); pitch = pa + (pb - pa) * e; if (T) for (let i = 0; i < 3; i++) tgt[i] = T0[i] + (T[i] - T0[i]) * e; if (u >= 1) { gl = null; if (then) then(); } };
// under the water or into the rock and back: the last frame dissolves into the next world
// The plot is kept while you are further in or further out, not regrown: on the way back it is the same plot, its
// years, tape, evolved species, fire scars and animals as they were, and whatever years passed while you were away
// are lived then. Going in, the site goes with you: the place and its sun, the log you dived at (its wood, its seed),
// whether an oak stands near enough to drop acorns.
// the new world opens out from the middle of the view, the spot you went toward, through the last frame of the old
const opn = (sp) => {
  const m = (r) => { sp.style.webkitMaskImage = sp.style.maskImage = r < -20 ? '' : 'radial-gradient(circle, transparent ' + r + '%, #000 ' + (r + 20) + '%)'; }, t0 = performance.now();
  if (calm || ema > 0.03) { sp.style.transition = 'opacity .9s'; sp.style.opacity = 0; return; }
  const st = (now) => { const u = min(1, (now - t0) / 1300), e = u * u * (3 - 2 * u); m(e * 100 - 20); if (u < 1) requestAnimationFrame(st); else { sp.style.opacity = 0; m(-99); } }; m(-20); requestAnimationFrame(st);
};
const leave = () => {
  let b = null, d = 14; for (const t of stand) if (t.st === 2) { const c = cos(t.a), s = sin(t.a), u = clamp((tgt[0] - t.x) * c + (tgt[2] - t.z) * s, 0, t.H * 0.75), x = t.x + c * u, z = t.z + s * u, e = hypot(tgt[0] - x, tgt[2] - z); if (e < d) { d = e; b = [t, x, z, e]; } }
  f.si = { cl: G.cl, log: b, sp: b && G.trees[b[0].si], oak: stand.some((t) => !t.st && t.H > 5 && /oak/i.test(G.trees[t.si].nm) && hypot(t.x - tgt[0], t.z - tgt[2]) < 10) };
  if (!G.world && !G.span && !f.pk) f.pk = { k: key, G, L: LIFE, stand, world, fire, year, mut, tape: tape.splice(0), v: [[...tgt], rad, pitch, yaw] };
};
const back = () => {
  const p = f.pk; if (!p || key !== p.k) return 0; f.pk = f.si = null; const n = year - p.year;
  G = p.G; LIFE = p.L; stand = p.stand; world = p.world; fire = p.fire; year = p.year; mut = p.mut; tape.push(...p.tape); grow(1, 1); [tgt, rad, pitch, yaw] = p.v;
  if (n > 0) { spool(); pass(min(n, 60)); year += max(0, n - 60); LIFE.lapse(n); grow(1, 1); say(n + (n > 1 ? ' years' : ' year') + ' went by while you were away'); }
  return 1;
};
const under = (k) => { if (dive) return; walking(0); const sp = $('snap'); snapNext = () => { sp.width = canvas.width; sp.height = canvas.height; sp.getContext('2d').drawImage(canvas, 0, 0); sp.style.transition = 'none'; sp.style.opacity = 1;
  setTimeout(() => { if (k === 'lake' || k === 'cave') { home = G.world ? home : key; leave(); } key = k; mut = 0; if (!back()) grow(); requestAnimationFrame(() => requestAnimationFrame(() => { opn(sp); })); $('hint').textContent = k === 'lake' ? 'Under the lake · − back up' : k === 'cave' ? 'In the cave, with a lamp · walk with WASD · − back out' : '×1: the plot, 64 m across'; $('hint').hidden = false; }, 20); }; };
const zoom = (dir) => {
  if (TIER > 3 && (key === 'lake' || key === 'cave')) { if (dir < 0) under(home); return; }
  if (dive) return; const i = key === 'bark' ? 3 : G.world ? LAD.indexOf(G.world) : key === 'moss' ? 3 : 1, j = clamp(i + dir, 0, 5); if (i === j || (key === 'bark' && dir > 0)) return;
  const nb = i === 2 && dir > 0 && B.Hgt(tgt[0], tgt[2]) > 6;                // diving at the log itself goes under its bark; anywhere else, into the moss
  const F = nb ? 10 : STEP[min(i, j)];
  if (i === 1) { home = key; leave(); } walking(0); dive = 1; fly = null; fz = 0; idle = 0;
  const L = i === 1 && dir > 0 && f.si.log, r0 = rad, rEnd = i + j === 1 ? (dir > 0 ? 0.25 : 2500) : dir > 0 ? r0 / F : r0, sp = $('snap'), a = dir > 0 ? r0 / rEnd : rEnd / r0;   // how far the old world carries the zoom: in, all the way; out, not at all, except that the plot pulls back to show its valley first
  glide(rEnd, dir > 0 ? max(pitch, 0.75) : pitch, a > 1.5 ? 1600 : 1, () => { snapNext = () => {
    sp.width = canvas.width; sp.height = canvas.height; sp.getContext('2d').drawImage(canvas, 0, 0); sp.style.transition = 'none'; sp.style.opacity = 1;
    setTimeout(() => {
      key = nb ? 'bark' : j === 1 ? home : LAD[j]; mut = 0; const p0 = pitch; if (!(j === 1 && back())) grow(); const r1 = rad, p1 = pitch;
      rad = dir > 0 ? rEnd * F : rEnd / F; pitch = p0; glide(r1, p1, 2000, () => { dive = 0; });
      requestAnimationFrame(() => requestAnimationFrame(() => { opn(sp); }));
      $('hint').textContent = (nb ? '×1000: under the bark, 6.4 cm across' : ['÷10,000: a mountain range, 640 km across', '×1: the plot, 64 m across', '×100: a rotting log, 64 cm across', '×1000: moss on the log, 6.4 cm across', '×10,000: the soil, 6.4 mm across', '×100,000: the underside of a leaf, 0.64 mm across'][j]) + (L ? ' · the fallen ' + f.si.sp.nm.toLowerCase() + ' nearest where you looked, ' + max(1, round(L[3])) + ' m off' : '') + (nb ? ' · − back out' : j ? ' · + further in, − back out' : ' · + back in'); $('hint').hidden = false;
    }, 20);
  }; }, L && [L[1], tgt[1], L[2]]);
};
const act = {
  seed() { seed = 1 + ((Math.random() * 9999) | 0); grow(1); },
  mut() { mut = 1 + ((Math.random() * 999) | 0); grow(1); },
  far() { if (TIER > 3) { walking(0); fz = 0; fly = null; } if (TIER > 3 && !G.span && rad > 60 && rad < 600) { rad = 1700; pitch = 0.33; tgt = [B.S * 6, 0, 0]; idle = 0; return; } rad = rad > 60 ? 13 : 120; pitch = rad > 60 ? 0.42 : 0.03; if (TIER > 3 && rad < 60) tgt = [B.open[0], 0, B.open[1]]; idle = 0; },   // close, the plot, the valley
  snd() {
    sound = 1 - sound;
    try { audio = audio || mkAudio(); sound ? audio.ac.resume() : audio.ac.suspend(); setSun(); } catch (e) { sound = 0; }
    $('b-snd').setAttribute('aria-pressed', !!sound);
  },
};
for (const b of document.querySelectorAll('[data-g]')) b.addEventListener('click', () => { key = b.dataset.g; mut = 0; grow(); });
if (TIER > 3) {   // anywhere on Earth: a map of the measured climate classes; click a place, choose how high to climb, grow it
  const mp = $('map'), cx = mp.getContext('2d'), pk = here ? [here.lat, here.lon] : null, draw = (p) => {
    const g = kg(), im = cx.createImageData(1440, 720), C = KCOL.map((h) => [...h].map((d) => parseInt(d, 16) * 17));
    for (let i = 0; i < g.length; i++) { const c = g[i] ? C[g[i] - 1] : [22, 34, 44]; im.data.set([c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 255], i * 4); }
    cx.putImageData(im, 0, 0); cx.strokeStyle = 'rgba(255,255,255,.18)'; cx.beginPath(); for (let a = -150; a <= 150; a += 30) { cx.moveTo((a + 180) * 4, 0); cx.lineTo((a + 180) * 4, 720); } for (let a = -60; a <= 60; a += 30) { cx.moveTo(0, (90 - a) * 4); cx.lineTo(1440, (90 - a) * 4); } cx.stroke();
    if (p) { cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.beginPath(); cx.arc((p[1] + 180) * 4, (90 - p[0]) * 4, 14, 0, 7); cx.stroke(); cx.lineWidth = 1; }
  };
  let pick2 = pk; const show = () => { const c = +$('climb').value; $('climb-l').textContent = 'Climb ' + c.toLocaleString() + ' m'; if (!pick2) return; const p = place(pick2[0], pick2[1], c); if (!p) { $('here').textContent = 'That is open sea. Choose land.'; return; } pick2 = [p.lat, p.lon]; draw(pick2);
    $('here').textContent = earthGenome(p, GENOMES, extra.pool).cl.txt + (p.fit ? '' : ' · (no fit found: numbers are the plain sketch)'); };
  mp.addEventListener('click', (e) => { const r = mp.getBoundingClientRect(); pick2 = [90 - (e.clientY - r.top) / r.height * 180, (e.clientX - r.left) / r.width * 360 - 180]; show(); });
  $('climb').addEventListener('input', show);
  $('b-when').addEventListener('click', () => { $('when').hidden = !$('when').hidden; });
  $('when').addEventListener('click', (e) => { if (e.target.dataset.g || e.target.id === 'w-shut') $('when').hidden = true; });
  $('b-earth').addEventListener('click', () => { $('earth').hidden = false; draw(pick2); if (pick2) show(); });
  $('b-shut').addEventListener('click', () => { $('earth').hidden = true; });
  $('b-grow').addEventListener('click', () => { if (pick2 && earthAt(pick2[0], pick2[1], +$('climb').value)) { $('earth').hidden = true; key = 'earth'; mut = 0; grow(); } });
}
for (const k in act) $('b-' + k).addEventListener('click', act[k]);
// this month's temperature at the plot, between the measured months: the calendar month runs two ahead of the year
// here, which starts on the first of March (eight in the south, where March is autumn)
const mon = () => { const T = G.cl.T, x = ((yearF % 1) * 12 + (G.cl.south ? 8 : 2) - 0.5 + 12) % 12, i = Math.floor(x), u = x - i; return T[i] * (1 - u) + T[(i + 1) % 12] * u; };
const setWx = (v) => { wx = v; $('b-wx').textContent = 'Weather: ' + v; }, setSea = (v) => {
  if (v === 0 && season !== 0 && LIFE) LIFE.spring();
  season = v; $('b-sea').textContent = SEA[v]; const dc = TIER > 3 && G.cl ? G.cl.dec : 1; f.se[0] = v === 2 ? dc : 0; f.se[1] = (v === 3 ? 1 : v === 2 ? 0.35 : 0) * dc; f.se[3] = v === 0 ? 1 : 0; dirty = 1;
};
if (TIER > 2) $('b-wx').addEventListener('click', () => setWx(WXN[(WXN.indexOf(wx) + 1) % WXN.length]));
if (TIER > 3) {
  $('b-sea').addEventListener('click', () => { const v = (season + 1) % 4; if (!v) year++; yearF = Math.floor(yearF) + (v ? 0 : 1) + v / 4 + 0.01; setSea(v); if (TIER > 3) setSun(); });
  $('day').min = -120; $('day').max = 1120;
  $('b-rw').addEventListener('click', () => {
    if (G.world === 'range') { GENOMES.range.stage = max(0, (G.stage ?? 10) - 1); grow(1); return; }
    rew = tape.length ? 1 - rew : 0; $('b-rw').setAttribute('aria-pressed', !!rew); if (!tape.length) say('Nothing on the tape yet: let some time pass first');
  });
  $('b-ff').addEventListener('click', () => {
    if (G.world === 'range') { GENOMES.range.stage = min(10, (G.stage ?? 10) + 1); grow(1); return; }
    rew = 0; $('b-rw').setAttribute('aria-pressed', 'false'); if (clock < 3) $('b-time').click(); else ff = (ff + 1) % 3; $('b-ff').textContent = ['Fast forward', 'Fast forward ×3', 'Fast forward ×10'][ff]; $('b-ff').setAttribute('aria-pressed', !!ff);
  });
  $('b-time').addEventListener('click', () => { clock = (clock + 1) % 5; if (clock === 4 && (!B.strm || G.world)) clock = 0;
    if (clock === 4 && !G.ero) { G.ero = 1; grow(1, 1); say('Deep time. Downstream, the valley floor has dropped 16 m along a fault, and the stream has begun to cut back toward the plot'); } $('b-time').textContent = 'Time: ' + TIMES[clock]; if (clock >= 3) { setSea(1); yearF = Math.floor(yearF) + 0.3; } if (!clock) { day = 0.3; $('day').value = 300; setSun(); } });
  $('b-fire').addEventListener('click', strike);
  $('b-walk').addEventListener('click', () => walking(!fp)); $('b-in').addEventListener('click', () => zoom(1)); $('b-out').addEventListener('click', () => zoom(-1));
  $('b-evo').addEventListener('click', () => { const e = $('evo'), on = e.toggleAttribute('hidden'); $('b-evo').setAttribute('aria-pressed', !on); tol(); });
  $('b-wolf').addEventListener('click', () => LIFE.pack(!LIFE.counts.wolves));
  $('b-fol').addEventListener('click', () => {                             // step through the animals that have names, then let go
    const a = LIFE.herd.filter((d) => d.mode !== 9 && d.name); folI = (folI + 1) % (a.length + 1); fol = a[folI] || null;
    $('b-fol').textContent = fol ? 'Following ' + LIFE.who(fol) : 'Follow'; if (fol) { rad = 9; pitch = 0.16; }
  });
}
const denLabel = () => { $('den-l').textContent = 'Trees ×' + den.toFixed(2).replace(/0$/, ''); };
$('den').value = round(den * 100); denLabel();
$('den').addEventListener('input', (e) => { den = clamp(e.target.value / 100, 0.25, 2); denLabel(); });   // the label follows the thumb; the forest regrows on release
$('den').addEventListener('change', () => { grow(1); idle = 0; });
$('day').addEventListener('input', (e) => { day = TIER > 3 ? e.target.value / 1000 : clamp(e.target.value / 1000, 0.02, 0.98); setSun(); idle = 0; });
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.tagName === 'INPUT') return;
  keys[e.code] = 1;
  if (TIER > 3 && !fp && !coarse && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) walking(1);
  if (TIER > 3 && fp && e.code === 'Space') { e.preventDefault(); if (ong && !flo && !e.repeat) { wv[1] = 5; ong = 0; hov = 0; wp[1] += 0.01; } }
  if (TIER > 3 && fp && e.code === 'KeyF') { flo = !flo; hov = flo; ong = 0; $('hint').textContent = flo ? 'Floating: Space up · C down · WASD to drift · F to come down' : HW; }
  if (TIER > 3 && fp && e.code === 'Escape' && !document.pointerLockElement) walking(0);
  const g = { Digit1: 'mixed', Digit2: 'boreal', Digit3: 'oldgrowth', Digit4: 'aspen' }[e.code];
  if (g) { key = g; mut = 0; grow(); }
  else if (e.code === 'KeyR') act.seed();
  else if (e.code === 'KeyG') act.mut();
  else if (e.code === 'KeyO') act.far();
  else if (e.code === 'KeyM') act.snd();
  else if (TIER > 3 && (e.code === 'Equal' || e.code === 'NumpadAdd')) zoom(1);
  else if (TIER > 3 && (e.code === 'Minus' || e.code === 'NumpadSubtract')) zoom(-1);
});
addEventListener('keyup', (e) => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });

$('hint').textContent = coarse ? 'Drag to look around · pinch to move in and out · two fingers to walk'
  : 'Drag to look around · scroll to move in and out · right-drag or WASD to walk';
if (TIER > 3) $('hint').textContent += coarse ? ' · double-tap anything to look closely' : ' · double-click anything to look closely';
const HO = TIER > 3 && $('hint').textContent, HW = coarse ? 'Walking: left thumb to walk (push far to run) · drag on the right to look · double-tap to go closer' : 'Walking: WASD · click to look with the mouse (Esc frees it) · Shift run · Z sneak · Space hop · F float · double-click to go closer · O to leave';
grow();
// for tests and screenshots
window.sylva = { get B() { return B; }, get L() { return LIFE; }, set(o) { if (o.yaw !== undefined) yaw = o.yaw; if (o.pitch !== undefined) pitch = o.pitch; if (o.rad) rad = o.rad; if (o.tgt) tgt = o.tgt; if (o.day !== undefined) { day = o.day; setSun(); } if (TIER > 3 && o.clock !== undefined) { clock = o.clock; $('b-time').textContent = 'Time: ' + TIMES[clock]; } if (TIER > 3 && o.fol) $('b-fol').click(); if (TIER > 3 && o.years) { pass(o.years); LIFE.lapse(o.years); grow(1, 1); } if (TIER > 3 && o.strike) strike(); if (TIER > 3 && o.see !== undefined) fol = LIFE.herd.find((d) => d.kind === o.see && d.mode !== 9) || null; if (TIER > 3 && o.burn) { for (let i = 0; i < o.burn; i++) fire.step(0.5, f.wd, 0, Math.random, stand, G); grow(1, 1); } if (TIER > 3 && o.wolves) LIFE.pack(1); if (TIER > 3 && o.deep) { if (!G.ero) { G.ero = 1; grow(1, 1); } for (let i = 0; i < o.deep; i++) deep(); } if (TIER > 3 && o.walk) { walking(0); eye[0] = o.walk[0]; eye[2] = o.walk[1]; walking(1); yaw = o.yaw ?? yaw; pitch = o.pitch ?? 0; } if (TIER > 3 && o.back) for (let i = 0; i < o.back && tape.length; i++) unspool(tape.pop()); if (TIER > 3 && o.look) look(o.look[0], o.look[1]); if (TIER > 3 && o.at) { fz = 1; fly = [o.at, o.r || 0.35, o.yaw ?? yaw, o.pitch ?? max(0.02, pitch)]; } if (TIER > 3 && o.dam) { world.dam = o.dam; grow(1, 1); } if (TIER > 2 && o.wx) setWx(o.wx); if (TIER > 3 && o.season !== undefined) setSea(o.season); if (TIER > 2 && o.skip) { const w = WXS[wx]; f.wx[0] = w[2]; f.wx[1] = max(w[3], season === 3 ? 0.95 : 0); f.wx[2] = w[0]; fogK = w[1]; rainA = w[2]; snowA = w[3]; setSun(); } if (o.den) { den = o.den; $('den').value = round(den * 100); denLabel(); grow(1); } idle = 0; }, info: () => ({ key, seed, mut, den, year: TIER > 3 && year, stand: TIER > 3 && stand.length, log: TIER > 3 && $('log').textContent, wx: TIER > 2 && wx, season, night, life: TIER > 2 && LIFE.counts, trees: B.st.trees, caps: B.caps.length / 12, cards: B.cards.length / 12, time, scale, hdr: R.hdr }) };
if (TIER > 3) Object.defineProperty(window.sylva, 'cam', { get: () => ({ tgt, rad, yaw, pitch, fz, fly, eye, fp, wp, ong, noise: LIFE.noise }) });   // for the headless checks
requestAnimationFrame(frame);
