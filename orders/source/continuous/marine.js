// The seas, populated. On the bed, by depth and warmth: seagrass meadows in the sandy shallows, kelp forests in cool
// water (stipes reaching up toward the light, swaying in the surge), coral heads in warm shallow water. In the water:
// schools of fish round the reefs and kelp, jellyfish drifting in open water, and now and then something very large.
// Everything is a lattice fixed to the planet (as on land), coloured by the planet's genome, and drawn when you are
// under the surface.
import { AX, H, hs2, climate, rng } from './planet.js';

export function mkMarine(gl, prog, PRE) {
  const { floor, max, min, abs, hypot, sin, cos, sqrt } = Math;
  // ---- placing a band's cells on the bed (as cover.js does): where, how deep, how warm -------------------------
  const TFV = `
uniform vec4 uBand; uniform ivec2 uBase; uniform vec3 uNf, uEa, uEb, uEc; uniform float uSg, uH0, uG0; uniform int uSeed;
out vec4 tA, tB;
float hh(ivec2 c, int k) { return hs2(c, uSeed + k); }
void main() {
  int n = int(uBand.y), i = gl_VertexID % n - n / 2, j = gl_VertexID / n - n / 2; ivec2 c = uBase + ivec2(i, j);
  vec2 dd = (vec2(i, j) + vec2(hh(c, 1), hh(c, 2)) - uBand.zw) * uBand.x;
  float X = dd.x * (2. * uNf.y + dd.x) + dd.y * (2. * uNf.z + dd.y), da = -uSg * X / (sqrt(max(uNf.x * uNf.x - X, 0.)) + abs(uNf.x));
  vec3 q = uEa * da + uEb * dd.x + uEc * dd.y; float dh; vec3 g; ground(q, uBand.x * .25, dh, g); float h = uG0 + dh;
  vec3 o = q + vec3(0., uH0 + dh, 0.) + q * (h / uR); vec3 cl = climate(q, 0.);
  // a slow patchiness over the cells, so beds and reefs come in patches
  ivec2 b = c >> 4; vec2 f = vec2(c & 15) / 16.; f = f * f * (3. - 2. * f); float pa = mix(mix(hh(b, 9), hh(b + ivec2(1, 0), 9), f.x), mix(hh(b + ivec2(0, 1), 9), hh(b + ivec2(1, 1), 9), f.x), f.y);
  tA = vec4(o, h); tB = vec4(hh(c, 3), hh(c, 5) * 6.2832, cl.x, pa); gl_Position = vec4(0.);
}`;
  const tf = (() => {
    const p = gl.createProgram(), vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, PRE + TFV); gl.compileShader(vs); if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs));
    gl.shaderSource(fs, '#version 300 es\nprecision highp float; out vec4 o; void main() { o = vec4(0.); }'); gl.compileShader(fs);
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.transformFeedbackVaryings(p, ['tA', 'tB'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = { p }, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); U[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); } return U;
  })();
  const tfo = gl.createTransformFeedback(), empty = gl.createVertexArray();
  const VS = `
layout(location = 0) in vec3 aP; layout(location = 5) in vec4 iA; layout(location = 6) in vec4 iB;
uniform vec4 uBand; uniform float uFade, uCy; out vec3 vP, vN, vL; out float vW, vF, vSd, vK;
`;
  const FS = (body) => PRE + `
in vec3 vP, vN, vL; in float vW, vF, vSd, vK; uniform float uCy; uniform vec3 uHue, uHue2;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { if (h1(gl_FragCoord.xy + fract(vSd * 13.7) * 91.) > vF) discard; vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; vec3 col; float fp = vW * uPix; ` + body + `
  col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`;
  const END = `vec4 Q = uVP * vec4(vP, 1.); vW = Q.w; gl_Position = vec4(Q.xy, 0., Q.w); }`;
  const edge = `float ed = length(iA.xz) / (uBand.x * uBand.y * .5); vF = uFade * smoothstep(1., .7, ed);`;
  const lit = `float dif = max(dot(n, uSun), 0.) * .7 + .3; col = alb * (uSunC * dif + uSky * .6);`;
  // kelp: a stipe from a holdfast toward the surface, blades along it, a float at each blade, all leaning in the surge
  const kelp = prog(PRE + VS + `
void main() { ${edge} float h = iA.w, T = iB.z, sd = iB.x; if (!(h < -1.5 && h > -28. && T > 0. && T < 21. && iB.w > .45 && sd < .7)) vF = 0.;
  float L = (-h - .6) * (.7 + .3 * sd), t = aP.y, sw = sin(uT * .7 + sd * 9. + t * 3.) * .25 + sin(uT * .31 + sd * 4.) * .5;
  vec3 p = vec3(aP.x * .55, t * L, aP.z * .55 * (1. - t * .3));
  float c = cos(iB.y), s = sin(iB.y); p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z); p.x += sw * t * t * L * .25; p.z += cos(uT * .5 + sd * 7.) * t * t * L * .12;
  vP = iA.xyz + p; vN = normalize(vec3(-s, .2, c)); vL = vec3(aP.x, t, 0.); vSd = sd; ${END}`, FS(`
  if (abs(vL.x) > .5 * (.35 + .65 * abs(sin(vL.y * 40. + vSd * 7.)))) discard;   // blades, notched along the stipe
  vec3 alb = uHue2 * (.6 + .5 * vL.y) * (.8 + .4 * n2(vL.xy * vec2(20., 200.))); ${lit}`));
  // seagrass: a tuft of long blades
  const grass = prog(PRE + VS + `
void main() { ${edge} float h = iA.w, T = iB.z, sd = iB.x; if (!(h < -.3 && h > -7. && T > 6. && iB.w > .3 && sd < .8)) vF = 0.;
  float bi = floor(aP.x), b = fract(aP.x), ba = iB.y + bi * 2.4, len = (.25 + .35 * sd) * (.7 + .5 * h1(vec2(bi, sd))); vec2 dir = vec2(cos(ba), sin(ba));
  float sw = sin(uT * 1.1 + iA.x * .4 + bi) * .3 * b * b;
  vP = iA.xyz + vec3(dir.x * (.15 * b + sw) * len, len * b, dir.y * (.15 * b + sw) * len) + vec3(-dir.y, 0., dir.x) * aP.z * .004 * (1. - b * .5);
  vN = normalize(vec3(dir.x, .3, dir.y)); vL = vec3(b, aP.z, bi); vSd = sd; ${END}`, FS(`vec3 alb = uHue * (.55 + .5 * vL.x); ${lit}`));
  // corals: heads, brains and branching fingers, in warm shallow water, every colour the planet's genes allow
  const coral = prog(PRE + VS + `
void main() { ${edge} float h = iA.w, T = iB.z, sd = iB.x; if (!(h < -.6 && h > -20. && T > 20. && iB.w > .35)) vF = 0.;
  float kind = floor(sd * 3.), r = (.12 + .4 * fract(sd * 7.3)) * (kind == 2. ? .6 : 1.); vec3 q = aP;
  if (kind == 0.) q *= vec3(1., .6, 1.); else if (kind == 1.) q *= vec3(1., .8, 1.) * (1. + .15 * sin(aP.x * 20.) * sin(aP.z * 20.)); else q *= vec3(.35, 2.2, .35);
  vP = iA.xyz + q * r + vec3(0., r * .3, 0.); vN = normalize(aP); vL = aP; vSd = sd; vK = kind; ${END}`, FS(`
  float hu = fract(vSd * 5.7); vec3 alb = mix(mix(vec3(.9, .3, .4), vec3(1., .6, .2), step(.33, hu)), vec3(.6, .35, .85), step(.66, hu)) * mix(vec3(1.), uHue * 4., .2);
  alb *= .7 + .5 * smoothstep(.3, .7, n2(vL.xz * (vK == 1. ? 40. : 15.) + vL.y * 9.));   // polyps and ridges
  if (fp < .004) alb *= .85 + .3 * step(.5, fract(n2(vL.xz * 300.) * 3.));
  ${lit}`));
  // geometry
  const geo = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); return { b, n: data.length / 3 }; };
  const strip = []; for (let i = 0; i < 24; i++) { const a = i / 24, b = (i + 1) / 24; strip.push(-0.5, a, 0, 0.5, a, 0, -0.5, b, 0, -0.5, b, 0, 0.5, a, 0, 0.5, b, 0); }
  const blades = []; for (let bi = 0; bi < 6; bi++) for (let i = 0; i < 5; i++) { const a = bi + i / 5, b = bi + (i + 1) / 5 - 1e-4; blades.push(a, 0, -1, b, 0, -1, a, 0, 1, a, 0, 1, b, 0, -1, b, 0, 1); }
  const ball = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { const th = (i + a) / 10 * 6.2832, ph = (j + b) / 6 * 3.1416; ball.push(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th)); }
  const vao = (g, n) => { const v = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, g.b); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, n * n * 32, gl.DYNAMIC_COPY); for (let l = 0; l < 2; l++) { gl.enableVertexAttribArray(5 + l); gl.vertexAttribPointer(5 + l, 4, gl.FLOAT, false, 32, l * 16); gl.vertexAttribDivisor(5 + l, 1); }
    gl.bindVertexArray(null); return { v, n: g.n, ib }; };
  const BANDS = [{ s: 2.2, n: 100, P: kelp, g: geo(strip), seed: 200 }, { s: 0.3, n: 100, P: grass, g: geo(blades), seed: 220 }, { s: 0.8, n: 110, P: coral, g: geo(ball), seed: 240 }].map((b) => ({ ...b, va: vao(b.g, b.n) }));

  // ---- swimmers: fish schools, jellyfish, and whales, each tied to a lattice point in the sea ------------------
  const swim = prog(PRE + `
layout(location = 0) in vec3 aP; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform float uCy; out vec3 vP, vN, vO; out float vW, vK, vSd;
void main() {
  vec3 p = aP * iS.x; float k = iS.w; vO = aP; vK = k; vSd = iS.z;
  if (k < 1.5) p.x += sin(uT * (k < .5 ? 14. : 1.2) + iS.z * 20. + aP.z * 3.) * aP.z * aP.z * (k < .5 ? .25 : .06) * iS.x;   // a tail that beats
  else { float pu = .5 + .5 * sin(uT * 2. + iS.z * 9.); p.xz *= 1. + .25 * pu * smoothstep(0., -1., aP.y); p.y *= 1. - .15 * pu; }   // a bell that pulses
  float c = cos(iS.y), s = sin(iS.y); vP = iP.xyz + vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); vN = normalize(vec3(c * aP.x + s * aP.z, aP.y, -s * aP.x + c * aP.z));
  vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w);
}`, PRE + `
in vec3 vP, vN, vO; in float vW, vK, vSd; uniform float uCy; uniform vec3 uHue;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; vec3 alb, col;
  if (vK < .5) { float back = smoothstep(-.1, .3, vO.y); alb = mix(vec3(.75, .78, .8), mix(uHue * 3., vec3(.2, .3, .35), .5), back); alb *= .85 + .3 * step(.5, fract(vO.z * 6. + vSd * 3.)) * back; }   // a fish: silver below, coloured and barred above
  else if (vK < 1.5) alb = vec3(.18, .2, .24) * (1. + .4 * smoothstep(-.2, -.5, vO.y));                          // a whale
  else { alb = mix(uHue * 4., vec3(.8, .6, .9), .5); }
  float spec = pow(max(dot(reflect(normalize(vP), n), uSun), 0.), 30.) * (vK < .5 ? .8 : .1);
  col = alb * (uSunC * (max(dot(n, uSun), 0.) * .6 + .3) + uSky * .6) + uSunC * spec;
  if (vK > 1.5) col = col * .6 + alb * .25;                                                                           // a jelly glows a little
  col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`);
  const shape = (kind) => {                                                // fish and whale: a lens-shaped body, x across, y up, z forward; a jelly: a bell and trailing threads
    const V = [];
    if (kind < 2) { const L = kind ? 1 : 1, prof = (z) => sqrt(max(0, 1 - z * z)) * (kind ? 0.22 : 0.18);
      for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { const z = ((i + a) / 12) * 2 - 1, th = (j + b) / 8 * 6.2832, r = prof(z); V.push(cos(th) * r * (kind ? 1 : 0.45), sin(th) * r, z * L * 0.5); }
      V.push(0, 0, -0.45, 0, 0.18, -0.75, 0, -0.18, -0.75);                // the tail fin
      if (kind) V.push(0.1, 0, 0.1, 0.55, -0.02, -0.05, 0.1, 0, -0.1, -0.1, 0, 0.1, -0.55, -0.02, -0.05, -0.1, 0, -0.1);   // flippers
    } else { for (let i = 0; i < 10; i++) for (let j = 0; j < 4; j++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { const th = (i + a) / 10 * 6.2832, ph = (j + b) / 4 * 1.5708; V.push(sin(ph) * cos(th) * 0.5, cos(ph) * 0.4, sin(ph) * sin(th) * 0.5); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832, x = cos(a) * 0.35, z = sin(a) * 0.35; V.push(x, 0, z, x + 0.03, 0, z, x, -1.6, z); } }
    return geo(V);
  };
  const SH = [shape(0), shape(1), shape(2)], svao = SH.map((g) => { const v = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, g.b); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ARRAY_BUFFER, ib); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } gl.bindVertexArray(null); return { v, ib, n: g.n }; });
  const memo = new Map();
  function spots(G, S, SP, salt, test) {                                   // lattice points of the sea near the camera, each with what lives there
    const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0), out = [];
    const i0 = floor(foot[b] / SP), j0 = floor(foot[c] / SP);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const key = `${G.id}@${G.E || 0}:${salt}:${fk}:${i}:${j}`; let f = memo.get(key);
      if (f === undefined) { f = null; const p = [0, 0, 0]; p[b] = (i + hs2(i, j, salt + fk)) * SP; p[c] = (j + hs2(i, j, salt + 1 + fk)) * SP; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c];
        if (d > 0) { p[a] = sg * sqrt(d); const h = H(G, p, 18); if (h < -3) f = test(p, h, hs2(i, j, salt + 2 + fk)); } memo.set(key, f); }
      if (f) out.push(f);
    }
    return out;
  }
  const place = (G, S, p, depth, list, ...rest) => { const D = p.map((v, q) => v - S.foot[q]), F = S.F, qq = [0, 1, 2].map((r) => D[0] * F[r][0] + D[1] * F[r][1] + D[2] * F[r][2]); list.push(qq[0], qq[1] - depth - S.cy, qq[2], ...rest); };
  return {
    draw(common, setNoise, cam, G, S) {
      if (G.lifeless) return;
      if (!S.under) return;
      const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, loc = (i) => [S.F[0][i], S.F[1][i], S.F[2][i]];
      const hue = G.grass.map((v) => v * 0.5 + 0.01), hue2 = [0.2, 0.13, 0.02].map((v, i) => v * 0.85 + G.grass[i] * 0.1);
      for (const bd of BANDS) {
        const ub = foot[b] / bd.s, uc = foot[c] / bd.s, ib = floor(ub), ic = floor(uc);
        gl.useProgram(tf.p); setNoise(tf); gl.uniform4f(tf.uBand, bd.s, bd.n, ub - ib, uc - ic); gl.uniform2i(tf.uBase, ((ib % 1048576) + 1048576) % 1048576, ((ic % 1048576) + 1048576) % 1048576);
        gl.uniform3f(tf.uNf, foot[a], foot[b], foot[c]); gl.uniform3fv(tf.uEa, loc(a)); gl.uniform3fv(tf.uEb, loc(b)); gl.uniform3fv(tf.uEc, loc(c)); gl.uniform1f(tf.uSg, sg); gl.uniform1f(tf.uH0, S.g0 - S.cy); gl.uniform1f(tf.uG0, S.g0); gl.uniform1i(tf.uSeed, bd.seed);
        gl.bindVertexArray(empty); gl.enable(gl.RASTERIZER_DISCARD); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfo); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bd.va.ib);
        gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, bd.n * bd.n); gl.endTransformFeedback();
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null); gl.disable(gl.RASTERIZER_DISCARD);
        const P = bd.P; gl.useProgram(P.p); common(P); gl.uniform4f(P.uBand, bd.s, bd.n, ub - ib, uc - ic); gl.uniform1f(P.uFade, 1); gl.uniform1f(P.uCy, S.cy); gl.uniform3fv(P.uHue, hue); gl.uniform3fv(P.uHue2, hue2);
        gl.disable(gl.CULL_FACE); gl.bindVertexArray(bd.va.v); gl.drawArraysInstanced(gl.TRIANGLES, 0, bd.va.n, bd.n * bd.n);
      }
      // the swimmers
      const t = performance.now() / 1000, L = [[], [], []];
      const W = S.sea, fm = W ? min(2.5, max(0.15, W.fi / 0.5)) : 1;           // the sea's books (eco.js): as many fish as the plankton keeps, hunters as the fish keep
      for (const f of spots(G, S, 300, 300, (p, h, r) => r < 0.75 ? { p, h, n: 20 + floor(r * 80), r } : null)) {   // a school, circling and weaving
        const dep = min(-f.h - 1, 2 + 18 * f.r), R0 = 6 + 10 * f.r, n = Math.round(f.n * fm);
        if (W && (f.r * 7.3) % 1 < W.pd * 0.8) for (let k = 0; k < 1 + floor(f.r * 3); k++) {   // its hunters, sweeping round it faster
          const w = t * (0.9 + 0.2 * k) + k * 2, ox = cos(w) * (R0 + 4), oz = sin(w) * (R0 + 4), P = f.p.map((v, q) => v + S.F[0][q] * ox + S.F[2][q] * oz); place(G, S, P, dep + sin(t + k) * 2, L[1], 1, W.nm.pred === 'seals' ? 1.7 : 2.3, -w, f.r + k, 1); }
        for (let k = 0; k < n; k++) { const w = t * (0.25 + 0.1 * f.r) + k * 0.13, rr = R0 + sin(k * 7.7) * 3, ox = cos(w) * rr + sin(k * 3.1 + t * 0.6), oz = sin(w) * rr + cos(k * 2.3 + t * 0.5), oy = sin(k * 1.9 + t * 0.4) * 1.5;
          const P = f.p.map((v, q) => v + S.F[0][q] * ox + S.F[2][q] * oz); place(G, S, P, dep - oy, L[0], 1, 0.16 + 0.12 * f.r, -w, k * 0.31 + f.r, 0); }
      }
      for (const f of spots(G, S, 4000, 330, (p, h, r) => r < 0.35 * (W ? (W.nm.whale ? min(1.6, W.wh / 0.25) : 0) : 1) && h < -40 && G.whales !== false ? { p, h, r } : null)) {   // a whale, slow
        const w = t * 0.02 + f.r * 9, ox = cos(w) * 300, oz = sin(w) * 300, P = f.p.map((v, q) => v + S.F[0][q] * ox + S.F[2][q] * oz); place(G, S, P, 25 + 10 * sin(t * 0.05), L[1], 1, 14 + 6 * f.r, -w, f.r, 1);
      }
      for (const f of spots(G, S, 60, 360, (p, h, r) => r < 0.3 && h < -8 ? { p, h, r } : null)) {    // jellyfish, drifting
        const P = f.p.map((v, q) => v + S.F[0][q] * sin(t * 0.05 + f.r * 20) * 8); place(G, S, P, 3 + 5 * f.r + sin(t * 0.3 + f.r * 9) * 0.6, L[2], 1, 0.35 + 0.4 * f.r, f.r * 6, f.r, 2);
      }
      gl.useProgram(swim.p); common(swim); gl.uniform1f(swim.uCy, S.cy); gl.uniform3fv(swim.uHue, hue); gl.disable(gl.CULL_FACE);
      L.forEach((d, k) => { if (!d.length) return; const o = svao[k]; gl.bindBuffer(gl.ARRAY_BUFFER, o.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.DYNAMIC_DRAW); gl.bindVertexArray(o.v); gl.drawArraysInstanced(gl.TRIANGLES, 0, o.n, d.length / 8); });
      gl.bindVertexArray(null); void climate; void rng; void min;
    },
  };
}
