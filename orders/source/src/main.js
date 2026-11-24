/* global TIER */
import { GENOMES, mutate, extra } from './genome.js';
import { build } from './grow.js';
import { rng } from './noise.js';
import { mkRenderer } from './gl.js';
import { mkAudio } from './audio.js';
import { mkLife, MORE, succeed } from './fx.js';

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
let stand = null, clock = 0, dayPh = 0.33, yearF = 0.3, year = 1, decT = 0, fol = null, folI = -1;
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
  G = mut ? mutate(GENOMES[key], rng(mut)) : GENOMES[key];
  const t0 = performance.now(); B = build(G, seed, Q, den, TIER > 3 && aged ? stand : undefined); R.load(B, G);
  if (TIER > 3) { stand = B.trees; if (!aged) { year = 1; fol = null; $('log').textContent = ''; $('b-fol').textContent = 'Follow'; } }
  f.fog = [G.air.fog, 0.07, 0]; f.moss = G.floor.moss; f.wd = [0.8, 0.6, G.air.wind * 0.18];
  if (!keepView) {
    day = asin(pow((G.air.sun[0] - 6) / 62, 1 / 1.2)) / PI; $('day').value = round(day * 1000);
    tgt = [B.open[0], 0, B.open[1]]; rad = 9; pitch = 0.03; yaw = (G.air.sun[1] + 180 + 28) * RAD;      // start low among the trunks, looking toward the light
  }
  if (TIER > 2) { if (TIER > 3 && aged && LIFE) LIFE.world(B); else LIFE = mkLife(B, G, rng(seed + 7), coarse, say, snd); if (!keepView && B.strm) { yaw = (tgt[2] > B.strm.zc(tgt[0]) ? 0 : PI) + 0.3; pitch = 0.17; rad = 11; } }
  setSun();
  $('l1').textContent = G.nm + (mut ? ' · mutant ' + mut : '') + ' · seed ' + seed;
  $('l2').textContent = JSON.stringify(GENOMES[key]).length.toLocaleString() + ' bytes of genome → ' + B.st.trees + ' trees · ' + (B.st.wood / 1000).toFixed(1) + ' km of wood · '
    + (B.cards.length / 12).toLocaleString() + ' leaf clusters, fronds and tufts · ' + B.st.rocks + ' stones'
    + (TIER > 2 ? ' · ' + Object.entries(LIFE.counts).filter((e) => e[1]).map((e) => e[1] + ' ' + e[0]).join(' · ') : '') + ' · grown in ' + round(performance.now() - t0) + ' ms';
  const css = (c) => 'rgb(' + c.map((v) => round(255 * pow(clamp(v * 1.6, 0, 1), 0.4545))).join(' ') + ')';
  $('lg').innerHTML = G.trees.map((s) => '<li><i style="background:' + css(s.leaf.b) + '"></i>' + s.nm + '</li>').join('');
  for (const b of document.querySelectorAll('[data-g]')) b.setAttribute('aria-pressed', b.dataset.g === key);
  try { history.replaceState(null, '', '#' + key + '-' + seed + (mut ? '-m' + mut : '') + (den !== 1 ? '-d' + round(den * 100) : '')); } catch (e) { /* the frame may refuse; the page works without it */ }
}

// ---- camera: orbits a point that walks on the ground
const inside = (x, z) => Math.abs(x) < B.S / 2 && Math.abs(z) < B.S / 2;
function view() {
  const gy = B.Hgt(tgt[0], tgt[2]) + 1.5; tgt[1] += (gy - tgt[1]) * 0.2;
  // above the horizon the eye orbits the point; below it the eye stays level and the gaze tilts up into the canopy
  const up = max(pitch, 0), cp = cos(up); eye[0] = tgt[0] + rad * cp * sin(yaw); eye[1] = tgt[1] + rad * sin(up); eye[2] = tgt[2] + rad * cp * cos(yaw);
  if (inside(eye[0], eye[2])) eye[1] = max(eye[1], B.Hgt(eye[0], eye[2]) + 0.35);
  lookAt(V, eye, [tgt[0], tgt[1] + rad * tan(max(-pitch, 0)), tgt[2]]); IV.set([V[0], V[4], V[8], V[1], V[5], V[9], V[2], V[6], V[10]]);
}
const walk = (r, fw) => {   // along the ground: right and forward as the camera sees them
  const fx = -V[2], fz = -V[10], l = hypot(fx, fz) || 1, h = B.S / 2 - 0.5;
  tgt[0] = clamp(tgt[0] + V[0] * r + fx / l * fw, -h, h); tgt[2] = clamp(tgt[2] + V[8] * r + fz / l * fw, -h, h);
};
const perPx = () => rad / (F * canvas.clientHeight / 2);

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
  let yrs = 0, moved = 0;
  if (TIER > 3) {
    if (clock === 1 || clock === 2) {                                      // a day is an eighth of a year: the sun crosses, night falls, seasons turn
      const YL = clock === 1 ? 480 : 64, y0 = Math.floor(yearF); yrs = dt / YL; dayPh = (dayPh + dt * 8 / YL) % 1; day = dayPh < 0.75 ? -0.12 + dayPh / 0.75 * 1.24 : 1.12; $('day').value = round(day * 1000); moved = 1;
      yearF += yrs; const se = Math.floor((yearF % 1) * 4); if (se !== season) setSea(se);
      if (Math.floor(yearF) > y0) { year++; if (succeed(stand, G, B, rng(seed + year * 7), say)) grow(1, 1); }                   // the trees are a year older too
    } else if (clock === 3 && (decT += dt) > 3) { decT = 0; for (let i = 0; i < 5; i++) { year++; succeed(stand, G, B, rng(seed + year * 7), say); } grow(1, 1); }   // five years at a stride
    if (fol) { if (fol.mode === 9 && fol.dead > 12) { fol = null; $('b-fol').textContent = 'Follow'; } else { tgt[0] = clamp(fol.x, -B.S / 2, B.S / 2); tgt[2] = clamp(fol.z, -B.S / 2, B.S / 2); idle = 0; } }
    if (fr % 30 === 0) $('l3').textContent = 'Year ' + year + ' · ' + SEA[season] + ' · ' + Object.entries(LIFE.counts).map((e) => e[1] + ' ' + e[0]).join(' · ') + ' · ' + stand.filter((t) => !t.st && t.H >= 5).length + ' trees';
  }
  view();
  if (TIER > 2) {                                                          // weather moves toward what was asked for; rain wets, snow settles, both pass slowly
    const w = WXS[wx], go = (i, to, r) => { const d = to - f.wx[i]; f.wx[i] += clamp(d, -r * dt, r * dt); return Math.abs(d) > 1e-3; };
    let ch = go(2, w[0], 0.12); ch = go(0, w[2], w[2] ? 0.3 : 0.04) || ch; ch = go(1, max(w[3], season === 3 ? 0.95 : 0), w[3] ? 0.08 : 0.03) || ch;
    const d = w[1] - fogK; if (Math.abs(d) > 1e-3) { fogK += clamp(d, -dt * 0.7, dt * 0.7); ch = 1; } f.fog[0] = G.air.fog * fogK;
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
    if (audio && fr % 12 === 0) { audio.set(ws, 1 - night); audio.fx(rainA, B.strm ? clamp(1 - B.strm.dist(eye[0], eye[2]) / 16, 0, 1) : 0, night, season); }
  }
  f.focus = rad; f.shadow = dirty || fr % (ema < 0.02 ? 2 : 6) === 0; dirty = 0;   // the shadow map follows the wind when there is time for it
  R.draw(f);
  requestAnimationFrame(frame);
}

// ---- controls
const pts = new Map();
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); idle = 0; $('hint').hidden = true; });
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; idle = 0;
  if (pts.size === 1) {
    if (e.buttons & 2 || e.shiftKey) walk(-dx * perPx(), dy * perPx() * 2);
    else { yaw -= dx * 0.006; pitch = clamp(pitch + dy * 0.006, -1.3, 1.5); }
    p[0] = e.clientX; p[1] = e.clientY;
  } else if (pts.size === 2) {
    const o = [...pts.values()].find((v) => v !== p), d0 = hypot(p[0] - o[0], p[1] - o[1]);
    p[0] = e.clientX; p[1] = e.clientY;
    rad = clamp(rad * d0 / max(1, hypot(p[0] - o[0], p[1] - o[1])), 1.5, 190);
    walk(-dx * perPx() / 2, dy * perPx());
  }
});
const up = (e) => { pts.delete(e.pointerId); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); rad = clamp(rad * exp(e.deltaY * 0.0012), 1.5, 190); idle = 0; $('hint').hidden = true; }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const act = {
  seed() { seed = 1 + ((Math.random() * 9999) | 0); grow(1); },
  mut() { mut = 1 + ((Math.random() * 999) | 0); grow(1); },
  far() { rad = rad > 60 ? 13 : 120; pitch = rad > 60 ? 0.42 : 0.03; idle = 0; },
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
  const g = { Digit1: 'mixed', Digit2: 'boreal', Digit3: 'oldgrowth', Digit4: 'aspen' }[e.code];
  if (g) { key = g; mut = 0; grow(); }
  else if (e.code === 'KeyR') act.seed();
  else if (e.code === 'KeyG') act.mut();
  else if (e.code === 'KeyO') act.far();
  else if (e.code === 'KeyM') act.snd();
});
addEventListener('keyup', (e) => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });

$('hint').textContent = coarse ? 'Drag to look around · pinch to move in and out · two fingers to walk'
  : 'Drag to look around · scroll to move in and out · right-drag or WASD to walk';
grow();
// for tests and screenshots
window.sylva = { get B() { return B; }, get L() { return LIFE; }, set(o) { if (o.yaw !== undefined) yaw = o.yaw; if (o.pitch !== undefined) pitch = o.pitch; if (o.rad) rad = o.rad; if (o.tgt) tgt = o.tgt; if (o.day !== undefined) { day = o.day; setSun(); } if (TIER > 3 && o.clock !== undefined) { clock = o.clock; $('b-time').textContent = 'Time: ' + TIMES[clock]; } if (TIER > 3 && o.fol) $('b-fol').click(); if (TIER > 3 && o.years) { for (let i = 0; i < o.years; i++) { year++; succeed(stand, G, B, rng(seed + year * 7), say); } grow(1, 1); } if (TIER > 2 && o.wx) setWx(o.wx); if (TIER > 3 && o.season !== undefined) setSea(o.season); if (TIER > 2 && o.skip) { const w = WXS[wx]; f.wx[0] = w[2]; f.wx[1] = max(w[3], season === 3 ? 0.95 : 0); f.wx[2] = w[0]; fogK = w[1]; rainA = w[2]; snowA = w[3]; setSun(); } if (o.den) { den = o.den; $('den').value = round(den * 100); denLabel(); grow(1); } idle = 0; }, info: () => ({ key, seed, mut, den, year: TIER > 3 && year, stand: TIER > 3 && stand.length, log: TIER > 3 && $('log').textContent, wx: TIER > 2 && wx, season, night, life: TIER > 2 && LIFE.counts, trees: B.st.trees, caps: B.caps.length / 12, cards: B.cards.length / 12, time, scale, hdr: R.hdr }) };
requestAnimationFrame(frame);
