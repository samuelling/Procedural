// The camera. Three kinds of geometry, each drawn twice: once from the sun into a shadow map, once from the eye.
//   wood      capsules: one instanced quad each, shaded as a round tapered limb with bark computed per pixel
//   foliage   cards: one quad each, cut to a cluster of leaves, a needle spray, a frond or a tuft by a formula
//   ground    meshes: the terrain, the plot's cut sides, and stones
// Then light shafts are marched through the shadow map, and a last pass adds glow, depth of field and tone.
/* global TIER */
import { WX3, WATV, WATF, PTV, PTF, SEAV, SEAF, FLW, MICRO, LEAFD, BARKD, LITTER, STONED, FURD, MUSHD, FEATHD, FARD, CROWND, LEAFG, WOODG, RANGEG, ROCKF, LAKEG, CAVEG } from './fx.js';
// below the 200 kB rung there is no weather: clouds cast no shadow and nothing changes a surface's colour
// animals, flame and charcoal: what a limb is covered in. Q is a place on the animal's own hide, so its markings travel with it.
const FUR = `if (kd > 3) {
    vec3 Q = vec3(nw.x * 3., s * 5. + sd * 20., nw.z * 3.);
    alb = kd == 4 ? mix(vec3(.32, .19, .1), vec3(.25, .22, .19), uSe.y) : kd == 5 ? mix(vec3(.42, .34, .24), vec3(.85), uSe.y) : kd == 6 ? vec3(.06, .055, .06) : kd == 7 ? vec3(.52, .21, .05) : kd == 10 ? .5 + .5 * cos(sd * 30. + vec3(0., 2., 4.)) : kd == 11 ? vec3(.33, .28, .24)
      : kd == 12 ? vec3(.1, .3, .07) : kd == 13 ? vec3(.03) : kd == 14 ? vec3(.34, .33, .31) : kd == 15 ? vec3(.17, .1, .06) : kd == 18 ? vec3(.02) : kd == 19 ? vec3(.3, .36, .52) : kd == 20 ? vec3(.62, .06, .03) : vec3(.72, .7, .62);   // deer and hare change coat for winter
    if (kd == 17) alb = vec3(90., 28., 3.) * (.4 + vn3(pw * 6. - vec3(0., uT * 7., 0.))) * (1.25 - s);                    // flame gives its own light
    else if (kd == 4 || kd == 5 || kd == 7 || kd == 11 || kd == 14 || kd == 15) {
      alb = mix(alb * 1.9 + .07, alb, smoothstep(-.8, -.15, nw.y)) * mix(1., .7, smoothstep(.5, .95, nw.y));               // pale beneath, dark along the back
      if (sp == 1) alb = mix(alb, vec3(.8, .74, .62), smoothstep(.7, .78, vn3(Q * 2.2)) * smoothstep(-.2, .5, nw.y));        // a fawn's spots
      alb *= .84 + .32 * vn3(Q * vec3(9., 2.5, 9.));                                                                         // hair lying along the limb
` + (TIER > 3 ? FURD : '') + `
    } else alb *= .8 + .4 * vn3(Q * 6.);
` + (TIER > 3 ? FEATHD + CROWND : '') + `  } else`;
const WX = TIER > 2 ? WX3 : `float gst(vec3 p) { return 1.; } float cshd(vec3 p) { return 1.; } vec3 wxa(vec3 a, vec3 p, vec3 n) { return a; }`;
const PRE = `#version 300 es
precision highp float; precision highp sampler2DShadow;
uniform mat4 uV, uSM; uniform mat3 uIV; uniform vec2 uK, uR, uNF; uniform float uOr, uT, uMoss;
uniform vec3 uCam, uSun, uSunC, uSkyC, uHorC, uFog, uWd;
uniform sampler2DShadow uSh;
float h1(float n) { return fract(sin(n * 91.7) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }
float vn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1., 0., 0.)), f.x), mix(h3(i + vec3(0., 1., 0.)), h3(i + vec3(1., 1., 0.)), f.x), f.y),
             mix(mix(h3(i + vec3(0., 0., 1.)), h3(i + vec3(1., 0., 1.)), f.x), mix(h3(i + vec3(0., 1., 1.)), h3(i + vec3(1., 1., 1.)), f.x), f.y), f.z); }
float fb3(vec3 p) { return .55 * vn3(p) + .3 * vn3(p * 2.1 + 3.) + .15 * vn3(p * 4.3 + 7.); }
vec3 sky(vec3 d) { float s = max(dot(d, uSun), 0.); return mix(uHorC * mix(.45, 1., smoothstep(-.7, 0., d.y)), uSkyC, pow(max(d.y, 0.), .55)) + uSunC * (pow(s, 350.) * 5. + pow(s, 6.) * .1); }
` + WX + `
// wind: everything leans by its height, in slow waves that cross the plot
vec3 sway(vec3 p) { float h = max(p.y + 2., 0.) / 24., ph = p.x * .06 + p.z * .05; return vec3(uWd.x, 0., uWd.y) * uWd.z * h * sqrt(h) * (sin(uT * .8 + ph) + .5 * sin(uT * 1.9 + ph * 1.7) + .4) * gst(p); }
vec4 proj(vec3 v) { float zd = -v.z, n = uNF.x, f = uNF.y; return uOr > .5 ? vec4(uK * v.xy, 2. * (zd - n) / (f - n) - 1., 1.) : vec4(uK * v.xy, ((f + n) * zd - 2. * f * n) / (f - n), zd); }
float dep(float zs) { float n = uNF.x, f = uNF.y; return uOr > .5 ? (zs - n) / (f - n) : .5 + .5 * ((f + n) / (f - n) - 2. * f * n / ((f - n) * zs)); }
float shd(vec3 p, vec3 n) {
  vec4 q = uSM * vec4(p + n * .08, 1.); if (q.x < 0. || q.x > 1. || q.y < 0. || q.y > 1. || q.z > 1.) return 1.;
  float s = 0., e = .0007, z = q.z - .0007;
  s += texture(uSh, vec3(q.xy + vec2(-e, -e * .4), z)); s += texture(uSh, vec3(q.xy + vec2(e * .4, -e), z));
  s += texture(uSh, vec3(q.xy + vec2(e, e * .4), z)); s += texture(uSh, vec3(q.xy + vec2(-e * .4, e), z));
  return s * .25;
}
vec3 amb(vec3 n, float ao) { return mix(vec3(.19, .16, .11) * (uHorC + .2), uSkyC * 1.1 + uHorC * .45, n.y * .5 + .5) * ao; }
` + (TIER > 3 ? `uniform vec2 uCv;   // underground: how much of the sky's light is shut out, and the lamp you carry
vec3 lit(vec3 alb, vec3 n, vec3 p, float ao) { vec3 l = uCam - p; float d = length(l) + 1e-3; return wxa(alb, p, n) * (uSunC * max(dot(n, uSun), 0.) * shd(p, n) * cshd(p) + amb(n, ao) * (1. - uCv.x) + uCv.y * vec3(1., .86, .68) * max(dot(n, l / d), 0.) / (1. + .07 * d * d)); }` : `vec3 lit(vec3 alb, vec3 n, vec3 p, float ao) { return wxa(alb, p, n) * (uSunC * max(dot(n, uSun), 0.) * shd(p, n) * cshd(p) + amb(n, ao)); }`) + `vec3 fogc(vec3 c, vec3 p) { vec3 d = p - uCam; float l = length(d), f = 1. - exp(-uFog.x * .4 * l * exp(-max(.5 * (p.y + uCam.y) - uFog.z, 0.) * uFog.y)); return mix(c, sky(normalize(vec3(d.x, .06 * l, d.z))) * .8, f); }
// moss is a rule: it takes where a surface faces up, away from the sun, low down, and where the noise says it is damp
float mossf(vec3 p, vec3 n, float k) { return smoothstep(.45, .72, n.y * .5 + fb3(p * 1.7) * .7 + k + uMoss - .78 - dot(n.xz, uSun.xz) * .15); }
` + (TIER > 3 ? MICRO : `vec3 mossc(vec3 p) { return mix(vec3(.05, .13, .02), vec3(.26, .38, .06), vn3(p * 9.) * .6 + vn3(p * 31.) * .4); }`) + `
`;

const CAPV = PRE + `
layout(location=0) in vec4 a0; layout(location=1) in vec4 a1; layout(location=2) in vec4 a2;
out vec2 q; flat out vec4 sg, ax; flat out vec2 pq, zz;
void main() {
  vec4 v0 = uV * vec4(a0.xyz + sway(a0.xyz), 1.), v1 = uV * vec4(a1.xyz + sway(a1.xyz), 1.);
  bool o = uOr > .5;
  if (!o && max(v0.z, v1.z) > -.12) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float w0 = o ? 1. : -v0.z, w1 = o ? 1. : -v1.z, u0 = uK.y * uR.y * .5 / w0, u1 = uK.y * uR.y * .5 / w1;
  vec2 s0 = uK * v0.xy / w0 * uR * .5, s1 = uK * v1.xy / w1 * uR * .5;
  float r0 = a0.w * u0, r1 = a1.w * u1, sc = max(1., .6 / max(r0, r1));
  if (sc > 3.5) { gl_Position = vec4(2., 2., 2., 1.); return; }           // too fine to see from here
  r0 *= sc; r1 *= sc;
  vec2 b = s1 - s0; float L = length(b); vec2 dr = L > .001 ? b / L : vec2(1., 0.);
  float R = max(r0, r1) + 1.;
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1) * 2. - 1.);
  vec2 p = mix(s0 - dr * R, s1 + dr * R, c.x) + vec2(-dr.y, dr.x) * R * c.y;
  q = p - s0; sg = vec4(b, r0, r1); ax = a2; pq = vec2(.5 * (u0 + u1), 1. / sc); zz = vec2(-v0.z, -v1.z);
  gl_Position = vec4(p / (uR * .5), 0., 1.);
}`;
const CAPHEAD = `
in vec2 q; flat in vec4 sg, ax; flat in vec2 pq, zz;
#define CAPSULE vec2 b = sg.xy; float bb = dot(b, b), h = clamp(dot(q, b) / max(bb, 1e-4), 0., 1.), r = mix(sg.z, sg.w, h); vec2 e = q - b * h; float dp = length(e), d = dp / r, nz = sqrt(max(1. - d * d, 0.)), wr = r / pq.x * min(1., pq.y), zs = mix(zz.x, zz.y, h) - wr * nz; bool gone = d >= 1. || zs < .15;
`;
const CAPS = PRE + CAPHEAD + `void main() { CAPSULE if (gone) discard; gl_FragDepth = dep(zs); }`;
const CAPF = PRE + CAPHEAD + `
uniform vec3 uBA[8], uBB[8]; uniform vec4 uBP[8];` + (TIER > 3 ? ' uniform vec3 uLB[8];' : '') + ` out vec4 o;
void main() {
  CAPSULE
  vec3 n = vec3(e / max(dp, 1e-4) * d, nz), pw = uIV * vec3((gl_FragCoord.xy / uR * 2. - 1.) / uK * zs, -zs) + uCam, nw = uIV * n;
  int kd = int(ax.w + .5), sp = int(ax.z); float s = mix(ax.x, ax.y, h), sd = fract(ax.z), tex = .5, mk = 0., ao = 1.; vec3 alb;` + (TIER > 3 ? ' FP = zs / (uK.y * uR.y * .5);' : '') + `
  if (kd < 2) {
    vec4 bp = uBP[sp]; vec3 A = uBA[sp], B = uBB[sp];
    vec3 P = vec3(nw.x * wr, s * .35, nw.z * wr) * 9. / bp.y + sd * 50.;        // a point on the bark, seamless around the limb
    if (bp.x < .5) { float f = .6 * vn3(P * vec3(1., .28, 1.)) + .4 * vn3(P * vec3(2.3, .6, 2.3) + 7.); tex = smoothstep(0., .3, abs(f - .5) * 2.); alb = mix(B, A, tex) * (.8 + .4 * vn3(P * 5.)); }   // furrowed: ridges between wandering cracks
    else if (bp.x < 1.5) { float cr = min(abs(vn3(P * vec3(.9, .5, .9)) - .5), abs(vn3(P * vec3(.9, .5, .9) + 17.) - .5) * 1.3); tex = smoothstep(0., .07, cr); alb = mix(B, A * (.75 + .5 * vn3(P * .5 + 3.)), tex); }   // plated
    else if (bp.x < 2.5) { float ln = smoothstep(.68, .76, vn3(vec3(P.x * .7, P.y * 14., P.z * .7))), scar = smoothstep(.76, .8, vn3(P * vec3(.45, .5, .45) + 5.)), low = smoothstep(1.6, .2, s) * vn3(P * .8);
      tex = 1. - max(ln * .8, max(scar, low * .9)); alb = mix(B, A * (.9 + .15 * vn3(P * .4)), tex); }                                                  // papery, with lenticels and scars
    else { tex = vn3(P * .7); alb = mix(B, A, tex); alb = mix(alb, vec3(.5, .56, .42), smoothstep(.6, .7, vn3(P * .35 + 9.)) * .6); }                   // smooth, with lichen
` + (TIER > 3 ? BARKD : '') + `
    if (kd == 1) alb = mix(alb, vec3(dot(alb, vec3(.33))) * vec3(1.05, 1., .9), .55) * .85;                                                               // dead wood greys
    mk = mossf(pw, nw, kd == 1 ? .3 : .36 * exp(-s / 1.1)); alb = mix(alb, mossc(pw), mk);
    ao = kd == 1 ? .8 : .5 + .5 * smoothstep(0., 2.2, s);
  } else ` + (TIER > 2 ? FUR : '') + ` if (kd == 2) alb = vec3(.8, .76, .62);
` + (TIER > 3 ? MUSHD : '') + `else { vec3 cc = sd < .4 ? vec3(.55, .05, .03) : sd < .75 ? vec3(.4, .24, .11) : vec3(.7, .55, .3); alb = mix(cc, vec3(.9, .88, .8), smoothstep(.7, .8, vn3(pw * 90.)) * step(sd, .4)); }
  if (r > 1.5) n = normalize(vec3(n.xy - vec2(dFdx(tex), dFdy(tex)) * min(r, 40.) * .6 * (1. - mk), n.z));
  nw = uIV * n;
  vec3 c = fogc(lit(alb, nw, pw, ao)` + (TIER > 3 ? ' + uSunC * spec(nw, pw, 90.) * max(kd == 13 || kd == 6 ? .7 : .04, GL) * shd(pw, nw)' : '') + `, pw);
  if (gone || c.x != c.x) discard;                                          // decided last, so the bark's slopes are defined up to the silhouette
  o = vec4(c, zs / 300.); gl_FragDepth = dep(zs);
}`;

const MSHV = PRE + `
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aX;
layout(location=3) in vec4 i0; layout(location=4) in vec4 i1; layout(location=5) in vec4 i2;
uniform float uMat; out vec3 pw, nw, po; out vec2 xx; out float vz; flat out vec2 ii;
vec3 qr(vec4 q, vec3 v) { return v + 2. * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  if (uMat < .5) { pw = qr(i1, aP * vec3(1., i2.x, 1.) * i0.w) + i0.xyz; nw = qr(i1, normalize(aN * vec3(1., 1. / i2.x, 1.))); po = aP * i0.w + i2.z * 37.; ii = i2.yz; xx = vec2(aP.y, 0.); }
  else { pw = aP; nw = aN; po = aP; ii = vec2(0.); xx = aX; }
  vec4 v = uV * vec4(pw, 1.); vz = -v.z; gl_Position = proj(v.xyz);
}`;
const MSHF = PRE + `
in vec3 pw, nw, po; in vec2 xx; in float vz; flat in vec2 ii;
uniform float uMat; uniform vec3 uRA, uRB, uLit; uniform float uLa; out vec4 o;
void main() {
  vec3 n = normalize(nw), alb; float ao = 1.;` + (TIER > 3 ? ' float hh = 0.; FP = vz / (uK.y * uR.y * .5) / max(abs(dot(n, normalize(uCam - pw))), .25);' : '') + `
  if (uMat < .5) {                                                          // stone: strata, speckle, cracks, lichen, then moss
    vec3 fn = cross(dFdx(pw), dFdy(pw)); if (dot(fn, fn) > 1e-14) { fn = normalize(fn); if (dot(fn, n) < 0.) fn = -fn; n = normalize(mix(n, fn, .6)); }
    float st = vn3(po * vec3(1.1, 4.5, 1.1)), spk = vn3(po * 14.), cr = abs(fb3(po * 1.7) - .5);
    alb = mix(uRB, uRA, st * .55 + spk * .45) * (.7 + .3 * smoothstep(0., .05, cr));
    alb = mix(alb, vec3(.6, .64, .5), smoothstep(.62, .7, vn3(po * 2.3 + 9.)) * .55);
    alb = mix(alb, vec3(.7, .45, .1), smoothstep(.8, .84, vn3(po * 6. + 3.)) * .6);
    n = normalize(n + (vec3(vn3(po * 11.), vn3(po * 11. + 5.), vn3(po * 11. + 11.)) - .5) * .55);
` + (TIER > 3 ? STONED : '') + `
    float mk = mossf(pw, n, ii.x * .45 - .1 + .25 * smoothstep(.3, -.6, xx.x));
    alb = mix(alb, mossc(pw), mk); n = normalize(mix(n, normalize(nw), mk * .7)); ao = .45 + .55 * smoothstep(-.5, .25, xx.x);
` + (TIER > 3 ? CAVEG + LAKEG + RANGEG + WOODG + LEAFG : '') + `  } else if (uMat < 1.5) {                                                  // the forest floor: soil, flecks of litter, moss where it is damp and flat
    float f1 = vn(pw.xz * 13.), f2 = vn(pw.xz * 41. + 3.), f3 = vn(pw.xz * 5.5 + 9.);
    alb = mix(vec3(.11, .075, .05), vec3(.2, .14, .09), fb3(pw * 1.2));
    alb = mix(alb, uLit * (.45 + .9 * f2), smoothstep(.42, .6, f1 * .6 + f3 * .4) * uLa);
` + (TIER > 3 ? LITTER : '') + `
    float g = smoothstep(.45, .65, xx.y * .6 + vn(pw.xz * .7) * .5 + vn(pw.xz * 3.1) * .25 + uMoss * .62 - .5) * smoothstep(.7, .9, n.y);
    alb = mix(alb, mossc(pw) * (.55 + .7 * vn(pw.xz * 5.)), g);                                      // cushions of moss, darker in their hollows
    n = normalize(n + (vec3(vn(pw.xz * 9.), 0., vn(pw.xz * 9. + 7.)) - .5) * (.5 + .5 * g)); ao = xx.x;
` + (TIER > 3 ? ROCKF : '') + `
` + (TIER > 3 ? FARD : '') + `  } else {                                                                  // the cut side of the plot: humus, soil, subsoil, stones and roots
    float dd = xx.x + (vn(vec2(pw.x + pw.z, pw.y) * 1.3) - .5) * .5;
    vec3 hum = vec3(.06, .04, .03), top = vec3(.2, .13, .08), sub = vec3(.36, .27, .17);
    alb = dd < 1.2 ? mix(hum, top, smoothstep(.35, .6, dd)) : dd < 2.8 ? mix(top, sub, smoothstep(1.2, 1.7, dd)) : mix(sub, uRB * .9 + .05, smoothstep(2.8, 3.3, dd));
    alb = mix(alb, uRA * .8, smoothstep(.62, .68, vn3(pw * vec3(2.5, 3.5, 2.5))) * step(.5, dd));
    alb = mix(alb, vec3(.09, .06, .04), (1. - smoothstep(0., .03, abs(vn(vec2((pw.x + pw.z) * 2.2, pw.y * .9)) - .5))) * smoothstep(2.2, .3, dd));
    alb *= .8 + .4 * vn3(pw * 9.); ao = .9;
  }
` + (TIER > 3 ? '  BUMP(n, pw, hh * .003)' : '') + `
  o = vec4(fogc(lit(alb, n, pw, ao)` + (TIER > 3 ? ' + uSunC * GL * spec(n, pw, 300.) * 6. * shd(pw, n)' : '') + `, pw), vz / 300.);
}`;
const NONE = `#version 300 es
void main() {}`;

const CRDV = PRE + `
layout(location=0) in vec4 a0; layout(location=1) in vec4 a1; layout(location=2) in vec4 a2;
out vec2 uv; out vec3 pw; out float vz; flat out vec3 nn; flat out vec4 ci;
void main() {
  float ty = floor(a1.w), sd = fract(a2.w); vec3 U = a1.xyz, N = a2.xyz, W = normalize(cross(N, U));
` + (TIER > 3 ? SEAV : '') + `
  float asp = ty < .5 ? .62 : ty < 1.5 ? 1. : ty < 2.5 ? .42 : ty < 3.5 ? 1. : 2.;` + (TIER > 3 ? ' if (ty > 7.5) asp = .55;' : '') + `
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1) - .5);
  float ph = dot(a0.xz, vec2(.31, .23)) + sd * 6.3, fl = uWd.z * (sin(uT * 2.3 + ph) + .6 * sin(uT * 4.1 + ph * 1.7)) * .25 * c.x;   // the cluster flutters
  vec3 p = a0.xyz + U * c.x * a0.w + W * c.y * asp * a0.w + N * fl * a0.w + sway(a0.xyz);
  uv = vec2(c.x, c.y * asp); pw = p; nn = normalize(N + W * fl * 3.); ci = vec4(ty, fract(a1.w) / .98, floor(a2.w), sd);
  vec4 v = uV * vec4(p, 1.); vz = -v.z; gl_Position = proj(v.xyz);
}`;
// What a card shows. u.x runs from the twig's base (0) to its tip (1); u.y is across it.
const MASK = `
in vec2 uv; in vec3 pw; in float vz; flat in vec3 nn; flat in vec4 ci;
// far away, a pattern finer than a few pixels is drawn coarser instead of being left to shimmer
float lod(float per, float fw) { return per * exp2(ceil(log2(max(fw * 6. / per, 1.)))); }
float mask(vec2 u, int ty, float sd, out float vein) {
  vein = 0.; float fw = fwidth(u.x) + fwidth(u.y);
` + (TIER > 3 ? FLW : '') + `
  if (ty == 1) {                                             // needle spray: needles sweeping forward off both sides of a twig
    // side twigs off a main twig, each lined with needles; from far away only the twigs' outline is drawn
    float y = abs(u.y), xs = u.x - y * .8, per = lod(.1, fw), len = .47 * smoothstep(1.02, .78, u.x) * (.8 + .2 * sin(u.x * 31. + sd * 9.)), ff = abs(fract(xs / per) - .5) * 2.;
    float twig = step(ff, .74 * (1. - y / len)) * step(y, len) * step(.02, xs), nd = fw < .0022 ? max(step(abs(fract((u.x + y * .6) / .02 + h1(floor(xs / per) + sd * 17.) + step(0., u.y) * .37) - .5), ` + (TIER > 3 ? 'mix(.22, .4, smoothstep(.0003, .0012, fw))' : '.4') + `), step(ff, .16)) : 1.;
` + (TIER > 3 ? '    LF = vec4((fract((u.x + y * .6) / .02 + h1(floor(xs / per) + sd * 17.) + step(0., u.y) * .37) - .5) / mix(.22, .4, smoothstep(.0003, .0012, fw)), y / max(len, 1e-3), h1(floor(xs / per) + sd * 17.), 1.);\n    if (fw < .0022) { float ac = (fract(xs / per) - .5) * per, hit = 0.; vec2 P = vec2(ac, y); LF.w = -1.; for (int k = -1; k <= 1; k++) for (int sg = 0; sg < 2; sg++) { float c = floor(y / .005) + float(k), hn = h1(c * 1.7 + float(sg) * 9.1 + floor(xs / per) * 3.3 + sd * 17.), b0 = (c + hn * .5) * .005; if (b0 < 0. || b0 > len) continue; float th = (.5 + .5 * hn) * (float(sg) * 2. - 1.), w = max(.0011, fw * .7); vec2 dv = vec2(sin(th), cos(th)) * (.016 + .01 * fract(hn * 7.)), pa = P - vec2(0., b0); float t = clamp(dot(pa, dv) / dot(dv, dv), 0., 1.), d = length(pa - dv * t), ww = w * (1. - t * .7); if (d < ww) { hit = 1.; LF = vec4(d / ww * sign(dot(pa, vec2(dv.y, -dv.x))), t, hn, 1.); } } return max(max(hit, step(abs(ac), .0011) * step(y, len)), step(y, .0045) * step(u.x, .98)); }' : '') + `
    return max(twig * nd, step(y, .012) * step(u.x, .98));
  }
  if (ty == 3) {                                             // fern frond: pinnae that shorten toward the tip
    float y = abs(u.y), xs = u.x - y * .35, per = lod(.055, fw), len = .5 * pow(sin(3.1416 * pow(clamp(u.x, 0., 1.), .55)), .8), f = abs(fract(xs / per) - .5) * 2.;
    vein = step(f, .12);` + (TIER > 3 ? ' LF = vec4(f / max(.78 * (1. - y / len), 1e-3), y / max(len, 1e-3), floor(xs / per), 3.);' : '') + `
    return max(step(f, .78 * (1. - y / len)` + (TIER > 3 ? ' * (1. - smoothstep(per * .15, per * .05, fw) * .35 * pow(abs(sin(y / per * 11.)), .7))' : '') + `) * step(y, len) * step(.04, xs), step(y, .01) * step(u.x, .97));
  }
  if (ty >= 4) {                                             // grass tuft, or a fan of long needles: blades radiating from the base
    float r = length(u), a = atan(u.y, u.x), da = lod(ty == 4 ? .26 : .12, fw / max(r, .08)), k = floor(a / da + .5), bl = ty == 4 ? .5 + .5 * h1(k + sd * 31.) : .8 + .2 * h1(k + sd * 31.);` + (TIER > 3 ? ' LF = vec4((a / da - k) / max((ty == 4 ? .34 : .24) * (1. - r / bl), 1e-3), r / bl, h1(k + sd * 31.), 4.);' : '') + `
    return step(abs(a / da - k), (ty == 4 ? .34 : .24) * (1. - r / bl)) * step(r, bl) * step(abs(a), ty == 4 ? 1.25 : 1.5);
  }
  float per = ty == 0 ? .21 : .15, L = ty == 0 ? .34 : .17, W = ty == 0 ? .095 : .075, m = 0.;   // broad or small round leaves, alternate along a twig
  for (int j = 0; j < 2; j++) {
    float c = floor(u.x / per) - float(j); if (c < 0. || c > 1. / per - 1.5) continue;
    float an = (mod(c, 2.) * 2. - 1.) * (.95 + .35 * (h1(c * 7.3 + sd * 91.) - .5)); vec2 dl = u - vec2((c + .5) * per, 0.), l = vec2(cos(an) * dl.x + sin(an) * dl.y, cos(an) * dl.y - sin(an) * dl.x);
    float t = clamp(l.x / L, 0., 1.), hw = W * (ty == 0 ? sin(3.1416 * pow(t, .7)) * (1. + .12 * sin(t * 38.)) : sqrt(max(0., 1. - pow(2. * t - 1.05, 2.))));` + (TIER > 3 ? `
    float kk = smoothstep(L * .03, L * .012, fw); if (kk > 0.) { hw *= 1. - kk * .1 * pow(fract(t * (ty == 0 ? 22. : 14.) + .3), 2.);   // a toothed margin, and holes something has eaten
      vec3 hv = vor(vec2(l.x / L * 11., l.y / W * 3.) + c * 7.13 + sd * 3.); if (h1(c * 3.7 + sd * 13.) < .35 && hv.z < .07 && hv.x < .38 * kk) hw = 0.; }` : '') + `
    if (l.x > 0. && l.x < L && abs(l.y) < hw) { m = 1.; vein = max(vein, step(abs(l.y), .006));` + (TIER > 3 ? ' LF = vec4(t, l.y / max(hw, 1e-4), h1(c * 3.7 + sd * 13.), 0.);' : '') + ` }
  }
  return max(m, step(abs(u.y), .008) * step(u.x, .95));
}`;
const CRDS = PRE + MASK + `void main() { float v; if (mask(uv, int(ci.x + .5), ci.w, v) < .5) discard; }`;
const CRDF = PRE + MASK + `
uniform vec3 uLA[8], uLB[8]; out vec4 o;
void main() {
  float vein; if (mask(uv, int(ci.x + .5), ci.w, vein) < .5) discard;
  int sp = int(ci.z + .5); vec3 n = nn; if (dot(n, uCam - pw) < 0.) n = -n;
  vec3 alb = mix(uLA[sp], uLB[sp], clamp(ci.w * .7 + h1(floor(uv.x * 5.) + ci.w * 57.) * .5 - .1, 0., 1.)) * (.85 + .3 * vein);
` + (TIER > 3 ? ' DEW = max(smoothstep(.5, .15, uSun.y), uWx.x) * (1. - uWx.y);' + SEAF + LEAFD : '') + `
  float nl = dot(n, uSun), sh = shd(pw, n * sign(nl + 1e-4));
  // lit from the front, or glowing with the sun behind it
  vec3 c = wxa(alb, pw, vec3(0., abs(n.y), 0.)) * (uSunC * (max(nl, 0.) * .85 + max(-nl, 0.) * .7 * vec3(1.15, 1.2, .55)) * sh * cshd(pw) * (.5 + .5 * ci.y) + amb(n, .35 + .65 * ci.y));` + (TIER > 3 ? ' c = c * (1. - .4 * bv * smoothstep(0., -.3, nl)) + uSunC * spec(n, pw, gl0 > 1. ? 300. : 40.) * gl0 * .3 * sh * cshd(pw);' : '') + `
  o = vec4(fogc(c, pw), vz / 300.);
}`;

const QV = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const SKYF = PRE + `in vec2 v; out vec4 o; void main() { o = vec4(` + (TIER > 2 ? 'skyc' : 'sky') + `(normalize(uIV * vec3((v * 2. - 1.) / uK, -1.))), 1.); }`;
// light shafts: walk each view ray and count how much of the misty air along it is in sunlight
const RAYF = PRE + `in vec2 v; uniform sampler2D uA; out vec4 o;
void main() {
  float z = texture(uA, v).a * 300., L = min(z, 110.), acc = 0., jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
  vec3 rd = uIV * vec3((v * 2. - 1.) / uK, -1.);
  for (int i = 0; i < 14; i++) {
    vec3 p = uCam + rd * L * (float(i) + jit) / 14.; vec4 s = uSM * vec4(p, 1.);
    float sh = s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1. ? 1. : texture(uSh, vec3(s.xy, s.z - .001));
    acc += sh * exp(-max(p.y - uFog.z, 0.) * uFog.y);
  }
  float mu = max(dot(normalize(rd), uSun), 0.);
  o = vec4(vec3(acc / 14. * (1. - exp(-L * uFog.x * 1.1)) * (.2 + 1.8 * pow(mu, 5.))), 1.);
}`;
const DOWN = `#version 300 es
precision highp float; in vec2 v; uniform sampler2D uA; uniform vec2 uP; out vec4 o;
void main() { o = .25 * (texture(uA, v + uP * vec2(-1., -1.)) + texture(uA, v + uP * vec2(1., -1.)) + texture(uA, v + uP * vec2(-1., 1.)) + texture(uA, v + uP)); }`;
const POST = `#version 300 es
precision highp float; in vec2 v; uniform sampler2D uA, uB, uC, uD, uG; uniform vec2 uP; uniform vec4 uO; uniform vec3 uSC; out vec4 o;   // uO: focus, aperture, shaft strength, time
vec4 t4(sampler2D s, float m) { vec2 d = uP * m; return .25 * (texture(s, v + d * vec2(-1., -1.)) + texture(s, v + d * vec2(1., -1.)) + texture(s, v + d * vec2(-1., 1.)) + texture(s, v + d)); }
void main() {
  vec4 S = texture(uA, v); S.rgb = .65 * S.rgb + .35 * t4(uA, .75).rgb;
  vec4 B1 = t4(uB, 1.5), B2 = t4(uC, 3.5), B3 = .5 * (t4(uD, 7.) + t4(uD, 3.));   // wide taps, so the coarse levels do not show their texels
  float z = min(S.a, mix(S.a, B2.a, .7)) * 300., k = clamp(uO.y * abs(1. / uO.x - 1. / z), 0., 3.);       // out of focus, in blur levels
  vec3 c = k < 1. ? mix(S.rgb, B1.rgb, k) : k < 2. ? mix(B1.rgb, B2.rgb, k - 1.) : mix(B2.rgb, B3.rgb, k - 2.);
  c *= 1. - .35 * clamp((S.a - B2.a) / max(S.a, 1e-3) * 4., 0., 1.);                                    // darker just behind anything nearer
  c += uSC * t4(uG, 5.).r * uO.z;
  vec3 bl = B1.rgb * .3 + B2.rgb * .35 + B3.rgb * .35; c += bl * .1 + max(bl - 1.2, 0.) * .4;
  c *= .85; c = clamp(c * (2.51 * c + .03) / (c * (2.43 * c + .59) + .14), 0., 1.); c = pow(c, vec3(.4545));
  vec2 w = v - .5; c *= 1. - .45 * dot(w, w);
  c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy + uO.w * 60., vec2(.06711056, .00583715)))) - .5) / 140.;
  o = vec4(c, 1.);
}`;

const COMMON = ['uV', 'uSM', 'uIV', 'uK', 'uR', 'uNF', 'uOr', 'uT', 'uMoss', 'uCam', 'uSun', 'uSunC', 'uSkyC', 'uHorC', 'uFog', 'uWd', 'uSh', 'uWx', 'uSe'];
if (TIER > 3) COMMON.push('uCv');
// how far away the surface under a point on the screen is: the view depth the main pass stored beside the colour
export let pick;
export function mkRenderer(canvas, low) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const hdr = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'), SMS = low ? 1024 : 2048;
  const prog = (vs, fs, names = []) => {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 3).join('\n')); gl.attachShader(p, s); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = { p }; for (const n of [...COMMON, ...names]) U[n] = gl.getUniformLocation(p, n); return U;
  };
  const PC = prog(CAPV, CAPF, ['uBA', 'uBB', 'uBP', ...(TIER > 3 ? ['uLB'] : [])]), PCS = prog(CAPV, CAPS), PM = prog(MSHV, MSHF, ['uMat', 'uRA', 'uRB', 'uLit', 'uLa', ...(TIER > 3 ? ['uNdl', 'uFor', 'uLeaf', 'uStr'] : [])]), PMS = prog(MSHV, NONE, ['uMat']);
  const PK = prog(CRDV, CRDF, ['uLA', 'uLB']), PKS = prog(CRDV, CRDS), PSK = prog(QV, SKYF), PR = prog(QV, RAYF, ['uA']), PD = prog(QV, DOWN, ['uA', 'uP']), PP = prog(QV, POST, ['uA', 'uB', 'uC', 'uD', 'uG', 'uP', 'uO', 'uSC']);
  const tex = (f) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  // shadow map
  const sm = tex(gl.LINEAR), smf = gl.createFramebuffer();
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SMS, SMS, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, smf); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, sm, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  // colour targets: the scene (depth kept in alpha), three halvings of it, and the light shafts at quarter size
  const T = [0, 1, 2, 3, 2].map((s) => ({ t: tex(gl.LINEAR), f: gl.createFramebuffer(), s, w: 0, h: 0 })), rb = gl.createRenderbuffer();
  const size = (w, h) => {
    for (const x of T) {
      x.w = Math.max(1, w >> x.s); x.h = Math.max(1, h >> x.s); gl.bindTexture(gl.TEXTURE_2D, x.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, x.w, x.h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, x.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, x.t, 0);
    }
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T[0].f); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  };
  const inst = (first) => { for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(first + i); gl.vertexAttribPointer(first + i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(first + i, 1); } };
  const vQ = gl.createVertexArray(); let W = null;
  // above the 20 kB rung: water, things in the air, and a buffer of limbs that is rewritten every frame
  const PW = TIER > 2 && prog(PRE + WATV, PRE + WATF), PPT = TIER > 2 && prog(PRE + PTV, PRE + PTF, ['uPt']), lv = TIER > 2 && gl.createVertexArray(), lb = TIER > 2 && gl.createBuffer(); let ln = 0;
  if (TIER > 2) { gl.bindVertexArray(lv); gl.bindBuffer(gl.ARRAY_BUFFER, lb); gl.bufferData(gl.ARRAY_BUFFER, 1500 * 48, gl.DYNAMIC_DRAW); inst(0); gl.bindVertexArray(null); }
  const free = () => { if (!W) return; for (const b of W.bufs) gl.deleteBuffer(b); for (const v of W.vaos) gl.deleteVertexArray(v); };
  const com = (P, f, view, K, R, or, nf) => {
    gl.useProgram(P.p); gl.uniformMatrix4fv(P.uV, false, view); gl.uniformMatrix4fv(P.uSM, false, f.SM); gl.uniformMatrix3fv(P.uIV, false, f.IV);
    gl.uniform2f(P.uK, K[0], K[1]); gl.uniform2f(P.uR, R[0], R[1]); gl.uniform2f(P.uNF, nf[0], nf[1]); gl.uniform1f(P.uOr, or); gl.uniform1f(P.uT, f.t); gl.uniform1f(P.uMoss, f.moss);
    gl.uniform3fv(P.uCam, f.cam); gl.uniform3fv(P.uSun, f.sun); gl.uniform3fv(P.uSunC, f.sunC); gl.uniform3fv(P.uSkyC, f.skyC); gl.uniform3fv(P.uHorC, f.horC); gl.uniform3fv(P.uFog, f.fog); gl.uniform3fv(P.uWd, f.wd);
    gl.uniform1i(P.uSh, 1); gl.uniform4fv(P.uWx, f.wx); gl.uniform4fv(P.uSe, f.se); if (TIER > 3) gl.uniform2fv(P.uCv, f.cv || [0, 0]);
  };
  if (TIER > 3) pick = (u, v) => {
    const t = T[0]; if (!t || !t.w) return 0; gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.f);
    const b = hdr ? new Float32Array(4) : new Uint8Array(4); gl.readPixels(Math.floor(u * t.w), Math.floor(v * t.h), 1, 1, gl.RGBA, hdr ? gl.FLOAT : gl.UNSIGNED_BYTE, b);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); return b[3] * (hdr ? 300 : 300 / 255);
  };
  return {
    hdr: !!hdr,
    life: TIER > 2 && ((data, n) => { ln = n; if (n) { gl.bindBuffer(gl.ARRAY_BUFFER, lb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 12); } }),
    // take a grown plot: upload its buffers
    load(B, G) {
      free(); const bufs = [], vaos = [];
      const buf = (data, target = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); bufs.push(b); return b; };
      const vao = () => { const v = gl.createVertexArray(); gl.bindVertexArray(v); vaos.push(v); return v; };
      const quads = (data) => { const v = vao(); buf(data); inst(0); return { v, n: data.length / 12 }; };
      const mesh = (m, instances) => {
        const v = vao(); buf(m.v);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
        if (instances) { buf(instances); inst(3); }
        buf(m.i, gl.ELEMENT_ARRAY_BUFFER); return { v, n: m.i.length, k: instances ? instances.length / 12 : 0 };
      };
      W = { bufs, vaos, caps: quads(B.caps), cards: quads(B.cards), land: mesh(B.land), nTop: B.land.nTop, stones: B.stones.map((m, i) => mesh(m, B.rocks[i])), water: TIER > 2 && B.water && mesh(B.water), pal: B.pal, G };
      if (TIER > 3) W.str = B.strm && B.strm.ero ? [B.strm.ero.top, B.strm.ero.bot, 1] : [0, 0, 0];   // the rock bed a gorge cuts through
      if (TIER > 3) { W.far = B.far && mesh(B.far); W.farWater = B.farWater && mesh(B.farWater); const tot = G.trees.reduce((s, t) => s + (t.gone ? 0 : t.n), 0) || 1; W.for = [0, 1, 2].map((c) => G.trees.reduce((s, t) => s + (t.gone ? 0 : (t.leaf.a[c] + t.leaf.b[c]) * 0.5 * t.n), 0) / tot); }
      gl.bindVertexArray(null);
    },
    // f: { V, K, IV, cam, sun, sunC, skyC, horC, fog, wd, t, moss, SM, LV, LK, LNF, focus, shadow }
    draw(f) {
      const w = canvas.width, h = canvas.height; if (T[0].w !== w || T[0].h !== h) size(w, h);
      const G = W.G, pal = W.pal;
      const geometry = (PMx, PCx, PKx, view, K, R, or, nf, shadow) => {
        com(PMx, f, view, K, R, or, nf);
        if (!shadow) { gl.uniform3fv(PMx.uRA, G.land.ra); gl.uniform3fv(PMx.uRB, G.land.rb); gl.uniform3fv(PMx.uLit, G.floor.lit); gl.uniform1f(PMx.uLa, G.floor.la); if (TIER > 3) { gl.uniform1f(PMx.uLeaf, G.world === 'leaf' ? 1 : G.world === 'bark' ? 2 : G.world === 'range' ? 3 : G.world === 'lake' ? 4 : G.world === 'cave' ? 5 : 0); gl.uniform3fv(PMx.uStr, W.str); } if (TIER > 3) gl.uniform1f(PMx.uNdl, G.trees.reduce((s, t) => s + (t.leaf.t === 1 ? t.n : 0), 0) / Math.max(1, G.trees.reduce((s, t) => s + t.n, 0))); }
        gl.bindVertexArray(W.land.v); gl.uniform1f(PMx.uMat, 1); gl.drawElements(gl.TRIANGLES, W.nTop, gl.UNSIGNED_SHORT, 0);
        if (!shadow) { gl.uniform1f(PMx.uMat, 2); gl.drawElements(gl.TRIANGLES, W.land.n - W.nTop, gl.UNSIGNED_SHORT, W.nTop * 2); }
        if (TIER > 3 && !shadow && W.far) { gl.bindVertexArray(W.far.v); gl.uniform1f(PMx.uMat, 3); gl.uniform3fv(PMx.uFor, W.for); gl.drawElements(gl.TRIANGLES, W.far.n, gl.UNSIGNED_SHORT, 0); }
        gl.uniform1f(PMx.uMat, 0); for (const s of W.stones) if (s.k) { gl.bindVertexArray(s.v); gl.drawElementsInstanced(gl.TRIANGLES, s.n, gl.UNSIGNED_SHORT, 0, s.k); }
        com(PCx, f, view, K, R, or, nf); if (!shadow) { gl.uniform3fv(PCx.uBA, pal.ba); gl.uniform3fv(PCx.uBB, pal.bb); gl.uniform4fv(PCx.uBP, pal.bp); if (TIER > 3) gl.uniform3fv(PCx.uLB, pal.lb); }
        gl.bindVertexArray(W.caps.v); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, W.caps.n);
        if (TIER > 2 && ln) { gl.bindVertexArray(lv); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ln); }
        com(PKx, f, view, K, R, or, nf); if (!shadow) { gl.uniform3fv(PKx.uLA, pal.la); gl.uniform3fv(PKx.uLB, pal.lb); }
        gl.bindVertexArray(W.cards.v); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, W.cards.n);
        if (TIER > 2 && !shadow && W.water) { com(PW, f, view, K, R, or, nf); gl.bindVertexArray(W.water.v); gl.drawElements(gl.TRIANGLES, W.water.n, gl.UNSIGNED_SHORT, 0); }
        if (TIER > 3 && !shadow && W.farWater) { com(PW, f, view, K, R, or, nf); gl.bindVertexArray(W.farWater.v); gl.drawElements(gl.TRIANGLES, W.farWater.n, gl.UNSIGNED_SHORT, 0); }
      };
      gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sm); gl.activeTexture(gl.TEXTURE0);
      if (f.shadow) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, smf); gl.viewport(0, 0, SMS, SMS); gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
        geometry(PMS, PCS, PKS, f.LV, f.LK, [SMS, SMS], 1, f.LNF, 1);
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      const nf = TIER > 3 ? f.nf : [0.1, 600], R = [w, h];
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[0].f); gl.viewport(0, 0, w, h); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST); com(PSK, f, f.V, f.K, R, 0, nf); gl.bindVertexArray(vQ); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.DEPTH_TEST);
      geometry(PM, PC, PK, f.V, f.K, R, 0, nf, 0);
      if (TIER > 2 && f.pts.length) {                                    // the air: drawn over the scene, hidden by what is nearer, leaving the stored depth alone
        gl.enable(gl.BLEND); gl.depthMask(false); com(PPT, f, f.V, f.K, R, 0, nf); gl.bindVertexArray(vQ);
        for (const p of f.pts) { gl.blendFuncSeparate(gl.SRC_ALPHA, p[0] === 3 ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.uniform4fv(PPT.uPt, p); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, p[3]); }
        gl.disable(gl.BLEND); gl.depthMask(true);
      }
      gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(vQ);
      gl.useProgram(PD.p); gl.uniform1i(PD.uA, 0);
      for (let i = 1; i < 4; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, T[i].f); gl.viewport(0, 0, T[i].w, T[i].h); gl.bindTexture(gl.TEXTURE_2D, T[i - 1].t); gl.uniform2f(PD.uP, 1 / T[i - 1].w, 1 / T[i - 1].h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[4].f); gl.viewport(0, 0, T[4].w, T[4].h); com(PR, f, f.V, f.K, [T[4].w, T[4].h], 0, nf); gl.bindTexture(gl.TEXTURE_2D, T[2].t); gl.uniform1i(PR.uA, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.useProgram(PP.p);
      ['uA', 'uB', 'uC', 'uD', 'uG'].forEach((n, i) => { gl.activeTexture(gl.TEXTURE0 + (i ? i + 1 : 0)); gl.bindTexture(gl.TEXTURE_2D, T[i].t); gl.uniform1i(PP[n], i ? i + 1 : 0); });
      gl.uniform2f(PP.uP, 1 / w, 1 / h); gl.uniform4f(PP.uO, f.focus, TIER > 3 ? 2.5 * Math.min(1, 0.25 + f.focus / 4) : 2.5, f.shafts, f.t); gl.uniform3fv(PP.uSC, f.sunC);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0);
    },
  };
}
