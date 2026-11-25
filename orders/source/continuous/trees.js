// Trees, from a forest's texture to the cells of a leaf. Every tree site (7 m apart) is decided by world.js, so the
// same tree stands in the same place however you come to it. Near you (inside about 70 m) each tree is drawn whole:
// bark-covered branches and sprays of real-sized leaves whose surfaces carry veins, cells and stomata down to a few
// micrometres. Farther out (to about 400 m) each is a lit crown, and past that the forest is the ground's own canopy.
// The bands overlap and dissolve into each other, so nothing ever swaps in front of you.
import { tree, TREE, H } from './world.js';
import { LEAFFACE } from './shade.js';

const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const { sin, cos, PI, sqrt, hypot, min, max, floor } = Math;
const nrm = (v) => { const l = hypot(...v) || 1; return v.map((q) => q / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// ---- a tree's shape, grown once per kind and variant ---------------------------------------------------------------
// wood: tapered tubes (x y z, normal, around in metres, along in metres); leaves: cards, each a twig with its leaves or
// needles, drawn by the shader (x y z, normal, card u v, card length, seed)
function grow(kind, seed) {
  const r = rng(seed * 7919 + kind * 131), wood = [], wi = [], leaf = [], li = [];
  const tube = (a, b, ra, rb, s0) => {
    const ax = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), side = nrm(cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), up = cross(side, ax), n = ra > 0.15 ? 10 : ra > 0.04 ? 7 : 5, base = wood.length / 8, L = hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (let e = 0; e < 2; e++) for (let i = 0; i <= n; i++) { const t = i / n * 2 * PI, d = add([0, 0, 0], side, cos(t)), rr = e ? rb : ra; const dn = add(d, up, 0); const dir = add(dn, up, sin(t)), p = add(e ? b : a, dir, rr); const nn = nrm(dir); wood.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], t * (ra + rb) * 0.5, s0 + (e ? L : 0)); }
    for (let i = 0; i < n; i++) { const a0 = base + i, b0 = base + n + 1 + i; wi.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
  };
  const card = (p, ax, len, wid, sd) => {           // a card along ax from p, facing as much up and out as it can
    const nn0 = nrm(add(add([0, 1, 0], [p[0], 0, p[2]], 0.4), [r() - 0.5, r() - 0.5, r() - 0.5], 0.8)), sd2 = nrm(cross(ax, nn0)), nn = nrm(cross(sd2, ax)), base = leaf.length / 10;
    for (const [u, v] of [[0, -0.5], [1, -0.5], [0, 0.5], [1, 0.5]]) { const q = add(add(p, ax, u * len), sd2, v * wid); leaf.push(q[0], q[1], q[2], nn[0], nn[1], nn[2], u, v, len, sd); }
    li.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };
  const Ht = kind ? 24 + r() * 6 : 20 + r() * 6;
  if (kind === 0) {                                   // a broadleaf: a trunk that forks into a spreading crown
    const branch = (a, d, len, rad, depth, s0) => {
      const b = add(a, d, len); tube(a, b, rad, rad * 0.68, s0);
      if (depth === 0 || rad < 0.012) {               // twigs: sprays of leaves round the tip
        for (let k = 0; k < 8; k++) { const dd = nrm(add(d, [r() - 0.5, r() * 0.6 - 0.15, r() - 0.5], 1.3)); card(add(a, d, len * (0.25 + 0.75 * r())), dd, 0.32 + r() * 0.12, 0.24, r()); }
        return;
      }
      const m = depth > 2 ? 3 : 2 + (r() < 0.5 ? 1 : 0);
      for (let k = 0; k < m; k++) {
        const az = r() * 2 * PI, sp = 0.35 + r() * 0.45, nd = nrm(add(d, [cos(az) * sp, 0.15 + r() * 0.2, sin(az) * sp], 1.6));
        branch(add(a, d, len * (0.55 + 0.45 * r())), nd, len * (0.62 + r() * 0.15), rad * 0.62, depth - 1, s0 + len);
      }
    };
    const t0 = Ht * (0.32 + r() * 0.08), rb = 0.22 + r() * 0.1; tube([0, -0.4, 0], [0, t0, 0], rb, rb * 0.82, 0);
    for (let k = 0; k < 4; k++) { const az = k * PI / 2 + r(), nd = nrm([cos(az) * 0.55, 1, sin(az) * 0.55]); branch([0, t0 * (0.85 + 0.15 * r()), 0], nd, Ht * 0.26, rb * 0.55, 4, t0); }
  } else {                                            // a conifer: one leader to the top, whorls of drooping branches
    const rb = 0.25 + r() * 0.08; tube([0, -0.4, 0], [0, Ht * 0.5, 0], rb, rb * 0.55, 0); tube([0, Ht * 0.5, 0], [0, Ht, 0], rb * 0.55, 0.02, Ht * 0.5);
    for (let y = Ht * 0.18; y < Ht - 0.4; y += 0.55 + r() * 0.25) {
      const f = (Ht - y) / Ht, len = 0.6 + f * 4.8, n = 4 + floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const az = k / n * 2 * PI + r(), d = nrm([cos(az), -0.25 - 0.3 * f + r() * 0.1, sin(az)]), a = [0, y, 0], b = add(a, d, len); tube(a, b, 0.03 + f * 0.05, 0.008, y);
        for (let s = 0.12; s < 1; s += 0.1) { const p = add(a, d, len * s), side = nrm(cross(d, [0, 1, 0])); for (const sg of [-1, 1]) card(p, nrm(add(add(d, side, sg * 0.9), [0, -0.15, 0])), 0.25 + 0.25 * (1 - s) * f + 0.15, 0.16, r()); }
      }
    }
  }
  return { wood: new Float32Array(wood), wi: new Uint32Array(wi), leaf: new Float32Array(leaf), li: new Uint32Array(li), h: Ht };
}

export function mkTrees(gl, prog, PRE) {
  const V = 3, KINDS = 2;
  // ---- shaders --------------------------------------------------------------------------------------------------
  const INST = `
layout(location = 4) in vec4 iP;   // where the tree stands, from the camera; how far its band has faded (w)
layout(location = 5) in vec4 iS;   // scale, turn, seed, kind
uniform float uWd;
vec3 place(vec3 p) { float c = cos(iS.y), s = sin(iS.y); p *= iS.x; float h = max(p.y, 0.) / 20.; p.xz += vec2(sin(uT * .9 + iS.z * 40.), cos(uT * .7 + iS.z * 23.)) * h * h * .25 * uWd; return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) + iP.xyz; }
vec3 turn(vec3 n) { float c = cos(iS.y), s = sin(iS.y); return vec3(c * n.x - s * n.z, n.y, s * n.x + c * n.z); }`;
  const DITHER = `bool gone(float f) { return h1(gl_FragCoord.xy + fract(f * 13.7) * 91.) > f; }`;
  const wood = prog(PRE + INST + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in vec2 aU;
out vec3 vP, vN; out vec2 vU; out float vW, vF, vSd, vR;
void main() { vP = place(aP); vN = turn(aN); vU = aU * iS.x; vF = iP.w; vSd = iS.z; vR = aP.y * iS.x; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + DITHER + `
in vec3 vP, vN; in vec2 vU; in float vW, vF, vSd, vR; uniform float uCy;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
float vor(vec2 u) { vec2 i = floor(u), f = u - i; float d = 9.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(h1(i + o), h1(i + o + 7.3)) - f; d = min(d, dot(r, r)); } return sqrt(d); }
void main() {
  if (gone(vF)) discard;
  float fp = vW * uPix; vec2 u = vU + vec2(0., vSd * 31.);
  // bark at every scale it has: ridges and furrows (centimetres), plates, lichen (millimetres), cork cells (tens of micrometres)
  float rid = n2(vec2(u.x * 9., u.y * 1.6)) * .6 + n2(vec2(u.x * 23., u.y * 5.)) * .4, fur = smoothstep(.35, .62, rid);
  vec3 alb = mix(vec3(.08, .065, .05), vec3(.27, .24, .2), fur) * (.85 + .3 * n2(u * 40.));
  float li = smoothstep(.7, .76, n2(u * 11. + 9.)) * smoothstep(.3, 1., vR); alb = mix(alb, vec3(.3, .34, .25), li * .6 * (.7 + .3 * n2(u * 300.)));   // lichen
  if (fp < 3e-4) { float c = vor(u * vec2(3000., 1800.)); alb *= mix(1., .7 + .5 * smoothstep(.15, .5, c), smoothstep(3e-4, 6e-5, fp)); }        // cork cells
  vec3 n = normalize(vN); float dif = max(dot(n, uSun), 0.), am = .45 + .35 * n.y;
  vec3 col = alb * (uSunC * dif * .8 + uSky * am * .5) * (.55 + .45 * clamp(vR / 14., 0., 1.));   // darker low in the stand
  col = air(col, normalize(vP), length(vP), uCy, uCy + vP.y);
  oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW);
}`);
  const leaf = prog(PRE + INST + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in vec2 aU; layout(location = 3) in vec2 aX;
out vec3 vP, vN; out vec2 vU; out float vW, vF, vL, vSd, vK, vY;
void main() { vP = place(aP); vN = turn(aN); vU = aU; vL = aX.x * iS.x; vSd = aX.y; vK = iS.w; vF = iP.w; vY = aP.y * iS.x; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + DITHER + `
in vec3 vP, vN; in vec2 vU; in float vW, vF, vL, vSd, vK, vY; uniform float uCy;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
` + LEAFFACE + `
void main() {
  if (gone(vF)) discard;
  // the card is a twig (u along it, v across, in card units; vL metres long) carrying leaves or needles
  vec2 q = vU * vL; float fp = vW * uPix;
  bool conifer = vK > .5; vec2 lp = vec2(0.); float inside = 0., stem = smoothstep(.0035, .002, abs(q.y)) * step(q.x, vL * .92), ll = 0.;
  float far = smoothstep(.004, .012, fp);                                  // too far to make out single leaves: the spray as a whole, ragged at the edge
  if (far > 0.) { float e = length(vec2(vU.x * 2. - 1., vU.y * 2.)); if (e < .95 - .3 * n2(vU * 7. + vSd * 30.) && h1(gl_FragCoord.xy + vSd) < far * .9) { inside = 1.; lp = vec2(.04, 0.); ll = .08; } }
  if (inside < .5 && !conifer) {
    for (int i = 0; i < 8; i++) {                                         // leaves along the twig, alternately each side
      float fi = float(i), t = (.08 + fi * .115) * vL, side = mod(fi, 2.) * 2. - 1., a = side * (.8 - fi * .05), L = (.085 + .02 * h1(vec2(vSd, fi))) * min(1., vL / .3);
      vec2 d = vec2(cos(a), sin(a)), r = q - vec2(t, 0.); float s = dot(r, d), w = dot(r, vec2(-d.y, d.x));
      if (s > 0. && s < L) { float hw = L * .32 * pow(sin(3.1416 * s / L), .8) * (1. - .25 * s / L); if (abs(w) < hw) { inside = 1.; lp = vec2(s, w); ll = L; } }
    }
  } else if (inside < .5) {
    float k = floor(q.x / .006), t = (k + .5) * .006, side = mod(k, 2.) * 2. - 1.;   // needles, two rows
    vec2 d = normalize(vec2(.5, side)), r = q - vec2(t, 0.); float s = dot(r, d), w = dot(r, vec2(-d.y, d.x)), L = .022 * (1. - .4 * q.x / vL);
    if (s > 0. && s < L && abs(w) < .0008 * (1. - .4 * s / L) && q.x < vL * .95) { inside = 1.; lp = vec2(s, w); ll = L; }
  }
  if (inside < .5 && stem < .5) discard;
  vec3 base = conifer ? vec3(.035, .085, .045) : mix(vec3(.07, .15, .035), vec3(.12, .2, .045), h1(vec2(vSd * 9.1, 1.)));
  vec3 alb = stem > .5 && inside < .5 ? vec3(.12, .09, .05) : base;
  if (inside > .5 && far < 1.) alb = leafFace(alb, lp, ll, fp);
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float dif = max(dot(n, uSun), 0.), tr = max(dot(-n, uSun), 0.) * .6;   // sunlight through the leaf from behind
  float occ = .35 + .65 * clamp(vY / 20., 0., 1.);                       // the inside of a crown is darker
  vec3 col = alb * (uSunC * (dif + tr * vec3(.9, 1.1, .5)) * .85 + uSky * (.35 + .25 * n.y)) * occ;
  col = air(col, normalize(vP), length(vP), uCy, uCy + vP.y);
  oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW);
}`);
  // the mid band: each tree a camera-facing card, its crown a lit dome with a ragged edge
  const crown = prog(PRE + `
layout(location = 0) in vec2 aC; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform vec3 uR, uU;
out vec2 vC; out vec3 vP; out float vW, vF, vK, vSd;
void main() { float h = iS.x * (iS.w > .5 ? 26. : 22.), w = h * (iS.w > .5 ? .22 : .36); vec3 c = iP.xyz + vec3(0., h * .55, 0.); vP = c + uR * aC.x * w + vec3(0., 1., 0.) * aC.y * h * .55; vC = aC; vF = iP.w; vK = iS.w; vSd = iS.z; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + DITHER + `
in vec2 vC; in vec3 vP; in float vW, vF, vK, vSd; uniform float uCy; uniform vec3 uR;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() {
  if (gone(vF)) discard;
  vec2 c = vC; float y = c.y * .5 + .5;
  float wdt = vK > .5 ? (1. - y) * .95 + .05 : sqrt(max(0., 1. - pow(abs(c.y - .25) / .75, 2.))) * .95;   // a cone, or a round crown on a trunk
  float rag = n2(c * 9. + vSd * 40.) * .25; bool trunk = abs(c.x) < .035 && c.y < -.4;
  if (abs(c.x) > wdt - rag * wdt && !trunk) discard;
  if (vK < .5 && c.y < -.45 && !trunk) discard;
  vec3 n = normalize(uR * c.x / max(wdt, .1) * .8 + vec3(0., .5 + .5 * c.y, 0.) - normalize(vP) * sqrt(max(0., 1. - c.x * c.x)));
  vec3 alb = trunk ? vec3(.1, .08, .06) : (vK > .5 ? vec3(.035, .085, .04) : vec3(.07, .14, .04)) * (.75 + .5 * n2(c * 14. + vSd * 9.));
  float dif = max(dot(n, uSun), 0.);
  vec3 col = alb * (uSunC * dif * .8 + uSky * .45) * (.6 + .4 * y);
  col = air(col, normalize(vP), length(vP), uCy, uCy + vP.y);
  oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW);
}`);

  // ---- geometry: V variants of each kind ------------------------------------------------------------------------
  const T = [];
  for (let k = 0; k < KINDS; k++) for (let v = 0; v < V; v++) {
    const g = grow(k, v + 1), o = { h: g.h };
    o.wv = gl.createVertexArray(); gl.bindVertexArray(o.wv);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, g.wood, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.wi, gl.STATIC_DRAW); o.wn = g.wi.length;
    o.lv = gl.createVertexArray(); gl.bindVertexArray(o.lv);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, g.leaf, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 24); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 40, 32);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.li, gl.STATIC_DRAW); o.ln = g.li.length;
    o.ib = gl.createBuffer(); T.push(o);
  }
  const quad = gl.createVertexArray(); gl.bindVertexArray(quad); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const cib = gl.createBuffer(); gl.bindVertexArray(null);
  const inst = (vao, buf) => { gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } };
  for (const o of T) { inst(o.wv, o.ib); inst(o.lv, o.ib); }
  inst(quad, cib); gl.bindVertexArray(null);

  // ---- which trees, each frame: sites are looked up once and remembered ------------------------------------------
  const memo = new Map(), R1 = 72, R2 = 420;
  const site = (i, j) => { const k = i * 100003 + j; let t = memo.get(k); if (t === undefined) { t = tree(i, j); if (t) t[4] = H(t[0], t[1]); memo.set(k, t); } return t; };
  return {
    draw(common, setNoise, cam, hc) {
      const [cx, cy, cz] = cam.C, near = T.map(() => []), far = [];
      if (hc > 4000) return;                                           // from high up the forest is the ground's canopy
      const r2 = min(R2, max(R1 * 1.2, hc * 6 + 150)), i0 = floor((cx - r2) / TREE), i1 = floor((cx + r2) / TREE), j0 = floor((cz - r2) / TREE), j1 = floor((cz + r2) / TREE);
      if ((i1 - i0) * (j1 - j0) > 40000) return;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const t = site(i, j); if (!t) continue;
        const dx = t[0] - cx, dz = t[1] - cz, d = hypot(dx, dz); if (d > r2) continue;
        const sc = 0.75 + t[3] * 0.5, rot = t[3] * 40, kind = t[2], v = floor(t[3] * 997) % V, y = t[4] - cy;
        const fNear = min(1, max(0, (R1 - d) / 14)), fFar = min(1, max(0, (d - (R1 - 14)) / 14)) * min(1, max(0, (r2 - d) / 60));
        if (fNear > 0) near[kind * V + v].push(dx, y, dz, fNear, sc, rot, t[3], kind);
        if (fFar > 0) far.push(dx, y, dz, fFar, sc, rot, t[3], kind);
      }
      if (memo.size > 400000) memo.clear();
      const dw = (P) => { common(P); gl.uniform1f(P.uCy, cy); gl.uniform1f(P.uWd, 1); };
      gl.useProgram(wood.p); dw(wood);
      T.forEach((o, n) => { const a = near[n]; if (!a.length) return; gl.bindBuffer(gl.ARRAY_BUFFER, o.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.DYNAMIC_DRAW); o.cnt = a.length / 8; gl.bindVertexArray(o.wv); gl.drawElementsInstanced(gl.TRIANGLES, o.wn, gl.UNSIGNED_INT, 0, o.cnt); });
      gl.useProgram(leaf.p); dw(leaf); gl.disable(gl.CULL_FACE);
      T.forEach((o, n) => { if (!near[n].length) return; gl.bindVertexArray(o.lv); gl.drawElementsInstanced(gl.TRIANGLES, o.ln, gl.UNSIGNED_INT, 0, o.cnt); });
      if (far.length) {
        const d = [Math.cos(cam.pitch) * Math.sin(cam.yaw), Math.sin(cam.pitch), Math.cos(cam.pitch) * Math.cos(cam.yaw)], rl = hypot(d[0], d[2]) || 1;
        gl.useProgram(crown.p); dw(crown); gl.uniform3f(crown.uR, -d[2] / rl, 0, d[0] / rl);
        gl.bindBuffer(gl.ARRAY_BUFFER, cib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(far), gl.DYNAMIC_DRAW); gl.bindVertexArray(quad); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, far.length / 8);
      }
      gl.bindVertexArray(null);
    },
  };
}
