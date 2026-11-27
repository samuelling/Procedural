// Finding your way: a compass ball that always shows which way the sky is, the ground, north and your target; and a
// map (N) that zooms from a hundred metres to the whole globe, drawn from the same terrain and climate as the world,
// with waypoints: what lives near you, the named places of this world, your own marks, and the other worlds.
import { H, climate, forestF, river, lakeAt, CORES, realRiver } from './planet.js';

const { sin, cos, atan2, asin, acos, hypot, max, min, abs, sqrt, round, PI } = Math;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = hypot(...a) || 1; return a.map((v) => v / l); }, cl = (v, a = 0, b = 1) => min(b, max(a, v));
const fd = (m) => m < 30 ? 'here' : m < 1000 ? `${round(m)} m` : m < 1e5 ? `${(m / 1000).toFixed(1)} km` : `${round(m / 1000).toLocaleString()} km`;
const PTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], pt = (b) => PTS[round(((b % 360) + 360) % 360 / 45) % 8];
const EXT = [100, 300, 1e3, 3e3, 1e4, 3e4, 1e5, 3e5, 1e6, 3e6, 0];       // the map's half-widths, metres; 0 is the whole globe
const HUE = { you: '#f2c46b', place: '#eef0e2', life: '#9fd28a', water: '#8cc4ef', mark: '#f08f6a', city: '#c9b6f0' };

export function mkNav(X) {
  const $ = (id) => document.getElementById(id), cv = $('compass'), cx = cv.getContext('2d');
  const box = $('map'), mc = $('mapc'), mo = $('mapo'), mctx = mc.getContext('2d'), octx = mo.getContext('2d'), N = 200;
  let target = null, zi = 3, job = null, img = null, pins = [], open = false;
  let marks = []; try { marks = JSON.parse(localStorage.getItem('orders-marks') || '[]'); } catch (e) { /* none kept */ }
  const keep = () => { try { localStorage.setItem('orders-marks', JSON.stringify(marks)); } catch (e) { /* not kept */ } };

  // the frame you look in (the planet's local one, or the microscope's, whose 'up' is the surface you went into) and
  // the true sky, north and east in it
  function frame() {
    const { cam, micro } = X, Mi = micro.M.on, F = Mi ? micro.M.F0 : X.axes(), P = Mi ? micro.M.anchor : cam.P, u = nrm(P);
    let e = cross([0, 0, 1], u); e = hypot(...e) < 1e-6 ? [1, 0, 0] : nrm(e); const n = cross(u, e), L = (v) => [dot(v, F[0]), dot(v, F[1]), dot(v, F[2])];
    return { F, P, u, e, n, L, up: L(u), N: L(n), E: L(e) };
  }
  const ll = (u) => [asin(cl(u[2], -1, 1)) * 180 / PI, atan2(u[1], u[0]) * 180 / PI];
  const unit = (la, lo) => { la *= PI / 180; lo *= PI / 180; return [cos(la) * cos(lo), cos(la) * sin(lo), sin(la)]; };
  const llTxt = (u) => { const [a, b] = ll(u); return `${abs(a).toFixed(2)}°${a >= 0 ? 'N' : 'S'} ${abs(b).toFixed(2)}°${b >= 0 ? 'E' : 'W'}`; };
  function bearTo(f, q) {                                                     // great-circle distance (m) and bearing (°) from you to q (a unit vector)
    const G = X.G(), a = acos(cl(dot(f.u, q), -1, 1)), t = [q[0] - f.u[0] * dot(f.u, q), q[1] - f.u[1] * dot(f.u, q), q[2] - f.u[2] * dot(f.u, q)];
    return [a * G.R, (atan2(dot(t, f.e), dot(t, f.n)) * 180 / PI + 360) % 360];
  }

  // ---- the compass ball ---------------------------------------------------------------------------------------------
  function compass() {
    const { cam, S, micro, dir, fmt } = X, G = X.G(); if (X.cave.C.in || !G) { cv.hidden = true; $('cmpt').hidden = true; return; }
    cv.hidden = false; $('cmpt').hidden = false;
    const dpr = min(2, devicePixelRatio || 1), W = 128; if (cv.width !== W * dpr) { cv.width = cv.height = W * dpr; }
    const f = frame(), d = dir(), r = nrm([-d[2], 0, d[0]]), uu = cross(r, d), R0 = W * 0.42, c = W / 2;
    const P = (v) => { const l = hypot(...v) || 1; return [c + dot(v, r) / l * R0, c - dot(v, uu) / l * R0, dot(v, d) / l]; };
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, W);
    const g = cx.createRadialGradient(c - 12, c - 14, 4, c, c, R0 + 4); g.addColorStop(0, 'rgba(60,64,52,.55)'); g.addColorStop(1, 'rgba(14,16,12,.7)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(c, c, R0 + 4, 0, 7); cx.fill();
    // the lower half of the sky, the ground's side, tinted brown: the horizon is where the two meet
    cx.save(); cx.beginPath(); cx.arc(c, c, R0, 0, 7); cx.clip(); cx.beginPath();
    for (let k = 0; k <= 64; k++) { const a = k / 64 * 2 * PI, h = [f.N[0] * cos(a) + f.E[0] * sin(a), f.N[1] * cos(a) + f.E[1] * sin(a), f.N[2] * cos(a) + f.E[2] * sin(a)], p = P(h); k ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
    const dn = P(f.up.map((v) => -v)); cx.fillStyle = 'rgba(120,86,46,.38)';
    if (dn[2] > 0) { cx.closePath(); cx.fill(); } else { cx.closePath(); cx.rect(W, 0, -W, W); cx.fill('evenodd'); }
    cx.restore();
    // the horizon ring, near half bright; the points of the compass on it
    for (let k = 0; k < 64; k++) { const a0 = k / 64 * 2 * PI, a1 = (k + 1) / 64 * 2 * PI, h = (a) => [0, 1, 2].map((i) => f.N[i] * cos(a) + f.E[i] * sin(a)), p0 = P(h(a0)), p1 = P(h(a1));
      cx.strokeStyle = p0[2] > 0 ? 'rgba(242,196,107,.9)' : 'rgba(242,196,107,.22)'; cx.lineWidth = p0[2] > 0 ? 1.6 : 1; cx.beginPath(); cx.moveTo(p0[0], p0[1]); cx.lineTo(p1[0], p1[1]); cx.stroke(); }
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (let k = 0; k < 8; k++) { const a = k / 8 * 2 * PI, p = P([0, 1, 2].map((i) => f.N[i] * cos(a) + f.E[i] * sin(a))), big = k % 2 === 0;
      if (!big && p[2] < 0) continue; cx.globalAlpha = p[2] > 0 ? 1 : 0.35; cx.fillStyle = k === 0 ? '#f08f6a' : '#eef0e2'; cx.font = `${big ? 600 : 400} ${big ? 11 : 8}px system-ui, sans-serif`; cx.fillText(PTS[k], p[0], p[1]); }
    cx.globalAlpha = 1;
    // the sky's pole and the ground's, and the target
    const mk = (v, col, txt) => { const p = P(v); cx.globalAlpha = p[2] > 0 ? 1 : 0.4; cx.fillStyle = col; cx.beginPath(); cx.arc(p[0], p[1], 3.2, 0, 7); cx.fill(); cx.font = '600 9px system-ui, sans-serif'; cx.fillText(txt, p[0], p[1] + (p[1] < c ? 9 : -9)); cx.globalAlpha = 1; };
    mk(f.up, '#8cc4ef', 'sky'); mk(f.up.map((v) => -v), '#c79a5e', S.cy > 2e5 ? G.name : 'ground');
    let tt = '';
    if (target) { const q = target.q, wv = [q[0] * (G.R + 2) - f.P[0], q[1] * (G.R + 2) - f.P[1], q[2] * (G.R + 2) - f.P[2]], [dist, b] = bearTo(f, q);
      mk(f.L(wv), HUE[target.k] || '#f2c46b', '◆'); tt = `${target.nm}: ${fd(dist)} ${pt(b)}`; }
    cx.strokeStyle = 'rgba(238,240,226,.8)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(c - 5, c); cx.lineTo(c + 5, c); cx.moveTo(c, c - 5); cx.lineTo(c, c + 5); cx.stroke();
    // in words: which way you face, how far you look up or down, and which way is up when it is not where you think
    const dw = [0, 1, 2].map((i) => f.F[0][i] * d[0] + f.F[1][i] * d[1] + f.F[2][i] * d[2]), el = asin(cl(dot(dw, f.u), -1, 1)) * 180 / PI;
    const hd = (atan2(dot(dw, f.e), dot(dw, f.n)) * 180 / PI + 360) % 360, tilt = micro.M.on ? acos(cl(f.up[1], -1, 1)) * 180 / PI : 0;
    $('cmpt').textContent = `facing ${pt(hd)} ${round(hd)}° · ${abs(el) < 3 ? 'level' : `${round(abs(el))}° ${el > 0 ? 'up' : 'down'}`}` + (tilt > 20 ? ` · this surface is tilted ${round(tilt)}° from level` : '') + (tt ? ` · ${tt}` : '');
  }

  // ---- the map --------------------------------------------------------------------------------------------------------
  // north up, centred on you; out to 3,000 km an azimuthal map (true distances from the centre), then the globe
  function toMap(f, q, ext) {
    const G = X.G();
    if (!ext) { const z = dot(q, f.u); return z < 0 ? null : [(dot(q, f.e) + 1) / 2, (1 - dot(q, f.n)) / 2]; }
    const [s, b] = bearTo(f, q); if (s > ext * 1.42) return null; const x = sin(b * PI / 180) * s / ext, y = cos(b * PI / 180) * s / ext; return [(x + 1) / 2, (1 - y) / 2];
  }
  function fromMap(f, px, py, ext) {
    const G = X.G(), x = px * 2 - 1, y = 1 - py * 2;
    if (!ext) { const z2 = 1 - x * x - y * y; if (z2 < 0) return null; const z = sqrt(z2); return [0, 1, 2].map((i) => f.u[i] * z + f.e[i] * x + f.n[i] * y); }
    const s = hypot(x, y) * ext, a = s / G.R, b = atan2(x, y), t = [0, 1, 2].map((i) => f.n[i] * cos(b) + f.e[i] * sin(b));
    return [0, 1, 2].map((i) => f.u[i] * cos(a) + t[i] * sin(a));
  }
  function colour(G, p, h, hn, near, pix) {                                        // a map pixel: sea, ice, desert, grass or forest, hill-shaded
    const sea = G.liquid || [0.1, 0.25, 0.45], rock = G.rock || [0.5, 0.48, 0.45];
    if (h < 0 && (G.air > 0.01 || G.liquid)) { const k = cl(1 + h / 5000, 0.3, 1); return sea.map((v) => v * (0.5 + 0.5 * k) * 0.9 + 0.05 * k); }
    let c; const lk = near ? lakeAt(G, nrm(p)) : -1e9;
    if (lk > h) return sea.map((v) => v * 0.85 + 0.06);
    if (G.real === 'earth' && !G.E) { const rr = realRiver(p, 0); if (rr && rr.d < Math.max(rr.w * 0.5, pix * 0.7)) return sea.map((v) => v * 0.8 + 0.12); }   // the real rivers, as wide as a pixel at least
    if (G.real === 'earth' || !G.real) {
      const { T, W } = climate(G, p, h), F = T > -12 ? forestF(G, p, h, T, W) : 0;
      if (near && river(G, p, h, W) > 0.25) return sea.map((v) => v * 0.8 + 0.12);
      const dry = [0.78, 0.68, 0.5], grass = [0.56, 0.6, 0.32], wood = [0.2, 0.36, 0.17];
      c = dry.map((v, i) => v + (grass[i] - v) * cl(W * 1.6)).map((v, i) => v + (wood[i] - v) * F);
      if (T < -6) c = c.map((v) => v + (0.93 - v) * cl((-6 - T) / 6));
      c = c.map((v, i) => v + (rock[i] - v) * cl((h - 2500) / 2500));
    } else c = (G.sand || rock).map((v, i) => v * 0.6 + rock[i] * 0.4 + cl(h / 8000) * 0.15);
    const sh = cl(1 + (h - hn) / pix * 1.5, 0.6, 1.35); return c.map((v) => v * sh);
  }
  function draw() {                                                           // a few rows a frame, top to bottom
    if (!job) return; const G = X.G(), t0 = performance.now(), { f, ext, row } = job, oct = ext ? (ext < 3e3 ? 18 : ext < 1e5 ? 13 : 9) : 8, near = ext && ext <= 3e4;
    if (!img) img = mctx.createImageData(N, N);
    let j = row;
    for (; j < N && performance.now() - t0 < 7; j++) {
      let hl = null;
      for (let i = 0; i < N; i++) { const q = fromMap(f, (i + 0.5) / N, (j + 0.5) / N, ext), o = (j * N + i) * 4; if (!q) { img.data[o + 3] = 0; continue; }
        const p = q.map((v) => v * G.R), h = H(G, p, oct), hn = hl ?? h; hl = h; const c = colour(G, p, h, hn, near, (ext || G.R) * 2 / N);
        img.data[o] = c[0] * 255; img.data[o + 1] = c[1] * 255; img.data[o + 2] = c[2] * 255; img.data[o + 3] = 255; }
    }
    job.row = j; mctx.putImageData(img, 0, 0); if (j >= N) job = null;
  }
  // the points of interest: what lives near you (from the census and the herds), water, the world's named places,
  // your own marks, and the other worlds
  function points(f) {
    const G = X.G(), { eco, PLACES } = X, L = [];
    if (G.real === 'earth' || !G.real) for (const R of eco.near()) {
      const q = nrm(R.p); for (const C of R.ch) { const n = C.herd.filter((a) => a.dead < 0).length, m = C.pack.filter((a) => a.dead < 0).length;
        if (n) L.push({ k: 'life', nm: `${n} ${n > 1 ? C.g.pl : C.g.nm}${m ? `, ${m} ${m > 1 ? C.h.pl : C.h.nm}` : ''}`, q, sec: 'near' }); }
      if (R.wet > 0.3) L.push({ k: 'water', nm: `water: ${R.nm.fish}${R.herons.length ? ', herons' : ''}`, q, sec: 'near' });
    }
    PLACES.forEach((p, i) => { if (p[1] === G.n) L.push({ k: 'place', nm: p[0], q: unit(p[2], p[3]), i, sec: 'world' }); else L.push({ k: 'place', nm: p[0], i, sec: 'other' }); });
    marks.forEach((m, i) => { if (m.n === G.n) L.push({ k: 'mark', nm: m.nm, q: m.q, mi: i, sec: 'mark' }); });
    if (G.real === 'earth' && !G.E) for (const k of CORES) L.push({ k: 'city', nm: k[5], q: k.slice(0, 3), sec: 'city' });   // the big cities' downtowns
    for (const p of L) if (p.q) [p.d, p.b] = bearTo(f, p.q);
    return L;
  }
  function list() {
    const f = frame(), L = points(f), { fmt } = X, el = $('mapl'); el.innerHTML = '';
    const sec = (t, items, srt = true) => { if (!items.length) return; const h = document.createElement('h4'); h.textContent = t; el.append(h);
      (srt ? items.sort((a, b) => a.d - b.d) : items).slice(0, 40).forEach((p) => { const row = document.createElement('div'); row.className = 'wp' + (target && target.nm === p.nm ? ' on' : '');
        row.innerHTML = `<i style="background:${HUE[p.k]}"></i><span></span><em></em>`; row.children[1].textContent = p.nm; row.children[2].textContent = p.q ? (p.d < 30 ? 'here' : `${fd(p.d)} ${pt(p.b)}`) : '';
        row.onclick = () => { if (p.q) { target = p; list(); } else go(p); };
        if (p.q || p.i !== undefined) { const b = document.createElement('button'); b.textContent = 'go'; b.title = 'go there'; b.onclick = (e) => { e.stopPropagation(); go(p); }; row.append(b); }
        if (p.k === 'mark') { const b = document.createElement('button'); b.textContent = '×'; b.title = 'forget this mark'; b.onclick = (e) => { e.stopPropagation(); marks.splice(p.mi, 1); keep(); if (target && target.nm === p.nm) target = null; list(); }; row.append(b); }
        el.append(row); }); };
    sec('Near you', L.filter((p) => p.sec === 'near')); sec('Your marks', L.filter((p) => p.sec === 'mark')); sec(`On ${X.G().name}`, L.filter((p) => p.sec === 'world')); { const cs = L.filter((p) => p.sec === 'city').sort((a, b) => a.d - b.d).slice(0, 12); sec('Nearest cities', cs); } sec('Other worlds', L.filter((p) => p.sec === 'other'), false);
    pins = L.filter((p) => p.q);
  }
  function go(p) { open && toggle(false); if (p.i !== undefined) X.goPlace(p.i); else X.goTo(p.q.map((v) => v * X.G().R)); if (p.q) target = null; }
  function overlay() {                                                        // you, your heading, the pins, the scale
    const f = frame(), ext = EXT[zi], W = mo.width, dpr = W / mo.clientWidth || 1; octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, W, W); octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S0 = mo.clientWidth, d = X.dir(), dw = [0, 1, 2].map((i) => f.F[0][i] * d[0] + f.F[1][i] * d[1] + f.F[2][i] * d[2]), hd = atan2(dot(dw, f.e), dot(dw, f.n));
    octx.font = '11px system-ui, sans-serif'; octx.textBaseline = 'middle';
    for (const p of pins) { const m = toMap(f, p.q, ext); if (!m || m[0] < 0 || m[0] > 1 || m[1] < 0 || m[1] > 1) continue; const x = m[0] * S0, y = m[1] * S0, on = target && target.nm === p.nm;
      octx.fillStyle = HUE[p.k]; octx.strokeStyle = 'rgba(0,0,0,.6)'; octx.lineWidth = 2; octx.beginPath(); octx.arc(x, y, on ? 5 : 3.5, 0, 7); octx.stroke(); octx.fill();
      if (p.k !== 'life' || on || ext <= 3e3) { octx.strokeText(p.nm, x + 7, y); octx.fillText(p.nm, x + 7, y); } p.mx = x; p.my = y; }
    const ym = toMap(f, f.u, ext), x = ym[0] * S0, y = ym[1] * S0; octx.save(); octx.translate(x, y); octx.rotate(hd);
    octx.fillStyle = HUE.you; octx.strokeStyle = '#111'; octx.lineWidth = 1.5; octx.beginPath(); octx.moveTo(0, -10); octx.lineTo(6, 7); octx.lineTo(0, 3); octx.lineTo(-6, 7); octx.closePath(); octx.stroke(); octx.fill(); octx.restore();
    if (ext) { const bar = [1, 2, 5].flatMap((k) => [k * 10, k * 100, k * 1e3, k * 1e4, k * 1e5, k * 1e6]).sort((a, b) => a - b).filter((v) => v <= ext * 0.8).pop(), w = bar / ext * S0 / 2;
      octx.fillStyle = '#eef0e2'; octx.fillRect(14, S0 - 18, w, 3); octx.strokeText(X.fmt(bar), 14, S0 - 28); octx.fillText(X.fmt(bar), 14, S0 - 28); }
  }
  function render() { const f = frame(); job = { f, ext: EXT[zi], row: 0 }; img = null; mctx.clearRect(0, 0, N, N);
    const G = X.G(), S = X.S; $('maph').textContent = `${G.name} · ${llTxt(f.u)} · ${EXT[zi] ? `${X.fmt(EXT[zi] * 2)} across` : 'the whole globe'}` + (S.cy > 2e4 ? ` · you are ${X.fmt(S.cy)} up` : ''); list(); }
  function zoom(k) { const z = cl(zi + k, 0, EXT.length - 1); if (z !== zi) { zi = z; render(); } }
  function toggle(on = !open) {
    open = on; box.hidden = !on; if (!on) return; document.exitPointerLock?.();
    const S = X.S; zi = S.cy > 5e6 ? EXT.length - 1 : max(0, EXT.findIndex((e) => !e || e > S.hc * 3)); if (zi < 0) zi = EXT.length - 1;
    const dpr = min(2, devicePixelRatio || 1); mo.width = mo.height = round(mo.clientWidth * dpr); render();
  }
  mo.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); zoom(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  mo.addEventListener('click', (e) => { const r = mo.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 12;
    for (const p of pins) if (p.mx !== undefined) { const dd = hypot(p.mx - x, p.my - y); if (dd < bd) { bd = dd; best = p; } } if (best) { target = best; list(); } });
  $('mapin').onclick = () => zoom(-1); $('mapout').onclick = () => zoom(1); $('mapx').onclick = () => toggle(false);
  $('mapmk').onclick = () => { const f = frame(), G = X.G(); marks.push({ n: G.n, q: f.u, nm: `Mark ${marks.length + 1} · ${llTxt(f.u)}` }); keep(); list(); };
  $('mapb').onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); toggle(); };
  box.addEventListener('pointerdown', (e) => e.stopPropagation()); box.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  addEventListener('keydown', (e) => { if (e.code === 'KeyN' && !e.repeat && !(e.target && e.target.tagName === 'SELECT')) toggle(); if (e.code === 'Escape' && open) toggle(false); });
  // ---- the ruler of the orders of magnitude: a close-up of ten powers of ten round your scale, sliding as you zoom,
  // each with something that size; and under it the whole span, quarks to the cosmic web, with you on it
  const RC = $('ruler'), rx = RC.getContext('2d'), SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = (n) => (n < 0 ? '⁻' : '') + String(abs(n)).split('').map((c) => SUP[c]).join('');
  const THING = { '-18': 'quarks', '-15': 'a proton', '-14': 'a nucleus', '-10': 'an atom', '-9': 'a molecule', '-7': 'a virus', '-6': 'a bacterium', '-5': 'a cell', '-3': 'a grain', '-2': 'an ant', '-1': 'a leaf', 0: 'you', 1: 'a tree', 2: 'a stand',
    3: 'a valley', 4: 'a mountain', 5: 'a range', 6: 'a country', 7: 'the Earth', 8: 'the Moon’s orbit', 9: 'the Sun', 11: 'Earth’s orbit', 13: 'the solar system', 16: 'a light-year', 17: 'the nearest stars', 19: 'a star cluster', 21: 'the Milky Way', 22: 'galaxy groups', 23: 'galaxy clusters', 25: 'the cosmic web', 26: 'all we can see' };
  const LO = -18, HI = 27;
  function ruler(w) {
    const dpr = min(2, devicePixelRatio || 1), Wc = RC.clientWidth || 300, Hc = 70; if (RC.width !== round(Wc * dpr)) { RC.width = round(Wc * dpr); RC.height = Hc * dpr; }
    const L = Math.log10(max(w, 1e-18)), span = 8, k = Wc / span, X0 = Wc / 2;
    rx.setTransform(dpr, 0, 0, dpr, 0, 0); rx.clearRect(0, 0, Wc, Hc); rx.textAlign = 'center';
    rx.strokeStyle = 'rgba(238,240,226,.35)'; rx.lineWidth = 1; rx.beginPath(); rx.moveTo(0, 30.5); rx.lineTo(Wc, 30.5); rx.stroke();
    for (let n = Math.floor(L - span / 2) - 1; n <= L + span / 2 + 1; n++) {
      const x = X0 + (n - L) * k, near = 1 - min(1, abs(n - L) / (span / 2)); if (x < -20 || x > Wc + 20) continue;
      for (let m = 2; m < 10; m++) { const xm = x + Math.log10(m) * k; rx.strokeStyle = 'rgba(238,240,226,.25)'; rx.beginPath(); rx.moveTo(xm + 0.5, 27); rx.lineTo(xm + 0.5, 30); rx.stroke(); }
      rx.strokeStyle = `rgba(238,240,226,${0.3 + 0.6 * near})`; rx.beginPath(); rx.moveTo(x + 0.5, 23); rx.lineTo(x + 0.5, 34); rx.stroke();
      rx.globalAlpha = 0.35 + 0.65 * near; rx.fillStyle = '#eef0e2'; rx.font = '10px system-ui, sans-serif'; rx.fillText(n === 0 ? '1 m' : `10${sup(n)} m`, x, 45);
      if (THING[n] && abs(n - L) < 3.2) { rx.font = 'italic 11px Georgia, serif'; rx.fillStyle = '#e3d6b0'; rx.fillText(THING[n], x, 16); }
      rx.globalAlpha = 1; }
    rx.fillStyle = '#f2c46b'; rx.beginPath(); rx.moveTo(X0, 24); rx.lineTo(X0 - 5, 17); rx.lineTo(X0 + 5, 17); rx.fill(); rx.fillRect(X0 - 0.75, 24, 1.5, 12);
    const y = 65, a = 8, b = Wc - 8, xp = a + (L - LO) / (HI - LO) * (b - a);   // the whole span
    rx.strokeStyle = 'rgba(238,240,226,.3)'; rx.beginPath(); rx.moveTo(a, y + 0.5); rx.lineTo(b, y + 0.5); rx.stroke();
    for (let n = LO; n <= HI; n += 3) { const x = a + (n - LO) / (HI - LO) * (b - a); rx.beginPath(); rx.moveTo(x + 0.5, y - 2); rx.lineTo(x + 0.5, y + 2); rx.stroke(); }
    const x0 = a + (L - span / 2 - LO) / (HI - LO) * (b - a), x1 = a + (L + span / 2 - LO) / (HI - LO) * (b - a);
    rx.fillStyle = 'rgba(242,196,107,.25)'; rx.fillRect(x0, y - 2, x1 - x0, 4); rx.fillStyle = '#f2c46b'; rx.beginPath(); rx.arc(xp, y + 0.5, 2.6, 0, 7); rx.fill();
    rx.font = '9px system-ui, sans-serif'; rx.fillStyle = 'rgba(238,240,226,.6)'; rx.textAlign = 'left'; rx.fillText('quarks', a, y - 5); rx.textAlign = 'right'; rx.fillText('the cosmic web', b, y - 5);
  }
  let tl = 0;
  return {
    frame(t) { if (t - tl > 1 / 30) { tl = t; compass(); } if (open) { draw(); overlay(); if (!job && t - (list.t || 0) > 2) { list.t = t; list(); } } },
    ruler, get open() { return open; }, toggle, setTarget: (p) => { target = p; },
  };
}
