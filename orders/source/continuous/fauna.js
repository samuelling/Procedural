// Flocks: birds (or whatever flies there) wheeling over the land, each flock tied to a point on the planet (a 3 km
// lattice on the cube face) so it is always there when you come back. Their build follows the planet's pull: under
// weak gravity long wings beat slowly; under strong, short wings beat fast. Drawn as small flapping shapes, lit and
// hazed like everything else.
import { AX, H, hs2, climate, forestF, cityRho, citySuit, river, rng } from './planet.js';

export function mkFauna(gl, prog, PRE) {
  const { floor, max, min, abs, hypot, sin, cos, sqrt } = Math, SP = 3000, NB = 28;
  const bird = prog(PRE + `
layout(location = 0) in vec3 aP; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform float uSpan, uBeat, uCy;
out vec3 vP; out float vW, vSh;
void main() {
  float ph = uT * uBeat + iS.z * 6.28, fl = sin(ph), side = sign(aP.x), w = abs(aP.x);   // a wing beat
  vec3 p = vec3(aP.x * uSpan, w * fl * uSpan * .6 + aP.y * uSpan, aP.z * uSpan);
  float c = cos(iS.y), s = sin(iS.y); vec3 r = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vP = iP.xyz + r; vSh = .6 + .4 * fl * side * 0.; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w);
}`, PRE + `
in vec3 vP; in float vW, vSh; uniform vec3 uCol; uniform float uCy;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { CAST vec3 col = uCol * (uSunC * .5 * max(uSun.y, 0.) + uSky * .5); col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`);
  // a bird: body and two wings (x across, y up, z ahead), as triangles
  const g = new Float32Array([0, 0, 0.5, -0.06, 0, -0.4, 0.06, 0, -0.4, 0, 0, 0.15, -1, 0.05, -0.05, 0, 0, -0.2, 0, 0, 0.15, 1, 0.05, -0.05, 0, 0, -0.2, -1, 0.05, -0.05, -0.55, 0, 0.12, 0, 0, 0.15, 1, 0.05, -0.05, 0, 0, 0.15, 0.55, 0, 0.12]);
  const vao = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, g, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ib); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } gl.bindVertexArray(null);
  const memo = new Map();
  // ---- grazers: a body plan per planet (legs four or six, long-legged under weak pull, squat under strong), herds on a
  // 1 km lattice in open grassy country, each animal ambling and grazing round its herd's ground ------------------------
  const beast = prog(PRE + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in vec4 aL; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform float uCy; out vec3 vP, vN, vO; out float vW, vSd;
void main() {
  vec3 p = aP, n = aN;
  if (aL.x > 0.) { float a = sin(iS.z + aL.w) * .55 * iS.y; float c = cos(a), s = sin(a); vec2 r = vec2(p.y - aL.y, p.z - aL.z); p.yz = vec2(c * r.x - s * r.y, s * r.x + c * r.y) + aL.yz; n.yz = vec2(c * n.y - s * n.z, s * n.y + c * n.z); }   // a leg swings from its hip
  if (aL.x < 0.) { float a = (1. - iS.y) * .6 * (.5 + .5 * sin(iS.z * .2)); float c = cos(a), s = sin(a); vec2 r = vec2(p.y - aL.y, p.z - aL.z); p.yz = vec2(c * r.x + s * r.y, -s * r.x + c * r.y) + aL.yz; }   // the head goes down to graze
  p *= iP.w; float ch = cos(iS.x), sh = sin(iS.x); vO = aP; vSd = iS.w;
  vP = iP.xyz + vec3(ch * p.x + sh * p.z, p.y, -sh * p.x + ch * p.z); vN = vec3(ch * n.x + sh * n.z, n.y, -sh * n.x + ch * n.z);
  vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w);
}`, PRE + `
in vec3 vP, vN, vO; in float vW, vSd; uniform vec3 uCol, uCol2; uniform float uCy, uSpots;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { CAST
  vec3 n = normalize(vN); float belly = smoothstep(.1, -.4, vN.y);
  vec3 alb = mix(uCol, uCol2, belly) * (.9 + .2 * fract(vSd * 7.7));
  float sp = n2(vO.xz * 9. + vO.y * 5. + vSd * 30.); alb = mix(alb, uCol2 * .5, uSpots * smoothstep(.62, .68, sp));
  float fp = vW * uPix; alb *= mix(1., .85 + .3 * n2(vO.xy * 900. + vO.z * 500.), smoothstep(.003, .0008, fp));   // hair
  float dif = max(dot(n, uSun), 0.) * shadow(vP + n * .05);
  vec3 col = alb * (uSunC * dif + uSky * (.45 + .3 * n.y)); col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y);
  oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`);
  const bodies = new Map();
  function bodyPlan(G) {
    if (bodies.has(G.n)) return bodies.get(G.n);
    const r = rng(G.n * 313 + 5), legs = G.n === 0 ? 4 : r() < 0.35 ? 6 : 4, L = (0.55 + 0.5 * r()) * G.g ** -0.5, len = 1 + 0.8 * r(), ht = L, neck = 0.3 + 0.7 * r();
    const V = [], blob = (c, rx, ry, rz, tag) => {                         // an ellipsoid of 12 x 8 quads
      for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) {
        const th = (i + a) / 12 * 6.2832, ph = (j + b) / 8 * 3.1416, n = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
        V.push(c[0] + n[0] * rx, c[1] + n[1] * ry, c[2] + n[2] * rz, n[0] / rx, n[1] / ry, n[2] / rz, ...tag);
      }
    };
    blob([0, ht + 0.25, 0], 0.28, 0.3, len * 0.5, [0, 0, 0, 0]);                                // body
    const nb = [0, ht + 0.35 + neck * 0.5, len * 0.5 + neck * 0.2], hd = [0, ht + 0.3 + neck, len * 0.5 + neck * 0.35 + 0.15];
    blob(nb, 0.1, neck * 0.55, 0.12, [-1, ht + 0.3, len * 0.45, 0]); blob(hd, 0.1, 0.11, 0.22, [-1, ht + 0.3, len * 0.45, 0]);   // neck and head (they bow together)
    for (let k = 0; k < legs; k++) { const side = k % 2 ? 1 : -1, z = (Math.floor(k / 2) / (legs / 2 - 1) - 0.5) * len * 0.75, hip = ht + 0.15;
      blob([side * 0.16, hip * 0.5, z], 0.05, hip * 0.5, 0.06, [1 + k, hip, z, (k % 2) * 3.1416 + Math.floor(k / 2) * (legs === 6 ? 2.1 : 3.1416)]); }
    blob([0, ht + 0.3, -len * 0.5 - 0.1], 0.04, 0.04, 0.2, [0, 0, 0, 0]);                       // tail
    const vao = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, ib); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } gl.bindVertexArray(null);
    const hue = G.n === 0 ? [0.32, 0.2, 0.1] : G.soil.map((v) => Math.min(1, v * (1.2 + r()) + 0.05)), b = { vao, ib, n: V.length / 10, col: hue, col2: hue.map((v) => Math.min(1, v * 1.8 + 0.15)), spots: r() < 0.5 ? 1 : 0, scale: 0.8 + 0.6 * r() };
    bodies.set(G.n, b); return b;
  }
  const herds = new Map(), HS = 1000;
  function herdsNear(G, S) {
    const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0), out = [];
    const i0 = floor(foot[b] / HS), j0 = floor(foot[c] / HS);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const key = `${G.n}:${fk}:${i}:${j}`; let f = herds.get(key);
      if (f === undefined) {
        f = null; if (hs2(i, j, 170 + fk) < 0.8) { const p = [0, 0, 0]; p[b] = (i + 0.2 + 0.6 * hs2(i, j, 171 + fk)) * HS; p[c] = (j + 0.2 + 0.6 * hs2(i, j, 172 + fk)) * HS; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c];
          if (d > 0) { p[a] = sg * sqrt(d); const h = H(G, p, 20), cl = climate(G, p, h); if (h > 2 && cl.T > -3 && cl.W > 0.22 && forestF(G, p, h, cl.T, cl.W) < 0.6 && cityRho(G, p) * citySuit(h, cl.T, cl.W, 0) < 0.05 && river(G, p, h, cl.W) < 0.1) f = { p, n: 5 + floor(hs2(i, j, 173 + fk) * 12), sd: hs2(i, j, 174 + fk) }; } }
        herds.set(key, f);
      }
      if (f) out.push(f);
    }
    return out;
  }
  return {
    beasts(common, cam, G, S) {
      if (S.hc > 1500 || S.sun[1] < -0.1) return;
      const B = bodyPlan(G), F = S.F, foot = S.foot, t = performance.now() / 1000, out = [];
      for (const f of herdsNear(G, S)) {
        const D0 = f.p.map((v, k) => v - foot[k]); if (hypot(...D0) > 1600) continue;
        const ea = [0, 1, 2].map((k) => F[0][k]), eb = [0, 1, 2].map((k) => F[2][k]);   // local east and north, in planet axes
        for (let k = 0; k < f.n; k++) {                                   // each animal ambles round its own spot in the herd
          const ph = f.sd * 50 + k * 2.39, ox = cos(ph) * (8 + k * 4) + sin(t * 0.03 + k) * 14, oz = sin(ph) * (8 + k * 4) + cos(t * 0.025 + k * 1.7) * 14;
          const vx = cos(t * 0.03 + k) * 0.42, vz = -sin(t * 0.025 + k * 1.7) * 0.35, walk = min(1, max(0, Math.sin(t * 0.11 + k * 3.1) * 1.5 + 0.2));
          const P = [0, 1, 2].map((q) => f.p[q] + ea[q] * ox + eb[q] * oz), l = hypot(...P), pg = P.map((v) => v / l * G.R), h = H(G, pg, 20);
          const D = pg.map((v, q) => v - foot[q]), qq = [0, 1, 2].map((r) => D[0] * F[r][0] + D[1] * F[r][1] + D[2] * F[r][2]);
          const pos = [qq[0], qq[1] + (h - S.cy) + qq[1] * h / G.R, qq[2]];
          out.push(pos[0], pos[1], pos[2], B.scale * (0.85 + 0.3 * Math.sin(k * 5.3)), Math.atan2(vx, vz), walk, t * 5 * G.g ** 0.5, k * 0.37 + f.sd);
        }
      }
      if (!out.length) return;
      gl.useProgram(beast.p); common(beast); gl.uniform1f(beast.uCy, S.cy); gl.uniform3fv(beast.uCol, B.col); gl.uniform3fv(beast.uCol2, B.col2); gl.uniform1f(beast.uSpots, B.spots);
      gl.bindBuffer(gl.ARRAY_BUFFER, B.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(B.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, B.n, out.length / 8); gl.bindVertexArray(null);
      S.nBeasts = out.length / 8; S.beast = out.slice(0, 3);
    },
    draw(common, cam, G, S) {
      if (S.hc > 3000) return;
      const foot = S.foot, F = S.F, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0);
      const out = [], t = performance.now() / 1000, i0 = floor(foot[b] / SP), j0 = floor(foot[c] / SP);
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
        const key = `${G.n}:${fk}:${i}:${j}`; let f = memo.get(key);
        if (f === undefined) {
          f = null; if (hs2(i, j, 150 + fk) < 0.7) { const p = [0, 0, 0]; p[b] = (i + hs2(i, j, 151 + fk)) * SP; p[c] = (j + hs2(i, j, 152 + fk)) * SP; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c]; if (d > 0) { p[a] = sg * sqrt(d); const h = H(G, p, 16), cl = climate(G, p, h); if (h > 0 && cl.T > -8) f = { p, h, n: 6 + floor(hs2(i, j, 153 + fk) * NB), r: 60 + 200 * hs2(i, j, 154 + fk), alt: 40 + 160 * hs2(i, j, 155 + fk), sd: hs2(i, j, 156 + fk) }; } }
          memo.set(key, f);
        }
        if (!f) continue;
        const D = f.p.map((v, k) => v - foot[k]), q = [0, 1, 2].map((k) => D[0] * F[k][0] + D[1] * F[k][1] + D[2] * F[k][2]); if (hypot(q[0], q[2]) > 4000) continue;
        const base = [q[0], q[1] + (f.h + f.alt - S.cy) + q[1] * f.h / G.R, q[2]];
        for (let k = 0; k < f.n; k++) {                                   // each bird: the flock's circle, its own place in it, a little weave
          const w = t * (0.25 + 0.1 * f.sd) / G.g ** -0.3 + k * 0.21, rr = f.r * (0.8 + 0.4 * sin(k * 7.1)), o = [cos(w) * rr + sin(k * 3.3 + t * 0.7) * 6, sin(k * 1.7 + t * 0.9) * 8 + k * 0.7, sin(w) * rr + cos(k * 2.1 + t * 0.6) * 6];
          out.push(base[0] + o[0], base[1] + o[1], base[2] + o[2], 1, 1, -w, k * 0.37 + f.sd, 0);
        }
      }
      if (!out.length) return;
      gl.useProgram(bird.p); common(bird); const span = 0.45 * G.g ** -0.5; gl.uniform1f(bird.uSpan, span); gl.uniform1f(bird.uBeat, 9 * G.g ** 0.6); gl.uniform1f(bird.uCy, S.cy);
      gl.uniform3fv(bird.uCol, G.soil.map((v) => v * 0.6 + 0.02));
      gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, g.length / 3, out.length / 8); gl.bindVertexArray(null);
    },
  };
}
