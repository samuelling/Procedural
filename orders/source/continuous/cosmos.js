// Beyond the planet: its star and the planets round it, the stars of its galaxy, the galaxy itself, and the galaxies
// beyond, out to the scale where the cosmic web is all there is to see. Everything here is placed the way the ground
// is: on lattices fixed in space, a cell for every star or galaxy, so each is where it was when you come back.
// Stars come in classes: each class's cells are twice as wide as the last and its stars four times as bright, so at
// any distance the nearest stars of every class are as bright as each other and the sky is never empty or crowded.
// The galaxy is a density (disc, spiral arms, bulge, dust lanes) the view is marched through; seen from inside it is
// the band across the night sky behind the air, seen from outside a spiral.
import { rng, sunAt, H, climate, forestF } from './planet.js';

const { sin, cos, sqrt, hypot, floor, PI, min, max, abs, exp, atan2, asin } = Math;
export const PC = 3.086e16, KPC = PC * 1e3, MPC = PC * 1e6, AU = 1.496e11;
export const COS = 1.2e8;                                                    // above this the planet is drawn from far off
const nrm = (v) => { const l = hypot(...v) || 1; return v.map((x) => x / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const NOISE = `
float h31(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vn(vec3 p) { vec3 i = floor(p), f = p - i; f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + 1.), f.x), f.y), f.z); }
// the galaxy's light and dust at a point (kiloparsecs, in the galaxy's own axes)
uniform float uArms, uTw;
vec4 galaxy(vec3 p) {
  float r = length(p.xy), th = atan(p.y, p.x), z = abs(p.z);
  float arm = pow(.5 + .5 * cos(uArms * th - uTw * log(r + .3) + 1.3 * vn(p * .6)), 5.) * smoothstep(.6, 2.5, r);
  float disc = exp(-r / 3.2) * exp(-z / .32), thin = exp(-r / 3.6) * exp(-z / .09), bulge = exp(-(r * r + z * z * 2.2) / .9) * 2.2;
  vec3 c = vec3(1., .84, .62) * disc * .55 + vec3(.62, .76, 1.) * thin * arm * 3. + vec3(1., .8, .55) * bulge;
  return vec4(c, thin * (.25 + 2.5 * arm) * 9. * (.6 + .8 * vn(p * 3.1)));
}
float stars3(vec3 g) { float r = length(g.xy); return exp(-(r - 8.) / 3.2) * exp(-abs(g.z) / .32) + exp(-(r * r + g.z * g.z * 2.2) / .9) * 6.; }
// the cosmic web: walls and filaments of a slow noise, sharpened (megaparsecs)
float web(vec3 x) { float a = 1. - abs(2. * vn(x / 40.) - 1.), b = 1. - abs(2. * vn(x / 11. + 5.3) - 1.), c = 1. - abs(2. * vn(x / 130. + 9.1) - 1.); return pow(a * .55 + b * .3 + c * .15, 7.) * 9.; }`;

export function mkCosmos(gl, prog, PRE) {
  const QV = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  // ---- the background: the galaxy, marched; and (from far off) the planet, its star, its moons and the other planets
  const bg = prog(QV, PRE + NOISE + `
in vec2 v; uniform vec3 uR, uU, uF; uniform vec2 uTan; uniform mat3 uLP;
uniform vec3 uGc, uGe1, uGe2, uGn; uniform float uGg, uCmb;
uniform int uMode; uniform vec3 uSd, uSp, uSc, uPp, uAx; uniform float uSr, uSb, uPr, uRing0, uRing1; uniform sampler2D uMap; uniform vec3 uAirC, uRingN;
uniform vec4 uB[12], uBc[12]; uniform int uNb; uniform vec3 uOn; uniform vec4 uO[9]; uniform int uNo; uniform float uOrbA;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
vec2 sph(vec3 ro, vec3 rd, float r) { float b = dot(ro, rd), c = dot(ro, ro) - r * r, d = b * b - c; if (d < 0.) return vec2(1e30, -1e30); d = sqrt(d); return vec2(-b - d, -b + d); }
void main() {
  vec2 s = (v * 2. - 1.) * uTan; vec3 rl = normalize(uF + uR * s.x + uU * s.y), rd = uLP * rl;   // the ray, in the planet's axes
  float pix = uPix;
  vec3 col = vec3(0.); float hit = 1e30, dist = 1e12;
  // the galaxy: from the camera, in kiloparsecs and the galaxy's axes
  vec3 ro = vec3(dot(-uGc, uGe1), dot(-uGc, uGe2), dot(-uGc, uGn)), rg = vec3(dot(rd, uGe1), dot(rd, uGe2), dot(rd, uGn));
  vec2 tb = sph(ro, rg, 22.); float t0 = max(tb.x, 0.), t1 = tb.y;
  if (abs(rg.z) > 1e-4) { float za = (-3. - ro.z) / rg.z, zb = (3. - ro.z) / rg.z; t0 = max(t0, min(za, zb)); t1 = min(t1, max(za, zb)); } else if (abs(ro.z) > 3.) t1 = -1.;
  if (t1 > t0) { float dt = (t1 - t0) / 48., tr = 1., j = h31(vec3(gl_FragCoord.xy, uT));
    for (int i = 0; i < 48; i++) { vec4 g = galaxy(ro + rg * (t0 + (float(i) + j) * dt)); col += g.rgb * tr * dt * .05 * uGg; tr *= exp(-g.a * dt * .5); if (tr < .02) break; } }
  col += vec3(.035, .02, .015) * (.75 + .5 * vn(rd * 6.)) * uCmb;      // the oldest light, from every side
  if (uMode >= 1) { float th = acos(clamp(dot(rd, uSd), -1., 1.)); col += uSc / 2.6 * uSb * exp(-th * th / (pix * pix) * 1.5); }   // the star, as a point
  if (uMode == 1) {
    // the star: a disc, and the glare of a point
    vec2 ts = sph(-uSp, rd, uSr); float cs = dot(rd, normalize(uSp)), ang = uSr / length(uSp), th = acos(clamp(cs, -1., 1.));
    if (ts.x > 0. && ts.x < 1e29) { col = uSc * 20.; hit = ts.x; } else col += uSc * .25 * (ang * ang) / (th * th + ang * ang * .3 + pix * pix * 4.) * 6.;
    // the other planets and the moons: lit from the star; too small to see, a point of their light
    for (int i = 0; i < 12; i++) { if (i >= uNb) break; vec3 c = uB[i].xyz; float r = uB[i].w, d = length(c); vec2 tq = sph(-c, rd, r);
      vec3 sd = normalize(uSp - c);
      if (tq.x > 0. && tq.x < hit) { vec3 n = normalize(rd * tq.x - c); float band = uBc[i].w > .5 ? .75 + .25 * sin(dot(n, uOn) * 40. + vn(n * 6.) * 3.) : .8 + .4 * vn(n * 9.);
        col = uBc[i].rgb * band * max(dot(n, sd), 0.) * 2.5; hit = tq.x; }
      else { float a = r / d, th2 = acos(clamp(dot(rd, c / d), -1., 1.)); col += uBc[i].rgb * (a * a) / (th2 * th2 + pix * pix * 1.2) * .35 * (.5 + .5 * dot(sd, -c / d)) * step(a, pix * 2.); } }
    // orbits: faint rings in the plane of the system
    if (uOrbA > 0.) for (int i = 0; i < 9; i++) { if (i >= uNo) break; float dn = dot(rd, uOn); if (abs(dn) < 1e-6) continue; float t = dot(uO[i].xyz, uOn) / dn; if (t <= 0. || t > hit) continue;
      float e = abs(length(rd * t - uO[i].xyz) - uO[i].w), w = t * pix * 1.2; col += vec3(.5, .55, .6) * smoothstep(w, 0., e) * .05 * uOrbA; }
    // the planet itself, from far off: its own colours, day and night, the rim of its air, a skin of cloud
    vec2 tp = sph(-uPp, rd, uPr * 1.015);
    if (tp.x > 0. && tp.x < hit) { vec2 tg = sph(-uPp, rd, uPr); vec3 sd = normalize(uSp - uPp);
      if (tg.x > 0. && tg.x < 1e29) { vec3 n = normalize(rd * tg.x - uPp); float la = asin(clamp(dot(n, uAx), -1., 1.)); vec3 e1 = normalize(cross(uAx, vec3(.31, .17, .93))), e2 = cross(uAx, e1);
        vec3 al = texture(uMap, vec2(atan(dot(n, e2), dot(n, e1)) / 6.2832 + .5, .5 + la / 3.1416)).rgb, cl = vec3(smoothstep(.45, .75, vn(n * 7. + uT * .002) * .6 + vn(n * 19.) * .4));
        float l = max(dot(n, sd), 0.); col = mix(al, vec3(.9), cl.x * .75) * uSc * l * .45 + uAirC * pow(1. - max(dot(n, -rd), 0.), 3.) * smoothstep(-.2, .3, dot(n, sd)) * .6;
        hit = tg.x; dist = tg.x; }
      else { vec3 q = rd * dot(uPp, rd) - uPp; float hh = (length(q) - uPr) / (uPr * .015); col += uAirC * exp(-hh * 3.) * .5 * smoothstep(-.2, .3, dot(normalize(q), normalize(uSp - uPp))); } }
    if (uRing1 > 0.) { float dn = dot(rd, uRingN); if (abs(dn) > 1e-6) { float t = dot(uPp, uRingN) / dn; float r = length(rd * t - uPp) / uPr;
      if (t > 0. && t < hit && r > uRing0 && r < uRing1) { float x = (r - uRing0) / (uRing1 - uRing0); col = mix(col, vec3(.75, .68, .58) * uSc * .3 * (.6 + .4 * sin(x * 60.)), .6 * (1. - pow(abs(x * 2. - 1.), 6.))); } } }
    if (hit < 1e29) dist = hit;
  }
  oC = vec4(col, 1.); oD = vec4(dist, 0, 0, 1);
}`);
  // ---- stars, class by class: each instance a cell round the camera; the cell's star, if it has one, a soft point
  const STAR_N = 6, SW = 2 * STAR_N + 1;
  const stars = prog(PRE + NOISE + `
layout(location = 0) in vec2 aC;
uniform ivec3 uCell; uniform vec3 uFrac, uCS, uCG, uGe1, uGe2, uGn; uniform float uC, uL, uK; uniform mat3 uM; uniform vec2 uPx;
out vec3 vCol; out vec2 vQ;
void main() {
  int i = gl_InstanceID, n = ${SW}; ivec3 o = ivec3(i % n, (i / n) % n, i / (n * n)) - ${STAR_N}; vec3 cell = vec3((uCell + o) & 1048575);
  vec3 h = h33(cell + uK * 17.13), j = h33(cell * 1.37 + uK * 3.1 + 7.7); vec3 rel = (vec3(o) + j - uFrac) * uC;   // where its star stands, from the camera
  vec3 gp = rel / ${KPC.toExponential()} + uCG, g = vec3(dot(gp, uGe1), dot(gp, uGe2), dot(gp, uGn));
  float p = .12 * stars3(g), d = length(rel / uC) * uC, edge = smoothstep(float(${STAR_N}) * uC, float(${STAR_N} - 1) * uC, max(abs(rel.x), max(abs(rel.y), abs(rel.z))));
  float dp = d / ${PC.toExponential()}, bri = uL * (.3 + 1.4 * h.y * h.y) / (dp * dp) * .3 * edge;
  if (h.x > p || bri < 2e-4 || length((rel + uCS) / ${PC.toExponential()}) < .3) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float T = 3000. + 2500. * pow(uK, .8) + 3000. * h.z;                       // brighter classes are hotter and bluer
  vCol = mix(vec3(1., .55, .25), vec3(.65, .75, 1.), clamp((T - 3000.) / 12000., 0., 1.)) * min(bri * 60., 8.);
  vec4 q = uVP * vec4(uM * rel, 1.); if (q.w <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float sz = 1.3 + min(2.5, sqrt(bri * 60.) * .5); vQ = aC; gl_Position = vec4(q.xy + aC * uPx * sz * q.w, 0., q.w);
}`, `#version 300 es
precision highp float; in vec3 vCol; in vec2 vQ; layout(location = 0) out vec4 oC;
void main() { float r = dot(vQ, vQ); if (r > 1.) discard; oC = vec4(vCol * exp(-r * 4.) * 2., 1.); }`);
  // ---- galaxies, and at larger scales clumps of them: the same lattice idea, megaparsec cells upward
  const GAL_N = 5, GW = 2 * GAL_N + 1;
  const gals = prog(PRE + NOISE + `
layout(location = 0) in vec2 aC;
uniform ivec3 uCell; uniform vec3 uFrac, uCG; uniform float uC, uJ; uniform mat3 uM; uniform vec2 uPx;
out vec3 vCol; out vec2 vQ; out vec4 vS;
void main() {
  int i = gl_InstanceID, n = ${GW}; ivec3 o = ivec3(i % n, (i / n) % n, i / (n * n)) - ${GAL_N}; vec3 cell = vec3((uCell + o) & 1048575);
  vec3 h = h33(cell + uJ * 11.7), j = h33(cell * 1.71 + uJ * 5.3 + 2.2); vec3 rel = (vec3(o) + j - uFrac) * uC, gm = rel / ${MPC.toExponential()} + uCG;
  float rho = web(gm), d = length(rel / uC) * uC, edge = smoothstep(float(${GAL_N}) * uC, float(${GAL_N} - 1) * uC, max(abs(rel.x), max(abs(rel.y), abs(rel.z))));
  float nearF = uJ > .5 ? smoothstep(uC * 1.2, uC * 2.5, d) : 1., size = uJ > .5 ? uC * .45 : (1.2 + 2.5 * h.z) * 1e21;
  float px = size / (d * uPix), sz = max(1.5, px);
  float sb = uJ > .5 ? .01 * pow(min(rho, 3.), 1.5) : .05 * (.4 + h.y), bri = sb * min(1., px * px / 2.25) * edge * nearF;   // a galaxy's face is as bright from any distance; too small to see, its light falls off
  if (((uJ < .5 && (h.x > min(rho, 1.) * .8 || length(gm) < .6)) || bri < 4e-4)) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec4 q = uVP * vec4(uM * rel, 1.); if (q.w <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vCol = mix(vec3(1., .85, .65), vec3(.75, .82, 1.), h.z) * bri;
  vS = vec4(h.yz, px, uJ); vQ = aC; gl_Position = vec4(q.xy + aC * uPx * sz * q.w, 0., q.w);
}`, `#version 300 es
precision highp float; in vec3 vCol; in vec2 vQ; in vec4 vS; layout(location = 0) out vec4 oC;
void main() {
  float r = length(vQ); if (r > 1.) discard; float b;
  if (vS.w > .5) b = exp(-r * r * 7.); else if (vS.z < 5.) b = exp(-r * r * 4.);                       // a clump, or a galaxy too small to show its shape
  else { float a = vS.x * 6.28, c = cos(a), s = sin(a); vec2 p = mat2(c, -s, s, c) * vQ; p.y /= .25 + .75 * vS.y;   // tilted to us
    float rr = length(p), th = atan(p.y, p.x); b = vS.y > .35 ? exp(-rr * 4.) * (.5 + .5 * pow(.5 + .5 * cos(2. * th - 9. * log(rr + .05)), 3.)) + exp(-rr * rr * 60.) * 2. : exp(-rr * rr * 6.) * 1.5;
    b *= smoothstep(1., .7, rr) * 1.6; }
  oC = vec4(vCol * b, 1.); }`);
  const quad = gl.createVertexArray(); gl.bindVertexArray(quad); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
  const vq = gl.createVertexArray();

  // ---- each planet's system, galaxy and place in the universe, from its genome --------------------------------------
  const systems = new Map();
  function system(G) {
    if (systems.has(G.n)) return systems.get(G.n);
    const r = rng(G.n * 4111 + 7), a = AU * (G.starK / 5800) ** 2, planets = [];
    const radii = [0.39, 0.72, 1, 1.52, 2.8, 5.2, 9.5, 19.2, 30].map((k) => k * (0.85 + 0.3 * r()));
    const home = 2 + (G.n % 2);                                            // which orbit is ours
    radii.slice(0, 5 + floor(r() * 4)).forEach((k, i) => { if (i === home) return; const giant = k > 2.5;
      planets.push({ k, R: (giant ? 2.5e7 + r() * 5e7 : 2.5e6 + r() * 5e6), ph: r() * 6.283, col: giant ? [0.8 + 0.2 * r(), 0.65 + 0.2 * r(), 0.45 + 0.4 * r()] : [0.45 + 0.4 * r(), 0.35 + 0.3 * r(), 0.3 + 0.3 * r()], giant }); });
    const n = nrm([r() - 0.5, r() - 0.5, r() - 0.5]), e1 = nrm(cross(n, [0.3, 0.9, 0.2])), e2 = cross(n, e1), ga = r() * 6.283;
    const S = { a, Rs: a * G.sunSize, planets, home, radii, gal: { n, e1, e2, toC: add(e1.map((x) => x * cos(ga)), e2, sin(ga)), arms: r() < 0.5 ? 2 : 4, tw: 4 + r() * 3 } };
    systems.set(G.n, S); return S;
  }
  // the colour of the planet from far off: a map, filled a few rows a frame
  const maps = new Map(), MW = 256, MH = 128;
  function map(G) {
    let m = maps.get(G.id); if (!m) { m = { tex: gl.createTexture(), px: new Uint8Array(MW * MH * 4), row: 0 }; gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, MW, MH); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); maps.set(G.id, m); }
    if (m.row < MH) {
      const ax = G.axis, e1 = nrm(cross(ax, [0.31, 0.17, 0.93])), e2 = cross(ax, e1), sp = G.species, can = sp.length ? sp.reduce((c, s) => c.map((v, i) => v + s.canopy[i] / sp.length), [0, 0, 0]) : G.grass;
      for (let y = m.row; y < min(MH, m.row + 6); y++) for (let x = 0; x < MW; x++) {
        const la = ((y + 0.5) / MH - 0.5) * PI, lo = ((x + 0.5) / MW - 0.5) * 2 * PI, u = add(add(ax.map((v) => v * sin(la)), e1, cos(la) * cos(lo)), e2, cos(la) * sin(lo)), p = u.map((v) => v * G.R);
        const h = H(G, p, 10), c = climate(G, p, h); let col;
        if (h < 0) col = G.liquid.map((v) => v * 6 * exp(h / 3000) + 0.01);
        else { const g = c.W < 0.25 ? G.sand : c.W < 0.45 ? G.grassDry : G.grass, f = forestF(G, p, h, c.T, c.W); col = g.map((v, i) => v * (1 - f) + can[i] * f); if (h > 2500) col = G.rock; if (c.T < -6) col = [0.8, 0.83, 0.88]; }
        col.forEach((v, i) => { m.px[(y * MW + x) * 4 + i] = min(255, 255 * sqrt(max(0, v))) ; }); m.px[(y * MW + x) * 4 + 3] = 255;
      }
      m.row = min(MH, m.row + 6);
      gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MW, MH, gl.RGBA, gl.UNSIGNED_BYTE, m.px);
    }
    return m.tex;
  }
  // the inertial frame turns once a day against the planet's
  const spin = (G, v) => { const a = -2 * PI * (G.t || 0), c = cos(a), s = sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; };   // inertial -> planet
  const unspin = (G, v) => { const a = 2 * PI * (G.t || 0), c = cos(a), s = sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; };
  function layout(G, cam) {
    const Y = system(G), sd = unspin(G, sunAt(G, G.t || 0)), star = sd.map((v) => v * Y.a);   // inertial, from the planet
    const on = nrm(add([0, 0, 1], sd, -sd[2])), e1 = sd.map((v) => -v), e2 = cross(on, e1), yr = (G.t || 0) / G.yearD;
    const bodies = Y.planets.map((p) => { const ra = Y.a * p.k / Y.radii[Y.home], ph = p.ph + 2 * PI * yr / (p.k / Y.radii[Y.home]) ** 1.5; return { c: add(star, add(e1.map((v) => v * cos(ph) * ra), e2, sin(ph) * ra), -1), R: p.R, col: p.col, giant: p.giant, ra }; });
    G.moons.forEach((q) => { const d = [cos(q[1]) * cos(q[2]), sin(q[1]) * cos(q[2]), sin(q[2])], dist = 60 * G.R; bodies.push({ c: unspin(G, d).map((v) => v * dist), R: q[0] * dist, col: [0.6, 0.58, 0.55], giant: false }); });
    const orbits = [{ c: star, r: Y.a }, ...bodies.filter((b) => b.ra).map((b) => ({ c: star, r: b.ra }))];
    const camI = unspin(G, cam.P), gc = add(star, Y.gal.toC, -8.2 * KPC);   // the galaxy's centre: 8 kpc in from the star, which sits near the mid-plane
    return { Y, star, on, bodies, orbits, camI, gc };
  }
  const basis = (cam, W, H) => { const d = [cos(cam.pitch) * sin(cam.yaw), sin(cam.pitch), cos(cam.pitch) * cos(cam.yaw)], l = hypot(d[0], d[2]) || 1, r = [-d[2] / l, 0, d[0] / l], u = cross(r, d), t = Math.tan(cam.fov / 2); return { d, r, u, tan: [t * W / H, t] }; };
  const toLoc = (S, v) => [0, 1, 2].map((i) => S.F[i][0] * v[0] + S.F[i][1] * v[1] + S.F[i][2] * v[2]);
  return {
    COS,
    // mode 0: behind the air (from the ground or near the planet): the galaxy, the stars, the far galaxies
    // mode 1: from far off: also the star, the planets and moons, orbits and the planet itself
    draw(common, cam, G, S, mode, W, Hh) {
      const Lo = layout(G, cam), Y = Lo.Y, b = basis(cam, W, Hh), sp = (v) => spin(G, v), rel = (v) => sp(add(v, Lo.camI, -1));   // inertial positions to planet-frame, camera-relative
      gl.useProgram(bg.p); common(bg); gl.uniform3fv(bg.uR, b.r); gl.uniform3fv(bg.uU, b.u); gl.uniform3fv(bg.uF, b.d); gl.uniform2fv(bg.uTan, b.tan); gl.uniformMatrix3fv(bg.uLP, false, S.F.flat());
      gl.uniform3fv(bg.uGc, rel(Lo.gc).map((v) => v / KPC)); gl.uniform3fv(bg.uGe1, sp(Y.gal.e1)); gl.uniform3fv(bg.uGe2, sp(Y.gal.e2)); gl.uniform3fv(bg.uGn, sp(Y.gal.n)); gl.uniform1f(bg.uArms, Y.gal.arms); gl.uniform1f(bg.uTw, Y.gal.tw);
      const far = hypot(...add(Lo.camI, Lo.gc, -1)); gl.uniform1f(bg.uCmb, min(1, max(0, (Math.log10(far) - 24.7) / 1.3))); const gk = far / KPC; gl.uniform1f(bg.uGg, 1 + 3 * min(1, max(0, (gk - 10) / 30)));   // seen from outside, a galaxy is brighter to the eye than its band is from within
      const dS0 = hypot(...add(Lo.camI, Lo.star, -1)), farS = mode === 1 && dS0 > 3e15; gl.uniform1i(bg.uMode, farS ? 2 : mode);   // far off, the system is only its star's point (and floats would overflow)
      gl.uniform3fv(bg.uSd, nrm(rel(Lo.star))); gl.uniform3fv(bg.uSc, G.sunCol); gl.uniform1f(bg.uSb, mode ? min(50, 18 * (G.starK / 5800) ** 4 / (dS0 / PC) ** 2) : 0);
      if (mode === 1 && !farS) {
        gl.uniform3fv(bg.uSp, rel(Lo.star)); gl.uniform1f(bg.uSr, Y.Rs); gl.uniform3fv(bg.uSc, G.sunCol); gl.uniform3fv(bg.uPp, cam.P.map((v) => -v)); gl.uniform1f(bg.uPr, G.R); gl.uniform3fv(bg.uAx, G.axis);
        gl.uniform3fv(bg.uAirC, G.beta.map((v) => v / max(...G.beta) * 0.5)); gl.uniform3fv(bg.uOn, sp(Lo.on));
        const B = new Float32Array(48), C = new Float32Array(48); Lo.bodies.slice(0, 12).forEach((o, i) => { B.set([...rel(o.c), o.R], i * 4); C.set([...o.col, o.giant ? 1 : 0], i * 4); });
        gl.uniform4fv(bg.uB, B); gl.uniform4fv(bg.uBc, C); gl.uniform1i(bg.uNb, min(12, Lo.bodies.length));
        const O = new Float32Array(36); Lo.orbits.slice(0, 9).forEach((o, i) => O.set([...rel(o.c), o.r], i * 4)); gl.uniform4fv(bg.uO, O); gl.uniform1i(bg.uNo, min(9, Lo.orbits.length));
        const dS = dS0; gl.uniform1f(bg.uOrbA, min(1, max(0, (S.cy - 3e8) / 1e9)) * min(1, max(0, (Y.a * 300 - dS) / (Y.a * 200))));
        const tl = G.ringTilt; gl.uniform3fv(bg.uRingN, [sin(tl), 0, cos(tl)]); gl.uniform1f(bg.uRing0, G.rings ? 1.25 : 0); gl.uniform1f(bg.uRing1, G.rings);
        gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, map(G)); gl.uniform1i(bg.uMap, 5); gl.activeTexture(gl.TEXTURE0);
      } else { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, map(G)); gl.uniform1i(bg.uMap, 5); gl.activeTexture(gl.TEXTURE0); }
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, mode === 1 ? gl.COLOR_ATTACHMENT1 : gl.NONE]); gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3);
      // the stars and galaxies, added on top
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.bindVertexArray(quad);
      const Mm = [0, 1, 2].map((c) => toLoc(S, sp([0, 1, 2].map((k) => (k === c ? 1 : 0)))));   // inertial -> camera-local, as columns
      const M = [Mm[0][0], Mm[0][1], Mm[0][2], Mm[1][0], Mm[1][1], Mm[1][2], Mm[2][0], Mm[2][1], Mm[2][2]], px = [2 / W, 2 / Hh];
      const camS = add(Lo.camI, Lo.star, -1), camG = add(Lo.camI, Lo.gc, -1), wrap = (x) => ((x % 1048576) + 1048576) % 1048576;
      gl.useProgram(stars.p); common(stars); gl.uniformMatrix3fv(stars.uM, false, M); gl.uniform2fv(stars.uPx, px); gl.uniform3fv(stars.uCS, camS); gl.uniform3fv(stars.uCG, camG.map((v) => v / KPC));
      gl.uniform3fv(stars.uGe1, Y.gal.e1); gl.uniform3fv(stars.uGe2, Y.gal.e2); gl.uniform3fv(stars.uGn, Y.gal.n);
      for (let k = 0; k < 11; k++) { const c = PC * 2 ** k, f = camS.map((v) => v / c), ci = f.map(floor); if (hypot(...camS) > c * 2e6) continue;
        gl.uniform3i(stars.uCell, ...ci.map(wrap)); gl.uniform3fv(stars.uFrac, f.map((v, i) => v - ci[i])); gl.uniform1f(stars.uC, c); gl.uniform1f(stars.uL, 0.05 * 4 ** k); gl.uniform1f(stars.uK, k);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, SW * SW * SW); }
      gl.useProgram(gals.p); common(gals); gl.uniformMatrix3fv(gals.uM, false, M); gl.uniform2fv(gals.uPx, px); gl.uniform3fv(gals.uCG, camG.map((v) => v / MPC));
      for (let j = 0; j < 10; j++) { const c = MPC * 2 ** j, f = camG.map((v) => v / c), ci = f.map(floor); if (hypot(...camG) < 2e21 && j > 0) continue;
        gl.uniform3i(gals.uCell, ...ci.map(wrap)); gl.uniform3fv(gals.uFrac, f.map((v, i) => v - ci[i])); gl.uniform1f(gals.uC, c); gl.uniform1f(gals.uJ, j);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, GW * GW * GW); }
      gl.disable(gl.BLEND); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); gl.bindVertexArray(null);
    },
    // what is near: for the readout
    where(G, cam) { const Lo = layout(G, cam), dS = hypot(...add(Lo.camI, Lo.star, -1)), dG = hypot(...add(Lo.camI, Lo.gc, -1)); return { dS, dG, a: Lo.Y.a, toG: spin(G, add(Lo.gc, Lo.camI, -1)), toS: spin(G, add(Lo.star, Lo.camI, -1)) }; },
  };
}
