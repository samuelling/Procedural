// Flocks: birds (or whatever flies there) wheeling over the land, each flock tied to a point on the planet (a 3 km
// lattice on the cube face) so it is always there when you come back. Their build follows the planet's pull: under
// weak gravity long wings beat slowly; under strong, short wings beat fast. Drawn as small flapping shapes, lit and
// hazed like everything else.
import { AX, H, hs2, climate } from './planet.js';

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
  return {
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
