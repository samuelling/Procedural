// Everything above the 20 kB rung: weather, clouds, water, particles in the air, and animals.
// The shader chunks here are spliced into the renderer's programs; the rest is the life that walks and flies.
/* global TIER */
import { mutate } from './genome.js';
const { sin, cos, min, max, hypot, atan2, abs, PI, floor } = Math, TAU = PI * 2;

// ---- weather, as rules every surface obeys. uWx: wetness, snow cover, cloud cover, rain on the water.
// uSe: autumn, leaf fall, night, spare.
export const WX3 = `
uniform vec4 uWx, uSe;
float gst(vec3 p) { return .5 + 1.2 * vn(p.xz * .035 - uT * .22 * uWd.xy); }               // gusts cross the plot as fronts
float cn(vec2 p) { return .55 * vn(p) + .3 * vn(p * 2.3 + 7.) + .15 * vn(p * 5.1 + 3.); }
// clouds are a sheet of noise 900 m up that drifts with the wind; cover decides how much of it is cloud
float cdn(vec2 q) { return smoothstep(1.02 - uWx.z, 1.34 - uWx.z, cn(q * .0011 + uT * .004 * uWd.xy) + .22 * cn(q * .0043 - uT * .005) + .2); }
float cshd(vec3 p) { vec2 q = (p.xz + uSun.xz / max(uSun.y, .1) * (900. - p.y)) * .0011 + uT * .004 * uWd.xy; return 1. - .85 * smoothstep(1.02 - uWx.z, 1.34 - uWx.z, .6 * vn(q) + .4 * vn(q * 2.3 + 7.) + .24); }   // a cloud's shadow, where the sun's ray to this point passes through it
float star(vec3 d) { vec3 c = floor(d * 140.); return step(.9965, h3(c)) * smoothstep(.5, .0, length(fract(d * 140.) - .5)) * (.5 + .5 * sin(uT * 2. + h3(c + 3.) * 40.)); }
vec3 skyc(vec3 d) {
  vec3 c = sky(d);
  c += min(uSe.z, 1.) * vec3(.9, .95, 1.) * star(d) * smoothstep(0., .15, d.y);
  if (uSe.z > 1.01) {                                                      // far north: curtains of aurora, rayed, slowly folding
    float a = atan(d.x, d.z);
    c += (uSe.z - 1.) * 1.7 * vec3(.1, .9, .5) * pow(vn(vec2(a * 3. + uT * .03, uT * .02)), 3.) * smoothstep(.08, .22, d.y) * smoothstep(.95, .3, d.y) * (.4 + vn(vec2(a * 40., uT * .1 + d.y * 2.)));
  }
  float rb = uWx.x * (1. - uWx.w) * smoothstep(.75, .4, uWx.z) * step(0., d.y);                                    // wet air, sun out: a rainbow, 42 degrees round the point opposite the sun
  if (rb > .01) { float t = (acos(clamp(-dot(d, uSun), -1., 1.)) - .7) / .045; c += rb * .35 * (.5 + .5 * cos(6.283 * (t * .8 + vec3(0., .33, .67)))) * smoothstep(0., .25, t) * smoothstep(1., .75, t) * length(uSunC) * .4; }         // night: stars (the moon is the light itself, so the sky already draws its disc)
  if (d.y < .015) return c;
  vec2 q = uCam.xz + d.xz / d.y * 900.; float a = cdn(q), b = cdn(q + uSun.xz * 300.);   // b: how much cloud lies between this one and the sun
  vec3 cc = mix(uSunC * .32 + uSkyC * .75 + .04, (uSkyC + uHorC) * .3, clamp(b * 1.2 + uWx.z * .45 - .2, 0., 1.));
  return mix(c, cc, a * smoothstep(.015, .14, d.y));
}
vec3 wxa(vec3 a, vec3 p, vec3 n) {
  a *= 1. - .42 * uWx.x;                                                   // wet things are darker
  return mix(a, vec3(.8, .86, .95), smoothstep(.38, .6, n.y * .6 + vn3(p * 3.) * .3 + uWx.y * 1.15 - .78));   // snow settles on whatever faces up
}
`;

// ---- water: a strip of surface along the stream. The bed is computed, not drawn: gravel seen through moving glass.
export const WATV = `
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aX;
out vec3 pw; out vec2 xx; out float vz;
void main() { pw = aP; xx = aX; vec4 v = uV * vec4(pw, 1.); vz = -v.z; gl_Position = proj(v.xyz); }`;
// water close: fine capillary ripples, pebbles on the bed, specks of pollen and seed drifting downstream
export const WATD = `
  FP = vz / (uK.y * uR.y * .5) / max(dot(vec3(0., 1., 0.), normalize(uCam - pw)), .15);
  if (FP < .006) { float k = vis(.01); vec2 cp = pw.xz * 60. - vec2(uT * 3., 0.); n = normalize(n + vec3(vn(cp) - .5, 0., vn(cp + 9.) - .5) * .12 * k); }
`;
export const WATD2 = `
  if (FP < .006) {
    float k = vis(.012); vec3 pb = vor(bp * 22.); bed *= mix(1., (.6 + .6 * pb.z) * (.6 + .4 * smoothstep(0., .1, pb.y)) * (.85 + .25 * smoothstep(.6, 0., pb.x)), k);   // rounded pebbles, a little dark where they touch
  }
`;
export const WATD3 = `
  if (FP < .006) { vec3 sk = vor((pw.xz - vec2(uT * .25, 0.)) * 40.); float m = step(sk.z, .04) * smoothstep(.16, .08, sk.x) * vis(.004); c = mix(c, mix(vec3(.75, .65, .2), vec3(.3, .2, .1), step(.02, sk.z)) * (amb(vec3(0., 1., 0.), 1.) + uSunC * .6), m); }
`;
// water seen from below: within 48.6° of straight up, the sky (Snell's window); beyond it, the surface mirrors the
// dim water under it
export const WATU = `
  if (uCam.y < pw.y - .02) { vec3 v = normalize(pw - uCam), vt = normalize(vec3(v.x * .75, v.y, v.z * .75)); float cw = smoothstep(.6, .7, v.y + (n.x + n.z) * .25);
    vec3 tr = skyc(vt) * 1.3 + uSunC * pow(max(dot(vt, uSun), 0.), 30.) * 1.5; o = vec4(fogc(mix(uHorC * .45 * (.8 + .4 * vn(pw.xz * 2. + uT * .3)), tr, cw), pw), vz / 300.); return; }
`;
// water steep enough to fall: white, streaming down
export const FALLS = `
  { vec3 gn = cross(dFdx(pw), dFdy(pw)); float st = dot(gn, gn) > 1e-12 ? smoothstep(.85, .35, abs(normalize(gn).y)) : 0.;
    c = mix(c, vec3(.86, .9, .92) * (amb(n, 1.) + uSunC * sh * .6) * (.75 + .35 * vn(vec2(pw.x * 4. + pw.z * 4., pw.y * 1.5 + uT * 5.))), st * .9); c *= 1. - step(2., uCv.y) * .9; }
`;
export const WATF = `
in vec3 pw; in vec2 xx; in float vz; out vec4 o;
float wv(vec2 p) {
  float r = 0.; vec2 c = floor(p * 1.4), f = fract(p * 1.4) - .5; float ph = fract(uT * .9 + h2(c));              // rain: a ring spreading in each cell
  if (uWx.w > .01) r = uWx.w * .5 * sin(clamp(length(f) * 9. - ph * 4.5, -3.14, 0.) * 4.) * (1. - ph);
  return vn(p * 3. - vec2(uT * .9, 0.)) + .5 * vn(p * 7.3 + vec2(-uT * 1.5, uT * .25)) + .25 * vn(p * 17. - vec2(uT * 2.2, uT * .4)) + r;
}
void main() {
  if (xx.x < 0.) discard;                                                  // the bank
  float d = xx.x, w0 = wv(pw.xz), e = .06;
  vec3 n = normalize(vec3((w0 - wv(pw.xz + vec2(e, 0.))) * .28, 1., (w0 - wv(pw.xz + vec2(0., e))) * .28));` + (TIER > 3 ? WATD + WATU : '') + `
  vec3 vd = normalize(uCam - pw), rd = reflect(-vd, n);
  rd.y = abs(rd.y);
  float fr = .03 + .97 * pow(1. - max(dot(n, vd), 0.), 5.), sh = shd(pw, vec3(0., 1., 0.)), cs = cshd(pw);
  vec2 bp = pw.xz + n.xz * d * 1.5;                                        // where the bent ray meets the bed
  vec3 bed = mix(vec3(.2, .16, .1), vec3(.5, .45, .34), smoothstep(.3, .7, vn(bp * 8.))) * (.55 + .6 * vn(bp * 27.));
  bed = mix(bed, vec3(.1, .16, .05), smoothstep(.5, .75, vn(bp * 2.3 + 5.)) * .7);                                  // weed on the stones
` + (TIER > 3 ? WATD2 : '') + `
  float ca = pow(abs(vn(bp * 5. + uT * .6) - vn(bp * 5.3 - uT * .5)), .5);                                       // light gathered by the ripples
  bed = bed * (uSunC * sh * cs * (.35 + .9 * (1. - ca)) * max(uSun.y, 0.) + amb(vec3(0., 1., 0.), 1.)) * exp(-d * vec3(3.2, 1.7, 2.4));
  vec3 rf = mix(vec3(.015, .03, .015) + amb(vec3(0., 1., 0.), .22) * vec3(.3, .5, .2), skyc(rd), smoothstep(.2, .75, rd.y + .25 * vn(pw.xz * 1.3)) * (.35 + .65 * sh));   // in shade it mirrors the canopy, in the open the sky
  vec3 c = mix(bed + vec3(.02, .05, .04) * (1. - exp(-d * 4.)), rf, fr) + uSunC * sh * cs * pow(max(dot(rd, uSun), 0.), 260.) * 4.;
  c = mix(c, vec3(.75, .8, .8) * (amb(n, 1.) + uSunC * sh * cs * .3), smoothstep(.07, .0, d) * smoothstep(.35, .65, vn(pw.xz * 14. - vec2(uT * 1.2, 0.))) * .8);   // a line of foam at the edge
` + (TIER > 3 ? WATD3 + FALLS : '') + `
  c = mix(c, vec3(.78, .84, .92) * (amb(n, 1.) + uSunC * sh * .5), smoothstep(.72, .98, uWx.y) * .92);              // deep winter: ice
  o = vec4(fogc(c, pw), vz / 300.);
}`;

// ---- things in the air, placed by formula from their own index: no buffers. uPt: kind, size, strength, count.
// 1 rain  2 snow  3 fireflies  4 falling leaves  5 seeds and insects in the sun
export const PTV = `
uniform vec4 uPt; out vec2 uv; out float al; flat out float id;
void main() {
  float i = float(gl_InstanceID), k = uPt.x; id = i;
  vec3 r = vec3(h1(i), h1(i + .37), h1(i + .71)), S = k > 2.5 ? vec3(40., k > 3.5 ? 16. : 5., 40.) : vec3(34., 20., 34.);   // the box of air around the eye that holds them
  vec3 ve = k < 1.5 ? vec3(uWd.x * 2.5, -11., uWd.y * 2.5) : k < 2.5 ? vec3(uWd.x * .8, -1.2, uWd.y * .8) : k < 3.5 ? vec3(0.) : vec3(uWd.x * .5, k < 4.5 ? -.9 : .02, uWd.y * .5);
  vec3 wb = k < 1.5 ? vec3(0.) : k < 2.5 ? vec3(sin(uT * 1.1 + i), 0., cos(uT * .9 + i * 1.7)) * .35 : vec3(sin(uT * .5 + i * 3.), .4 * sin(uT * .7 + i), cos(uT * .4 + i * 5.)) * (k < 3.5 ? 1.6 : .6);
  vec3 c0 = uCam + vec3(0., k > 2.5 && k < 3.5 ? 1. : k > 3.5 ? 5. : 6., 0.), p = mod(r * S + ve * uT + wb - c0, S) - S * .5 + c0;
  vec4 v = uV * vec4(p, 1.); vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2. - 1.;
  al = smoothstep(.25, 1.6, -v.z) * (1. - smoothstep(S.x * .38, S.x * .5, length(p.xz - uCam.xz))) * uPt.z; uv = c;
  if (k < 1.5) { vec4 v2 = uV * vec4(p + normalize(ve) * .55, 1.); vec2 dr = normalize(v2.xy - v.xy + 1e-5); v.xyz = mix(v.xyz, v2.xyz, c.x * .5 + .5) + vec3(-dr.y, dr.x, 0.) * c.y * uPt.y; }
  else { float a = k > 3.5 && k < 4.5 ? uT * 3. + i : 0.; v.xy += mat2(cos(a), sin(a), -sin(a), cos(a)) * (c * vec2(1., k > 3.5 && k < 4.5 ? .55 : 1.)) * uPt.y * (.6 + .8 * r.z); }
  gl_Position = proj(v.xyz);
}`;
export const PTF = `
uniform vec4 uPt; in vec2 uv; in float al; flat in float id; out vec4 o;
void main() {
  float d = length(uv), k = uPt.x, a; vec3 c;
  if (k < 1.5) { a = (1. - abs(uv.y)) * .22; c = uSkyC + uHorC * .8 + .05; }
  else if (k < 2.5) { a = smoothstep(1., .35, d) * .9; c = uSkyC * 1.1 + uHorC * .9 + uSunC * .12 + .03; }
  else if (k < 3.5) { a = exp(-d * d * 5.) * pow(.5 + .5 * sin(uT * 2.3 + id * 7.), 6.); c = vec3(.75, 1., .25) * 5.; }
  else if (k < 4.5) { a = step(d, 1.); c = mix(vec3(.5, .2, .03), vec3(.75, .5, .06), h1(id)) * (uSunC * .25 + uSkyC + uHorC * .5); }
  else { a = exp(-d * d * 4.) * .7; c = uSunC * .5 + uHorC * .4; }
  if (a * al < .004) discard;
  o = vec4(c, a * al);
}`;

// ---- life. Animals are drawn with the same tapered capsules as the trees: twelve numbers per limb.
// Each one carries its own needs (hunger, thirst, tiredness), an age, a lifespan and two inherited genes, and chooses
// what to do from them. Nothing here is scripted: a hunt, a birth or a death in the snow happens when the numbers bring it about.
const LIMB = 12, MAXL = 1500;
const NM1 = 'Al Bri Ca Da El Fa Ha Is Ka Li Mo Ne Or Ra Sa Ta Ur Va Wy Yo'.split(' '), NM2 = 'ba da ra na la ric wen mund ka so li th gar ne ya ro'.split(' ');
// a kind of animal: name, lifespan in years, age of maturity, walking and running speed, leg length, coat, the distance at
// which it notices you, the distance at which it runs, how many the plot can hold, adult size, seconds between meals
const KIND = [['deer', 11, 1.6, 0.95, 4.4, 1, 4, 7, 4, 9, 1, 45], ['hare', 3.5, 0.5, 1.6, 5.6, 0.55, 5, 5, 3, 12, 0.3, 40], ['fox', 6, 1, 1.4, 6.3, 0.62, 7, 0, 2.5, 3, 0.42, 75],
  ['wolf', 9, 1.6, 1.6, 6.9, 0.82, 14, 0, 5, 5, 0.66, 150], ['beaver', 8, 1.5, 0.55, 1.5, 0.24, 15, 4, 2, 4, 0.4, 60],
  // a thousand times smaller, where a unit is a millimetre: springtails that graze and leap, and the mites that hunt them
  ['springtail', 2, 0.3, 0.9, 5.5, 0.3, 19, 6, 3.5, 16, 1, 40], ['mite', 3, 0.5, 0.7, 2.4, 0.3, 20, 0, 2, 4, 0.8, 90],
  // a hundred times smaller, a unit a centimetre: woodlice that graze the rotting wood, a ground beetle, slugs, and a centipede that hunts the woodlice
  ['woodlouse', 2, 0.5, 1.1, 3.2, 0.3, 14, 8, 5, 14, 1.3, 50], ['beetle', 2, 0.6, 2.4, 6, 0.3, 13, 10, 6, 4, 1.6, 70], ['slug', 1.5, 0.5, 0.35, 0.6, 0.3, 7, 6, 2.5, 4, 1, 60], ['centipede', 3, 0.8, 2.6, 7, 0.3, 15, 0, 4, 2, 1.1, 80],
  // ten thousand times smaller, a unit a tenth of a millimetre: nematodes thrashing through the water films, and the tardigrades that eat them
  ['nematode', 0.4, 0.1, 0.7, 1.6, 0.3, 8, 3, 2, 12, 1, 30], ['tardigrade', 1, 0.3, 0.25, 0.45, 0.3, 11, 4, 2, 4, 1, 60],
  // a hundred thousand times smaller, a unit ten micrometres: spider mites feeding on the leaf, and the faster, orange mites that hunt them
  ['spidermite', 0.25, 0.03, 6, 12, 0.3, 4, 60, 40, 4, 48, 30], ['predmite', 0.3, 0.05, 9, 22, 0.3, 7, 0, 50, 2, 44, 60],
  // a thousand times smaller again, under the bark of a dead spruce: engraver beetles, and the checkered beetle that hunts them
  ['barkbeetle', 1, 0.25, 2.5, 6, 0.3, 15, 25, 12, 6, 5, 60], ['clerid', 1.5, 0.4, 5, 16, 0.3, 20, 0, 15, 2, 8.5, 80],
  // a metre a unit again: perch in a lake and the pike that hunt them; bats in a cave
  ['perch', 6, 1.5, 0.6, 3.2, 0.3, 12, 5, 3, 10, 0.25, 60], ['pike', 10, 2, 0.8, 5, 0.3, 11, 0, 5, 2, 0.75, 150], ['bat', 8, 1, 2.5, 6, 0.3, 13, 4, 2, 8, 0.12, 60],
  // other ages: a millipede two metres long and a dragonfly with a 70 cm span from the coal swamps, a sauropod, a woolly mammoth; and a garibaldi in the kelp
  ['arthropleura', 6, 1.5, 0.4, 1.2, 0.3, 15, 4, 2, 4, 1.2, 120], ['meganeura', 1, 0.3, 3, 7, 0.3, 19, 5, 3, 6, 1, 40], ['sauropod', 60, 15, 0.7, 2, 0.3, 11, 10, 6, 3, 1, 600], ['mammoth', 50, 12, 0.9, 3, 0.3, 4, 12, 8, 6, 1, 300], ['garibaldi', 6, 1.5, 0.6, 3, 0.3, 7, 5, 3, 12, 0.25, 60]];
// its build: body radius, how far the neck reaches forward and up, head length, ear, tail length and thickness, half the body's length
const SHP = [[0.2, 0.3, 0.52, 0.3, 0.17, 0.16, 0.05, 0.48], [0.3, 0.2, 0.22, 0.26, 0.42, 0.1, 0.1, 0.42], [0.19, 0.26, 0.22, 0.3, 0.2, 0.6, 0.1, 0.5], [0.22, 0.3, 0.3, 0.36, 0.14, 0.5, 0.07, 0.52], [0.4, 0.2, 0.05, 0.3, 0.05, 0.55, 0.14, 0.42]];
const YOUNG = ['fawn', 'leveret', 'kit', 'pup', 'kit', 'springtail', 'mite', 'mancalid', 'larva', 'slug', 'centipede', 'juvenile', 'juvenile', 'nymph', 'nymph', 'young beetle', 'young beetle', 'fry', 'fry', 'pup', 'young', 'nymph', 'hatchling', 'calf', 'fry'], SEX = [['doe', 'stag'], ['hare', 'hare'], ['vixen', 'fox'], ['she-wolf', 'wolf'], ['beaver', 'beaver'], ['springtail', 'springtail'], ['mite', 'mite'], ['woodlouse', 'woodlouse'], ['beetle', 'beetle'], ['slug', 'slug'], ['centipede', 'centipede'], ['nematode', 'nematode'], ['tardigrade', 'tardigrade'], ['spider mite', 'spider mite'], ['predatory mite', 'predatory mite'], ['bark beetle', 'bark beetle'], ['checkered beetle', 'checkered beetle'], ['perch', 'perch'], ['pike', 'pike'], ['bat', 'bat'], ['arthropleura', 'arthropleura'], ['meganeura', 'meganeura'], ['sauropod', 'sauropod'], ['mammoth', 'mammoth'], ['garibaldi', 'garibaldi']];
const PREY = [-1, -1, 1, 0, -1, -1, 5, -1, -1, -1, 7, -1, 11, -1, 13, -1, 15, -1, 17, -1, -1, -1, -1, -1, -1], FOE = [3, 2, -1, -1, -1, 6, -1, 10, -1, -1, -1, 12, -1, 14, -1, 16, -1, 18, -1, -1, -1, -1, -1, 3, -1];             // what each kind hunts, and what it runs from
export function mkLife(B0, G, rnd, low, say = () => {}, snd = () => {}, env = {}) {
  let B = B0, n = 0, st = B.strm, tick = 0;
  const hs = B.S / 2 - 3, out = new Float32Array(LIMB * MAXL), self = { dirty: 0, noise: 1 };
  const cap = (a, ra, b, rb, kind, sd, fl = 0) => { if (n >= MAXL) return; out.set([a[0], a[1], a[2], ra, b[0], b[1], b[2], rb, 0, 1, fl + min(0.98, sd), kind], n++ * LIMB); };
  const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], rr = (a, b) => a + (b - a) * rnd(), cl = (v) => max(-hs, min(hs, v)), gs = () => Math.sqrt(-2 * Math.log(1 - rnd())) * cos(TAU * rnd());
  const dry = (x, z) => !st || st.dist(x, z) > 0.3, dst = (a, b) => hypot(a.x - b.x, a.z - b.z);
  const spot = () => { for (let k = 0; k < 40; k++) { const x = rr(-hs, hs), z = rr(-hs, hs); if (dry(x, z)) return [x, z]; } return [0, 0]; };
  const herd = [], L = G.life || {};
  const born = (kind, x, z, age, mom, dad) => {
    const K = KIND[kind], gene = (i) => (mom ? max(0.7, min(1.4, (mom.gn[i] + (dad || mom).gn[i]) / 2 * Math.exp(gs() * 0.06))) : 1);   // handed down from both parents, with a little change
    const d = { kind, x, z, a: rnd() * TAU, ph: rnd() * 9, age, life: K[1] * rr(0.75, 1.15), male: rnd() < 0.5, name: kind === 1 || kind === 5 ? '' : NM1[(rnd() * 20) | 0] + NM2[(rnd() * 16) | 0], gn: [gene(0), gene(1)], gen: mom ? mom.gen + 1 : 0,
      hun: rnd() * 0.4, thi: rnd() * 0.5, tir: rnd() * 0.3, mode: 0, want: 0, t: rr(1, 6), tg: [x, z], g: 0, lie: 0, v: 0, sd: rnd(), mom, preg: 0, dead: 0, sc: 1, prey: null, tree: null };
    herd.push(d); return d;
  };
  const who = (d) => (d.name ? d.name + ' the ' : 'a ') + (d.age < KIND[d.kind][2] * 0.6 ? YOUNG[d.kind] : SEX[d.kind][+d.male]), Who = (d) => who(d).replace(/^a /, 'A ');
  [L.deer !== undefined ? L.deer : 3, TIER > 3 ? L.hare || 0 : 0, TIER > 3 ? L.fox || 0 : 0, 0, TIER > 3 && st ? L.beaver || 0 : 0, TIER > 3 ? L.springtail || 0 : 0, TIER > 3 ? L.mite || 0 : 0, ...(TIER > 3 ? ['woodlouse', 'beetle', 'slug', 'centipede', 'nematode', 'tardigrade', 'spidermite', 'predmite', 'barkbeetle', 'clerid', 'perch', 'pike', 'bat', 'arthropleura', 'meganeura', 'sauropod', 'mammoth', 'garibaldi'].map((k) => L[k] || 0) : [])].forEach((c, kind) => {
    for (let i = 0; i < c; i++) { const p = kind === 4 ? [0, st.zc(0)] : spot(), d = born(kind, p[0], p[1], KIND[kind][1] * rr(0.18, 0.7)); if (i < 2) d.male = !i; }
  });
  const nb = low ? 10 : (L.birds !== undefined ? L.birds : 20), birds = [];
  for (let i = 0; i < nb; i++) birds.push({ p: [rr(-20, 20), rr(14, 24), rr(-20, 20)], v: [rr(-1, 1), 0, rr(-1, 1)], ph: rnd() * 9, sd: rnd() });
  const flies = [], drag = [], frogs = [];                                 // butterflies over open ground; dragonflies and frogs at the water
  if (TIER > 3) {
    for (let i = 0; i < (low ? 6 : 14); i++) { const p = spot(); flies.push({ x: p[0], z: p[1], ph: rnd() * 99, sd: rnd() }); }
    if (st) for (let i = 0; i < (low ? 4 : 9); i++) { const x = rr(-hs, hs); drag.push({ x, o: rr(-1, 1), ph: rnd() * 99, sd: rnd(), h: rr(0.3, 1.1) }); frogs.push({ x: rr(-hs, hs), e: rnd() < 0.5 ? -1 : 1, t: rr(1, 9), j: 0 }); }
  }
  const alive = (k) => herd.filter((d) => d.kind === k && d.mode !== 9);
  // memory (2 MB rung): the deer carry a map of where wolves have killed. They keep away from those places, feeding
  // elsewhere, and the fear fades over a year or two; so where wolves hunt, seedlings escape the browsing.
  const FR = TIER > 3 && new Float32Array(256), fc = (x, z) => max(0, min(15, floor((x / B.S + 0.5) * 16))) * 16 + max(0, min(15, floor((z / B.S + 0.5) * 16)));
  const fear = (x, z) => (FR ? FR[fc(x, z)] : 0);
  const scare = (p) => { if (!FR) return; const c = fc(p.x, p.z), was = FR[c]; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const x = (c >> 4) + i, z = (c & 15) + j; if (x >= 0 && x < 16 && z >= 0 && z < 16) FR[x * 16 + z] = min(3, FR[x * 16 + z] + 1.2 / (1 + i * i + j * j)); }
    if (was < 1) say('The deer now keep clear of the place where ' + who(p) + ' fell'); };
  const calm = (d) => { let b = spot(), bf = 9; for (let i = 0; i < 6; i++) { const s = spot(), f = fear(s[0], s[1]) + hypot(s[0] - d.x, s[1] - d.z) / 60; if (f < bf) { bf = f; b = s; } } return b; };
  const die = (d, why) => { if (d.mode === 9) return; d.mode = 9; d.dead = 0; d.v = 0; if (why && (d.name || why !== 'died of old age')) say(Who(d) + ' ' + why); };
  const bank = (d) => { const x = cl(d.x + rr(-9, 9)); return [x, st.zc(x) + (d.z > st.zc(x) ? 1 : -1) * (st.wid(x) + 0.2)]; };
  // a pack arrives, or leaves
  const pack = (on) => { if (on) { const z = rr(-hs, hs); for (let i = 0; i < 3; i++) born(3, -hs, z + i, rr(2, 5)).male = i < 2 ? !i : rnd() < 0.5; say('A wolf pack came in from outside the plot'); } else { for (const d of alive(3)) herd.splice(herd.indexOf(d), 1); say('The wolves moved on'); } };

  // what it decides to do next, from what it needs most
  const choose = (d, night, season) => {
    const k = d.kind, K = KIND[k], young = d.age < K[2] * 0.6; d.want = 0; d.mode = 0; d.prey = null;
    if (young && d.mom && d.mom.mode !== 9 && dst(d.mom, d) > 3.5) { d.tg = [d.mom.x + rr(-1.5, 1.5), d.mom.z + rr(-1.5, 1.5)]; d.t = 4; return; }   // the young keep to their mother
    if (k === 4) {                                                         // a beaver fells soft young trees near the water, and otherwise swims
      const tr = d.hun > 0.4 && env.stand && env.stand.filter((t) => !t.st && t.H > 2.5 && t.H < 17 && st.dist(t.x, t.z) < 9 && st.dist(t.x, t.z) > 0.2).sort((a, b) => dst(a, d) - dst(b, d))[0];
      if (tr) { d.tg = [tr.x + 0.4, tr.z + 0.3]; d.want = 10; d.tree = tr; d.t = 50; return; }
      if (d.hun > 0.6) { d.mode = 1; d.t = rr(6, 12); return; }               // bark and rushes will do when there is nothing to fell
      if (d.tir > 0.7) { d.mode = 5; d.t = rr(8, 20); return; }
      const x = cl(d.x + rr(-9, 9)); d.tg = [x, st.zc(x) + rr(-0.6, 0.6) * st.wid(x)]; d.t = rr(5, 12); return;
    }
    if (d.thi > 0.7 && st) { d.tg = bank(d); d.want = 4; d.t = 30; return; }
    if (d.hun > 0.5) {
      if (PREY[k] < 0) { if (TIER > 3 && !k && fear(d.x, d.z) > 0.4) { d.tg = calm(d); d.want = 1; d.t = 30; return; } d.mode = 1; d.t = rr(6, 13); return; }   // a frightened deer goes elsewhere to eat
      const dead = herd.find((o) => o.mode === 9 && o.dead < 25), prey = alive(PREY[k]).sort((a, b) => dst(a, d) - dst(b, d) + (k === 3 ? (a.age > 1 && a.age < a.life * 0.75 ? 8 : 0) - (b.age > 1 && b.age < b.life * 0.75 ? 8 : 0) : 0))[0];
      if (dead) { d.tg = [dead.x, dead.z]; d.want = 1; d.t = 30; return; }       // carrion first, then the hunt: wolves pick the young and the old
      if (prey) { d.mode = 6; d.prey = prey; d.t = 45; if (k === 3) for (const o of alive(3)) if (o !== d && o.mode < 2 && o.hun > 0.2) { o.mode = 6; o.prey = prey; o.t = 45; } return; }   // and the pack goes with it
    }
    if (d.tir > 0.7 || (night > 0.6 && rnd() < 0.7)) { d.mode = 5; d.t = rr(10, 26); if (k === 3 && night > 0.6 && rnd() < 0.3) snd('howl'); return; }
    if (k === 0 && d.male && !young && season === 2) {                     // autumn: the stag goes looking for the does, and says so
      const f = alive(0).filter((o) => !o.male)[0]; if (f) { d.tg = [f.x + rr(-3, 3), f.z + rr(-3, 3)]; d.t = 15; if (rnd() < 0.5) { snd('roar'); if (rnd() < 0.3) say(Who(d) + ' is roaring'); } return; }
    }
    if (TIER > 3 && d.fav && !k && fear(d.fav[0], d.fav[1]) > 0.3) d.fav = null;   // a good place where wolves have since killed is forgotten
    if (TIER > 3 && !d.fav && young && d.mom && d.mom.fav) { d.fav = d.mom.fav.slice(); d.taught = 1; }   // the young learn their mother's places
    d.tg = TIER > 3 && d.fav && rnd() < 0.5 ? [cl(d.fav[0] + rr(-3, 3)), cl(d.fav[1] + rr(-3, 3))] : TIER > 3 && !k ? calm(d) : spot(); d.t = rr(6, 16);
  };
  const live = (d, cam, dt, yrs, night, season, snow) => {
    const K = KIND[d.kind], k = d.kind, old = d.age > d.life * 0.8, F = env.fire;
    d.age += yrs; d.sc = K[10] * (k === 0 ? (d.male ? 1.08 : 0.94) : 1) * (0.42 + 0.58 * min(1, d.age / K[2]));
    if (d.mode === 9) { d.dead += dt; d.lie += (1 - d.lie) * min(1, dt * 2); d.g += (1 - d.g) * min(1, dt * 2); return; }
    d.hun += dt / K[11] * d.gn[0] ** 1.5; d.thi += dt / 110; d.tir += dt / (night > 0.5 ? 25 : 150);       // long legs are quick, and hungry
    if (d.age > d.life) return die(d, 'died of old age'); if (d.hun > 1.7) return die(d, snow > 0.5 ? 'starved in the snow' : 'starved');
    if (TIER > 3 && (k > 6 || K[1] < 0.6) && !d.male && d.preg <= 0 && d.age >= K[2] && alive(k).length < K[9] && rnd() < yrs / (K[1] * 0.15)) d.preg = rr(0.3, 1.5);   // the short-lived breed all year round
    if (d.preg > 0 && (d.preg -= dt) <= 0) {                               // birth
      const c = k === 0 ? (rnd() < 0.15 ? 2 : 1) : k === 1 || k === 5 ? 2 + ((rnd() * 2) | 0) : k === 23 ? 1 : k > 10 && k !== 22 ? 3 + ((rnd() * 3) | 0) : 2, kids = [], dad = alive(k).find((o) => o.male && o.age >= K[2]);
      for (let i = 0; i < c && alive(k).length < K[9]; i++) kids.push(born(k, d.x + rr(-0.6, 0.6), d.z + rr(-0.6, 0.6), 0.01, d, dad));
      if (kids.length) say(k === 1 ? 'A litter of ' + kids.length + ' leverets was born' : k === 5 ? kids.length + ' springtails hatched' : Who(d) + (k === 0 ? ' dropped ' : k === 19 || k === 23 ? ' gave birth to ' : k === 17 || k === 18 || k === 24 ? ' spawned: ' : k > 19 ? ' laid eggs that hatched: ' : k > 14 ? ' raised a brood, and out came ' : k === 6 || k > 7 ? ' laid eggs that hatched: ' : k === 7 ? ' released from her brood pouch ' : ' whelped ') + kids.map(who).join(' and '));
    }
    // what frightens it: you, whatever hunts its kind, and fire. The bold let danger come closer.
    let tx = cam[0], tz = cam[2], td = hypot(tx - d.x, tz - d.z), fr = K[8] / d.gn[1] * (TIER > 3 ? self.noise : 1);   // sneak and they let you close; run, or snap a twig, and they bolt
    if (FOE[k] >= 0) for (const o of herd) if (o.kind === FOE[k] && o.mode !== 9) { const od = dst(o, d), r = (k ? 9 : 13) / d.gn[1]; if (od < r && od < td * 2) { tx = o.x; tz = o.z; td = od; fr = o.mode === 7 ? r + 4 : r * 0.6; } }
    if (TIER > 3 && F && F.n) { const h = F.near(d.x, d.z); if (h) { if (h[2] < 1.5 && rnd() < dt * 0.6) return die(d, 'died in the fire'); if (h[2] < 11) { tx = h[0]; tz = h[1]; td = h[2]; fr = 12; } } }
    if (td < fr) { if (d.mode !== 3 || d.t < 1.9) { const a = atan2(d.z - tz, d.x - tx) + (k === 1 ? rr(-0.9, 0.9) : rr(-0.25, 0.25)); d.tg = [cl(d.x + cos(a) * 14), cl(d.z + sin(a) * 14)]; } d.mode = 3; d.t = 2.5; d.prey = null; }
    else if (td < K[7] / d.gn[1] * (TIER > 3 ? self.noise : 1) && d.mode < 2 && tx === cam[0]) { d.mode = 2; d.t = 2 + rnd() * 2; }
    d.t -= dt;
    if (d.mode === 6 || d.mode === 7) {                                    // the hunter: creep close, then run it down, or give up
      const p = d.prey, pd = p && p.mode !== 9 ? dst(p, d) : -1;
      if (pd < 0 || d.t < 0) { if (d.mode === 7) d.tir += 0.35; choose(d, night, season); }
      else {
        d.tg = [p.x, p.z]; if (d.mode === 6 && pd < (k === 3 ? 11 : 7)) { d.mode = 7; d.t = k === 3 ? 11 : 8; }
        if (pd < (k === 3 ? 1.1 : 0.7)) { die(p); say(Who(d) + (k === 3 ? ' pulled down ' : ' caught ') + who(p)); if (k === 3 && !p.kind) scare(p); snd('squeal'); for (const o of alive(k)) if (o === d || (o.prey === p && dst(o, d) < 20)) { o.mode = 0; o.want = 1; o.tg = [p.x, p.z]; o.t = 20; o.prey = null; } d.hun = min(d.hun, 0.9); }
      }
    } else if (d.mode === 10 && d.t < 0) {                                 // the tree comes down, toward the water, and the dam rises
      const tr = d.tree; if (tr && !tr.st) { tr.st = 2; tr.t = 0; tr.a = atan2(st.zc(tr.x) - tr.z, 0.4); env.world.dam = min(1, env.world.dam + 0.14); say(Who(d) + ' felled a' + (/^[AO]/.test(G.trees[tr.si].nm) ? 'n ' : ' ') + G.trees[tr.si].nm.toLowerCase()); self.dirty = 1; }
      d.hun = 0; d.tree = null; choose(d, night, season);
    } else if (d.t < 0) choose(d, night, season);
    else if (d.mode === 0 && hypot(d.tg[0] - d.x, d.tg[1] - d.z) < 0.9) { if (d.want) { d.mode = d.want; d.t = d.want === 4 ? 6 : d.want === 10 ? 16 : 11; d.want = 0; } else choose(d, night, season); }
    if (d.mode === 1) { d.hun = max(0, d.hun - dt / (PREY[k] < 0 ? 11 : 6) * (snow > 0.5 && PREY[k] < 0 ? 0.22 : 1)); if (TIER > 3 && d.hun < 0.02 && !d.fav) d.fav = [d.x, d.z]; }   // under snow there is little to eat; where it ate its fill, it remembers
    if (d.mode === 4) d.thi = max(0, d.thi - dt / 4); if (d.mode === 5) d.tir = max(0, d.tir - dt / 12);
    const wet = k === 4 && st.dist(d.x, d.z) < 0;
    const want = (d.mode === 3 || d.mode === 7 || (wet && d.mode === 0) ? K[4] : d.mode === 0 ? K[3] : d.mode === 6 ? K[3] * 0.55 : 0) * (old ? 0.72 : 1) * (0.6 + 0.4 * min(1, d.age / K[2])) * Math.sqrt(d.gn[0]);
    d.v += (want - d.v) * min(1, dt * 3);
    let ta = atan2(d.tg[1] - d.z, d.tg[0] - d.x); if (d.mode === 2) ta = atan2(tz - d.z, tx - d.x);
    const s = d.sc;
    for (const o of B.block) { const ox = o.x - d.x, oz = o.z - d.z, od = hypot(ox, oz), r = o.r + 1.3 * s + 0.5; if (od < r && od > 0.01) ta += (cos(d.a) * oz - sin(d.a) * ox > 0 ? -1 : 1) * 1.1 * (1 - od / r); }   // steer round trunks and stones
    const da = ((ta - d.a + PI * 3) % TAU) - PI; d.a += max(-1, min(1, da)) * dt * (d.v > 2 ? 4 : 1.6);
    d.x = max(-hs - 2, min(hs + 2, d.x + cos(d.a) * d.v * dt)); d.z = max(-hs - 2, min(hs + 2, d.z + sin(d.a) * d.v * dt));
    d.ph += d.v * dt / (0.55 * s) * (k === 1 ? 0.6 : 1);
    d.g += ((d.mode === 1 || d.mode === 4 || d.mode === 10 ? 1 : 0) - d.g) * min(1, dt * 2); d.lie += ((d.mode === 5 ? 1 : 0) - d.lie) * min(1, dt * 1.5);
  };
  // an animal from joints. Body in two parts with a waist; neck, skull, muzzle, nose, eyes, ears that flick; legs of thigh,
  // shank and foot whose feet find the ground; a tail in the manner of its kind; antlers on the stag.
  const quad = (d, t, an) => {
    const s = d.sc, k = d.kind, K = KIND[k], S = SHP[k], fx = cos(d.a), fz = sin(d.a), F = [fx, 0, fz], R = [-fz, 0, fx], U = [0, 1, 0], mv = min(1, d.v * 1.2), lie = d.lie;
    const bone = d.mode === 9 && d.dead > 25, coat = bone ? 9 : d.age > d.life * 0.8 && k !== 1 ? 11 : K[6], fl = k === 0 && d.age < 0.6 && !bone ? 1 : 0, hop = k === 1 ? max(0, sin(d.ph * 2)) * 0.25 * min(1, d.v) : 0;
    const swim = k === 4 && st.dist(d.x, d.z) < 0 ? 1 : 0, gy = (p) => (swim ? st.lvl(p[0]) - 0.34 * s : B.Hgt(p[0], p[2])), base = [d.x, 0, d.z], bob = 0.02 * s * sin(d.ph * 2) * mv, br = 1 + 0.025 * sin(t * 1.7 + d.sd * 9);
    const lg = K[5] * d.gn[0], hb = lg * s * (1 - 0.68 * lie), bl = S[7] * s, rb = S[0] * s * br * (bone ? 0.5 : 1), c = (a, ra, b, r2, kd) => cap(a, ra, b, r2, kd === undefined ? coat : kd, d.sd, fl);
    const hip = add(add(base, F, -bl), U, gy(add(base, F, -bl)) + hb * 0.97 + bob + hop * (1 + 0.5 * sin(d.ph * 2))), sh = add(add(base, F, bl), U, gy(add(base, F, bl)) + hb + bob + hop);
    const mid = add([(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2, (hip[2] + sh[2]) / 2], U, -0.03 * s);
    c(hip, rb * 1.02, mid, rb * 0.88); c(mid, rb * 0.88, sh, rb * 1.08);  // haunch, waist, chest
    const g = d.g, sway = 0.03 * s * sin(d.ph) * mv, nk = add(add(add(sh, F, (S[1] + 0.28 * g) * s), U, (S[2] - (S[2] + 0.5) * g * (1 - 0.6 * lie)) * s), R, sway);
    const hd = add(add(nk, F, S[3] * 0.55 * s), U, (-0.05 - 0.1 * g) * s), ns = add(add(nk, F, S[3] * s), U, (-0.1 - 0.16 * g) * s);
    c(add(sh, U, 0.04 * s), rb * 0.66, nk, rb * 0.44); c(nk, rb * 0.47, hd, rb * 0.36); c(hd, rb * 0.3, ns, rb * 0.19);
    if (!bone) c(ns, rb * 0.17, add(ns, F, 0.03 * s), rb * 0.13, 13);       // the nose
    const ef = 0.25 * max(0, sin(t * 3.1 + d.sd * 40) - 0.9) * 10;         // an ear flicks now and then
    for (const e of [-1, 1]) {
      if (!bone) {
        c(add(add(nk, R, e * rb * 0.34), F, S[3] * 0.3 * s), 0.016 * s, add(add(nk, R, e * rb * 0.37), F, S[3] * 0.33 * s), 0.012 * s, 13);   // an eye
        const e0 = add(add(nk, R, e * rb * 0.28), U, rb * 0.3), e1 = add(add(add(e0, R, e * (k === 1 ? 0.03 : S[4] * 0.6 + ef * 0.05) * s), U, S[4] * (k === 1 ? 1 : 0.7) * s), F, -0.04 * s);
        c(e0, 0.03 * s, e1, 0.034 * s); if (k === 1 || k === 2) c(e1, 0.034 * s, add(e1, U, 0.04 * s), 0.01 * s, 13);       // black tips
      }
      if (k === 0 && d.male && d.age >= K[2] && an > 0.05) {               // the stag: a beam, a brow tine, a fork; grown through the summer, cast in winter
        const q = s * an, a0 = add(add(nk, R, e * 0.06 * s), U, 0.08 * s), a1 = add(add(add(a0, R, e * 0.13 * q), U, 0.21 * q), F, -0.08 * q), a2 = add(add(a1, R, e * 0.04 * q), U, 0.18 * q);
        c(a0, 0.022 * s, a1, 0.016 * s, 9); c(a1, 0.016 * s, a2, 0.006 * s, 9); c(a1, 0.014 * s, add(add(a1, F, 0.12 * q), U, 0.1 * q), 0.005 * s, 9); c(a0, 0.016 * s, add(add(a0, F, 0.11 * q), U, 0.06 * q), 0.005 * s, 9);
      }
      // legs: each foot swings forward off the ground and stands while the body passes over it; lying down, they fold under
      [[hip, 0, -1], [sh, PI, 1]].forEach(([j0, off, fore]) => {
        const ph = d.ph + off + (e > 0 ? PI : 0) * (k === 1 ? 0 : 1) + (k === 1 && fore > 0 ? 0.6 : 0), sw = sin(ph), up = max(0, cos(ph)) * mv;
        const J = add(add(j0, R, e * rb * 0.55), U, -rb * 0.45), ft = add(add(base, F, fore * bl + 0.3 * s * sw * mv + lie * 0.28 * s), R, e * rb * 0.6);
        ft[1] = gy(ft) + (up * 0.14 * s + hop * 0.8) + 0.02 * s;
        const kn = add(add([J[0] * 0.55 + ft[0] * 0.45, J[1] * 0.55 + ft[1] * 0.45, J[2] * 0.55 + ft[2] * 0.45], F, (fore > 0 ? 0.05 : -0.09) * s * (1 + up)), U, lie * 0.1 * s);   // the knee, or behind, the hock
        const an2 = add(add([kn[0] * 0.25 + ft[0] * 0.75, kn[1] * 0.25 + ft[1] * 0.75, kn[2] * 0.25 + ft[2] * 0.75], F, (fore > 0 ? -0.02 : 0.05) * s), U, 0.03 * s), th = (fore > 0 ? 0.3 : 0.42) * rb * (k === 1 && fore < 0 ? 1.5 : 1);
        c(J, th, kn, 0.21 * rb); c(kn, 0.2 * rb, an2, 0.13 * rb, k === 2 ? 13 : undefined); c(an2, 0.13 * rb, add(ft, F, 0.03 * s), 0.14 * rb, k === 0 || k === 2 ? 13 : undefined);   // thigh, shank (a fox's is black), hoof or paw
      });
    }
    if (bone) return;
    const wag = 0.06 * s * sin(t * (d.mode === 2 ? 9 : 2.3) + d.sd * 9), T = S[5] * s;
    if (k === 2 || k === 3) { const t1 = add(add(add(hip, F, -T * 0.6), U, -0.14 * s), R, wag), t2 = add(add(add(hip, F, -T), U, -0.2 * s + (k === 3 ? 0.04 * s : 0)), R, wag * 2); c(add(hip, F, -rb * 0.6), S[6] * s * 0.6, t1, S[6] * s); c(t1, S[6] * s, t2, S[6] * s * 0.5, k === 2 ? 8 : undefined); }   // a brush, white-tipped on the fox
    else if (k === 4) c(add(hip, F, -rb * 0.7), 0.1 * s, add(add(hip, F, -T - rb * 0.5), U, -0.1 * s + 0.03 * s * sin(t * 2)), 0.13 * s, 13);                                                                    // the beaver's paddle
    else { c(add(hip, F, -rb * 0.8), S[6] * s, add(add(add(hip, F, -rb * 0.8 - T), U, (k === 1 ? 0.06 : -0.05) * s), R, wag * (k ? 0 : 1)), S[6] * s * (k === 1 ? 1 : 0.6), 8); if (k === 0) c(add(add(hip, F, -rb * 0.5), U, -0.02 * s), rb * 0.72, add(hip, F, -rb * 0.75), rb * 0.5, 8); }   // scut or flag, and the deer's pale rump
  };

  // the worlds further in. P(forward, right, up) is a point on the animal; c draws a capsule in its own units.
  const crawl = TIER > 3 && ((d, t, P, c, mv, bone) => {
    const k = d.kind, ph = d.ph * 2, leg = (f0, e, L, th, i) => { const p = ph + (i + (e > 0 ? 1 : 0)) * PI, sw = sin(p) * 0.08 * mv, kn = P(f0 + sw * 0.5, e * L * 0.55, 0.16), fp = P(f0 + sw, e * L, 0); fp[1] = B.Hgt(fp[0], fp[2]) + max(0, cos(p)) * 0.06 * mv * d.sc; c(P(f0, e * 0.12, 0.05), th, kn, th * 0.8); c(kn, th * 0.8, fp, th * 0.5); };
    if (k === 7) {                                                         // woodlouse: seven grey plates, seven pairs of short legs, feelers
      for (let i = 0; i < 7; i++) { const f = 0.42 - i * 0.13, w = 0.26 * (1 - abs(i - 2.5) / 7); c(P(f, -w, 0.1), 0.09, P(f, w, 0.1), 0.09); }
      c(P(0.52, 0, 0.06), 0.08, P(0.58, 0, 0.05), 0.07); if (bone) return;
      for (const e of [-1, 1]) { const w = 0.08 * sin(t * 4 + d.sd * 20 + e); c(P(0.58, e * 0.05, 0.05), 0.018, P(0.85, e * (0.25 + w), 0.12), 0.01); for (let i = 0; i < 7; i++) leg(0.36 - i * 0.11, e, 0.34, 0.02, i); }
    } else if (k === 8) {                                                  // ground beetle: head, pronotum, the shining wing cases, six long legs
      c(P(-0.45, 0, 0.12), 0.2, P(0.02, 0, 0.14), 0.24); c(P(0.12, 0, 0.13), 0.15, P(0.28, 0, 0.12), 0.14); c(P(0.36, 0, 0.1), 0.09, P(0.46, 0, 0.08), 0.08);
      c(P(-0.4, 0, 0.27), 0.01, P(0.08, 0, 0.36), 0.01, 18); if (bone) return;                                          // the seam between the wing cases
      for (const e of [-1, 1]) { c(P(0.48, e * 0.05, 0.08), 0.02, P(0.72, e * 0.22, 0.12), 0.012); for (let i = 0; i < 3; i++) leg(0.2 - i * 0.2, e, 0.5, 0.03, i); }
    } else if (k === 9) {                                                  // slug: a long soft body that swells and thins as it glides, a mantle, two pairs of tentacles
      const L = 2.4, w = 0.05 * sin(t * 2 + d.sd * 9) * mv;
      for (let i = 0; i < 6; i++) { const a = -L / 2 + i * L / 6, b = a + L / 6, r = 0.32 * (1 - abs(i - 2.2) / 6) * (1 + w * (i % 2 ? 1 : -1)); c(P(a, 0, r * 0.7), r * 0.85, P(b, 0, r * 0.75), r * 0.8); }
      c(P(0.1, 0, 0.35), 0.3, P(0.65, 0, 0.32), 0.28, 11); if (bone) return;                                           // the mantle
      for (const e of [-1, 1]) { c(P(1.1, e * 0.08, 0.22), 0.03, P(1.35, e * 0.16, 0.48), 0.025); c(P(1.35, e * 0.16, 0.48), 0.04, P(1.36, e * 0.16, 0.49), 0.04, 13); c(P(1.15, e * 0.1, 0.12), 0.02, P(1.3, e * 0.14, 0.12), 0.015); }
    } else if (k === 10 || k === 20) {                                                 // centipede: fifteen segments that ripple as it runs, a pair of legs on each
      for (let i = 0; i < 15; i++) { const f = 0.9 - i * 0.13, s = 0.05 * sin(i * 0.8 - t * 6 * mv); c(P(f, s, 0.07), 0.07, P(f - 0.13, 0.05 * sin((i + 1) * 0.8 - t * 6 * mv), 0.07), 0.07); if (!bone) for (const e of [-1, 1]) leg(f - 0.06, e, 0.32, 0.015, i); }
      if (!bone) for (const e of [-1, 1]) c(P(0.92, e * 0.04, 0.08), 0.015, P(1.3, e * 0.3, 0.15), 0.01);
    } else if (k === 11) {                                                 // nematode: a clear worm, thrashing in a sine wave
      for (let i = 0; i < 14; i++) { const f = 5 - i * 0.75, y = (u) => 0.9 * sin(u * 0.9 - t * 5 + d.sd * 9); c(P(f, y(i), 0.25), 0.22 - i * 0.008, P(f - 0.75, y(i + 1), 0.25), 0.22 - (i + 1) * 0.008); }
    } else if (k === 17 || k === 18 || k === 24) {                                    // a fish: a tapering body, a tail that sweeps, fins; the pike long, its dorsal fin far back
      const L = k === 18 ? 1.6 : 1, sw = (f) => 0.07 * sin(t * (k === 18 ? 5 : 8) * (0.4 + mv) + f * 5) * (0.5 - f / L);
      c(P(0.5 * L, sw(0.5 * L), 0), 0.06, P(0.32 * L, sw(0.32 * L), 0), k === 18 ? 0.1 : 0.13); c(P(0.32 * L, sw(0.32 * L), 0), k === 18 ? 0.1 : 0.15, P(-0.1 * L, sw(-0.1 * L), 0), k === 18 ? 0.1 : 0.14); c(P(-0.1 * L, sw(-0.1 * L), 0), k === 18 ? 0.1 : 0.13, P(-0.4 * L, sw(-0.4 * L), 0), 0.04);
      if (k === 17) for (let i = 0; i < 5; i++) { const f = 0.3 - i * 0.13; c(P(f, sw(f), 0.13), 0.025, P(f - 0.02, sw(f), -0.1), 0.02, 13); }   // the perch's dark bars
      if (bone) return; const tl = -0.4 * L, tw = sw(tl);
      c(P(tl, tw, 0), 0.02, P(tl - 0.16, tw * 1.6, 0.13), 0.01, 7); c(P(tl, tw, 0), 0.02, P(tl - 0.16, tw * 1.6, -0.13), 0.01, 7);   // the tail
      c(P(k === 18 ? -0.18 * L : 0.18, 0, k === 18 ? 0.1 : 0.14), 0.015, P(k === 18 ? -0.32 * L : -0.08, 0, k === 18 ? 0.14 : 0.2), 0.01, 7);   // the dorsal fin
      for (const e of [-1, 1]) c(P(0.25 * L, e * 0.08, -0.06), 0.012, P(0.12 * L, e * 0.16, -0.1), 0.008, 7);   // pectoral fins
    } else if (k === 21) {                                                 // a giant dragonfly: big eyes, a long abdomen, four wings that never stop
      c(P(0.12, 0, 0), 0.07, P(-0.06, 0, 0), 0.075); for (const e of [-1, 1]) c(P(0.17, e * 0.04, 0.02), 0.045, P(0.18, e * 0.04, 0.03), 0.045, 13); c(P(-0.06, 0, 0), 0.035, P(-0.62, 0, 0.02), 0.02, 13); if (bone) return;
      for (const e of [-1, 1]) for (const f of [0.06, -0.04]) { const a = sin(t * 30 + (f > 0 ? 0 : 1.6)) * 0.5; c(P(f, e * 0.05, 0.05), 0.03, P(f - 0.05, e * 0.38 * cos(a), 0.05 + 0.38 * sin(a)), 0.012, 8); }
    } else if (k === 22) {                                                 // a sauropod: a barrel on four pillars, a neck and a tail each longer than the body
      const sw = (i) => sin(t * 1.2 * mv + i) * 0.5 * mv; c(P(2.2, 0, 4.6), 2.1, P(-2.6, 0, 4.4), 2.3);
      let p = P(3.6, 0, 5.2); for (let i = 1; i <= 5; i++) { const q = P(3.6 + i * 1.5, 0.3 * sin(t * 0.3 + i * 0.4), 5.2 + i * 0.9), r = 1 - i * 0.13; c(p, r + 0.12, q, r); p = q; } c(p, 0.45, P(11.6, 0.3 * sin(t * 0.3 + 2.4), 9.6), 0.3);
      p = P(-4.4, 0, 4.3); for (let i = 1; i <= 6; i++) { const q = P(-4.4 - i * 1.8, 0.5 * sin(t * 0.8 + i * 0.6), 4.3 - i * 0.55), r = 1.3 - i * 0.2; c(p, r + 0.2, q, max(0.08, r)); p = q; }
      if (bone) return; for (const [f, e, i] of [[2.2, -1, 0], [2.2, 1, 3.1], [-2.2, -1, 3.1], [-2.2, 1, 0]]) { const fp = P(f + sw(i), e * 1.3, 0); fp[1] = B.Hgt(fp[0], fp[2]) + 0.3; c(P(f, e * 1.2, 3.8), 0.75, fp, 0.55); }
    } else if (k === 23) {                                                 // a woolly mammoth: a high-domed head and a hump, a trunk, tusks that curve up and in
      const sw = (i) => sin(t * 2.2 * mv + i) * 0.35 * mv; c(P(0.9, 0, 2.3), 1.2, P(-0.9, 0, 2.1), 1.1); c(P(0.4, 0, 3.1), 0.7, P(0.9, 0, 3.0), 0.6);
      c(P(1.8, 0, 2.9), 0.72, P(2.1, 0, 2.4), 0.6); let p = P(2.4, 0, 2.1); for (let i = 1; i <= 3; i++) { const q = P(2.5 + i * 0.12, 0.15 * sin(t * 0.7 + i), 2.1 - i * 0.55), r = 0.27 - i * 0.05; c(p, r + 0.05, q, r); p = q; }
      if (bone) return; for (const e of [-1, 1]) { c(P(2.2, e * 0.28, 2.0), 0.1, P(2.9, e * 0.5, 1.4), 0.085, 2); c(P(2.9, e * 0.5, 1.4), 0.085, P(3.3, e * 0.25, 2.0), 0.05, 2); c(P(1.7, e * 0.6, 3.0), 0.05, P(1.6, e * 0.75, 2.6), 0.2); }
      for (const [f, e, i] of [[1.0, -1, 0], [1.0, 1, 3.1], [-1.0, -1, 3.1], [-1.0, 1, 0]]) { const fp = P(f + sw(i), e * 0.6, 0); fp[1] = B.Hgt(fp[0], fp[2]) + 0.2; c(P(f, e * 0.6, 1.9), 0.4, fp, 0.3); }
    } else if (k === 19) {                                                 // a bat: a furry body and two wings of long fingers, beating
      const a = sin(t * 15 + d.sd * 9) * 0.9; c(P(-0.15, 0, 0), 0.12, P(0.12, 0, 0), 0.14, 15); c(P(0.18, 0, 0.02), 0.08, P(0.24, 0, 0.02), 0.07, 15); if (bone) return;
      for (const e of [-1, 1]) { const s1 = P(0, e * 0.4 * cos(a), 0.4 * sin(a)), s2 = P(-0.12, e * 0.75 * cos(a * 1.2), 0.7 * sin(a * 1.2)); c(P(0.05, e * 0.08, 0.02), 0.02, s1, 0.015); c(s1, 0.015, s2, 0.008); c(s1, 0.01, P(-0.25, e * 0.35 * cos(a), 0.3 * sin(a)), 0.006); c(P(-0.1, e * 0.08, 0), 0.06, P(-0.18, e * 0.4 * cos(a), 0.35 * sin(a)), 0.03); }
    } else if (k === 15) {                                                 // engraver beetle: a dark brown cylinder, the head tucked under the pronotum, a spined hollow at the rear
      c(P(-0.42, 0, 0.18), 0.17, P(-0.02, 0, 0.2), 0.19); c(P(0, 0, 0.2), 0.19, P(0.3, 0, 0.18), 0.16); c(P(0.34, 0, 0.11), 0.09, P(0.42, 0, 0.08), 0.07, 18);
      for (const e of [-1, 1]) c(P(-0.46, e * 0.09, 0.24), 0.025, P(-0.53, e * 0.11, 0.32), 0.008, 18); if (bone) return;
      for (const e of [-1, 1]) { c(P(0.42, e * 0.05, 0.1), 0.012, P(0.52, e * 0.14, 0.14), 0.012); c(P(0.53, e * 0.15, 0.15), 0.035, P(0.56, e * 0.16, 0.16), 0.03, 18); for (let i = 0; i < 3; i++) leg(0.22 - i * 0.2, e, 0.3, 0.03, i); }
    } else if (k === 16) {                                                 // checkered beetle: black head, red pronotum, red wing cases with a black band and two white ones
      c(P(0.36, 0, 0.12), 0.1, P(0.46, 0, 0.1), 0.09, 13); c(P(0.12, 0, 0.14), 0.12, P(0.28, 0, 0.13), 0.11);
      c(P(0.04, 0, 0.16), 0.16, P(-0.1, 0, 0.17), 0.18); c(P(-0.1, 0, 0.17), 0.185, P(-0.14, 0, 0.17), 0.185, 8); c(P(-0.14, 0, 0.17), 0.18, P(-0.3, 0, 0.16), 0.17, 13);
      c(P(-0.3, 0, 0.16), 0.17, P(-0.34, 0, 0.16), 0.17, 8); c(P(-0.34, 0, 0.16), 0.16, P(-0.48, 0, 0.12), 0.1, 13); if (bone) return;
      for (const e of [-1, 1]) { c(P(0.46, e * 0.04, 0.1), 0.012, P(0.72, e * 0.18, 0.2), 0.01, 13); for (let i = 0; i < 3; i++) leg(0.2 - i * 0.2, e, 0.48, 0.022, i); }
    } else if (k > 12) {                                                   // a mite on a leaf: one oval body, eight long legs; the spider mite pale with two dark spots, the hunter orange
      c(P(-0.22, 0, 0.12), 0.26, P(0.18, 0, 0.1), 0.2); c(P(0.3, 0, 0.06), 0.08, P(0.36, 0, 0.05), 0.06); if (k === 13) for (const e of [-1, 1]) c(P(-0.04, e * 0.15, 0.24), 0.08, P(0.02, e * 0.15, 0.24), 0.07, 13);
      if (bone) return; for (const e of [-1, 1]) for (let i = 0; i < 4; i++) leg(0.2 - i * 0.13, e, k === 14 ? 0.62 : 0.5, 0.025, i);
      for (const e of [-1, 1]) c(P(0.06, e * 0.1, 0.3), 0.004, P(0.04, e * 0.12, 0.5), 0.003, 8);   // a few long setae
    } else {                                                               // tardigrade: a plump barrel in four segments, eight stubby legs with claws
      for (let i = 0; i < 4; i++) c(P(1 - i * 0.65, 0, 0.75), 0.7, P(0.4 - i * 0.65, 0, 0.75), 0.75);
      c(P(1.25, 0, 0.65), 0.45, P(1.6, 0, 0.55), 0.3); if (bone) return;
      for (const e of [-1, 1]) for (let i = 0; i < 4; i++) { const f = 0.8 - i * 0.65, p = ph + (i + (e > 0 ? 1 : 0)) * PI, sw = sin(p) * 0.15 * mv, fp = P(f + sw, e * 0.95, 0.05); c(P(f, e * 0.5, 0.45), 0.25, fp, 0.18); c(fp, 0.05, P(f + sw + 0.15, e * 1.05, 0), 0.02, 13); }
    }
  });
  // at the scale of moss the animals have six legs or eight: a springtail in three parts with feelers, a mite as one round body
  const bug = (d, t) => {
    const s = d.sc, k = d.kind, fx = cos(d.a), fz = sin(d.a), mv = min(1, d.v), bone = d.mode === 9 && d.dead > 25, coat = bone ? 9 : KIND[k][6];
    const hop = k === 5 ? max(0, sin(d.ph * 0.8)) * 1.7 * s * min(1, d.v / 4) : 0, g0 = B.Hgt(d.x, d.z);
    let y0 = g0 + (0.2 - 0.08 * d.lie) * s + hop;   // a frightened springtail leaps
    if (TIER > 3 && (k > 16 && k < 20 || k === 21 || k === 24) && d.mode !== 9) y0 = k === 21 ? g0 + 1.2 + 1.6 * (0.5 + 0.5 * sin(t * 0.5 + d.sd * 30)) : k === 19 ? (B.cave ? min(B.cave.ceilAt(d.x, g0 + 0.5, d.z) - 0.4, g0 + 2.5) : g0 + 2.5) - 0.8 * (0.5 + 0.5 * sin(t * 0.7 + d.sd * 20)) : min(-0.25 - 0.2 * s, g0 + 0.4 + (0.5 + 0.5 * sin(d.sd * 17 + t * 0.15)) * min(3, -g0 - 1));   // fish swim between the bed and the surface; bats fly under the roof
    const P = (f, r, u) => [d.x + (fx * f - fz * r) * s, y0 + u * s, d.z + (fz * f + fx * r) * s], c = (a, ra, b, rb, kd) => cap(a, ra * s, b, rb * s, kd === undefined ? coat : kd, d.sd);
    if (TIER > 3 && k > 6) return crawl(d, t, P, c, mv, bone);
    if (k === 5) { c(P(-0.45, 0, 0.02), 0.13, P(-0.05, 0, 0.06), 0.2); c(P(-0.05, 0, 0.06), 0.2, P(0.3, 0, 0.03), 0.15); c(P(0.3, 0, 0.03), 0.14, P(0.46, 0, -0.06 * d.g), 0.11); }
    else c(P(-0.22, 0, 0.05), 0.24, P(0.2, 0, 0.02), 0.17);
    if (bone) return;
    for (const e of [-1, 1]) {
      if (k === 5) { const w = 0.1 * sin(t * 5 + d.sd * 30 + e); c(P(0.48, e * 0.05, 0), 0.025, P(0.75, e * (0.16 + w), 0.12 + w), 0.012); c(P(0.47, e * 0.07, 0.04), 0.02, P(0.5, e * 0.09, 0.05), 0.016, 13); }   // a feeler and an eye
      for (let i = 0; i < (k === 5 ? 3 : 4); i++) {                          // legs: alternate ones step together
        const f0 = (k === 5 ? 0.22 : 0.18) - i * (k === 5 ? 0.2 : 0.13), ph = d.ph * 2 + (i + (e > 0 ? 1 : 0)) * PI, sw = sin(ph) * 0.1 * mv, kn = P(f0 + sw * 0.5, e * 0.3, 0.12), fp = P(f0 + sw + (i - 1) * 0.06, e * 0.46, 0);
        fp[1] = B.Hgt(fp[0], fp[2]) + max(0, cos(ph)) * 0.08 * mv * s + hop; c(P(f0, e * 0.12, 0), 0.035, kn, 0.022); cap(kn, 0.022 * s, fp, 0.012 * s, coat, d.sd);
      }
    }
  };

  return {
    out, herd, birds, who, pack, get dirty() { return self.dirty; }, set dirty(v) { self.dirty = v; }, set fat(v) { self.fat = v; }, get noise() { return self.noise; }, set noise(v) { self.noise = v; },
    get counts() { const c = { deer: alive(0).length, birds: nb }; if (TIER > 3) { c.hares = alive(1).length; c.foxes = alive(2).length; if (alive(3).length) c.wolves = alive(3).length; if (alive(4).length) c.beavers = alive(4).length; if (alive(5).length) c.springtails = alive(5).length; if (alive(6).length) c.mites = alive(6).length; ['woodlice', 'beetles', 'slugs', 'centipedes', 'nematodes', 'tardigrades', 'spider mites', 'predatory mites', 'bark beetles', 'checkered beetles', 'perch', 'pike', 'bats', 'arthropleura', 'meganeura', 'sauropods', 'mammoths', 'garibaldi'].forEach((p, i) => { const n = alive(7 + i).length; if (n) c[p] = n; }); if (!c.deer && L.deer === 0) delete c.deer; if (!nb) delete c.birds; if (!L.hare) delete c.hares; if (!L.fox) delete c.foxes; } return c; },
    // how far each kind's inherited legs and boldness have moved from where they started
    get memory() { const a = herd.filter((d) => d.mode !== 9); return { remember: a.filter((d) => d.fav).length, taught: a.filter((d) => d.taught).length, of: a.length }; },
    genes() { return [0, 1, 2, 3].map((k) => { const a = alive(k); if (a.length < 2 || !a.some((d) => d.gen > 1)) return ''; const m = (i) => Math.round((a.reduce((s, d) => s + d.gn[i], 0) / a.length - 1) * 100); return KIND[k][0] + ' legs ' + (m(0) >= 0 ? '+' : '') + m(0) + '%, boldness ' + (m(1) >= 0 ? '+' : '') + m(1) + '%'; }).filter(Boolean).join(' · '); },
    world(b) { B = b; st = b.strm; },
    fear,                                      // the forest was regrown around them
    // spring: those old enough conceive, and where a kind has died out, strangers walk in from outside
    spring() {
      if (TIER > 3) { self.forms = self.forms || {}; for (let k = 0; k < KIND.length; k++) { const a = alive(k); if (a.length < 3 || self.forms[k]) continue; const m = (i) => a.reduce((v, d) => v + d.gn[i], 0) / a.length - 1, g0 = m(0), g1 = m(1), big = abs(g0) > abs(g1) ? g0 : g1;
        if (abs(big) > 0.15) { const nm = big === g0 ? (g0 > 0 ? 'long-legged' : 'stocky') : g1 > 0 ? 'bold' : 'wary'; self.forms[k] = nm; say('The ' + KIND[k][0] + ' here have become a ' + nm + ' form, ' + Math.round(abs(big) * 100) + '% from their founders'); } } }   // when a kind has drifted far enough, it is named as a new form
      for (let k = 0; k < KIND.length; k++) {
        const a = alive(k), K = KIND[k]; if (TIER < 4 && k) continue; if (k === 3 ? !a.length : k ? !(L[K[0]] > 0) : L.deer === 0) continue;
        if (k !== 3 && (a.length < 2 || !a.some((d) => d.male) || !a.some((d) => !d.male))) { const d = born(k, rnd() < 0.5 ? -hs : hs, k === 4 ? st.zc(hs) : rr(-hs, hs), K[2] * rr(1.2, 3)); d.male = !a.some((o) => o.male); say(Who(d) + ' came in from outside the plot'); if (TIER > 3 && !a.length) born(k, d.x, d.z + 1, d.age).male = !d.male; }   // into an empty plot they come as a pair
        if (TIER > 3 && (k > 6 || K[1] < 0.6)) continue;   // the short-lived keep their own calendar
        for (const d of a) if (!d.male && d.age >= K[2] && d.hun < 1.1 && a.length < K[9] + (self.fat && PREY[k] < 0 ? 3 : 0)) d.preg = rr(6, 50);   // after a mast year there is room for more
      }
      self.fat = 0; if (FR) for (let i = 0; i < 256; i++) FR[i] *= 0.55;   // fear fades
      const dn = alive(0).length, wn = alive(3).length;                    // wolves follow the deer: a full plot draws a pack, an empty one loses it
      if (TIER > 3 && !wn && dn >= 8 && rnd() < 0.35) pack(1); else if (wn && dn < 3 && rnd() < 0.6) pack(0);
    },
    // years passing unwatched (the clock in decades): everyone ages, the old die, the young are born, the hunters take their share
    lapse(yrs) {
      for (let y = 0; y < yrs; y++) {
        for (let i = herd.length - 1; i >= 0; i--) { const d = herd[i]; d.age++; d.hun = 0.2; if (d.age > d.life || d.mode === 9) herd.splice(i, 1); }
        this.spring(); for (const d of herd.slice()) if (d.preg > 0) { d.preg = 0; const K = KIND[d.kind], dad = alive(d.kind).find((o) => o.male); for (let i = d.kind === 1 ? 3 : d.kind === 0 ? 1 : 2; i > 0 && alive(d.kind).length < K[9]; i--) born(d.kind, d.x, d.z, 0.5, d, dad); }
        for (const p of herd.filter((d) => PREY[d.kind] >= 0)) for (let i = p.kind === 3 ? 1 : 2; i > 0; i--) { const v = alive(PREY[p.kind]).sort((a, b) => a.gn[0] * (a.age > 1 ? 1 : 0.7) - b.gn[0] * (b.age > 1 ? 1 : 0.7))[0]; if (v && rnd() < 0.7) { if (p.kind === 3 && !v.kind) scare(v); herd.splice(herd.indexOf(v), 1); } }   // the slow are taken first
      }
    },
    // one step of everything alive; returns how many limbs to draw. yrs: years gone by in this step.
    step(dt, t, cam, night, yrs = 0, season = 1, snow = 0) {
      n = 0;
      if ((tick += dt) > 30) { tick = 0; if (TIER > 3) for (let k = 11; k < KIND.length; k++) if (L[KIND[k][0]] > 0 && !alive(k).length && rnd() < 0.5) { const d = born(k, rnd() < 0.5 ? -hs : hs, rr(-hs, hs), KIND[k][2] * 2); born(k, d.x, d.z + 1, d.age).male = !d.male; say(Who(d) + ' came in from outside the plot'); }   // the very small blow in on the wind, or walk in, whenever the patch is empty
      if (TIER > 3 && !yrs && L.hare && alive(1).length < 2) { born(1, rnd() < 0.5 ? -hs : hs, rr(-hs, hs), 1); say('A hare came in from outside the plot'); } }   // with the clock stopped nothing is born, so the fox's larder is topped up
      const an = [0.35, 0.8, 1, 0][season];
      for (let i = herd.length - 1; i >= 0; i--) { const d = herd[i]; live(d, cam, dt, yrs, night, season, snow); if (d.mode === 9 && d.dead > 80) herd.splice(i, 1); else (d.kind > 4 ? bug : quad)(d, t, an); }
      if (TIER > 3 && env.fire && env.fire.n) env.fire.draw(cap, B, t);
      // birds: each steers toward the flock's middle, matches its neighbours, keeps its distance, and follows a point that
      // circles the plot; when something lies dead they come down and wheel over it
      const dead = herd.find((d) => d.mode === 9 && d.dead < 60), wp = dead ? [dead.x + sin(t * 0.5) * 7, B.Hgt(dead.x, dead.z) + 7, dead.z + cos(t * 0.5) * 7] : [sin(t * 0.11) * 22, 19 + 5 * sin(t * 0.07), cos(t * 0.083) * 22], c = [0, 0, 0];
      for (const b of birds) { c[0] += b.p[0] / nb; c[1] += b.p[1] / nb; c[2] += b.p[2] / nb; }
      for (const b of birds) {
        const ac = [(wp[0] - b.p[0]) * 0.22 + (c[0] - b.p[0]) * 0.1, (wp[1] - b.p[1]) * 0.3 + (c[1] - b.p[1]) * 0.1, (wp[2] - b.p[2]) * 0.22 + (c[2] - b.p[2]) * 0.1];
        for (const o of birds) if (o !== b) { const dx = b.p[0] - o.p[0], dy = b.p[1] - o.p[1], dz = b.p[2] - o.p[2], dd = dx * dx + dy * dy + dz * dz; if (dd < 9 && dd > 1e-4) { const k = (1.6 / dd); ac[0] += dx * k + (o.v[0] - b.v[0]) * 0.05; ac[1] += dy * k; ac[2] += dz * k + (o.v[2] - b.v[2]) * 0.05; } }
        for (let k = 0; k < 3; k++) b.v[k] += ac[k] * dt;
        const sp = hypot(b.v[0], b.v[1], b.v[2]) || 1, ws = min(9, max(5.5, sp)); for (let k = 0; k < 3; k++) { b.v[k] *= ws / sp; b.p[k] += b.v[k] * dt; }
        if (night > 0.7) continue;                                         // they roost after dark
        const D = [b.v[0] / ws, b.v[1] / ws, b.v[2] / ws], sl = hypot(D[0], D[2]) || 1, R = [-D[2] / sl, 0, D[0] / sl], U = [0, 1, 0];
        b.ph += dt * (11 + 3 * b.sd); const glide = sin(t * 0.6 + b.sd * 40) > 0.55 ? 0.15 : 1, fl = sin(b.ph) * 0.85 * glide + 0.15;
        cap(add(b.p, D, -0.13), 0.035, add(b.p, D, 0.1), 0.05, 6, b.sd); cap(add(b.p, D, 0.1), 0.04, add(b.p, D, 0.2), 0.012, 6, b.sd);
        for (const e of [-1, 1]) { const el = add(add(b.p, R, e * 0.2 * cos(fl)), U, 0.2 * sin(fl)), tp = add(add(add(el, R, e * 0.24 * cos(fl * 1.4)), U, 0.24 * sin(fl * 1.4)), D, -0.07); cap(b.p, 0.04, el, 0.032, 6, b.sd); cap(el, 0.032, tp, 0.008, 6, b.sd); }
      }
      if (night < 0.4 && season < 3) for (const b of flies) {              // butterflies: two wings that clap, wandering low over the ground
        b.ph += dt; const a = b.ph * 0.4 + sin(b.ph * 0.9 + b.sd * 9) * 2; b.x += cos(a) * dt * 0.8; b.z += sin(a) * dt * 0.8;
        if (abs(b.x) > hs || abs(b.z) > hs) { b.x *= 0.97; b.z *= 0.97; }
        const p = [b.x, B.Hgt(b.x, b.z) + 0.6 + 0.35 * sin(b.ph * 1.7 + b.sd * 5) + 0.1 * sin(b.ph * 9), b.z], F = [cos(a), 0, sin(a)], R = [-F[2], 0, F[0]], fl = abs(sin(b.ph * 11)) * 1.2 + 0.15;
        for (const e of [-1, 1]) { const w = add(add(p, R, e * 0.07 * cos(fl)), [0, 1, 0], 0.07 * sin(fl)); cap(p, 0.012, add(w, F, 0.03), 0.045, 10, b.sd); cap(p, 0.01, add(w, F, -0.04), 0.032, 10, b.sd); }
      }
      if (season < 3 && night < 0.6) for (const b of drag) {               // dragonflies: hang still over the water, then dart
        b.ph += dt; const hov = floor(b.ph * 0.7), fr = b.ph * 0.7 - hov, h1 = (i) => ((sin((i + b.sd * 99) * 127.1) * 43758.5) % 1 + 1) % 1, e = min(1, fr * 5);
        const X = (i) => cl(b.x + (h1(i) - 0.5) * 9), O = (i) => (h1(i + 0.5) - 0.5) * 2, x = X(hov) + (X(hov + 1) - X(hov)) * (e < 1 ? 0 : 0) + (X(hov) - X(hov - 1)) * (e - 1), o = O(hov - 1) + (O(hov) - O(hov - 1)) * e;
        const z = st.zc(x) + o * (st.wid(x) + 0.5), p = [x, st.lvl(x) + b.h + 0.05 * sin(b.ph * 30), z], a = h1(hov) * TAU, F = [cos(a), 0, sin(a)], R = [-F[2], 0, F[0]];
        cap(add(p, F, 0.035), 0.008, add(p, F, -0.06), 0.004, b.sd < 0.5 ? 12 : 10, b.sd);
        for (const s of [-1, 1]) cap(p, 0.003, add(add(p, R, s * 0.06), [0, 1, 0], 0.012 * sin(b.ph * 60)), 0.011, 8, b.sd);
      }
      for (const b of frogs) {                                             // frogs sit at the water's edge and now and then jump
        b.t -= dt; if (b.t < 0) { b.t = rr(3, 14); b.j = 1; b.x = cl(b.x + rr(-0.7, 0.7)); if (night > 0.3 && rnd() < 0.4) snd('frog'); }
        b.j = max(0, b.j - dt * 2.2); const x = b.x, z = st.zc(x) + b.e * (st.wid(x) + 0.12), y = B.Hgt(x, z) + 0.03 + sin((1 - b.j) * PI) * 0.16 * (b.j > 0 ? 1 : 0);
        if (season < 3) { cap([x, y, z], 0.035, [x + 0.05, y + 0.02, z], 0.028, 12, 0.2); cap([x + 0.05, y + 0.03, z], 0.026, [x + 0.085, y + 0.035, z], 0.016, 12, 0.2); }
      }
      return n;
    },
  };
}

// ---- the forest's own time (2 MB rung). Each species has a lifespan, a growth rate, a tolerance of shade, a taste to
// deer and a resistance to fire. One call is one year: every tree grows toward its height, slowed by taller neighbours
// unless it tolerates shade; trees die of age, of suppression, by drowning or by chance, stand as snags, fall, lie as logs
// and rot; deer eat the smallest; seed lands and takes where there is light enough for its kind. Each seedling inherits
// its parent's pace of life with a small change: the fast grow quickly, bear shade badly and die young.
const TL = { oak: [300, 0.03, 0.5, 0.8, 0.5], birch: [80, 0.07, 0.2, 0.7, 0.1], pine: [220, 0.04, 0.3, 0.2, 0.7], spruce: [250, 0.035, 0.7, 0.1, 0.1], giant: [500, 0.025, 0.45, 0.3, 0.85], hemlock: [400, 0.025, 0.9, 0.5, 0.1], maple: [160, 0.045, 0.7, 0.9, 0.2],
  aspen: [70, 0.08, 0.15, 1, 0.1], beech: [300, 0.03, 0.9, 0.4, 0.15], alder: [70, 0.07, 0.3, 0.5, 0.2], willow: [55, 0.08, 0.2, 1, 0.15], larch: [250, 0.04, 0.2, 0.3, 0.7], redwood: [800, 0.03, 0.7, 0.2, 0.9] };
export const tl = (sp) => sp.tl || TL[sp.id] || [150, 0.04, 0.5, 0.5, 0.3];   // a species that evolved here carries its own
const an = (nm) => (/^[AO]/.test(nm) ? 'An ' : 'A ') + nm.toLowerCase();
export function succeed(stand, G, B, rnd, say, env = {}) {
  const hs = B.S / 2 - 2, rr = (a, b) => a + (b - a) * rnd(), gs = () => Math.sqrt(-2 * Math.log(1 - rnd())) * cos(TAU * rnd());
  const shade = (x, z, H, me) => { let s = 0; for (const o of stand) if (o !== me && !o.st && o.H > H * 1.2 + 1) { const r = G.trees[o.si].cr * min(1, o.H / 12) * 1.25, d = hypot(o.x - x, o.z - z); if (d < r) s += 1 - d / r; } return min(1, s); };
  let ev = 0, eaten = 0, drowned = 0; const wet = stand.wet || (() => 0.5);
  for (let i = stand.length - 1; i >= 0; i--) {
    const t = stand[i], sp = G.trees[t.si], T = tl(sp), g = t.g || 1, tol = min(0.97, T[2] / g), life = T[0] / g ** 0.7;
    if (!t.st) {
      if (t.H < 2.2 && rnd() < min(0.5, (env.deer || 0) * 0.03 * T[3]) * (env.fear ? 1 - min(0.95, env.fear(t.x, t.z) * 2.5) : 1)) { stand.splice(i, 1); eaten++; ev++; continue; }              // browsed off
      if (env.deep && env.deep(t.x, t.z) && rnd() < 0.4) { t.st = 1; t.t = 0; drowned++; ev++; continue; }
      t.age++; const s = shade(t.x, t.z, t.H, t), h0 = t.H; t.H += (t.hm - t.H) * T[1] * g * (1 - s * (1 - tol)); if (h0 < 5 && t.H >= 5) ev++;
      if (rnd() < 0.003 + (t.age > life ? 0.09 : 0) + s * (1 - tol) * (t.H < 8 ? 0.12 : 0.02)) { t.st = 1; t.t = 0; ev++; if (t.H > 13) say(an(sp.nm) + ' died' + (t.age > life ? ' of age' : s > 0.5 ? ' in the shade' : '') + ' and stands dead'); }
    } else if (t.st === 1) { if (++t.t > (t.H < 5 ? 2 : 4 + t.sd % 9)) { ev++; if (t.H < 5) stand.splice(i, 1); else { t.st = 2; t.t = 0; t.a = rnd() * TAU; if (t.H > 13) say('A dead ' + sp.nm.toLowerCase() + ' fell'); } } }
    else if (++t.t > 10 + t.H) { stand.splice(i, 1); ev++; }
  }
  if (rnd() < 0.09) {                                                      // a gale: the tall go over whole, and all lie the same way
    const a = rnd() * TAU; let n = 0;
    for (const t of stand) if (!t.st && t.H > 14 && rnd() < 0.05 * t.H / 20) { t.st = 2; t.t = 0; t.a = a + gs() * 0.15; n++; ev++; }
    if (n) say('A gale threw ' + n + (n > 1 ? ' trees, all lying the same way' : ' tree'));
  }
  if (eaten > 3 && rnd() < 0.3) say('Deer browsed off ' + eaten + ' seedlings'); if (drowned) say('The beavers\' pond drowned ' + drowned + (drowned > 1 ? ' trees' : ' tree'));
  G.trees.forEach((sp, si) => {                                            // seed: near the parent mostly, far for the light-seeded
    const T = tl(sp), par = stand.filter((t) => t.si === si && !t.st && t.age > 12 && t.H > 6); if (!par.length || stand.length > 170) return;
    const mast = par.length > 3 && (env.year * 7 + si * 13) % (5 + si) === 0;   // every few years a kind seeds all at once, and the animals fatten on it
    const jay = mast && /oak|beech/.test(sp.id);                            // jays carry the heavy seed far and bury it
    if (mast) { env.mast = 1; say('A mast year for the ' + sp.nm.toLowerCase() + (jay ? ': jays are burying the seed all over the plot' : ': the ground is thick with seed')); }
    for (let k = Math.ceil(min(5, par.length * (0.25 + 0.5 * (1 - T[2])))) * (mast ? 4 : 1); k > 0; k--) {
      const p = par[(rnd() * par.length) | 0], ms = par.filter((o) => o !== p && hypot(o.x - p.x, o.z - p.z) < 14), q = ms[(rnd() * ms.length) | 0] || p;   // pollen comes from a neighbour of its own kind
      const far = rnd() < (jay ? 0.5 : 0.5 * (1 - T[2])), x = far ? rr(-hs, hs) : p.x + gs() * 7, z = far ? rr(-hs, hs) : p.z + gs() * 7;
      const g = max(0.6, min(1.7, Math.sqrt((p.g || 1) * (q.g || 1)) * Math.exp(gs() * 0.06))), w = ((p.w ?? sp.wet) + (q.w ?? sp.wet)) / 2 + gs() * 0.05, tol = min(0.97, T[2] / g);
      if (Math.abs(x) > hs || Math.abs(z) > hs || (B.strm && B.strm.dist(x, z) < 1) || (env.deep && env.deep(x, z)) || stand.some((o) => !o.st && hypot(o.x - x, o.z - z) < (o.H < 5 ? 1.2 : 2.2))) continue;
      const ash = env.fire ? env.fire.at(x, z) : 0;                        // on burnt ground the light-lovers take hold fast
      if (rnd() < ((1 - shade(x, z, 0.5)) * (1 - tol) + tol * 0.35) * (1 + 2 * ash * (1 - T[2])) * (stand.some((o) => o.st === 2 && hypot(o.x - x, o.z - z) < 2.5) ? 1 + T[2] : 1) * max(0, 1 - abs(wet(x, z) - w) * 2.2)) stand.push({ si, x, z, H: 0.7, hm: max(sp.H[0] * 0.8, min(sp.H[1] * 1.25, (p.hm + q.hm) / 2 * Math.exp(gs() * 0.04))), age: 1, sd: (rnd() * 1e9) | 0, st: 0, g, w });   // a seed takes best where the ground is as wet as it is suited to
    }
    if (env.year % 40 === 0) { const a = stand.filter((t) => t.si === si && !t.st), m = Math.round((a.reduce((s, t) => s + (t.g || 1), 0) / (a.length || 1) - 1) * 100); if (Math.abs(m) > 4) say(sp.nm + ' here now live ' + Math.abs(m) + '% ' + (m > 0 ? 'faster' : 'slower') + ' than their ancestors'); }
  });
  return ev + speciate(stand, G, rnd, say, env.year);
}

// ---- evolution. Each tree carries two heritable traits: the wetness it is suited to (w) and its pace of life (g).
// Seedlings take the mean of a mother and a nearby father plus a small mutation, and only take hold where the ground
// suits them, so along the plot's wet-to-dry gradient a species is pulled apart. When a coherent group of one species
// has drifted far enough from where the species began, it is named as a species of its own and from then on breeds
// only with its own kind. When the whole species has drifted, it is renamed instead. A species with nothing left alive
// is gone from the plot, and its place in the palette can be taken by a new one. Six species at most.
const WORDS = { wet: ['Marsh', 'Fen', 'Bog', 'Carr'], dry: ['Upland', 'Ridge', 'Heath', 'Crag'], fast: ['Swift', 'Pioneer', 'Quick', 'Brief'], slow: ['Slow', 'Patient', 'Ancient', 'Shade'] };
const TINT = { wet: [-0.05, 0.01, 0.09], dry: [0.12, 0.07, -0.05], fast: [0.09, 0.12, -0.03], slow: [-0.07, -0.05, 0.02] };   // illustrative: so a new species can be told from its parent at a glance
const low = (s) => (/^Douglas/.test(s) ? s : s[0].toLowerCase() + s.slice(1)), pl = (s) => s + (/(s|sh|ch|x)$/.test(s) ? 'es' : 's');
const lnM = (a, f) => a.reduce((s, t) => s + f(t), 0) / a.length;
function speciate(stand, G, rnd, say, year) {
  let ev = 0; const H = G.hist || (G.hist = G.trees.map((s, i) => ((s.h = i), { nm: s.nm, born: 0, col: s.leaf.b })));   // every species that has lived here, for the tree of life
  for (let si = 0; si < G.trees.length; si++) {
    const sp = G.trees[si]; if (sp.gone) continue;
    const a = stand.filter((t) => t.si === si && !t.st);
    if (!a.length) { if (!stand.some((t) => t.si === si && t.st < 2)) { sp.gone = H[sp.h].gone = year; say('The ' + low(sp.nm) + (sp.par ? ', which arose here in year ' + sp.born + ',' : '') + ' is gone from the plot'); ev++; } continue; }
    if (year - max(sp.born || 0, sp.split || 0) < 60 || a.length < 10) continue;   // a species that has just formed, or just split, needs time to drift again
    const key = (t, c = 1) => { const dw = ((t.w ?? sp.wet) - sp.wet) / 0.2, dg = Math.log(t.g || 1) / 0.25; return abs(dw) >= c ? (dw > 0 ? 'wet' : 'dry') : abs(dg) >= c ? (dg > 0 ? 'fast' : 'slow') : ''; };
    const by = {}; for (const t of a) { const k = key(t); if (k) (by[k] = by[k] || []).push(t); }
    const best = Object.entries(by).sort((u, v) => v[1].length - u[1].length)[0]; if (!best) continue;
    const [k, grp] = best; if (grp.length < 6 || grp.filter((t) => t.H >= 5).length < 3) continue;
    const kin = a.filter((t) => key(t, 0.5) === k);                          // the new species takes everything leaning its way, so the split is clean
    const whole = a.length - kin.length < 4, W = lnM(grp, (t) => t.w ?? sp.wet), Gm = Math.exp(lnM(grp, (t) => Math.log(t.g || 1))), Hm = lnM(grp, (t) => t.hm);
    let ni = whole ? si : G.trees.findIndex((s, i) => s.gone && !stand.some((t) => t.si === i)); if (ni < 0) { if (G.trees.length >= 6) continue; ni = G.trees.length; }
    const T = tl(sp), b = mutate({ trees: [sp], land: { amp: 1 }, floor: { moss: 1 } }, rnd, 0.15).trees[0], r = Hm / ((sp.H[0] + sp.H[1]) / 2), tint = (c) => c.map((v, i) => max(0.01, v + TINT[k][i] * (0.7 + rnd() * 0.6)));
    const rest = sp.par ? sp.nm.replace(/^\S+ /, '').replace(/ [IVX]+$/, '') : low(sp.nm), taken = (n) => G.trees.some((s) => s.nm === n);
    let nm = (WORDS[k].find((w) => !taken(w + ' ' + rest)) || WORDS[k][0]) + ' ' + rest; for (let i = 2; taken(nm); i++) nm = nm.replace(/ [IVX]+$/, '') + ' ' + ['', '', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][min(i, 10)];   // every species gets a name of its own
    const ns = { ...b, gone: 0, nm, wet: W, H: [sp.H[0] * r, sp.H[1] * r], tl: [T[0] / Gm ** 0.7, T[1] * Gm, min(0.97, T[2] / Gm), T[3], T[4]],
      leaf: { ...b.leaf, a: tint(b.leaf.a), b: tint(b.leaf.b) }, bark: { ...b.bark, a: tint(b.bark.a) }, par: sp.nm, root: sp.root || sp.nm, born: year };
    for (const t of whole ? a : kin) { t.si = ni; t.g = (t.g || 1) / Gm; }
    ns.h = H.push({ nm, born: year, par: sp.h, col: ns.leaf.b }) - 1; if (whole) { H[sp.h].gone = year; H[sp.h].to = 1; }
    G.trees[ni] = ns; sp.split = year; ev++;
    say(whole ? 'The ' + pl(low(sp.nm)) + ' here have changed so far that they are now a new species: the ' + low(ns.nm)
      : kin.length + ' ' + pl(low(sp.nm)) + ' that grow ' + { wet: 'in the wet', dry: 'on the dry ground', fast: 'fast and die young', slow: 'slowly and live long' }[k] + ' no longer breed with the rest: a new species, the ' + low(ns.nm));
  }
  return ev;
}

// ---- fire (2 MB rung). The plot is a grid of fuel. A burning cell burns down and lights its neighbours, far more readily
// downwind and hardly at all when wet; water does not burn. Trees caught in it die unless thick bark and height save them.
export function mkFire(S, strm) {
  const N = 32, c = S / N, fuel = new Float32Array(N * N).fill(1), heat = new Float32Array(N * N), char = new Float32Array(N * N);
  const ix = (x, z) => min(N - 1, max(0, floor((x + S / 2) / c))) + N * min(N - 1, max(0, floor((z + S / 2) / c))), P = (i) => (i + 0.5) * c - S / 2;
  const F = {
    n: 0, killed: 0, at: (x, z) => char[ix(x, z)],
    light(x, z) { const i = ix(x, z); if (fuel[i] > 0.3) { heat[i] = 1; F.n = max(F.n, 1); } },
    near(x, z) { let b = null, bd = 12; const i0 = ix(x, z), ci = i0 % N, cj = floor(i0 / N); for (let j = max(0, cj - 5); j <= min(N - 1, cj + 5); j++) for (let i = max(0, ci - 5); i <= min(N - 1, ci + 5); i++) if (heat[i + j * N] > 0) { const d = hypot(P(i) - x, P(j) - z); if (d < bd) { bd = d; b = [P(i), P(j), d]; } } return b; },
    step(dt, wd, wet, rnd, stand, G) {
      let n = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = i + j * N; if (heat[k] <= 0) continue; n++; heat[k] = max(0, heat[k] - dt / 9); char[k] = 1; fuel[k] = max(0, fuel[k] - dt / 9);
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
          const I = i + a, J = j + b, q = I + J * N; if ((!a && !b) || I < 0 || J < 0 || I >= N || J >= N || heat[q] > 0 || fuel[q] < 0.3 || (strm && strm.dist(P(I), P(J)) < 0)) continue;
          if (rnd() < dt * 0.2 * fuel[q] * (1 - wet) ** 2 * max(0, 1 + 1.6 * (a * wd[0] + b * wd[1]) / hypot(a, b))) heat[q] = 1;
        }
      }
      for (const t of stand) if (!t.st && !t.fx && heat[ix(t.x, t.z)] > 0) { t.fx = 1; if (rnd() > tl(G.trees[t.si])[4] * min(1, t.H / 14)) { t.st = 1; t.t = 0; t.burnt = 1; F.killed++; } }
      F.n = n; return n;
    },
    rest(yrs, stand) { for (let k = 0; k < N * N; k++) { fuel[k] = min(1, fuel[k] + 0.1 * yrs); char[k] = max(0, char[k] - 0.14 * yrs); } for (const t of stand) t.fx = 0; },   // fuel builds again, ash greens over
    draw(cap, B, t) { for (let k = 0; k < N * N; k++) if (heat[k] > 0) { const X = P(k % N), Z = P(floor(k / N)), y = B.Hgt(X, Z), w = sin(k * 12.9898) * 43758.5; for (let i = 0; i < 2; i++) { const a = w + i * 2.4, x = X + cos(a) * 0.6 * i, z = Z + sin(a) * 0.6 * i, h = (0.9 + 1.6 * abs(sin(t * (5 + i) + w))) * (0.4 + heat[k]) * (k % 5 ? 1 : 2.4); cap([x, y - 0.1, z], 0.5 - 0.15 * i, [x + sin(t * 3 + a) * 0.25, y + h, z + cos(t * 2.3 + a) * 0.25], 0.04, 17, 0.5); } } },
  };
  return F;
}

// How each biome's genome grows above the 20 kB rung: a stream [half width, meander, where the pool is, pool size] and who lives there.
export const MORE = {
  mixed: { stream: [1.5, 7, 0.1, 4.5], life: { deer: 4, birds: 20, hare: 3, fox: 1, beaver: 2 }, flower: 520 },
  boreal: { stream: [1.2, 8, -0.3, 6], life: { deer: 3, birds: 14, hare: 4, fox: 1 }, flower: 160 },
  oldgrowth: { stream: [1.8, 6, 0.35, 3.5], life: { deer: 3, birds: 16, hare: 2, fox: 1 }, flower: 240 },
  aspen: { stream: [1.1, 9, -0.1, 5], life: { deer: 5, birds: 24, hare: 4, fox: 0, beaver: 2 }, flower: 900 },
};

// ---- the year (2 MB rung). uSe.x autumn, uSe.y leaf fall, uSe.w spring. Broad leaves turn and drop; needles stay;
// ferns and grass die back; flowers are out from spring until the leaves turn.
export const SEAV = `
  if ((uSe.y > 0. && (ty < .5 || (ty > 1.5 && ty < 4.5)) && h1(sd * 77.) < uSe.y * (ty > 2.5 ? .85 : 1.)) || (ty > 5.5 && ty < 7.5 && uSe.x + uSe.y > .1)) { gl_Position = vec4(2., 2., 2., 1.); return; }
`;
export const SEAF = `
  if (ci.x > 7.5) { float hh = h1(ci.w * 11.7); alb = (hh < .3 ? vec3(.5, .3, .1) : hh < .6 ? vec3(.38, .2, .07) : hh < .8 ? vec3(.62, .42, .12) : vec3(.25, .15, .07)) * (.8 + .4 * vn(uv * 9. + ci.w * 40.)); }   // fallen leaves: tan, russet, gold, rotting brown
  else if (ci.x > 5.5) { float hh = h1(ci.w * 7.3); alb = vein > .5 ? vec3(.9, .7, .1) : hh < .35 ? vec3(.92, .9, .85) : hh < .6 ? vec3(.95, .8, .15) : hh < .8 ? vec3(.5, .35, .85) : vec3(.9, .35, .5); }
  else if (ci.x < .5 || (ci.x > 1.5 && ci.x < 2.5)) alb = mix(mix(alb, alb * vec3(1.1, 1.4, .7) + vec3(.02, .05, 0.), uSe.w), mix(vec3(.62, .36, .03), vec3(.45, .07, .02), h1(ci.w * 91. + float(sp))), uSe.x * smoothstep(.05, .5, h1(ci.w * 13.) + .3));
  else if (ci.x > 2.5 && ci.x < 4.5) alb = mix(alb, vec3(.38, .27, .09), uSe.x * .7);
`;
// a flower: five petals round a yellow eye
export const FLW = `
  if (ty == 8) { float t = u.x, hw = .25 * pow(sin(3.1416 * pow(clamp(t, 0., 1.), .75)), .9) * (1. + (h1(sd * 3.1) < .5 ? .14 * sin(t * 34.) : .03 * sin(t * 90.))); vein = step(abs(u.y), .006) * step(t, .97);
    LF = vec4(t, u.y / max(hw, 1e-3), h1(sd * 5.7), 0.); return max(step(.05, t) * step(t, 1.) * step(abs(u.y), hw), step(abs(u.y), .008) * step(t, .06)); }
  if (ty == 6) {
    vec2 q = u - vec2(.5, 0.); float r = length(q) * 2., a = atan(q.y, q.x), hh = h1(sd * 7.3), np = hh < .35 ? 14. : 5., e = hh < .35 ? .3 : .22, c = abs(cos(a * np * .5 + sd * 6.));
    float rim = hh < .35 ? .3 + .65 * pow(c, 5.) : hh < .8 ? .26 + .7 * pow(c, .8) : .3 + .62 * pow(c, .6) - .14 * smoothstep(.93, 1., c);
    rim += .02 * sin(a * 37. + sd * 9.) * smoothstep(.0012, .0004, fw); vein = step(r, e); LF = vec4(r, a, sd, 6.); return step(r, rim);
  }
`;

// ---- close detail (2 MB rung). FP is how many metres one pixel spans where it lands. A pattern is drawn only once it is
// a few pixels across, so from afar it costs nothing and never shimmers; walk up to a trunk, a leaf or a stone and more
// of it appears, the way a microscope's fine focus brings up one layer after another.
export const MICRO = `
uniform float uNdl, uLeaf; uniform vec3 uFor, uStr;
float FP = 1., GL = 0.; vec4 LF = vec4(-1.);
float vis(float s) { return smoothstep(1.5, 4., s / max(FP, 1e-6)); }
vec3 vor(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8., id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), r = g + vec2(h2(i + g), h2(i + g + 17.3)) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = h2(i + g + 5.1); } else if (d < d2) d2 = d; }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
vec4 vor2(vec2 p) {
  vec2 i = floor(p), f = fract(p), o = vec2(0.); float d1 = 8., id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), r = g + vec2(h2(i + g), h2(i + g + 17.3)) - f; float d = dot(r, r); if (d < d1) { d1 = d; o = r; id = h2(i + g + 5.1); } }
  return vec4(-o, sqrt(d1), id);
}
float DEW = 0.;
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float spec(vec3 n, vec3 p, float g) { return pow(max(dot(reflect(-uSun, n), normalize(uCam - p)), 0.), g); }
// a bump from a height field, by its screen-space slope; a macro, so vertex shaders that share this preamble never see dFdx
#define BUMP(n, p, h) { vec3 dx_ = dFdx(p), dy_ = dFdy(p), r1_ = cross(dy_, n), r2_ = cross(n, dx_); float de_ = dot(dx_, r1_); if (abs(de_) > 1e-14) n = normalize(n - (dFdx(h) * r1_ + dFdy(h) * r2_) / de_); }
vec3 mossc(vec3 p) {
  vec3 c = mix(vec3(.05, .13, .02), vec3(.26, .38, .06), vn3(p * 9.) * .6 + vn3(p * 31.) * .4);
  if (FP < .004) {                                                         // close: a turf of separate shoots, each a small star of leaves, pale at its growing tip
    vec3 v = vor(p.xz * 260. + p.y * 140.); float k = vis(.004);
    c *= mix(1., (.4 + 1. * smoothstep(.6, .05, v.x)) * (.8 + .4 * v.z), k);
    c = mix(c, vec3(.5, .6, .18), k * smoothstep(.14, .03, v.x) * step(.45, v.z) * .55);
    vec3 w = vor(p.xz * 800. + p.y * 500. + 3.); c *= mix(1., .65 + .5 * smoothstep(0., .3, w.y), vis(.0012));
  }
  return c;
}
`;
// a leaf, needle, frond, blade or flower seen close: venation, edges, spots, spores, stomata, pollen
export const LEAFD = `
  float gl0 = 0., bv = 0., hh = 0.; FP = max(length(dFdx(pw)), length(dFdy(pw)));
  if (LF.w > -.5 && FP < .004) {
    float k1 = vis(.006), k2 = vis(.0016), t = LF.x, y = LF.y, ay = abs(y);
    if (LF.w < .5) {                                                       // a broad leaf
      float sv = abs(fract(t * 8. - ay * 1.2 + LF.z) - .5), v2 = smoothstep(.07, .02, sv) * smoothstep(.95, .6, ay) * smoothstep(.02, .1, t) * k1;   // side veins, out and forward to the margin
      vec3 nt = vor(vec2(t * 30., y * 8.) + LF.z * 17.); float v3 = smoothstep(.08, 0., nt.y) * k2;                                               // the finest veins close a net of islands
      bv = max(max(v2, v3 * .7), vein); hh = smoothstep(0., .2, nt.y) * k2 * .5 - max(v2, vein);
      alb *= (1. + .22 * max(v2, v3 * .5)) * (.92 + .16 * vn(vec2(t * 24., y * 7.) + LF.z * 31.));
      alb = mix(alb, vec3(.32, .2, .06), smoothstep(.8, 1., ay) * step(.55, LF.z) * .55 * k1);                                                   // a dry margin on some
      vec3 s2 = vor(vec2(t * 16., y * 5.) + LF.z * 53.); float spot = step(.82, LF.z) * step(s2.z, .06) * k1;                                       // a fungus's spots, each in a yellow halo
      alb = mix(alb, vec3(.55, .5, .1), spot * smoothstep(.42, .25, s2.x)); alb = mix(alb, vec3(.08, .05, .02), spot * smoothstep(.16, .1, s2.x));
      alb = mix(alb, vec3(.75, .72, .5), step(LF.z, .08) * smoothstep(.06, .02, abs(y - .55 * sin(t * 9. + LF.z * 40.) * t)) * step(.15, t) * k1);  // a leaf-miner's pale trail
      vec2 lbp = vec2((t - .55) * 3.4, y * .8 - .15) / .1;
      if (abs(LF.z - .415) < .016 && dot(lbp, lbp) < 1.6) { float rb = length(lbp), sp2 = smoothstep(.22, .16, length(fract(lbp * 1.6 + .5) - .5)) * step(.2, abs(lbp.y)); alb = rb > 1. ? vec3(.02) : mix(vec3(.75, .06, .03), vec3(.02), max(sp2, step(abs(lbp.y), .05))); hh = 3. * sqrt(max(1.6 - rb * rb, 0.)); gl0 = 1.; bv = 0.; }
      gl0 = max(gl0, .35);
    } else if (LF.w < 1.5) {                                               // a needle: round in section, a pale band of stomata down one side
      float a = clamp(LF.x, -1., 1.); alb *= mix(1., (.65 + .45 * sqrt(1. - a * a)) * (.75 + .4 * LF.y), k1); alb = mix(alb, vec3(.62, .72, .64), smoothstep(.14, 0., abs(a + .35)) * .5 * k2);
      hh = sqrt(1. - a * a) * k1; gl0 = .5;
    } else if (LF.w < 3.5) {                                               // a fern pinna: a midvein, and beneath, two rows of brown spore dots
      float so = step(dot(nn, uCam - pw), 0.) * smoothstep(.3, .2, length(vec2(fract(y * 7.) - .5, (t - .5) * 1.4))) * step(y, .85) * k1;
      alb = mix(alb, vec3(.33, .18, .05), so); alb *= 1. + .25 * smoothstep(.08, 0., t) * k1; hh = so - smoothstep(.08, 0., t) * k1; gl0 = .2;
    } else if (LF.w < 4.5) {                                               // a grass blade: parallel veins, a drying tip on some
      alb *= 1. + (step(.5, fract(LF.x * 3. + .25)) - .5) * .2 * k2; alb = mix(alb, vec3(.62, .55, .3), smoothstep(.7, 1., y) * step(.6, LF.z) * k1); hh = (step(.5, fract(LF.x * 3. + .25)) - .5) * k2; gl0 = .25;
    } else {                                                               // a flower: veins along each petal, paler tips, pollen on the anthers
      vec2 q = vec2(cos(y), sin(y)) * t; vec3 an = vor(q * 70. + LF.z * 9.);
      if (vein < .5) { float pv = smoothstep(.12, 0., abs(fract(y * 9.) - .5)) * smoothstep(.2, .4, t) * k1; alb *= 1. - .35 * pv; gl0 = abs(h1(LF.z * 7.3) - .47) < .13 ? .9 : .15; alb = mix(alb, min(alb * 1.25 + .08, vec3(1.)), smoothstep(.55, .95, t) * k1); alb *= mix(1., .8, smoothstep(.4, .2, t) * k1); hh = -pv + (1. - abs(cos(y * (h1(LF.z * 7.3) < .35 ? 7. : 2.5)))) * .5 * k1; }
      else { float po = smoothstep(.4, .15, an.x) * k1; alb = mix(alb * mix(1., .55, k1), vec3(1., .7, .1), po); hh = po * 2.; }
    }
  }
  if (FP < .004 && DEW > .02) {
    vec4 dv = vor2(uv * 45. + ci.w * 13.); float R = .2 + .25 * fract(dv.w * 7.), kd = vis(.003); if (dv.w < DEW * .45 && dv.z < R) { vec2 dp = dv.xy / R; float e = length(dp); hh += 8. * sqrt(max(1. - e * e, 0.)) * kd;   // each drop a lens: the leaf seen bright through it, a dark rim, a point of sky
      alb = mix(alb, mix(alb * 1.6 + .04, vec3(.02), smoothstep(.7, .95, e)) + vec3(.9) * smoothstep(.22, .1, length(dp + vec2(.35, -.35))), kd); gl0 = max(gl0, 2. * kd); bv = 0.; }
  }
  BUMP(n, pw, hh * .0004)
`;
// bark close: fine cracks, lichens with their fruiting cups, beetles' exit holes, and galleries in dead wood
export const BARKD = `
    if (bp.x > 3.5) { float u = atan(nw.z, nw.x) * 1.9 * wr / bp.y, v = s / bp.y * 1.3; vec2 g = fract(vec2(u + v, u - v) * 1.6) - .5; tex = smoothstep(.34, .44, abs(g.x) + abs(g.y)); alb = mix(A * (.85 + .3 * vn3(P)), B, tex); alb = mix(alb, B * .55, smoothstep(.12, .04, length(g))); }   // a scale tree's bark: diamonds where leaves once grew, a scar in each
    if (FP < .003) {
      vec2 Q = vec2(atan(nw.z, nw.x) * wr, s); float k = vis(.003), fc = abs(vn3(P * 7.) - .5), fi = vn3(vec3(P.x * 60., P.y * 5., P.z * 60.)) * .6 + vn3(vec3(P.x * 150., P.y * 12., P.z * 150.)) * .4;
      float fs = smoothstep(0., .12, fc) * (.55 + .45 * smoothstep(0., .06, abs(vn3(P * vec3(16., 5., 16.)) - .5)));      // fissures within fissures; fibres running along the limb
      tex = mix(tex, tex * fs * (.7 + .5 * fi), k); alb *= mix(1., (.45 + .55 * fs) * (.75 + .5 * fi), k);
      float ln = vn(Q * 5. + sd * 9.) * .6 + vn(Q * 17. + 3.) * .28 + vn(Q * 55.) * .12 + tex * .1, lt = vn(Q * 1.7 + sd * 4.);   // where a colony has spread: more on the ridges than in the cracks
      float li = smoothstep(.7, .73, ln) * step(.3, fract(sd * 7.31)) * k, rim = li * smoothstep(.77, .71, ln);
      vec3 lb = vor(Q * 110. + lt * 30.), lc = mix(mix(vec3(.56, .56, .41), vec3(.64, .62, .34), smoothstep(.35, .65, lt)), vec3(.74, .47, .14), smoothstep(.8, .86, lt));
      lc *= (.72 + .35 * smoothstep(0., .18, lb.y)) * (.9 + .2 * lb.z) * (1. + .2 * rim);                                                          // lobes pale, dark where they meet, the growing rim paler still
      vec3 ap = vor(Q * 60. + lt * 50.); float apo = li * (1. - rim) * step(ap.z, .12) * smoothstep(.3, .18, ap.x) * vis(.001);                      // cup-shaped fruit bodies away from the rim
      alb = mix(alb, mix(lc, alb * lc * 1.6, .25), li * (.75 + .25 * smoothstep(.72, .8, ln))); alb = mix(alb, lc * vec3(.75, .45, .25), apo); tex = mix(tex, .55 + .35 * smoothstep(0., .18, lb.y) + apo * .3, li * .6);
      vec3 hv = vor(Q * 45. + 3.1); float ho = step(hv.z, .025) * smoothstep(.22, .14, hv.x) * vis(.0015) * (1. - li); alb *= 1. - .85 * ho; tex -= ho * .8;
      if (fract(sd * 13.7) < .3 && kd == 0 && s < 2.5) {                                                                              // an ant trail up some trunks
        float c0 = fract(sd * 3.1) * 6.283 * wr + .02 * sin(s * 7. + sd), dx = abs(Q.x - c0), ph = fract((s - uT * .035) * 38. + h1(floor((s - uT * .035) * 38.)) * .3);
        float ant = step(dx, .0035 * (1. - abs(ph * 2. - .3) * .5)) * (step(ph, .1) + step(.13, ph) * step(ph, .2) + step(.23, ph) * step(ph, .36)) * step(.4, h1(floor((s - uT * .035) * 38.) + sd)) * vis(.001);
        alb = mix(alb, vec3(.03, .02, .015), ant); tex += ant * .6; GL = ant * .5;
      }
      if (kd == 1) { float ga = smoothstep(.05, 0., abs(vn(Q * vec2(30., 6.)) - .5)) * k * (1. - li); alb *= 1. - .45 * ga; tex -= ga * .5; }   // beetles' galleries in wood that has lost its bark
    }
`;
// the forest floor close: single fallen leaves, needles and twigs lying over each other, and the soil's grains between
export const LITTER = `
  if (FP < .006) {
    float k = vis(.02), cov = (.2 + .8 * smoothstep(.42, .6, f1 * .6 + f3 * .4)) * uLa, hit = 0.; vec3 lc = alb;
    vec2 P = pw.xz * 3.5, i = floor(P), f = fract(P);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {           // twigs on top
      vec2 g = vec2(x, y), id = i + g; if (h2(id + 4.4) > .35 * uLa || hit > .5) continue;
      vec2 d = rot(f - g - vec2(h2(id + 3.3), h2(id + 7.7)), h2(id) * 6.3); float w = .018 + .012 * h2(id + 1.);
      if (abs(d.y) < w && abs(d.x) < .45) { hit = 1.; lc = mix(vec3(.2, .13, .08), vec3(.34, .26, .18), vn(d * 90.)) * (.6 + .4 * sqrt(1. - pow(d.y / w, 2.))); hh = 1.5; }
    }
    for (int L = 0; L < 3; L++) {
      if (hit > .5) break;
      P = pw.xz * 15. + float(L) * vec2(7.31, 3.17); i = floor(P); f = fract(P);
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(x, y), id = i + g; float h = h2(id + float(L) * 9.1); if (h > cov * 1.3 || hit > .5) continue;
        vec2 d = rot(f - g - vec2(h2(id + 3.3), h2(id + 7.7)), h * 40.);
        if (h2(id + 1.9) < uNdl) {                                         // a fallen needle
          if (abs(d.y) < .03 && abs(d.x) < .6) { hit = 1.; lc = mix(vec3(.42, .22, .08), vec3(.62, .4, .15), h2(id + 5.)) * (.75 + .25 * sqrt(1. - pow(d.y / .03, 2.))); hh = 1. - float(L) * .3; }
        } else {                                                           // a fallen leaf: midrib and side veins, edges curling and darker, some eaten down to their veins
          float t = d.x / .45 * .5 + .5, hw = .2 * pow(sin(3.1416 * clamp(t, 0., 1.)), .8);
          if (t > 0. && t < 1. && abs(d.y) < hw) {
            float e = abs(d.y) / hw, vv = max(smoothstep(.035, 0., abs(d.y)), smoothstep(.06, .02, abs(fract(t * 6. - abs(d.y) * 4.) - .5)) * step(e, .85) * .7);
            if (h2(id + 8.) < .12 && vv < .3) continue;
            hit = 1.; vec3 b = mix(uLit, mix(vec3(.45, .25, .07), vec3(.22, .12, .05), h2(id + 2.)), .5) * (.7 + .5 * h2(id + 4.));
            lc = b * (1. + .3 * vv) * (1. - .35 * smoothstep(.7, 1., e)) * (.85 + .3 * vn(d * 30. + h * 50.)); hh = 1. - float(L) * .3 - e * .4 + vv * .2;
          }
        }
      }
      if (hit > .5) lc *= 1. - float(L) * .22;                               // the lower layers lie in the upper ones' shade
    }
    vec3 gr = vor(pw.xz * 260.); alb = mix(alb, hit > .5 ? lc : alb * (.65 + .6 * gr.z) * (.7 + .3 * smoothstep(0., .2, gr.y)), k);
    hh *= k;
  }
`;
// stone close: mineral grains, glints of mica, map lichen in black-rimmed tiles
export const STONED = `
    if (FP < .004) {
      vec3 an = abs(nw); vec2 S = an.y > max(an.x, an.z) ? po.xz : an.x > an.z ? po.yz : po.xy; float k = vis(.003);
      vec3 gv = vor(S * 300.), gc = gv.z < .55 ? alb : gv.z < .75 ? alb * 1.25 + .04 : gv.z < .9 ? alb * vec3(1.15, .95, .85) : vec3(.05, .045, .045);
      alb = mix(alb, gc * (.85 + .3 * h1(gv.z * 99.)), k * .6 * smoothstep(0., .08, gv.y)); GL = step(.9, gv.z) * k;
      vec3 mv = vor(S * 40. + 5.); float ml = smoothstep(.55, .62, vn3(po * 1.6 + 4.)) * vis(.01);
      alb = mix(alb, mix(vec3(.05), vec3(.62, .68, .2) * (.8 + .4 * mv.z), smoothstep(.02, .06, mv.y)), ml);
    }
`;
// fur close: single hairs lying along the limb
export const FURD = `
      if (FP < .003) { vec3 H = vec3(nw.x * wr * 900., s * 40., nw.z * wr * 900.); float st = vn3(H) * .6 + vn3(H * vec3(2.1, 1.3, 2.1) + 5.) * .4, k = vis(.002); alb *= mix(1., .62 + .7 * st, k); tex = mix(tex, st, k); }
`;

// mushrooms close: gills beneath (short ones between the long), or pores in brackets; fibrils above and a striate margin
export const MUSHD = `
  else if (kd == 3 && FP < .003) {
    vec3 cc = sd < .4 ? vec3(.55, .05, .03) : sd < .75 ? vec3(.4, .24, .11) : vec3(.7, .55, .3), c0 = pw - nw * wr; float ang = atan(pw.z - c0.z, pw.x - c0.x), k = vis(.0015), dn = length((pw - c0).xz) / max(wr, 1e-4);
    if (nw.y < -.1) { float g = sd < .75 ? smoothstep(.12, .3, abs(fract(ang * 9.55) - .5)) * (mod(floor(ang * 9.55), 2.) > .5 ? step(.6, dn) : 1.) : smoothstep(.25, .4, length(fract(vec2(ang * 30., dn * 22.)) - .5)); alb = mix(vec3(.45, .36, .28), vec3(.86, .8, .68), mix(.6, g, k)); tex = g; }
    else { alb = mix(cc, vec3(.9, .88, .8), smoothstep(.7, .8, vn3(pw * 90.)) * step(sd, .4)); float fb = vn(vec2(ang * 80., dn * 6.)); alb *= mix(1., .8 + .35 * fb * (1. - .5 * step(sd, .4)), k) * (1. - .25 * k * smoothstep(.75, 1., dn) * step(.5, fract(ang * 9.55))); tex = fb; GL = .5 * step(sd, .4); }
  }
`;
// birds close: feathers overlapping like scales
export const FEATHD = `
    if (kd == 6 && FP < .003) { vec3 fv = vor(vec2(atan(nw.z, nw.x) * wr * 2., s) * 150.); alb *= .7 + .6 * smoothstep(0., .3, fv.y) * (.8 + .4 * fv.z); tex = fv.y; GL = .2; }
`;

// the valley's ground, by what grows on it: forest canopy below the treeline (crowns lit on their sunward side, dark
// gaps between, turning in autumn and bare in winter where the trees are broadleaved), rock where it is steep, alpine
// turf above the trees, snow on the tops, wet ground along the river
export const FARD = `
  } else if (uMat > 2.5) {
    float d = xx.x, alt = pw.y, sl = 1. - n.y, wetb = xx.y, tl = 460. + 50. * vn(pw.xz * .003), sn = mix(900., 260., max(uWx.y, uSe.y * .6)) + 40. * vn(pw.xz * .004 + 3.);
    float fo = smoothstep(.6, .42, sl) * smoothstep(tl + 25., tl - 25., alt) * (1. - smoothstep(.55, .85, wetb) * .6);
    vec3 cv = vor(pw.xz / 4.5), cs = vor((pw.xz + uSun.xz * 1.6) / 4.5);
    float crown = smoothstep(.95, .2, cv.x), lit = smoothstep(.1, .9, cs.x - cv.x + .5), dec = 1. - uNdl;
    vec3 can = uFor * (.42 + .4 * vn(pw.xz * .02)) * (.35 + .7 * crown * (.6 + .6 * lit));
    can = mix(can, vec3(dot(can, vec3(.33))), .22) * .85;
    can = mix(can, mix(vec3(.6, .35, .05), vec3(.5, .1, .03), vn(pw.xz * .05)) * (.5 + .6 * crown), uSe.x * dec * step(.35, cv.z));   // autumn, where broadleaves grow
    can = mix(can, vec3(.3, .26, .24) * (.6 + .5 * crown), uSe.y * dec * step(.35, cv.z) * .85);                                        // bare twigs in winter
    vec3 rock = mix(uRB, uRA, vn(vec2(pw.x + pw.z, pw.y * 3.) * .05)) * (.7 + .4 * vn(pw.xz * .3)), turf = mix(vec3(.36, .4, .2), vec3(.5, .45, .3), vn(pw.xz * .01));
    vec3 grd = mix(turf, rock, smoothstep(.35, .62, sl)); grd = mix(grd, mix(vec3(.18, .2, .1), vec3(.12, .1, .07), .5), wetb * .7);
    alb = mix(grd, can, fo * smoothstep(40., 110., d) + fo * (1. - smoothstep(40., 110., d)) * .5);
    alb = mix(alb, vec3(.85, .88, .92), smoothstep(sn - 15., sn + 15., alt) * smoothstep(.75, .5, sl));
    alb = mix(alb, vec3(.8, .84, .9), uWx.y * smoothstep(.7, .4, sl) * (1. - fo * .6));
    n = normalize(n + vec3(cv.x - cs.x, 0., cs.x - cv.x) * fo * .6); ao = .75 + .25 * crown * fo + (1. - fo) * .25;
`;
// a crown in the near band of the valley: the species' leaf colour in clumps, darker beneath, turning and falling with
// the year where the species is broadleaved
export const CROWND = `
    if (kd == 21) {
      vec3 cl = vor(pw.xz * 1.6 + pw.y * 1.3 + sd * 9.); float c0 = smoothstep(.8, .15, cl.x), cf = uBP[sp].z;
      alb = uLB[sp] * (.5 + .6 * c0) * (.75 + .3 * cl.z) * mix(.65, 1.1, smoothstep(-.6, .6, nw.y));
      alb = mix(alb, mix(vec3(.62, .36, .03), vec3(.45, .07, .02), cl.z) * (.5 + .6 * c0), uSe.x * (1. - cf));
      alb = mix(alb, vec3(.32, .27, .25) * (.6 + .5 * c0), uSe.y * (1. - cf) * .9); tex = c0;
    }
`;

// where the stream has cut down through the plot in deep time, the gorge walls show the rock: grey shale finely
// layered, and the bed of pale sandstone in thicker beds, holding its cliff
export const ROCKF = `
    if (uStr.z > .5) { float k = smoothstep(.82, .55, normalize(nw).y), hd = step(uStr.y, pw.y) * step(pw.y, uStr.x);
      vec3 rk = mix(vec3(.3, .28, .27) * (.82 + .22 * sin(pw.y * 31. + vn(pw.xz * 2.) * 3.)), vec3(.64, .52, .37) * (.86 + .18 * sin(pw.y * 6.3 + vn(pw.xz * .6) * 3.)), hd);
      alb = mix(alb, rk * (.8 + .4 * vn3(pw * vec3(1.5, 7., 1.5))), k); n = normalize(mix(n, normalize(nw), k * .6)); ao = mix(ao, 1., k * .5); }
`;
// a lake bed: olive silt, sand rippled in the shallows, a film of algae, and the light the ripples above gather and
// throw across it, fading with depth
export const LAKEG = `
  } else if (uMat < 1.5 && uLeaf > 3.5 && uLeaf < 4.5) {
    vec2 p = pw.xz; float dp = -pw.y, rp = sin(p.x * 3.1 + vn(p * .4) * 6.) * .5 + .5, sd = smoothstep(2.6, 1.2, dp);
    alb = mix(uLit * .85, uLit * 1.4, vn(p * 1.7)) * (.85 + .3 * vn(p * 9.));
    alb = mix(alb, vec3(.5, .45, .32) * (.85 + .25 * rp), sd * smoothstep(.4, .6, vn(p * .3 + 4.)));
    alb = mix(alb, vec3(.07, .1, .05), smoothstep(.6, .75, vn(p * .8 + 9.)) * .6);
    float ca = pow(abs(vn(p * 1.6 + uT * .35) - vn(p * 1.7 - uT * .3)), .5); alb *= .7 + 1.6 * pow(1. - ca, 6.) * exp(-dp * .18);
    float hh2 = rp * .015 * sd; BUMP(n, pw, hh2) ao = 1.;
`;
// a cave: limestone in its beds, flowstone banded as it grew down the walls, mud on the floor, moonmilk, all wet
export const CAVEG = `
  } else if (uMat < 1.5 && uLeaf > 4.5) {
    vec3 q = pw; float wl = smoothstep(.85, .55, normalize(nw).y), bd = smoothstep(.3, .7, sin(q.y * 2.6 + vn(q.xz * .5) * 4.) * .5 + .5);
    alb = mix(vec3(.5, .46, .4), vec3(.62, .57, .48), bd) * (.75 + .35 * vn3(q * vec3(1.5, 4., 1.5)));
    vec3 fs = mix(vec3(.62, .42, .22), vec3(.8, .66, .45), vn3(q * vec3(3., .4, 3.))) * (.9 + .12 * sin(q.y * 9. + vn(q.xz * 2.) * 9.));
    alb = mix(alb, fs, smoothstep(.45, .7, vn3(q * .35 + 7.)) * (wl * .8 + .2));
    alb = mix(alb, vec3(.2, .15, .1) * (.8 + .4 * vn(q.xz * 6.)), (1. - wl) * smoothstep(.5, .7, vn(q.xz * .7 + 3.)));
    alb = mix(alb, vec3(.85, .84, .8), smoothstep(.78, .85, vn3(q * 2.3)) * .7);
    GL = .25 * smoothstep(.4, .7, vn3(q * 1.1 + 2.)); float hh2 = vn3(q * 6.) * .04; BUMP(n, pw, hh2) ao = xx.x;
`;

// a mountain range from far above: forest up to a treeline that sits higher on sunny slopes, then alpine meadow, then
// scree and rock where it is steep, snow above a line that comes down in winter, green valley floors, dark lakes
export const RANGEG = `
  } else if (uMat < 1.5 && uLeaf > 2.5) {
    vec2 p = pw.xz; float y = pw.y, sl = 1. - n.y, w1 = vn(p * 1.3), w2 = vn(p * 5.3 + 3.), w3 = vn(p * 21. + 7.);
    float tl = 1.85 + .4 * (w1 - .5) + .35 * n.x - .4 * sl, sn = mix(2.95, 1.2, uSe.y) + .35 * (w1 - .5) - .25 * n.x;
    vec3 fo = mix(vec3(.04, .1, .045), vec3(.09, .17, .06), w2 * .7 + w3 * .3); if (uFor.g > .01) fo = mix(fo, uFor * (.3 + .35 * w2), .75);
    fo = mix(fo, mix(vec3(.42, .26, .06), vec3(.3, .14, .05), w3), uSe.x * smoothstep(1.3, .8, y) * smoothstep(.3, .7, w2) * .8);
    alb = mix(fo, mix(vec3(.24, .28, .12), vec3(.4, .37, .28), smoothstep(.2, .5, sl)) * (.85 + .3 * w3), smoothstep(tl - .12, tl + .12, y));
    alb = mix(alb, vec3(.34, .32, .3) * (.75 + .45 * w3), smoothstep(.42, .62, sl + .15 * w2));
    alb = mix(alb, vec3(.2, .27, .1) * (.8 + .4 * w3), smoothstep(.7, .35, y) * smoothstep(.12, .03, sl) * .75);
    alb = mix(alb, vec3(.92, .94, .97), smoothstep(sn - .08, sn + .08, y + .3 * w3) * smoothstep(.75, .5, sl));
    alb = mix(alb, vec3(.85, .88, .92), uWx.y * smoothstep(.6, .3, sl) * .8);
    float wt = smoothstep(.4, .6, xx.y); alb = mix(alb, vec3(.03, .07, .09), wt); GL = .35 * wt;
    float hh2 = (w3 - .5) * .004 * (1. - wt); BUMP(n, pw, hh2) ao = 1.;
`;

// under the bark: pale sapwood with the grain running along x, growth rings cut at a slant as broad flames, the
// blue-grey stain bark beetles carry in; frass packed brown in the galleries; on the bark left, red-brown scales on
// top and, at the torn edge, cream inner bark under darker cork
export const WOODG = `
  } else if (uMat < 1.5 && uLeaf > 1.5) {
    vec2 p = pw.xz; float y = pw.y, gv = smoothstep(-.25, -.45, y);
    float rg = fract(p.y * .3 + 1.3 * vn(vec2(p.x * .03, p.y * .08)) + .3 * sin(p.x * .045)), ln = vn(vec2(p.x * .12, p.y * 13.)) * .5 + vn(vec2(p.x * .35, p.y * 37.)) * .5;
    alb = mix(vec3(.6, .47, .3), vec3(.46, .31, .16), smoothstep(.6, .97, rg)) * (.84 + .26 * ln);
    float bs = smoothstep(.56, .78, vn(vec2(p.x * .035, p.y * .45)) * .7 + vn(p * .25) * .3); alb = mix(alb, vec3(.19, .22, .26) * (.8 + .3 * ln), bs * .6);
    vec3 fr = vor(p * 5.); alb = mix(alb, mix(vec3(.19, .1, .04), vec3(.44, .27, .12), fr.z) * (.6 + .5 * smoothstep(0., .3, fr.y)), gv);
    alb = mix(alb, vec3(.03, .02, .01), smoothstep(-1.3, -2.1, y));
    float hh2 = ln * .05 - gv * smoothstep(.3, 0., fr.y) * .08, eg = smoothstep(.45, 1.1, y);
    if (eg > 0.) {
      vec3 sc = vor(vec2(p.x * .3, p.y * .55)), bt = mix(vec3(.14, .085, .06), vec3(.33, .22, .16), sc.z) * (.62 + .42 * smoothstep(0., .16, sc.y)) * (.8 + .35 * vn(p * 1.7));
      vec3 be = mix(vec3(.6, .42, .26), vec3(.24, .13, .08), smoothstep(1., 2.4, y)) * (.85 + .2 * sin(y * 9. + vn(p * 2.) * 3.));
      float top = smoothstep(.5, .8, n.y) * smoothstep(3.6, 4.6, y); alb = mix(alb, mix(be, bt, top), eg); hh2 = mix(hh2, sc.y * .22 * top, eg);
    }
    BUMP(n, pw, hh2) ao = 1. - gv * .4; GL = .02 * (1. - gv);
`;

// the underside of a leaf: pavement cells with wavy, interlocking walls, domed, green with chloroplasts; over the vein
// they are long and narrow; a waxy cuticle gives a sheen
export const LEAFG = `
  } else if (uMat < 1.5 && uLeaf > .5) {
    vec2 p = pw.xz;
    float onv = smoothstep(2.2, 2.8, pw.y - (vn(p * .02) - .5) * 1.2);                                       // up on the vein ridge
    vec2 q = mix(p / 6.5, vec2(p.x / 16., p.y / 2.6), onv); q += (1. - onv) * .22 * vec2(sin(q.y * 6.3 + 1.7 * sin(q.x * 3.1)), sin(q.x * 6.3 + 1.7 * sin(q.y * 2.9)));   // jigsaw lobes
    vec3 cv = vor(q); float wall = smoothstep(.03, .09, cv.y), dome = smoothstep(0., .35, cv.y);
    vec3 ch = vor(p * 1.1 + cv.z * 30.);                                                                      // chloroplasts, seen through the cell
    alb = mix(vec3(.16, .3, .08), vec3(.34, .55, .16), .3 + .5 * cv.z) * (.82 + .3 * smoothstep(.45, .1, ch.x) * (1. - onv * .6));
    alb = mix(vec3(.08, .14, .05), alb, wall); alb = mix(alb, alb * vec3(1.15, 1.1, .9), onv * .5);
    float hh2 = dome * .6 - (1. - wall) * .4; BUMP(n, pw, hh2) ao = .75 + .25 * dome; GL = .05 * dome;
`;
