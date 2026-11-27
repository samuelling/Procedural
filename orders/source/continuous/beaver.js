// Beavers. On small rivers in cool wet woods, a family dams the stream: a bank of sticks across the valley, the water
// backing up behind it into a pond that drowns the trees it reaches (they stand on as grey snags), a lodge of sticks
// out in the pond, and the beavers themselves, swimming. A pond lasts a dozen years; then the beavers leave, the dam
// fails, the pond drains to a wet meadow, and in time the woods come back, until beavers come again.
import { AX, H, H0, hs2, climate, river, forestF, rng } from './planet.js';

const { floor, max, min, abs, hypot, sqrt, sin, cos } = Math;
export const POND_GLSL = `
uniform vec4 uBv[8], uBw[8]; uniform int uBn;   // per pond: centre (local x z), water level, dam crest; downstream (local x z), reach, how whole the dam is
// the pond's water level at q (or well below the ground if none), and how much dam or lodge stands on the ground here
vec2 pond(vec3 q, inout float h) {
  float pw = h - 50., h0 = h;
  for (int i = 0; i < 8; i++) { if (i >= uBn) break;
    vec2 r = q.xz - uBv[i].xy; float R = uBw[i].z, d = length(r); if (d > R * 1.3) continue;
    vec2 dn = uBw[i].xy, sd = vec2(-dn.y, dn.x); float al = dot(r, dn), ac = dot(r, sd), L = uBv[i].z, crest = uBv[i].w, full = uBw[i].w;
    float dm = smoothstep(3.5, 1.2, abs(al)) * smoothstep(R * .4, R * .3, abs(ac)) * (.35 + .65 * full);   // the dam
    if (dm > 0. && h < crest + .3) h = max(h, mix(h, crest + .3 - .25 * (1. - full) * smoothstep(3., 0., abs(ac)) * 2., dm));
    float lb = length(r + dn * R * .32 - sd * R * .1);                     // the lodge
    if (lb < 5. && full > .5) h = max(h, L + 1.7 * sqrt(1. - lb * lb / 25.) - .2);
    if (al < 1.5) pw = max(pw, L - smoothstep(.55 * R, R, d) * 5. - smoothstep(-1., 1.5, al) * 3.);
  }
  return vec2(pw, h - h0);
}`;
const CELL = 2500, R = 140;
  // a cell's pond, if it has one: the first stretch of small river, in the right woods, on a gentle slope
export function find(G, a, sg, fk, i, j) {
  if (hs2(i, j, 610 + fk) > 0.55) return null; const [b, c] = AX[a];
  for (let k = 0; k < 49; k++) {
    const p = [0, 0, 0]; p[b] = (i + 0.08 + 0.84 * ((k % 7) + hs2(i, j, 611 + k)) / 7) * CELL; p[c] = (j + 0.08 + 0.84 * (floor(k / 7) + hs2(i, j, 660 + k)) / 7) * CELL;
    const d = G.R * G.R - p[b] * p[b] - p[c] * p[c]; if (d <= 0) return null; p[a] = sg * sqrt(d);
    const h0 = H0(G, p, 22); if (h0 < 4 || h0 > 1500) continue; const cl = climate(G, p, h0);
    if (cl.T < -6 || cl.T > 19 || cl.W < 0.45 || forestF(G, p, h0, cl.T, cl.W) < 0.3 || river(G, p, h0, cl.W) < 0.55) continue;
    const u = p.map((v) => v / G.R), e1 = [u[1], -u[0], 0].map((v) => v / (hypot(u[0], u[1]) || 1)), e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
    const at = (e, s) => H0(G, p.map((v, q) => v + e[q] * s), 22), gx = at(e1, 60) - at(e1, -60), gy = at(e2, 60) - at(e2, -60), gl2 = hypot(gx, gy); if (gl2 / 120 > 0.08) continue;   // too steep for a pond
    const dn = e1.map((v, q) => -(v * gx + e2[q] * gy) / (gl2 || 1));
    return { p, dn, crest: h0 + 1.6, floor: H(G, p, 26) - 0.5, ph: hs2(i, j, 700 + fk), sd: hs2(i, j, 701 + fk) };
  }
  return null;
}
export function mkBeavers(gl, prog, PRE) {
  const memo = new Map();
  function near(G, S) {
    const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0), out = [];
    if (G.fauna && G.fauna.none || G.E >= 40 || G.lifeless) return out;                // beavers (or what stands for them) are a late thing
    const i0 = floor(foot[b] / CELL), j0 = floor(foot[c] / CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const key = `${G.id}@${G.E || 0}:${fk}:${i}:${j}`; let f = memo.get(key); if (f === undefined) { f = find(G, a, sg, fk, i, j); memo.set(key, f); }
      if (f) out.push(f);
    }
    return out;
  }
  // a pond's life: built, full for a dozen years, then the dam fails and the pond drains; again every thirty years
  const phase = (G, f) => { const P = G.yearD * 30, a = (((G.t || 0) + f.ph * P) % P + P) % P / G.yearD, fill = min(1, a / 0.3) * (1 - min(1, max(0, (a - 12) / 0.5))); return { yr: a, fill }; };
  const loc = (S, v) => [0, 1, 2].map((r) => v[0] * S.F[r][0] + v[1] * S.F[r][1] + v[2] * S.F[r][2]);
  // a beaver: body, head, broad flat tail
  const V = []; const blob = (c, rx, ry, rz) => { for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { const th = (i + x) / 10 * 6.2832, ph = (j + y) / 6 * 3.1416, n = [sin(ph) * cos(th), cos(ph), sin(ph) * sin(th)]; V.push(c[0] + n[0] * rx, c[1] + n[1] * ry, c[2] + n[2] * rz, n[0] / rx, n[1] / ry, n[2] / rz); } };
  blob([0, 0, 0], 0.17, 0.13, 0.36); blob([0, 0.05, 0.36], 0.09, 0.08, 0.12); blob([0, -0.02, -0.46], 0.09, 0.015, 0.17);
  const bp = prog(PRE + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 4) in vec4 iP;
out vec3 vP, vN; out float vW;
void main() { float c = cos(iP.w), s = sin(iP.w); vP = vec3(c * aP.x + s * aP.z, aP.y, -s * aP.x + c * aP.z) + iP.xyz; vN = vec3(c * aN.x + s * aN.z, aN.y, -s * aN.x + c * aN.z); vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + `
in vec3 vP, vN; in float vW; uniform float uCy; layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { CAST vec3 n = normalize(vN); vec3 alb = vec3(.09, .05, .03) * (.85 + .3 * n2(vP.xz * 40.)); float dif = max(dot(n, uSun), 0.) * shadow(vP);
  vec3 col = alb * (uSunC * dif + uSky * (.4 + .3 * n.y)) + uSunC * pow(max(dot(reflect(normalize(vP), n), uSun), 0.), 30.) * .15;   // wet fur
  col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`);
  const vao = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(4, 1); gl.bindVertexArray(null);
  let cur = [];
  const api = {
    update(G, S) {
      cur = near(G, S).map((f) => ({ f, ...phase(G, f), d: hypot(f.p[0] - S.foot[0], f.p[1] - S.foot[1], f.p[2] - S.foot[2]) })).sort((x, y) => x.d - y.d).slice(0, 8);
      for (const o of cur) { o.L = o.f.floor + (o.f.crest - 0.1 - o.f.floor) * o.fill; o.c = loc(S, o.f.p.map((v, k) => v - S.foot[k])); const w = loc(S, o.f.dn), wl = hypot(w[0], w[2]) || 1; o.w = [w[0] / wl, w[2] / wl]; }
      S.ponds = cur; S.pondAt = cur.length ? api.at : null; S.pondTop = cur.length ? api.top : null;
      const act = cur.filter((o) => o.yr < 12); S.pondD = act.length ? act[0].d : 1e12;
    },
    set(P) {
      if (!P.uBv) return; const A = new Float32Array(32), B = new Float32Array(32);
      cur.forEach((o, i) => { A.set([o.c[0], o.c[2], o.L, o.f.crest], i * 4); B.set([o.w[0], o.w[1], R, o.yr < 12.5 ? 1 : max(0, 1 - (o.yr - 12.5) / 4)], i * 4); });
      gl.uniform4fv(P.uBv, A); gl.uniform4fv(P.uBw, B); gl.uniform1i(P.uBn, cur.length);
    },
    // what a pond has done to a tree standing at p (planet metres, ground height h): 0 nothing, 1 drowned (a snag),
    // -1 gone (fallen, or not yet grown back), or a fraction: grown back that far
    at(p, h) {
      for (const o of cur) { const r = p.map((v, k) => v - o.f.p[k]), d = hypot(...r); if (d > R) continue; const al = r[0] * o.f.dn[0] + r[1] * o.f.dn[1] + r[2] * o.f.dn[2];
        if (al > 1.5 || h > o.f.crest - 0.15 - (d > 0.55 * R ? (d - 0.55 * R) / (0.45 * R) * 5 : 0)) continue;
        if (o.yr < 0.2) return 0; if (o.yr < 16) return 1; if (o.yr < 18) return -1; return min(1, (o.yr - 18) / 12); }
      return 0;
    },
    // the surface at p: the pond's water, or the top of its dam (or -1e9)
    top(p, h) {
      let best = -1e9; for (const o of cur) { const r = p.map((v, k) => v - o.f.p[k]), d = hypot(...r); if (d > R * 1.3) continue; const al = r[0] * o.f.dn[0] + r[1] * o.f.dn[1] + r[2] * o.f.dn[2], ac = sqrt(max(0, d * d - al * al));
        if (abs(al) < 2.2 && ac < R * 0.35) best = max(best, o.f.crest + 0.3 - (o.yr < 12.5 ? 0 : 0.5));
        if (al < 1.5 && d < 0.55 * R) best = max(best, o.L); }
      return best;
    },
    draw(common, G, S) {
      const out = [], t = performance.now() / 1000;
      for (const o of cur) { if (o.yr > 12 || o.d > 1500) continue;
        const sd = o.f.sd, n = 2 + floor(sd * 3), lc = [o.c[0] - o.w[0] * R * 0.32 - o.w[1] * R * 0.1, o.c[2] - o.w[1] * R * 0.32 + o.w[0] * R * 0.1];
        for (let k = 0; k < n; k++) { const sp = 0.012 + 0.006 * k, a = t * sp * (k % 2 ? 1 : -1) * 3 + k * 2.1 + sd * 9, rr = 9 + 9 * k + 3 * sin(t * 0.05 + k), x = lc[0] + cos(a) * rr, z = lc[1] + sin(a) * rr;
          out.push(x, -(x * x + z * z) / (2 * G.R) + o.L - S.cy - 0.06, z, -a + (k % 2 ? 0 : 3.1416)); }
      }
      if (!out.length) return;
      gl.useProgram(bp.p); common(bp); gl.uniform1f(bp.uCy, S.cy); gl.disable(gl.CULL_FACE);
      gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW); gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, V.length / 6, out.length / 4); gl.bindVertexArray(null);
      void rng;
    },
  };
  return api;
}
