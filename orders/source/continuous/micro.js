// Below a few millimetres: whatever is under the pointer goes on down, in its own kind. A leaf is veins, then the
// jigsaw cells of its skin with stomata between them (two guard cells round a pore), the green of the chloroplasts
// showing through from below, then the wax of its cuticle; a needle the same, its stomata in rows and plugged with wax;
// bark is ridges and lichen, then cork cells, then the cellulose fibrils of a cell's wall; a fallen leaf has fungal
// threads across it; water is a glassy skin with diatoms drifting beneath; snow is crystals, six-armed; sand is grains of
// quartz and feldspar; rock is interlocking crystals; soil is crumbs, then silt, then clay platelets; lunar dust is
// grains of rock and glass, beads and micrometeorite pits. Each ends in its own atoms (carbon and hydrogen in wax,
// oxygen and silicon in quartz, water's molecules, bent, and in ice ordered, with their hydrogens disordered); an atom
// is a cloud of electrons round a nucleus a hundred thousand times smaller, built of alpha clusters (or, for hydrogen,
// a single proton); a nucleon is three quarks held by the gluon field, with pairs flickering in and out. Below a few
// attometres no experiment has seen any structure, and nor does this.
// Light cannot show anything smaller than about a fifth of a micrometre, so below that the colours are a convention
// (the chemists' colours for elements, red, green and blue for the quarks' colour charge).
// The camera keeps its own position here, in doubles, from the point it came down to; every shader position is
// measured from the camera, so the floats stay exact from millimetres to attometres. Beyond the leaf or the patch of
// ground, the world is what a macro lens makes of it: its colours, out of focus.
const { floor, sqrt, hypot, min, max, abs, sin, cos, PI, cbrt, imul } = Math;
export const MICRO = 1.5e-6;                                                 // below this height the planet hands over (flying down)
export const ENT = (m) => (m === 6 || m === 7 || m === 9 ? 0.025 : 3e-3);   // or a surface this close under the pointer, zooming in (a leaf sways, so from further)
const A = 2.9e-10, RA = 1.3e-10, RN = 0.85e-15, S3 = sqrt(3), OH = 0.96e-10, CH = 0.6122, SHh = 0.7907;   // O–H 0.96 Å at 104.5°
const LAY = [[0, -RA, 0], [A / 2, -RA * 1.55, A / (2 * S3)], [A / 2, -RA * 2.6, -A / (2 * S3)]];   // three layers: offset x, centre height, offset z
// the same integer hash as the shader's, so both agree on which atom is where
function hf(i, j, k) { let h = (imul(i, 73856093) ^ imul(j, 19349663) ^ imul(k, 83492791)) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = imul(h, 1540483477) >>> 0; h = (h ^ (h >>> 15)) >>> 0; return (h & 65535) / 65535; }
function hexCands(x, z) { const v = z / (A * S3 / 2), u = x / A - v / 2, i0 = floor(u), j0 = floor(v); return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => { const i = i0 + a, j = j0 + b; return { i, j, cx: (i + j / 2) * A, cz: j * A * S3 / 2 }; }); }
const EL = { 1: ['hydrogen', 1, 0], 6: ['carbon', 6, 6], 8: ['oxygen', 8, 8], 13: ['aluminium', 13, 14], 14: ['silicon', 14, 14] };
const ER = (l, e) => (e === 1 ? 0.55 : l === 1 ? 0.55 : e === 6 ? 0.85 : 1) * RA, ESH = (e) => (e === 1 ? 1 : e < 10 ? 2 : 3);
// what each kind of surface is, and what is seen at each width of view (the pick codes: 1 soil … 10 lunar dust)
const MATS = {
  1: { on: 'soil', el: [8, 13, 8], b: [[2e-3, 'crumbs of soil'], [2e-4, 'grains of silt in a crumb'], [2e-6, 'silt and clay'], [3e-8, 'a clay platelet'], [2e-9, 'terraces of atoms']] },
  2: { on: 'water', mol: 1, b: [[2e-3, 'the surface of the water'], [2e-4, 'diatoms in the water below'], [2e-9, 'the skin of the water, smooth far below what light can show']] },
  3: { on: 'snow', mol: 2, b: [[2e-3, 'snow crystals'], [2e-4, 'an arm of a snow crystal'], [2e-6, 'ice'], [2e-9, 'growth steps on the ice']] },
  4: { on: 'sand', el: [8, 14, 8], b: [[2e-3, 'grains of sand'], [2e-4, 'a grain of sand'], [2e-6, 'its frosted face'], [2e-9, 'terraces of atoms']] },
  5: { on: 'rock', el: [8, 14, 8], b: [[2e-3, 'crystals in the rock'], [2e-4, 'a crystal, and its cleavage'], [2e-9, 'terraces of atoms']] },
  6: { on: 'leaf', el: [6, 1, 6], r: 0.04, b: [[8e-3, 'a leaf'], [2e-3, 'veins'], [2e-4, 'leaf cells and stomata'], [2e-5, 'a stoma'], [2e-6, 'the waxy cuticle'], [3e-8, 'wax crystals'], [2e-9, 'wax']] },
  7: { on: 'needle', el: [6, 1, 6], r: 0.03, b: [[8e-3, 'a needle'], [2e-3, 'rows of stomata'], [2e-4, 'needle cells and stomata'], [2e-5, 'a stoma, plugged with wax'], [2e-6, 'the waxy cuticle'], [3e-8, 'wax crystals'], [2e-9, 'wax']] },
  8: { on: 'bark', el: [6, 1, 8], r: 0.2, b: [[1e-3, 'bark: ridges, flakes, lichen'], [6e-5, 'cork cells'], [1e-6, 'the wall of a cork cell'], [2e-8, 'cellulose fibrils'], [2e-9, 'a fibril']] },
  9: { on: 'fallen leaf', el: [6, 1, 8], r: 0.05, b: [[2e-3, 'a fallen leaf'], [2e-4, 'its cells, and fungal threads'], [2e-6, 'a fungal thread'], [2e-9, 'the cuticle']] },
  10: { on: 'regolith', el: [8, 14, 8], b: [[2e-3, 'lunar dust'], [2e-4, 'grains of rock and glass'], [2e-6, 'micrometeorite pits'], [2e-9, 'terraces of atoms']] },
};
// a water molecule at a lattice site: its oxygen, and two hydrogens (in liquid jostled and turned any way; in ice the
// oxygens in rows, each hydrogen along a bond, which bonds being disordered)
function mol(l, i, j, liq) {
  const [ox, oy, oz] = LAY[l], h = (k) => hf(i, j, l * 16 + k); let O = [(i + j / 2) * A + ox, oy, j * A * S3 / 2 + oz];
  if (liq) { O = [O[0] + (h(1) - 0.5) * 0.5 * A, O[1] + (h(2) - 0.5) * 0.6 * RA, O[2] + (h(3) - 0.5) * 0.5 * A];
    const z = 2 * h(4) - 1, ph = 2 * PI * h(5), s = sqrt(max(0, 1 - z * z)), a = [s * cos(ph), z, s * sin(ph)], e = abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let b0 = [a[1] * e[2] - a[2] * e[1], a[2] * e[0] - a[0] * e[2], a[0] * e[1] - a[1] * e[0]]; const bl = hypot(...b0); b0 = b0.map((x) => x / bl);
    const ab = [a[1] * b0[2] - a[2] * b0[1], a[2] * b0[0] - a[0] * b0[2], a[0] * b0[1] - a[1] * b0[0]], th = 2 * PI * h(6), b = b0.map((x, k) => x * cos(th) + ab[k] * sin(th));
    return [O, O.map((x, k) => x + OH * (a[k] * CH + b[k] * SHh)), O.map((x, k) => x + OH * (a[k] * CH - b[k] * SHh))]; }
  const a1 = floor(h(4) * 6) * PI / 3, a2 = a1 + 2 * PI / 3, dn = (a) => { const v = [cos(a), -0.2, sin(a)], n = hypot(...v); return v.map((x) => x / n); };
  return [O, O.map((x, k) => x + OH * dn(a1)[k]), O.map((x, k) => x + OH * dn(a2)[k])];
}
// a nucleus of Z protons and N neutrons: as many alpha clusters as it can make, the rest round them
const NUCS = {};
function nucleus(e) {
  if (NUCS[e]) return NUCS[e];
  const [, Z, N] = EL[e], k = min(Z >> 1, N >> 1), out = [], T = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((x) => x / S3));
  const ring = (n, r) => Array.from({ length: n }, (_, i) => [r * cos(2 * PI * i / n), 0, r * sin(2 * PI * i / n)]);
  const fib = (n, r) => Array.from({ length: n }, (_, i) => { const z = 1 - 2 * (i + 0.5) / n, s = sqrt(1 - z * z), a = i * 2.39996; return [r * s * cos(a), r * z, r * s * sin(a)]; });
  const rc = 1.65e-15 * cbrt(k / 4), C = k === 0 ? [] : k === 1 ? [[0, 0, 0]] : k === 3 ? ring(3, rc) : k === 4 ? T.map((v) => v.map((x) => x * rc)) : k === 7 ? [...ring(5, rc), [0, rc, 0], [0, -rc, 0]] : fib(k, rc);
  C.forEach((c, q) => T.forEach((d, m) => out.push({ p: c.map((x, i) => x + d[i] * 0.95e-15 * (q % 2 ? -1 : 1)), proton: m < 2 ? 1 : 0 })));
  const ex = [...Array(Z - 2 * k).fill(1), ...Array(N - 2 * k).fill(0)];
  fib(ex.length, k ? rc + 1.3e-15 : 0).forEach((p, i) => out.push({ p, proton: ex[i] }));
  return (NUCS[e] = out);
}

export const lampK = (S, M) => { const lum = (c) => c ? 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2] : 0, day = lum(S.sunC) * Math.max(M.sunM ? M.sunM[1] : 0, 0) * 0.9 + lum(S.skyC) * 0.6;   // how far short of a dim day the light here falls
  return Math.max(0, 0.55 - day); };
export function mkMicro(gl, prog, PRE) {
  const QV = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const P = prog(QV, PRE + `
in vec2 v; uniform vec3 uR, uU, uF; uniform vec2 uTan;
uniform vec3 uLampC; uniform vec3 uCam, uA, uN, uKey, uC1, uC2, uC3, uBg0, uBg1, uSunM; uniform ivec3 uAid, uEl; uniform vec4 uNu[28], uQ[3], uSea[6];
uniform ivec2 uLB; uniform vec3 uCamL; uniform int uInN, uMat, uMol, uShl, uNn; uniform float uAc, uNs, uRad, uRa, uNr;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
const float A = ${A}, RA = ${RA}, RN = .85, FM = 1e-15, S3 = 1.7320508, OH = ${OH};   // nucleons and quarks are measured in femtometres (metres squared would underflow)
float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hf(int i, int j, int k) { uint h = (uint(i) * 73856093u) ^ (uint(j) * 19349663u) ^ (uint(k) * 83492791u); h ^= h >> 13u; h *= 1540483477u; h ^= h >> 15u; return float(h & 65535u) / 65535.; }
vec2 vorr(vec2 u, out float id, out vec2 rv) { vec2 i = floor(u), f = u - i; float d = 9., d2 = 9.; id = 0.; rv = vec2(0.);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(hs(i + o), hs(i + o + 7.3)) - f; float e = dot(r, r); if (e < d) { d2 = d; d = e; id = hs(i + o + 3.1); rv = r; } else if (e < d2) d2 = e; }
  return vec2(sqrt(d), sqrt(d2)); }
vec2 vor(vec2 u, out float id) { vec2 rv; return vorr(u, id, rv); }
float fin(float L, float fp) { return smoothstep(L * .6, L * .15, fp); }   // a feature L across: there once it spans a few pixels
vec3 dome(vec2 rv, float k) { return normalize(vec3(-rv.x * k, 1., -rv.y * k)); }
float thread(vec2 w, float L, float wd, float fp, float s) { float f = abs(n2(w / L + s) - .5) * L * .9; return smoothstep(wd + fp, wd * .4, f) * fin(wd * 2., fp); }   // a thread along a noise's mid-line
vec3 lit(vec3 a, vec3 n) { return a * (uSunC * max(dot(n, uSunM), 0.) * .9 + uSky * (.42 + .25 * n.y) + uLampC * (max(dot(n, normalize(vec3(.35, 1., .25))), 0.) * .8 + .25)); }   // (and, in the dark, the microscope's own lamp)
vec3 glint(vec3 n, vec3 rd, float p) { return uSunC * pow(max(dot(reflect(rd, n), uSunM), 0.), p) * step(0., uSunM.y); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// atomic steps on a crystal face (and clay platelets), and the first hint of rows of atoms
vec3 steps(vec3 c, vec2 w, float fp, float id) {
  float tid; vec2 t = vor(w / 6e-8 + id * 17., tid); float wv = t.x * .6 + id + .35 * n2(w / 3e-8), ter = floor(wv * 6.);
  float stp = smoothstep(fp * 2., 0., abs(fract(wv * 6.) - .5) * 1e-8) * smoothstep(2e-8, 3e-9, fp) * smoothstep(1e-11, 3e-10, fp);
  return c * (1. - stp * .15) * mix(1., .88 + .12 * hs(vec2(ter, id)), smoothstep(2e-8, 5e-9, fp)); }
// ---- the surfaces, each from millimetres down to where its atoms take over
vec3 sSoil(vec2 w, float fp) {
  float id; vec2 rv, c = vorr(w / 1.4e-3, id, rv); float gap = smoothstep(.16, .02, c.y - c.x);              // crumbs, the pores between them dark
  vec3 n = dome(rv, 1.2), a = uC1 * (.75 + .5 * id) * (1. - gap * .75);
  float gi; vec2 gv, g = vorr(w / 6e-5, gi, gv); float kg = fin(6e-5, fp);                                    // in each crumb: silt grains, quartz light, clay brown, humus dark
  vec3 gc = gi < .3 ? mix(uC3, vec3(.5, .47, .42), .3) : gi < .8 ? uC1 * (.7 + .5 * gi) : uC1 * .3; float gg = max(smoothstep(.36 - fp / 6e-5, .44, length(gv)), smoothstep(.06, .0, g.y - g.x));
  a = mix(a, mix(gc, uC1 * .35, gg * .8) * (1. - gap * .6), kg * .8); n = normalize(mix(n, dome(gv / .4, 1.), kg * .6 * (1. - gg)));   // each grain rounded, set in darker clay
  a = mix(a, vec3(.75, .72, .62), thread(w, 3e-4, 1.5e-6, fp, id * 9.) * .7);                              // fungal hyphae
  float pi; vec2 p = vor(w / 4e-7 + gi * 31., pi); float kp = fin(4e-7, fp);                                 // clay platelets
  a = mix(a, mix(uC1 * 1.3, uC2 * 1.2, pi) * (1. - .45 * smoothstep(.05, 0., p.y - p.x) * smoothstep(4e-8, 1e-8, fp)), kp);
  return lit(steps(a, w, fp, pi), n); }
vec3 sSand(vec2 w, float fp, vec3 rd) {
  bool moon = uMat == 10; float L = moon ? 7e-5 : 3.5e-4, id; vec2 rv, c = vorr(w / L, id, rv); float gr = .36 + .1 * hs(vec2(id * 13.)), gap = max(smoothstep(gr - .03 - fp / L, gr + .02, length(rv)), smoothstep(.06, .0, c.y - c.x));   // each grain rounded, the dark between them
  vec3 a = moon ? (id < .35 ? uC1 * .45 : mix(uC1, uC2, hs(vec2(id * 7.))) * (.8 + .4 * id)) : id < .62 ? mix(uC1, vec3(.62, .58, .5), .3) * 1.15 : id < .76 ? vec3(.55, .36, .28) : id < .88 ? vec3(.05, .05, .055) : vec3(.75, .72, .68);
  vec3 n = dome(rv / gr, 1.1); float sp = id < .62 && !moon ? 1. : moon && id < .35 ? .6 : .2;
  if (moon && id > .9 && c.x < .42) { n = dome(rv / .42, 2.5); a = id > .95 ? vec3(.5, .22, .06) : vec3(.03); sp = 2.; }   // a glass bead from a fire fountain, three billion years ago
  a *= .85 + .3 * n2(w / 6e-6) * fin(6e-6, fp);                                                               // frosted by wind (or by impacts)
  a *= 1. + .1 * (n2(w / 9e-7) - .5) * fin(9e-7, fp);
  if (moon) { float zi; vec2 z = vor(w / 5e-6, zi); float kz = fin(5e-6, fp) * step(.6, zi); a = mix(a, a * .4 + .03, smoothstep(.28, .18, z.x) * kz); a += vec3(.08) * smoothstep(.05, 0., abs(z.x - .3)) * kz; }   // micrometeorite pits, glass-lined
  a *= 1. - gap * .85; vec3 col = lit(a, n) + glint(n, rd, 60.) * .04 * sp * (1. - gap);
  return steps(col, w, fp, id); }
vec3 sRock(vec2 w, float fp, vec3 rd) {
  float id; vec2 c = vor(w / 1.6e-3, id);
  vec3 a = id < .35 ? vec3(.42, .42, .44) : id < .6 ? vec3(.6, .38, .3) : id < .85 ? vec3(.7, .68, .64) : vec3(.04, .035, .03);   // quartz, two feldspars, mica
  a = mix(a, uC1 * 1.6, .45) * (1. - .7 * smoothstep(.03, 0., c.y - c.x)) * (.9 + .2 * n2(w / 2e-4));
  if (id > .35 && id < .85) a *= 1. - .25 * smoothstep(.15, .0, abs(fract(dot(w, vec2(cos(id * 40.), sin(id * 40.))) / 9e-6) - .5)) * fin(9e-6, fp);   // cleavage
  vec3 n = normalize(vec3((n2(w / 3e-5) - .5) * .2, 1., (n2(w / 3e-5 + 5.) - .5) * .2)), col = lit(a, n) + glint(n, rd, 200.) * (id > .85 ? .3 : .03);
  return steps(col, w, fp, id); }
vec3 sWater(vec2 w, float fp, vec3 rd, float tp) {
  vec3 n = normalize(vec3((n2(w / 4e-3 + uT * .3) - .5) * .05, 1., (n2(w / 3.3e-3 - uT * .25) - .5) * .05));
  float fr = .02 + .98 * pow(1. - max(dot(-rd, n), 0.), 5.);
  vec3 refl = mix(uBg0, uBg1, .7) + glint(n, rd, 900.) * 10., rr = refract(rd, n, .75);
  vec3 below = uC1 * 4. * (uSky * .6 + uSunC * max(uSunM.y, 0.) * .5 + uLampC * .6);
  for (int k = 0; k < 3; k++) {                                                                                 // diatoms, at three depths, seen through the surface
    float D = k == 0 ? 1.5e-4 : k == 1 ? 5e-4 : 1.2e-3, Lc = 2.2e-4 + float(k) * 1.6e-4; vec2 q = w + rr.xz / max(-rr.y, .15) * D + float(k) * 3.7e-3;
    vec2 ci = floor(q / Lc); if (hs(ci + float(k) * 13.1) > .55) continue;
    vec2 d = rot(hs(ci + 5.3) * 6.2832) * (q - (ci + .5 + (vec2(hs(ci + 1.7), hs(ci + 2.9)) - .5) * .4) * Lc); float fpD = (tp + D * 1.33) * uPix, cov = 0.; vec3 dc = vec3(0.);
    if (hs(ci + 8.1) < .45) { float R = 2e-5 + 4e-5 * hs(ci + 4.4), r = length(d) / R; if (r < 1.) { float th = atan(d.y, d.x); cov = smoothstep(1., .9, r);   // centric: a pillbox of silica, ribbed from its centre
        float rib = .5 + .5 * cos(th * 40.) * smoothstep(.15, .4, r) * fin(R * .15, fpD); dc = mix(vec3(.38, .28, .07), vec3(.55, .5, .35), rib * .5) * (1. - .4 * smoothstep(.5, .2, r) * fin(R * .3, fpD)) + vec3(.35) * smoothstep(.85, 1., r); } }
    else { vec2 e = d / vec2(4.5e-5 + 6e-5 * hs(ci + 4.4), 1.1e-5); float r = length(e); if (r < 1.) { cov = smoothstep(1., .9, r);   // pennate: a boat, ribbed across, its raphe slit down the middle
        float rib = .5 + .5 * cos(d.x / 1.2e-6 * 6.2832) * fin(1.5e-6, fpD); dc = mix(vec3(.36, .27, .06), vec3(.55, .5, .35), rib * .5) * (1. - .6 * smoothstep(.06, .02, abs(e.y)) * step(abs(e.x), .85) * fin(2e-6, fpD)) + vec3(.35) * smoothstep(.85, 1., r); } }
    below = mix(below, dc * 1.6 * (uSky * .7 + uSunC * max(uSunM.y, 0.) * .8), cov * .9 * exp(-D / 6e-3) * smoothstep(Lc * 2., Lc * .2, fpD)); }
  return mix(below, refl, fr); }
vec3 sSnow(vec2 w, float fp, vec3 rd) {
  float gi; vec2 gv, g = vorr(w / 4e-4, gi, gv);                                                               // old snow: rounded grains
  float gg = max(smoothstep(.4 - fp / 4e-4, .47, length(gv)), smoothstep(.06, .0, g.y - g.x)); vec3 n = dome(gv / .45, .9), a = vec3(.8, .84, .9) * (1. - .5 * gg); float ice = 1e9, ridge = 0.;
  vec2 ci = floor(w / 2.4e-3); for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 cc = ci + vec2(x, y); if (hs(cc + 3.3) > .7) continue;
    float R = 1.e-3 * (.6 + .5 * hs(cc + 1.1)); vec2 p = rot(hs(cc + 2.2) * 6.2832) * (w - (cc + .5 + (vec2(hs(cc + 4.1), hs(cc + 5.2)) - .5) * .5) * 2.4e-3);
    float r = length(p), an = mod(atan(p.y, p.x) + .5236, 1.0472) - .5236; vec2 q = r * vec2(cos(abs(an)), sin(abs(an)));   // folded into one twelfth: an arm along x
    if (r > R * 1.05) continue; float wd = R * .045 * (1. - .5 * q.x / R), dd = q.x < R ? q.y - wd : length(q - vec2(R, 0.)) - wd;
    if (hs(cc + 7.7) < .25) dd = r * cos(.5236 - abs(an)) - R * .7;                                         // or a plate, six-sided
    else { dd = min(dd, r * cos(.5236 - abs(an)) - R * .16); for (int k = 1; k <= 4; k++) { float bx = R * (.18 + .17 * float(k)), L = R * .38 * (1. - float(k) * .17); vec2 bd = vec2(.5, .866), s = q - vec2(bx, 0.); float t = clamp(dot(s, bd), 0., L); dd = min(dd, length(s - bd * t) - wd * .7 * (1. - t / L * .5)); } }
    if (dd < ice) { ice = min(ice, dd); ridge = smoothstep(wd * .3, 0., abs(q.y)) * step(q.x, R); } }
  float inC = smoothstep(fp, -fp, ice);
  vec3 ic = vec3(.72, .8, .92) * (1. + .5 * ridge) + vec3(.15) * smoothstep(-2e-5, 0., ice);                 // ice: clear, its edges and the ridge down each arm bright
  a = mix(a, ic, inC); n = normalize(mix(n, vec3(0., 1., 0.), inC));
  a *= 1. - .08 * smoothstep(.2, .0, abs(fract(n2(w / 8e-7) * 5.) - .5)) * fin(8e-7, fp);                     // growth layers on the faces
  vec3 col = lit(a, n) + glint(n, rd, 300.) * (.08 + .3 * inC);
  return steps(col, w, fp, gi); }
vec3 sLeaf(vec2 w, float fp, vec3 rd) {
  bool nd = uMat == 7, dead = uMat == 9; vec3 g = uC1 * 1.8; vec2 u = nd ? vec2(w.x * .3, w.y) : w;
  // veins: the areoles between them (broad leaves), or ridges along a needle; then the epidermis, jigsaw cells
  float vi; vec2 vc = vor(w / 1.3e-3, vi), vc2 = vor(w / 6e-3 + 3., vi);
  float vein = nd ? smoothstep(.05, .0, abs(fract(w.y / 4e-4) - .5) * 4e-4 - 2e-5) * .5 : max(smoothstep(.05, .02, vc.y - vc.x), smoothstep(.06, .03, vc2.y - vc2.x));
  vec2 uj = u + 1.1e-5 * (vec2(n2(u / 1.4e-5), n2(u / 1.4e-5 + 7.)) - .5) + 3e-6 * vec2(sin(u.y / 2.2e-6), sin(u.x / 2.2e-6)) * fin(1.4e-5, fp);   // pavement cells: their walls wave, jigsaw-like
  float ci; vec2 rv, cc = vorr(uj / 4e-5, ci, rv); float kc = fin(4e-5, fp), wall = smoothstep(.05 + fp / 4e-5, .015, cc.y - cc.x) * kc;
  // through the clear epidermis, a cell's depth below: the palisade, packed with chloroplasts
  vec2 q = w + rd.xz / max(-rd.y, .2) * 1.6e-5; float pk; vec2 pc = vor(q / 5e-6, pk), pal = vor(q / 1.8e-5 + 7., pk);
  float chl = smoothstep(.48, .3, pc.x) * fin(5e-6, fp) * (1. - smoothstep(.06, .0, pal.y - pal.x) * .8) * smoothstep(5e-8, 2e-6, uCam.y);   // (out of focus, and then lost, from very close)
  vec3 a = mix(g, mix(g * vec3(.75, .8, .6), g * vec3(1.15, 1.3, .9), chl), kc) * (1. + vein * .45) * (.92 + .16 * ci * kc);   // chloroplasts green, the gaps between them paler and duller
  a = mix(a, g * vec3(1.25, 1.25, 1.1) + .01, wall * .55); a *= 1. - .3 * wall * smoothstep(.0, .3, 1. - abs(cc.y - cc.x - .03) * 30.);
  vec3 n = normalize(mix(vec3(0., 1., 0.), dome(rv, .5), kc));
  // stomata: two guard cells round a pore (on a needle in rows, and plugged with wax)
  float Ls = nd ? 7e-5 : 1.2e-4; vec2 sc = nd ? vec2(floor(w.x / Ls), floor(w.y / 1.6e-4)) : floor(w / Ls); bool has = nd ? mod(sc.y, 3.) < 1. : hs(sc + 2.1) < .55;
  if (has) { vec2 c0 = nd ? vec2((sc.x + .5) * Ls, (sc.y + .5) * 1.6e-4) : (sc + .3 + .4 * vec2(hs(sc), hs(sc + 9.))) * Ls; vec2 d = nd ? w - c0 : rot(hs(sc + 4.) * 3.1416) * (w - c0);
    float er = length(d / vec2(1.5e-5, 1.05e-5)), ks = fin(1.5e-5, fp);
    if (er < 1.15) { float pore = smoothstep(1.6e-6 + fp, .8e-6, abs(d.y) / max(1. - pow(d.x / 1.05e-5, 2.), .05)) * step(abs(d.x), 1.05e-5);
      vec3 gcol = g * (1.2 + .5 * smoothstep(1., .3, er)) * (1. - .6 * smoothstep(.95, 1.1, er));
      if (nd) gcol = mix(gcol, vec3(.75, .78, .74), smoothstep(.7, .4, er));                                 // the wax plug
      else gcol = mix(gcol, vec3(.01, .015, .01), pore * smoothstep(.9, .7, er));
      a = mix(a, gcol, ks * smoothstep(1.15, 1., er)); n = normalize(mix(n, dome(d / 1.5e-5, .8), ks * step(er, 1.))); } }
  if (dead) { a = mix(a, a * .6, chl * .5); a = mix(a, vec3(.78, .75, .66), max(thread(w, 4e-4, 1.6e-6, fp, 3.), thread(w * 1.3, 2.5e-4, 1.2e-6, fp, 7.)) * .85); }   // a fallen leaf: hyphae across it
  float wi; vec2 wr, wx = vorr(w / 7e-7, wi, wr); float kw = fin(4e-7, fp), an = wi * 9.;                       // epicuticular wax: flakes and rodlets standing on the cuticle
  vec2 fq = rot(an) * wr; float fk = step(nd ? .3 : .55, wi) * smoothstep(.06, .03, abs(fq.y)) * smoothstep(.34, .3, abs(fq.x));
  a = mix(a, vec3(.75, .78, .74), fk * kw * .8); a = mix(a, a * .8 + vec3(.06, .07, .06), kw * .35);
  vec3 col = lit(a, n) + glint(n, rd, 40.) * (.05 + kw * .1);
  col += a * (uSunC * abs(uSunM.y) * .35 + uSky * .25 + uLampC * .2);                                                         // and light through it: a leaf is thin
  return col; }
vec3 sBark(vec2 w, float fp, vec3 rd) {
  vec3 b = uC1; float rid = n2(vec2(w.x / 2.5e-3, w.y / 1.1e-2)) * .5 + n2(w / 7e-4) * .3 + n2(w / 1.5e-4) * .2, fur = smoothstep(.3, .62, rid);
  vec3 a = mix(b * .35, b * 1.05, fur), n = normalize(vec3((n2(vec2(w.x / 2.5e-3 + .01, w.y / 1.1e-2)) - n2(vec2(w.x / 2.5e-3, w.y / 1.1e-2))) * 60. + (n2(w / 1.5e-4 + .03) - n2(w / 1.5e-4)) * 6., 1., (n2(w / 7e-4 + .01) - n2(w / 7e-4)) * 30.));
  float fi; vec2 fl = vor((w + 2.5e-4 * (vec2(n2(w / 4e-4), n2(w / 4e-4 + 3.)) - .5)) / vec2(6e-4, 1.4e-3), fi); a *= (.88 + .24 * fi) * (1. - .3 * smoothstep(.04, .0, fl.y - fl.x) * fin(4e-5, fp));   // flakes of dead bark, cracked apart
  float li = smoothstep(.62, .68, n2(w / 5e-3 + 4.));                                                         // lichen: a crust, and its fruiting discs
  if (li > 0.) { float di; vec2 dc = vor(w / 7e-4, di); a = mix(a, vec3(.34, .37, .27) * (.85 + .3 * n2(w / 4e-5)), li * .9); a = mix(a, vec3(.25, .18, .08), li * smoothstep(.3, .22, dc.x) * step(.6, di)); }
  // cork: dead cells, flattened polygons in radial rows, their walls a little paler, their insides hollow
  vec2 cu = vec2(w.x / 3.6e-5, w.y / 1.8e-5 + .35 * n2(w / 2e-4)); float ci; vec2 cr, cc = vorr(cu, ci, cr);
  float kc = fin(2e-5, fp), wall = smoothstep(.09 + fp / 2e-5, .03, cc.y - cc.x);
  vec3 cork = b * mix(.55 + .35 * ci - .25 * smoothstep(.2, .6, length(cr)), 1.15, wall);
  a = mix(a, mix(a * cork / max(b, vec3(.01)), a, li * .7), kc * .8); n = normalize(mix(n, dome(cr, .35), kc * (1. - wall)));
  float ang = ci * .8 - .4, fb = dot(w, vec2(cos(ang), sin(ang)));                                             // the wall's cellulose: fibrils in bundles
  a *= 1. - .18 * (.5 + .5 * sin(fb / 3e-8 * 6.2832 + n2(w / 1e-7) * 3.)) * fin(3e-8, fp) - .1 * (.5 + .5 * sin(fb / 4e-9 * 6.2832)) * fin(4e-9, fp);
  return lit(a, n) + glint(n, rd, 20.) * .02; }
vec3 surface(vec2 w, float fp, vec3 rd, float tp) {
  return uMat == 2 ? sWater(w, fp, rd, tp) : uMat == 3 ? sSnow(w, fp, rd) : uMat == 4 || uMat == 10 ? sSand(w, fp, rd) : uMat == 5 ? sRock(w, fp, rd) : uMat >= 6 && uMat <= 7 || uMat == 9 ? sLeaf(w, fp, rd) : uMat == 8 ? sBark(w, fp, rd) : sSoil(w, fp); }
// ---- the atoms near p: distance to the nearest surface, its colour and centre
vec3 lay(int l) { return l == 0 ? vec3(0., -RA, 0.) : l == 1 ? vec3(A / 2., -RA * 1.55, A / (2. * S3)) : vec3(A / 2., -RA * 2.6, -A / (2. * S3)); }
vec3 elC(int e) { return e == 1 ? vec3(.9, .9, .92) : e == 6 ? vec3(.2, .2, .22) : e == 8 ? vec3(.86, .26, .2) : e == 13 ? vec3(.62, .66, .78) : vec3(.86, .72, .42); }
void mol(int l, ivec2 ij, out vec3 m0, out vec3 m1, out vec3 m2) {   // a water molecule: its oxygen, and two hydrogens 0.96 Å off at 104.5°
  vec3 L = lay(l), O = vec3((float(ij.x) + float(ij.y) / 2.) * A + L.x, L.y, float(ij.y) * A * S3 / 2. + L.z); int k0 = l * 16; ij += uLB;   // (positions from the local lattice, which atom it is from the whole)
  if (uMol == 1) { O += vec3((hf(ij.x, ij.y, k0 + 1) - .5) * .5 * A, (hf(ij.x, ij.y, k0 + 2) - .5) * .6 * RA, (hf(ij.x, ij.y, k0 + 3) - .5) * .5 * A);
    float z = 2. * hf(ij.x, ij.y, k0 + 4) - 1., ph = 6.2831853 * hf(ij.x, ij.y, k0 + 5), s = sqrt(max(0., 1. - z * z)); vec3 a = vec3(s * cos(ph), z, s * sin(ph));
    vec3 b0 = normalize(cross(a, abs(a.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.))); float th = 6.2831853 * hf(ij.x, ij.y, k0 + 6); vec3 b = b0 * cos(th) + cross(a, b0) * sin(th);
    m0 = O; m1 = O + OH * (a * .6122 + b * .7907); m2 = O + OH * (a * .6122 - b * .7907); }
  else { float a1 = floor(hf(ij.x, ij.y, k0 + 4) * 6.) * 1.0471976, a2 = a1 + 2.0943951; m0 = O; m1 = O + OH * normalize(vec3(cos(a1), -.2, sin(a1))); m2 = O + OH * normalize(vec3(cos(a2), -.2, sin(a2))); } }
float atoms(vec3 p, out vec3 col, out vec3 nc) {
  float best = 1e9; col = vec3(0.); nc = vec3(0.);
  if (uMol > 0) { for (int l = 0; l < 3; l += 2) { vec3 L = lay(l); vec2 q = p.xz - L.xz; float vv = q.y / (A * S3 / 2.), uu = q.x / A - vv / 2.; ivec2 b = ivec2(floor(vec2(uu, vv)));
      for (int k = 0; k < 4; k++) { ivec2 ij = b + ivec2(k & 1, k >> 1); vec3 m[3]; mol(l, ij, m[0], m[1], m[2]);
        for (int a = 0; a < 3; a++) { if (ivec3(l * 4 + a, ij + uLB) == uAid && uAc > .5) continue; float d = length(p - m[a]) - (a == 0 ? RA * .9 : RA * .55); if (d < best) { best = d; nc = m[a]; col = elC(a == 0 ? 8 : 1); } } } }
    return best; }
  for (int l = 0; l < 3; l++) { vec3 L = lay(l); vec2 q = p.xz - L.xz; float vv = q.y / (A * S3 / 2.), uu = q.x / A - vv / 2.; vec2 b = floor(vec2(uu, vv)); vec3 h = vec3(1e9); ivec2 id = ivec2(0);
    for (int k = 0; k < 4; k++) { vec2 ij = b + vec2(k & 1, k >> 1), c = vec2((ij.x + ij.y / 2.) * A, ij.y * A * S3 / 2.); float d = length(q - c); if (d < h.z) { h = vec3(c + L.xz, d); id = ivec2(ij); } }
    id += uLB; if (ivec3(l * 4, id) == uAid && uAc > .5) continue; int e = uEl[l]; if (e == 13 && hf(id.x, id.y, l * 16) >= .35) e = 14;
    float r = (e == 1 || l == 1 ? .55 : e == 6 ? .85 : 1.) * RA, d = length(vec3(p.x - h.x, p.y - L.y, p.z - h.y)) - r;
    if (d < best) { best = d; nc = vec3(h.x, L.y, h.y); col = elC(e) * (.9 + .2 * hf(id.x, id.y, l * 16 + 1)); } }
  return best; }
vec2 sph(vec3 c, vec3 rd, float r) { float b = dot(c, rd), cc = dot(c, c) - r * r, d = b * b - cc; if (d < 0.) return vec2(1e30, -1e30); d = sqrt(d); return vec2(b - d, b + d); }   // sphere at c from the camera
float glowPt(vec3 c, vec3 rd, float pix, out float tc) { tc = dot(c, rd); if (tc <= 0.) return 0.; float dp = length(c - rd * tc), th = dp / tc; return exp(-th * th / (pix * pix) * 1.5); }
void main() {
  vec2 s = (v * 2. - 1.) * uTan; vec3 rd = normalize(uF + uR * s.x + uU * s.y); float pix = uPix;
  vec3 col = vec3(0.); float dist = 1e12;
  vec3 key = uKey, bg = mix(uBg0, uBg1, v.y);                                 // beyond the surface: the world, out of focus
  // ---- the surface: a plane at y = 0 (the tops of the atoms), shaded from millimetres down to rows of atoms
  float tp = rd.y < 0. && uCam.y > 0. ? uCam.y / -rd.y : -1.; vec3 gcol = vec3(0.); float gd = 1e12;
  if (tp > 0.) { vec2 w = uCam.xz + rd.xz * tp; float fp = tp * pix, rr = length(w) / uRad;
    if (rr < 1.) { gcol = surface(w, fp, rd, tp);
      if (fp < A * .5) { vec2 hid, w = uCamL.xz + rd.xz * tp; float vv = w.y / (A * S3 / 2.), uu = w.x / A - vv / 2.; vec2 b = floor(vec2(uu, vv)); float dm = 1e9; for (int k = 0; k < 4; k++) { vec2 ij = b + vec2(k & 1, k >> 1); dm = min(dm, length(w - vec2((ij.x + ij.y / 2.) * A, ij.y * A * S3 / 2.))); }
        gcol *= 1. + smoothstep(RA * .9, RA * .3, dm) * smoothstep(A * .5, A * .2, fp) * .4; }
      gcol = mix(gcol, bg, smoothstep(.85, 1., rr)); gd = rr < .95 ? tp : 1e12; } else tp = -1.; }
  // close enough to see atoms: march them (they fade in as they grow bigger than a few pixels)
  float wAt = 0.; vec3 acol = vec3(0.); float ad = 1e12, top = RA * .75;
  float tA0 = uCam.y > top ? (rd.y < 0. ? (uCam.y - top) / -rd.y : 1e30) : 0.;
  if (tA0 < 1e29 && tA0 * pix < A * .7) {
    float t = tA0; vec3 cc, nc; bool hit = false;
    for (int i = 0; i < 64; i++) { vec3 p = uCamL + rd * t; if (p.y > top && rd.y > 0.) break; float d = atoms(p, cc, nc); if (d < t * pix * .5) { hit = true; break; } t += max(d, t * pix * .2); if (t > tA0 + A * 30.) break; }
    if (hit) { vec3 p = uCamL + rd * t, n = normalize(p - nc); float dif = max(dot(n, key), 0.), rim = pow(1. - max(dot(n, -rd), 0.), 2.5), k = smoothstep(6e-11, 1.5e-11, t * pix);
      acol = mix(gcol * (.55 + .7 * dif), cc * (.25 + .75 * dif) + mix(cc, vec3(1.), .5) * rim * .6, k);   // the elements' colours only once each atom is many pixels
      ad = t; wAt = smoothstep(A * .7, A * .15, t * pix); } }
  if (tp > 0. || wAt > 0.) { col = mix(gcol, acol, wAt); dist = wAt > .5 ? ad : gd; } else col = bg;
  float lv = smoothstep(2e-11, 1.1e-10, length(uA)); col = mix(vec3(.012, .016, .04), col, lv);   // deep inside an atom its neighbours are lost in its own cloud
  // ---- the atom you are in or beside: its electrons as a cloud round a point of a nucleus
  if (uAc > 0.) { vec2 ts = sph(uA, rd, uRa * 2.2); float t0 = max(ts.x, 0.), t1 = min(ts.y, dist);
    if (t1 > t0) { float dt = (t1 - t0) / 32., j = hs(gl_FragCoord.xy); vec3 acc = vec3(0.); float T = 1.;
      for (int i = 0; i < 32; i++) { vec3 q = rd * (t0 + (float(i) + j) * dt) - uA; float r = length(q) / uRa, ang = dot(normalize(q + 1e-30), normalize(vec3(sin(uT * .2), cos(uT * .13), .4)));
        float rho = uShl == 1 ? exp(-r / .3) * 4. : exp(-r / .12) * 6. + exp(-r / .45) * (.25 + 1.1 * ang * ang) * 1.6 + exp(-abs(r - .9) * 8.) * .25 + (uShl > 2 ? exp(-abs(r - 1.3) * 6.) * .35 : 0.);   // 1s; 2s and 2p; 3s and 3p
        float a = 1. - exp(-rho * dt / uRa * .35); acc += T * a * mix(vec3(.3, .45, .95), vec3(.8, .7, .9), smoothstep(.5, .05, r)); T *= 1. - a * .6; }
      col = col * mix(1., T, uAc) + acc * uAc * .6; }
    float tn = dot(uA, rd), nr = uNr / max(length(uA), 1e-30), dp = tn > 0. ? length(uA - rd * tn) / tn : 1e9, sz = max(nr, pix);
    float g = exp(-dp * dp / (sz * sz) * 1.5) * (1. - uNs); col += vec3(1., .9, .75) * g * 3. * uAc; if (g > .3) dist = min(dist, tn); }
  // ---- the nucleus: its nucleons, protons warmer, neutrons cooler; the one you are in is drawn from inside
  if (uNs > 0.) { float best = 1e30; vec3 nc2 = vec3(0.), ncl = vec3(0.);
    for (int i = 0; i < 28; i++) { if (i >= uNn) break; if (i == uInN) continue; vec2 t = sph(uNu[i].xyz, rd, RN); if (t.x > 0. && t.x < best) { best = t.x; nc2 = uNu[i].xyz; ncl = uNu[i].w > .5 ? vec3(1., .45, .35) : vec3(.55, .65, .85); } }
    if (best < 1e29) { vec3 n = normalize(rd * best - nc2); float dif = max(dot(n, key), 0.), rim = pow(1. - max(dot(n, -rd), 0.), 2.);
      col = mix(col, ncl * (.3 + .7 * dif) + ncl * rim * .8 + vec3(.05), uNs); dist = min(dist, best * FM); } }
  // ---- inside a nucleon: a faint skin, three quarks, the gluon field binding them, and pairs flickering
  if (uInN >= 0) { vec3 c = uN; vec2 ts = sph(c, rd, RN); float inside = length(c) < RN ? 1. : 0.;
    col = mix(col, vec3(.03, .02, .05), smoothstep(RN * 1.4, RN * .5, length(c)) * .9);   // inside a proton, the rest of the nucleus is only a glow through its skin
    if (ts.y > 0.) { float th = inside > .5 ? ts.y : ts.y - max(ts.x, 0.); col = col * exp(-th / RN * .6) + vec3(.12, .08, .16) * (1. - exp(-th / RN * .8)) * .6;
      if (inside < .5) col += vec3(.6, .4, .8) * pow(1. - abs(dot(normalize(rd * max(ts.x, 0.) - c), rd)), 3.) * .4; }
    vec3 jn = (uQ[0].xyz + uQ[1].xyz + uQ[2].xyz) / 3.;
    for (int i = 0; i < 3; i++) { vec3 a = uQ[i].xyz; float best = 1e30, bt = 0.;     // flux tubes, from each quark to where they meet
      for (int k = 0; k <= 12; k++) { float tt = float(k) / 12.; vec3 pq = mix(a, jn, tt); float tq = dot(pq, rd); if (tq <= 0.) continue; float d = length(pq - rd * tq) / tq; if (d < best) { best = d; bt = tt; } }
      float dd = length(mix(a, jn, bt)), w = RN * .11 / max(dd, 1e-30); col += vec3(1., .85, .6) * exp(-best * best / (w * w + pix * pix)) * .3 * (.7 + .3 * sin(uT * 3. + bt * 20.)) * min(1., dd * dd / (RN * RN * .03)); }
    for (int i = 0; i < 3; i++) { float tq; float g = glowPt(uQ[i].xyz, rd, pix, tq); vec3 qc = i == 0 ? vec3(1., .25, .2) : i == 1 ? vec3(.25, 1., .3) : vec3(.3, .45, 1.);
      float dp = tq > 0. ? length(uQ[i].xyz - rd * tq) : 1e30; float hk = min(1., tq * tq / (RN * RN * .02)); col += qc * (g * 6. + (exp(-dp * dp / (RN * RN * .01)) * 1.2 + exp(-dp * dp / (RN * RN * .12)) * .06) * hk); /* however close you come, a quark stays a point */ if (g > .3) dist = min(dist, tq * FM); }
    for (int i = 0; i < 6; i++) { float tq; float g = glowPt(uSea[i].xyz, rd, pix, tq); col += vec3(.8, .8, 1.) * g * uSea[i].w; }
  }
  oC = vec4(col, 1.); oD = vec4(dist, 0, 0, 1); gl_FragDepth = 1.;
}`);
  const vq = gl.createVertexArray();
  const M = { on: false, P: [0, 0, 0], s: 1e-6, F0: null, anchor: null, att: null, mat: 1, top: MICRO, sunM: [0, 1, 0] };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  // the atom nearest p, of this material (centre, distance, which, element)
  function nearest(p) {
    const m = MATS[M.mat] || MATS[1]; let at = null;
    const take = (c, id, el) => { const d = hypot(...sub(c, p)); if (!at || d < at.d) at = { c, d, id, el }; };
    if (m.mol) { for (const l of [0, 2]) for (const h of hexCands(p[0] - LAY[l][0], p[2] - LAY[l][2])) mol(l, h.i, h.j, m.mol === 1).forEach((c, k) => take(c, [l * 4 + k, h.i, h.j], k ? 1 : 8)); }
    else LAY.forEach(([ox, y, oz], l) => { const hs = hexCands(p[0] - ox, p[2] - oz).map((h) => ({ ...h, d: hypot(p[0] - ox - h.cx, p[2] - oz - h.cz) })).sort((a, b) => a.d - b.d)[0];
      let el = m.el[l]; if (el === 13 && hf(hs.i, hs.j, l * 16) >= 0.35) el = 14; take([hs.cx + ox, y, hs.cz + oz], [l * 4, hs.i, hs.j], el); });
    return at;
  }
  // the atom nearest the camera, its nucleons as they jostle, the nucleon nearest, and its quarks
  function scene(t) {
    const p = M.P, at = nearest(p), r = t * 0.05, cr = cos(r), sr = sin(r);
    const nu = nucleus(at.el).map((n, i) => { const q = n.p, j = 0.12e-15; return { c: [at.c[0] + cr * q[0] - sr * q[2] + j * sin(t * 1.3 + i), at.c[1] + q[1] + j * sin(t * 1.7 + i * 2), at.c[2] + sr * q[0] + cr * q[2] + j * cos(t * 1.1 + i)], proton: n.proton }; });
    let nn = 0; nu.forEach((n, i) => { if (hypot(...sub(n.c, p)) < hypot(...sub(nu[nn].c, p))) nn = i; });
    const N = nu[nn], q = [0, 1, 2].map((k) => { const a = t * 0.7 + k * 2.094, b = t * 0.53 + k * 1.3; return [N.c[0] + RN * 0.42 * cos(a), N.c[1] + RN * 0.42 * sin(a) * cos(b), N.c[2] + RN * 0.42 * sin(a) * sin(b)]; });
    return { at, nu, nn, q };
  }
  let last = null, look = { c1: [0.1, 0.1, 0.1], c2: [0.1, 0.1, 0.1], c3: [0.1, 0.1, 0.1], bg0: [0.05, 0.05, 0.05], bg1: [0.2, 0.2, 0.25] };
  return {
    M, MICRO, ENT, MATS,
    // come down to a point: anchor (planet), frame rows (planet), the camera from the anchor in that frame, which
    // surface, the scale at which to give back, and its colours and the blurred world round it
    enter(anchor, F, P, mat, top, lk) { M.on = true; M.anchor = anchor; M.F0 = F; M.P = P.slice(); M.s = hypot(...P); M.att = null; M.mat = MATS[mat] ? mat : 1; M.top = top; last = null; if (lk) look = lk; },
    exitTo() { M.on = false; return M.P; },                                // where the camera is, relative to the anchor in its frame
    // riding along: when close to a nucleon or quark, the camera moves with it
    ride(t) { const S = scene(t); if (last && M.att) { const a = M.att === 'nucleon' ? S.nu[last.nn]?.c : M.att === 'quark' ? S.q[last.k] : null, b = M.att === 'nucleon' ? last.nu[last.nn]?.c : M.att === 'quark' ? last.q[last.k] : null; if (a && b) M.P = M.P.map((v, i) => v + a[i] - b[i]); }
      const S2 = scene(t); S2.k = last && last.k !== undefined ? last.k : 0; last = S2; return S2; },
    target(S) {                                                            // what a step in is aimed at, at this scale
      if (M.s > 1.5e-9) return null;
      if (M.s > 2e-14) return { c: S.at.c, att: null };
      if (M.s > 6e-16) return { c: S.nu[S.nn].c, att: 'nucleon' };
      let k = 0; S.q.forEach((q, i) => { if (hypot(...sub(q, M.P)) < hypot(...sub(S.q[k], M.P))) k = i; }); last.k = k; return { c: S.q[k], att: 'quark' };
    },
    // in words: what is in view, this wide
    label(w) {
      const m = MATS[M.mat] || MATS[1], b = m.b.find((x) => w >= x[0]); if (b) return b[1];
      const at = last ? last.at : null, el = at ? EL[at.el][0] : 'an', N = last ? last.nu[last.nn] : null;
      if (w >= 3e-10) return m.mol ? (m.mol === 2 ? 'molecules of water, in ice' : 'molecules of water') : m.on === 'leaf' || m.on === 'needle' ? 'carbon and hydrogen' : m.on === 'bark' || m.on === 'fallen leaf' ? 'carbon, hydrogen and oxygen' : 'oxygen and silicon';
      if (w >= 5e-11) return `an atom of ${el}`;
      if (w >= 2e-14) return `inside an atom of ${el}`;
      if (w >= 2e-15) return at && at.el === 1 ? 'a hydrogen nucleus: one proton' : `a ${el} nucleus, ${nucleus(at.el).length} nucleons`;
      if (w >= 3e-16) return N && !N.proton ? 'a neutron' : 'a proton';
      return 'quarks and gluons';
    },
    render(common, cam, G, S, W, H) {
      M.fr = (M.fr || 0) + 1; const t = (performance.now() / 1000), Sc = this.ride(t), p = M.P, m = MATS[M.mat] || MATS[1];
      gl.useProgram(P.p); common(P);
      const d = [cos(cam.pitch) * sin(cam.yaw), sin(cam.pitch), cos(cam.pitch) * cos(cam.yaw)], l = hypot(d[0], d[2]) || 1, r = [-d[2] / l, 0, d[0] / l], u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]], tn = Math.tan(cam.fov / 2);
      gl.uniform3fv(P.uR, r); gl.uniform3fv(P.uU, u); gl.uniform3fv(P.uF, d); gl.uniform2fv(P.uTan, [tn * W / H, tn]);
      gl.uniform3fv(P.uCam, p); { const v = floor(p[2] / (A * S3 / 2)), u0 = floor(p[0] / A - v / 2); gl.uniform2i(P.uLB, u0, v); gl.uniform3fv(P.uCamL, [p[0] - (u0 + v / 2) * A, p[1], p[2] - v * A * S3 / 2]); }   // (the camera from the lattice cell it is over, exact)
      gl.uniform1i(P.uMat, M.mat); gl.uniform1i(P.uMol, m.mol || 0); gl.uniform3iv(P.uEl, m.el || [8, 8, 8]); gl.uniform1f(P.uRad, m.r || 1e9);
      gl.uniform3fv(P.uC1, look.c1); gl.uniform3fv(P.uC2, look.c2); gl.uniform3fv(P.uC3, look.c3); gl.uniform3fv(P.uBg0, look.bg0); gl.uniform3fv(P.uBg1, look.bg1); gl.uniform3fv(P.uSunM, M.sunM);
      gl.uniform3fv(P.uKey, [0.45, 0.8, 0.4].map((v) => v / 1.03));
      gl.uniform3fv(P.uLampC, [1, 0.93, 0.8].map((v) => v * lampK(S, M)));
      const at = Sc.at, ac = min(1, max(0, (1.2e-9 - at.d) / 8e-10)); gl.uniform1f(P.uAc, ac); gl.uniform3fv(P.uA, sub(at.c, p)); gl.uniform3i(P.uAid, ...at.id);
      gl.uniform1f(P.uRa, at.el === 1 ? 0.55 * RA : at.el === 6 ? 0.85 * RA : RA); gl.uniform1i(P.uShl, ESH(at.el)); gl.uniform1f(P.uNr, at.el === 1 ? 1e-15 : 3e-15 * cbrt(Sc.nu.length / 16));
      const ns = min(1, max(0, (2e-13 - at.d) / 1.5e-13)); gl.uniform1f(P.uNs, ns);
      const fm = (v) => v.map((x) => x * 1e15), Nu = new Float32Array(112); Sc.nu.forEach((n, i) => Nu.set([...fm(sub(n.c, p)), n.proton], i * 4)); gl.uniform4fv(P.uNu, Nu); gl.uniform1i(P.uNn, Sc.nu.length);
      const inN = hypot(...sub(Sc.nu[Sc.nn].c, p)) < RN * 3 ? Sc.nn : -1; gl.uniform1i(P.uInN, ns > 0.5 ? inN : -1); gl.uniform3fv(P.uN, fm(sub(Sc.nu[Sc.nn].c, p)));
      const Q = new Float32Array(12); Sc.q.forEach((q, i) => Q.set([...fm(sub(q, p)), 1], i * 4)); gl.uniform4fv(P.uQ, Q);
      const SE = new Float32Array(24), f = floor(t * 3); for (let i = 0; i < 6; i++) { const h = (k) => { const x = Math.sin((f * 7.13 + i * 3.7 + k) * 12.9898) * 43758.5453; return x - floor(x); }, c = Sc.nu[Sc.nn].c; SE.set([...fm([c[0] + (h(1) - 0.5) * RN * 1.4 - p[0], c[1] + (h(2) - 0.5) * RN * 1.4 - p[1], c[2] + (h(3) - 0.5) * RN * 1.4 - p[2]]), 0.6 * sin(PI * (t * 3 - f))], i * 4); }
      gl.uniform4fv(P.uSea, SE);
      gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3);
      return Sc;
    },
  };
}
