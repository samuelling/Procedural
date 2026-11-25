// Sylva, continuous: one procedural world viewed at any scale without a cut. See world.js for the ground itself.
import { K, sOf, AMP, H, taylor, GLSL_NOISE, R_EARTH, forest } from './world.js';
import { mkTrees } from './trees.js';
import { mkCover } from './cover.js';
import { mkSky } from './sky.js';

const $ = (id) => document.getElementById(id), canvas = $('c');
const gl = canvas.getContext('webgl2', { antialias: false, depth: false, alpha: false, powerPreference: 'high-performance' });
if (!gl || !gl.getExtension('EXT_color_buffer_float')) { $('err').hidden = false; throw new Error('no WebGL2 float targets'); }
const { sin, cos, min, max, abs, floor, round, log2, exp, hypot, PI } = Math;

// ---- shared shader parts -------------------------------------------------------------------------------------------
// depth is logarithmic in distance, written per pixel: from a micrometre to a hundred thousand kilometres in one buffer
export const PRE = `#version 300 es
precision highp float; precision highp int;
uniform mat4 uVP; uniform vec3 uCam; uniform vec3 uSun, uSunC, uSky; uniform float uT, uPix, uAlt;
float fdep(float w) { return log2(max(w, 1e-7) * 1e7 + 1.) / 50.; }
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = p - i; f = f * f * (3. - 2. * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + 1.), f.x), f.y); }
// the air between the eye and a point: thicker low down, thinning out with height (scale height 8 km), and the colour it
// adds is the sky's, warmer toward the sun
vec3 air(vec3 col, vec3 rd, float d, float y0, float y1) {
  float H = 8000., a = exp(-max(y0, -100.) / H), b = exp(-max(y1, -100.) / H), od = d * (abs(y1 - y0) > 1. ? (a - b) * H / (y1 - y0) : a);
  float tr = exp(-od * 1.3e-5), mu = max(dot(rd, uSun), 0.);
  vec3 sc = uSky * vec3(.62, .78, 1.05) + uSunC * (.06 + .5 * pow(mu, 8.));
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

// ---- the camera: a position in doubles, and where it looks ---------------------------------------------------------
// start standing in a forest: the first well-wooded, gentle spot found near the origin
const START = (() => { for (let i = 0; i < 6000; i++) { const x = (i % 80) * 250 - 10000, z = Math.floor(i / 80) * 250 - 10000, h = H(x, z); if (h > 150 && h < 1300 && forest(x, z, h) > 0.97 && Math.abs(H(x + 8, z) - h) < 1 && Math.abs(H(x, z + 8) - h) < 1) return [x, z]; } return [0, 0]; })();
const cam = { C: [0, 0, 0], yaw: 0.6, pitch: -0.35, fov: 55 * PI / 180 };
const start = () => { const [x, z] = START; cam.C = [x, H(x, z) + 1.7, z]; };   // a forest floor, standing
start();
const ground = (x, z) => H(x, z);
const dir = (yaw = cam.yaw, pitch = cam.pitch) => [cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)];

// ---- the ground: nested square rings of a 64-cell grid around the eye, each twice the last; finer ones near ----
const N = 64, Hh = N / 2;
const tprog = prog(PRE + GLSL_NOISE + `
layout(location = 0) in vec2 aG;
uniform vec3 uLv; uniform float uH0, uSea, uKc, uCy; uniform int uK; uniform vec2 uCxz;
out vec3 vP, vN0; out vec2 vG; out float vW, vCe, vH;
void main() {
  float c = uLv.z, m = smoothstep(.72, .94, max(abs(aG.x), abs(aG.y)) / ${Hh}.);   // the outer band blends into the next ring's coarser grid
  vec2 g = aG - fract(aG * .5) * 2. * m, p = uLv.xy + g * c; float ce = c * (1. + m);
  float y = uH0; vec2 gr = vec2(0.);
  for (int k = 0; k < ${K}; k++) { float s = sOf(k), w = clamp(s / ce - 1.5, 0., 1.); if (w <= 0.) break; vec3 o = oct(k, p) * w; y += o.x; gr += o.yz; }
  float yr = y; y = max(y, uSea);
  float dd = length(p); if (dd > 280.) y += 17. * forest(p + uCxz, y + uCy) * smoothstep(280., 460., dd) * smoothstep(9e4, 3e4, dd);   // far off, the forest is a canopy over the ground
  y -= dot(p, p) / ${(2 * R_EARTH).toFixed(1)};                                  // the earth curves away
  vP = vec3(p.x, y, p.y); vG = gr; vCe = ce; vH = yr;
  vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w);
}`, PRE + GLSL_NOISE + `
in vec3 vP, vN0; in vec2 vG; in float vW, vCe, vH;
uniform float uH0, uSea, uCy; uniform vec4 uFine; uniform vec2 uCxz;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
float vor(vec2 u, out float id) { vec2 i = floor(u), f = u - i; float d = 9.; id = 0.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(h1(i + o), h1(i + o + 7.3)) - f; float e = dot(r, r); if (e < d) { d = e; id = h1(i + o + 3.1); } } return sqrt(d); }
void main() {
  if (vP.x > uFine.x && vP.x < uFine.z && vP.z > uFine.y && vP.z < uFine.w) discard;   // a finer ring is drawn here
  float d = length(vP), fp = max(vW * uPix, 1e-9);
  vec2 gr = vG;                                                            // finer octaves, for the light only, down to the pixel
  for (int k = 0; k < ${K}; k++) { float s = sOf(k); if (s > vCe * 2.5) continue; if (s < fp * 1.5) break; float w = (1. - clamp(s / vCe - 1.5, 0., 1.)) * clamp(s / fp * .5 - .75, 0., 1.); gr += oct(k, vP.xz).yz * w; }
  vec3 n = normalize(vec3(-gr.x, 1., -gr.y));
  float hA = vH + uCy, sl = 1. - n.y;                                     // height above the sea, and steepness
  vec2 wp = vP.xz + uCxz;                                                  // where on earth (coarse: for things that change slowly)
  bool sea = vH < uSea + 1e-4;
  // what the ground is made of, as it would look from far off: forest, meadow, rock, snow, beach
  float fo = forest(wp, hA, fp);
#define NF(q, S) mix(n2((q) / (S)), .5, smoothstep(.2, .8, fp / (S)))   // a noise, smoothed to its mean once a pixel covers it
  vec3 meadow = mix(vec3(.13, .2, .05), vec3(.25, .26, .09), NF(wp, 40.)), rock = mix(vec3(.24, .23, .21), vec3(.36, .34, .31), NF(wp, 9.));
  vec3 canopy = mix(vec3(.06, .13, .045), vec3(.1, .17, .06), NF(wp, 7.));
  float far = smoothstep(80., 420., d);                                    // under trees you see the floor; from far, their crowns
  vec3 alb = mix(meadow, mix(vec3(.11, .08, .05), canopy, far), fo);
  alb = mix(alb, rock, smoothstep(.42, .62, sl + .1 * NF(wp, 30.)) * (1. - fo * .7));
  // from above, a forest is crowns: one per tree site (the same sites the trees stand on), domes for broadleaves and
  // cones for conifers, dark gaps between; once a crown is smaller than a pixel, only their mean darkness is left
  vec3 nl = n; float cf = fo * far;
  if (cf > 0.) { float kc = smoothstep(5., 1.2, fp), sm = .7;
    if (kc > 0.) { vec2 tc = wp / 7.; ivec2 ci = ivec2(floor(tc)); float best = 0.; vec3 cn = vec3(0, 1, 0);
      for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) { ivec2 c = ci + ivec2(a, b); if (hsh(c, 42) > fo) continue;
        vec2 dv = tc - (vec2(c) + .15 + .7 * vec2(hsh(c, 40), hsh(c, 41))); bool con = hsh(c, 43) < .45 + .4 * clamp((hA - 900.) / 700., 0., 1.);
        float R = (con ? .3 : .5) * (.8 + .4 * hsh(c, 44)), q = dot(dv, dv) / (R * R);
        if (q < 1.) { float t = (con ? 1. - sqrt(q) : sqrt(1. - q)) * (.75 + .5 * hsh(c, 44)); if (t > best) { best = t; cn = con ? normalize(vec3(normalize(dv + 1e-5) * .7, .6)) : normalize(vec3(dv.x / R, sqrt(1. - q), dv.y / R)); } } }
      float cs = best > 0. ? .72 + .5 * best : .35; nl = normalize(mix(n, cn, kc * cf)); sm = mix(sm, cs, kc); }
    alb *= mix(1., sm, cf); }

  alb = mix(alb, vec3(.55, .5, .4), smoothstep(6., 2., hA));               // beach
  alb = mix(alb, rock, smoothstep(2200., 2600., hA + 200. * NF(wp, 800.)));
  alb = mix(alb, vec3(.85, .88, .92), smoothstep(2700., 2850., hA + 250. * NF(wp, 500.)) * smoothstep(.75, .45, sl));
  // close up: the floor's own grain, scale by scale, each fading in as it grows big enough to see
  float id, g1 = vor(uA[22].xy + vec2(cos(22. * 2.39996) * vP.x - sin(22. * 2.39996) * vP.z, sin(22. * 2.39996) * vP.x + cos(22. * 2.39996) * vP.z) / sOf(22), id);   // crumbs, about 3 cm
  float k1 = smoothstep(.06, .015, fp); alb *= mix(1., .8 + .35 * id - .3 * smoothstep(.3, .75, g1), k1 * (1. - far));
  float id2, g2 = vor(uA[27].xy + vec2(cos(27. * 2.39996) * vP.x - sin(27. * 2.39996) * vP.z, sin(27. * 2.39996) * vP.x + cos(27. * 2.39996) * vP.z) / sOf(27), id2);   // grains, about a millimetre
  float k2 = smoothstep(.002, .0005, fp); vec3 grain = id2 < .7 ? vec3(.06, .045, .03) * (.7 + .6 * id2) : id2 < .82 ? vec3(.3, .27, .22) : id2 < .92 ? vec3(.24, .17, .12) : vec3(.07, .07, .07);   // humus crumbs, quartz, feldspar, dark minerals
  grain *= .6 + .55 * sqrt(max(0., 1. - g2 * g2 * 1.6));   // each a little dome
  alb = mix(alb, grain * (1. - .5 * smoothstep(.35, .75, g2)), k2 * .85 * (1. - far));
  float id3, g3 = vor(uA[32].xy + vec2(cos(32. * 2.39996) * vP.x - sin(32. * 2.39996) * vP.z, sin(32. * 2.39996) * vP.x + cos(32. * 2.39996) * vP.z) / sOf(32), id3);   // finer grains and clay, tens of micrometres
  float k3 = smoothstep(6e-5, 1.5e-5, fp); alb = mix(alb, alb * (.7 + .6 * id3) * (1. - .4 * smoothstep(.4, .8, g3)), k3);
  vec3 col;
  if (sea) { vec3 r = reflect(normalize(vP), vec3(0, 1, 0)); float fr = .02 + .98 * pow(1. - max(dot(-normalize(vP), vec3(0, 1, 0)), 0.), 5.); col = mix(vec3(.01, .04, .06), uSky * .9 + uSunC * pow(max(dot(r, uSun), 0.), 400.) * 8., fr); }
  else { float dif = max(dot(nl, uSun), 0.), am = .55 + .45 * nl.y; col = alb * (uSunC * dif + uSky * am * .55); }
  col = air(col, normalize(vP), d, uCy, hA);
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

// ---- per frame: the camera's place in every octave's lattice, and each octave's local shape there ----------------
const UA = new Float32Array(K * 4), UB = new Float32Array(K * 4), UC = new Float32Array(K);
function octaves() {
  const [x, , z] = cam.C;
  for (let k = 0; k < K; k++) { const t = taylor(k, x, z); UA.set([t[0], t[1], t[2], AMP[k]], k * 4); UB.set([t[3], t[4], t[5], t[6]], k * 4); UC[k] = t[7]; }
}
const setNoise = (P) => { gl.uniform4fv(P.uA, UA); gl.uniform4fv(P.uB, UB); gl.uniform1fv(P.uC, UC); };

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
const post = prog(`#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`, `#version 300 es
precision highp float; in vec2 v; uniform sampler2D uS; uniform float uEx; out vec4 o;
void main() { vec3 c = texture(uS, v).rgb * uEx; c = clamp(c * (2.51 * c + .03) / (c * (2.43 * c + .59) + .14), 0., 1.); c = pow(c, vec3(.4545)); vec2 w = v - .5; c *= 1. - .35 * dot(w, w); o = vec4(c, 1.); }`);
const VQ = gl.createVertexArray();

// ---- the rest of the world, each in its own file -------------------------------------------------------------------
const sky = mkSky(gl, prog, PRE);
const trees = mkTrees(gl, prog, PRE + GLSL_NOISE);
const cover = mkCover(gl, prog, PRE + GLSL_NOISE);

// ---- light ---------------------------------------------------------------------------------------------------------
const L = { sun: [0, 1, 0], sunC: [0, 0, 0], sky: [0, 0, 0], day: 0.36 };
function light() {
  const el = (8 + 52 * sin(PI * min(max(L.day, 0), 1))) * PI / 180, az = (110 + L.day * 180) * PI / 180;
  L.sun = [cos(el) * sin(az), sin(el), cos(el) * cos(az)];
  const k = min(1, max(0, (el * 180 / PI - 2) / 30));
  L.sunC = [2.3, 1.75 + 0.5 * k, 1.1 + 1.0 * k].map((v) => v * (0.35 + 0.65 * k));
  L.sky = [0.28, 0.5, 0.95].map((v, i) => v * (0.45 + 0.55 * k) + [0.25, 0.12, 0.02][i] * (1 - k) * 0.5);
}
light();

// ---- frame ---------------------------------------------------------------------------------------------------------
const VP = new Float32Array(16);
let W = 0, Hp = 0, t0 = performance.now(), fps = 60, scale = 1;
const keys = {};
function matrices() {
  const d = dir(), up = [0, 1, 0], rx = [-d[2], 0, d[0]], rl = hypot(rx[0], rx[2]) || 1, r = [rx[0] / rl, 0, rx[2] / rl];
  const u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  const f = 1 / Math.tan(cam.fov / 2), a = W / Hp;
  // camera at the origin; rows: right, up, -forward
  const V = [r[0], u[0], -d[0], 0, r[1], u[1], -d[1], 0, r[2], u[2], -d[2], 0, 0, 0, 0, 1];
  const P = [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, -1, -1, 0, 0, -1, 0];
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + rr] * V[c * 4 + k]; VP[c * 4 + rr] = s; }
  void up;
}
const common = (P) => { gl.uniformMatrix4fv(P.uVP, false, VP); gl.uniform3fv(P.uSun, L.sun); gl.uniform3fv(P.uSunC, L.sunC); gl.uniform3fv(P.uSky, L.sky); gl.uniform1f(P.uT, (performance.now() - t0) / 1000); gl.uniform1f(P.uPix, 2 * Math.tan(cam.fov / 2) / Hp); gl.uniform1f(P.uAlt, cam.C[1]); };
export const state = { cam, L, get W() { return W; }, get H() { return Hp; } };

function frame(now) {
  const dt = min(0.1, (now - (frame.t || now)) / 1000); frame.t = now; fps += (1 / max(dt, 1e-3) - fps) * 0.05;
  if (fps < 28 && scale > 0.5) scale *= 0.97; else if (fps > 50 && scale < 1) scale = min(1, scale * 1.02);
  const dpr = min(devicePixelRatio || 1, 2) * scale; W = max(2, round(canvas.clientWidth * dpr)); Hp = max(2, round(canvas.clientHeight * dpr));
  if (canvas.width !== W || canvas.height !== Hp) { canvas.width = W; canvas.height = Hp; }
  fly(dt);
  targets(W, Hp); matrices(); octaves();
  const [cx, cy, cz] = cam.C, g0 = ground(cx, cz), hc = max(cy - max(g0, 0), 1e-7);
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.viewport(0, 0, W, Hp);
  gl.clearBufferfv(gl.COLOR, 1, [1e12, 0, 0, 1]); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST); sky.draw(common, VP, L, cam); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  // the rings: the finest spacing a fortieth of the height above the ground; out to well past the horizon
  gl.useProgram(tprog.p); common(tprog); setNoise(tprog);
  gl.uniform1f(tprog.uH0, g0 - cy); gl.uniform1f(tprog.uSea, -cy); gl.uniform1f(tprog.uCy, cy); gl.uniform2f(tprog.uCxz, cx, cz);
  gl.bindVertexArray(grid.vao);
  const c0 = max(hc / 40, 1e-6), reach = max(8000, Math.sqrt(2 * R_EARTH * max(cy, 1)) * 1.3, hc * 40);
  let fine = [1, 1, -1, -1];
  for (let j = 0; ; j++) {
    const c = c0 * 2 ** j, cxr = floor(cx / (2 * c)) * 2 * c - cx, czr = floor(cz / (2 * c)) * 2 * c - cz;
    gl.uniform3f(tprog.uLv, cxr, czr, c); gl.uniform4fv(tprog.uFine, fine);
    if (j === 0) gl.drawElements(gl.TRIANGLES, grid.nf, gl.UNSIGNED_SHORT, 0); else gl.drawElements(gl.TRIANGLES, grid.nr, gl.UNSIGNED_SHORT, grid.nf * 2);
    const e = Hh * c; fine = [cxr - e + c * 0.02, czr - e + c * 0.02, cxr + e - c * 0.02, czr + e - c * 0.02];   // (what this ring covers, so the next leaves it alone)
    if (e > reach || j > 40) break;
  }
  trees.draw(common, setNoise, cam, hc, g0);
  cover.draw(common, setNoise, cam, hc, g0);
  sky.clouds(common, VP, L, cam, FB);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Hp); gl.disable(gl.DEPTH_TEST);
  gl.useProgram(post.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FB.t[0]); gl.uniform1i(post.uS, 0); gl.uniform1f(post.uEx, 0.62);
  gl.bindVertexArray(VQ); gl.drawArrays(gl.TRIANGLES, 0, 3);
  hud(hc);
  requestAnimationFrame(frame);
}

// ---- looking and moving: drag turns, the wheel or a pinch goes toward whatever is under the pointer ----------------
function pick(px, py) {                                                    // the distance to what is drawn at a screen point
  if (!FB) return null; gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f); gl.readBuffer(gl.COLOR_ATTACHMENT1);
  const o = new Float32Array(4); gl.readPixels(Math.floor(px * W / canvas.clientWidth), Math.floor(Hp - 1 - py * Hp / canvas.clientHeight), 1, 1, gl.RGBA, gl.FLOAT, o);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); return o[0] < 1e11 ? o[0] : null;
}
function rayAt(px, py) {
  const d = dir(), f = Math.tan(cam.fov / 2), a = canvas.clientWidth / canvas.clientHeight, sx = (px / canvas.clientWidth * 2 - 1) * f * a, sy = (1 - py / canvas.clientHeight * 2) * f;
  const r = [-d[2], 0, d[0]], rl = hypot(r[0], r[2]) || 1; r[0] /= rl; r[2] /= rl;
  const u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  const v = [d[0] + r[0] * sx + u[0] * sy, d[1] + r[1] * sx + u[1] * sy, d[2] + r[2] * sx + u[2] * sy], l = hypot(...v); return v.map((q) => q / l);
}
function zoomAt(px, py, f) {                                               // f < 1 goes in
  const r = rayAt(px, py); let dist = pick(px, py);
  if (dist === null) dist = max(1, (cam.C[1] - max(ground(cam.C[0], cam.C[2]), 0)) * 3);
  const C = cam.C, P = [C[0] + r[0] * dist, C[1] + r[1] * dist, C[2] + r[2] * dist];
  let n = [P[0] + (C[0] - P[0]) * f, P[1] + (C[1] - P[1]) * f, P[2] + (C[2] - P[2]) * f];
  const g = max(ground(n[0], n[2]), 0); if (n[1] < g + dist * f * 0.02 + 1e-7) n[1] = g + dist * f * 0.02 + 1e-7;
  if (f > 1 && n[1] - g > 3e6) return;
  cam.C = n; idle = 0;
}
let drag = null, idle = 0, flyV = [0, 0, 0];
const pts = new Map();
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, d0: null }; idle = 0; });
canvas.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) { const [a, b] = [...pts.values()], d = hypot(a[0] - b[0], a[1] - b[1]); if (drag.d0) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, drag.d0 / d); drag.d0 = d; return; }
  cam.yaw -= dx * 0.004; cam.pitch = min(1.5, max(-1.5, cam.pitch + dy * 0.004));
});
const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2 && drag) drag.d0 = null; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0015))); }, { passive: false });
addEventListener('keydown', (e) => { keys[e.code] = 1; }); addEventListener('keyup', (e) => { keys[e.code] = 0; });
function fly(dt) {                                                         // WASD moves at a pace set by how high you are: a stride on the ground, a valley a second from the air
  const hc = max(cam.C[1] - max(ground(cam.C[0], cam.C[2]), 0), 1e-6), sp = max(hc, 2e-5) * 1.6 * (keys.ShiftLeft ? 4 : 1);
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), v = (keys.KeyE || keys.Space ? 1 : 0) - (keys.KeyQ || keys.KeyC ? 1 : 0);
  const d = dir(cam.yaw, 0), tx = (d[0] * f - d[2] * s) * sp, tz = (d[2] * f + d[0] * s) * sp, ty = v * sp;
  flyV = flyV.map((q, i) => q + ([tx, ty, tz][i] - q) * min(1, dt * 8));
  if (hypot(...flyV) < 1e-12) return;
  cam.C = cam.C.map((q, i) => q + flyV[i] * dt);
  const g = max(ground(cam.C[0], cam.C[2]), 0); if (cam.C[1] < g + 1e-6) cam.C[1] = g + 1e-6;
  idle = 0;
}

// ---- what you are looking at, in words ---------------------------------------------------------------------------
const fmt = (m) => m >= 1000 ? (m / 1000).toPrecision(m >= 1e4 ? 3 : 2).replace(/\.0+$/, '') + ' km' : m >= 1 ? m.toPrecision(2).replace(/\.0$/, '') + ' m' : m >= 0.01 ? (m * 100).toPrecision(2) + ' cm' : m >= 1e-3 ? (m * 1000).toPrecision(2) + ' mm' : (m * 1e6).toPrecision(2) + ' µm';
const BANDS = [[2e5, 'a continent'], [2e4, 'mountain ranges'], [2e3, 'a valley'], [200, 'a forest'], [20, 'a stand of trees'], [2, 'the forest floor'], [0.2, 'leaf litter'], [0.02, 'a handful of soil'], [2e-3, 'grains'], [2e-4, 'silt and cells'], [0, 'clay']];
function hud(hc) {
  if ((hud.n = (hud.n || 0) + 1) % 6) return;
  const c = pick(canvas.clientWidth / 2, canvas.clientHeight / 2), d = c ?? hc * 3, w = 2 * d * Math.tan(cam.fov / 2) * canvas.clientWidth / canvas.clientHeight;
  $('scale').textContent = fmt(w) + ' across'; $('what').textContent = BANDS.find((b) => w >= b[0])[1];
  $('alt').textContent = fmt(hc) + ' up';
  $('bar').style.width = min(100, max(2, (log2(w) + 20) / 41 * 100)) + '%';
}
requestAnimationFrame(frame);
window.sylva = { cam, L, light, H, start, zoomAt, pick, START, sky: sky.S };
