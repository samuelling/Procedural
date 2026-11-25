// Worlds, continuous: a family of invented planets, each grown from its own genome (planet.js), each viewed at any
// scale without a cut, from the whole globe down to the cells of a leaf, and joined by wormholes (wormhole.js).
import { K, sOf, H, genome, octTable, climate, GLSL_NOISE, GLSL_GROUND, GLSL_CLIMATE, MASKK, octN, TREE, AX, LOT } from './planet.js';
import { mkCity } from './city.js';
import { mkFauna } from './fauna.js';
import { mkTrees } from './trees.js';
import { mkCover } from './cover.js';
import { mkSky } from './sky.js';
import { mkHoles } from './wormhole.js';

const $ = (id) => document.getElementById(id), canvas = $('c');
const gl = canvas.getContext('webgl2', { antialias: false, depth: false, alpha: false, powerPreference: 'high-performance' });
if (!gl || !gl.getExtension('EXT_color_buffer_float')) { $('err').hidden = false; throw new Error('no WebGL2 float targets'); }
const { sin, cos, min, max, abs, floor, round, log2, exp, hypot, sqrt, acos, PI } = Math;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = (v) => { const l = hypot(...v) || 1; return v.map((q) => q / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const madd = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// ---- shared shader parts -------------------------------------------------------------------------------------------
// depth is logarithmic in distance, written per pixel: from a micrometre to a hundred thousand kilometres in one buffer.
// air(): what lies between the eye and a point. The air thins with height (the planet's own scale height); what it
// scatters is the planet's own colour (blue on Sylva; ochre, teal or violet elsewhere), lit by its own star.
export const PRE = `#version 300 es
precision highp float; precision highp int;
uniform mat4 uVP; uniform vec3 uSun, uSunC, uSky; uniform float uT, uPix, uAlt, uHs; uniform vec3 uBeta;
float fdep(float w) { return log2(max(w, 1e-7) * 1e7 + 1.) / 50.; }
// sun shadows: one map from the star's side, round the camera's foot, sized to how high the camera is. uSh is 0 when
// drawing as usual, 1 while drawing the shadow casters into the map, 2 when there is no map
uniform highp sampler2D uShT; uniform mat4 uShM; uniform float uSh, uShK, uShC, uShB;
float shadow(vec3 p) {
  if (uSh != 0.) return 1.; vec4 c = uShM * vec4(p, 1.); vec2 uv = c.xy * .5 + .5; if (any(lessThan(uv, vec2(.002))) || any(greaterThan(uv, vec2(.998)))) return 1.;
  float d = dot(p, uSun) + uShB, s = 0.; vec2 px = 1. / vec2(textureSize(uShT, 0));
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += step(texture(uShT, uv + vec2(i, j) * px * 1.2).r, d);
  vec2 e = min(uv, 1. - uv); return mix(1., s / 9., smoothstep(0., .08, min(e.x, e.y)));
}
#define CAST if (uSh == 1.) { oC = vec4(dot(vP, uSun)); gl_FragDepth = clamp(.5 - (dot(vP, uSun) - uShC) * uShK, 0., 1.); return; }
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = p - i; f = f * f * (3. - 2. * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + 1.), f.x), f.y); }
vec3 air(vec3 col, vec3 rd, float d, float y0, float y1) {
  float a = exp(-clamp(y0, -100., 3e5) / uHs), b = exp(-clamp(y1, -100., 3e5) / uHs), od = d * (abs(y1 - y0) > 1. ? (a - b) * uHs / (y1 - y0) : a);
  vec3 tr = exp(-od * uBeta * 1.4); float mu = dot(rd, uSun), ph = .75 * (1. + mu * mu);
  vec3 sc = uSunC * (uBeta / max(max(uBeta.x, uBeta.y), uBeta.z)) * ph * .25 * smoothstep(-.15, .1, uSun.y + .1) + uSunC * .5 * pow(max(mu, 0.), 8.) * .15 + uSky * .05;
  return col * tr + sc * (1. - tr);
}
`;
export const prog = (vs, fs) => {
  const p = gl.createProgram();
  for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n')); gl.attachShader(p, s); }
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), U = { p };
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, a.name); }
  return U;
};

// ---- the planets and the camera ------------------------------------------------------------------------------------
const SH = { size: 2048, VP: new Float32Array(16), on: false, cast: false, k: 0, c: 0, bias: 0 };
const PLANETS = 6, worlds = [];
let holes = null;
const world = (n) => worlds[n] || (worlds[n] = genome(n));
let G = world(0);
holes = mkHoles(gl, prog, null, world, PLANETS);
// the camera: a position in planet metres (doubles), a reference direction carried along the surface as it moves
// (so 'ahead' stays ahead), and a turn and tilt relative to the ground under it
const cam = { P: [0, 0, G.R], ref: [1, 0, 0], yaw: 0.6, pitch: -0.12, fov: 55 * PI / 180 };
function axes() {                                                          // local axes: x right-handed, y up, z the carried reference
  const u = nrm(cam.P); let z = madd(cam.ref, u, -dot(cam.ref, u)); if (hypot(...z) < 1e-6) z = madd([0, 1, 0], u, -u[1]); z = nrm(z); cam.ref = z;
  return [cross(u, z), u, z];
}
const toLocal = (F, v) => [dot(v, F[0]), dot(v, F[1]), dot(v, F[2])], toPlanet = (F, v) => [F[0][0] * v[0] + F[1][0] * v[1] + F[2][0] * v[2], F[0][1] * v[0] + F[1][1] * v[1] + F[2][1] * v[2], F[0][2] * v[0] + F[1][2] * v[1] + F[2][2] * v[2]];
const ground = (p) => H(G, p);
const alt = () => hypot(...cam.P) - G.R;
// a good place to stand on a planet: temperate, wooded, gentle, and with the star well up
function landing(Gp) {
  let best = null, bs = -1e9; const r = (i) => [(i * 0.618034) % 1, (i * 0.754877) % 1];
  for (let i = 1; i < 2500; i++) {
    const [a, b] = r(i), z = b * 2 - 1, s = sqrt(1 - z * z), p = [s * cos(a * 6.2832) * Gp.R, s * sin(a * 6.2832) * Gp.R, z * Gp.R], h = H(Gp, p); if (h < 30) continue;
    const c = climate(Gp, p, h), u = nrm(p), sun = dot(u, Gp.sunDir); if (sun < 0.35) continue;
    const sl = abs(H(Gp, madd(p, nrm(cross(u, [0.3, 0.5, 0.8])), 12)) - h) + abs(H(Gp, madd(p, nrm(cross(u, [0.9, 0.1, 0.2])), 12)) - h);
    const sc = -abs(c.W - 0.7) * 3 - abs(sun - 0.75) * 2 - sl * 0.3 - (h > 2500 ? 3 : 0) + (c.T > -3 && c.T < 24 ? 1 : 0);
    if (sc > bs) { bs = sc; best = p; }
  }
  return best || [0, 0, Gp.R];
}
function arrive(n, P, look) {                                              // stand on planet n (at P, or near its first wormhole)
  G = world(n); let p = P;
  if (!p) { const m = holes.mouths(n)[0], u0 = m.u, t = nrm(cross(u0, [0.31, 0.52, 0.79])); let best = null, bs = -1e9;
    for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832, dd = 1200 + (k % 3) * 400, dir = nrm(madd(t.map((v) => v * cos(a)), cross(u0, t), sin(a))), q = nrm(madd(u0, dir, dd / G.R)).map((v) => v * G.R), h = H(G, q); if (h < 5) continue; const c = climate(G, q, h), sc = -abs(c.W - 0.65) - (h > 2500 ? 2 : 0); if (sc > bs) { bs = sc; best = q; } }
    p = best || landing(G); look = madd(m.C, p, -1); }
  const u = nrm(p), h = H(G, p);
  cam.P = u.map((v) => v * (G.R + max(h, 0) + 1.7)); cam.ref = nrm(cross(u, cross([0.2, 0.9, 0.3], u)));
  if (look) { cam.ref = nrm(madd(look, u, -dot(look, u))); cam.yaw = 0; cam.pitch = 0.04; }
  setLight(); hint();
}

// ---- the ground: nested square rings of a 64-cell grid around the camera's foot, each twice the last, laid on the
// sphere by distance along it (so a ring is a ring of the globe however far it reaches) ---------------------------
const N = 64, Hh = N / 2;
const CLIM = GLSL_CLIMATE(G);
const SPEC = `uniform vec4 uSpN[8], uSpC[8]; uniform int uNsp;`;
const tprog = prog(PRE + GLSL_NOISE + GLSL_GROUND + `
layout(location = 0) in vec2 aG;
uniform vec3 uLv; uniform float uH0, uSea, uG0;
out vec3 vP, vQ, vGr; out vec2 vPl; out float vW, vCe, vH, vM;
void main() {
  float c = uLv.z, m = smoothstep(.72, .94, max(abs(aG.x), abs(aG.y)) / ${Hh}.);   // the outer band blends into the next ring's coarser grid
  vec2 g = aG - fract(aG * .5) * 2. * m, p = uLv.xy + g * c; float ce = c * (1. + m);
  float r = length(p), th = min(r / uR, 3.1); vec2 dir = r > 0. ? p / r : vec2(0.);
  float sx = th > 1e-4 ? sin(th) / th : 1. - th * th / 6., s2 = sin(th * .5);
  vec3 q = vec3(dir.x * r * sx, -2. * s2 * s2 * uR, dir.y * r * sx);    // the point on the sphere, from the foot
  float dh; vec3 gr; vM = ground(q, ce, dh, gr);
  float h = uG0 + dh; vH = h; vQ = q; vGr = gr; vCe = ce; vPl = p;
  float hv = max(h, 0.);                                                 // the sea is a surface of its own
  vP = q + vec3(0., uH0 + (hv - uG0), 0.) + q * (hv / uR);
  vec4 qq = uVP * vec4(vP, 1.); vW = qq.w; gl_Position = vec4(qq.xy, 0., qq.w);
}`, PRE + GLSL_NOISE + GLSL_GROUND + CLIM + SPEC + `
in vec3 vP, vQ, vGr; in vec2 vPl; in float vW, vCe, vH, vM;
uniform float uG0, uNight; uniform vec4 uFine; uniform vec3 uFoot, uTf, uLf; uniform ivec3 uTb, uLb; uniform mat3 uF;
uniform vec3 uGrass, uDry, uSoil, uRock, uSand, uLiq;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
float vor(vec2 u, out float id) { vec2 i = floor(u), f = u - i; float d = 9.; id = 0.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(h1(i + o), h1(i + o + 7.3)) - f; float e = dot(r, r); if (e < d) { d = e; id = h1(i + o + 3.1); } } return sqrt(d); }
void main() {
  if (vPl.x > uFine.x && vPl.x < uFine.z && vPl.y > uFine.y && vPl.y < uFine.w) discard;   // a finer ring is drawn here
  float d = length(vP), fp = max(vW * uPix, 1e-9);
  vec3 gr = vGr;                                                           // finer octaves, for the light only, down to the pixel
  for (int k = 0; k < ${K}; k++) { float s = sOf(k); if (s > vCe * 2.5) continue; if (s < fp * 1.5) break; float w = (1. - clamp(s / vCe - 1.5, 0., 1.)) * clamp(s / fp * .5 - .75, 0., 1.); float a = OT(k, 1).w * (OT(k, 6).y > .5 ? vM : 1.); gr += oct(k, vQ).yzw * a * w; }
  vec3 up = normalize(vec3(0., 1., 0.) + vQ / uR), n = normalize(up - (gr - up * dot(gr, up)));
  float hA = vH, sl = 1. - dot(n, up);
  bool sea = hA < 0.;
  vec3 cl = climate(vQ, hA); float T = cl.x, W = cl.y;
#define NF(q, S) mix(n2((q) / (S)), .5, smoothstep(.2, .8, fp / (S)))   // a noise, smoothed to its mean once a pixel covers it
  vec3 D = uF * vQ, ab = abs(uFoot + D); vec2 wp = ab.x > ab.y && ab.x > ab.z ? D.yz : ab.y > ab.z ? D.zx : D.xy;   // a flat map of the nearby ground, for small textures
  // what the ground is made of, as it would look from far off: forest, grassland, desert, rock, snow and ice, beach
  float fo = forestF(vQ, hA, T, W, fp);
  vec3 grass = mix(uDry, uGrass, smoothstep(.25, .6, W)) * (.85 + .3 * NF(wp, 40.));
  vec3 alb = mix(uSand * (.9 + .2 * NF(wp, 300.)), grass, smoothstep(.12, .3, W));
  vec3 rock = uRock * (.8 + .4 * NF(wp, 9.));
  // the forest's mean colour: its species, weighted by how well each suits this place
  vec3 can = vec3(0.); float cw = 0.;
  for (int i = 0; i < 8; i++) { if (i >= uNsp) break; vec4 s = uSpN[i]; float w = exp(-pow((T - s.x) / s.y, 2.) - pow((W - s.z) / s.w, 2.)); can += uSpC[i].rgb * w; cw += w; }
  can = cw > 1e-4 ? can / cw : uGrass; fo *= smoothstep(1e-4, .05, cw);
  float far = smoothstep(80., 420., d);                                    // under trees you see the floor; from far, their crowns
  alb = mix(alb, mix(uSoil, can * (.85 + .3 * NF(wp, 7.)), far), fo);
  alb = mix(alb, rock, smoothstep(.42, .62, sl + .1 * NF(wp, 30.)) * (1. - fo * .7));
  // from above, a forest is crowns: one per tree site (the same sites the trees stand on), dark gaps between
  vec3 nl = n; float cf = fo * far;
  if (cf > 0.) { float kc = smoothstep(5., 1.2, fp), sm = .7;
    if (kc > 0.) {
      int a = ab.x > ab.y && ab.x > ab.z ? 0 : ab.y > ab.z ? 1 : 2, b = a == 0 ? 1 : a == 1 ? 2 : 0, c2 = a == 0 ? 2 : a == 1 ? 0 : 1, fk = a * 2 + (uFoot[a] + D[a] > 0. ? 1 : 0);
      vec2 tc = vec2(uTf[b] + D[b] / ${TREE}., uTf[c2] + D[c2] / ${TREE}.); ivec2 ci = ivec2(floor(tc)), base = ivec2(uTb[b], uTb[c2]); float best = 0.; vec3 cn = up;
      vec3 eb = vec3(uF[0][b], uF[1][b], uF[2][b]), ec = vec3(uF[0][c2], uF[1][c2], uF[2][c2]), tx = normalize(eb - up * dot(eb, up)), tz = normalize(ec - up * dot(ec, up));   // (the plane's axes, as seen on the ground here)
      for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { ivec2 cc = ci + ivec2(i, j), gc = cc + base; if (hs2(gc, 60 + fk) > fo) continue;
        vec2 dv = tc - (vec2(cc) + .15 + .7 * vec2(hs2(gc, 40 + fk), hs2(gc, 50 + fk)));
        float R = .45 * (.8 + .4 * hs2(gc, 80 + fk)), qq = dot(dv, dv) / (R * R);
        if (qq < 1.) { float t = sqrt(1. - qq); if (t > best) { best = t; cn = normalize(up * t + (tx * dv.x + tz * dv.y) / R); } } }
      float cs = best > 0. ? .72 + .5 * best : .35; nl = normalize(mix(n, cn, kc * cf)); sm = mix(sm, cs, kc); }
    alb *= mix(1., sm, cf); }
  // towns: paved ground and roofs from afar, the street grid nearer, and after dark their lights
  float rho = sea ? 0. : cityRho(vQ) * citySuit(hA, T, W, sl); vec3 em = vec3(0.);
  if (rho > .01) {
    int a = ab.x > ab.y && ab.x > ab.z ? 0 : ab.y > ab.z ? 1 : 2, b = a == 0 ? 1 : a == 1 ? 2 : 0, c2 = a == 0 ? 2 : a == 1 ? 0 : 1;
    vec2 lt = vec2(uLf[b] + D[b] / ${LOT}., uLf[c2] + D[c2] / ${LOT}.); ivec2 li = ivec2(floor(lt)) + ivec2(uLb[b], uLb[c2]); vec2 lf = fract(lt);
    float sx = (li.x & 3) == 0 ? smoothstep(.36, .3, lf.x) : 0., sy = (li.y + 1000000) % 5 == 0 ? smoothstep(.3, .24, lf.y) : 0., road = max(sx, sy), kr = smoothstep(25., 6., fp);
    road = mix(.3, road, kr); float park = step(hs2(li / ivec2(4, 5), 123), .12);
    vec3 paved = mix(vec3(.2, .2, .2), vec3(.07, .07, .075) * (1. + .3 * NF(wp, .05)), road);
    if (kr > 0. && road > .5 && fp < .3) paved = mix(paved, vec3(.8, .75, .5), smoothstep(.02, .0, abs(fract((sx > .5 ? lt.x : lt.y) + .5) - .5 - .0) * ${LOT}. - .1) * step(.5, fract((sx > .5 ? lt.y : lt.x) * 6.)) * .8);   // lane markings
    float urb = smoothstep(.02, .25, rho) * (1. - park * (1. - road));
    alb = mix(alb, paved, urb); fo *= 1. - urb;
    em = vec3(1., .72, .38) * uNight * rho * (road * 1.4 + (1. - road) * .25 * step(.6, h1(vec2(li) * .37))) * mix(.6, 1., kr);   // street lights and windows
  }
  alb = mix(alb, uSand, smoothstep(5., 1.5, hA) * (1. - fo));               // beaches
  float snow = smoothstep(-3., -9., T + 3. * NF(wp, 500.)) * smoothstep(.8, .5, sl);   // snow and ice where it is cold enough
  alb = mix(alb, vec3(.8, .83, .88), snow);
  // close up: the floor's own grain, scale by scale, each fading in as it grows big enough to see
  float id, g1 = vor(wp / .03, id);
  float k1 = smoothstep(.06, .015, fp); alb *= mix(1., .8 + .35 * id - .3 * smoothstep(.3, .75, g1), k1 * (1. - far));
  float id2, g2 = vor(wp / .0012, id2);
  float k2 = smoothstep(.002, .0005, fp); vec3 grain = id2 < .7 ? uSoil * .5 * (.7 + .6 * id2) : id2 < .82 ? uRock * .85 : id2 < .92 ? uSand * .6 : uRock * .2;   // crumbs of soil, and mineral grains
  grain *= .6 + .55 * sqrt(max(0., 1. - g2 * g2 * 1.6));
  alb = mix(alb, grain * (1. - .5 * smoothstep(.35, .75, g2)), k2 * .85 * (1. - far));
  float id3, g3 = vor(wp / 4e-5, id3);
  float k3 = smoothstep(6e-5, 1.5e-5, fp); alb = mix(alb, alb * (.7 + .6 * id3) * (1. - .4 * smoothstep(.4, .8, g3)), k3);
  vec3 col; float sh = max(dot(up, uSun), 0.);
  if (sea) {
    vec3 v = normalize(vP), wn = normalize(up + (vec3(n2(wp / 9. + uT * .3), 0., n2(wp / 7. - uT * .25)) - .5) * .06 * smoothstep(3e3, 50., d)), r = reflect(v, wn);
    float fr = .02 + .98 * pow(1. - max(dot(-v, wn), 0.), 5.), dep = clamp(-hA / 40., 0., 1.);
    vec3 below = mix(alb * uSunC * sh * .5, uLiq * (uSunC * sh + uSky * .5), dep);
    col = mix(below, uSky * .8 * (.3 + .7 * sh) + uSunC * pow(max(dot(r, uSun), 0.), 600.) * 12., fr);
  } else { float dif = max(dot(nl, uSun), 0.) * shadow(vP), am = .55 + .45 * dot(nl, up); col = alb * (uSunC * dif + uSky * am * .55 * (.15 + .85 * smoothstep(-.2, .2, dot(up, uSun)))); }
  col += em;
  col = air(col, normalize(vP), d, uAlt, max(hA, 0.));
  oC = vec4(col, 1.); oD = vec4(d, 0, 0, 1); gl_FragDepth = fdep(vW);
}`);
const grid = (() => {
  const v = [], full = [], ring = [], w = N + 1;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) v.push(i - Hh, j - Hh);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = i + j * w, q = [a, a + w, a + 1, a + 1, a + w, a + w + 1]; full.push(...q); const ci = i - Hh, cj = j - Hh; if (!(ci >= -15 && ci < 15 && cj >= -15 && cj < 15)) ring.push(...q); }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([...full, ...ring]), gl.STATIC_DRAW);
  gl.bindVertexArray(null); return { vao, nf: full.length, nr: ring.length };
})();

// ---- per frame: the octave table for the camera's foot, as a texture every shader reads -----------------------------
const octTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, octTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
const S = {};                                                              // this frame's shared state
function octaves(F) {
  const u = F[1], foot = u.map((v) => v * G.R), T = octTable(G, foot, F);
  gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, octTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 7, T.length / 28, 0, gl.RGBA, gl.FLOAT, T); gl.activeTexture(gl.TEXTURE0);
  S.foot = foot; S.F = F; S.m0 = (() => { const n = octN(G, MASKK, foot), b = 1 - abs(2 * n - 1), t = min(1, max(0, (b - 0.55) / 0.35)); return 0.25 + 1.6 * G.ridge * t * t * (3 - 2 * t); })();
  S.axis = toLocal(F, G.axis); S.sun = toLocal(F, G.sunDir);
  S.tb = foot.map((v) => floor(v / TREE)); S.tf = foot.map((v, i) => v / TREE - S.tb[i]); S.lb = foot.map((v) => floor(v / LOT)); S.lf = foot.map((v, i) => v / LOT - S.lb[i]);
  S.night = min(1, max(0, (0.06 - S.sun[1]) / 0.16));
}
// every program that reads the ground calls this
const setNoise = (P) => {
  gl.uniform1i(P.uOct, 7); gl.uniform1i(P.uKs, G.kseed); gl.uniform1f(P.uR, G.R); gl.uniform1f(P.uMaskR, G.ridge); gl.uniform1f(P.uM0, S.m0);
  if (P.uFootP) { gl.uniform3fv(P.uFootP, S.foot); gl.uniformMatrix3fv(P.uFrm, false, S.F.flat()); gl.uniform1i(P.uCities, G.cities ? 1 : 0); }
  if (P.uAxis) { gl.uniform3fv(P.uAxis, S.axis); gl.uniform1f(P.uTeq, G.Teq); gl.uniform1f(P.uTgrad, G.Tgrad); gl.uniform1f(P.uWet, G.wet); gl.uniform1f(P.uGrav, G.g); }
  if (P.uSpN) { const a = new Float32Array(32), c = new Float32Array(32); G.species.forEach((s, i) => { if (i < 8) { a.set([s.T[0], s.T[1], s.W[0], s.W[1]], i * 4); c.set([...s.canopy, 0], i * 4); } }); gl.uniform4fv(P.uSpN, a); gl.uniform4fv(P.uSpC, c); gl.uniform1i(P.uNsp, min(8, G.species.length)); }
};

// ---- targets: the scene in high range, and the distance to whatever each pixel shows (for picking) ----------------
let FB = null;
function targets(w, h) {
  if (FB && FB.w === w && FB.h === h) return;
  if (FB) { gl.deleteFramebuffer(FB.f); for (const t of FB.t) gl.deleteTexture(t); gl.deleteRenderbuffer(FB.d); }
  const tex = (fmt) => { const t = gl.createTexture(), fl = fmt === gl.RGBA32F ? gl.NEAREST : gl.LINEAR; gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, fl); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, fl); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const f = gl.createFramebuffer(), t = [tex(gl.RGBA16F), tex(gl.RGBA32F)], d = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT32F, w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t[0], 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, t[1], 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  FB = { f, t, d, w, h };
}
const HPOST = mkHolesPost();
const shFB = (() => {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, SH.size, SH.size);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.activeTexture(gl.TEXTURE0); const f = gl.createFramebuffer(), d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, SH.size, SH.size);
  gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { f, t };
})();
// the star's view: square, round the ground below and ahead of the camera, as wide as the shadows that can matter
function shadowPass() {
  SH.on = S.hc < 1500 && L.sun[1] > 0.02; if (!SH.on) return;
  const E = min(1500, max(60, S.hc * 25)), Ld = L.sun, d = dir(cam.yaw, 0), C = [d[0] * E * 0.45, S.g0 - S.cy, d[2] * E * 0.45];
  const f = Ld.map((v) => -v), r = nrm(abs(f[1]) > 0.99 ? [1, 0, 0] : cross(f, [0, 1, 0])), u = cross(r, f);
  const k = 1 / E, tx = -(r[0] * C[0] + r[1] * C[1] + r[2] * C[2]) * k, ty = -(u[0] * C[0] + u[1] * C[1] + u[2] * C[2]) * k;
  SH.VP.set([r[0] * k, u[0] * k, 0, 0, r[1] * k, u[1] * k, 0, 0, r[2] * k, u[2] * k, 0, 0, tx, ty, 0, 1]);
  SH.k = 1 / (4 * (E + 400)); SH.c = dot(C, Ld); SH.bias = 2 * E / SH.size * 1.5 + 0.03; SH.r = r;
  gl.bindFramebuffer(gl.FRAMEBUFFER, shFB.f); gl.viewport(0, 0, SH.size, SH.size); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.clearBufferfv(gl.COLOR, 0, [-1e9, 0, 0, 0]); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
  SH.cast = true; trees.draw(common, setNoise, cam, G, S); city.draw(common, setNoise, cam, G, S); SH.cast = false;
  gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, shFB.t); gl.activeTexture(gl.TEXTURE0);
}
const post = prog(`#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`, `#version 300 es
precision highp float; in vec2 v; uniform sampler2D uS; uniform float uEx, uFlash; uniform vec3 uFlashC; out vec4 o;
${HPOST}
void main() { vec3 c = holes(v, uS) * uEx; c = clamp(c * (2.51 * c + .03) / (c * (2.43 * c + .59) + .14), 0., 1.); c = pow(c, vec3(.4545)); vec2 w = v - .5; c *= 1. - .35 * dot(w, w); c = mix(c, uFlashC, uFlash); o = vec4(c, 1.); }`);
const VQ = gl.createVertexArray();
function mkHolesPost() { return holes.POST; }

// ---- the rest of each world, each in its own file ------------------------------------------------------------------
const sky = mkSky(gl, prog, PRE);
const trees = mkTrees(gl, prog, PRE + GLSL_NOISE + GLSL_GROUND);
const cover = mkCover(gl, prog, PRE + GLSL_NOISE + GLSL_GROUND + CLIM);
const city = mkCity(gl, prog, PRE + GLSL_NOISE + GLSL_GROUND + CLIM);
const fauna = mkFauna(gl, prog, PRE);


// ---- light: the planet's star, where it stands over this spot ------------------------------------------------------
const L = { sun: [0, 1, 0], sunC: [0, 0, 0], sky: [0, 0, 0] };
function setLight() {
  const s = S.sun || [0, 1, 0], el = Math.asin(max(-1, min(1, s[1])));
  const k = min(1, max(0, (el * 180 / PI + 2) / 25)), sc = G.sunCol, beta = G.beta, bm = max(...beta);
  L.sun = s; L.sunC = sc.map((v, i) => v * (0.08 + 0.92 * k) * exp(-beta[i] / bm * (1 - k) * 1.5 * G.air));   // reddened low in the sky
  L.sky = beta.map((b, i) => (0.3 + 0.7 * b / bm) * 0.55 * sc[i] / 2.6 * min(1.6, 0.4 + 0.6 * G.air)).map((v) => v * (0.03 + 0.97 * min(1, max(0, (el * 180 / PI + 6) / 20))));
}

// ---- frame ---------------------------------------------------------------------------------------------------------
const VP = new Float32Array(16);
let W = 0, Hp = 0, t0 = performance.now(), fps = 60, scale = 1;
const keys = {};
const dir = (yaw = cam.yaw, pitch = cam.pitch) => [cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)];
function matrices() {
  const d = dir(), r = nrm([-d[2], 0, d[0]]), u = cross(r, d), f = 1 / Math.tan(cam.fov / 2), a = W / Hp;
  const V = [r[0], u[0], -d[0], 0, r[1], u[1], -d[1], 0, r[2], u[2], -d[2], 0, 0, 0, 0, 1];
  const P = [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, -1, -1, 0, 0, -1, 0];
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + rr] * V[c * 4 + k]; VP[c * 4 + rr] = s; }
}
const common = (P) => {
  gl.uniformMatrix4fv(P.uVP, false, SH.cast ? SH.VP : VP);
  if (P.uSh) { gl.uniform1f(P.uSh, SH.cast ? 1 : SH.on ? 0 : 2); gl.uniformMatrix4fv(P.uShM, false, SH.VP); gl.uniform1f(P.uShK, SH.k); gl.uniform1f(P.uShC, SH.c); gl.uniform1f(P.uShB, SH.bias); gl.uniform1i(P.uShT, 6); } gl.uniform3fv(P.uSun, L.sun); gl.uniform3fv(P.uSunC, L.sunC); gl.uniform3fv(P.uSky, L.sky); gl.uniform1f(P.uT, (performance.now() - t0) / 1000);
  gl.uniform1f(P.uPix, 2 * Math.tan(cam.fov / 2) / Hp); gl.uniform1f(P.uAlt, S.cy); gl.uniform1f(P.uHs, G.Hs); gl.uniform3fv(P.uBeta, G.beta);
};
let flash = 0, flashC = [1, 1, 1];
function frame(now) {
  const dt = min(0.1, (now - (frame.t || now)) / 1000); frame.t = now; fps += (1 / max(dt, 1e-3) - fps) * 0.05;
  if (fps < 28 && scale > 0.5) scale *= 0.97; else if (fps > 50 && scale < 1) scale = min(1, scale * 1.02);
  const dpr = min(devicePixelRatio || 1, 2) * scale; W = max(2, round(canvas.clientWidth * dpr)); Hp = max(2, round(canvas.clientHeight * dpr));
  if (canvas.width !== W || canvas.height !== Hp) { canvas.width = W; canvas.height = Hp; }
  fly(dt);
  let F = axes(); octaves(F); S.cy = alt(); S.g0 = ground(S.foot); S.hc = max(S.cy - max(S.g0, 0), 1e-7);
  if (holes.step(cam, G, S, dt, jump)) { F = axes(); octaves(F); S.cy = alt(); S.g0 = ground(S.foot); S.hc = max(S.cy - max(S.g0, 0), 1e-7); }
  setLight();
  targets(W, Hp); matrices(); S.frame = (S.frame || 0) + 1; S.cast = () => SH.cast; S.shR = () => SH.r;
  shadowPass();
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.viewport(0, 0, W, Hp);
  gl.clearBufferfv(gl.COLOR, 1, [1e12, 0, 0, 1]); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST); sky.draw(common, cam, G, S); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  // the rings: the finest spacing a fortieth of the height above the ground; out to past the horizon
  gl.useProgram(tprog.p); common(tprog); setNoise(tprog);
  gl.uniform1f(tprog.uH0, S.g0 - S.cy); gl.uniform1f(tprog.uG0, S.g0); gl.uniformMatrix3fv(tprog.uF, false, S.F.flat()); gl.uniform3fv(tprog.uFoot, S.foot);
  gl.uniform3fv(tprog.uTf, S.tf); gl.uniform3i(tprog.uTb, ...S.tb); gl.uniform3fv(tprog.uLf, S.lf); gl.uniform3i(tprog.uLb, ...S.lb); gl.uniform1f(tprog.uNight, S.night);
  for (const [n, v] of [['uGrass', G.grass], ['uDry', G.grassDry], ['uSoil', G.soil], ['uRock', G.rock], ['uSand', G.sand], ['uLiq', G.liquid]]) gl.uniform3fv(tprog[n], v);
  gl.bindVertexArray(grid.vao);
  const c0 = max(min(S.hc / 40, G.R / 150), 1e-6), Rr = G.R + max(S.cy, 0), horizon = G.R * acos(min(1, G.R / Rr)) + 2 * max(S.hc, 0), reach = min(PI * G.R * 0.98, max(8000, horizon * 1.15, S.hc * 40));
  let fine = [1, 1, -1, -1];
  for (let j = 0; ; j++) {
    const c = c0 * 2 ** j, cxr = 0 * c, czr = 0;
    gl.uniform3f(tprog.uLv, cxr, czr, c); gl.uniform4fv(tprog.uFine, fine);
    if (j === 0) gl.drawElements(gl.TRIANGLES, grid.nf, gl.UNSIGNED_SHORT, 0); else gl.drawElements(gl.TRIANGLES, grid.nr, gl.UNSIGNED_SHORT, grid.nf * 2);
    const e = Hh * c; fine = [-e + c * 0.02, -e + c * 0.02, e - c * 0.02, e - c * 0.02];
    if (e > reach || j > 46) break;
  }
  trees.draw(common, setNoise, cam, G, S);
  cover.draw(common, setNoise, cam, G, S);
  city.draw(common, setNoise, cam, G, S);
  fauna.draw(common, cam, G, S);
  holes.draw(common, cam, G, S, FB, VP, W, Hp);
  sky.clouds(common, cam, G, S, FB);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Hp); gl.disable(gl.DEPTH_TEST);
  flash = max(0, flash - dt * 1.2);
  gl.useProgram(post.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FB.t[0]); gl.uniform1i(post.uS, 0); gl.uniform1f(post.uEx, 0.62); gl.uniform1f(post.uFlash, flash); gl.uniform3fv(post.uFlashC, flashC);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, FB.t[1]); gl.uniform1i(post.uD, 1); gl.activeTexture(gl.TEXTURE0); holes.setPost(post, W, Hp);
  gl.bindVertexArray(VQ); gl.drawArrays(gl.TRIANGLES, 0, 3);
  hud();
  requestAnimationFrame(frame);
}
// through a wormhole: out of the paired mouth on planet n, the same distance from it, looking away from it
function jump(n, mouth, dist) {
  G = world(n); const u = nrm(mouth), g = max(H(G, u.map((x) => x * G.R)), 0), tang = nrm(cross(u, cross([0.3, 0.8, 0.5], u)));
  cam.P = madd(u.map((v) => v * (G.R + g + dist * 0.35)), tang, dist); cam.ref = tang; cam.yaw = 0; cam.pitch = -0.1;
  flash = 1; flashC = G.sunCol.map((v) => min(1, v / 2.6)); hint();
}
// ---- looking and moving: drag turns, the wheel or a pinch goes toward whatever is under the pointer ----------------
function pick(px, py) {
  if (!FB) return null; gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.readBuffer(gl.COLOR_ATTACHMENT1);
  const o = new Float32Array(4); gl.readPixels(Math.floor(px * W / canvas.clientWidth), Math.floor(Hp - 1 - py * Hp / canvas.clientHeight), 1, 1, gl.RGBA, gl.FLOAT, o);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); return o[0] < 1e11 ? o[0] : null;
}
function rayAt(px, py) {
  const d = dir(), f = Math.tan(cam.fov / 2), a = canvas.clientWidth / canvas.clientHeight, sx = (px / canvas.clientWidth * 2 - 1) * f * a, sy = (1 - py / canvas.clientHeight * 2) * f;
  const r = nrm([-d[2], 0, d[0]]), u = cross(r, d); return nrm([d[0] + r[0] * sx + u[0] * sy, d[1] + r[1] * sx + u[1] * sy, d[2] + r[2] * sx + u[2] * sy]);
}
function moveLocal(v) {                                                    // move by a camera-local vector, keep off the ground
  const F = axes(); cam.P = madd(cam.P, toPlanet(F, v), 1);
  const u = nrm(cam.P), g = max(ground(u.map((x) => x * G.R)), 0), r = hypot(...cam.P), lo = G.R + g + 1e-6; if (r < lo) cam.P = u.map((x) => x * lo);
}
function zoomAt(px, py, f) {                                               // f < 1 goes in, toward whatever is under the pointer
  const r = rayAt(px, py); let dist = pick(px, py); const hc = S.hc || 1, wh = holes.hit(cam, G, S, r);
  if (wh !== null && (dist === null || wh < dist)) dist = wh;
  if (dist === null) { if (f < 1) return; dist = max(1, hc * 3); }
  if (f > 1 && S.cy > G.R * 6) return;
  moveLocal(r.map((v) => v * dist * (1 - f)));
  const u = nrm(cam.P), g = max(ground(u.map((x) => x * G.R)), 0), lo = G.R + g + dist * f * 0.02 + 1e-7; if (hypot(...cam.P) < lo) cam.P = u.map((x) => x * lo);
}
let drag = null; const pts = new Map();
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { d0: null }; });
canvas.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) { const [a, b] = [...pts.values()], d = hypot(a[0] - b[0], a[1] - b[1]); if (drag.d0) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, drag.d0 / d); drag.d0 = d; return; }
  cam.yaw -= dx * 0.004; cam.pitch = min(1.55, max(-1.55, cam.pitch + dy * 0.004));
});
const upE = (e) => { pts.delete(e.pointerId); if (pts.size < 2 && drag) drag.d0 = null; };
canvas.addEventListener('pointerup', upE); canvas.addEventListener('pointercancel', upE);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0015))); }, { passive: false });
addEventListener('keydown', (e) => { keys[e.code] = 1; }); addEventListener('keyup', (e) => { keys[e.code] = 0; });
let flyV = [0, 0, 0];
function fly(dt) {                                                         // WASD at a pace set by height: a stride on the ground, a region a second from orbit
  const hc = S.hc || 1, sp = max(hc, 2e-5) * 1.6 * (keys.ShiftLeft ? 4 : 1);
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), v = (keys.KeyE || keys.Space ? 1 : 0) - (keys.KeyQ || keys.KeyC ? 1 : 0);
  const d = dir(cam.yaw, 0), t = [(d[0] * f - d[2] * s) * sp, v * sp, (d[2] * f + d[0] * s) * sp];
  flyV = flyV.map((q, i) => q + (t[i] - q) * min(1, dt * 8));
  if (hypot(...flyV) > 1e-12) moveLocal(flyV.map((q) => q * dt));
}

// ---- what you are looking at, in words ---------------------------------------------------------------------------
const fmt = (m) => m >= 1000 ? (m / 1000).toPrecision(m >= 1e4 ? 3 : 2).replace(/\.0+$/, '') + ' km' : m >= 1 ? m.toPrecision(2).replace(/\.0$/, '') + ' m' : m >= 0.01 ? (m * 100).toPrecision(2) + ' cm' : m >= 1e-3 ? (m * 1000).toPrecision(2) + ' mm' : (m * 1e6).toPrecision(2) + ' µm';
const BANDS = [[2e6, 'a planet'], [2e5, 'a continent'], [2e4, 'mountain ranges'], [2e3, 'a valley'], [200, 'a forest'], [20, 'a stand of trees'], [2, 'the ground'], [0.2, 'leaf litter'], [0.02, 'a handful of soil'], [2e-3, 'grains'], [2e-4, 'silt and cells'], [0, 'clay']];
function hud() {
  if ((hud.n = (hud.n || 0) + 1) % 6) return;
  const c = pick(canvas.clientWidth / 2, canvas.clientHeight / 2), d = c ?? S.hc * 3, w = 2 * d * Math.tan(cam.fov / 2) * canvas.clientWidth / canvas.clientHeight;
  $('scale').textContent = fmt(w) + ' across'; $('what').textContent = BANDS.find((b) => w >= b[0])[1];
  $('alt').textContent = fmt(S.hc) + ' up · ' + holes.nearest(cam, G, S);
  $('bar').style.width = min(100, max(2, (log2(w) + 20) / 44 * 100)) + '%';
}
function hint() {
  $('name').textContent = G.name; const ty = G.starK < 4500 ? 'red' : G.starK < 5500 ? 'orange' : G.starK < 6200 ? 'yellow' : 'white';
  $('phys').textContent = `${(G.R / 1000).toFixed(0)} km radius · ${G.g.toFixed(2)} g · ${G.air < 0.6 ? 'thin' : G.air > 1.5 ? 'thick' : ''} air · ${ty} star · ${G.species.length} tree species`.replace(' ·  air', ' · air');
}
arrive(0);
requestAnimationFrame(frame);
window.sylva = { cam, G: () => G, S, H: (p) => H(G, p), arrive, zoomAt, pick, world, frame, jump, sky: sky.S, holes };
