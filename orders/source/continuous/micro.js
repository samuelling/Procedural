// Below a micrometre: the ground goes on down. A grain of clay is a stack of platelets; a platelet's face is terraces
// one atomic layer high; the terraces are rows of atoms (oxygen, with silicon and aluminium in the hollows); an atom is
// a cloud of electrons round a nucleus a hundred thousand times smaller; the nucleus is sixteen protons and neutrons;
// a proton is three quarks held by the gluon field, with pairs of quarks flickering in and out. Below a few
// attometres no experiment has seen any structure, and nor does this.
// Light cannot show anything smaller than its own wavelength, so below about a tenth of a micrometre the colours are
// a convention (the chemists' colours for elements, red, green and blue for the quarks' colour charge).
// The camera keeps its own position here, in doubles, from a point on the ground where it came down; every shader
// position is measured from the camera, so the floats stay exact from a micrometre to an attometre.
const { floor, sqrt, hypot, min, max, abs, sin, cos, exp, PI } = Math;
export const MICRO = 1.5e-6;                                                 // below this height the planet hands over
const A = 2.9e-10, RA = 1.3e-10, RN = 0.85e-15, S3 = sqrt(3);
const LAY = [[0, -RA, 0, 0], [A / 2, -RA * 1.55, A / (2 * S3), 1], [A / 2, -RA * 2.6, -A / (2 * S3), 2]];   // three layers: offset x, centre height, offset z, which
function hexNear(x, z) {                                                     // the nearest point of the hexagonal lattice, and its indices
  const v = z / (A * S3 / 2), u = x / A - v / 2, i0 = floor(u), j0 = floor(v); let best = null;
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = i0 + di, j = j0 + dj, cx = (i + j / 2) * A, cz = j * A * S3 / 2, d = hypot(x - cx, z - cz); if (!best || d < best.d) best = { i, j, cx, cz, d }; }
  return best;
}
// oxygen sixteen: four alpha clusters at the corners of a tetrahedron, each two protons and two neutrons
const NUC = (() => { const T = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((x) => x / S3)), out = [];
  T.forEach((c, k) => T.forEach((d, m) => out.push({ p: c.map((x, i) => x * 1.65e-15 + d[i] * 0.95e-15 * (k % 2 ? -1 : 1)), proton: m < 2 ? 1 : 0, k: k * 4 + m }))); return out; })();

export function mkMicro(gl, prog, PRE) {
  const QV = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const P = prog(QV, PRE + `
in vec2 v; uniform vec3 uR, uU, uF; uniform vec2 uTan;
uniform vec3 uCam, uMin, uMin2, uA, uN, uKey; uniform ivec3 uAid; uniform vec4 uNu[16], uQ[3], uSea[6]; uniform int uInN;
uniform float uAc, uNs;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
const float A = ${A}, RA = ${RA}, RN = .85, FM = 1e-15, S3 = 1.7320508;   // nucleons and quarks are measured in femtometres (metres squared would underflow)
float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 vor(vec2 u, out float id) { vec2 i = floor(u), f = u - i; float d = 9., d2 = 9.; id = 0.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(hs(i + o), hs(i + o + 7.3)) - f; float e = dot(r, r); if (e < d) { d2 = d; d = e; id = hs(i + o + 3.1); } else if (e < d2) d2 = e; } return vec2(sqrt(d), sqrt(d2)); }
// the nearest atom of a hexagonal layer to (x, z); its centre, and an id for it
vec3 hexNear(vec2 q, vec2 off, out vec2 id) { q -= off; float vv = q.y / (A * S3 / 2.), uu = q.x / A - vv / 2.; vec2 b = floor(vec2(uu, vv)); vec3 best = vec3(1e9);
  for (int k = 0; k < 4; k++) { vec2 ij = b + vec2(k & 1, k >> 1), c = vec2((ij.x + ij.y / 2.) * A, ij.y * A * S3 / 2.); float d = length(q - c); if (d < best.z) { best = vec3(c + off, d); id = ij; } } return best; }
// the atoms near p: distance to the nearest surface, its colour and which it is
vec3 lay(int l) { return l == 0 ? vec3(0., -RA, 0.) : l == 1 ? vec3(A / 2., -RA * 1.55, A / (2. * S3)) : vec3(A / 2., -RA * 2.6, -A / (2. * S3)); }
float atoms(vec3 p, out vec3 col, out vec3 nc) {
  float best = 1e9; col = vec3(0.); nc = vec3(0.);
  for (int l = 0; l < 3; l++) { vec3 L = lay(l); vec2 id; vec3 h = hexNear(p.xz, L.xz, id); if (ivec3(l, int(id.x), int(id.y)) == uAid && uAc > .5) continue;
    float r = l == 1 ? RA * .55 : RA, d = length(vec3(p.x - h.x, p.y - L.y, p.z - h.y)) - r;
    if (d < best) { best = d; nc = vec3(h.x, L.y, h.y); float e = hs(id + float(l) * 7.1); col = l == 1 ? (e < .3 ? vec3(.62, .66, .78) : vec3(.86, .72, .42)) : vec3(.86, .26, .2) * (.9 + .2 * e); } }
  return best;
}
vec2 sph(vec3 c, vec3 rd, float r) { float b = dot(c, rd), cc = dot(c, c) - r * r, d = b * b - cc; if (d < 0.) return vec2(1e30, -1e30); d = sqrt(d); return vec2(b - d, b + d); }   // sphere at c from the camera
float glowPt(vec3 c, vec3 rd, float pix, out float tc) { tc = dot(c, rd); if (tc <= 0.) return 0.; float dp = length(c - rd * tc), th = dp / tc; return exp(-th * th / (pix * pix) * 1.5); }
void main() {
  vec2 s = (v * 2. - 1.) * uTan; vec3 rd = normalize(uF + uR * s.x + uU * s.y); float pix = uPix;
  vec3 col = vec3(0.); float dist = 1e12, tr = 1.;
  vec3 key = uKey, sunL = uSunC * max(uSun.y, .05);
  // ---- the ground: a plane at y = 0 (the tops of the atoms), shaded from the platelets down to rows of atoms
  float tp = rd.y < 0. && uCam.y > 0. ? uCam.y / -rd.y : -1.;
  vec3 gcol = vec3(0.); float gd = 1e12;
  if (tp > 0.) { vec2 w = uCam.xz + rd.xz * tp; float fp = tp * pix; float id; vec2 c = vor(w / 4e-7, id), c2;
    vec3 base = mix(uMin, uMin2, id) * (.85 + .3 * hs(vec2(id * 9.)));
    float edge = smoothstep(.05, 0., c.y - c.x) * smoothstep(4e-8, 1e-8, fp);  // platelet edges
    float tid; vec2 t = vor(w / 6e-8 + id * 17., tid); float wv = t.x * .6 + id + .35 * n2(w / 3e-8), ter = floor(wv * 6.);   // terraces, one atomic layer each
    float stp = smoothstep(fp * 2., 0., abs(fract(wv * 6.) - .5) * 6e-8 / 6.) * smoothstep(2e-8, 3e-9, fp) * smoothstep(1e-11, 3e-10, fp);
    float dots = 0.; if (fp < A * .5) { vec2 hid; vec3 h = hexNear(w, vec2(0.), hid); dots = smoothstep(RA * .9, RA * .3, h.z) * smoothstep(A * .5, A * .2, fp); }
    gcol = base * (1. - edge * .45 - stp * .15) * (1. + dots * .4) * (sunL * .8 + uSky * .6) * mix(1., .88 + .12 * hs(vec2(ter, id)), smoothstep(2e-8, 5e-9, fp));
    gd = tp; }
  // close enough to see atoms: march them (they fade in as they grow bigger than a few pixels)
  float wAt = 0.; vec3 acol = vec3(0.); float ad = 1e12;
  float tA0 = uCam.y > RA * .2 ? (rd.y < 0. ? (uCam.y - RA * .2) / -rd.y : 1e30) : 0.;
  if (tA0 < 1e29 && tA0 * pix < A * .7) {
    float t = tA0; vec3 cc, nc; bool hit = false;
    for (int i = 0; i < 64; i++) { vec3 p = uCam + rd * t; if (p.y > RA * .3 && rd.y > 0.) break; float d = atoms(p, cc, nc); if (d < t * pix * .5) { hit = true; break; } t += max(d, t * pix * .2); if (t > tA0 + A * 30.) break; }
    if (hit) { vec3 p = uCam + rd * t, n = normalize(p - nc); float dif = max(dot(n, key), 0.), rim = pow(1. - max(dot(n, -rd), 0.), 2.5);
      cc = mix(uMin * 1.2, cc, smoothstep(6e-11, 1.5e-11, t * pix));      // the elements' colours only once each atom is many pixels
      acol = cc * (.25 + .75 * dif) + mix(cc, vec3(1.), .5) * rim * .6; ad = t; wAt = smoothstep(A * .7, A * .15, t * pix); } }
  if (tp > 0. || wAt > 0.) { col = mix(gcol, acol, wAt); dist = wAt > .5 ? ad : gd; }
  else if (uCam.y > 0.) col = uSky * .3 + vec3(.004);                    // looking up: the air
  float lv = smoothstep(2e-11, 1.1e-10, length(uA)); col = mix(vec3(.012, .016, .04), col, lv);   // deep inside an atom its neighbours are lost in its own cloud
  // ---- the atom you are in or beside: its electrons as a cloud round a point of a nucleus
  if (uAc > 0.) { vec2 ts = sph(uA, rd, RA * 2.2); float t0 = max(ts.x, 0.), t1 = min(ts.y, dist);
    if (t1 > t0) { float dt = (t1 - t0) / 32., j = hs(gl_FragCoord.xy); vec3 acc = vec3(0.); float T = 1.;
      for (int i = 0; i < 32; i++) { vec3 q = rd * (t0 + (float(i) + j) * dt) - uA; float r = length(q) / RA, ang = dot(normalize(q + 1e-30), normalize(vec3(sin(uT * .2), cos(uT * .13), .4)));
        float rho = exp(-r / .12) * 6. + exp(-r / .45) * (.25 + 1.1 * ang * ang) * 1.6 + exp(-abs(r - .9) * 8.) * .25;   // 1s, 2s and 2p
        float a = 1. - exp(-rho * dt / RA * .35); acc += T * a * mix(vec3(.3, .45, .95), vec3(.8, .7, .9), smoothstep(.5, .05, r)); T *= 1. - a * .6; }
      col = col * mix(1., T, uAc) + acc * uAc * .6; }
    float tn = dot(uA, rd), nr = 3e-15 / max(length(uA), 1e-30), dp = tn > 0. ? length(uA - rd * tn) / tn : 1e9, sz = max(nr, pix);
    float g = exp(-dp * dp / (sz * sz) * 1.5) * (1. - uNs); col += vec3(1., .9, .75) * g * 3. * uAc; if (g > .3) dist = min(dist, tn); }
  // ---- the nucleus: sixteen nucleons, protons warmer, neutrons cooler; the one you are in is drawn from inside
  if (uNs > 0.) { float best = 1e30; vec3 nc2 = vec3(0.), ncl = vec3(0.);
    for (int i = 0; i < 16; i++) { if (i == uInN) continue; vec2 t = sph(uNu[i].xyz, rd, RN); if (t.x > 0. && t.x < best) { best = t.x; nc2 = uNu[i].xyz; ncl = uNu[i].w > .5 ? vec3(1., .45, .35) : vec3(.55, .65, .85); } }
    if (best < 1e29) { vec3 n = normalize(rd * best - nc2); float dif = max(dot(n, key), 0.), rim = pow(1. - max(dot(n, -rd), 0.), 2.);
      col = mix(col, ncl * (.3 + .7 * dif) + ncl * rim * .8 + vec3(.05), uNs); dist = min(dist, best * FM); } }
  // ---- inside a nucleon: a faint skin, three quarks, the gluon field binding them, and pairs flickering
  if (uInN >= 0) { vec3 c = uN; vec2 ts = sph(c, rd, RN); float inside = length(c) < RN ? 1. : 0.;
    col = mix(col, vec3(.03, .02, .05), smoothstep(RN * 1.4, RN * .5, length(c)) * .9);   // inside a proton, the rest of the nucleus is only a glow through its skin
    if (ts.y > 0.) { float th = inside > .5 ? ts.y : ts.y - max(ts.x, 0.); col = col * exp(-th / RN * .6) + vec3(.12, .08, .16) * (1. - exp(-th / RN * .8)) * .6;
      if (inside < .5) col += vec3(.6, .4, .8) * pow(1. - abs(dot(normalize(rd * max(ts.x, 0.) - c), rd)), 3.) * .4; }
    vec3 jn = (uQ[0].xyz + uQ[1].xyz + uQ[2].xyz) / 3.;
    for (int i = 0; i < 3; i++) { vec3 a = uQ[i].xyz; float best = 1e30, bt = 0.;     // flux tubes, from each quark to where they meet
      for (int k = 0; k <= 12; k++) { float tt = float(k) / 12.; vec3 pq = mix(a, jn, tt); float tq = dot(pq, rd); if (tq <= 0.) continue; float d = length(pq - rd * tq) / tq; if (d < best) { best = d; bt = tt; } }
      float dd = length(mix(a, jn, bt)), w = RN * .11 / max(dd, 1e-30); col += vec3(1., .85, .6) * exp(-best * best / (w * w + pix * pix)) * .3 * (.7 + .3 * sin(uT * 3. + bt * 20.)) * min(1., dd * dd / (RN * RN * .03)); }
    for (int i = 0; i < 3; i++) { float tq; float g = glowPt(uQ[i].xyz, rd, pix, tq); vec3 qc = i == 0 ? vec3(1., .25, .2) : i == 1 ? vec3(.25, 1., .3) : vec3(.3, .45, 1.);
      float dp = tq > 0. ? length(uQ[i].xyz - rd * tq) : 1e30; float hk = min(1., tq * tq / (RN * RN * .02)); col += qc * (g * 6. + (exp(-dp * dp / (RN * RN * .01)) * 1.2 + exp(-dp * dp / (RN * RN * .12)) * .06) * hk); /* however close you come, a quark stays a point */ if (g > .3) dist = min(dist, tq * FM); }
    for (int i = 0; i < 6; i++) { float tq; float g = glowPt(uSea[i].xyz, rd, pix, tq); col += vec3(.8, .8, 1.) * g * uSea[i].w; }
  }
  oC = vec4(col, 1.); oD = vec4(dist, 0, 0, 1); gl_FragDepth = 1.;
}`);
  const vq = gl.createVertexArray();
  const M = { on: false, P: [0, 0, 0], s: 1e-6, F0: null, anchor: null, att: null };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  // the atom nearest the camera (layer, indices, centre), the nucleons as they jostle, and the nucleon nearest
  function scene(t) {
    const p = M.P; let at = null;
    for (const [ox, y, oz, l] of LAY) { const h = hexNear(p[0] - ox, p[2] - oz), c = [h.cx + ox, y, h.cz + oz], d = hypot(...sub(c, p)); if (!at || d < at.d) at = { c, d, id: [l, h.i, h.j] }; }
    const r = t * 0.05, cr = cos(r), sr = sin(r), nu = NUC.map((n, i) => { const q = n.p, j = 0.12e-15; return { c: [at.c[0] + cr * q[0] - sr * q[2] + j * sin(t * 1.3 + i), at.c[1] + q[1] + j * sin(t * 1.7 + i * 2), at.c[2] + sr * q[0] + cr * q[2] + j * cos(t * 1.1 + i)], proton: n.proton }; });
    let nn = 0; nu.forEach((n, i) => { if (hypot(...sub(n.c, p)) < hypot(...sub(nu[nn].c, p))) nn = i; });
    const N = nu[nn], q = [0, 1, 2].map((k) => { const a = t * 0.7 + k * 2.094, b = t * 0.53 + k * 1.3; return [N.c[0] + RN * 0.42 * cos(a), N.c[1] + RN * 0.42 * sin(a) * cos(b), N.c[2] + RN * 0.42 * sin(a) * sin(b)]; });
    return { at, nu, nn, q };
  }
  let last = null;
  return {
    M, MICRO,
    enter(anchor, F, h) { M.on = true; M.anchor = anchor; M.F0 = F; M.P = [0, h, 0]; M.s = h; M.att = null; last = null; },
    exitTo() { M.on = false; return M.P; },                                // where the camera is, relative to the anchor in its frame
    // riding along: when close to a nucleon or quark, the camera moves with it
    ride(t) { const S = scene(t); if (last && M.att) { const a = M.att === 'nucleon' ? S.nu[last.nn].c : M.att === 'quark' ? S.q[last.k] : null, b = M.att === 'nucleon' ? last.nu[last.nn].c : M.att === 'quark' ? last.q[last.k] : null; if (a && b) M.P = M.P.map((v, i) => v + a[i] - b[i]); }
      const S2 = scene(t); S2.k = last && last.k !== undefined ? last.k : 0; last = S2; return S2; },
    target(S) {                                                            // what a step in is aimed at, at this scale
      if (M.s > 1.5e-9) return null;
      if (M.s > 2e-14) return { c: S.at.c, att: null };
      if (M.s > 6e-16) return { c: S.nu[S.nn].c, att: 'nucleon' };
      let k = 0; S.q.forEach((q, i) => { if (hypot(...sub(q, M.P)) < hypot(...sub(S.q[k], M.P))) k = i; }); last.k = k; return { c: S.q[k], att: 'quark' };
    },
    render(common, cam, G, S, W, H) {
      M.fr = (M.fr || 0) + 1; const t = (performance.now() / 1000), Sc = this.ride(t), p = M.P;
      gl.useProgram(P.p); common(P);
      const d = [cos(cam.pitch) * sin(cam.yaw), sin(cam.pitch), cos(cam.pitch) * cos(cam.yaw)], l = hypot(d[0], d[2]) || 1, r = [-d[2] / l, 0, d[0] / l], u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]], tn = Math.tan(cam.fov / 2);
      gl.uniform3fv(P.uR, r); gl.uniform3fv(P.uU, u); gl.uniform3fv(P.uF, d); gl.uniform2fv(P.uTan, [tn * W / H, tn]);
      gl.uniform3fv(P.uCam, p); gl.uniform3fv(P.uMin, G.soil.map((v) => min(1, v * 1.6 + 0.08))); gl.uniform3fv(P.uMin2, G.rock.map((v) => min(1, v * 1.3 + 0.05)));
      gl.uniform3fv(P.uKey, [0.45, 0.8, 0.4].map((v) => v / 1.03));
      const ac = min(1, max(0, (1.2e-9 - Sc.at.d) / 8e-10)); gl.uniform1f(P.uAc, ac); gl.uniform3fv(P.uA, sub(Sc.at.c, p)); gl.uniform3i(P.uAid, ...Sc.at.id);
      const ns = min(1, max(0, (2e-13 - Sc.at.d) / 1.5e-13)); gl.uniform1f(P.uNs, ns);
      const fm = (v) => v.map((x) => x * 1e15), Nu = new Float32Array(64); Sc.nu.forEach((n, i) => Nu.set([...fm(sub(n.c, p)), n.proton], i * 4)); gl.uniform4fv(P.uNu, Nu);
      const inN = hypot(...sub(Sc.nu[Sc.nn].c, p)) < RN * 3 ? Sc.nn : -1; gl.uniform1i(P.uInN, ns > 0.5 ? inN : -1); gl.uniform3fv(P.uN, fm(sub(Sc.nu[Sc.nn].c, p)));
      const Q = new Float32Array(12); Sc.q.forEach((q, i) => Q.set([...fm(sub(q, p)), 1], i * 4)); gl.uniform4fv(P.uQ, Q);
      const SE = new Float32Array(24), f = floor(t * 3); for (let i = 0; i < 6; i++) { const h = (k) => { const x = Math.sin((f * 7.13 + i * 3.7 + k) * 12.9898) * 43758.5453; return x - floor(x); }, c = Sc.nu[Sc.nn].c; SE.set([...fm([c[0] + (h(1) - 0.5) * RN * 1.4 - p[0], c[1] + (h(2) - 0.5) * RN * 1.4 - p[1], c[2] + (h(3) - 0.5) * RN * 1.4 - p[2]]), 0.6 * sin(PI * (t * 3 - f))], i * 4); }
      gl.uniform4fv(P.uSea, SE);
      gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3);
      return Sc;
    },
  };
}
