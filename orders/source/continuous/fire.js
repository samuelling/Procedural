// Fire. Lightning starts it (now and then on its own where the land is dry enough to burn, or when you call it down);
// the wind drives it: the front runs fast downwind, slowly against it and sideways, so a burn is an egg-shaped scar
// that grows by the hour until it has spent itself. Flames ride the front and smoke stands up from it; behind it the
// ground is ash, the trees are black snags, and over the years they fall and the forest grows back from saplings.
// Every point knows when the fire reached it, so trees, ground, litter and the far canopy all agree.
import { AX, H, hs2, climate } from './planet.js';

const { floor, max, min, abs, hypot, sin, cos, sqrt } = Math;
export const FIRE_GLSL = `
uniform vec4 uFa[12], uFb[12]; uniform int uFn; uniform float uFday, uFyr;   // per fire: centre (local) and start day; wind (local x z), speed (m/day), reach (m)
// how long ago the latest fire to pass q reached it (days), or -1 if none has
float burnAge(vec3 q) {
  float tb = -1e9;
  for (int i = 0; i < 12; i++) { if (i >= uFn) break; vec3 r = q - uFa[i].xyz; float a = dot(r.xz, uFb[i].xy), b = dot(r.xz, vec2(-uFb[i].y, uFb[i].x)), d = length(vec2(a > 0. ? a : a / .3, b / .45)), t = uFa[i].w + d / uFb[i].z;
    if (d < uFb[i].w && t <= uFday) tb = max(tb, t); }
  return tb > -1e8 ? uFday - tb : -1.;
}`;
// the same on the page; and the fire events near the camera: natural ones from the planet's lattice, and called-down ones
export function mkFire(gl, prog, PRE) {
  const user = new Map(), memo = new Map(), CELL = 30000;
  function natural(G, S) {
    const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0), out = [], t = G.t || 0;
    const i0 = floor(foot[b] / CELL), j0 = floor(foot[c] / CELL), P = 700;   // each cell can burn every couple of years
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (let k = floor(t / P) - 26; k <= floor(t / P); k++) {
      const key = `${G.id}:${fk}:${i}:${j}:${k}`; let e = memo.get(key);
      if (e === undefined) { e = null; const s = (q) => hs2(i * 131 + k, j * 71 - k, 500 + q + fk * 9);
        if (s(0) < 0.6) { const p = [0, 0, 0]; p[b] = (i + s(1)) * CELL; p[c] = (j + s(2)) * CELL; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c];
          if (d > 0) { p[a] = sg * sqrt(d); const h = H(G, p, 16), cl = climate(G, p, h); if (h > 5 && cl.W > 0.22 && cl.W < 0.72 && cl.T > 3) e = mk(G, p, (k + s(3)) * P, s(4) * 6.283, 600 + 1400 * (0.8 - cl.W), 1500 + 6000 * s(5)); } }
        memo.set(key, e); }
      if (e) out.push(e);
    }
    return out;
  }
  function mk(G, p, t0, ang, v, R) {                                       // an event: where (on the sphere), when, which way the wind blows
    const u = p.map((x) => x / hypot(...p)), e1 = [u[1], -u[0], 0].map((x) => x / (hypot(u[0], u[1]) || 1)), e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
    return { c: u.map((x) => x * G.R), t0, wind: e1.map((x, i) => x * cos(ang) + e2[i] * sin(ang)), v, R };
  }
  const near = (G, S) => { const t = G.t || 0, Y = G.yearD * 60;
    return [...(user.get(G.id) || []), ...natural(G, S)].filter((e) => e.t0 < t + 1 && t - e.t0 < Y && hypot(e.c[0] - S.foot[0], e.c[1] - S.foot[1], e.c[2] - S.foot[2]) < e.R * 1.4 + 15000)
      .map((e) => ({ e, k: (e.user ? -1e9 : 0) + (t - e.t0) + hypot(e.c[0] - S.foot[0], e.c[1] - S.foot[1], e.c[2] - S.foot[2]) / 30 })).sort((a, b) => a.k - b.k).slice(0, 12).map((o) => o.e); };
  const loc = (S, v) => [0, 1, 2].map((r) => v[0] * S.F[r][0] + v[1] * S.F[r][1] + v[2] * S.F[r][2]);
  // smoke: soft columns rising from the burning front, leaning downwind, lit by the sun and by the fire under them
  const smoke = prog(PRE + `
layout(location = 0) in vec2 aC; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform vec3 uRt, uUp; out vec2 vC; out vec3 vP; out float vW, vA, vG;
void main() { vP = iP.xyz + (uRt * aC.x + uUp * aC.y) * iP.w; vC = aC; vA = iS.x * smoothstep(iP.w * .5, iP.w * 3., length(iP.xyz)); vG = iS.y; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + `
in vec2 vC; in vec3 vP; in float vW, vA, vG; uniform float uCy; layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { float r = length(vC), a = smoothstep(1., .2, r) * (.55 + .45 * n2(vC * 2.5 + vA * 9. + uT * .1)) * vA; if (a < .01) discard;
  vec3 col = vec3(.16, .15, .14) * (uSunC * (.4 + .6 * max(uSun.y, 0.)) + uSky * .9) + vec3(2., .7, .15) * vG;
  col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, a); gl_FragDepth = fdep(vW); }`);
  const quad = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(quad); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ib); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } gl.bindVertexArray(null);
  let cur = [];
  const api = {
    // this frame's fires, as uniforms every shader can read
    update(G, S) { cur = near(G, S); S.fires = cur; S.fireAge = cur.length ? (p) => api.age(G, p) : null; },
    set(P, G, S) {
      if (!P.uFa) return; const A = new Float32Array(48), B = new Float32Array(48);
      cur.forEach((e, i) => { const q = loc(S, e.c.map((v, k) => v - S.foot[k])), w = loc(S, e.wind), wl = hypot(w[0], w[2]) || 1; A.set([q[0], q[1], q[2], e.t0], i * 4); B.set([w[0] / wl, w[2] / wl, e.v, e.R], i * 4); });
      gl.uniform4fv(P.uFa, A); gl.uniform4fv(P.uFb, B); gl.uniform1i(P.uFn, cur.length); gl.uniform1f(P.uFday, G.t || 0); gl.uniform1f(P.uFyr, G.yearD);
    },
    // how long ago the fire reached a point (planet metres), or -1
    age(G, p) {
      const t = G.t || 0; let tb = -1e9; for (const e of cur) { const r = p.map((v, k) => v - e.c[k]), a = r[0] * e.wind[0] + r[1] * e.wind[1] + r[2] * e.wind[2], rr = hypot(...r), b = sqrt(max(0, rr * rr - a * a)), d = hypot(a > 0 ? a : a / 0.3, b / 0.45), ta = e.t0 + d / e.v; if (d < e.R && ta <= t) tb = max(tb, ta); }
      return tb > -1e8 ? t - tb : -1;
    },
    // call lightning down at a point
    strike(G, p) { const list = user.get(G.id) || []; const e = mk(G, p, (G.t || 0) + 0.002, Math.random() * 6.283, 1500, 2500 + Math.random() * 3000); e.user = 1; list.unshift(e); user.set(G.id, list.slice(0, 6)); },
    draw(common, cam, G, S) {
      let burning = 0; S.fireD = 1e12; const t = G.t || 0, out = [], d0 = [cos(cam.pitch) * sin(cam.yaw), 0, cos(cam.pitch) * cos(cam.yaw)], rl = hypot(d0[0], d0[2]) || 1, rt = [-d0[2] / rl, 0, d0[0] / rl];
      for (const e of cur) {
        const age = t - e.t0; if (age < 0 || age * e.v > e.R * 3.4) continue;
        const C = loc(S, e.c.map((v, k) => v - S.foot[k])), w = loc(S, e.wind), wl = hypot(w[0], w[2]) || 1, wx = w[0] / wl, wz = w[2] / wl;
        for (let k = 0; k < 28; k++) {                                     // points on the front, all round
          const ph = k / 28 * 6.2832, ca = cos(ph), sa = sin(ph), m = hypot(ca > 0 ? ca : ca / 0.3, sa / 0.45), r = age * e.v / m; if (r * m > e.R) continue;
          const x = C[0] + (wx * ca - wz * sa) * r, z = C[2] + (wz * ca + wx * sa) * r, pp = S.foot.map((v, i) => v + S.F[0][i] * x + S.F[2][i] * z), h = H(G, pp, 14);
          if (h < 1 || climate(G, pp, h).W < 0.15) continue;                 // nothing to burn: water, desert
          const base = -(x * x + z * z) / (2 * G.R) + h - S.cy; burning++; S.fireD = min(S.fireD, hypot(x, base, z));
          for (let j = 0; j < 9; j++) { const hgt = j * j * 22, s = 25 + j * 30, dr = j * j * 9;   // a column that rises and leans downwind
            out.push(x + wx * dr, base + hgt + s * 0.5, z + wz * dr, s, 0.32 * (1 - j / 10), j < 1 ? 0.6 : 0, 0, 0); }
        }
      }
      S.burning = burning; if (!out.length) return;
      gl.useProgram(smoke.p); common(smoke); gl.uniform3fv(smoke.uRt, rt); gl.uniform3f(smoke.uUp, 0, 1, 0); gl.uniform1f(smoke.uCy, S.cy);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW); gl.bindVertexArray(quad); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, out.length / 8);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); gl.bindVertexArray(null);
    },
  };
  return api;
}
