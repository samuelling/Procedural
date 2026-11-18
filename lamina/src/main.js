import { GENOMES, mutate } from './genome.js';
import { build, rng } from './grow.js';
import { makeNet } from './net.js';
import { mkRenderer } from './gl.js';
import { mkAudio } from './audio.js';

const { sin, cos, tan, min, max, round, exp, hypot, PI } = Math, $ = (id) => document.getElementById(id);
const canvas = $('c'), clamp = (x, a, b) => min(b, max(a, x));
const coarse = matchMedia('(pointer: coarse)').matches, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const Q = coarse ? 0.5 : 1, FOV = 40 * PI / 180, F = 1 / tan(FOV / 2);

let R;
try { R = mkRenderer(canvas); } catch (e) { R = null; console.error(e); }
if (!R) { $('err').hidden = false; $('err').textContent = 'This needs WebGL 2, which this browser did not provide. Try a current Chrome, Safari, Firefox or Edge.'; throw new Error('no WebGL 2'); }

let key = 'cortex', seed = 4821, mut = 0, G, B, net, mode = 0, section = 0, audio = null, sound = 0;
let yaw = 0.7, pitch = 0.1, rad = 1900, tgt = [0, -500, 0], idle = 9, time = 0, nextStim = 5, scale = 1, ema = 0.016, fr = 0;
const V = new Float32Array(16), K = [1, 1], keys = {};

const m = /^#?([a-z]+)-(\d+)(?:-m(\d+))?$/.exec(location.hash);
if (m && GENOMES[m[1]]) { key = m[1]; seed = +m[2]; mut = +(m[3] || 0); }

// ---- grow a block from the current genome
function grow(keepView) {
  G = mut ? mutate(GENOMES[key], rng(mut)) : GENOMES[key];
  B = build(G, seed, Q, 50000);
  net = makeNet(G, B.units, seed);
  R.load(B.inst, B.count, net.tex, net.N);
  time = 0; nextStim = 4;
  if (!keepView) { tgt = [0, -B.T / 2, 0]; rad = max(B.T * 1.9, B.W * 2.5); pitch = 0.1; }
  $('l1').textContent = G.nm + (mut ? ' · mutant ' + mut : '') + ' · seed ' + seed;
  $('l2').textContent = JSON.stringify(GENOMES[key]).length.toLocaleString() + ' bytes of genome → ' + B.st.cells + ' labelled cells · ' + B.count.toLocaleString() + ' capsules · '
    + (B.st.neurite / 1e6).toFixed(2) + ' m of neurite · ' + net.syn.toLocaleString() + ' synapses' + ' · ' + (B.st.nucKeep < 0.995 ? round(B.st.nucKeep * 100) + '% of ' : 'all ') + 'nuclei drawn';
  const hsl = (h) => 'hsl(' + round(h * 360) + ' 100% 62%)';
  $('lg').innerHTML = G.cells.filter((c) => !c.x).map((c) => '<li><i style="background:' + hsl(c.h) + '"></i>' + c.nm + '</li>').join('')
    + '<li><i style="background:#ff8c1f"></i>Glia</li><li><i style="background:#ff1f17"></i>Vessels</li><li><i style="background:#2940bf"></i>Nuclei</li>';
  $('lb').innerHTML = B.ly.map((l) => '<span>' + l.nm + '</span>').join('');
  for (const b of document.querySelectorAll('[data-g]')) b.setAttribute('aria-pressed', b.dataset.g === key);
  try { history.replaceState(null, '', '#' + key + '-' + seed + (mut ? '-m' + mut : '')); } catch (e) { /* the frame may refuse; the page works without it */ }
  rx.clearRect(0, 0, 440, 180);
}

// ---- spike raster: depth down, time rightward
const rs = $('rs'), rx = rs.getContext('2d'); let shift = 0;
function onSpike(i) {
  const u = B.units[i], d = -u.y / B.T;
  rx.fillStyle = u.in ? '#59c8ff' : u.I ? '#ff5a4d' : '#f2f5ff'; rx.fillRect(437, d * 176 + 1, 3, 3);
  if (sound && audio) audio.spike(d, u.x / B.W * 1.6, u.I, u.in);
}
function stim(x, z) { net.stim(x, z); nextStim = time + 7 + 6 * Math.random(); rx.fillStyle = 'rgba(255,179,71,.5)'; rx.fillRect(438, 0, 1, 180); }

// ---- camera
function view() {
  const cp = cos(pitch), e = [tgt[0] + rad * cp * sin(yaw), tgt[1] + rad * sin(pitch), tgt[2] + rad * cp * cos(yaw)];
  const f = [(tgt[0] - e[0]) / rad, (tgt[1] - e[1]) / rad, (tgt[2] - e[2]) / rad], sl = hypot(f[2], f[0]), s = [-f[2] / sl, 0, f[0] / sl];
  const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
  V.set([s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -(s[0] * e[0] + s[1] * e[1] + s[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), f[0] * e[0] + f[1] * e[1] + f[2] * e[2], 1]);
}
const move = (r, u, f) => { for (let i = 0; i < 3; i++) tgt[i] += V[i * 4] * r + V[i * 4 + 1] * u - V[i * 4 + 2] * f; tgt[0] = clamp(tgt[0], -B.W, B.W); tgt[1] = clamp(tgt[1], -B.T - 200, 200); tgt[2] = clamp(tgt[2], -B.D, B.D); };
const perPx = () => rad / (F * canvas.clientHeight / 2);   // microns per CSS pixel at the focus
function project(p) {
  const x = V[0] * p[0] + V[4] * p[1] + V[8] * p[2] + V[12], y = V[1] * p[0] + V[5] * p[1] + V[9] * p[2] + V[13], z = V[2] * p[0] + V[6] * p[1] + V[10] * p[2] + V[14];
  return z > -4 ? null : [(K[0] * x / -z * 0.5 + 0.5) * canvas.clientWidth, (0.5 - K[1] * y / -z * 0.5) * canvas.clientHeight];
}

// ---- overlay: layer names on the block's leftmost edge, and a scale bar true at the focus
function overlay() {
  const hw = B.W / 2, hd = B.D / 2; let best = null, bx = 1e9;
  for (const c of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) { const p = project([c[0], -B.T / 2, c[1]]); if (p && p[0] < bx) bx = p[0], best = c; }
  const show = best && rad > B.T * 0.8, el = $('lb').children;
  B.ly.forEach((l, i) => {
    const p = show && project([best[0], (l.top + l.bot) / 2, best[1]]);
    el[i].style.display = p && p[0] > 34 ? '' : 'none';
    if (p) el[i].style.transform = 'translate(' + (p[0] - 8) + 'px,' + p[1] + 'px) translate(-100%,-50%)';
  });
  const um = perPx(), len = [5, 10, 20, 50, 100, 200, 500, 1000].find((v) => v / um > 46) || 1000;
  $('sbi').style.width = len / um + 'px'; $('sbt').textContent = len >= 1000 ? '1 mm' : len + ' µm';
}

// ---- frame
let prev = performance.now();
function frame(now) {
  const dt = min(0.1, max(0, (now - prev) / 1000)); prev = now;
  ema += (dt - ema) * 0.05;
  if (++fr % 40 === 0) { if (ema > 0.03 && scale > 0.5) scale *= 0.85; else if (ema < 0.014 && scale < 1) scale = min(1, scale * 1.12); }
  const dpr = min(devicePixelRatio || 1, 2) * scale, w = max(2, round(canvas.clientWidth * dpr)), h = max(2, round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  K[0] = F * h / w; K[1] = F;
  time += dt; net.step(dt, onSpike);
  if (time > nextStim) stim((Math.random() - 0.5) * B.W * 0.7, (Math.random() - 0.5) * B.D * 0.7);
  shift += dt * 55; if (shift >= 1) { const n = shift | 0; shift -= n; rx.globalCompositeOperation = 'copy'; rx.drawImage(rs, -n, 0); rx.globalCompositeOperation = 'source-over'; }
  idle += dt; if (idle > 5 && !calm) yaw += dt * 0.04;
  const sp = max(60, rad * 0.7) * dt, kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), kf = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), ky = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
  if (kx || kf || ky) { move(kx * sp, ky * sp, kf * sp); idle = 0; }
  view();
  R.draw(V, K, time, net.tex, [mode, section, rad, 7 + rad * 0.012]);
  overlay();
  requestAnimationFrame(frame);
}

// ---- controls
const pts = new Map(); let down = 0, moved = 0, lastTap = 0;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); idle = 0; down = e.timeStamp; moved = 0; $('hint').hidden = true; });
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; idle = 0; moved += hypot(dx, dy);
  if (pts.size === 1) {
    if (e.buttons & 2 || e.shiftKey) move(-dx * perPx(), dy * perPx(), 0);
    else { yaw -= dx * 0.006; pitch = clamp(pitch + dy * 0.006, -1.5, 1.5); }
    p[0] = e.clientX; p[1] = e.clientY;
  } else if (pts.size === 2) {
    const o = [...pts.values()].find((v) => v !== p), d0 = hypot(p[0] - o[0], p[1] - o[1]);
    p[0] = e.clientX; p[1] = e.clientY;
    rad = clamp(rad * d0 / max(1, hypot(p[0] - o[0], p[1] - o[1])), 25, 6000);
    move(-dx * perPx() / 2, dy * perPx() / 2, 0);
  }
});
const up = (e) => {
  if (pts.delete(e.pointerId) && !pts.size && moved < 8 && e.timeStamp - down < 300) { if (e.timeStamp - lastTap < 380) { stim(clamp(tgt[0], -B.W / 2, B.W / 2), clamp(tgt[2], -B.D / 2, B.D / 2)); lastTap = 0; } else lastTap = e.timeStamp; }
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); rad = clamp(rad * exp(e.deltaY * 0.0012), 25, 6000); idle = 0; $('hint').hidden = true; }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const press = (id, on) => $(id).setAttribute('aria-pressed', !!on);
const setMode = (v) => { mode = v; for (const b of document.querySelectorAll('[data-m]')) b.setAttribute('aria-pressed', +b.dataset.m === mode); $('lg').hidden = mode !== 1; };
const act = {
  sec() { section = 1 - section; press('b-sec', section); },
  stim() { stim(clamp(tgt[0], -B.W / 2, B.W / 2), clamp(tgt[2], -B.D / 2, B.D / 2)); },
  seed() { seed = 1 + ((Math.random() * 9999) | 0); grow(1); },
  mut() { mut = 1 + ((Math.random() * 999) | 0); grow(1); },
  snd() {
    sound = 1 - sound;
    if (sound) { try { audio = audio || mkAudio(); audio.ac.resume(); } catch (e) { sound = 0; } }
    press('b-snd', sound);
  },
};
for (const b of document.querySelectorAll('[data-g]')) b.addEventListener('click', () => { key = b.dataset.g; mut = 0; grow(); });
for (const b of document.querySelectorAll('[data-m]')) b.addEventListener('click', () => setMode(+b.dataset.m));
for (const k in act) $('b-' + k).addEventListener('click', act[k]);
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  keys[e.code] = 1;
  const g = { Digit1: 'cortex', Digit2: 'cerebellum', Digit3: 'hippocampus' }[e.code];
  if (g) { key = g; mut = 0; grow(); }
  else if (e.code === 'KeyC') setMode((mode + 1) % 3);
  else if (e.code === 'KeyX') act.sec();
  else if (e.code === 'Space') { e.preventDefault(); act.stim(); }
  else if (e.code === 'KeyR') act.seed();
  else if (e.code === 'KeyG') act.mut();
  else if (e.code === 'KeyM') act.snd();
});
addEventListener('keyup', (e) => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });

$('hint').textContent = coarse ? 'Drag to orbit · pinch to dive in · two fingers to move · double-tap to stimulate'
  : 'Drag to orbit · scroll to dive in · right-drag or WASD to move · double-click to stimulate';
grow(); setMode(0);
// for tests and screenshots: set state, draw one frame, read it back
window.lamina = { set(o) { if (o.yaw !== undefined) yaw = o.yaw; if (o.pitch !== undefined) pitch = o.pitch; if (o.rad) rad = o.rad; if (o.tgt) tgt = o.tgt; idle = 0; }, info: () => ({ key, seed, mut, count: B.count, units: net.N, time, scale }) };
requestAnimationFrame(frame);
