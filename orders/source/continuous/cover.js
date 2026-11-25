// What lies on the ground, band by band down the scales: plants (grass in the open, ferns and moss tufts under trees)
// every 35 cm; fallen leaves every 7 cm; twigs and stones every 2 cm; grains of soil every half millimetre; and silt
// and clay, tens of micrometres. Each band is a lattice fixed to the world and drawn round the eye, so a grain is
// always where it was; each fades in as it grows big enough to see and out as it shrinks below a pixel.
import { LEAFFACE } from './shade.js';
import { K } from './world.js';

export function mkCover(gl, prog, PRE) {
  const { floor, max, min } = Math;
  // a rough stone: an icosahedron, its corners pushed about
  const stone = (() => {
    const t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => { const l = Math.hypot(...v); return v.map((q) => q / l); });
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const nz = (v) => { const l = Math.hypot(...v); return v.map((q) => q / l); }, md = (a, b) => nz(a.map((q, i) => q + b[i]));
    const o = []; for (const [a, b, c] of F) { const A = V[a], B = V[b], C = V[c], ab = md(A, B), bc = md(B, C), ca = md(C, A); for (const t of [[A, ab, ca], [ab, B, bc], [ca, bc, C], [ab, bc, ca]]) for (const v of t) o.push(...v); } return new Float32Array(o);
  })();
  const VS = `
layout(location = 0) in vec3 aP;
uniform vec4 uBand;    // lattice spacing, cells across, the camera's place in its cell (x, z)
uniform ivec2 uBase;   // the camera's cell, folded to 16 bits
uniform float uFade, uCy; uniform int uKmax; uniform vec2 uCxz;
out vec3 vP, vN, vL; out float vW, vF, vSd, vT, vS;
float hh(ivec2 c, int k) { return hsh(c * 7 + ivec2(k * 13, k * 29), 30 + k); }
float ground(vec2 p) { float y = 0.; for (int k = 0; k < ${K}; k++) { if (k > uKmax) break; y += oct(k, p).x; } return y; }
void place(out vec3 o, out float sz, out float sd, out float ang, out vec2 w) {
  int n = int(uBand.y), i = gl_InstanceID % n - n / 2, j = gl_InstanceID / n - n / 2; ivec2 c = (uBase + ivec2(i, j)) & 65535;
  vec2 jt = vec2(hh(c, 1), hh(c, 2)); o.xz = (vec2(i, j) + jt - uBand.zw) * uBand.x; o.y = uH0 + ground(o.xz);
  sd = hh(c, 3); sz = .6 + .8 * hh(c, 4); ang = hh(c, 5) * 6.2832; w = o.xz + uCxz;
}`;
  const mk = (body, frag) => prog(PRE + `uniform float uH0;` + VS + body, PRE + `
in vec3 vP, vN, vL; in float vW, vF, vSd, vT, vS; uniform float uCy;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
` + LEAFFACE + `
bool gone(float f) { return h1(gl_FragCoord.xy + fract(vSd * 13.7) * 91.) > f; }
vec3 lite(vec3 alb, vec3 n) { return alb * (uSunC * max(dot(n, uSun), 0.) * .8 + uSky * (.4 + .3 * n.y)); }
void main() { if (gone(vF)) discard; float fp = vW * uPix; vec3 col; ` + frag + `
  col = air(col, normalize(vP), length(vP), uCy, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`);
  const END = `vec4 Q = uVP * vec4(vP, 1.); vW = Q.w; gl_Position = vec4(Q.xy, 0., Q.w); }`;
  const edge = `float dd = length(o.xz) / (uBand.x * uBand.y * .5); vF = uFade * smoothstep(1., .7, dd);`;
  // fallen leaves: a flat blade on the ground, a little cupped, its face the same as a living leaf's
  const litter = mk(`
void main() { vec3 o; float sz, sd, a; vec2 w; place(o, sz, sd, a, w); ${edge}
  float fo = forest(w, uCy + o.y); if (fo < .3 || sd < .25) vF = 0.;
  float L = .07 * sz; vec2 u = aP.xz; vL = vec3(u.x * L, u.y * L, L); float c = cos(a), s = sin(a);
  vec3 p = vec3(u.x * L, (u.y * u.y) * L * .12 + .002 + sd * .004, u.y * L); vP = o + vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); vN = vec3(0, 1, 0); vSd = sd; vT = hh(ivec2(w * 10.), 7); ${END}`,
  `float L = vL.z, s = vL.x, w = vL.y; float hw = L * .33 * pow(max(sin(3.1416 * clamp(s / L, 0., 1.)), 0.), .8);
  if (s < 0. || s > L || abs(w) > hw) discard;
  vec3 alb = mix(vec3(.28, .14, .05), vec3(.42, .26, .08), vT) * (.8 + .3 * vSd); alb = mix(alb, vec3(.1, .07, .04), smoothstep(.5, .9, n2(vec2(s, w) * 90. + vSd * 9.)) * .7);   // brown, blotched with rot
  alb = leafFace(alb, vec2(s, w), L, fp); col = lite(alb, vec3(0, 1, 0)) * .85;`);
  // plants: a tuft of grass blades in the open; under trees, ferns
  const plant = mk(`
void main() { vec3 o; float sz, sd, a; vec2 w; place(o, sz, sd, a, w); ${edge}
  float fo = forest(w, uCy + o.y); vT = fo; bool fern = fo > .5; if (fern && sd > .3) vF = 0.; if (uCy + o.y < 1.) vF = 0.;
  float bi = floor(aP.x), b = fract(aP.x), lat = aP.z, ht = fern ? .45 * sz : .3 * sz;   // blade bi; b along it 0..1; lat across
  float ba = a + bi * 2.4, lean = fern ? 1.1 : .35 + .3 * h1(vec2(bi, sd)), len = ht * (fern ? 1. : .7 + .5 * h1(vec2(sd, bi)));
  vec2 dir = vec2(cos(ba), sin(ba)); float t = b, bend = lean * t * t, wid = fern ? .09 * (1. - t * .8) : .006 * (1. - t);
  vec3 sway = vec3(sin(uT * 1.3 + w.x * .3) * .04, 0., cos(uT * 1.1 + w.y * .3) * .04) * t * t;
  vP = o + vec3(dir.x * bend * len, len * t * (1. - bend * .35), dir.y * bend * len) + vec3(-dir.y, 0., dir.x) * lat * wid + sway;
  vN = normalize(vec3(dir.x * .3, 1., dir.y * .3) + vec3(-dir.y, 0., dir.x) * lat * (fern ? .7 : .4)); vL = vec3(b, lat, bi); vSd = sd; ${END}`,
  `vec3 alb = vT > .5 ? mix(vec3(.07, .17, .04), vec3(.12, .22, .05), vSd) : mix(vec3(.12, .2, .04), vec3(.28, .27, .1), vSd); vec3 n = normalize(vN); float sh = 1.;
  if (vT > .5) { float pi = fract(vL.x * 14.), lf = abs(pi - .5) * 2., wl = .35 + .65 * lf, al = abs(vL.y);
    if (al > wl) discard;                                                         // a fern's fronds, notched into leaflets
    float pin = al / wl; sh = (.75 + .35 * (1. - pin)) * (1. - .45 * smoothstep(.06, 0., al) * step(.5, 1. - fp * 200.));   // each leaflet paler at its rib, the rachis dark
    alb *= 1. + .25 * smoothstep(.15, 0., abs(pin - .5 - .3 * (pi - .5)) ) * smoothstep(.01, .002, fp); }
  float tr = max(dot(-n, uSun), 0.) * .5;                                       // light through the blade
  alb *= .7 + .4 * vL.x; col = (lite(alb, n) + alb * uSunC * tr * vec3(.9, 1.2, .5)) * sh * (.6 + .4 * vL.x);`);
  // stones, grains and specks: the same rough shape at three sizes, each kind its own colours
  const grains = mk(`
uniform vec3 uKind;   // size, then colour set
void main() { vec3 o; float sz, sd, a; vec2 w; place(o, sz, sd, a, w); ${edge}
  float fo = forest(w, uCy + o.y); if (uKind.y < .5 && sd > (fo > .3 ? .25 : .45)) vF = 0.;
  float r = uKind.x * sz * (.5 + sd); vec3 q = aP * vec3(1., .55 + .3 * h1(vec2(sd, 1.)), .8 + .4 * h1(vec2(sd, 2.))); q *= 1. + .25 * (h1(aP.xy * 13. + sd) - .5);
  float c = cos(a), s = sin(a); vec3 p = vec3(c * q.x - s * q.z, q.y, s * q.x + c * q.z) * r; vP = o + p + vec3(0., r * .25, 0.); vN = normalize(p); vSd = sd; vT = uKind.y; ${END}`,
  `vec3 n = normalize(cross(dFdx(vP), dFdy(vP))); if (dot(n, vP) > 0.) n = -n; n = normalize(mix(n, normalize(vN), .6));
  vec3 alb = vT < .5 ? mix(vec3(.2, .19, .17), vec3(.36, .33, .28), vSd) : vT < 1.5 ? (vSd < .55 ? vec3(.07, .05, .035) : vSd < .75 ? vec3(.5, .47, .42) : vSd < .9 ? vec3(.42, .3, .22) : vec3(.08, .08, .08))
    : (vSd < .5 ? vec3(.36, .27, .18) : vSd < .8 ? vec3(.55, .5, .45) : vec3(.2, .14, .09));   // stones; soil grains; silt and clay
  alb *= .8 + .4 * n2(vP.xz / max(fp * 6., 1e-7));
  col = lite(alb, n);`);
  // ---- geometry: a strip for blades and leaves, the stone for the rest --------------------------------------------
  const vao = (data, n) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null); return { v, n }; };
  const leafQ = []; for (let i = 0; i < 6; i++) { const u0 = i / 6, u1 = (i + 1) / 6; leafQ.push(u0, 0, -0.5, u1, 0, -0.5, u0, 0, 0.5, u0, 0, 0.5, u1, 0, -0.5, u1, 0, 0.5); }
  const blades = []; for (let bi = 0; bi < 7; bi++) for (let i = 0; i < 5; i++) { const a = bi + i / 5, b = bi + (i + 1) / 5 - 1e-4; blades.push(a, 0, -1, b, 0, -1, a, 0, 1, a, 0, 1, b, 0, -1, b, 0, 1); }
  const G = { leaf: vao(new Float32Array(leafQ), leafQ.length / 3), blade: vao(new Float32Array(blades), blades.length / 3), stone: vao(stone, stone.length / 3) };
  // the bands: spacing, cells across, finest octave the ground needs there, drawing, kind
  const BANDS = [
    { s: 0.35, n: 110, P: plant, g: G.blade, kmax: 22 },
    { s: 0.07, n: 90, P: litter, g: G.leaf, kmax: 26 },
    { s: 0.022, n: 80, P: grains, g: G.stone, kmax: 28, kind: [0.006, 0, 0] },
    { s: 6e-4, n: 90, P: grains, g: G.stone, kmax: 33, kind: [1.8e-4, 1, 0] },
    { s: 3.5e-5, n: 80, P: grains, g: G.stone, kmax: 36, kind: [1.1e-5, 2, 0] },
  ];
  return {
    draw(common, setNoise, cam, hc, g0) {
      const [cx, cy, cz] = cam.C;
      for (const b of BANDS) {
        const reach = b.s * b.n * 0.5, fade = min(1, max(0, (reach * 0.9 - hc) / (reach * 0.5))) * min(1, max(0, (b.s * 160 - hc) / (b.s * 60) + 1));
        if (fade <= 0) continue;
        const P = b.P; gl.useProgram(P.p); common(P); setNoise(P);
        const ix = floor(cx / b.s), iz = floor(cz / b.s);
        gl.uniform4f(P.uBand, b.s, b.n, cx / b.s - ix, cz / b.s - iz); gl.uniform2i(P.uBase, ((ix % 65536) + 65536) % 65536, ((iz % 65536) + 65536) % 65536);
        gl.uniform1f(P.uFade, fade); gl.uniform1f(P.uCy, cy); gl.uniform1f(P.uH0, g0 - cy); gl.uniform1i(P.uKmax, b.kmax); gl.uniform2f(P.uCxz, cx, cz);
        if (b.kind) gl.uniform3fv(P.uKind, b.kind);
        gl.bindVertexArray(b.g.v); gl.drawArraysInstanced(gl.TRIANGLES, 0, b.g.n, b.n * b.n);
      }
      gl.bindVertexArray(null);
    },
  };
}
