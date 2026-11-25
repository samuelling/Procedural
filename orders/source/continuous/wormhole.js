// Wormholes: each planet has three mouths, spheres of bent space hovering over the ground, each joined to a mouth on
// another planet. The links form a ring of the planets with chords across it, so every world is a few jumps from
// every other. Seen from outside, a mouth bends the scene behind it into a ring and shows, inside, the sky and land of
// the world it leads to (that world's own air, star and plants). From orbit each is a pinprick of its far star's light.
// Go into one (scroll toward it, or fly in) and you come out of its twin, on the other planet, still moving.
import { H, rng, climate } from './planet.js';

const { hypot, min, max, floor, cos, sin, sqrt, tan, acos, abs } = Math;
const nrm = (v) => { const l = hypot(...v) || 1; return v.map((q) => q / l); };
export const RW = 90;                                                      // a mouth's radius, metres

export function mkHoles(gl, prog, PRE, world, NP) {
  // the links: planet n to n+1 (a ring), and n to n+3 for the first half (chords)
  const links = []; for (let n = 0; n < NP; n++) links.push([n, (n + 1) % NP]); for (let n = 0; n < NP / 2; n++) links.push([n, n + NP / 2]);
  const mouths = (n) => {                                                  // planet n's mouths: where, and where each leads
    const G = world(n); if (G.mouths) return G.mouths;
    G.mouths = links.map(([a, b], e) => (a === n || b === n) ? { to: a === n ? b : a, e } : null).filter(Boolean).map((m) => {
      const r = rng(n * 131 + m.e * 17 + 7), sd = G.sunDir, z = sd[2] * 0.7 + (r() - 0.5) * 0.6, a = Math.atan2(sd[1], sd[0]) + (r() - 0.5) * 2.2, s = sqrt(max(0, 1 - z * z)), u = [s * cos(a), s * sin(a), z];
      // pull it toward a landing-like spot: on land, the star up; a few tries
      let best = u, bs = -1e9; for (let t = 0; t < 160; t++) { const z2 = z + (r() - 0.5) * 0.9, a2 = a + (r() - 0.5) * 1.2, s2 = sqrt(max(0, 1 - z2 * z2)), v = [s2 * cos(a2), s2 * sin(a2), z2], p = v.map((x) => x * G.R), h = H(G, p, 14); const sd = v[0] * G.sunDir[0] + v[1] * G.sunDir[1] + v[2] * G.sunDir[2]; if (h < 30 || sd < 0.45) continue; const c = climate(G, p, h), sc = sd * 1.5 - abs(c.W - 0.68) * 3 - (c.T < -3 ? 2 : 0) - (h > 2200 ? 1 : 0); if (sc > bs) { bs = sc; best = v; } }
      const g = max(H(G, best.map((x) => x * G.R), 22), 0); m.u = best; m.C = best.map((x) => x * (G.R + g + RW * 1.6)); return m;
    });
    return G.mouths;
  };
  const twin = (from, to, e) => mouths(to).find((m) => m.e === e);
  let shown = [];                                                          // this frame's mouths on screen, for the post pass
  const fmt = (m) => m >= 1000 ? (m / 1000).toFixed(m >= 1e5 ? 0 : 1) + ' km' : m.toFixed(0) + ' m';
  return {
    links, mouths,
    // has the camera gone in? then out of the twin
    step(cam, G, S, dt, jump) {
      for (const m of mouths(G.n)) { const d = hypot(cam.P[0] - m.C[0], cam.P[1] - m.C[1], cam.P[2] - m.C[2]); if (d < RW * 0.9) { const t = twin(G.n, m.to, m.e); jump(m.to, t.u, RW * 2.6); return true; } }
      return false;
    },
    // a ray (camera-local) against the mouths: the distance to the nearest one it meets, for zooming toward it
    hit(cam, G, S, r) {
      let best = null; for (const m of mouths(G.n)) { const v = [0, 1, 2].map((i) => S.F[i][0] * (m.C[0] - cam.P[0]) + S.F[i][1] * (m.C[1] - cam.P[1]) + S.F[i][2] * (m.C[2] - cam.P[2])), b = v[0] * r[0] + v[1] * r[1] + v[2] * r[2], c = v[0] * v[0] + v[1] * v[1] + v[2] * v[2] - RW * RW, d = b * b - c; if (d > 0 && b > 0) { const t = b - sqrt(d); if (t > 0 && (best === null || t < best)) best = t * 0.999 + RW * 0.3; } }
      return best;
    },
    nearest(cam, G) {
      let best = null; for (const m of mouths(G.n)) { const d = hypot(cam.P[0] - m.C[0], cam.P[1] - m.C[1], cam.P[2] - m.C[2]); if (!best || d < best.d) best = { d, to: m.to }; }
      return best ? `wormhole to ${world(best.to).name} ${fmt(best.d)}` : '';
    },
    // find the mouths on screen this frame
    draw(common, cam, G, S, FB, VP, W, Hh) {
      shown = [];
      for (const m of mouths(G.n)) {
        const v = [0, 1, 2].map((i) => S.F[i][0] * (m.C[0] - cam.P[0]) + S.F[i][1] * (m.C[1] - cam.P[1]) + S.F[i][2] * (m.C[2] - cam.P[2])), d = hypot(...v);
        const c = [0, 1, 2, 3].map((r) => VP[r] * v[0] + VP[4 + r] * v[1] + VP[8 + r] * v[2] + VP[12 + r]); if (c[3] <= 0) continue;
        const sx = (c[0] / c[3]) * 0.5 + 0.5, sy = (c[1] / c[3]) * 0.5 + 0.5, rad = RW / d / tan(cam.fov / 2) * 0.5;   // centre, and radius as a fraction of the screen's height
        if (sx < -1 || sx > 2 || sy < -1 || sy > 2) continue;
        const up = [0, 1, 2].map((i) => S.F[i][0] * m.u[0] + S.F[i][1] * m.u[1] + S.F[i][2] * m.u[2]);
        // behind the planet? (from far off the ground hides it)
        const cpos = [0, S.cy + G.R, 0], cc = [v[0], v[1] + cpos[1], v[2]], dd = nrm(v), b = cpos[0] * dd[0] + cpos[1] * dd[1] + cpos[2] * dd[2], disc = b * b - (cpos[1] * cpos[1] - G.R * G.R);
        if (disc > 0 && -b - sqrt(disc) > 0 && -b - sqrt(disc) < d - RW) continue; void cc;
        shown.push({ sx, sy, rad, d, to: world(m.to), up });
      }
      shown.sort((a, b) => a.d - b.d); shown = shown.slice(0, 3);
    },
    // the post pass: lensing round each mouth, and the far world inside it
    POST: `
#define RWM ${RW}.
uniform vec4 uHc[3]; uniform vec3 uHb[3], uHs[3], uHg[3], uHl[3]; uniform int uNh; uniform float uAsp; uniform sampler2D uD;
vec3 farWorld(vec3 rd, vec3 beta, vec3 sun, vec3 grass, vec3 liq) {   // the world beyond, as a sky over a horizon
  float bm = max(beta.x, max(beta.y, beta.z)); vec3 sc = beta / bm, sd = normalize(vec3(.3, .45, .8));
  float y = rd.y, mu = dot(rd, sd); vec3 sky = sun * (sc * (.35 + .25 * (1. - max(y, 0.))) + pow(max(mu, 0.), 600.) * 30. + pow(max(mu, 0.), 8.) * .2) * .5;
  vec3 gr = mix(grass, liq * 3., step(.5, fract(sin(floor(rd.x * 6.) * 91.3 + floor(rd.z * 6.) * 13.1) * 437.5))) * sun * .35 * (.5 + .5 * max(sd.y, 0.));
  vec3 hz = sun * sc * .4;
  return y > 0. ? mix(hz, sky, smoothstep(0., .25, y)) : mix(hz, gr, smoothstep(0., -.15, y));
}
vec3 holes(vec2 uv, sampler2D S) {
  vec2 u2 = uv; vec3 add = vec3(0.); float inside = 0.; vec3 inner = vec3(0.);
  for (int i = 0; i < 3; i++) { if (i >= uNh) break; vec4 h = uHc[i]; vec2 dv = (uv - h.xy) * vec2(uAsp, 1.); float r = length(dv), R = h.z;
    float rp = max(R, 2.5 / 600.);                                        // from far off, a pinprick that stays visible
    float ring = exp(-pow((r - rp) / (rp * .12 + .0015), 2.)) * (1. + 3. * exp(-R * 400.));
    vec3 sc = uHs[i] / max(max(uHs[i].x, uHs[i].y), uHs[i].z);
    if (texture(uD, clamp(h.xy, 0., 1.)).r < h.w - ${RW}. * 1.5) continue;   // hidden behind something nearer
    bool front = texture(uD, uv).r > h.w - ${RW}. * 1.5;
    add += sc * ring * .9 + sc * exp(-r / (rp * 3.)) * .25 * exp(-R * 200.);
    if (r < R * 3.5 && R > 1e-4) { float e = R * R * 1.1 / max(r, 1e-6); u2 -= (dv / max(r, 1e-6)) * min(e, r) * vec2(1. / uAsp, 1.) * smoothstep(R * 3.5, R * 1.5, r); }   // light bent round the mouth
    if (r < R && front) { float rho = r / R, a = rho * 3.1416; vec2 dn = dv / max(r, 1e-6); vec3 rd = normalize(vec3(dn.x * sin(a), dn.y * sin(a) + .15, -cos(a)));   // a fish-eye of the whole far sky
      inner = farWorld(vec3(rd.x, -rd.z * .0 + rd.y, rd.z), uHb[i], uHs[i], uHg[i], uHl[i]) * (1. - .5 * pow(rho, 6.)); inside = 1.; }
  }
  vec3 c = texture(S, u2).rgb; if (inside > .5) c = inner;
  return c + add;
}`,
    setPost(P, W, Hh) {
      const a = new Float32Array(12), b = new Float32Array(9), s = new Float32Array(9), g = new Float32Array(9), l = new Float32Array(9);
      shown.forEach((h, i) => { a.set([h.sx, h.sy, h.rad, h.d], i * 4); const T = h.to, bm = max(...T.beta); b.set(T.beta.map((v) => v / bm), i * 3); s.set(T.sunCol, i * 3); g.set(T.grass, i * 3); l.set(T.liquid, i * 3); });
      gl.uniform4fv(P.uHc, a); gl.uniform3fv(P.uHb, b); gl.uniform3fv(P.uHs, s); gl.uniform3fv(P.uHg, g); gl.uniform3fv(P.uHl, l); gl.uniform1i(P.uNh, shown.length); gl.uniform1f(P.uAsp, W / Hh);
    },
  };
}
