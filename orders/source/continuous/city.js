// Towns and cities, on the planets whose genome says they are inhabited. Where they stand is the planet's (cityRho in
// planet.js); here they are built: a grid of 30 m lots on the cube face, every fourth row of lots east-west and every
// fifth north-south a street, and on the rest a building whose height grows toward the city's core. Each building is
// a box with a face that has floors, windows and frames, then brick or concrete or glass, then the grain of each down
// to millimetres; at night the windows light. From farther off the ground carries the street grid and, after dark,
// the lights; from orbit a city is a grey smudge by day and a glow by night.
import { AX, LOT, cityRho, RIVD } from './planet.js';

export function mkCity(gl, prog, PRE) {
  const { floor, max, min, abs, hypot } = Math;
  const N = 200;                                                           // lots across: 6 km
  const TFV = `
uniform vec4 uBand; uniform ivec2 uBase; uniform vec3 uNf, uEa, uEb, uEc; uniform float uSg, uH0, uG0;
out vec4 tA, tB, tC;
void main() {
  int i = gl_VertexID % ${N} - ${N / 2}, j = gl_VertexID / ${N} - ${N / 2}; ivec2 c = uBase + ivec2(i, j);
  vec2 dd = (vec2(i, j) + .5 - uBand.zw) * ${LOT}.;
  float X = dd.x * (2. * uNf.y + dd.x) + dd.y * (2. * uNf.z + dd.y), da = -uSg * X / (sqrt(max(uNf.x * uNf.x - X, 0.)) + abs(uNf.x));
  vec3 q = uEa * da + uEb * dd.x + uEc * dd.y;
  float dh; vec3 g; ground(q, 8., dh, g); float h = uG0 + dh; vec3 up = normalize(vec3(0., 1., 0.) + q / uR); float sl = 1. - dot(normalize(up - (g - up * dot(g, up))), up);
  vec3 o = q + vec3(0., uH0 + dh, 0.) + q * (h / uR);
  vec3 cl = climate(q, h + ${RIVD}. * uRivC); float rd, rw, rm = riverM(q, h + ${RIVD}. * uRivC, cl.y, rd, rw); o.y -= ${RIVD}. * (rm - uRivC); float rho = cityRho(q) * citySuit(h, cl.x, cl.y, sl) * (1. - step(.05, rm));
  bool street = (c.x & 3) == 0 || (c.y + 1000000) % 5 == 0;
  float s1 = hs2(c, 120), s2 = hs2(c, 121), s3 = hs2(c, 122), park = step(hs2(c / ivec2(4, 5), 123), .12);
  float on = !street && rho > .04 && s1 < rho * 1.8 && park < .5 ? 1. : 0.;
  float ht = (4. + 3.5 * floor(1. + 2. * s2 + rho * rho * 40. * pow(s3, 2.5))) / sqrt(max(uGrav, .3));   // storeys, taller in the core; lower pull, taller towers
  tA = vec4(o - up * 1.5, ht + 1.5); tB = vec4(${LOT}. * (.55 + .3 * s2), ${LOT}. * (.55 + .3 * s1), s3, rho); tC = vec4(on, hs2(c, 124), 0., 0.);
  gl_Position = vec4(0.);
}`;
  const tfp = (() => {
    const p = gl.createProgram(), vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, PRE + TFV); gl.compileShader(vs); if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs) + (PRE + TFV).split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
    gl.shaderSource(fs, '#version 300 es\nprecision highp float; out vec4 o; void main() { o = vec4(0.); }'); gl.compileShader(fs);
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.transformFeedbackVaryings(p, ['tA', 'tB', 'tC'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = { p }, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); U[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); } return U;
  })();
  const box = prog(PRE + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 5) in vec4 iA; layout(location = 6) in vec4 iB; layout(location = 7) in vec4 iC;
uniform vec3 uTx, uTz; uniform float uReach;
out vec3 vP, vN, vU; out float vW, vSd, vRho, vF, vHt; flat out int vRoof;
void main() {
  if (iC.x < .5) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec3 up = vec3(0., 1., 0.), s = vec3(iB.x, iA.w, iB.y); vec3 p = aP * s;
  vP = iA.xyz + uTx * p.x + up * p.y + uTz * p.z; vN = uTx * aN.x + up * aN.y + uTz * aN.z;
  vU = vec3(abs(aN.x) > .5 ? p.z : p.x, p.y, abs(aN.y) > .5 ? p.z : 0.); vRoof = aN.y > .5 ? 1 : 0; vSd = iB.z; vRho = iB.w; vHt = iA.w; vF = smoothstep(uReach, uReach * .8, length(iA.xz));
  vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w);
}`, PRE + `
in vec3 vP, vN, vU; in float vW, vSd, vRho, vF, vHt; flat in int vRoof; uniform float uCy, uNight;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() {
  if (h1(gl_FragCoord.xy + vSd * 91.) > vF) discard; CAST
  float fp = vW * uPix; vec3 n = normalize(vN); vec3 alb, em = vec3(0.);
  float kind = fract(vSd * 7.31);                                          // concrete, brick, glass, render
  vec3 wall = (kind < .3 ? vec3(.55, .53, .5) : kind < .55 ? vec3(.48, .22, .14) : kind < .8 ? vec3(.22, .28, .33) : vec3(.72, .66, .55)) * (.85 + .3 * fract(vSd * 3.7));
  if (vRoof == 1) { alb = vec3(.36, .35, .34) * (.8 + .4 * n2(vU.xy * .7 + vSd * 9.)); }
  else {
    // floors 3.5 m, windows 2.6 m apart: at a distance only their mean, close up their frames and panes
    vec2 w = vec2(vU.x / 2.6, vU.y / 3.5), f = fract(w), id = floor(w); float win = step(.18, f.x) * step(f.x, .82) * step(.25, f.y) * step(f.y, .85) * step(1., id.y);
    float glassy = kind > .55 && kind < .8 ? .85 : .45, kw = smoothstep(1.2, .3, fp);
    float mean = glassy * .55; win = mix(mean, win, kw);
    vec3 pane = vec3(.04, .05, .06) + uSky * .45 * (.6 + .4 * n.y) + uSunC * .05 * pow(max(dot(reflect(normalize(vP), n), uSun), 0.), 8.);
    alb = mix(wall, pane, win * glassy);
    if (kind > .3 && kind < .55 && fp < .02) { vec2 b = vec2(vU.x / .23 + (mod(floor(vU.y / .075), 2.) * .5), vU.y / .075); vec2 bf = fract(b); float mortar = step(bf.x, .05) + step(bf.y, .12); alb = mix(alb, vec3(.55, .52, .48), clamp(mortar, 0., 1.) * (1. - win) * smoothstep(.02, .005, fp)); alb *= .85 + .3 * h1(floor(b)); }
    alb *= .85 + .3 * n2(vU.xy * 3. + vSd * 5.) * smoothstep(.3, .05, fp) + .1 * n2(vU.xy / .002) * smoothstep(.003, .0005, fp);   // weathering, and the grain of the surface
    float lit = step(.45, h1(id + vSd * 17.)) * win; em = vec3(1., .78, .45) * lit * uNight * 1.6 * (.6 + .8 * h1(id * 1.3 + vSd));
  }
  float dif = max(dot(n, uSun), 0.) * shadow(vP + n * .3), am = .5 + .3 * n.y;
  vec3 col = alb * (uSunC * dif + uSky * am * .9 + uSunC * max(uSun.y, 0.) * .22 * (1. - max(n.y, 0.))) + em;   // sun, sky, and light thrown back up off the street
  col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y);
  oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW);
}`);
  // a box: walls and a roof (x, y up from the ground, z), with normals
  const bx = [], q = (a, b, c, d, nn) => { for (const v of [a, b, c, a, c, d]) bx.push(...v, ...nn); };
  const P = (x, y, z) => [x - 0.5, y, z - 0.5];
  q(P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1), [0, 0, 1]); q(P(1, 0, 0), P(0, 0, 0), P(0, 1, 0), P(1, 1, 0), [0, 0, -1]);
  q(P(1, 0, 1), P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), [1, 0, 0]); q(P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0), [-1, 0, 0]); q(P(0, 1, 1), P(1, 1, 1), P(1, 1, 0), P(0, 1, 0), [0, 1, 0]);
  const vao = gl.createVertexArray(), ib = gl.createBuffer(), tfo = gl.createTransformFeedback(), empty = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bx), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, N * N * 48, gl.DYNAMIC_COPY); for (let l = 0; l < 3; l++) { gl.enableVertexAttribArray(5 + l); gl.vertexAttribPointer(5 + l, 4, gl.FLOAT, false, 48, l * 16); gl.vertexAttribDivisor(5 + l, 1); }
  gl.bindVertexArray(null);
  return {
    draw(common, setNoise, cam, G, S) {
      if (!G.cities || S.hc > 6000) return;
      const foot = S.foot; let any = 0; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = foot.map((v, i) => v + (S.F[0][i] * dx + S.F[2][i] * dy) * 4000); any = max(any, cityRho(G, p)); } if (any <= 0) return;
      const ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, loc = (i) => [S.F[0][i], S.F[1][i], S.F[2][i]];
      const ub = foot[b] / LOT, uc = foot[c] / LOT, ibb = floor(ub), icc = floor(uc);
      if (S.cityFrame !== S.frame) { S.cityFrame = S.frame;
      const T = tfp; gl.useProgram(T.p); setNoise(T);
      gl.uniform4f(T.uBand, LOT, N, ub - ibb, uc - icc); gl.uniform2i(T.uBase, ibb, icc);
      gl.uniform3f(T.uNf, foot[a], foot[b], foot[c]); gl.uniform3fv(T.uEa, loc(a)); gl.uniform3fv(T.uEb, loc(b)); gl.uniform3fv(T.uEc, loc(c)); gl.uniform1f(T.uSg, sg); gl.uniform1f(T.uH0, S.g0 - S.cy); gl.uniform1f(T.uG0, S.g0);
      gl.bindVertexArray(empty); gl.enable(gl.RASTERIZER_DISCARD); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfo); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, ib);
      gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, N * N); gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null); gl.disable(gl.RASTERIZER_DISCARD); }
      const tx = loc(b), tz = loc(c), pr = (v) => { const l = hypot(v[0], v[2]) || 1; return [v[0] / l, 0, v[2] / l]; };
      gl.useProgram(box.p); common(box); gl.uniform3fv(box.uTx, pr(tx)); gl.uniform3fv(box.uTz, pr(tz)); gl.uniform1f(box.uReach, N * LOT * 0.5); gl.uniform1f(box.uCy, S.cy); gl.uniform1f(box.uNight, S.night);
      gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, bx.length / 6, N * N); gl.bindVertexArray(null);
    },
  };
}
