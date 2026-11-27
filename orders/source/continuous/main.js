// Worlds, continuous: a family of invented planets, each grown from its own genome (planet.js), each viewed at any
// scale without a cut, from the whole globe down to the cells of a leaf, and joined by wormholes (wormhole.js).
import { lights, patches } from './earth.js';
import { K, sOf, H, H0, river, RIVD, genome, octTable, climate, GLSL_NOISE, GLSL_GROUND, GLSL_CLIMATE, MASKK, octN, TREE, AX, LOT } from './planet.js';
import { mkCity } from './city.js';
import { mkFauna } from './fauna.js';
import { mkLife } from './life.js';
import { mkMarine } from './marine.js';
import { mkCave } from './cave.js';
import { mkFire, FIRE_GLSL } from './fire.js';
import { mkBeavers, POND_GLSL } from './beaver.js';
import { mkCosmos, COS } from './cosmos.js';
import { mkMicro, MICRO, ENT, lampK } from './micro.js';
import { mkSound } from './sound.js';
import { mkEco, drawn, Who } from './eco.js';
import { nSpecies, sunAt, season, vn3, AGES, ageWorld, carry, sibling } from './planet.js';
import { mkTrees } from './trees.js';
import { mkNav } from './nav.js';
import { mkCover } from './cover.js';
import { mkSky } from './sky.js';
import { mkHoles, RL4 } from './wormhole.js';
import { realWorld, REAL, region, NAMES } from './real.js';
import { dayOf, msOf, moonGeo, helio, frame as bodyFrame, toBody, unit as unitV } from './ephem.js';
import { dataH, reliefAt, lakeAt, speciesW, CRS, patchOf, CORES, cityRho, citySuit } from './planet.js';

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
uniform float uSeasT, uAut, uBare, uSpr, uRain, uAur; uniform vec3 uAurC; uniform float uPack[12];   // uPack: snow on the ground for a place of each mean temperature, -30 to +25 °C (see snowpack())   // the season here (warmth offset, autumn colour, leaf loss, spring flush), rain, aurora
float fdep(float w) { return log2(max(w, 1e-7) * 1e7 + 1.) / 56.; }
// a surface's normal packed into one float for the pick buffer (two 12-bit octahedral coordinates, exact in a float)
float pkn(vec3 n) { n /= abs(n.x) + abs(n.y) + abs(n.z) + 1e-9; vec2 e = n.xz; if (n.y < 0.) e = (1. - abs(e.yx)) * vec2(e.x < 0. ? -1. : 1., e.y < 0. ? -1. : 1.); e = clamp(e * .5 + .5, 0., 1.); return floor(e.x * 4095. + .5) * 4096. + floor(e.y * 4095. + .5); }
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
// under water: light dims and colours with depth, and the water itself fills the view (its own absorption and colour)
uniform float uUnder, uCamDep; uniform vec3 uLiqA, uLiqC;
vec3 seaLight(float z) { return exp(-uLiqA * max(z, 0.) * 1.1); }
vec3 sea(vec3 col, float d) { vec3 tr = exp(-uLiqA * d), amb = uLiqC * (uSunC * max(uSun.y, 0.) * .5 + uSky * .8) * seaLight(uCamDep) * 1.4; return col * tr + amb * (1. - tr); }
vec3 air(vec3 col, vec3 rd, float d, float y0, float y1) {
  if (uUnder > .5) return sea(col * (y1 < 0. ? seaLight(-y1) : vec3(.6)), d);
  float a = exp(-clamp(y0, -100., 3e5) / uHs), b = exp(-clamp(y1, -100., 3e5) / uHs), od = d * (abs(y1 - y0) > 1. ? (a - b) * uHs / (y1 - y0) : a);
  vec3 tr = exp(-od * uBeta * 1.4); float mu = dot(rd, uSun), ph = .75 * (1. + mu * mu);
  vec3 sc = uSunC * (uBeta / max(max(uBeta.x, uBeta.y), uBeta.z)) * ph * .25 * smoothstep(-.15, .1, uSun.y + .1) + uSunC * .5 * pow(max(mu, 0.), 8.) * .15 + uSky * .05;
  return col * tr + sc * (1. - tr);
}
` + FIRE_GLSL + POND_GLSL;
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
const RN = Object.fromEntries(Object.entries(REAL).map(([k, v]) => [v, k]));   // the real worlds, by number
const world = (n) => worlds[n] || (worlds[n] = n >= 100 ? realWorld(RN[n]) : genome(n));
let snd = null;                                                            // the sound (made at the first click or key: see below)
let realT = dayOf(Date.now());                                              // the real worlds share one clock: days from J2000, starting now
let G = world(100); G.t = realT;
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
const stand = (p) => { const h = H(G, p), lk = lakeAt(G, nrm(p)); return max(S.pondTop ? max(h, S.pondTop(p, h)) : h, lk > h ? lk : -1e9); };   // what you stand on: the ground, or a beaver pond's water or dam
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
  G = world(n); if (G.real) G.t = realT; let p = P; $('age').value = 0;
  if (!p) { const m = holes.mouths(n)[0], u0 = m.u, t = nrm(cross(u0, [0.31, 0.52, 0.79])); let best = null, bs = -1e9;
    for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832, dd = 1200 + (k % 3) * 400, dir = nrm(madd(t.map((v) => v * cos(a)), cross(u0, t), sin(a))), q = nrm(madd(u0, dir, dd / G.R)).map((v) => v * G.R), h = H(G, q); if (h < 5) continue; const c = climate(G, q, h), sc = -abs(c.W - 0.65) - (h > 2500 ? 2 : 0); if (sc > bs) { bs = sc; best = q; } }
    p = best || landing(G); look = madd(m.C, p, -1); }
  if (G.real === 'earth' && !G.E) { const h0 = H(G, p), c = climate(G, p, h0); if (cityRho(G, p) * citySuit(h0, c.T, c.W, 0, G) > 0.04) {   // in a town: onto the nearest street, not inside a building
    const ab = p.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, cc] = AX[a]; p = p.slice(); p[b] = (Math.round(p[b] / LOT / 4) * 4 + 0.5) * LOT; p[a] = Math.sign(p[a]) * sqrt(max(0, G.R * G.R - p[b] * p[b] - p[cc] * p[cc])); } }
  const u = nrm(p), h = H(G, p);
  cam.P = u.map((v) => v * (G.R + max(h, 0) + 1.7)); cam.ref = nrm(cross(u, cross([0.2, 0.9, 0.3], u)));
  if (look) { cam.ref = nrm(madd(look, u, -dot(look, u))); cam.yaw = 0; cam.pitch = 0.04; }
  setLight(); hint(); if (typeof setMode === 'function') { setMode('walk'); ctl.land = 0; }
}

// ---- the ground: nested square rings of a 64-cell grid around the camera's foot, each twice the last, laid on the
// sphere by distance along it (so a ring is a ring of the globe however far it reaches) ---------------------------
const N = 64, Hh = N / 2;
const CLIM = GLSL_CLIMATE(G);
const SPEC = `uniform vec4 uSpN[16], uSpC[16]; uniform int uNsp;`;
const tprog = prog(PRE + GLSL_NOISE + GLSL_GROUND + CLIM + `
layout(location = 0) in vec2 aG;
uniform vec3 uLv; uniform float uH0, uSea, uG0;
out vec3 vP, vQ, vGr; out vec2 vPl; out float vW, vCe, vH, vM, vPw, vBu;
void main() {
  float c = uLv.z, m = smoothstep(.72, .94, max(abs(aG.x), abs(aG.y)) / ${Hh}.);   // the outer band blends into the next ring's coarser grid
  vec2 g = aG - fract(aG * .5) * 2. * m, p = uLv.xy + g * c; float ce = c * (1. + m);
  float r = length(p), th = min(r / uR, 3.1); vec2 dir = r > 0. ? p / r : vec2(0.);
  float sx = th > 1e-4 ? sin(th) / th : 1. - th * th / 6., s2 = sin(th * .5);
  vec3 q = vec3(dir.x * r * sx, -2. * s2 * s2 * uR, dir.y * r * sx);    // the point on the sphere, from the foot
  float dh; vec3 gr; vM = ground(q, ce, dh, gr);
  float h = uG0 + dh; vec3 cl = climate(q, h + ${RIVD}. * uRivC); float rd, rw, rm = riverM(q, h + ${RIVD}. * uRivC, cl.y, rd, rw);   // rivers: carve the channel,
  h -= ${RIVD}. * (rm - uRivC); vec2 pd = pond(q, h); pd.x = max(pd.x, lakeL(q)); vPw = pd.x; vBu = pd.y; vH = h; vQ = q; vGr = gr; vCe = ce; vPl = p;
  float hv = max(max(max(h, rm > .02 ? h + ${RIVD}. * rm - ${RIVD}. * .7 : -1e9), pd.x), uUnder > .5 ? -1e9 : 0.);   // and fill it; the sea is a surface of its own (seen from above)
  vP = q + vec3(0., uH0 + (hv - uG0), 0.) + q * (hv / uR);
  vec4 qq = uVP * vec4(vP, 1.); vW = qq.w; gl_Position = vec4(qq.xy, 0., qq.w);
}`, PRE + GLSL_NOISE + GLSL_GROUND + CLIM + SPEC + `
in vec3 vP, vQ, vGr; in vec2 vPl; in float vW, vCe, vH, vM, vPw, vBu;
uniform float uG0, uNight; uniform vec4 uFine; uniform vec3 uFoot, uTf, uLf; uniform ivec3 uTb, uLb; uniform mat3 uF;
uniform vec3 uGrass, uDry, uSoil, uRock, uSand, uLiq; uniform float uGiant, uSnowOff, uHmid, uHalb; uniform int uCan, uLit; uniform highp sampler2D uCanT, uLitT;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
float vor(vec2 u, out float id) { vec2 i = floor(u), f = u - i; float d = 9.; id = 0.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(h1(i + o), h1(i + o + 7.3)) - f; float e = dot(r, r); if (e < d) { d = e; id = h1(i + o + 3.1); } } return sqrt(d); }
void main() {
  if (vPl.x > uFine.x && vPl.x < uFine.z && vPl.y > uFine.y && vPl.y < uFine.w) discard;   // a finer ring is drawn here
  float d = length(vP), fp = max(vW * uPix, 1e-9);
  vec3 gr = vGr;                                                           // finer octaves, for the light only, down to the pixel
  for (int k = 0; k < ${K}; k++) { float s = sOf(k); if (s > vCe * 2.5) continue; if (s < fp * 1.5) break; float w = (1. - clamp(s / vCe - 1.5, 0., 1.)) * clamp(s / fp * .5 - .75, 0., 1.); float a = OT(k, 1).w * (OT(k, 6).y > .5 ? vM : 1.); gr += oct(k, vQ).yzw * a * w; }
  vec3 up = normalize(vec3(0., 1., 0.) + vQ / uR), n = normalize(up - (gr - up * dot(gr, up)));
  float hA = vH, sl = 1. - dot(n, up);
  vec3 cl = climate(vQ, hA); float T = cl.x, W = cl.y;
  float rd, rw, rm = riverM(vQ, hA + 4., W, rd, rw), wet = rw > 0. ? clamp((rw * .42 - rd) / max(fp * 1.5, .05) + .5, 0., 1.) : 0.;   // the water's width, softened to the pixel
  float pdep = vPw - hA; bool sea = (hA < 0. && uUnder < .5) || wet > .5 || pdep > 0.;
#define NF(q, S) mix(n2((q) / (S)), .5, smoothstep(.2, .8, fp / (S)))   // a noise, smoothed to its mean once a pixel covers it
  vec3 D = uF * vQ, ab = abs(uFoot + D); vec2 wp = ab.x > ab.y && ab.x > ab.z ? D.yz : ab.y > ab.z ? D.zx : D.xy;   // a flat map of the nearby ground, for small textures
  // what the ground is made of, as it would look from far off: forest, grassland, desert, rock, snow and ice, beach
  float fo = forestF(vQ, hA, T, W, fp);
  vec3 grass = mix(uDry, uGrass, smoothstep(.25, .6, W) * smoothstep(-9., -2., uSeasT)) * (.85 + .3 * NF(wp, 40.));
  vec3 alb = mix(uSand * (.9 + .2 * NF(wp, 300.)), grass, smoothstep(.12, .3, W));
  vec3 rock = uRock * (.8 + .4 * NF(wp, 9.));
  if (uHalb > 0.) alb = mix(uRock * 1.1, uSand, smoothstep(-2500., 2500., hA - uHmid)) * (.85 + .3 * NF(wp, 2e4)) * (.9 + .2 * NF(wp, 60.));   // an airless world: dark low plains (the Moon's maria), bright high ground
  // the forest's mean colour: its species, weighted by how well each suits this place
  vec3 can = vec3(0.); float cw = 0.;
  for (int i = 0; i < 16; i++) { if (i >= uNsp) break; vec4 s = uSpN[i]; float w = exp(-pow((T - s.x) / s.y, 2.) - pow((W - s.z) / s.w, 2.)); vec3 cc = uSpC[i].rgb; if (uSpC[i].w > .5) cc = mix(mix(cc, vec3(.35, .12, .02), uAut * .8), vec3(.1, .085, .07), uBare * .8); can += cc * w; cw += w; }
  can = cw > 1e-4 ? can / cw : uGrass; if (uCan == 0) fo *= smoothstep(1e-4, .05, cw);
  if (uCan > 0) { vec4 cc = texture(uCanT, dTC(normalize(uFootD + uFrmD * vQ))); vec3 c0 = cc.rgb; can = mix(c0, mix(mix(c0, vec3(.35, .12, .02), uAut * .8), vec3(.1, .085, .07), uBare * .8), cc.a); fo *= smoothstep(.002, .02, c0.r + c0.g + c0.b); }   // measured worlds: the forest's colour, from the families that grow here
  if (uGiant > 0.) { float b = .5 + .5 * sin(cl.z * 22. + 2.5 * n2(wp / 9e5) + 1.3 * n2(wp / 2.3e5)); alb = mix(uSoil, uRock, b * b) * (.9 + .2 * NF(wp, 4e4)); fo = 0.; }   // a giant: bands of cloud
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
  // fire: the front a band of flame, embers glowing just behind it; then ash, black for a season or two, greening as
  // the grass comes back; where there was forest, from afar, the grey of dead snags, then young trees
  float ba = burnAge(vQ);
  if (ba >= 0. && !sea) { float fuel = smoothstep(.15, .3, W) * step(-2., T) * (1. - smoothstep(.02, .2, rho)) * step(.5, hA), yr = ba / uFyr;
    float bw = max(fp * 4. / 1500., .015), ff = NF(wp, 3.);
    alb = mix(alb, vec3(.035, .032, .03) * (.7 + .8 * ff), fuel * (1. - smoothstep(.3, 3., yr)) * .92);
    float sn = fo * far * fuel * (1. - smoothstep(4., 45., yr)); alb = mix(alb, mix(vec3(.09, .085, .08), uGrass * .6, smoothstep(5., 35., yr)), sn * .85);
    em += vec3(5., 1.6, .35) * fuel * smoothstep(0., .004, ba) * (1. - smoothstep(bw, bw * 4., ba)) * (.45 + .55 * n2(wp * .4 + uT * 2.3));
    em += vec3(1.6, .32, .05) * fuel * (1. - smoothstep(.03, .3, ba)) * smoothstep(.7, .85, n2(wp * 2. + vec2(uT * .3, 0.)) * .5 + .5 * ff) * .35; }
  if (vBu > .02) alb = mix(alb, vec3(.12, .08, .05) * (.5 + .9 * n2(wp * vec2(9., 1.3) + n2(wp * 3.) * 4.)), smoothstep(.02, .3, vBu));   // dam and lodge: sticks and mud
  alb = mix(alb, uSand, smoothstep(5., 1.5, hA) * (1. - fo) * step(pdep, -1.));               // beaches
  float tb = clamp((T + uSnowOff + 30.) / 5., 0., 10.99), pk = mix(uPack[int(tb)], uPack[int(tb) + 1], fract(tb));
  float snow = max(smoothstep(-3., -9., T + (uCl > 0 ? gSeas : uSeasT) + uSnowOff + 3. * NF(wp, 500.)), smoothstep(.15, .6, pk + .25 * (NF(wp, 60.) - .5))) * smoothstep(.8, .5, sl) * (1. - uGiant);   // snow where it is cold now, or lying from the winter
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
    float fr = .02 + .98 * pow(1. - max(dot(-v, wn), 0.), 5.), dep = pdep > 0. ? clamp(.2 + pdep / 2.5, 0., 1.) : hA < 0. ? clamp(.25 - hA / 12., 0., 1.) : .55;
    vec3 below = mix(alb * uSunC * sh * .5, uLiq * (uSunC * sh + uSky * .5), dep);
    col = mix(below, uSky * .8 * (.3 + .7 * sh) + uSunC * pow(max(dot(r, uSun), 0.), 600.) * 12., fr);
  } else { float dif = max(dot(nl, uSun), 0.) * shadow(vP), am = .55 + .45 * dot(nl, up);
    if (hA < 0.) { alb = mix(uSand * .8, uSoil * .5, smoothstep(5., 60., -hA)) * (.8 + .4 * NF(wp, 3.)); dif *= .6 + 1.1 * pow(1. - abs(n2(wp * .9 + vec2(uT * .5, uT * .37)) * 2. - 1.), 5.) * smoothstep(40., 2., -hA); }   // the sea bed: sand, then mud, under rippling caustics
    col = alb * (uSunC * dif + uSky * am * .55 * (.15 + .85 * smoothstep(-.2, .2, dot(up, uSun)))); }
  col += em;
  if (uLit > 0) col += vec3(1., .7, .4) * texture(uLitT, dTC(normalize(uFootD + uFrmD * vQ))).r * .35 * smoothstep(.04, -.12, dot(up, uSun)) * smoothstep(2e3, 3e4, d);   // the lights of the night side, measured (seen from afar: near by, the towns are drawn)
  col = air(col, normalize(vP), d, uAlt, max(hA, 0.));
  // what the microscope finds here: 2 water, 3 snow, 4 sand, 5 rock, 1 soil (and on airless worlds, regolith)
  float mrk = smoothstep(.42, .62, sl + .1 * NF(wp, 30.)) * (1. - fo * .7), msd = max(1. - smoothstep(.12, .3, W), smoothstep(5., 1.5, hA) * (1. - fo) * step(pdep, -1.));
  float mat = sea ? 2. : snow > .5 ? 3. : hA < 0. ? 4. : mrk > .5 ? 5. : msd > .5 ? 4. : rho > .3 ? 0. : 1.;
  oC = vec4(col, 1.); oD = vec4(d, 0, mat, pkn(n)); gl_FragDepth = fdep(vW);
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
const S = { cores: { v: new Float32Array(24), r: new Float32Array(6).fill(1) } };   // this frame's shared state
// measured worlds: their maps as textures (heights and lakes; climate and relief; the forest's colour), made once each
const dtex = new Map();
function texOf(w, h, fmt, f, data, lin) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, f, gl.FLOAT, data);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, lin ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_MAG_FILTER, lin ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; }
function dataTex(Gd) {
  if (!Gd.dat) return null; const key = Gd.real + (Gd.E || 0); if (dtex.has(key)) return dtex.get(key); const D = Gd.dat; let o;
  if (D.cl) { const base = dtex.get(Gd.real + '0'); o = base && base.dat ? { ...base } : { dat: texOf(D.g.w, D.g.h, gl.RG16F, gl.RG, D.g.a, false), rel: texOf(D.cl.w, D.cl.h, gl.RGBA16F, gl.RGBA, D.cl.a, true) }; o.can = texOf(360 * 2, 180 * 2, gl.RGBA16F, gl.RGBA, canopy(Gd), true); if (Gd.real === 'earth' && !Gd.E) { const Lt = lights(); o.lit = texOf(Lt.w, Lt.h, gl.R16F, gl.RED, Lt.a, true); } }
  else { const t = texOf(D.g.w, D.g.h, gl.RGBA16F, gl.RGBA, D.g.a, true); o = { dat: t, rel: t }; }
  gl.activeTexture(gl.TEXTURE0); dtex.set(key, o); return o;
}
// the forest's colour seen from afar on the Earth: each half-degree cell, its families mixed as they suit the place
function canopy(Gd) {
  const W = 720, Hh = 360, out = new Float32Array(W * Hh * 4), sp = Gd.species;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const la = (0.5 - (j + 0.5) / Hh) * PI, lo = ((i + 0.5) / W * 2 - 1) * PI, u = [cos(la) * cos(lo), cos(la) * sin(lo), sin(la)], p = u.map((v) => v * Gd.R), h = dataH(Gd, u); if (h < 2) continue;
    const c = climate(Gd, p, h), w = speciesW(Gd, c.T, c.W), pr = Gd.present(Gd, u, h, c.T, c.W); let r = 0, g = 0, b = 0, dc = 0, tw = 0;
    for (let k = 0; k < sp.length; k++) { if (!pr.ok[k]) continue; const x = w[k]; if (x < 1e-4) continue; r += sp[k].canopy[0] * x; g += sp[k].canopy[1] * x; b += sp[k].canopy[2] * x; dc += (sp[k].decid || 0) * x; tw += x; }
    if (tw > 1e-3) out.set([r / tw * 1.6, g / tw * 1.6, b / tw * 1.6, dc / tw], (j * W + i) * 4);
  }
  return out;
}
function octaves(F) {
  const u = F[1], foot = u.map((v) => v * G.R), T = octTable(G, foot, F);
  gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, octTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 7, T.length / 28, 0, gl.RGBA, gl.FLOAT, T); gl.activeTexture(gl.TEXTURE0);
  S.foot = foot; S.F = F; S.m0 = T.m0; S.pl = G.pl ? { cam: T.cam, K0: T.K0, Oc: T.Oc } : null;
  S.dt = null; const DT = dataTex(G);
  if (DT) {                                                                // the map's ground round the foot, as a Taylor series in camera-local metres
    const f = (q) => dataH(G, nrm(madd(foot, toPlanet(F, q), 1))), e = 40, h0 = f([0, 0, 0]), ax = [[e, 0, 0], [0, 0, e]], fx = [f(ax[0]), f(ax[0].map((v) => -v))], fz = [f(ax[1]), f(ax[1].map((v) => -v))];
    const hxx = (fx[0] - 2 * h0 + fx[1]) / (e * e), hzz = (fz[0] - 2 * h0 + fz[1]) / (e * e), hxz = (f([e, 0, e]) - f([e, 0, -e]) - f([-e, 0, e]) + f([-e, 0, -e])) / (4 * e * e);
    if (G.crP) { const f = new Float32Array(15), b = new Int32Array(15); CRS.forEach((Sc, s) => foot.forEach((v, i) => { const x = v / Sc, fl = floor(x); f[s * 3 + i] = x - fl; b[s * 3 + i] = ((fl % 1048576) + 1048576) % 1048576; })); S.cr = { f, b }; }
    S.dt = { tex: DT, h0, g: [(fx[0] - fx[1]) / (2 * e), 0, (fz[0] - fz[1]) / (2 * e)], H: [hxx, 0, hxz, 0, 0, 0, hxz, 0, hzz], m0: reliefAt(G, u) };
    if (G.real === 'earth' && !G.E) { const Pt = patches(), uf = nrm(foot), lat = Math.asin(uf[2]), lon = Math.atan2(uf[1], uf[0]); let bi = -1, bd = 0.021;   // the nearest Go-to place's fine ground, within 1.2 degrees
      Pt.o.forEach(([la0, lo0], i) => { const cl = la0 - Pt.d * (Pt.N - 1) / 2, co = lo0 + Pt.d * (Pt.N - 1) / 2, dd = Math.hypot(lat - cl, (((lon - co + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI) * Math.cos(lat)); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0) { if (!DT.pat) { gl.activeTexture(gl.TEXTURE12); const A = Pt.a, N = Pt.N, T = new Float32Array(A.length * 4); for (let k = 0; k < A.length; k++) { const x = k % N, r = k - x, y = (r / N) % N, o = r - y * N; T[k * 4] = A[k]; T[k * 4 + 1] = (A[o + y * N + min(N - 1, x + 1)] - A[o + y * N + max(0, x - 1)]) / 2; T[k * 4 + 2] = (A[o + min(N - 1, y + 1) * N + x] - A[o + max(0, y - 1) * N + x]) / 2; } DT.pat = texOf(N, N * Pt.n, gl.RGBA32F, gl.RGBA, T, false); }   // (height and slope at each node)
        const at = patchOf(G, uf), here = at && at.i === bi, [la0, lo0] = Pt.o[bi], px = (q) => { const v = nrm(madd(foot, toPlanet(F, q), 1)), lt = Math.asin(v[2]); let dl = Math.atan2(v[1], v[0]) - lo0; dl -= 2 * PI * floor((dl + PI) / (2 * PI)); return [dl / Pt.d, (la0 - lt) / Pt.d]; };
        const x0 = px([0, 0, 0]), e = 200, Ja = [[e, 0, 0], [0, e, 0], [0, 0, e]].map((q) => { const a = px(q), b = px(q.map((v) => -v)); return [(a[0] - b[0]) / (2 * e), (a[1] - b[1]) / (2 * e)]; });   // where the foot lies in the patch, and per local metre
        S.dt.pt = { i: bi, o: Pt.o[bi], d: Pt.d, h0: here ? at.h : 0, w0: here ? at.w : 0, N: Pt.N, x0, Jx: Ja.map((r) => r[0]), Jy: Ja.map((r) => r[1]) };
        gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, DT.pat); gl.activeTexture(gl.TEXTURE0); } }
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, DT.dat); gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, DT.rel);
    if (DT.can) { gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, DT.can); } if (DT.lit) { gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, DT.lit); } gl.activeTexture(gl.TEXTURE0);
  }
  S.axis = toLocal(F, G.axis); S.sun = toLocal(F, sunAt(G, G.t || 0)); { const h0 = H0(G, foot); S.rivC = river(G, foot, h0, climate(G, foot, h0).W); }
  { const u = nrm(foot), near = CORES.map((k) => [hypot(u[0] - k[0], u[1] - k[1], u[2] - k[2]), k]).sort((a, b) => a[0] - b[0]).slice(0, 6), v = new Float32Array(24), r = new Float32Array(6); near.forEach(([, k], i) => { v.set([k[0], k[1], k[2], k[4]], i * 4); r[i] = k[3]; }); S.cores = { v, r }; }   // the six city cores nearest you, for the shaders
  S.tb = foot.map((v) => floor(v / TREE)); S.tf = foot.map((v, i) => v / TREE - S.tb[i]); S.lb = foot.map((v) => floor(v / LOT)); S.lf = foot.map((v, i) => v / LOT - S.lb[i]);
  S.night = min(1, max(0, (0.06 - S.sun[1]) / 0.16));
}
// every program that reads the ground calls this
const setNoise = (P) => {
  fire.set(P, G, S); beavers.set(P);
  gl.uniform1i(P.uOct, 7); gl.uniform1i(P.uKs, G.kseed); gl.uniform1f(P.uR, G.R); gl.uniform1f(P.uMaskR, G.ridge); gl.uniform1f(P.uM0, S.m0);
  if (P.uRivC) gl.uniform1f(P.uRivC, S.rivC);
  if (P.uNpl) { gl.uniform1i(P.uNpl, S.pl ? 12 : 0); if (S.pl) { gl.uniform1i(P.uPlC, S.pl.cam); gl.uniform1f(P.uK0, S.pl.K0); gl.uniform1f(P.uOc, S.pl.Oc); } }
  if (P.uFootD) { gl.uniform3fv(P.uFootD, S.foot); gl.uniformMatrix3fv(P.uFrmD, false, S.F.flat()); }
  if (P.uPat) gl.uniform1i(P.uPat, 12);
  if (P.uDw) { const d = S.dt; gl.uniform1i(P.uDw, d ? 1 : 0); if (d) { gl.uniform1i(P.uKd, G.kdat); gl.uniform1f(P.uDh0, d.h0); gl.uniform1f(P.uDm0, d.m0); gl.uniform3fv(P.uDg, d.g); gl.uniformMatrix3fv(P.uDH, false, d.H); gl.uniform2f(P.uDsz, G.dat.g.w, G.dat.g.h); gl.uniform1f(P.uDcell, G.dat.cell); gl.uniform1f(P.uDbase, G.base || 0); gl.uniform1i(P.uDat, 8); gl.uniform1i(P.uRel, 9); const pt = d.pt; gl.uniform1i(P.uPon, pt ? 1 : 0); if (pt) { gl.uniform4f(P.uPo, pt.o[0], pt.o[1], pt.d, pt.i * pt.N); gl.uniform2fv(P.uPx0, pt.x0); gl.uniform3fv(P.uPJx, pt.Jx); gl.uniform3fv(P.uPJy, pt.Jy); gl.uniform1f(P.uPt0, pt.h0); gl.uniform1f(P.uPw0, pt.w0); } else { gl.uniform1f(P.uPt0, 0); gl.uniform1f(P.uPw0, 0); } } }   // (cleared when there is none, or the last place's patch height stays subtracted)   // (the sampler always on its own unit: left at 0 it would point at the frame being drawn, and the draw is refused)
  if (P.uCrP) { gl.uniform1f(P.uCrP, S.dt && G.crP || 0); if (S.cr) { gl.uniform3fv(P.uCf, S.cr.f); gl.uniform3iv(P.uCb, S.cr.b); } }
  if (P.uCl) { gl.uniform1i(P.uCl, G.dat && G.dat.cl ? 1 : 0); gl.uniform1i(P.uClim, 9); gl.uniform1f(P.uSph, S.sph || 0); }
  if (P.uLapse) gl.uniform1f(P.uLapse, G.lapse ?? 6.5);
  if (P.uFootP) { gl.uniform3fv(P.uFootP, S.foot); gl.uniformMatrix3fv(P.uFrm, false, S.F.flat()); gl.uniform1i(P.uCities, G.cities ? (G.real === 'earth' && !G.E && S.dt ? 2 : 1) : 0); if (P.uLitC) gl.uniform1i(P.uLitC, 11); if (P.uCore) { gl.uniform4fv(P.uCore, S.cores.v); gl.uniform1fv(P.uCoreR, S.cores.r); } }
  if (P.uAxis) { gl.uniform3fv(P.uAxis, S.axis); gl.uniform1f(P.uTeq, G.Teq); gl.uniform1f(P.uTgrad, G.Tgrad); gl.uniform1f(P.uWet, G.wet); gl.uniform1f(P.uGrav, G.g); }
  if (P.uSpN) { const a = new Float32Array(64), c = new Float32Array(64); G.species.forEach((s, i) => { if (i < 16) { a.set([s.T[0], s.T[1], s.W[0], s.W[1]], i * 4); c.set([...s.canopy, s.decid || 0], i * 4); } }); gl.uniform4fv(P.uSpN, a); gl.uniform4fv(P.uSpC, c); gl.uniform1i(P.uNsp, G.present ? 0 : min(16, G.species.length)); }
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
  SH.cast = true; trees.draw(common, setNoise, cam, G, S); city.draw(common, setNoise, cam, G, S); fauna.beasts(common, cam, G, S, eco); SH.cast = false;
  gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, shFB.t); gl.activeTexture(gl.TEXTURE0);
}
const post = prog(`#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`, `#version 300 es
precision highp float; in vec2 v; uniform sampler2D uS; uniform float uEx, uFlash, uRainP, uSnowP, uT; uniform vec3 uFlashC; out vec4 o;
float streak(vec2 uv, float sc, float sp, float len) { vec2 p = uv * vec2(sc, sc / len); p.y += uT * sp; vec2 c = floor(p); float h = fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); vec2 f = fract(p); float x = abs(f.x - .5 - (h - .5) * .6); return step(.8, h) * smoothstep(.07 * len / 6., 0., x / max(len / 6., .2)) * smoothstep(0., .25, f.y) * smoothstep(1., .55, f.y); }
${HPOST}
void main() { vec3 c = holes(v, uS) * uEx; c = clamp(c * (2.51 * c + .03) / (c * (2.43 * c + .59) + .14), 0., 1.); c = pow(c, vec3(.4545)); vec2 w = v - .5; c *= 1. - .35 * dot(w, w); c = mix(c, uFlashC, uFlash);
  if (uRainP > 0.) { float r = streak(v + vec2(v.y * .08, 0.), 90., 2.6, 6.) + streak(v + .31, 160., 3.4, 6.) * .7 + streak(v + .73, 260., 4.2, 6.) * .5; c = mix(c, c * .8 + vec3(.55, .6, .65) * .35, r * uRainP * .6); }
  if (uSnowP > 0.) { float r = streak(v, 40., .35, 1.) + streak(v + .4, 70., .45, 1.) * .8 + streak(v + .8, 120., .55, 1.) * .6; c = mix(c, vec3(.92), min(1., r) * uSnowP * .8); }
  o = vec4(c, 1.); }`);
const VQ = gl.createVertexArray();
function mkHolesPost() { return holes.POST; }

// ---- the rest of each world, each in its own file ------------------------------------------------------------------
const sky = mkSky(gl, prog, PRE);
const trees = mkTrees(gl, prog, PRE + GLSL_NOISE + GLSL_GROUND);
const cover = mkCover(gl, prog, PRE + GLSL_NOISE + GLSL_GROUND + CLIM);
const city = mkCity(gl, prog, PRE + GLSL_NOISE + GLSL_GROUND + CLIM);
const fauna = mkFauna(gl, prog, PRE), eco = mkEco();
const life = mkLife(() => G);
const marine = mkMarine(gl, prog, PRE + GLSL_NOISE + GLSL_GROUND + CLIM);
const cave = mkCave(gl, prog, PRE);
const fire = mkFire(gl, prog, PRE);
const beavers = mkBeavers(gl, prog, PRE);
const sib = (Gh, k, p) => { const n = 1000 + Gh.n * 16 + k; return worlds[n] || (worlds[n] = sibling(Gh, k, p)); };   // a planet of the same system, made the first time it is needed
const cosmos = mkCosmos(gl, prog, PRE, world, sib);
const micro = mkMicro(gl, prog, PRE);


// ---- light: the planet's star, where it stands over this spot ------------------------------------------------------
const L = { sun: [0, 1, 0], sunC: [0, 0, 0], sky: [0, 0, 0] };
// ---- time: each planet keeps its own clock (in its own days); the season and the weather where you are ----------
const SPEEDS = [0, 1 / 1200, 1 / 60, 1 / 6, 2, 30, 365, 3650], SPN = ['stopped', 'a day in 20 minutes', 'a day a minute', 'a day in 6 seconds', 'two days a second', 'a month a second', 'a year a second', 'ten years a second'];
let speed = 1;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const LAG = 30, PACK0 = new Array(12).fill(0);
const sphAt = (G, t) => Math.sin(Math.asin(sunAt(G, t)[2])) / Math.sin(G.tilt);
const seasAt = (G, t, lat) => season(G, t, lat).s;
// the snow on the ground: a day-by-day account of the last nine months here, for places of each mean temperature from
// -30 to +25 °C (the ground shader looks its own place up by its mean temperature): snow falls on wet days when it is
// below freezing and melts by degree-days above it (3 mm of water a day for each degree), and the cover is full at about
// 25 mm of water (a quarter of a metre of snow). Precipitation is the place's own (its yearly total, on its wet days)
function snowpack(G, u, c, lat) {
  const A = G.dat && G.dat.cl ? G.dat.cl.lin(u, 1) : 11 * min(1, G.tilt / 0.41), P = c.P || 1500 * c.W, out = [], days = 270, p = cam.P.map((v) => v / 2.2e5), T = [], wet = [];
  for (let d = days; d > 0; d--) { const t = G.t - d, dr = t * 3, w = vn3(p[0] + dr, p[1] + dr * 0.6, p[2], 999 + G.kseed) * 0.7 + vn3(p[0] * 2.3 - dr, p[1] * 2.3, p[2] * 2.3 + dr, 998 + G.kseed) * 0.3;
    T.push((G.dat && G.dat.cl ? A * sphAt(G, t - LAG) : A * seasAt(G, t - LAG, lat)) + (vn3(p[0] * 1.7 + dr * 0.8, p[1] * 1.7, p[2] * 1.7 - dr * 0.5, 997 + G.kseed) - 0.5) * 14); wet.push(w > 0.52 ? P / 365 / 0.35 : 0); }
  for (let b = 0; b < 12; b++) { let swe = 0; const Tb = -30 + 5 * b; for (let k = 0; k < days; k++) { const Td = Tb + T[k]; if (Td < 0.5) swe += wet[k]; else swe = max(0, swe - Td * 3 - wet[k] * 0.5); } out.push(min(1, swe / 25)); }
  return out;
}
function clock(dt, far) {
  // past a month a second, time goes on in whole days (the hour stays put), past a year a second in whole years
  // (the season stays put too), so the sky does not flicker while the years go by
  const sp = SPEEDS[speed], dd = (G.real ? (far ? min(sp * G.dayH / 24, 1 / 86400) : sp * G.dayH / 24) : sp) * dt, un = sp >= 3650 ? G.yearD : G.real ? G.dayH / 24 : 1;
  let adv = dd; if (sp >= 30 && !far) { clock.acc = (clock.acc || 0) + dd; adv = floor(clock.acc / un) * un; clock.acc -= adv; }
  if (G.real) { realT += adv;   // (in space near the real worlds time runs at its own pace, so what moves can be caught)
 G.t = realT; world(G.n).t = realT; realSky(); } else G.t = (G.t || 0) + adv;
  const u = nrm(cam.P), lat = Math.asin(max(-1, min(1, dot(u, G.axis)))), se = season(G, G.t - LAG, lat);   // leaves turn and come out with the warmth, so a month behind the Sun too
  S.lat = lat; S.seasonS = se.s; S.spring = se.spring;
  // the year's warmth follows the Sun a month behind (land and sea take that long to warm and cool)
  S.seasT = 11 * seasAt(G, G.t - LAG, lat) * min(1, G.tilt / 0.41);
  if (G.dat && G.dat.cl) { S.sph = sphAt(G, G.t - LAG); S.seasT = G.dat.cl.lin(u, 1) * S.sph; }   // measured: this place's own swing, as far through the year as the Sun was a month ago
  S.aut = se.spring ? 0 : min(1, max(0, (0.35 - se.s) / 0.45)); S.bare = min(1, max(0, (-0.15 - se.s) / 0.4)) * (se.spring ? 1 : min(1, S.aut * 1.2));
  S.spr = se.spring ? min(1, max(0, 1 - abs(se.s + 0.1) / 0.35)) : 0;
  // rain: weather systems a few hundred km across, drifting; where it is wet enough to rain, and cold enough, snow
  const p = cam.P.map((v) => v / 2.2e5), dr = G.t * 3, w = vn3(p[0] + dr, p[1] + dr * 0.6, p[2], 999 + G.kseed) * 0.7 + vn3(p[0] * 2.3 - dr, p[1] * 2.3, p[2] * 2.3 + dr, 998 + G.kseed) * 0.3;
  const c = climate(G, u.map((x) => x * G.R), max(S.g0 || 0, 0));
  // the weather on top: weather systems bring spells warmer or colder than the season; the day warms and the night
  // cools, more under dry clear skies than wet cloudy ones; rain falls as snow when it is cold enough where you are
  const anom = (vn3(p[0] * 1.7 + dr * 0.8, p[1] * 1.7, p[2] * 1.7 - dr * 0.5, 997 + G.kseed) - 0.5) * 14, s2 = S.sun || [0, 1, 0];
  S.Tnow = c.T + S.seasT + anom + (2.5 + 5 * (1 - c.W)) * (1 - 0.6 * min(1, max(0, (w - 0.5) / 0.2))) * s2[1] * 1.4;
  S.rain = min(1, max(0, (w - 0.6) / 0.14)) * min(1, max(0, (c.W - 0.25) / 0.2)); S.snow = S.Tnow < 0.8;
  if (!(clock.pk > 0) || abs(G.t - clock.pt) > 1 || hypot(...madd(cam.P, clock.pp || cam.P, -1)) > 2e4) { clock.pk = 1; clock.pt = G.t; clock.pp = cam.P.slice(); S.pack = snowpack(G, u, c, lat); }
  S.packHere = (() => { const tb = min(10.99, max(0, (c.T + 30) / 5)), i = floor(tb); return S.pack[i] * (1 - tb % 1) + S.pack[i + 1] * (tb % 1); })();
  // aurora: near the poles, in the dark
  S.aur = min(1, max(0, (abs(lat) - 0.95) / 0.2)) * min(1, max(0, (-0.08 - (S.sun ? S.sun[1] : 1)) / 0.15));
  if (S.rain > 0.75 && !S.snow && S.cy < G.cloudBase && Math.random() < dt * 0.12 * S.rain) { flash = 0.55; flashC = [0.85, 0.88, 1]; if (snd) snd.boom(true); }   // lightning
  const day = ((G.t % 1) + 1) % 1; void day;
  if ((clock.n = (clock.n || 0) + 1) % 10 === 0) {
    const s2 = sunAt(G, G.t), pu = [u[0], u[1]], ps = [s2[0], s2[1]], ha = Math.atan2(pu[0] * ps[1] - pu[1] * ps[0], pu[0] * ps[0] + pu[1] * ps[1]), hr = ((12 - ha / (2 * PI) * G.dayH) % G.dayH + G.dayH) % G.dayH;
    const sn = abs(lat) < 0.2 || G.tilt < 0.08 ? 'no seasons here' : se.s > 0.6 ? 'summer' : se.s < -0.6 ? 'winter' : se.spring ? 'spring' : 'autumn';
    const hm = `${floor(hr)}:${String(floor(hr % 1 * 60)).padStart(2, '0')}`, dd = new Date(msOf(realT)), date = `${dd.getUTCDate()} ${MONTHS[dd.getUTCMonth()]} ${dd.getUTCFullYear()}`;
    $('clk').textContent = G.real ? (G.real === 'earth' ? `${date} · ${hm} sun time here` : `${hm} sun time of a ${G.dayH < 48 ? G.dayH.toFixed(1) + ' h' : (G.dayH / 24).toFixed(0) + '-day'} day · ${date} on Earth`) + (G.real === 'earth' ? ` · ${sn} · ${Math.round(S.Tnow)} °C${S.packHere > 0.3 ? ' · snow on the ground' : ''}` : '') + (S.rain > 0.3 && G.real === 'earth' ? (S.snow ? ' · snowing' : ' · raining') : '')
      : `day ${floor(G.t) + 1} · ${hm} of a ${G.dayH} h day · ${sn}${S.rain > 0.3 ? (S.snow ? ' · snowing' : ' · raining') : ''}`;
    $('spd').textContent = SPN[speed];
  }
}
// the real sky: the Moon over the Earth, the Earth over the Moon, each where it is now (lit by the Sun as it is)
function realSky() {
  const fr = bodyFrame(G.real, realT);
  if (G.real === 'earth') { const m = moonGeo(realT), d = toBody(fr, unitV(m)); G.moons = [[1.7374e6 / hypot(...m), Math.atan2(d[1], d[0]), Math.asin(d[2]), 0, [0.6, 0.58, 0.55]]]; }
  else if (G.real === 'moon') { const m = moonGeo(realT).map((v) => -v), d = toBody(fr, unitV(m)); G.moons = [[6.371e6 / hypot(...m), Math.atan2(d[1], d[0]), Math.asin(d[2]), 0, [0.45, 0.6, 0.95]]]; }
  else G.moons = [];
}
addEventListener('keydown', (e) => { if (e.code === 'BracketRight') speed = min(SPEEDS.length - 1, speed + 1); if (e.code === 'BracketLeft') speed = max(0, speed - 1); if (e.code === 'KeyT') speed = speed ? 0 : 1; });
document.getElementById('faster').addEventListener('click', () => { speed = (speed + 1) % SPEEDS.length; });
// lightning, called down where you are looking (or a little ahead): a flash, and if the ground is dry enough, a fire
function strike() {
  const F = axes(), d = pick(canvas.clientWidth / 2, canvas.clientHeight / 2); let v = dir(), dd = d && d < 5000 ? d : 0; if (!dd) { v = dir(cam.yaw, 0); dd = 300; }
  fire.strike(G, madd(cam.P, toPlanet(F, v), dd)); flash = 0.9; flashC = [0.88, 0.9, 1]; if (snd) snd.boom(false); if (!speed) speed = 1;
}
document.getElementById('bolt').addEventListener('click', strike);
// deep time: the same planet an age ago (planet.js ageWorld); the clock and where you stand carry over
const ageSel = $('age'); ageSel.innerHTML = AGES.map((E) => `<option value="${E}">${E === 0 ? 'today' : E < 0.1 ? '20,000 years ago' : E + ' million years ago'}</option>`).join('');
function setAge(E) { const t = G.t, up = alt() - max(ground(cam.P), 0), G1 = ageWorld(world(G.n), E), c = carry(G, G1, nrm(cam.P).map((v) => v * G.R)); cam.ref = c.M(cam.ref); G = G1; G.t = t; G.here = c.today; const u = nrm(c.p); cam.P = u.map((v) => v * (G.R + max(ground(u.map((x) => x * G.R)), 0) + up)); /* the same rock, carried on its plate, the same height above it */ ageSel.value = E; setLight(); hint(); life.redraw(G); }
ageSel.addEventListener('change', () => { setAge(+ageSel.value); ageSel.blur(); });
// time of day and month, chosen: the clock is moved on to the next sunrise, noon, sunset or midnight here (found from
// the Sun itself, so the season and latitude are right, and where the Sun does not rise, it says so), or to a month
const tGet = () => (G.real ? realT : G.t || 0), tSet = (t) => { if (G.real) { realT = t; G.t = t; world(G.n).t = t; realSky(); } else G.t = t; };
function toTime(kind) {
  const u = nrm(cam.P), el = (t) => dot(sunAt(G, t), u), t0 = tGet(), day = G.dayH / 24, n = 288, dt = day / n, hz = -0.0145; let best = null, bv = kind === 'midnight' ? 2 : -2;
  for (let i = 1; i <= n + 2; i++) { const t = t0 + i * dt, a = el(t - dt), b = el(t);
    if (kind === 'sunrise' && a < hz && b >= hz) { best = t; break; } if (kind === 'sunset' && a >= hz && b < hz) { best = t; break; }
    if (kind === 'noon' && b > bv) { bv = b; best = t; } if (kind === 'midnight' && b < bv) { bv = b; best = t; } }
  if (best === null) { const h = $('hint'), old = h.textContent; h.textContent = kind === 'sunrise' ? 'The Sun does not rise here today.' : 'The Sun does not set here today.'; setTimeout(() => { h.textContent = old; }, 3500); return; }
  tSet(best);
}
const todSel = $('tod'), monSel = $('mon');
monSel.innerHTML += MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('');
todSel.addEventListener('change', () => { if (todSel.value) toTime(todSel.value); todSel.value = ''; todSel.blur(); });
monSel.addEventListener('change', () => { const m = +monSel.value; monSel.value = ''; monSel.blur(); if (isNaN(m) || !G.real) return;
  const d = new Date(msOf(realT)); let y = d.getUTCFullYear(); if (m < d.getUTCMonth()) y++; const tg = new Date(Date.UTC(y, m, 15, d.getUTCHours(), d.getUTCMinutes())); tSet(realT + Math.round(dayOf(tg.getTime()) - realT)); });   // whole days, so the time of day stays
addEventListener('keydown', (e) => { const i = AGES.indexOf(G.E || 0); if (e.code === 'Comma' && i < AGES.length - 1) setAge(AGES[i + 1]); if (e.code === 'Period' && i > 0) setAge(AGES[i - 1]); }); addEventListener('keydown', (e) => { if (e.code === 'KeyL' && !e.repeat) strike(); });
function setLight() {
  const s = S.sun || [0, 1, 0], el = Math.asin(max(-1, min(1, s[1])));
  const k = min(1, max(0, (el * 180 / PI + 2) / 25)), sc = G.sunCol, beta = G.beta, bm = max(...beta);
  L.sun = s; L.sunC = sc.map((v, i) => v * (0.08 + 0.92 * k) * exp(-beta[i] / bm * (1 - k) * 1.5 * G.air));   // reddened low in the sky
  L.sky = beta.map((b, i) => (0.3 + 0.7 * b / bm) * 0.55 * sc[i] / 2.6 * min(1.6, 0.4 + 0.6 * G.air)).map((v) => v * (0.03 + 0.97 * min(1, max(0, (el * 180 / PI + 6) / 20))));
  const rk = (S.rain || 0) * (S.cy < G.cloudTop ? 1 : 0); L.sunC = L.sunC.map((v) => v * (1 - 0.8 * rk)); L.sky = L.sky.map((v, i) => v * (1 - 0.35 * rk) + rk * 0.04 * [1, 1, 1.05][i] * (L.sunC[1] > 0 || el > 0 ? 1 : 0));
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
  if (P.uUnder) { gl.uniform1f(P.uUnder, S.under ? 1 : 0); gl.uniform1f(P.uCamDep, max(0, -S.cy)); gl.uniform3fv(P.uLiqA, G.liqA); gl.uniform3fv(P.uLiqC, G.liqC); }
  fire.set(P, G, S); beavers.set(P);
  if (P.uSeasT) gl.uniform1f(P.uSeasT, S.seasT); if (P.uPack) gl.uniform1fv(P.uPack, S.pack || PACK0); if (P.uAut) gl.uniform1f(P.uAut, S.aut); if (P.uBare) gl.uniform1f(P.uBare, S.bare); if (P.uSpr) gl.uniform1f(P.uSpr, S.spr); if (P.uRain) gl.uniform1f(P.uRain, S.rain); if (P.uAur) { gl.uniform1f(P.uAur, S.aur); gl.uniform3fv(P.uAurC, G.aurora); }
};
let flash = 0, flashC = [1, 1, 1];
function frame(now) {
  const dt = min(0.1, (now - (frame.t || now)) / 1000); frame.t = now; fps += (1 / max(dt, 1e-3) - fps) * 0.05;
  if (now - (frame.rs || 0) > 1500) { const L = [1, 0.85, 0.7, 0.6, 0.5], i = max(0, L.indexOf(scale)); if (fps < 28 && i < 4) { scale = L[i + 1]; frame.rs = now; } else if (fps > 50 && i > 0) { scale = L[i - 1]; frame.rs = now; } }   // the resolution in a few steps, each held a second and a half (resizing reallocates every buffer: done each frame it stutters)
  const dpr = min(devicePixelRatio || 1, 2) * scale; W = max(2, round(canvas.clientWidth * dpr)); Hp = max(2, round(canvas.clientHeight * dpr));
  if (canvas.width !== W || canvas.height !== Hp) { canvas.width = W; canvas.height = Hp; }
  fly(dt);
  if (micro.M.on) {                                                        // below a micrometre: the ground's own small world
    clock(dt); setLight(); S.sunC = L.sunC; S.skyC = L.sky; targets(W, Hp); matrices(); gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.viewport(0, 0, W, Hp); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    { const sp = toPlanet(S.F, S.sun || [0, 1, 0]); micro.M.sunM = micro.M.F0.map((a) => dot(a, sp)); }
    micro.render(common, cam, G, S, W, Hp); holes.none(); finish(dt); return;
  }
  let F = axes(); octaves(F); S.cy = alt(); S.g0 = ground(S.foot); S.under = S.cy < -0.02 && S.g0 < S.cy; S.hc = max(S.cy - (S.under ? S.g0 : max(S.g0, 0)), 1e-7);
  if (holes.step(cam, G, S, dt, jump)) { F = axes(); octaves(F); S.cy = alt(); S.g0 = ground(S.foot); S.hc = max(S.cy - max(S.g0, 0), 1e-7); }
  { const far = S.cy > COS, ci = far ? cosmos.unspin(G, cam.P) : null, cr = far ? cosmos.unspin(G, cam.ref) : null; clock(dt, far); if (far) { cam.P = cosmos.spin(G, ci); cam.ref = cosmos.spin(G, cr); } }   // far off, the camera holds still among the stars while the planet turns under it
  setLight(); S.sunC = L.sunC; S.skyC = L.sky; fire.update(G, S); beavers.update(G, S);
  if (!cave.C.in && cave.enter(cam, G, S)) { cam.yaw = 0; }
  if (!cave.C.in && !S.under && ctl.mode === 'fly' && S.hc < MICRO && S.g0 > -1e9) { pick(canvas.clientWidth / 2, canvas.clientHeight * 0.75); const m = pick.mat >= 1 && pick.mat <= 5 ? pick.mat : 1;
    micro.enter(nrm(cam.P).map((v) => v * (G.R + S.cy - S.hc)), S.F.map((v) => v.slice()), [0, S.hc, 0], groundMat(m), MICRO, microLook(groundMat(m), 0)); requestAnimationFrame(frame); return; }
  S.eco = eco; eco.tick(G, S, S.F, speed ? dt : 0, speed > 0 && SPEEDS[speed] <= 1 / 60, S.hc);
  S.graze = G.real === 'earth' || !G.real ? eco.grassAt(S.foot) : 1; S.insects = eco.insAt(S.foot); S.cen = G.real === 'earth' ? eco.census(S) : null;
  S.sea = S.g0 < 0 && S.hc < 3000 ? eco.sea(G, S) : null;
  targets(W, Hp); matrices(); S.frame = (S.frame || 0) + 1; S.meet = (Gp, c) => life.meet(Gp, c); S.cast = () => SH.cast; S.shR = () => SH.r;
  if (cave.C.in) { gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.viewport(0, 0, W, Hp); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); gl.disable(gl.DEPTH_TEST); cave.render(common, cam, G, S, W, Hp); holes.none(); finish(dt); return; }
  if (S.cy > COS) {                                                        // far off: the planet as a world in space, its star, the stars, the galaxies
    for (const b of cosmos.near(G, cam)) {
      if (b.giant && b.d < b.R * 1.03) cam.P = madd(b.cP, nrm(madd(cam.P, b.cP, -1)), b.R * 1.03);   // a giant's cloud tops are as far down as you go
      if (b.w && b.d < max(COS * 1.6, b.R * 30) && b.d < S.cy * 0.6 && performance.now() - (zoomAt.home || 0) > 2000) { visit(b); break; }        // close to another planet of the system (closer than this one): it becomes the world you are on
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.viewport(0, 0, W, Hp); gl.clearBufferfv(gl.COLOR, 1, [1e12, 0, 0, 1]); gl.disable(gl.DEPTH_TEST);
    cosmos.draw(common, cam, G, S, 1, W, Hp); holes.draw(common, cam, G, S, FB, VP, W, Hp); finish(dt); return;
  }
  shadowPass();
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.viewport(0, 0, W, Hp);
  gl.clearBufferfv(gl.COLOR, 1, [1e12, 0, 0, 1]); gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 1]); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  if (!(S.cy < 6e4 && L.sun[1] > 0.12) && !S.under) cosmos.draw(common, cam, G, S, 0, W, Hp);   // behind the air (not worth drawing under a bright sky)
  sky.draw(common, cam, G, S); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  // the rings: the finest spacing a fortieth of the height above the ground; out to past the horizon
  gl.useProgram(tprog.p); common(tprog); setNoise(tprog);
  gl.uniform1f(tprog.uH0, S.g0 - S.cy); gl.uniform1f(tprog.uG0, S.g0); gl.uniformMatrix3fv(tprog.uF, false, S.F.flat()); gl.uniform3fv(tprog.uFoot, S.foot);
  gl.uniform3fv(tprog.uTf, S.tf); gl.uniform3i(tprog.uTb, ...S.tb); gl.uniform3fv(tprog.uLf, S.lf); gl.uniform3i(tprog.uLb, ...S.lb); gl.uniform1f(tprog.uNight, S.night);
  for (const [n, v] of [['uGrass', G.grass], ['uDry', G.grassDry], ['uSoil', G.soil], ['uRock', G.rock], ['uSand', G.sand], ['uLiq', G.liquid]]) gl.uniform3fv(tprog[n], v);
  gl.uniform1f(tprog.uGiant, G.giant ? 1 : 0); gl.uniform1f(tprog.uHalb, G.hMid ? 1 : 0); gl.uniform1f(tprog.uHmid, G.hMid || 0); gl.uniform1f(tprog.uSnowOff, G.snowOff || 0); gl.uniform1i(tprog.uCan, S.dt && S.dt.tex.can ? 1 : 0); gl.uniform1i(tprog.uCanT, 10); gl.uniform1i(tprog.uLit, S.dt && S.dt.tex.lit ? 1 : 0); gl.uniform1i(tprog.uLitT, 11);
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
  marine.draw(common, setNoise, cam, G, S);
  fauna.draw(common, cam, G, S, eco);
  fauna.beasts(common, cam, G, S, eco);
  if (!micro.M.on) fauna.insects(common, cam, G, S, eco);
  cave.draw(common, cam, G, S);
  beavers.draw(common, G, S);
  fire.draw(common, cam, G, S);
  holes.draw(common, cam, G, S, FB, VP, W, Hp);
  if (!S.under) sky.clouds(common, cam, G, S, FB);
  finish(dt);
}
function finish(dt) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Hp); gl.disable(gl.DEPTH_TEST);
  flash = max(0, flash - dt * 1.2);
  gl.useProgram(post.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FB.t[0]); gl.uniform1i(post.uS, 0); gl.uniform1f(post.uEx, 0.62); gl.uniform1f(post.uFlash, flash); gl.uniform3fv(post.uFlashC, flashC);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, FB.t[1]); gl.uniform1i(post.uD, 1); gl.activeTexture(gl.TEXTURE0); holes.setPost(post, W, Hp); const pr = cave.C.in ? 0 : (S.rain || 0) * (S.cy < G.cloudBase ? 1 : 0); gl.uniform1f(post.uRainP, S.snow ? 0 : pr); gl.uniform1f(post.uSnowP, S.snow ? pr : 0); gl.uniform1f(post.uT, (performance.now() - t0) / 1000);
  gl.bindVertexArray(VQ); gl.drawArrays(gl.TRIANGLES, 0, 3);
  hud(); nav.frame(performance.now() / 1000);
  requestAnimationFrame(frame);
}
// through a wormhole: out of the paired mouth on planet n, the same distance from it, looking away from it
function jump(n, m, dist) {
  G = world(n); if (G.real) { G.t = realT; m = holes.mouths(n)[0]; }
  $('age').value = 0;
  if (m.space) {                                                           // out of the mouth in space: beside it, looking back toward the Earth
    const toE = nrm(m.C.map((v) => -v)); cam.P = madd(m.C, toE, dist); cam.ref = nrm(cross(nrm(cam.P), cross(toE, nrm(cam.P)))); cam.yaw = 0; cam.pitch = 0;
    flash = 1; flashC = [0.9, 0.92, 1]; hint(); setMode('fly'); return;
  }
  const u = nrm(m.u), g = max(H(G, u.map((x) => x * G.R)), 0), tang = nrm(cross(u, cross([0.3, 0.8, 0.5], u)));
  cam.P = madd(u.map((v) => v * (G.R + g + dist * 0.35)), tang, dist); cam.ref = tang; cam.yaw = 0; cam.pitch = -0.1;
  flash = 1; flashC = G.sunCol.map((v) => min(1, v / 2.6)); hint(); setMode('walk');
}
// ---- looking and moving: drag turns, the wheel or a pinch goes toward whatever is under the pointer ----------------
function pick(px, py) {
  if (!FB) return null; gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.readBuffer(gl.COLOR_ATTACHMENT1);
  const o = new Float32Array(4); gl.readPixels(Math.floor(px * W / canvas.clientWidth), Math.floor(Hp - 1 - py * Hp / canvas.clientHeight), 1, 1, gl.RGBA, gl.FLOAT, o);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); pick.code = o[0] < 1e11 ? o[1] : 0; pick.mat = o[0] < 1e11 ? Math.round(o[2]) : 0;
  { const w = o[3], a = floor(w / 4096) / 4095 * 2 - 1, b = (w - floor(w / 4096) * 4096) / 4095 * 2 - 1, y = 1 - abs(a) - abs(b); pick.n = nrm(y >= 0 ? [a, y, b] : [(1 - abs(b)) * (a < 0 ? -1 : 1), y, (1 - abs(a)) * (b < 0 ? -1 : 1)]); }   // the surface's normal, unpacked
  return o[0] < 1e11 ? o[0] : null;
}
// ---- the microscope: what a surface is made of decides what is below it ------------------------------------------
const groundMat = (m) => (G.air < 0.01 && (m === 1 || m === 4 || m === 5) ? 10 : m);   // on an airless world, ground is regolith
function bokeh() {                                                         // the world round the point, as a macro lens blurs it: the screen's colours above and below
  const o = new Float32Array(4), top = [0, 0, 0], bot = [0, 0, 0]; let nt = 0, nb = 0;
  try { gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.readBuffer(gl.COLOR_ATTACHMENT0);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) { gl.readPixels(Math.floor((i + 0.5) / 5 * W), Math.floor((j + 0.5) / 6 * Hp), 1, 1, gl.RGBA, gl.FLOAT, o); const t = j >= 3; for (let k = 0; k < 3; k++) (t ? top : bot)[k] += min(o[k], 4); t ? nt++ : nb++; }
  } catch (e) { /* no float read: fall back on the sky */ }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return nt && top.some((v) => v > 0) ? [bot.map((v) => v / nb), top.map((v) => v / nt)] : [L.sky.map((v) => v * 0.3), L.sky.map((v) => v * 0.6)];
}
function microLook(m, code) {
  const sp = code > 0.5 ? life.look(G, code) : null, avg = G.species && G.species[0] ? G.species.map((s) => s.canopy).reduce((x, y) => x.map((v, i) => v + y[i])).map((v) => v / G.species.length) : G.soil;
  const leaf = sp ? sp.canopy : m === 6 ? G.grass : avg, bark = sp ? sp.bark : G.soil, dead = [avg[0] * 1.6 + 0.05, avg[1] * 0.9 + 0.02, avg[2] * 0.4];
  const c = { 1: [G.soil, G.rock, G.sand], 2: [G.liquid, G.sand, G.soil], 3: [[0.8, 0.83, 0.88], G.rock, G.soil], 4: [G.sand, G.rock, G.soil], 5: [G.rock, G.sand, G.soil], 6: [leaf, bark, G.soil], 7: [leaf, bark, G.soil], 8: [bark, leaf, G.soil], 9: [dead, G.soil, G.soil], 10: [G.rock, G.sand, G.soil] }[m] || [G.soil, G.rock, G.sand];
  const [bg0, bg1] = bokeh(); return { c1: c[0], c2: c[1], c3: c[2], bg0, bg1 };
}
// zooming in to a surface under the pointer: the microscope takes over there, its 'up' the surface's normal
function enterAt(r, dist, f) {
  const F = axes(); let n = pick.n.slice(); if (dot(n, r) > 0) n = n.map((v) => -v);
  if (pick.mat >= 6 && pick.mat !== 8) n = r.map((v) => -v);                // a leaf's shading normal is bent for its light: face it squarely
  for (let k = 0; k < 8 && dot(n, r) > -0.35; k++) n = nrm(madd(n, r, -0.3));   // and never meet a surface edge-on
  const d = dir(); let z = madd(d, n, -dot(d, n)); if (hypot(...z) < 1e-3) z = madd(r, n, -dot(r, n)); if (hypot(...z) < 1e-3) z = abs(n[1]) < 0.9 ? madd([0, 1, 0], n, -n[1]) : madd([1, 0, 0], n, -n[0]); z = nrm(z);
  const x = cross(n, z), m = pick.mat, code = pick.code, Fm = [x, n, z].map((a) => toPlanet(F, a)), c = r.map((v) => -v * dist * f);
  const anchor = madd(cam.P, toPlanet(F, r), dist), P = [dot(c, x), dot(c, n), dot(c, z)], dl = [dot(d, x), dot(d, n), dot(d, z)];
  const mat = groundMat(m), lk = microLook(mat, code); setMode('fly');
  micro.enter(anchor, Fm, P, mat, ENT(mat), lk); cam.yaw = Math.atan2(dl[0], dl[2]); cam.pitch = Math.asin(max(-1, min(1, dl[1])));
}
function rayAt(px, py) {
  const d = dir(), f = Math.tan(cam.fov / 2), a = canvas.clientWidth / canvas.clientHeight, sx = (px / canvas.clientWidth * 2 - 1) * f * a, sy = (1 - py / canvas.clientHeight * 2) * f;
  const r = nrm([-d[2], 0, d[0]]), u = cross(r, d); return nrm([d[0] + r[0] * sx + u[0] * sy, d[1] + r[1] * sx + u[1] * sy, d[2] + r[2] * sx + u[2] * sy]);
}
// to another planet of this system: the camera keeps its place and heading in space; that planet's clock, star and
// sky take over, and from here on everything (ground, air, plants or none) is that planet's
function visit(b) {
  const G2 = b.w, F = axes(), dI = cosmos.unspin(G, toPlanet(F, dir())), yr = (G.t || 0) / G.yearD * (G.sysYr || 1);
  if (G2.real) G2.t = realT; else { G2.t = yr / (G2.sysYr || 1) * G2.yearD; if (G2.home !== undefined) G2.sunA = Math.atan2(b.starI[1], b.starI[0]) + PI * 0; G2.sunDir = sunAt(G2, 0); }
  cam.P = cosmos.spin(G2, b.relI); const v = cosmos.spin(G2, dI), u = nrm(cam.P), t = madd(v, u, -dot(v, u));
  cam.ref = hypot(...t) > 1e-6 ? nrm(t) : nrm(cross(u, [0.3, 0.8, 0.5])); cam.yaw = 0; cam.pitch = Math.asin(max(-1, min(1, dot(v, u))));
  G = G2; $('age').value = 0; hint(); flash = 0.35; flashC = G.sunCol.map((x) => min(1, x / 2.6));
}
function leaveMicro() { const M = micro.M, p = micro.exitTo(), F = M.F0, dP = toPlanet(F, dir()); cam.P = [0, 1, 2].map((i) => M.anchor[i] + F[0][i] * p[0] + F[1][i] * p[1] + F[2][i] * p[2]);
  const dl = toLocal(axes(), dP); cam.yaw = Math.atan2(dl[0], dl[2]); cam.pitch = min(1.55, max(-1.55, Math.asin(max(-1, min(1, dl[1]))))); }   // (looking the same way in the world)
function surface() {                                                      // right yourself, wherever you are: out of the microscope or a cave
  if (micro.M.on) { const M = micro.M; M.P = [M.P[0], 1.6, M.P[2]]; leaveMicro(); cam.pitch = max(cam.pitch, -0.5); return; }   // straight back up to standing height
  if (cave.C.in) { leaveCave(); return; }
  flyV = [0, 0, 0]; const u = nrm(cam.P), g = max(stand(u.map((x) => x * G.R)), 0);
  if (S.cy > 2e6) { cam.pitch = -1.55; return; }                         // out in space: face the planet
  if (hypot(...cam.P) - G.R - g < EYE) cam.P = u.map((x) => x * (G.R + g + EYE + (ctl.mode === 'fly' ? 1 : 0)));   // in or on the ground: up to standing height
  cam.pitch = 0;                                                           // and level the view
}
function moveLocal(v, fl = 1e-6) {                                          // move by a camera-local vector, keep off the ground (by fl, flying)
  if (micro.M.on) { const M = micro.M; M.P = M.P.map((q, i) => q + v[i]); M.att = null; if (M.P[1] > M.top * 1.5) leaveMicro(); return; }
  if (cave.C.in) { if (cave.move(v, false, 0, S)) leaveCave(); return; }
  const F = axes(); cam.P = madd(cam.P, toPlanet(F, v), 1);
  const u = nrm(cam.P), g0 = stand(u.map((x) => x * G.R)), g = ctl.mode === 'fly' ? g0 : max(g0, 0), r = hypot(...cam.P), lo = G.R + g + fl; if (r < lo) { cam.P = u.map((x) => x * lo); if (fl > 1e-3) bump = performance.now(); }
}
function zoomAt(px, py, f) {                                               // f < 1 goes in, toward whatever is under the pointer
  if (micro.M.on) { const M = micro.M, Sc = micro.ride(performance.now() / 1000), T = f < 1 ? micro.target(Sc) : null, now = performance.now();
    if (f > 1) {                                                            // out: back away and rise, faster the deeper you are, so there is always a way up
      const s0 = max(M.s, now - (M.zt || 0) < 600 ? M.zo : 0, M.P[1] > 0 ? M.P[1] : 0, 1e-18), s1 = s0 * f ** (s0 < 1e-10 ? 2.5 : 1.6), v = dir(), hT = s1 * 0.7;
      M.P = M.P.map((q, i) => q - v[i] * (s1 - s0) * 0.5); if (M.P[1] < hT) M.P[1] += (hT - M.P[1]) * 0.5;
      M.s = s1; M.zo = s1; M.zt = now; M.att = null;
    } else if (T) {                                                                // deep down, a step goes toward what is at the heart of this scale, and turns to face it
      const dv = T.c.map((q, i) => q - M.P[i]), D = hypot(...dv), nd = max(D * f, 1.2e-18); if (f < 1 && D <= 1.25e-18) return;
      M.P = T.c.map((q, i) => q - dv[i] / D * nd); M.s = nd; M.att = T.att;
      const yw = Math.atan2(dv[0], dv[2]), pt = Math.asin(max(-1, min(1, dv[1] / D))), da = ((yw - cam.yaw + 3 * PI) % (2 * PI)) - PI; cam.yaw += da * 0.3; cam.pitch += (pt - cam.pitch) * 0.3;
    } else if (f < 1 && M.pf !== M.fr && pick(px, py) === null && M.P[1] > 0) { M.pf = M.fr; M.P[1] *= f; M.s = M.P[1]; M.att = null; cam.pitch += (-1.2 - cam.pitch) * 0.2;   // nothing under the pointer: down toward the surface, turning to face it
    } else { const r = rayAt(px, py), d = (M.pf !== M.fr ? pick(px, py) : null) ?? M.s; M.pf = M.fr; M.P = M.P.map((q, i) => q + r[i] * d * (1 - f)); M.s = d * f; M.att = null; if (M.P[1] < M.s * 0.05 && M.P[1] + r[1] * d * (f - 1) >= 0) M.P[1] = M.s * 0.05; 
      if (f < 1 && M.P[1] > 0 && d < M.top) {                              // and, like a microscope, swing round to look straight down at that point
        const T = M.P.map((q, i) => q + r[i] * d * f), o = M.P.map((q, i) => q - T[i]), L = hypot(...o), up = o[1] / L;
        if (up < 0.98) { const a0 = Math.asin(max(-1, min(1, up))), da = (PI / 2 - a0) * 0.3, k = nrm(cross(o, [0, 1, 0])), rot = (v) => { const c = cos(da), sn = sin(da), kv = dot(k, v); return v.map((x, i) => x * c + cross(k, v)[i] * sn + k[i] * kv * (1 - c)); };
          const o2 = rot(o), v = rot(dir()); M.P = T.map((q, i) => q + o2[i]); cam.yaw = Math.atan2(v[0], v[2]); cam.pitch = min(1.55, max(-1.55, Math.asin(max(-1, min(1, v[1]))))); } } }   // (turning with it, so the point stays under the pointer)   // (one look at what is under the pointer per frame; and no further down than the ground)
    if (M.s > M.top * 1.5 && M.P[1] > 0) leaveMicro(); return; }
  if (S.cy > 2e5 && f < 1 && pick(px, py) === null) { const l = hypot(...cam.P), nl = G.R + S.cy * f; cam.P = cam.P.map((v) => v / l * nl); zoomAt.home = performance.now(); if (S.cy < COS * 2) cam.pitch += (-1.2 - cam.pitch) * 0.25; return; }   // in empty space (above the air, nothing under the pointer), a step in heads home, turning to face it
  const r = rayAt(px, py); let dist = pick(px, py); pick.d = dist; const hc = S.hc || 1, wh = holes.hit(cam, G, S, r);
  if (wh !== null && (dist === null || wh < dist)) dist = wh;
  if (dist === null) { if (f < 1) return; dist = max(1, hc * 3); }
  if (f > 1 && S.cy > 3e26) return;
  if (f < 1 && pick.mat > 0 && dist === pick.d && dist * f < ENT(groundMat(pick.mat)) && !S.under && !cave.C.in && S.cy < 1e5) { enterAt(r, dist, f); return; }   // close to a surface: down into what it is made of
  moveLocal(r.map((v) => v * dist * (1 - f)));
  const u = nrm(cam.P), g0 = ground(u.map((x) => x * G.R)), g = S.under || ctl.mode === 'fly' && g0 < 0 && S.cy < 0 ? g0 : max(g0, 0), lo = G.R + g + dist * f * 0.02 + 1e-7; if (hypot(...cam.P) < lo) cam.P = u.map((x) => x * lo);
}
// Two ways to be here, as in Ashland: walking (the mouse captured by a click, WASD or the arrows to walk, Shift to run,
// Z to creep, Space to jump, under this planet's own gravity) and flying (F, or any scroll: W and S go where you look,
// Space and C rise and sink, Shift is faster, the pace set by how high you are, from a stride to a continent a second).
// Scrolling still goes toward whatever is under the pointer (the centre, when the mouse is captured) at any scale.
const ctl = { mode: 'walk', vy: 0, ground: true, land: 0, touch: { x: 0, y: 0 }, bob: 0 };
const EYE = 1.7, locked = () => document.pointerLockElement === canvas;
const setMode = (m) => { if (ctl.mode === m) return; ctl.mode = m; ctl.vy = 0; if (m === 'walk') ctl.land = 1; $('modet').textContent = m === 'walk' ? 'walking' : 'flying'; $('mode').dataset.m = m; };
$('mode').onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); setMode(ctl.mode === 'walk' ? 'fly' : 'walk'); };
const look = (dx, dy, k) => { cam.yaw -= dx * k; cam.pitch = min(1.55, max(-1.55, cam.pitch - dy * k)); };
let drag = null; const pts = new Map();
const touchy = matchMedia('(pointer: coarse)').matches;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && !locked() && !touchy) { canvas.requestPointerLock?.(); }
  canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { d0: null };
});
addEventListener('mousemove', (e) => { if (locked()) look(e.movementX, e.movementY, 0.0022); });
canvas.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId) || locked()) return; const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) { const [a, b] = [...pts.values()], d = hypot(a[0] - b[0], a[1] - b[1]); if (drag.d0) { setMode('fly'); zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, drag.d0 / d); } drag.d0 = d; return; }
  look(-dx, -dy, -0.004);
});
const upE = (e) => { pts.delete(e.pointerId); if (pts.size < 2 && drag) drag.d0 = null; };
canvas.addEventListener('pointerup', upE); canvas.addEventListener('pointercancel', upE);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); setMode('fly'); const [x, y] = locked() ? [canvas.clientWidth / 2, canvas.clientHeight / 2] : [e.clientX, e.clientY]; zoomAt(x, y, exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0015))); }, { passive: false });
// sound: on unless turned off (and remembered); a browser lets it start only once you click, tap or press a key
let sndOn = (() => { try { return localStorage.getItem('sylva-sound') !== '0'; } catch (e) { return true; } })();
function sndStart() { if (!sndOn) return; try { snd = snd || mkSound(); if (snd.ac.state !== 'running') snd.ac.resume(); } catch (e) { snd = null; } }
function sndToggle() { sndOn = !sndOn; try { localStorage.setItem('sylva-sound', sndOn ? '1' : '0'); } catch (e) { /* (not kept) */ } if (sndOn) sndStart(); else if (snd) snd.ac.suspend(); $('snd').textContent = sndOn ? '🔊' : '🔇'; }
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, sndStart, { capture: true, passive: true });
$('snd').onclick = (e) => { e.stopPropagation(); sndToggle(); }; $('snd').textContent = sndOn ? '🔊' : '🔇';
function sndSet() {                                                       // what the place sounds like, from where the camera is
  if (!snd || snd.ac.state !== 'running') return; const s = S.sun || [0, 1, 0], el = Math.asin(max(-1, min(1, s[1]))) * 180 / PI, cl = (x) => min(1, max(0, x)), hc = micro.M.on ? 0 : S.hc || 0;
  const u = nrm(cam.P), lat = abs(Math.asin(u[2]) * 180 / PI), alive = !G.real || G.real === 'earth', wet = (S.rain || 0) * (!S.snow && S.cy < (G.cloudTop || 1e4) ? 1 : 0);
  snd.set({ vol: cl(G.air || 0) * cl(1 - ((S.cy || 0) - 3e4) / 7e4), wind: min(1, 0.3 + 0.5 * wet + Math.log10(1 + hc) / 5) * (cave.C.in ? 0.15 : 1), day: cl((el + 4) / 20), night: 1 - cl((el + 8) / 10), rain: cave.C.in ? 0 : wet,
    fire: S.fireD ? cl(1 - S.fireD / 300) : 0, life: alive && !cave.C.in ? cl(1 - hc / 400) * (S.snow && S.bare > 0.5 ? 0.3 : 1) : 0, birds: G.real === 'earth' ? (lat < 23 ? 'tropic' : lat > 52 ? 'boreal' : 'mixed') : 'mixed', spring: S.spr > 0.5, bm: G.real === 'earth' || !G.real ? eco.birdsAt(S.foot) : 1, muffle: micro.M.on || ctl.dive > 0.05, town: G.real === 'earth' && S.cen ? cl(S.cen.urb * 2.5) * cl(1 - hc / 800) : 0 });
}
setInterval(sndSet, 250);
addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) sndToggle(); });
addEventListener('keydown', (e) => { if (e.code === 'KeyU') surface(); }); $('up').onclick = surface;
addEventListener('keydown', (e) => {
  if (e.repeat) return; keys[e.code] = 1;
  if (e.code === 'KeyF') setMode(ctl.mode === 'walk' ? 'fly' : 'walk');
  if (e.code === 'Space' && ctl.mode === 'walk' && ctl.ground && !(ctl.dive > 0)) jumpUp();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = 0; });
// touch: a stick in the lower left walks (or flies); drag elsewhere to look; pinch to change scale; two buttons
(() => {
  const st = $('stick'), kn = $('knob'); let id = null, c0 = null;
  st.addEventListener('pointerdown', (e) => { e.stopPropagation(); id = e.pointerId; st.setPointerCapture(id); const r = st.getBoundingClientRect(); c0 = [r.left + r.width / 2, r.top + r.height / 2]; });
  st.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let x = (e.clientX - c0[0]) / 50, y = (e.clientY - c0[1]) / 50; const l = hypot(x, y); if (l > 1) { x /= l; y /= l; } ctl.touch = { x, y }; kn.style.transform = `translate(${x * 40}px, ${y * 40}px)`; });
  const end = () => { id = null; ctl.touch = { x: 0, y: 0 }; kn.style.transform = ''; }; st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  $('bjump').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (ctl.mode === 'walk') { if (ctl.ground) jumpUp(); } else keys.Space = 1; });
  $('bjump').addEventListener('pointerup', () => { keys.Space = 0; });
  $('bfly').addEventListener('pointerdown', (e) => { e.stopPropagation(); setMode(ctl.mode === 'walk' ? 'fly' : 'walk'); });
})();
function leaveCave() { const o = cave.exit(G); cam.P = o.P; const F = axes(); cam.ref = nrm(madd(o.look, F[1], -dot(o.look, F[1]))); cam.yaw = 0; cam.pitch = 0; }
function jumpUp() { ctl.vy = 4.2; ctl.ground = false; }                     // the same legs everywhere: under weak gravity you go high
let flyV = [0, 0, 0], bump = 0, note = null;
function fly(dt) {
  const hc = S.hc || 1, k = keys, tx = abs(ctl.touch.x) > 0.15 ? ctl.touch.x : 0, ty = abs(ctl.touch.y) > 0.15 ? -ctl.touch.y : 0;
  const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + ty, s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + tx;
  const run = k.ShiftLeft || k.ShiftRight || hypot(tx, ty) > 0.92;
  if (ctl.mode === 'fly') {
    const v = (k.Space || k.KeyE ? 1 : 0) - (k.KeyC || k.KeyQ || k.ControlLeft ? 1 : 0), sp = max(hc, 0.05) * 1.2 * (run ? 4 : 1), d = dir(), r = nrm([-d[2], 0, d[0]]);
    const up = v > 0 ? max(sp, (run ? 4 : 1) * 2) : sp, t = [(d[0] * f + r[0] * s) * sp, d[1] * f * sp + v * up, (d[2] * f + r[2] * s) * sp];   // rising is never slower than 2 m/s, so the ground cannot hold you
    flyV = flyV.map((q, i) => q + (t[i] - q) * min(1, dt * 6));
    if (hypot(...flyV) > 1e-12) moveLocal(flyV.map((q) => q * dt), 0.05);   // flying, you stop 5 cm off the ground (scroll to go closer)
    return;
  }
  // walking: along the ground at a person's pace, held down by this planet's gravity (or along a cave floor)
  if (cave.C.in) { const sp = (run ? 6.2 : k.KeyZ ? 1.6 : 3.6) / max(1, hypot(f, s)), d = dir(cam.yaw, 0); if (cave.move([(d[0] * f - d[2] * s) * sp * dt, 0, (d[2] * f + d[0] * s) * sp * dt], true, dt, S)) leaveCave(); return; }
  const sp = (run ? 6.2 : k.KeyZ ? 1.6 : 3.6) / max(1, hypot(f, s)), d = dir(cam.yaw, 0), want = [(d[0] * f - d[2] * s) * sp, 0, (d[2] * f + d[0] * s) * sp];
  flyV = flyV.map((q, i) => i === 1 ? 0 : q + (want[i] - q) * min(1, dt * (ctl.ground ? 10 : 1.5)));
  if (hypot(...flyV) > 1e-6) { const F = axes(); cam.P = madd(cam.P, toPlanet(F, flyV.map((q) => q * dt)), 1); }
  const u = nrm(cam.P), graw = stand(u.map((x) => x * G.R)), gnd = max(graw, 0), above = hypot(...cam.P) - G.R - gnd;
  if (graw < -1.2 && ctl.land <= 0) {                                       // swimming: float at the surface; hold Space to dive, let go to come up
    ctl.dive = min(-graw - 0.6, max(0, (ctl.dive || 0) + (k.Space ? 1.6 : -0.9) * dt)); ctl.ground = false; ctl.vy = 0;
    if (snd && hypot(flyV[0], flyV[2]) > 0.3 && Math.random() < dt * 1.3) snd.step(4, 0.6);   // a stroke through the water
    flyV = flyV.map((q) => q * 0.5); cam.P = u.map((x) => x * (G.R + (ctl.dive > 0.05 ? -ctl.dive : 0.25 + Math.sin(performance.now() / 700) * 0.05))); return;
  }
  ctl.dive = 0;
  ctl.bob += hypot(flyV[0], flyV[2]) * dt * (ctl.ground ? 1 : 0);
  { const ph = floor(ctl.bob * 3.6 / PI); if (ph !== ctl.ph && snd && ctl.ground) snd.step(S.packHere > 0.3 ? 3 : S.aut > 0.5 || S.bare > 0.5 ? 1 : Math.random() < 0.5 ? 0 : 2, k.ShiftLeft || k.ShiftRight ? 1 : 0.7, Math.random() < 0.04); ctl.ph = ph; }   // a footstep each half stride, by what is underfoot
  let a;
  if (ctl.land > 0 && above > EYE + 0.5) a = EYE + (above - EYE) * exp(-dt * 2.2);            // down from the air: a glide, then gravity
  else { ctl.land = 0; ctl.vy -= 9.81 * G.g * dt; a = above + ctl.vy * dt; if (a <= EYE) { a = EYE; ctl.vy = 0; ctl.ground = true; } else ctl.ground = false; }
  const eye = a + (ctl.ground ? Math.sin(ctl.bob * 3.6) * 0.035 : 0);
  cam.P = u.map((x) => x * (G.R + gnd + eye));
}

// ---- what you are looking at, in words ---------------------------------------------------------------------------
const LY = 9.4607e15, fmtBig = (m) => { for (const [u, n] of [[LY * 1e9, ' billion light-years'], [LY * 1e6, ' million light-years'], [LY * 1e3, ' thousand light-years'], [LY * 0.1, ' light-years'], [1.496e10, ' AU']]) if (m >= u) { const k = n === ' light-years' ? LY : n === ' AU' ? 1.496e11 : u; return Number((m / k).toPrecision(2)).toLocaleString() + n; } return Number((m / 1000).toPrecision(2)).toLocaleString() + ' km'; };
const fmtSmall = (m) => { for (const [u, n] of [[1e-6, ' µm'], [1e-9, ' nm'], [1e-12, ' pm'], [1e-15, ' fm'], [0, ' am']]) if (m >= u * 0.9999 || n === ' am') { const k = n === ' am' ? 1e-18 : u; return Number((m / k).toPrecision(2)) + n; } };
const fmt = (m) => m >= 1e7 ? fmtBig(m) : m < 1e-6 ? fmtSmall(m) : m >= 1000 ? (m / 1000).toPrecision(m >= 1e4 ? 3 : 2).replace(/\.0+$/, '') + ' km' : m >= 1 ? Number(m.toPrecision(2)) + ' m' : m >= 0.01 ? Number((m * 100).toPrecision(2)) + ' cm' : m >= 1e-3 ? Number((m * 1000).toPrecision(2)) + ' mm' : Number((m * 1e6).toPrecision(2)) + ' µm';
const BANDS = [[3e25, 'the cosmic web'], [3e23, 'clusters of galaxies'], [3e21, 'galaxies'], [3e19, 'a galaxy'], [3e16, 'neighbouring stars'], [3e13, 'a star alone'], [3e10, 'a planetary system'], [2e8, 'a planet and its moons'], [2e6, 'a planet'], [2e5, 'a continent'], [2e4, 'mountain ranges'], [2e3, 'a valley'], [200, 'a forest'], [20, 'a stand of trees'], [2, 'the ground'], [0.2, 'leaf litter'], [0.02, 'a handful of soil'], [2e-3, 'grains'], [2e-4, 'silt and cells'], [2e-6, 'clay'], [3e-8, 'a clay platelet'], [2e-9, 'terraces of atoms'], [3e-10, 'atoms'], [5e-11, 'an atom'], [2e-14, 'inside an atom'], [2e-15, 'a nucleus'], [3e-16, 'a proton'], [0, 'quarks and gluons']];
// the HUD's distance: read back a frame or two later through a pixel buffer, so the CPU never waits on the GPU
// (a plain readPixels stalls the pipeline: every sixth frame took twice as long, a visible hitch in any motion)
const PB = { buf: null, sync: null, val: null };
function pickLate(px, py) {
  if (PB.sync) { if (gl.clientWaitSync(PB.sync, 0, 0) === gl.TIMEOUT_EXPIRED) return PB.val; gl.deleteSync(PB.sync); PB.sync = null; const o = new Float32Array(4); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, PB.buf); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, o); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); PB.val = o[0] < 1e11 ? o[0] : null; PB.code = o[0] < 1e11 ? o[1] : 0; }
  if (!FB) return PB.val; if (!PB.buf) { PB.buf = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, PB.buf); gl.bufferData(gl.PIXEL_PACK_BUFFER, 16, gl.STREAM_READ); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, PB.buf);
  gl.readPixels(Math.floor(px * W / canvas.clientWidth), Math.floor(Hp - 1 - py * Hp / canvas.clientHeight), 1, 1, gl.RGBA, gl.FLOAT, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); gl.bindFramebuffer(gl.FRAMEBUFFER, null); PB.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); return PB.val;
}
function hud() {
  if ((hud.n = (hud.n || 0) + 1) % 6) return;
  const c = pickLate(canvas.clientWidth / 2, canvas.clientHeight / 2), d = micro.M.on && micro.M.s < 1.5e-9 ? micro.M.s * 1.2 : c ?? (micro.M.on ? micro.M.s : S.hc * 3), w = 2 * d * Math.tan(cam.fov / 2) * canvas.clientWidth / canvas.clientHeight;
  if (micro.M.on && c !== null && !micro.M.att && !(performance.now() - (micro.M.zt || 0) < 600)) micro.M.s = c;
  $('scale').textContent = fmt(w) + ' across'; $('what').textContent = micro.M.on && w < 0.05 ? micro.label(w) : BANDS.find((b) => w >= b[0])[1];
  $('alt').textContent = micro.M.on ? (micro.M.P[1] > 0 ? `${fmt(micro.M.P[1])} above the ` : 'in among the atoms of the ') + (micro.MATS[micro.M.mat] || { on: 'ground' }).on + (w < 2e-7 ? ' · finer than light can show: the colours are a convention' : lampK(S, micro.M) > 0.35 ? ' · lit by the microscope’s lamp' : '') + ((micro.M.mat === 1 || micro.M.mat === 9) && w < 0.03 && w > 1e-5 && eco.soil(S) ? ' · ' + eco.soil(S) : '') : S.cy > 1e8 ? `${fmt(S.cy)} from ${G.name}` : cave.C.in ? `in a cave, ${fmt(max(0, cave.C.pos[2]))} in` : fmt(S.hc) + ' up · ' + holes.nearest(cam, G, S);
  if (G.E && !cave.C.in && !micro.M.on && S.cy < 1e8) { const c = carry(G, world(G.n), nrm(cam.P).map((v) => v * G.R)), la = (v) => { const d = Math.asin(max(-1, min(1, dot(nrm(v), G.axis)))) * 180 / PI; return `${abs(d).toFixed(0)}°${d < 0 ? 'S' : 'N'}`; }; $('alt').textContent += ` · this ground: ${la(cam.P)} then, ${la(c.today)} today`; }
  if (G.real && !cave.C.in && !micro.M.on && S.cy < 1e8) { const u = nrm(cam.P), la = Math.asin(u[2]) * 180 / PI, lo = Math.atan2(u[1], u[0]) * 180 / PI; $('alt').textContent += ` · ${abs(la).toFixed(2)}°${la < 0 ? 'S' : 'N'} ${abs(lo).toFixed(2)}°${lo < 0 ? 'W' : 'E'}`;
    if (G.real === 'earth' && !G.E && S.cy < 2e5) { let best = null, bd = 6e4; for (const k of CORES) { const d = hypot(u[0] - k[0], u[1] - k[1], u[2] - k[2]) * 6.371e6; if (d < bd) { bd = d; best = k; } } if (best) $('alt').textContent += bd < best[3] ? ` · in ${best[5]}` : ` · ${fmt(bd)} from ${best[5]}`; } }   // the nearest big city's core, within 60 km
  const code = PB.code ?? pick.code, an = code >= 2e6 ? drawn[Math.round(code - 2e6)] : null, sp = an || !(floor((Math.round(code) - 1) / 10000) < G.species.length) ? null : life.look(G, code), pc = (v) => (v >= 1 ? '+' : '−') + abs(Math.round((v - 1) * 100)) + '%';
  $('sp').textContent = an ? `${Who(an)}, ${an.age < 1 ? Math.round(an.age * 12) + ' months' : an.age.toFixed(0) + ' years'} old${an.dead >= 0 ? `, ${an.why === 'killed' ? 'killed' : 'dead'}` : ''} · a ${an.k.nm}, generation ${an.gen} · size ${pc(an.gn[0])}, speed ${pc(an.gn[1])}, wariness ${pc(an.gn[2])}` : sp ? sp.name : ''; $('sp').hidden = !an && !sp;
  $('eco').textContent = S.sea ? eco.seaText(S.sea) : [eco.here(S), eco.stand(S)].filter((x) => x).join(' · '); $('eco').hidden = !$('eco').textContent; $('cen').textContent = !S.sea && S.cen && S.hc < 2000 && !micro.M.on ? S.cen.text : ''; $('cen').hidden = !$('cen').textContent;
  { const e = performance.now() - bump < 3000 ? { s: 'At the ground: Space rises, U rights you, scroll looks closer', t: bump } : note && performance.now() - note.t < 6000 ? note : eco.log[eco.log.length - 1]; if (e && performance.now() - e.t < 7000) { if ($('say').textContent !== e.s) $('say').textContent = e.s; $('say').classList.add('on'); } else $('say').classList.remove('on'); }
  $('met').textContent = `${life.count(G).toLocaleString()} of ${nSpecies(G).toLocaleString()} species met` + (S.burning && S.fireD < 3e4 ? ` · fire ${fmt(S.fireD)} off` : '') + (S.pondD < 2500 ? ` · beaver pond ${fmt(S.pondD)} off` : '');
  $('lock').hidden = locked() || touchy || !$('life').hidden;
  nav.ruler(w);
}
function hint() {
  const lat = (v) => { const d = Math.asin(max(-1, min(1, dot(nrm(v), G.axis)))) * 180 / PI; return `${abs(d).toFixed(0)}°${d < 0 ? 'S' : 'N'}`; };
  $('name').textContent = G.name + (G.E ? ', ' + G.ageName : ''); $('name').title = G.E && G.here ? `this ground stood at ${lat(cam.P)} then; today it is at ${lat(G.here)}` : ''; const ty = G.starK < 4500 ? 'red' : G.starK < 5500 ? 'orange' : G.starK < 6200 ? 'yellow' : 'white';
  if (G.real) { const R = G.R + (G.dat && !G.dat.cl ? G.dat.base : 0), air = { earth: 'air', moon: 'no air', mercury: 'no air', venus: 'air 92 times as thick as ours, too hot for life', mars: 'thin cold air', jupiter: 'deep hydrogen air', saturn: 'deep hydrogen air', uranus: 'deep hydrogen air', neptune: 'deep hydrogen air' }[G.real];
    $('phys').textContent = `${(R / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km radius · ${G.g.toFixed(2)} g · ${air} · ` + (G.real === 'earth' ? `${nSpecies(G).toLocaleString()} named tree species in ${G.species.length} genera` : G.giant ? 'the tops of its clouds' : 'the ground from its measured map'); return; }
  $('phys').textContent = `${(G.R / 1000).toFixed(0)} km radius · ${G.g.toFixed(2)} g · ${G.air < 0.15 ? 'almost no' : G.air < 0.6 ? 'thin' : G.air > 1.5 ? 'thick' : ''} air · ${ty} star · ${G.lifeless ? `lifeless, ${G.Teq > 90 ? 'scorched' : G.Teq < -45 ? 'frozen' : 'barren'}` : nSpecies(G).toLocaleString() + ' tree species'}${G.home !== undefined ? ` · a sibling of ${world(G.home).name}` : ''}`.replace(' ·  air', ' · air');
}
// ---- where to go: real places, the other bodies, and the way through to the invented worlds ---------------------------
const PLACES = [['Great Smoky Mountains', 100, 35.61, -83.45], ['Yosemite Valley', 100, 37.73, -119.6], ['Grand Canyon', 100, 36.06, -112.14], ['Redwood coast, California', 100, 41.3, -124.0], ['Sonoran Desert, saguaros', 100, 32.25, -111.1],
  ['Boreal forest, Quebec', 100, 49.6, -73.4], ['Alaska, the Brooks Range', 100, 67.5, -151], ['Amazon rainforest', 100, -3.1, -60.1], ['Patagonian beech forest', 100, -41.1, -71.5], ['Atacama Desert', 100, -23.8, -68.2],
  ['The Alps, Grindelwald', 100, 46.62, 8.04], ['The Black Forest', 100, 48.0, 8.2], ['Tuscany', 100, 43.3, 11.3], ['Iceland', 100, 64.2, -19.5], ['The Sahara', 100, 23.5, 12.5], ['The Serengeti', 100, -2.33, 34.83], ['Avenue of the baobabs, Madagascar', 100, -20.25, 44.42],
  ['Himalaya, below Everest', 100, 27.9, 86.85], ['Siberian taiga, Lake Baikal', 100, 52.2, 105.5], ['Hills above Kyoto', 100, 35.08, 135.70], ['Borneo rainforest', 100, 1.0, 114.0], ['Blue Mountains, Australia', 100, -33.7, 150.3], ['Fiordland, New Zealand', 100, -45.4, 167.7], ['Greenland ice sheet', 100, 72, -40],
  ['The Moon, Mare Tranquillitatis', 101, 0.67, 23.47], ['The Moon, Tycho', 101, -43.3, -11.2], ['Mercury, Caloris basin', 102, 31.5, 162.7], ['Venus, Maxwell Montes', 103, 65.2, 3.3], ['Mars, Valles Marineris', 104, -8.5, -72], ['Mars, Olympus Mons', 104, 18.65, -133.8], ['Mars, the north polar cap', 104, 84, 0],
  ['Jupiter, at the cloud tops', 105, 0, 0], ['Saturn, at the cloud tops', 106, 10, 0], ['Uranus, at the cloud tops', 107, 0, 0], ['Neptune, at the cloud tops', 108, 0, 0], ['The wormhole at the Earth\'s L4 point', -1, 0, 0]];
const goSel = $('go'); goSel.innerHTML = '<option value="">Go to…</option><option value="here">📍 Where you are</option>' + PLACES.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
const unitLL = (la, lo) => { la *= PI / 180; lo *= PI / 180; return [cos(la) * cos(lo), cos(la) * sin(lo), sin(la)]; };
const nav = mkNav({ cam, S, G: () => G, axes, dir, micro, cave, eco, fmt, goPlace: (i) => goPlace(i), get PLACES() { return PLACES; },
  goTo(p) { if (micro.M.on) leaveMicro(); if (cave.C.in) leaveCave(); setMode('walk'); arrive(G.n, p); } });
function goPlace(i) {
  const [, n, la, lo] = PLACES[i];
  if (n < 0) { G = world(100); G.t = realT; const m = holes.mouths(100)[0], u = nrm(m.C), side = nrm(cross(u, [0.2, 0.3, 0.9])); cam.P = madd(m.C, nrm(madd(u.map((v) => -v), side, 0.35)), RL4 * 14); const F = axes(), toM = toLocal(F, nrm(madd(m.C, cam.P, -1))); cam.yaw = Math.atan2(toM[0], toM[2]); cam.pitch = Math.asin(max(-1, min(1, toM[1]))); $('age').value = 0; hint(); setMode('fly'); return; }
  const Gn = world(n), u = unitLL(la, lo); arrive(n, u.map((v) => v * Gn.R));
}
goSel.addEventListener('change', () => { if (goSel.value === 'here') goHere(true); else if (goSel.value !== '') goPlace(+goSel.value); goSel.value = ''; goSel.blur(); });
// first: on the Earth, wherever among these places the Sun now stands highest short of noon's glare
{ let best = 0, bs = -9; const E = world(100), s = sunAt(E, realT); PLACES.forEach((p, i) => { if (p[1] !== 100) return; const el = Math.asin(dot(unitLL(p[2], p[3]), s)) * 180 / PI, sc = -abs(el - 32); if (sc > bs) { bs = sc; best = i; } }); goPlace(best); }
// then, if the device will say where it is (the browser asks you first), to where you are standing, on today's Earth
function goHere(asked) {
  if (!navigator.geolocation) { if (asked) note = { s: 'This browser cannot say where you are', t: performance.now() }; return; }
  navigator.geolocation.getCurrentPosition((g) => {
    const { latitude: la, longitude: lo } = g.coords; if (micro.M.on) leaveMicro(); if (cave.C.in) leaveCave();
    if ((G.E || 0) && G.n === 100) setAge(0); setMode('walk'); const E = world(100); arrive(100, unitLL(la, lo).map((v) => v * E.R));
    note = { s: `Here: where you are, ${abs(la).toFixed(3)}°${la >= 0 ? 'N' : 'S'} ${abs(lo).toFixed(3)}°${lo >= 0 ? 'E' : 'W'}`, t: performance.now() };
  }, () => { if (asked) note = { s: 'Your location was not shared, so you stay here', t: performance.now() }; }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 6e5 });
}
goHere(false);
requestAnimationFrame(frame);
window.sylva = { nav, stand, lake: (p) => lakeAt(G, nrm(p)), get snd() { return snd; }, get eco() { return eco; }, get speed() { return speed; }, set speed(v) { speed = v; }, sunAt, goPlace, PLACES, realT: () => realT, setRealT: (t) => { realT = t; }, cosmos, micro, setAge, fire, strike, cave, setMode, ctl, moveLocal, cam, G: () => G, S, H: (p) => H(G, p), arrive, zoomAt, pick, world, frame, jump, sky: sky.S, holes };
