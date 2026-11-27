// The index's opening: an LED panel of dots you fly through. Points stream out of a vanishing point that follows the
// pointer, each lighting the panel's nearest dots, so the motion reads as zooming through orders of magnitude.
(() => {
  const c = document.getElementById('field'); if (!c || !c.getContext) return;
  const g = c.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CELL = 9, N = 640, P = [], base = document.createElement('canvas');
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, lit = new Float32Array(0), hue = new Uint8Array(0);
  let vx = .74, vy = .42, tx = vx, ty = vy, on = true, last = 0;
  const seed = (p, far) => { p.x = (Math.random() * 2 - 1) * 1.6; p.y = (Math.random() * 2 - 1) * 1.1; p.z = far ? 1 + Math.random() * .2 : .05 + Math.random(); p.a = Math.random() < .14; };
  for (let i = 0; i < N; i++) { const p = {}; seed(p, false); P.push(p); }
  function size() {
    dpr = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; cols = Math.ceil(W / CELL) + 1; rows = Math.ceil(H / CELL) + 1;
    lit = new Float32Array(cols * rows); hue = new Uint8Array(cols * rows);
    base.width = c.width; base.height = c.height; const b = base.getContext('2d'); b.scale(dpr, dpr); b.fillStyle = 'rgba(238,240,226,.07)';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { b.beginPath(); b.arc(i * CELL, j * CELL, 1.1, 0, 7); b.fill(); }
  }
  function light(sx, sy, r, v, a) {   // light the panel's dots within r of (sx, sy)
    const i0 = Math.max(0, Math.floor((sx - r) / CELL)), i1 = Math.min(cols - 1, Math.ceil((sx + r) / CELL));
    const j0 = Math.max(0, Math.floor((sy - r) / CELL)), j1 = Math.min(rows - 1, Math.ceil((sy + r) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(i * CELL - sx, j * CELL - sy); if (d > r) continue;
      const k = j * cols + i, w = v * (1 - d / (r + 1)); if (w > lit[k]) { lit[k] = Math.min(1, w); hue[k] = a ? 1 : 0; }
    }
  }
  function frame(t) {
    const dt = Math.min(50, t - (last || t)) / 16.7; last = t;
    vx += (tx - vx) * .04 * dt; vy += (ty - vy) * .04 * dt;
    const cx = vx * W, cy = vy * H, S = Math.min(W, H) * .32;
    for (let k = 0; k < lit.length; k++) lit[k] *= still ? 0 : Math.pow(.9, dt);
    for (const p of P) {
      if (!still) p.z -= .0055 * dt * (.6 + p.z);
      if (p.z < .04) seed(p, true);
      const sx = cx + p.x / p.z * S, sy = cy + p.y / p.z * S;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) { seed(p, true); continue; }
      const near = Math.min(1, (1.2 - p.z) / 1.1);
      light(sx, sy, CELL * .5 + Math.max(0, .9 / p.z - 1.2) * CELL * .55, .2 + .8 * near * near, p.a);
    }
    const cr = c.getBoundingClientRect(), quiet = [...document.querySelectorAll('main > header, .sizes')].map((e) => { const r = e.getBoundingClientRect(); return [r.left - cr.left - 24, r.top - cr.top - 16, r.right - cr.left + 24, r.bottom - cr.top + 16]; });
    const hush = (x, y) => { for (const q of quiet) if (x > q[0] && x < q[2] && y > q[1] && y < q[3]) return .22; return 1; };   // keep the words readable
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.drawImage(base, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = lit[j * cols + i] * hush(i * CELL, j * CELL); if (v < .04) continue;
      g.fillStyle = hue[j * cols + i] ? `rgba(232,178,90,${v * .9})` : `rgba(168,201,154,${v * .75})`;
      g.beginPath(); g.arc(i * CELL, j * CELL, 1.2 + v * 2.4, 0, 7); g.fill();
    }
    if (on && !still) requestAnimationFrame(frame);
  }
  size(); addEventListener('resize', () => { size(); if (still) frame(0); });
  addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); if (e.clientY > r.bottom) return; tx = Math.min(.95, Math.max(.05, (e.clientX - r.left) / r.width)); ty = Math.min(.9, Math.max(.1, (e.clientY - r.top) / r.height)); });
  new IntersectionObserver(([e]) => { const was = on; on = e.isIntersecting && !document.hidden; if (on && !was && !still) requestAnimationFrame(frame); }).observe(c);
  document.addEventListener('visibilitychange', () => { const was = on; on = !document.hidden; if (on && !was && !still) requestAnimationFrame(frame); });
  if (still) for (let k = 0; k < 40; k++) frame(k * 16.7); else requestAnimationFrame(frame);
})();
// The rail: where you are on the ladder as you scroll, and a way to jump.
(() => {
  const links = [...document.querySelectorAll('.rail a')], rungs = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  if (!links.length) return;
  const vis = new Map();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => vis.set(e.target, e.intersectionRatio));
    let best = -1, bi = -1; rungs.forEach((r, i) => { const v = vis.get(r) || 0; if (v > best + .02) { best = v; bi = i; } });
    links.forEach((a, i) => a.toggleAttribute('aria-current', i === bi && best > 0));
    document.querySelector('.rail').classList.toggle('show', best > 0);
  }, { threshold: [0, .15, .3, .5, .7, .9] });
  rungs.forEach((r) => r && io.observe(r));
})();
