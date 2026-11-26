// Trees, from a forest's texture to the cells of a leaf, built from each planet's genetic rules. A species is a body
// plan (planet.js: form, height, how it branches, how far its limbs droop under the planet's pull, its leaf's size,
// shape and colour, its bark), grown here into a few individuals. Every tree site (7 m apart) is decided by the
// planet, so the same tree stands in the same place however you come to it. Near you (inside about 70 m) each tree is
// drawn whole; farther out (to about 400 m) each is a lit crown of its species' shape; past that the forest is the
// ground's own canopy. The bands overlap and dissolve into each other.
import { site, TREE, AX, H } from './planet.js';
import { LEAFFACE } from './shade.js';

const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const { sin, cos, PI, hypot, min, max, floor, abs, sqrt } = Math;
const nrm = (v) => { const l = hypot(...v) || 1; return v.map((q) => q / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const FORM = { broad: 0, cone: 1, palm: 2, column: 3, umbrella: 4, weep: 5, orb: 6, spire: 7 };

// ---- a tree's shape, grown once per species and variant ---------------------------------------------------------------
// wood: tapered tubes (x y z, normal, around in metres, along in metres); leaves: cards, each a twig with its leaves
// (or needles, or one frond), drawn by the shader (x y z, normal, card u v, card length, seed)
function grow(sp, seed) {
  const r = rng(seed * 7919 + sp.name.length * 131 + floor(sp.h * 17)), wood = [], wi = [], leaf = [], li = [];
  const tube = (a, b, ra, rb, s0) => {
    const ax = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), side = nrm(cross(ax, abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), up = cross(side, ax), n = ra > 0.15 ? 10 : ra > 0.04 ? 7 : 5, base = wood.length / 8, L = hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (let e = 0; e < 2; e++) for (let i = 0; i <= n; i++) { const t = i / n * 2 * PI, dir = add(add([0, 0, 0], side, cos(t)), up, sin(t)), p = add(e ? b : a, dir, e ? rb : ra), nn = nrm(dir); wood.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], t * (ra + rb) * 0.5, s0 + (e ? L : 0)); }
    for (let i = 0; i < n; i++) { const a0 = base + i, b0 = base + n + 1 + i; wi.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
  };
  const card = (p, ax, len, wid, sd, face) => {      // a card along ax from p, facing up and out (or as given)
    const nn0 = face || nrm(add(add([0, 1, 0], [p[0], 0, p[2]], 0.4), [r() - 0.5, r() - 0.5, r() - 0.5], 0.8)), sd2 = nrm(cross(ax, nn0)), nn = nrm(cross(sd2, ax)), base = leaf.length / 10;
    for (const [u, v] of [[0, -0.5], [1, -0.5], [0, 0.5], [1, 0.5]]) { const q = add(add(p, ax, u * len), sd2, v * wid); leaf.push(q[0], q[1], q[2], nn[0], nn[1], nn[2], u, v, len, sd); }
    li.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };
  const Ht = sp.h * (0.85 + r() * 0.3), f = FORM[sp.form], dr = sp.droop, ll = sp.leaf[0], twig = min(0.9, max(0.3, ll * 4)), conifer = sp.leaf[1] < 0.12;
  const spray = (a, d, len, n) => { for (let k = 0; k < n; k++) { const dd = nrm(add(d, [r() - 0.5, r() * 0.6 - 0.15 - dr * 0.6, r() - 0.5], 1.3)); card(add(a, d, len * (0.25 + 0.75 * r())), dd, twig + r() * twig * 0.4, twig * 0.75, r()); } };
  const branch = (a, d, len, rad, depth, s0, hang) => {                 // a limb, and its limbs, bending under the planet's pull
    const mid = add(a, d, len * 0.5), d2 = nrm(add(d, [0, -dr * 0.35 * (1 - depth / 6), 0])), b = add(mid, d2, len * 0.5);
    tube(a, mid, rad, rad * 0.84, s0); tube(mid, b, rad * 0.84, rad * 0.68, s0 + len * 0.5);
    if (depth === 0 || rad < 0.012) {
      if (hang) { for (let k = 0; k < 5; k++) { const p = add(b, [r() - 0.5, 0, r() - 0.5], 0.4); card(p, nrm([r() * 0.2 - 0.1, -1, r() * 0.2 - 0.1]), 1.2 + r() * 1.6, twig * 0.5, r(), nrm([p[0], 0.2, p[2]])); } return; }
      spray(a, d2, len, 11); return;
    }
    const m = sp.kids - (r() < 0.3 ? 1 : 0);
    for (let k = 0; k < max(2, m); k++) {
      const az = r() * 2 * PI, s = sp.spread * (0.6 + 0.8 * r()), nd = nrm(add(d2, [cos(az) * s, 0.15 + r() * 0.2 - dr * 0.2, sin(az) * s], 1.6));
      branch(add(a, d, len * (0.55 + 0.45 * r())), nd, len * (0.62 + r() * 0.15), rad * 0.62, depth - 1, s0 + len, hang);
    }
  };
  const rb = max(0.08, Ht * (0.01 + 0.004 * sp.spread)) * (f === 3 ? 2.2 : 1);
  if (f === 0 || f === 5 || f === 6) {                                    // broad, weeping, orb: a trunk forking into a crown
    const t0 = Ht * (f === 6 ? 0.6 : 0.3 + r() * 0.08); tube([0, -0.4, 0], [0, t0, 0], rb, rb * 0.82, 0);
    if (f === 6) {                                                         // an orb: a ball of leaves on a stalk
      const R = Ht * 0.22, c = [0, t0 + R * 0.8, 0]; tube([0, t0, 0], c, rb * 0.8, rb * 0.3, t0);
      for (let k = 0; k < 140; k++) { const z = r() * 2 - 1, a = r() * 6.283, s = sqrt(1 - z * z), n = [s * cos(a), z, s * sin(a)]; card(add(c, n, R * (0.75 + 0.25 * r())), nrm(add(n, [r() - 0.5, r() - 0.5, r() - 0.5], 0.7)), twig, twig * 0.8, r(), n); }
    } else for (let k = 0; k < 4; k++) { const az = k * PI / 2 + r(), nd = nrm([cos(az) * sp.spread, 1, sin(az) * sp.spread]); branch([0, t0 * (0.85 + 0.15 * r()), 0], nd, Ht * 0.26, rb * 0.55, sp.depth, t0, f === 5); }
  } else if (f === 1 || f === 7) {                                        // cone and spire: one leader, whorls of branches
    const top = Ht, spi = f === 7; tube([0, -0.4, 0], [0, top * 0.5, 0], rb, rb * 0.55, 0); tube([0, top * 0.5, 0], [0, top, 0], rb * 0.55, 0.02, top * 0.5);
    for (let y = top * (spi ? 0.3 : 0.18), w = 0; y < top - 0.4; y += (spi ? 0.9 : 0.55) + r() * 0.25, w++) {
      const fr = (top - y) / top, len = spi ? 0.4 + fr * 1.2 : 0.6 + fr * Ht * 0.17 * (0.6 + sp.spread), n = spi ? 2 : sp.kids + floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const az = spi ? w * 2.4 + k * PI : k / n * 2 * PI + r(), d = nrm([cos(az), -0.25 * dr - 0.3 * fr * dr + 0.1 + r() * 0.1, sin(az)]), a = [0, y, 0], b = add(a, d, len); tube(a, b, 0.03 + fr * 0.05, 0.008, y);
        for (let s = 0.08; s < 1; s += spi ? 0.25 : 0.07) { const p = add(a, d, len * s), side = nrm(cross(d, [0, 1, 0])); for (const sg of [-1, 1]) card(p, nrm(add(add(d, side, sg * 0.9), [0, -0.15, 0])), (twig + 0.15) * (0.6 + 0.6 * (1 - s) * fr) + 0.1, twig * (conifer ? 1.3 : 0.6), r()); }
      }
    }
  } else if (f === 2) {                                                   // a palm: a leaning trunk, a crown of fronds
    const lean = [r() - 0.5, 0, r() - 0.5]; let a = [0, -0.4, 0]; const segs = 6;
    for (let i = 1; i <= segs; i++) { const t = i / segs, b = [lean[0] * Ht * 0.3 * t * t, Ht * t, lean[2] * Ht * 0.3 * t * t]; tube(a, b, rb * (1 - 0.3 * t), rb * (1 - 0.3 * (t + 1 / segs)), Ht * (t - 1 / segs)); a = b; }
    for (let k = 0; k < sp.kids; k++) { const az = k * 2.39996 + r() * 0.3, el = 0.6 - dr * 0.8 * r(), d = nrm([cos(az), el, sin(az)]); card(a, d, Ht * 0.28 * (0.8 + 0.4 * r()), Ht * 0.06, r(), nrm([cos(az) * 0.2, 1, sin(az) * 0.2])); }
  } else if (f === 3) {                                                   // a column: a fat stem and a few upturned arms, no leaves
    tube([0, -0.4, 0], [0, Ht, 0], rb, rb * 0.85, 0);
    for (let k = 0; k < sp.kids; k++) { const y = Ht * (0.3 + 0.4 * r()), az = r() * 6.283, o = [cos(az), 0, sin(az)], e = add([0, y, 0], o, rb * 2.5); tube([0, y, 0], e, rb * 0.6, rb * 0.6, y); tube(e, add(e, [0, 1, 0], Ht * 0.3 * (0.5 + r())), rb * 0.6, rb * 0.5, y + 1); }
  } else {                                                                // an umbrella: a tall bare stem, a flat spreading crown
    const t0 = Ht * (0.55 + 0.1 * r()); tube([0, -0.4, 0], [0, t0, 0], rb, rb * 0.7, 0);
    for (let k = 0; k < sp.kids + 2; k++) { const az = k / (sp.kids + 2) * 6.283 + r(), nd = nrm([cos(az) * (0.6 + sp.spread), 0.7, sin(az) * (0.6 + sp.spread)]); branch([0, t0, 0], nd, Ht * 0.22, rb * 0.5, max(1, sp.depth - 1), t0, false); }
  }
  return { wood: new Float32Array(wood), wi: new Uint32Array(wi), leaf: new Float32Array(leaf), li: new Uint32Array(li), h: Ht };
}

export function mkTrees(gl, prog, PRE) {
  const V = 3;
  const INST = `
layout(location = 4) in vec4 iP;   // where the tree stands, from the camera; how far its band has faded (w)
layout(location = 5) in vec4 iS;   // scale, turn, seed, species
uniform float uWd, uCy;
layout(location = 6) in vec4 iG; layout(location = 7) in vec4 iC; layout(location = 8) in vec4 iB; layout(location = 9) in vec4 iX;   // a species' genes: height and spread, leaf size and width; leaf colour and lobes; bark; its code
flat out vec4 vLc, vBk, vLf; flat out float vCode, vBn;
vec3 fallC(float h) { vec3 k = clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); return pow(mix(vec3(.4), k, .85) * .55, vec3(2.2)); }   // a species' autumn colour
void genes() { vLc = iC; vBk = iB; vLf = vec4(iG.zw, iC.w, iX.y); vCode = iX.x; vBn = iX.w; if (iX.y > .5) { vLc.rgb = mix(vLc.rgb, fallC(iX.z), uAut) * (1. + uSpr * vec3(.6, .9, .2)); } if (vBn > .5) vBk.rgb = vec3(.03, .027, .025); }
vec3 place(vec3 p) { float c = cos(iS.y), s = sin(iS.y); p *= iS.x; p.y *= iG.x; p.xz *= iG.y; float h = max(p.y, 0.) / 20.; p.xz += vec2(sin(uT * .9 + iS.z * 40.), cos(uT * .7 + iS.z * 23.)) * h * h * .25 * uWd; return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) + iP.xyz; }
vec3 turn(vec3 n) { float c = cos(iS.y), s = sin(iS.y); return vec3(c * n.x - s * n.z, n.y, s * n.x + c * n.z); }`;
  const DITHER = `bool gone(float f) { return h1(gl_FragCoord.xy + fract(f * 13.7) * 91.) > f; }
uniform vec4 uForm[16];
flat in vec4 vLc, vBk, vLf; flat in float vCode, vBn;
vec3 flame(vec2 u) { return vec3(5., 1.7, .35) * (.4 + .6 * n2(u + vec2(0., -uT * 3.))); }`;
  const OUT = (m = '0.', nv = 'vec3(0., 1., 0.)') => `col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), vCode, ${m}, pkn(${nv})); gl_FragDepth = fdep(vW);`;   // (the pick: distance, species, what the microscope finds there: 6 leaf, 7 needle, 8 bark)
  const wood = prog(PRE + INST + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in vec2 aU;
out vec3 vP, vN; out vec2 vU; out float vW, vF, vSd, vR; flat out int vSp;
void main() { genes(); vP = place(aP); vN = turn(aN); vU = aU * iS.x; vF = iP.w; vSd = iS.z; vR = aP.y * iS.x; vSp = int(iS.w); vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + DITHER + `
in vec3 vP, vN; in vec2 vU; in float vW, vF, vSd, vR; flat in int vSp; uniform float uCy;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
float vor(vec2 u) { vec2 i = floor(u), f = u - i; float d = 9.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(h1(i + o), h1(i + o + 7.3)) - f; d = min(d, dot(r, r)); } return sqrt(d); }
void main() {
  if (gone(vF)) discard; CAST
  float fp = vW * uPix; vec2 u = vU + vec2(0., vSd * 31.); vec4 bk = vBk;
  // bark at every scale it has: ridges and furrows (centimetres), plates, lichen (millimetres), cork cells (tens of micrometres)
  float rid = n2(vec2(u.x * 9., u.y * 1.6)) * .6 + n2(vec2(u.x * 23., u.y * 5.)) * .4, fur = smoothstep(.35, .62, rid) * bk.w + (1. - bk.w) * .8;
  vec3 alb = mix(bk.rgb * .3, bk.rgb, fur) * (.85 + .3 * n2(u * 40.));
  if (bk.w < .45) alb = mix(alb, bk.rgb * .25, smoothstep(.72, .75, n2(vec2(u.x * 3., u.y * 11.))) * .8);   // smooth barks: lenticels, dark bands
  float li = smoothstep(.7, .76, n2(u * 11. + 9.)) * smoothstep(.3, 1., vR); alb = mix(alb, vec3(.3, .34, .25), li * .4 * (.7 + .3 * n2(u * 300.)));
  if (fp < 3e-4) { float c = vor(u * vec2(3000., 1800.)); alb *= mix(1., .7 + .5 * smoothstep(.15, .5, c), smoothstep(3e-4, 6e-5, fp)); }
  vec3 n = normalize(vN); float dif = max(dot(n, uSun), 0.) * shadow(vP), am = .45 + .35 * n.y;
  vec3 col = alb * (uSunC * dif * .8 + uSky * am * .5) * (.55 + .45 * clamp(vR / 14., 0., 1.));
  if (vBn > 1.5) col += flame(u * 6.) * smoothstep(.55, .3, fur) * .5;
  ${OUT('8.', 'n')}
}`);
  const leaf = prog(PRE + INST + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in vec2 aU; layout(location = 3) in vec2 aX;
out vec3 vP, vN; out vec2 vU; out float vW, vF, vL, vSd, vY; flat out int vSp;
void main() { genes(); vP = place(aP); vN = turn(aN); vU = aU; vL = aX.x * iS.x; vSd = aX.y; vSp = int(iS.w); vF = iP.w; vY = aP.y * iS.x; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + DITHER + `
in vec3 vP, vN; in vec2 vU; in float vW, vF, vL, vSd, vY; flat in int vSp; uniform float uCy;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
` + LEAFFACE + `
void main() {
  if (gone(vF)) discard;
  // the card is a twig (u along it, v across, in card units; vL metres long) carrying this species' leaves
  vec4 lf = vLf; float form = uForm[vSp].x; vec2 q = vU * vL; float fp = vW * uPix, cw = vL * .75;
  vec2 lp = vec2(0.); float inside = 0., stem = smoothstep(.0035, .002, abs(q.y)) * step(q.x, vL * .92), ll = 0.;
  float far = smoothstep(lf.x * .05, lf.x * .15, fp);                    // too far to make out single leaves: the spray as a whole
  if (far > 0.) { float e = length(vec2(vU.x * 2. - 1., vU.y * 2.)); if (e < .95 - .3 * n2(vU * 7. + vSd * 30.) && h1(gl_FragCoord.xy + vSd) < far * .9) { inside = 1.; lp = vec2(lf.x * .4, 0.); ll = lf.x; } }
  if (inside < .5 && form > 1.5 && form < 2.5) {                         // a frond: one long blade cut into leaflets
    float s = vU.x, hw = .5 * pow(sin(3.1416 * min(s * 1.1, 1.)), .6), pin = abs(fract(s * 40.) - .5) * 2.;
    if (abs(vU.y) < hw * (.25 + .75 * pin) && s < .97) { inside = 1.; lp = vec2(fract(s * 40.) * .05, abs(vU.y) * cw); ll = .05; }
  } else if (inside < .5 && lf.y > .12) {                                // broad leaves along the twig, alternately each side
    for (int i = 0; i < 8; i++) {
      float fi = float(i), t = (.08 + fi * .115) * vL, side = mod(fi, 2.) * 2. - 1., a = side * (.8 - fi * .05), L = lf.x * (.85 + .3 * h1(vec2(vSd, fi)));
      vec2 d = vec2(cos(a), sin(a)), r = q - vec2(t, 0.); float s = dot(r, d), w = dot(r, vec2(-d.y, d.x));
      if (s > 0. && s < L) { float x = s / L, hw = L * lf.y * .5 * pow(sin(3.1416 * x), .8) * (1. - .25 * x);
        if (lf.z > .5) hw *= .7 + .3 * abs(sin(x * 3.1416 * lf.z));         // lobes
        if (abs(w) < hw) { inside = 1.; lp = vec2(s, w); ll = L; } }
    }
  } else if (inside < .5) {                                              // needles, two rows
    float k = floor(q.x / .006), t = (k + .5) * .006, side = mod(k, 2.) * 2. - 1.;
    vec2 d = normalize(vec2(.5, side)), r = q - vec2(t, 0.); float s = dot(r, d), w = dot(r, vec2(-d.y, d.x)), L = lf.x * (1. - .4 * q.x / vL);
    if (s > 0. && s < L && abs(w) < .0008 * (1. - .4 * s / L) && q.x < vL * .95) { inside = 1.; lp = vec2(s, w); ll = L; }
  }
  if (inside < .5 && stem < .5) discard;
  if (vBn > .5 && vBn < 1.5) discard;
  if (vBn > 1.5 && h1(gl_FragCoord.xy * .37 + floor(uT * 12.)) < .45) discard;
  if (vLf.w > .5 && inside > .5 && fract(vSd * 91.7 + vCode * .013) < uBare) discard;   // deciduous: the leaves fall in autumn and come back in spring
  CAST
  vec3 base = vLc.rgb * (.85 + .3 * h1(vec2(vSd * 9.1, 1.)));
  vec3 alb = stem > .5 && inside < .5 ? vBk.rgb * .5 : base;
  if (inside > .5 && far < 1.) alb = leafFace(alb, lp, ll, fp);
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float sh = shadow(vP + n * .05), dif = max(dot(n, uSun), 0.) * sh, tr = max(dot(-n, uSun), 0.) * .6 * sh;
  float occ = .35 + .65 * clamp(vY / 20., 0., 1.);
  vec3 col = alb * (uSunC * (dif + tr * (.6 + .6 * normalize(alb + .01))) * .85 + uSky * (.35 + .25 * n.y)) * occ;
  if (vBn > 1.5) col = flame(vU * 3. + vSd * 9.);
  ${OUT("stem > .5 && inside < .5 ? 8. : form > 1.5 && form < 2.5 || lf.y > .12 || far > .5 ? 6. : 7.", 'n')}
}`);
  // the mid band: each tree a camera-facing card, its crown the outline of its form, lit as a volume
  const crown = prog(PRE + `
layout(location = 0) in vec2 aC; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform vec3 uRt; uniform vec4 uForm[16];
out vec2 vC; out vec3 vP; out float vW, vF, vSd; flat out int vSp;
layout(location = 6) in vec4 iG; layout(location = 7) in vec4 iC; layout(location = 8) in vec4 iB; layout(location = 9) in vec4 iX; flat out vec4 vLc, vBk, vLf; flat out float vCode, vBn;
vec3 fallC(float h) { vec3 k = clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); return pow(mix(vec3(.4), k, .85) * .55, vec3(2.2)); }
void main() { vSp = int(iS.w); vLc = iC; vBk = iB; vLf = vec4(0., 0., 0., iX.y); vCode = iX.x; if (iX.y > .5) vLc.rgb = mix(mix(vLc.rgb, fallC(iX.z), uAut), iB.rgb * .7, uBare * .7); vec4 fm = uForm[vSp]; float h = iS.x * fm.y * iG.x, w = iS.x * fm.y * fm.z * iG.y; vec3 c = iP.xyz + vec3(0., h * .5, 0.); vP = c + uRt * aC.x * w + vec3(0., 1., 0.) * aC.y * h * .52; vC = aC; vF = iP.w; vSd = iS.z; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w); }`, PRE + DITHER + `
in vec2 vC; in vec3 vP; in float vW, vF, vSd; flat in int vSp; uniform float uCy; uniform vec3 uRt;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() {
  if (gone(vF)) discard;
  vec2 c = vC; float y = c.y * .5 + .5, form = uForm[vSp].x, wdt, bot;
  // the outline of each body plan: dome, cone, frond star, column, flat umbrella, weeping dome, orb, spire
  if (form < .5) { wdt = sqrt(max(0., 1. - pow((c.y - .25) / .75, 2.))) * .95; bot = -.45; }
  else if (form < 1.5) { wdt = (1. - y) * .95 + .05; bot = -.7; }
  else if (form < 2.5) { float a = atan(c.y - .75, c.x), rr = length(vec2(c.x, (c.y - .75) * 1.3)); wdt = rr < .35 * (.6 + .4 * abs(sin(a * 4.5))) ? 1. : 0.; bot = .4; }
  else if (form < 3.5) { wdt = .22; bot = -1.; }
  else if (form < 4.5) { wdt = c.y > .45 ? sqrt(max(0., 1. - pow((c.y - .75) / .3, 2.))) : 0.; bot = .45; }
  else if (form < 5.5) { wdt = sqrt(max(0., 1. - pow((c.y - .1) / .9, 2.))) * .95; bot = -.8; }
  else if (form < 6.5) { wdt = sqrt(max(0., 1. - pow((c.y - .5) / .5, 2.))) * .8; bot = 0.; }
  else { wdt = (1. - y) * .35 + .03; bot = -.4; }
  float rag = form > 2.5 && form < 3.5 ? 0. : n2(c * 9. + vSd * 40.) * .25; bool trunk = abs(c.x) < .035 && c.y < bot + .05;
  if ((form < 2.5 && form > 1.5) ? wdt < .5 && !trunk : (abs(c.x) > wdt - rag * wdt || c.y < bot) && !trunk) discard;
  if (vLf.w > .5 && !trunk && n2(c * 23. + vSd * 7.) < uBare * .75) discard;
  if (vBn > .5 && vBn < 1.5 && !trunk && n2(c * vec2(30., 6.) + vSd * 7.) < .82) discard;   // a snag: bare black limbs
  if (vBn > 1.5 && !trunk && n2(c * 6. + vec2(0., -uT * 2.) + vSd * 7.) < .35) discard; CAST
  vec3 n = normalize(uRt * c.x / max(wdt, .1) * .8 + vec3(0., .5 + .5 * c.y, 0.) - normalize(vP) * sqrt(max(0., 1. - c.x * c.x)));
  vec3 alb = trunk || form > 2.5 && form < 3.5 ? vBk.rgb * .6 : vLc.rgb * (.75 + .5 * n2(c * 14. + vSd * 9.));
  float dif = max(dot(n, uSun), 0.) * shadow(vP + uSun * 2.);
  if (vBn > .5) alb = vBk.rgb;
  vec3 col = alb * (uSunC * dif * .8 + uSky * .45) * (.6 + .4 * y);
  if (vBn > 1.5 && !trunk) col = flame(c * 5. + vSd * 9.);
  ${OUT()}
}`);

  // ---- geometry: V variants of each species, grown when a planet is first visited -----------------------------------
  const quad = gl.createVertexArray(); gl.bindVertexArray(quad); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const cib = gl.createBuffer(); gl.bindVertexArray(null);
  const inst = (vao, buf) => { gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); for (let l = 4; l < 10; l++) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 96, (l - 4) * 16); gl.vertexAttribDivisor(l, 1); } };
  inst(quad, cib); gl.bindVertexArray(null);
  const kits = new Map();
  function kit(G) {
    if (kits.has(G.id)) return kits.get(G.id);
    const T = [];
    G.species.forEach((sp, s) => { for (let v = 0; v < V; v++) {
      const g = grow(sp, v + 1 + G.n * 10), o = { h: g.h, s };
      o.wv = gl.createVertexArray(); gl.bindVertexArray(o.wv);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, g.wood, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.wi, gl.STATIC_DRAW); o.wn = g.wi.length;
      o.lv = gl.createVertexArray(); gl.bindVertexArray(o.lv);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, g.leaf.length ? g.leaf : new Float32Array(10), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 24); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 40, 32);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.li, gl.STATIC_DRAW); o.ln = g.li.length;
      o.ib = gl.createBuffer(); inst(o.wv, o.ib); inst(o.lv, o.ib); T.push(o);
    } });
    gl.bindVertexArray(null);
    const U = { form: new Float32Array(64) };
    G.species.forEach((sp, i) => { if (i >= 16) return; const f = FORM[sp.form];
      U.form.set([f, sp.h, f === 1 ? 0.24 : f === 7 ? 0.12 : f === 3 ? 0.3 : f === 2 ? 0.55 : f === 4 ? 0.5 + sp.spread * 0.3 : 0.3 + sp.spread * 0.25, 0], i * 4); });
    const k = { T, U, memo: new Map(), block: new Map() }; kits.set(G.id, k); return k;
  }
  const setU = (P, U) => { gl.uniform4fv(P.uForm, U.form); };

  // ---- which trees, each frame: the cube faces near the camera, their lattice cells within reach; each site is
  // looked up once (a few thousand a frame at most, so a new stand fills in over a moment rather than stalling) ------
  const R1 = 72, R2 = 420;
  return {
    draw(common, setNoise, cam, G, S) {
      const hc = S.hc; if (hc > 4000) return;
      const K = kit(G), T = K.T, near = T.map(() => []), far = [], F = S.F, foot = S.foot, metNow = [];
      const r2 = min(R2, max(R1 * 1.2, hc * 6 + 150)); let budget = 2500;
      const ab = foot.map(abs);
      for (let a = 0; a < 3; a++) {
        if (ab[a] < max(ab[(a + 1) % 3], ab[(a + 2) % 3]) - r2 * 2) continue;   // this face is nowhere near
        const sg = foot[a] >= 0 ? 1 : -1, [b, c] = AX[a], sc = G.R / max(ab[a], 1), rr = r2 * sc * 1.05;
        const i0 = floor((foot[b] - rr) / TREE), i1 = floor((foot[b] + rr) / TREE), j0 = floor((foot[c] - rr) / TREE), j1 = floor((foot[c] + rr) / TREE);
        if ((i1 - i0) * (j1 - j0) > 60000) continue;
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const key = ((a * 2 + (sg > 0 ? 1 : 0)) * 2000003 + i) * 2000003 + j; let t = K.memo.get(key);
          if (t === undefined) { if (budget-- <= 0) continue; t = site(G, a, sg, i, j); K.memo.set(key, t); }
          if (!t) continue;
          const D = [t.p[0] - foot[0], t.p[1] - foot[1], t.p[2] - foot[2]], q = [D[0] * F[0][0] + D[1] * F[0][1] + D[2] * F[0][2], D[0] * F[1][0] + D[1] * F[1][1] + D[2] * F[1][2], D[0] * F[2][0] + D[1] * F[2][1] + D[2] * F[2][2]];
          const d = hypot(q[0], q[2]); if (d > r2) continue;
          const pos = [q[0] + q[0] * t.h / G.R, q[1] + (t.h - S.cy) + q[1] * t.h / G.R, q[2] + q[2] * t.h / G.R];
          const sc2 = 0.75 + t.seed * 0.5, rot = t.seed * 40, v = floor(t.seed * 997) % V, idx = t.sp * V + v;
          const fNear = min(1, max(0, (R1 - d) / 14)), fFar = min(1, max(0, (d - (R1 - 14)) / 14)) * min(1, max(0, (r2 - d) / 60));
          // after a fire: burning, then a black snag, which in a few years falls; then a sapling, growing back
          let bs = 0, s3 = sc2; const ba = S.fireAge ? S.fireAge(t.p) : -1;
          if (ba >= 0) { const yr = ba / G.yearD; if (ba < 0.12) bs = 2; else if (yr < 7) { bs = 1; if (yr > 2.5 && (t.seed * 7.31) % 1 < (yr - 2.5) / 4.5) continue; } else s3 = sc2 * (0.05 + 0.95 * min(1, ((yr - 7) / 50) ** 0.8)); }
          if (S.pondAt) { const pa = S.pondAt(t.p, t.h); if (pa === 1) bs = max(bs, 1); else if (pa < 0) continue; else if (pa > 0) s3 = min(s3, sc2 * (0.05 + 0.95 * pa)); }
          const g = t.spc, gx = [g.hM, g.wM, g.leaf[0], g.leaf[1], g.canopy[0], g.canopy[1], g.canopy[2], g.leaf[2], g.bark[0], g.bark[1], g.bark[2], g.rough, g.code, g.decid, g.fall, bs];
          if (d < 40) metNow.push(g.code);
          if (fNear > 0 && T[idx]) near[idx].push(pos[0], pos[1], pos[2], fNear, s3, rot, t.seed, t.sp, ...gx);
          if (fFar > 0) far.push(pos[0], pos[1], pos[2], fFar, s3 * (T[idx] ? T[idx].h / G.species[t.sp].h : 1), rot, t.seed, t.sp, ...gx);
        }
      }
      if (K.memo.size > 300000) K.memo.clear();
      if (!S.cast() && S.meet) S.meet(G, metNow);
      const dw = (P) => { common(P); gl.uniform1f(P.uCy, S.cy); gl.uniform1f(P.uWd, 1); setU(P, K.U); };
      gl.useProgram(wood.p); dw(wood);
      T.forEach((o, n) => { const a = near[n]; o.cnt = 0; if (!a.length) return; gl.bindBuffer(gl.ARRAY_BUFFER, o.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.DYNAMIC_DRAW); o.cnt = a.length / 24; gl.bindVertexArray(o.wv); gl.drawElementsInstanced(gl.TRIANGLES, o.wn, gl.UNSIGNED_INT, 0, o.cnt); });
      gl.useProgram(leaf.p); dw(leaf); gl.disable(gl.CULL_FACE);
      T.forEach((o) => { if (!o.cnt || !o.ln) return; gl.bindVertexArray(o.lv); gl.drawElementsInstanced(gl.TRIANGLES, o.ln, gl.UNSIGNED_INT, 0, o.cnt); });
      if (far.length) {
        const d = [cos(cam.pitch) * sin(cam.yaw), sin(cam.pitch), cos(cam.pitch) * cos(cam.yaw)], rl = hypot(d[0], d[2]) || 1;
        gl.useProgram(crown.p); dw(crown); if (S.cast()) gl.uniform3fv(crown.uRt, S.shR()); else gl.uniform3f(crown.uRt, -d[2] / rl, 0, d[0] / rl);
        gl.bindBuffer(gl.ARRAY_BUFFER, cib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(far), gl.DYNAMIC_DRAW); gl.bindVertexArray(quad); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, far.length / 24);
      }
      gl.bindVertexArray(null); void H; void sqrt;
    },
  };
}
