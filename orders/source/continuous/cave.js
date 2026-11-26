// Caves. On karst hillsides a few mouths open in every few km; walk or fly into one and the surface gives way to a
// passage hundreds of metres long: winding, widening into chambers, hung with stalactites and grown with stalagmites,
// pools on the floor, glowworms on the ceiling, lit by daylight near the mouth and by your own lamp beyond. Like the
// land, it is one function (a distance field shared by the page and the shader), so any part of it can be walked
// to and looked at as closely as you like: flowstone bands, then crystals. Come back out the way you went in.
import { AX, H, hs2, climate, cityRho } from './planet.js';

const { floor, max, min, abs, hypot, sin, cos, sqrt, exp } = Math;
export const CAVE_L = 620;                                                 // metres of passage
// the passage: a centreline that wanders, a radius that swells into chambers, a floor, and the rock's roughness
const SDF = `
float h3c(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3c(vec3 p) { vec3 i = floor(p), f = p - i; f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3c(i), h3c(i + vec3(1, 0, 0)), f.x), mix(h3c(i + vec3(0, 1, 0)), h3c(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3c(i + vec3(0, 0, 1)), h3c(i + vec3(1, 0, 1)), f.x), mix(h3c(i + vec3(0, 1, 1)), h3c(i + 1.), f.x), f.y), f.z); }
uniform vec4 uCs;   // the cave's own seeds
vec2 cCen(float z) { return vec2(7. * sin(z * .031 + uCs.x) + 3. * sin(z * .077 + uCs.y), 2.5 * sin(z * .043 + uCs.z) + z * .02); }
float cRad(float z) { float s = sin(z * .05 + uCs.w); return 2.4 + 1.6 * s * s + (z > 40. ? 9. * exp(-pow((mod(z, 150.) - 75.) / 16., 2.)) : 0.) - 1.2 * smoothstep(${CAVE_L - 40}., ${CAVE_L}., z); }
// distance to rock (positive in the air), and the floor's height here
float cave(vec3 p, out float fl) {
  vec2 c = cCen(p.z); float r = cRad(p.z), d = r - length((p.xy - c) * vec2(1., 1.25));
  fl = c.y - r * .62; d = min(d, p.y - fl);                                // a floor of settled sediment
  d = min(d, ${CAVE_L}. - p.z); d = max(d, -p.z * 2.);                       // closed at the end, open at the mouth
  d += .45 * (n3c(p * .55) - .5) + .18 * (n3c(p * 1.7) - .5) + .05 * (n3c(p * 6.) - .5);
  // stalactites from the roof and stalagmites from the floor, one per 1.6 m cell where the hash says
  vec2 cl = floor(p.xz / 1.6); for (int i = 0; i <= 1; i++) for (int j = 0; j <= 1; j++) { vec2 ce = cl + vec2(i, j); float h = h3c(vec3(ce, 3.)); if (h < .55) continue;
    vec2 cp = (ce + .3 + .4 * vec2(h3c(vec3(ce, 4.)), h3c(vec3(ce, 5.)))) * 1.6; float L = .5 + 3. * h3c(vec3(ce, 6.)) * h3c(vec3(ce, 6.)), top = cCen(cp.y).y + cRad(cp.y) * .78;
    if (h > .78) { float t = clamp((top - p.y) / L, 0., 1.); if (p.y > top - L) d = min(d, length(p.xz - cp) - .32 * (1. - t) - .02); }
    else { float fl2 = cCen(cp.y).y - cRad(cp.y) * .62, t = clamp((p.y - fl2) / (L * .7), 0., 1.); if (p.y > fl2 - .2 && p.y < fl2 + L * .7) d = min(d, length(p.xz - cp) - .38 * (1. - t) - .03); } }
  return d;
}`;

export function mkCave(gl, prog, PRE) {
  const P = prog(`#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`, PRE + SDF + `
in vec2 v; uniform vec3 uR, uU, uF, uPos, uDay; uniform vec2 uTan; uniform float uDayK;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
float map(vec3 p) { float f; return cave(p, f); }
void main() {
  vec2 s = (v * 2. - 1.) * uTan; vec3 rd = normalize(uF + uR * s.x + uU * s.y), ro = uPos; float t = 0., hit = 0.;
  for (int i = 0; i < 140; i++) { float d = map(ro + rd * t); if (d < max(.0004 * t, 2e-6)) { hit = 1.; break; } t += d * .7; if (t > 400.) break; }
  vec3 col;
  if (hit < .5) { col = ro.z < 30. && rd.z < 0. ? uDay * 2. : vec3(0.); oC = vec4(col, 1.); oD = vec4(1e12, 0, 0, 1); gl_FragDepth = 1.; return; }
  vec3 p = ro + rd * t; float fl; cave(p, fl); vec2 e = vec2(max(.0005 * t, 1e-5), 0.);
  vec3 n = normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
  float fp = t * uPix;
  // limestone: cream and ochre flowstone in bands, darker where water runs, crystals close up
  float band = n3c(vec3(p.y * 3., p.x * .2, p.z * .2)), wet = smoothstep(.55, .75, n3c(p * .8 + 7.));
  vec3 alb = mix(vec3(.62, .55, .44), vec3(.55, .36, .2), smoothstep(.35, .7, band)) * (.8 + .3 * n3c(p * 9.));
  alb = mix(alb, alb * .55, wet);
  if (fp < .002) alb *= .8 + .4 * smoothstep(.6, .9, n3c(p * 900.)) * smoothstep(.002, .0004, fp);   // calcite crystals
  bool pool = p.y < fl + .2 && n.y > .8 && n3c(vec3(p.xz * .15, 1.)) > .55;
  // your lamp, the daylight from the mouth, and glowworms on the roof
  vec3 l = ro - p; float ld = length(l); l /= ld;
  float fall = 2.6 / (1. + ld * ld * .25 + ld * .4), lamp = max(dot(n, l), 0.) * fall, spec = pow(max(dot(reflect(-l, n), -rd), 0.), wet > .5 || pool ? 60. : 12.) * (wet * .8 + (pool ? 2. : .05)) * fall;
  vec3 day = uDay * exp(-p.z / 10.) * (.6 + .4 * max(-n.z, 0.)) * .8;
  col = alb * (vec3(1., .85, .65) * lamp * .35 + day) + vec3(1., .9, .75) * spec * .12;
  if (pool) col = mix(col * .2, vec3(.02, .04, .05) + vec3(1., .9, .75) * spec * .25, .8);
  if (n.y < -.4) { vec3 c = floor(p * 4.); float g = step(.985, h3c(c)) * smoothstep(.25, 0., length(fract(p * 4.) - .5)); col += vec3(.2, .9, .8) * g * (.5 + .5 * sin(uT * 2. + h3c(c + 1.) * 30.)) * 1.5; }
  col *= exp(-t * .01);
  oC = vec4(col, 1.); oD = vec4(t, 0, 0, 1); gl_FragDepth = fdep(t);
}`);
  // the mouth, seen from outside: a dark opening in the hillside with a rim of rock
  const M = prog(PRE + `
layout(location = 0) in vec3 aP; uniform vec3 uC, uX, uZ; uniform float uS, uCy; out vec3 vP, vO; out float vW;
void main() { vec3 q = aP * vec3(uS, uS * .7, uS * .6); vP = uC + uX * q.x + vec3(0., 1., 0.) * q.y + uZ * q.z; vO = aP; vec4 Q = uVP * vec4(vP, 1.); vW = Q.w; gl_Position = vec4(Q.xy, 0., Q.w); }`, PRE + `
in vec3 vP, vO; in float vW; uniform float uCy; layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { float r = length(vO.xy); vec3 col = mix(vec3(.0015), vec3(.08, .07, .06) * (uSunC * .5 + uSky), smoothstep(.75, 1., r)); col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`);
  const disc = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI, b = (i + 1) / 24 * Math.PI; disc.push(0, 0, 0, cos(a), sin(a), 0, cos(b), sin(b), 0); }   // a half-disc arch
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI, b = (i + 1) / 24 * Math.PI; disc.push(cos(a), sin(a), 0, cos(b), sin(b), 0, cos(a) * 0.9, sin(a) * 0.9, 1.5, cos(b), sin(b), 0, cos(b) * 0.9, sin(b) * 0.9, 1.5, cos(a) * 0.9, sin(a) * 0.9, 1.5); }   // and its throat
  const mv = gl.createVertexArray(); gl.bindVertexArray(mv); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(disc), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
  const vq = gl.createVertexArray(), memo = new Map(), SP = 2500;
  // the mouths near the camera: on steep enough, dry enough land, out of towns
  function mouths(G, S) {
    const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0), out = [];
    const i0 = floor(foot[b] / SP), j0 = floor(foot[c] / SP);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const key = `${G.n}:${fk}:${i}:${j}`; let f = memo.get(key);
      if (f === undefined) { f = null; if (hs2(i, j, 400 + fk) < 0.7) for (let tr = 0; tr < 12 && !f; tr++) {
        const p = [0, 0, 0]; p[b] = (i + hs2(i, j, 401 + fk + tr * 7)) * SP; p[c] = (j + hs2(i, j, 402 + fk + tr * 7)) * SP; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c]; if (d <= 0) continue; p[a] = sg * sqrt(d);
        const h = H(G, p, 22); if (h < 25 || h > 3000 || cityRho(G, p) > 0.05) continue;
        const u = p.map((v) => v / G.R), e1 = [u[1], -u[0], 0].map((v) => v / (hypot(u[0], u[1]) || 1)), e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
        const gx = (H(G, p.map((v, k) => v + e1[k] * 6), 22) - h) / 6, gz = (H(G, p.map((v, k) => v + e2[k] * 6), 22) - h) / 6, sl = hypot(gx, gz);
        if (sl < 0.35) continue; const down = e1.map((v, k) => -(v * gx + e2[k] * gz) / sl);   // the mouth faces downhill
        f = { p, h, down, seed: [hs2(i, j, 403 + fk) * 6, hs2(i, j, 404 + fk) * 6, hs2(i, j, 405 + fk) * 6, hs2(i, j, 406 + fk) * 6], id: key };
      } memo.set(key, f); }
      if (f) out.push(f);
    }
    return out;
  }
  // the same distance field on the page, for walking and bumping into things
  const h3 = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - floor(v); };
  const n3 = (x, y, z) => { const i = floor(x), j = floor(y), k = floor(z); let f = x - i, g = y - j, hh = z - k; f = f * f * (3 - 2 * f); g = g * g * (3 - 2 * g); hh = hh * hh * (3 - 2 * hh); const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(h3(i, j, k), h3(i + 1, j, k), f), L(h3(i, j + 1, k), h3(i + 1, j + 1, k), f), g), L(L(h3(i, j, k + 1), h3(i + 1, j, k + 1), f), L(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), f), g), hh); };
  const cen = (s, z) => [7 * sin(z * 0.031 + s[0]) + 3 * sin(z * 0.077 + s[1]), 2.5 * sin(z * 0.043 + s[2]) + z * 0.02];
  const rad = (s, z) => { const q = sin(z * 0.05 + s[3]), w = (((z % 150) + 150) % 150 - 75) / 16; return 2.4 + 1.6 * q * q + (z > 40 ? 9 * exp(-w * w) : 0) - 1.2 * Math.min(1, Math.max(0, (z - (CAVE_L - 40)) / 40)); };
  const sdf = (s, p) => { const c = cen(s, p[2]), r = rad(s, p[2]); let d = r - hypot(p[0] - c[0], (p[1] - c[1]) * 1.25); const fl = c[1] - r * 0.62; d = min(d, p[1] - fl, CAVE_L - p[2]); d = max(d, -p[2] * 2); d += 0.45 * (n3(p[0] * 0.55, p[1] * 0.55, p[2] * 0.55) - 0.5) + 0.18 * (n3(p[0] * 1.7, p[1] * 1.7, p[2] * 1.7) - 0.5); return [d, fl]; };
  const C = { in: null, pos: [0, 0, 0], dive: 0 };
  return {
    C, mouths,
    // outside: draw the mouths; are we going in?
    draw(common, cam, G, S) {
      if (S.hc > 3000 || S.under) return;
      gl.useProgram(M.p); common(M); gl.uniform1f(M.uCy, S.cy); gl.bindVertexArray(mv); gl.disable(gl.CULL_FACE);
      for (const m of mouths(G, S)) {
        const D = m.p.map((v, k) => v - S.foot[k]), q = [0, 1, 2].map((r) => D[0] * S.F[r][0] + D[1] * S.F[r][1] + D[2] * S.F[r][2]); if (hypot(q[0], q[2]) > 3500) continue;
        const dn = [0, 1, 2].map((r) => m.down[0] * S.F[r][0] + m.down[1] * S.F[r][1] + m.down[2] * S.F[r][2]), z = [-dn[0], 0, -dn[2]], zl = hypot(z[0], z[2]) || 1, Z = [z[0] / zl, 0, z[2] / zl], X = [Z[2], 0, -Z[0]];
        const c = [q[0] + Z[0] * 0.4, q[1] + (m.h - S.cy) - 0.6, q[2] + Z[2] * 0.4];
        gl.uniform3fv(M.uC, c); gl.uniform3fv(M.uX, X); gl.uniform3fv(M.uZ, Z); gl.uniform1f(M.uS, 4.5); gl.drawArrays(gl.TRIANGLES, 0, disc.length / 3);
      }
      gl.bindVertexArray(null);
    },
    // the camera (planet coords) near a mouth? return it, and where in the cave that puts you
    enter(cam, G, S) {
      for (const m of mouths(G, S)) { const top = m.p.map((v) => v / G.R * (G.R + m.h + 1.5)), d = hypot(cam.P[0] - top[0], cam.P[1] - top[1], cam.P[2] - top[2]); if (d < 3) { C.in = m; C.pos = [0, cen(m.seed, 3)[1] - rad(m.seed, 3) * 0.62 + 1.7, 3]; return true; } }
      return false;
    },
    // inside: move with collisions; keep to the floor when walking; out of the mouth when z < 0
    move(vl, walking, dt, S) {
      const m = C.in, s = m.seed, dn = [0, 1, 2].map((r) => m.down[0] * S.F[r][0] + m.down[1] * S.F[r][1] + m.down[2] * S.F[r][2]), zl = hypot(dn[0], dn[2]) || 1, Z = [-dn[0] / zl, 0, -dn[2] / zl], X = [Z[2], 0, -Z[0]];
      const v = [vl[0] * X[0] + vl[2] * X[2], vl[1], vl[0] * Z[0] + vl[2] * Z[2]], p = C.pos.map((x, i) => x + v[i]);
      let [d] = sdf(s, p); if (d < 0.35 && p[2] > 0.5) { const e = 0.05, g = [0, 1, 2].map((i) => { const a = p.slice(); a[i] += e; return (sdf(s, a)[0] - d) / e; }), gl2 = hypot(...g) || 1; for (let i = 0; i < 3; i++) p[i] += g[i] / gl2 * (0.35 - d); }
      if (walking) { const fl = sdf(s, p)[1]; p[1] += (fl + 1.7 - p[1]) * min(1, dt * 8); }
      C.pos = p; return p[2] < -0.5;
    },
    render(common, cam, G, S, W, Hh) {
      const m = C.in, dn = [0, 1, 2].map((r) => m.down[0] * S.F[r][0] + m.down[1] * S.F[r][1] + m.down[2] * S.F[r][2]), zl = hypot(dn[0], dn[2]) || 1, Z = [-dn[0] / zl, 0, -dn[2] / zl], X = [Z[2], 0, -Z[0]];
      const d = [cos(cam.pitch) * sin(cam.yaw), sin(cam.pitch), cos(cam.pitch) * cos(cam.yaw)], r0 = [-d[2], 0, d[0]], rl = hypot(r0[0], r0[2]) || 1, r = [r0[0] / rl, 0, r0[2] / rl], u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
      const toC = (w) => [w[0] * X[0] + w[2] * X[2], w[1], w[0] * Z[0] + w[2] * Z[2]], t = Math.tan(cam.fov / 2);
      gl.useProgram(P.p); common(P); gl.uniform3fv(P.uR, toC(r)); gl.uniform3fv(P.uU, toC(u)); gl.uniform3fv(P.uF, toC(d)); gl.uniform2f(P.uTan, t * W / Hh, t); gl.uniform3fv(P.uPos, C.pos); gl.uniform4fv(P.uCs, m.seed);
      gl.uniform3fv(P.uDay, (S.sunC || [1, 1, 1]).map((v, i) => v * 0.15 + (S.skyC || [0.2, 0.3, 0.5])[i] * 0.6));
      gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // leaving: stand just outside the mouth, facing out
    exit(G) { const m = C.in; C.in = null; return { P: m.p.map((v, k) => v / G.R * (G.R + m.h + 1.7) + m.down[k] * 5), look: m.down }; },
  };
  void climate; void min;
}
