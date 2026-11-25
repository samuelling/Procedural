/* global TIER */
import { GENOMES, mutate, extra } from './genome.js';
import { build } from './grow.js';
import { rng } from './noise.js';
import { mkRenderer, pick } from './gl.js';
import { mkAudio } from './audio.js';
import { mkLife, MORE, succeed, mkFire } from './fx.js';

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
const TIMES = ['still', 'days', 'seasons', 'decades'];
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
const say = (s) => { if (TIER < 4) return; const li = document.createElement('li'), L = $('log'); li.textContent = 'Year ' + year + (clock === 3 ? '' : ', ' + SEA[season].toLowerCase()) + ' · ' + s; L.prepend(li); while (L.children.length > 4) L.lastChild.remove(); };
const snd = (k) => { if (TIER > 3 && audio && sound) audio.ev(k); };
let flash = 0, wx = 'clear', season = 1, LIFE = null, fogK = 1, night = 0, rainA = 0, snowA = 0;
if (TIER > 2) for (const k in MORE) { GENOMES[k].land.stream = MORE[k].stream; GENOMES[k].life = MORE[k].life; if (TIER > 3) GENOMES[k].floor.flower = MORE[k].flower; }
if (TIER > 3) { Object.assign(GENOMES, extra()); GENOMES.boreal.air.aur = GENOMES.larch.air.aur = 1; }

const m = /^#?([a-z]+)-(\d+)(?:-m(\d+))?(?:-d(\d+))?$/.exec(location.hash);
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
  if (audio) audio.set(A.wind, k);
}

// ---- grow a plot from the current genome
function grow(keepView, aged) {
  if (!(TIER > 3 && aged)) G = mut ? mutate(GENOMES[key], rng(mut)) : GENOMES[key];   // a forest that has been living keeps the species it has evolved
  if (TIER > 3 && !aged) G = { ...G, trees: G.trees.map((s) => ({ ...s })) };
  const t0 = performance.now(); if (TIER > 3 && !aged) world = { dam: 0, char: (x, z) => (fire ? fire.at(x, z) : 0) };
  if (TIER > 3 && aged) stand.world = world;                                 // the regrowth is told where it has burnt and how high the dam stands
  B = build(G, seed, Q, den, TIER > 3 && aged ? stand : undefined); R.load(B, G);
  if (TIER > 3 && !aged) fire = mkFire(B.S, B.strm);
  if (TIER > 3) { col = B.trees.filter((t) => t.st < 2 && t.H > 1.5).map((t) => [t.x, t.z, 0.05 + 0.011 * t.H, B.Hgt(t.x, t.z) + t.H]); for (const a of B.rocks) for (let i = 0; i < a.length; i += 12) if (a[i + 3] > 0.35) col.push([a[i], a[i + 2], a[i + 3] * 0.8, a[i + 1] + a[i + 3] * 0.7]); }
  if (TIER > 3) { stand = B.trees; if (!aged) { year = 1; fol = null; $('log').textContent = ''; $('b-fol').textContent = 'Follow'; } }
  f.fog = [G.air.fog, 0.07, 0]; f.moss = G.floor.moss; f.wd = [0.8, 0.6, G.air.wind * 0.18];
  if (!keepView) {
    day = asin(pow((G.air.sun[0] - 6) / 62, 1 / 1.2)) / PI; $('day').value = round(day * 1000);
    tgt = [B.open[0], 0, B.open[1]]; rad = 9; pitch = 0.03; yaw = (G.air.sun[1] + 180 + 28) * RAD;      // start low among the trunks, looking toward the light
    if (TIER > 3 && G.world) { tgt = [0, 0, 0]; rad = G.world == 'leaf' ? 80 : 38; pitch = G.world == 'leaf' ? 0.75 : 0.42; }
  }
  if (TIER > 2) { if (TIER > 3 && aged && LIFE) LIFE.world(B); else LIFE = mkLife(B, G, rng(seed + 7), coarse, say, snd, env); if (!keepView && B.strm) { yaw = (tgt[2] > B.strm.zc(tgt[0]) ? 0 : PI) + 0.3; pitch = 0.17; rad = 11; } }
  setSun();
  $('l1').textContent = G.nm + (mut ? ' · mutant ' + mut : '') + ' · seed ' + seed;
  $('l2').textContent = JSON.stringify(GENOMES[key]).length.toLocaleString() + ' bytes of genome → ' + B.st.trees + ' trees · ' + (B.st.wood / 1000).toFixed(1) + ' km of wood · '
    + (B.cards.length / 12).toLocaleString() + ' leaf clusters, fronds and tufts · ' + B.st.rocks + ' stones'
    + (TIER > 2 ? ' · ' + Object.entries(LIFE.counts).filter((e) => e[1]).map((e) => e[1] + ' ' + e[0]).join(' · ') : '') + ' · grown in ' + round(performance.now() - t0) + ' ms';
  if (TIER > 3 && G.span) $('l2').textContent = (G.blurb || 'A unit here is a millimetre: the same grammar, a thousand times smaller.') + ' ' + G.span + ' across.';
  const css = (c) => 'rgb(' + c.map((v) => round(255 * pow(clamp(v * 1.6, 0, 1), 0.4545))).join(' ') + ')';
  if (TIER > 3) tol();
  $('lg').innerHTML = G.trees.map((s) => '<li><i style="background:' + css(s.leaf.b) + '"></i>' + (TIER > 3 ? (s.gone ? '<s>' + s.nm + '</s>' : s.nm) + (s.par ? ' <small>← ' + s.par.toLowerCase() + ', year ' + s.born + '</small>' : '') : s.nm) + '</li>').join('');
  for (const b of document.querySelectorAll('[data-g]')) b.setAttribute('aria-pressed', b.dataset.g === key);
  try { history.replaceState(null, '', '#' + key + '-' + seed + (mut ? '-m' + mut : '') + (den !== 1 ? '-d' + round(den * 100) : '')); } catch (e) { /* the frame may refuse; the page works without it */ }
}

// ---- camera: orbits a point that walks on the ground
const inside = (x, z) => Math.abs(x) < B.S / 2 && Math.abs(z) < B.S / 2;
function view() {
  if (TIER > 3 && fp) {                                                     // walking: the eye is where you stand, and looks where you turn
    const cp = cos(pitch), b = Math.abs(sin(bob)), h = EYE * (sneak ? 0.82 : 1);
    eye[0] = wp[0] + cos(yaw) * sin(bob) * 0.012; eye[1] = wp[1] + h + b * 0.045 - 0.02; eye[2] = wp[2] - sin(yaw) * sin(bob) * 0.012;   // the head rises and sways a little with each step
    lookAt(V, eye, [eye[0] - sin(yaw) * cp, eye[1] - sin(pitch), eye[2] - cos(yaw) * cp]); IV.set([V[0], V[4], V[8], V[1], V[5], V[9], V[2], V[6], V[10]]);
    tgt[0] = wp[0]; tgt[2] = wp[2]; return;
  }
  const gy = B.Hgt(tgt[0], tgt[2]) + 1.5; if (!(TIER > 3 && fz)) tgt[1] += (gy - tgt[1]) * 0.2;
  // above the horizon the eye orbits the point; below it the eye stays level and the gaze tilts up into the canopy
  const up = max(pitch, 0), cp = cos(up); eye[0] = tgt[0] + rad * cp * sin(yaw); eye[1] = tgt[1] + rad * sin(up); eye[2] = tgt[2] + rad * cp * cos(yaw);
  if (inside(eye[0], eye[2])) eye[1] = max(eye[1], B.Hgt(eye[0], eye[2]) + 0.35);
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
    let fx = kx + jv[0], fw = kf - jv[1]; const run = keys.ShiftLeft || keys.ShiftRight || hypot(jv[0], jv[1]) > 0.92, n = hypot(fx, fw) || 1, st = B.strm;
    sneak = !run && (keys.KeyZ || (hypot(jv[0], jv[1]) > 0.12 && hypot(jv[0], jv[1]) < 0.55)) ? 1 : 0;
    if (fx || fw || keys.Space) { fly = null; if (hov && !flo) { hov = 0; ong = 0; } idle = 0; }
    const depth = st ? max(0, st.lvl(wp[0]) - B.Hgt(wp[0], wp[2])) * (st.dist(wp[0], wp[2]) < 0 ? 1 : 0) : 0, sp = (run ? 6.2 : sneak ? 1.6 : 3.6) * (depth > 0.2 ? 1 - min(0.5, depth * 0.4) : 1) * (flo ? 1.6 : 1);
    const tx = (-sin(yaw) * fw + cos(yaw) * fx) / n * sp * min(1, n), tz = (-cos(yaw) * fw - sin(yaw) * fx) / n * sp * min(1, n), gr = min(1, dt * 12);
    wv[0] += (tx - wv[0]) * gr; wv[2] += (tz - wv[2]) * gr;
    const h = B.S / 2 - 0.4, deep = (x, z) => st && st.dist(x, z) < 0 && st.lvl(x) - B.Hgt(x, z) > 1.15 && !flo;
    let nx = clamp(wp[0] + wv[0] * dt, -h, h), nz = clamp(wp[2] + wv[2] * dt, -h, h);
    if (deep(nx, wp[2])) nx = wp[0]; if (deep(nx, nz)) nz = wp[2];                       // deep water is not for walking into
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
      if (Math.floor(yearF) > y0) { if (pass(1)) grow(1, 1); }                   // the trees are a year older too
    } else if (clock === 3 && (decT += dt) > 3) { decT = 0; pass(5); LIFE.lapse(5); grow(1, 1); }   // five years at a stride, for the animals too
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
    let ch = go(2, w[0], 0.12); ch = go(0, w[2], w[2] ? 0.3 : 0.04) || ch; ch = go(1, max(w[3], season === 3 ? 0.95 : 0), w[3] ? 0.08 : 0.03) || ch;
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
    if (audio && fr % 12 === 0) { audio.set(ws, 1 - night); audio.fx(rainA, B.strm ? clamp(1 - B.strm.dist(eye[0], eye[2]) / 16, 0, 1) : 0, night, season, TIER > 3 ? smoke : 0, key, day); }
  }
  if (TIER > 3) { f.nf = rad > 300 && !fp ? [2, 9000] : [0.1, 4000]; f.fog[0] = G.air.fog * fogK * (1 + 5 * smoke) * (fp || G.span ? 1 : clamp(70 / rad, 0.08, 1)); }   // from high up the valley's air is clear
  f.focus = TIER > 3 && fp ? f.focus + (fd - f.focus) * 0.15 : rad; f.shadow = dirty || fr % (ema < 0.02 ? 2 : 6) === 0; dirty = 0;   // the shadow map follows the wind when there is time for it
  R.draw(f);
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

// powers of ten (2 MB rung): + dives a step further in, - pulls back out. The view rushes toward the ground, whites out,
// and comes in on the next world from high above, settling where you would stand there.
const LAD = ['', 'log', 'moss', 'soil', 'leaf'];
let home = 'mixed', dive = 0;
const zoom = (dir) => {
  if (dive) return; const i = key === 'bark' ? 2 : max(0, LAD.indexOf(G.world || (key === 'moss' ? 'moss' : ''))), j = clamp(i + dir, 0, 4); if (i === j || (key === 'bark' && dir > 0)) return;
  const nb = i === 1 && dir > 0 && B.Hgt(tgt[0], tgt[2]) > 6;                // diving at the log itself goes under its bark; anywhere else, into the moss
  if (!i) home = key; walking(0); dive = 1; fly = null; fz = 0; const fd2 = $('fade'); fd2.style.opacity = 1;
  const r0 = rad; let t = 0; const go = () => { t += 0.05; rad = r0 * (dir > 0 ? 1 - 0.95 * t : 1 + 6 * t); pitch += (0.9 - pitch) * 0.1; if (t < 1) return setTimeout(go, 30);
    key = nb ? 'bark' : j ? LAD[j] : home; mut = 0; grow(); const r1 = rad, p1 = pitch; rad = dir > 0 ? r1 * 8 : r1 * 0.15; pitch = dir > 0 ? 0.9 : p1; fly = [tgt.slice(), r1, yaw, p1]; fz = 0; fd2.style.opacity = 0; dive = 0;
    $('hint').textContent = (nb ? '×1000: under the bark, 6.4 cm across' : ['×1: the plot, 64 m across', '×100: a rotting log, 64 cm across', '×1000: moss on the log, 6.4 cm across', '×10,000: the soil, 6.4 mm across', '×100,000: the underside of a leaf, 0.64 mm across'][j]) + (nb ? ' · − back out' : ' · + further in, − back out'); $('hint').hidden = false; };
  go();
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
for (const k in act) $('b-' + k).addEventListener('click', act[k]);
const setWx = (v) => { wx = v; $('b-wx').textContent = 'Weather: ' + v; }, setSea = (v) => {
  if (v === 0 && season !== 0 && LIFE) LIFE.spring();
  season = v; $('b-sea').textContent = SEA[v]; f.se[0] = v === 2 ? 1 : 0; f.se[1] = v === 3 ? 1 : v === 2 ? 0.35 : 0; f.se[3] = v === 0 ? 1 : 0; dirty = 1;
};
if (TIER > 2) $('b-wx').addEventListener('click', () => setWx(WXN[(WXN.indexOf(wx) + 1) % WXN.length]));
if (TIER > 3) {
  $('b-sea').addEventListener('click', () => { const v = (season + 1) % 4; if (!v) year++; yearF = Math.floor(yearF) + (v ? 0 : 1) + v / 4 + 0.01; setSea(v); });
  $('day').min = -120; $('day').max = 1120;
  $('b-time').addEventListener('click', () => { clock = (clock + 1) % 4; $('b-time').textContent = 'Time: ' + TIMES[clock]; if (clock === 3) { setSea(1); yearF = Math.floor(yearF) + 0.3; } if (!clock) { day = 0.3; $('day').value = 300; setSun(); } });
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
window.sylva = { get B() { return B; }, get L() { return LIFE; }, set(o) { if (o.yaw !== undefined) yaw = o.yaw; if (o.pitch !== undefined) pitch = o.pitch; if (o.rad) rad = o.rad; if (o.tgt) tgt = o.tgt; if (o.day !== undefined) { day = o.day; setSun(); } if (TIER > 3 && o.clock !== undefined) { clock = o.clock; $('b-time').textContent = 'Time: ' + TIMES[clock]; } if (TIER > 3 && o.fol) $('b-fol').click(); if (TIER > 3 && o.years) { pass(o.years); LIFE.lapse(o.years); grow(1, 1); } if (TIER > 3 && o.strike) strike(); if (TIER > 3 && o.see !== undefined) fol = LIFE.herd.find((d) => d.kind === o.see && d.mode !== 9) || null; if (TIER > 3 && o.burn) { for (let i = 0; i < o.burn; i++) fire.step(0.5, f.wd, 0, Math.random, stand, G); grow(1, 1); } if (TIER > 3 && o.wolves) LIFE.pack(1); if (TIER > 3 && o.look) look(o.look[0], o.look[1]); if (TIER > 3 && o.at) { fz = 1; fly = [o.at, o.r || 0.35, o.yaw ?? yaw, o.pitch ?? max(0.02, pitch)]; } if (TIER > 3 && o.dam) { world.dam = o.dam; grow(1, 1); } if (TIER > 2 && o.wx) setWx(o.wx); if (TIER > 3 && o.season !== undefined) setSea(o.season); if (TIER > 2 && o.skip) { const w = WXS[wx]; f.wx[0] = w[2]; f.wx[1] = max(w[3], season === 3 ? 0.95 : 0); f.wx[2] = w[0]; fogK = w[1]; rainA = w[2]; snowA = w[3]; setSun(); } if (o.den) { den = o.den; $('den').value = round(den * 100); denLabel(); grow(1); } idle = 0; }, info: () => ({ key, seed, mut, den, year: TIER > 3 && year, stand: TIER > 3 && stand.length, log: TIER > 3 && $('log').textContent, wx: TIER > 2 && wx, season, night, life: TIER > 2 && LIFE.counts, trees: B.st.trees, caps: B.caps.length / 12, cards: B.cards.length / 12, time, scale, hdr: R.hdr }) };
if (TIER > 3) Object.defineProperty(window.sylva, 'cam', { get: () => ({ tgt, rad, yaw, pitch, fz, fly, eye, fp, wp, ong, noise: LIFE.noise }) });   // for the headless checks
requestAnimationFrame(frame);
