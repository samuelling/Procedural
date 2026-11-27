// What lies on the ground, band by band down the scales: plants (grass in the open, ferns under trees) every 35 cm;
// fallen leaves every 7 cm; stones every 2 cm; grains of soil every half millimetre; silt and clay, tens of
// micrometres. Each band is a lattice fixed to the planet (on the cube face under the camera) and drawn round the eye,
// so a grain is always where it was; each fades in as it grows big enough to see and out as it shrinks below a pixel.
// Their colours are the planet's: its grass, its fallen leaves, its rock and sand.
import { LEAFFACE } from './shade.js';
import { AX, RIVD, climate } from './planet.js';

export function mkCover(gl, prog, PRE) {
  const { floor, max, min, abs } = Math;
  const stone = (() => {                                                   // a rough stone: a subdivided icosahedron
    const t = (1 + Math.sqrt(5)) / 2, nz = (v) => { const l = Math.hypot(...v); return v.map((q) => q / l); }, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nz);
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const md = (a, b) => nz(a.map((q, i) => q + b[i])), o = [];
    for (const [a, b, c] of F) { const A = V[a], B = V[b], C = V[c], ab = md(A, B), bc = md(B, C), ca = md(C, A); for (const tt of [[A, ab, ca], [ab, B, bc], [ca, bc, C], [ab, bc, ca]]) for (const v of tt) o.push(...v); }
    return new Float32Array(o);
  })();
  // each band's cells are placed once a frame by a pass that only computes (the ground under each, its climate), and
  // the drawing passes read the results per instance, so the ground is worked out once per thing, not once per vertex
  const TFV = `
uniform vec4 uBand;    // lattice spacing, cells across, the foot's place in its cell (along the face's two axes)
uniform ivec2 uBase;   // the foot's cell
uniform vec3 uNf, uEa, uEb, uEc; uniform float uSg, uH0, uG0;
out vec4 tA, tB, tC;
float hh(ivec2 c, int k) { return hs2(c, 30 + k); }
float cn(ivec2 c, int k) { ivec2 b = c >> 3; vec2 f = vec2(c & 7) / 8.; f = f * f * (3. - 2. * f); return mix(mix(hh(b, k), hh(b + ivec2(1, 0), k), f.x), mix(hh(b + ivec2(0, 1), k), hh(b + ivec2(1, 1), k), f.x), f.y); }
void main() {
  int n = int(uBand.y), i = gl_VertexID % n - n / 2, j = gl_VertexID / n - n / 2; ivec2 c = uBase + ivec2(i, j);
  vec2 jt = vec2(hh(c, 1), hh(c, 2)), dd = (vec2(i, j) + jt - uBand.zw) * uBand.x;   // metres along the face's axes, from the foot
  float X = dd.x * (2. * uNf.y + dd.x) + dd.y * (2. * uNf.z + dd.y), da = -uSg * X / (sqrt(max(uNf.x * uNf.x - X, 0.)) + abs(uNf.x));
  vec3 q = uEa * da + uEb * dd.x + uEc * dd.y;                           // camera-local, on the sphere
  float dh; vec3 g; ground(q, uBand.x * .25, dh, g); float h = uG0 + dh;
  vec3 o = q + vec3(0., uH0 + dh, 0.) + q * (h / uR);
  vec3 cl = climate(q, h + ${RIVD}. * uRivC); float rd, rw, rm = riverM(q, h + ${RIVD}. * uRivC, cl.y, rd, rw); h -= ${RIVD}. * (rm - uRivC); o.y -= ${RIVD}. * (rm - uRivC);
  float fo = forestF(q, h, cl.x, cl.y, 0.) * (1. - step(.2, rm));
  float urb = cityRho(q) * citySuit(h, cl.x, cl.y, 0.);
  float ba = burnAge(q), bt = ba >= 0. ? 1. - smoothstep(.3, 1.5, ba / uFyr) : 0.; fo *= 1. - bt; urb = max(urb, bt * .5);   // burnt bare
  float hp = h; vec2 pd = pond(q, hp); if (pd.x > h - .05 || pd.y > .05) urb = 1.;   // under a beaver pond, or on its dam
  vec3 pw = uFootP + uFrm * q; float lo = degrees(atan(pw.y, pw.x)), la = degrees(asin(clamp(pw.z / length(pw), -1., 1.)));   // the region, for which plants: the Americas 1, Africa and Arabia 2, Australia 3, East Asia 4
  float rg = lo > -170. && lo < -30. ? 1. : lo > -20. && lo < 60. && la < 37. ? 2. : lo > 112. && lo < 155. && la < -10. ? 3. : lo > 70. && lo < 150. && la > -10. && la < 40. ? 4. : 0.;
  tA = vec4(o, .6 + .8 * hh(c, 4)); tB = vec4(rg + hh(c, 3) * .999, hh(c, 5) * 6.2832, fo, cl.x < -6. || rm > .3 ? 0. : cl.y); tC = vec4(urb, h, cn(c, 9), floor(clamp(cl.x, -40., 50.) + 60.) + hh(c, 7) * .999);
  gl_Position = vec4(0.);
}`;
  const tfp = (() => {
    const p = gl.createProgram(), vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, PRE + TFV); gl.compileShader(vs); if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs));
    gl.shaderSource(fs, '#version 300 es\nprecision highp float; out vec4 o; void main() { o = vec4(0.); }'); gl.compileShader(fs);
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.transformFeedbackVaryings(p, ['tA', 'tB', 'tC'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = { p }, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); U[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); } return U;
  })();
  const tfo = gl.createTransformFeedback(), emptyVao = gl.createVertexArray();
  const VS = `
layout(location = 0) in vec3 aP; layout(location = 5) in vec4 iA; layout(location = 6) in vec4 iB; layout(location = 7) in vec4 iC;
uniform float uGraze;  // how much grass the grazers have left (eco.js): short and sparse when grazed hard
uniform float uGcov;   // what covers open ground: grass (0), ferns (1, before there was grass), nothing (2, before land plants)
uniform vec4 uBand; uniform float uFade;
out vec3 vP, vN, vL; out float vW, vF, vSd, vT, vS;
// this instance's cell, as placed: where it stands, size, seed, turn; the forest, wetness, warmth and height there; a
// slow noise over the cells (for patches), and a spare seed
void place(out vec3 o, out float sz, out float sd, out float ang, out float fo, out float W, out float T, out float h, out float pa) { o = iA.xyz; sz = iA.w; sd = fract(iB.x); ang = iB.y; fo = iB.z; W = iB.w; T = floor(iC.w) - 60.; h = iC.y; pa = iC.z; if (iC.x > .12) W = 0.; }`;
  const mk = (body, frag) => prog(PRE + VS + body, PRE + `
in vec3 vP, vN, vL; in float vW, vF, vSd, vT, vS; uniform float uCy, uMat;
uniform vec3 uGrass, uDry, uSoil, uRock, uSand, uLitter;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
` + LEAFFACE + `
bool gone(float f) { return h1(gl_FragCoord.xy + fract(vSd * 13.7) * 91.) > f; }
vec3 lite(vec3 alb, vec3 n) { return alb * (uSunC * max(dot(n, uSun), 0.) * .8 * shadow(vP) + uSky * (.4 + .3 * n.y)); }
void main() { if (gone(vF)) discard; float fp = vW * uPix; vec3 col; ` + frag + `
  col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, uMat, pkn(normalize(vN) * (gl_FrontFacing ? 1. : -1.))); gl_FragDepth = fdep(vW); }`);
  const END = `vec4 Q = uVP * vec4(vP, 1.); vW = Q.w; gl_Position = vec4(Q.xy, 0., Q.w); }`;
  const edge = `float ed = length(o.xz) / (uBand.x * uBand.y * .5); vF = uFade * smoothstep(1., .7, ed);`;
  // fallen leaves: a flat blade on the ground, a little cupped, faced like a living leaf, in the dead leaf's colour
  const litter = mk(`
void main() { vec3 o; float sz, sd, a, h, fo, W, T, pa; place(o, sz, sd, a, fo, W, T, h, pa); ${edge}
  float mo = T < 14. && W > .6 && fo > .3 && fract(sd * 9.1) < .35 * pa ? 1. : T < 2. && fo < .3 && W > .2 && fract(sd * 9.1) < .5 * pa ? 2. : 0.;   // moss in cool wet woods, lichen on cold open ground
  if ((fo < .3 && mo < 1.5) || sd < .25 || h < 0. || W <= 0.) vF = 0.;
  float L = .07 * sz * (mo > 0. ? 2.5 : 1.); vec2 u = aP.xz; vL = vec3(u.x * L, u.y * L, L); float c = cos(a), s = sin(a);
  vec3 p = vec3(u.x * L, (u.y * u.y) * L * .12 + .002 + sd * .004, u.y * L); vP = o + vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); vN = vec3(0, 1, 0); vSd = sd; vT = fract(iC.w); vS = mo; ${END}`,
  `float L = vL.z, s = vL.x, w = vL.y; float hw = L * .33 * pow(max(sin(3.1416 * clamp(s / L, 0., 1.)), 0.), .8);
  if (s < 0. || s > L || abs(w) > hw) discard;
  vec3 alb = vS > 1.5 ? vec3(.62, .64, .52) * (.8 + .3 * n2(vec2(s, w) * 60.)) : vS > .5 ? vec3(.16, .3, .07) * (.7 + .5 * n2(vec2(s, w) * 120.)) : uLitter * (.7 + .5 * vT) * (.8 + .3 * vSd); alb = mix(alb, alb * .3, smoothstep(.5, .9, n2(vec2(s, w) * 90. + vSd * 9.)) * .7);   // blotched with rot
  alb = leafFace(alb, vec2(s, w), L, fp); col = lite(alb, vec3(0, 1, 0)) * .85;`);
  // plants: a tuft of grass blades in the open; under trees, ferns; none where it is too dry or too cold
  const plant = mk(`
void main() { vec3 o; float sz, sd, a, h, fo, W, T, pa; place(o, sz, sd, a, fo, W, T, h, pa); ${edge}
  vT = fo; bool fern = fo > .5 || uGcov > .5; if (fern && sd > .45 * smoothstep(.35, .75, pa)) vF = 0.; if (!fern && sd > (.3 + .7 * smoothstep(.3, .7, pa)) * min(1., .35 + .65 * uGraze) * smoothstep(.08, .55, W)) vF = 0.;   // thinner as it dries if (h < 1. || W < .15 + .5 * sd * sd || T < -6. || uGcov > 1.5) vF = 0.;
  vS = W * (fern ? 1. : mix(.6, 1., min(uGraze, 1.))); if (!fern && W > .3 && fract(sd * 31.7) < .16 * pa * smoothstep(-3., 4., uSeasT) * (1. - uAut)) vS += 10.;   // in bloom: spring to summer, in patches sz *= (.7 + .6 * pa) * (fern ? 1. : .4 + .6 * min(uGraze, 1.2));
  float bi = floor(aP.x), b = fract(aP.x), lat = aP.z, ht = (fern ? .45 : .3) * sz / sqrt(max(uGrav, .3));
  float ba = a + bi * 2.4, lean = fern ? 1.1 : .35 + .3 * h1(vec2(bi, sd)), len = ht * (fern ? 1. : .7 + .5 * h1(vec2(sd, bi)));
  vec2 dir = vec2(cos(ba), sin(ba)); float t = b, bend = lean * t * t, wid = fern ? .09 * (1. - t * .8) : .006 * (1. - t);
  vec3 sway = vec3(sin(uT * 1.3 + o.x * .3) * .04, 0., cos(uT * 1.1 + o.z * .3) * .04) * t * t;
  vP = o + vec3(dir.x * bend * len, len * t * (1. - bend * .35), dir.y * bend * len) + vec3(-dir.y, 0., dir.x) * lat * wid + sway;
  vN = normalize(vec3(dir.x * .3, 1., dir.y * .3) + vec3(-dir.y, 0., dir.x) * lat * (fern ? .7 : .4)); vL = vec3(b, lat, bi); vSd = sd; ${END}`,
  `float fl = step(5., vS), W = vS - 10. * fl; vec3 g0 = mix(uDry, uGrass, smoothstep(.2, .6, W) * smoothstep(-9., -2., uSeasT)); vec3 alb = vT > .5 ? g0 * .7 * (.8 + .3 * vSd) : g0 * (.75 + .5 * vSd); vec3 n = normalize(vN); float sh = 1.;
  if (vT > .5) { float pi = fract(vL.x * 14.), lf = abs(pi - .5) * 2., wl = .35 + .65 * lf, al = abs(vL.y);
    if (al > wl) discard;                                                 // a fern's fronds, notched into leaflets
    float pin = al / wl; sh = (.75 + .35 * (1. - pin)) * (1. - .45 * smoothstep(.06, 0., al) * step(.5, 1. - fp * 200.)); }
  float tr = max(dot(-n, uSun), 0.) * .5;
  alb *= .7 + .4 * vL.x; if (fl > .5 && vL.x > .82 && vT < .5) { float f = fract(vSd * 17.3); alb = f < .3 ? vec3(.95, .8, .1) : f < .55 ? vec3(.92, .92, .88) : f < .75 ? vec3(.55, .3, .75) : f < .9 ? vec3(.85, .15, .12) : vec3(.3, .45, .9); }   // a flower head
  col = (lite(alb, n) + alb * uSunC * tr * 1.2 * shadow(vP)) * sh * (.6 + .4 * vL.x);`);
  // the bigger plants, one to a 2.5 m cell, by climate and region (the ground under them is the plant band's): shrubs
  // (thicker under woods), heath on cool open ground, columnar cacti in the Americas' deserts and candelabra euphorbias
  // in Africa's, tussock grass on dry plains (spinifex in Australia), sagebrush on dry steppe, bamboo in warm wet East
  // Asia. Drawn in parts: a cactus's arms and a bamboo clump's culms are extra parts of the same cell
  const shrub = mk(`
uniform float uPart;
void main() { vec3 o; float sz, sd, a, h, fo, W, T, pa; place(o, sz, sd, a, fo, W, T, h, pa); ${edge}
  float rg = floor(iB.x), k = 0., r = sd;
  if (h < 1. || W <= 0. || T < -12.) k = 0.;
  else if (rg == 4. && W > .6 && T > 12. && fo < .9 && r < .25 * pa) k = 5.;
  else if (W < .38 && T > 13. && (rg == 1. || rg == 2.) && r < .05 * (1.2 - W * 2.)) k = 3.;   // a saguaro stand: some 30-80 a hectare
  else if (W < .45 && W > .1 && fo < .3 && r < .4 * pa) k = rg == 3. || W > .28 ? 4. : 6.;
  else if (T < 8. && W > .4 && fo < .35 && r < .55 * pa) k = 2.;
  else if (W > .3 && T > -3. && r < (fo > .4 ? .28 : .1) * (.4 + pa)) k = 1.;
  if (uGcov > .5 && k > 1.) k = k == 5. || k == 4. ? 0. : 1.;              // before grasses and cacti, only shrubs (cycads, tree-fern kin)
  bool part = uPart > .5; float pi = uPart, arm = fract(sd * 7.7);
  if (part && !(k == 3. && pi < 2.5 && arm < .7 - .3 * pi) && k != 5.) k = 0.;
  if (k == 0.) vF = 0.;
  vec3 p = aP; float sc = sz * (.7 + .6 * fract(sd * 3.1)); vec3 c0 = vec3(0.); vL = aP;
  if (k == 1.) p = aP * vec3(1., .75, 1.) * (.7 + .3 * h1(aP.xz * 3. + sd)) * sc + vec3(0., .55 * sc, 0.);
  else if (k == 2.) p = aP * vec3(.5, .22, .5) * sc + vec3(0., .1 * sc, 0.);
  else if (k == 6.) p = aP * vec3(.5, .4, .5) * (.8 + .4 * h1(aP.xy * 5. + sd)) * sc + vec3(0., .35 * sc, 0.);
  else if (k == 4.) { float t = abs(aP.y); p = vec3(aP.x * (.15 + .35 * t), t * .7, aP.z * (.15 + .35 * t)) * sc * (rg == 3. ? 1.3 : 1.); }
  vec3 nn = vec3(0.);
  if (k == 3.) { float H = (rg == 1. ? 5. : 3.5) * sc, t = aP.y * .5 + .5; vec2 dr = aP.xz / max(length(aP.xz), 1e-3); vec2 xs = dr * .28 * (rg == 1. ? 1. : .7) * (t > .9 ? sqrt(max(0., 1. - pow((t - .9) / .1, 2.))) : 1.); nn = vec3(dr.x, t > .9 ? 1. : .05, dr.y);   // a ribbed column, round-topped
    if (!part) p = vec3(xs.x, t * H, xs.y);                                   // the trunk
    else { float sd2 = pi == 1. ? 1. : -1., y0 = H * (.35 + .15 * arm), L = .55; vec2 xa = xs * .75;   // an arm: out, then up
      p = t < .25 ? vec3(sd2 * L * t / .25, y0 + xa.y, xa.x) : vec3(sd2 * L + xa.x, y0 + (t - .25) / .75 * H * .4, xa.y); }
    vL = vec3(xs, t); }
  else if (k == 5.) { float t = aP.y * .5 + .5, an = pi * 1.7 + sd * 6., H = (6. + 4. * fract(sd * 5.3 + pi * .37)) * sz, off = pi == 0. ? 0. : .35;
    vec2 xs = aP.xz * (t > .7 ? .9 * (t - .7) / .3 + .05 : .05); if (t <= .7) nn = vec3(aP.x, 0., aP.z); p = vec3(cos(an) * off + xs.x + t * t * .6 * cos(an), t * H, sin(an) * off + xs.y + t * t * .6 * sin(an)); vL = vec3(aP.xz, t); }
  float c = cos(a), s2 = sin(a); p = vec3(c * p.x - s2 * p.z, p.y, s2 * p.x + c * p.z); if (dot(nn, nn) > 0.) nn = vec3(c * nn.x - s2 * nn.z, nn.y, s2 * nn.x + c * nn.z);
  vP = o + p + vec3(sin(uT * .9 + o.x) * .03, 0., cos(uT * .8 + o.z) * .03) * p.y; vN = dot(nn, nn) > 0. ? normalize(nn) : normalize(vec3(p.x, (p.y - .5 * sc) * .8 + .3, p.z) + .001); vSd = sd; vT = k; vS = rg; ${END}`,
  `float k = vT, lf = n2(vP.xz * 9. + vP.y * 7. + vSd * 40.); vec3 n = normalize(vN), alb;
  if (k == 1. || k == 2. || k == 6. || (k == 5. && vL.z > .7) || k == 4.) { if (lf > (k == 4. ? .62 : .72) - (k == 1. ? .35 * uBare * step(4., floor(vSd * 9.)) : 0.)) discard; }   // leafy: holes, and deciduous ones bare in winter
  if (k == 1.) alb = mix(uGrass * .55, vec3(.55, .3, .08), uAut * step(.5, fract(vSd * 4.))) * (.75 + .4 * lf);
  else if (k == 2.) alb = mix(vec3(.17, .19, .1), vec3(.45, .2, .4), smoothstep(.2, .6, uSeasT / 8.) * uAut) * (.8 + .4 * lf);   // heather purples at summer's end
  else if (k == 3.) alb = vec3(.22, .36, .18) * (.75 + .25 * cos(atan(vL.y, vL.x) * 12.));   // ribbed
  else if (k == 4.) alb = (vS == 3. ? vec3(.62, .6, .4) : mix(uDry, uGrass, .3)) * (.8 + .4 * lf);
  else if (k == 6.) alb = vec3(.48, .52, .44) * (.8 + .3 * lf);
  else alb = vL.z > .7 ? vec3(.26, .44, .14) : vec3(.38, .5, .18) * (.8 + .4 * step(.97, fract(vL.z * 14.)));   // leaves; a culm and its nodes
  col = lite(alb, n);`);
  // stones, grains and specks: the same rough shape at three sizes, in the planet's rock, soil and sand
  const grains = mk(`
uniform vec3 uKind;
void main() { vec3 o; float sz, sd, a, h, fo, W, T, pa; place(o, sz, sd, a, fo, W, T, h, pa); ${edge}
  if (uKind.y < .5 && sd > (fo > .3 ? .25 : .45) * (.4 + 1.2 * pa)) vF = 0.;
  float r = uKind.x * sz * (.5 + sd); vec3 qq = aP * vec3(1., .55 + .3 * h1(vec2(sd, 1.)), .8 + .4 * h1(vec2(sd, 2.))); qq *= 1. + .25 * (h1(aP.xy * 13. + sd) - .5);
  float c = cos(a), s = sin(a); vec3 p = vec3(c * qq.x - s * qq.z, qq.y, s * qq.x + c * qq.z) * r; vP = o + p + vec3(0., r * .25, 0.); vN = normalize(p); vSd = sd; vT = uKind.y; ${END}`,
  `vec3 n = normalize(cross(dFdx(vP), dFdy(vP))); if (dot(n, vP) > 0.) n = -n; n = normalize(mix(n, normalize(vN), .6));
  vec3 alb = vT < .5 ? uRock * (.6 + .5 * vSd) : vT < 1.5 ? (vSd < .55 ? uSoil * .35 : vSd < .75 ? uSand * .8 : vSd < .9 ? uRock : uRock * .2) : (vSd < .5 ? uSoil * .8 : vSd < .8 ? uSand * .75 : uRock * .5);
  alb *= .8 + .4 * n2(vP.xz / max(fp * 6., 1e-7));
  col = lite(alb, n);`);
  const geo = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return { b, n: data.length / 3 }; };
  const vao = (g, n) => { const v = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, g.b); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, n * n * 48, gl.DYNAMIC_COPY); for (let l = 0; l < 3; l++) { gl.enableVertexAttribArray(5 + l); gl.vertexAttribPointer(5 + l, 4, gl.FLOAT, false, 48, l * 16); gl.vertexAttribDivisor(5 + l, 1); }
    gl.bindVertexArray(null); return { v, n: g.n, ib }; };
  const leafQ = []; for (let i = 0; i < 6; i++) { const u0 = i / 6, u1 = (i + 1) / 6; leafQ.push(u0, 0, -0.5, u1, 0, -0.5, u0, 0, 0.5, u0, 0, 0.5, u1, 0, -0.5, u1, 0, 0.5); }
  const blades = []; for (let bi = 0; bi < 7; bi++) for (let i = 0; i < 5; i++) { const a = bi + i / 5, b = bi + (i + 1) / 5 - 1e-4; blades.push(a, 0, -1, b, 0, -1, a, 0, 1, a, 0, 1, b, 0, -1, b, 0, 1); }
  const Gm = { leaf: geo(new Float32Array(leafQ)), blade: geo(new Float32Array(blades)), stone: geo(stone) };
  const BANDS = [
    { s: 2.5, n: 40, P: shrub, g: Gm.stone, mat: 7, parts: 4 },
    { s: 0.35, n: 110, P: plant, g: Gm.blade, mat: 6 },
    { s: 0.07, n: 90, P: litter, g: Gm.leaf, mat: 9 },
    { s: 0.022, n: 80, P: grains, g: Gm.stone, kind: [0.006, 0, 0], mat: 5 },
    { s: 6e-4, n: 90, P: grains, g: Gm.stone, kind: [1.8e-4, 1, 0], mat: 4 },
    { s: 3.5e-5, n: 80, P: grains, g: Gm.stone, kind: [1.1e-5, 2, 0], mat: 1 },
  ].map((b) => ({ ...b, va: vao(b.g, b.n) }));
  return {
    draw(common, setNoise, cam, G, S) {
      const hc = S.hc, foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1;
      const loc = (i) => [S.F[0][i], S.F[1][i], S.F[2][i]];                // planet axis i, in camera-local axes
      const litter = G.species[0] ? G.species.map((s) => s.canopy).reduce((x, y) => x.map((v, i) => v + y[i])).map((v) => v / G.species.length) : G.soil;
      const dead = [litter[0] * 1.6 + 0.05, litter[1] * 0.9 + 0.02, litter[2] * 0.4];
      for (const bd of BANDS) {
        const reach = bd.s * bd.n * 0.5, fade = min(1, max(0, (reach * 0.9 - hc) / (reach * 0.5))) * min(1, max(0, (bd.s * 160 - hc) / (bd.s * 60) + 1));
        if (fade <= 0 || (bd.P === shrub || bd.P === plant || bd.P === litter) && (G.lifeless || G.ground === 'bare')) continue;   // no plants or leaves where nothing grows
        const ub = foot[b] / bd.s, uc = foot[c] / bd.s, ib = floor(ub), ic = floor(uc);
        // place the cells
        const T = tfp; gl.useProgram(T.p); setNoise(T);
        gl.uniform4f(T.uBand, bd.s, bd.n, ub - ib, uc - ic); gl.uniform2i(T.uBase, ((ib % 1048576) + 1048576) % 1048576, ((ic % 1048576) + 1048576) % 1048576);
        gl.uniform3f(T.uNf, foot[a], foot[b], foot[c]); gl.uniform3fv(T.uEa, loc(a)); gl.uniform3fv(T.uEb, loc(b)); gl.uniform3fv(T.uEc, loc(c)); gl.uniform1f(T.uSg, sg); gl.uniform1f(T.uH0, S.g0 - S.cy); gl.uniform1f(T.uG0, S.g0);
        gl.bindVertexArray(emptyVao); gl.enable(gl.RASTERIZER_DISCARD); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfo); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bd.va.ib);
        gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, bd.n * bd.n); gl.endTransformFeedback();
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null); gl.disable(gl.RASTERIZER_DISCARD);
        // and draw them
        const P = bd.P; gl.useProgram(P.p); common(P); setNoise(P);
        gl.uniform4f(P.uBand, bd.s, bd.n, ub - ib, uc - ic); gl.uniform1f(P.uFade, fade); gl.uniform1f(P.uCy, S.cy); gl.uniform1f(P.uMat, bd.mat);
        for (const [n, v] of [['uGrass', G.grass], ['uDry', G.grassDry], ['uSoil', G.soil], ['uRock', G.rock], ['uSand', G.sand], ['uLitter', dead]]) if (P[n]) gl.uniform3fv(P[n], v); if (P.uGraze) gl.uniform1f(P.uGraze, S.graze ?? 1); if (P.uGcov) gl.uniform1f(P.uGcov, G.ground === 'ferns' ? 1 : G.ground === 'bare' ? 2 : 0);
        if (bd.kind) gl.uniform3fv(P.uKind, bd.kind);
        let np = 1; if (bd.parts && G.real === 'earth') { const u = foot.map((v) => v / G.R), la = Math.asin(u[2]) * 57.3, lo = Math.atan2(u[1], u[0]) * 57.3, W = climate(G, foot, S.g0).W;   // arms and culms only where cacti or bamboo can grow
          np = ((lo > -170 && lo < -30) || (lo > -20 && lo < 60 && la < 37)) && W < 0.45 || (lo > 70 && lo < 150 && la > -10 && la < 40 && W > 0.55) ? bd.parts : 1; } else if (bd.parts) np = bd.parts;
        gl.bindVertexArray(bd.va.v); for (let pt = 0; pt < np; pt++) { if (P.uPart) gl.uniform1f(P.uPart, pt); gl.drawArraysInstanced(gl.TRIANGLES, 0, bd.va.n, bd.n * bd.n); }
      }
      gl.bindVertexArray(null);
    },
  };
}
