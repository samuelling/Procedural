// Everything above the 20 kB rung: weather, clouds, water, particles in the air, and animals.
// The shader chunks here are spliced into the renderer's programs; the rest is the life that walks and flies.
/* global TIER */
const { sin, cos, min, max, hypot, atan2, abs, PI, floor } = Math, TAU = PI * 2;

// ---- weather, as rules every surface obeys. uWx: wetness, snow cover, cloud cover, rain on the water.
// uSe: autumn, leaf fall, night, spare.
export const WX3 = `
uniform vec4 uWx, uSe;
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
  vec3 n = normalize(vec3((w0 - wv(pw.xz + vec2(e, 0.))) * .28, 1., (w0 - wv(pw.xz + vec2(0., e))) * .28)), vd = normalize(uCam - pw), rd = reflect(-vd, n);
  rd.y = abs(rd.y);
  float fr = .03 + .97 * pow(1. - max(dot(n, vd), 0.), 5.), sh = shd(pw, vec3(0., 1., 0.)), cs = cshd(pw);
  vec2 bp = pw.xz + n.xz * d * 1.5;                                        // where the bent ray meets the bed
  vec3 bed = mix(vec3(.2, .16, .1), vec3(.5, .45, .34), smoothstep(.3, .7, vn(bp * 8.))) * (.55 + .6 * vn(bp * 27.));
  bed = mix(bed, vec3(.1, .16, .05), smoothstep(.5, .75, vn(bp * 2.3 + 5.)) * .7);                                  // weed on the stones
  float ca = pow(abs(vn(bp * 5. + uT * .6) - vn(bp * 5.3 - uT * .5)), .5);                                       // light gathered by the ripples
  bed = bed * (uSunC * sh * cs * (.35 + .9 * (1. - ca)) * max(uSun.y, 0.) + amb(vec3(0., 1., 0.), 1.)) * exp(-d * vec3(3.2, 1.7, 2.4));
  vec3 rf = mix(vec3(.015, .03, .015) + amb(vec3(0., 1., 0.), .22) * vec3(.3, .5, .2), skyc(rd), smoothstep(.2, .75, rd.y + .25 * vn(pw.xz * 1.3)) * (.35 + .65 * sh));   // in shade it mirrors the canopy, in the open the sky
  vec3 c = mix(bed + vec3(.02, .05, .04) * (1. - exp(-d * 4.)), rf, fr) + uSunC * sh * cs * pow(max(dot(rd, uSun), 0.), 260.) * 4.;
  c = mix(c, vec3(.75, .8, .8) * (amb(n, 1.) + uSunC * sh * cs * .3), smoothstep(.07, .0, d) * smoothstep(.35, .65, vn(pw.xz * 14. - vec2(uT * 1.2, 0.))) * .8);   // a line of foam at the edge
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
// A deer is a skeleton of twenty: its feet find the ground, and it walks, grazes, watches you and runs.
const LIMB = 12;
export function mkLife(B, G, rnd, low) {
  const hs = B.S / 2 - 3, out = new Float32Array(LIMB * 420), st = B.strm;
  let n = 0;
  const cap = (a, ra, b, rb, kind, sd) => { if (n >= 420) return; out.set([a[0], a[1], a[2], ra, b[0], b[1], b[2], rb, 0, 1, sd, kind], n++ * LIMB); };
  const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], rr = (a, b) => a + (b - a) * rnd();
  const dry = (x, z) => !st || st.dist(x, z) > 0.3;
  const spot = () => { for (let k = 0; k < 40; k++) { const x = rr(-hs, hs), z = rr(-hs, hs); if (dry(x, z)) return [x, z]; } return [0, 0]; };
  const mk = (kind, sc, i) => { const p = spot(); return { kind, sc, x: p[0], z: p[1], a: rnd() * TAU, ph: rnd() * 9, tg: spot(), mode: 0, t: rr(2, 9), g: 0, v: 0, sd: rnd(), i }; };
  const deer = (G.life && G.life.deer !== undefined ? G.life.deer : 3), hares = TIER > 3 ? (G.life && G.life.hare) || 0 : 0, foxes = TIER > 3 ? (G.life && G.life.fox) || 0 : 0;
  const herd = [];
  for (let i = 0; i < deer; i++) herd.push(mk(0, i === 0 ? 1.08 : i > 2 ? 0.62 : 0.94, i));
  for (let i = 0; i < hares; i++) herd.push(mk(1, 0.3, i));
  for (let i = 0; i < foxes; i++) herd.push(mk(2, 0.42, i));
  const nb = low ? 10 : (G.life && G.life.birds !== undefined ? G.life.birds : 20), birds = [];
  for (let i = 0; i < nb; i++) birds.push({ p: [rr(-20, 20), rr(14, 24), rr(-20, 20)], v: [rr(-1, 1), 0, rr(-1, 1)], ph: rnd() * 9, sd: rnd() });
  const flies = [];                                                        // butterflies by day, over the open ground
  if (TIER > 3) for (let i = 0; i < (low ? 6 : 14); i++) { const p = spot(); flies.push({ x: p[0], z: p[1], ph: rnd() * 99, sd: rnd() }); }

  // a four-legged animal from joints: body, neck, head, ears, tail, four two-part legs, and antlers on the stag
  const quad = (d, cam, dt, t) => {
    const s = d.sc, k = d.kind, dc = hypot(cam[0] - d.x, cam[2] - d.z);
    // what it is doing: 0 walking somewhere, 1 grazing or drinking, 2 watching you, 3 running from you
    const shy = k === 1 ? 5 : 7, flee = k === 1 ? 3 : 4;
    if (dc < flee) { d.mode = 3; d.t = 2.5; const a = atan2(d.z - cam[2], d.x - cam[0]); d.tg = [max(-hs, min(hs, d.x + cos(a) * 16)), max(-hs, min(hs, d.z + sin(a) * 16))]; }
    else if (dc < shy && d.mode < 2) { d.mode = 2; d.t = 2 + rnd() * 2; }
    d.t -= dt;
    if (d.t < 0) { if (d.mode === 0) { d.mode = 1; d.t = rr(4, 11); } else { d.mode = 0; d.t = rr(6, 16); d.tg = st && rnd() < 0.4 && k === 0 ? (() => { const x = rr(-hs, hs); return [x, st.zc(x) + (rnd() < 0.5 ? -1 : 1) * (st.wid(x) + 0.25)]; })() : spot(); } }
    const want = d.mode === 3 ? (k === 1 ? 5.5 : 4.2) : d.mode === 0 ? (k === 0 ? 0.95 : k === 1 ? 1.6 : 1.3) : 0;
    d.v += (want - d.v) * min(1, dt * 3);
    let ta = atan2(d.tg[1] - d.z, d.tg[0] - d.x);
    if (d.mode === 2) ta = atan2(cam[2] - d.z, cam[0] - d.x);              // turn to face what startled it
    else if (hypot(d.tg[0] - d.x, d.tg[1] - d.z) < 1 && d.mode !== 1) { d.mode = 1; d.t = rr(4, 10); }
    for (const o of B.block) { const ox = o.x - d.x, oz = o.z - d.z, od = hypot(ox, oz); if (od < o.r + 1.3 * s + 0.5 && od > 0.01) { const side = cos(d.a) * oz - sin(d.a) * ox; ta += (side > 0 ? -1 : 1) * 1.1 * (1 - od / (o.r + 1.3 * s + 0.5)); } }   // steer round trunks and stones
    let da = ((ta - d.a + PI * 3) % TAU) - PI; d.a += max(-1, min(1, da)) * dt * (d.mode === 3 ? 4 : 1.6);
    const fx = cos(d.a), fz = sin(d.a); d.x += fx * d.v * dt; d.z += fz * d.v * dt;
    d.x = max(-hs - 2, min(hs + 2, d.x)); d.z = max(-hs - 2, min(hs + 2, d.z));
    d.ph += d.v * dt / (0.55 * s) * (k === 1 ? 0.6 : 1);
    d.g += ((d.mode === 1 ? 1 : 0) - d.g) * min(1, dt * 2);                 // head down to graze
    const F = [fx, 0, fz], R = [-fz, 0, fx], U = [0, 1, 0], hop = k === 1 ? max(0, sin(d.ph * 2)) * 0.25 * min(1, d.v) : 0;
    const gy = (p) => B.Hgt(p[0], p[2]), base = [d.x, 0, d.z], bob = 0.02 * s * sin(d.ph * 2) * min(1, d.v);
    const L = k === 0 ? 1 : k === 1 ? 0.55 : 0.62, hb = L * s, coat = k === 0 ? 4 : k === 1 ? 5 : 7;   // leg length sets how high the body rides
    const hip = add(add(base, F, -0.48 * s), U, gy(add(base, F, -0.48 * s)) + hb * 0.97 + bob + hop * (1 + 0.5 * sin(d.ph * 2))), sh = add(add(base, F, 0.48 * s), U, gy(add(base, F, 0.48 * s)) + hb + bob + hop);
    cap(hip, 0.2 * s * (k === 1 ? 1.5 : 1), sh, 0.21 * s * (k === 1 ? 1.2 : 1), coat, d.sd);
    const g = d.g, nk = add(add(sh, F, (0.3 + 0.28 * g) * s * (k === 0 ? 1 : 0.7)), U, (0.52 - 1.05 * g) * s * (k === 0 ? 1 : 0.45)), hd = add(add(nk, F, 0.3 * s), U, (-0.07 - 0.12 * g) * s);
    cap(add(sh, U, 0.05 * s), 0.13 * s, nk, 0.085 * s, coat, d.sd); cap(nk, 0.095 * s, hd, 0.045 * s, coat, d.sd);
    for (const e of [-1, 1]) {
      const ear = k === 1 ? add(add(nk, R, e * 0.05 * s), U, 0.42 * s) : add(add(add(nk, R, e * 0.15 * s), U, 0.12 * s), F, -0.05 * s);
      cap(add(nk, R, e * 0.04 * s), 0.035 * s, ear, 0.018 * s, coat, d.sd);
      if (k === 0 && d.i === 0) {                                          // the stag: a beam, a brow tine, a fork
        const a0 = add(add(nk, R, e * 0.06 * s), U, 0.07 * s), a1 = add(add(add(a0, R, e * 0.13 * s), U, 0.21 * s), F, -0.08 * s), a2 = add(add(a1, R, e * 0.04 * s), U, 0.18 * s);
        cap(a0, 0.022 * s, a1, 0.016 * s, 9, 0); cap(a1, 0.016 * s, a2, 0.006 * s, 9, 0); cap(a1, 0.014 * s, add(add(a1, F, 0.12 * s), U, 0.1 * s), 0.005 * s, 9, 0); cap(a0, 0.016 * s, add(add(a0, F, 0.11 * s), U, 0.06 * s), 0.005 * s, 9, 0);
      }
      // legs: each foot swings forward off the ground and stands while the body passes over it
      [[hip, 0, -1], [sh, PI, 1]].forEach(([j0, off, fore]) => {
        const ph = d.ph + off + (e > 0 ? PI : 0) * (k === 1 ? 0 : 1) + (k === 1 && fore > 0 ? 0.6 : 0), sw = sin(ph), mv = min(1, d.v * 1.2);
        const J = add(add(j0, R, e * 0.11 * s), U, -0.1 * s), ft = add(add(base, F, fore * 0.48 * s + 0.3 * s * sw * mv), R, e * 0.11 * s);
        ft[1] = gy(ft) + (max(0, cos(ph)) * 0.14 * s * mv + hop * 0.8) + 0.03 * s;
        const kn = add(add([(J[0] + ft[0]) / 2, (J[1] + ft[1]) / 2, (J[2] + ft[2]) / 2], F, fore * 0.07 * s * (1 + max(0, cos(ph)) * mv)), U, 0.02 * s);
        cap(J, 0.075 * s, kn, 0.042 * s, coat, d.sd); cap(kn, 0.04 * s, ft, 0.026 * s, k === 0 ? 5 : coat, d.sd);
      });
    }
    const tl = k === 2 ? add(add(hip, F, -0.5 * s), U, -0.12 * s + 0.05 * s * sin(t * 2 + d.sd * 9)) : add(add(hip, F, -0.16 * s), U, (k === 1 ? 0.05 : -0.04) * s);
    cap(hip, (k === 2 ? 0.1 : 0.06) * s, tl, (k === 2 ? 0.07 : 0.035) * s, k === 2 ? 7 : 8, d.sd);
  };

  return {
    out, herd, birds,
    counts: { deer, birds: nb, hares, foxes, flies: flies.length },
    // one step of everything alive; returns how many limbs to draw
    step(dt, t, cam, night) {
      n = 0;
      for (const d of herd) quad(d, cam, dt, t);
      // birds: each steers toward the flock's middle, matches its neighbours, keeps its distance, and follows a point that circles the plot
      const wp = [sin(t * 0.11) * 22, 19 + 5 * sin(t * 0.07), cos(t * 0.083) * 22], c = [0, 0, 0];
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
      for (const b of flies) {                                             // butterflies: two wings that clap, wandering low over the ground
        if (night > 0.4) break;
        b.ph += dt; const a = b.ph * 0.4 + sin(b.ph * 0.9 + b.sd * 9) * 2; b.x += cos(a) * dt * 0.8; b.z += sin(a) * dt * 0.8;
        if (abs(b.x) > hs || abs(b.z) > hs) { b.x *= 0.97; b.z *= 0.97; }
        const p = [b.x, B.Hgt(b.x, b.z) + 0.6 + 0.35 * sin(b.ph * 1.7 + b.sd * 5) + 0.1 * sin(b.ph * 9), b.z], F = [cos(a), 0, sin(a)], R = [-F[2], 0, F[0]], fl = abs(sin(b.ph * 11)) * 1.2 + 0.15;
        for (const e of [-1, 1]) { const w = add(add(p, R, e * 0.07 * cos(fl)), [0, 1, 0], 0.07 * sin(fl)); cap(p, 0.012, add(w, F, 0.03), 0.045, 10, b.sd); cap(p, 0.01, add(w, F, -0.04), 0.032, 10, b.sd); }
      }
      return n;
    },
  };
}

// How each biome's genome grows above the 20 kB rung: a stream [half width, meander, where the pool is, pool size] and who lives there.
export const MORE = {
  mixed: { stream: [1.5, 7, 0.1, 4.5], life: { deer: 4, birds: 20, hare: 3, fox: 1 }, flower: 520 },
  boreal: { stream: [1.2, 8, -0.3, 6], life: { deer: 3, birds: 14, hare: 4, fox: 1 }, flower: 160 },
  oldgrowth: { stream: [1.8, 6, 0.35, 3.5], life: { deer: 3, birds: 16, hare: 2, fox: 1 }, flower: 240 },
  aspen: { stream: [1.1, 9, -0.1, 5], life: { deer: 5, birds: 24, hare: 4, fox: 0 }, flower: 900 },
};

// ---- the year (2 MB rung). uSe.x autumn, uSe.y leaf fall, uSe.w spring. Broad leaves turn and drop; needles stay;
// ferns and grass die back; flowers are out from spring until the leaves turn.
export const SEAV = `
  if ((uSe.y > 0. && (ty < .5 || (ty > 1.5 && ty < 4.5)) && h1(sd * 77.) < uSe.y * (ty > 2.5 ? .85 : 1.)) || (ty > 5.5 && uSe.x + uSe.y > .1)) { gl_Position = vec4(2., 2., 2., 1.); return; }
`;
export const SEAF = `
  if (ci.x > 5.5) { float hh = h1(ci.w * 7.3); alb = vein > .5 ? vec3(.9, .7, .1) : hh < .35 ? vec3(.92, .9, .85) : hh < .6 ? vec3(.95, .8, .15) : hh < .8 ? vec3(.5, .35, .85) : vec3(.9, .35, .5); }
  else if (ci.x < .5 || (ci.x > 1.5 && ci.x < 2.5)) alb = mix(mix(alb, alb * vec3(1.1, 1.4, .7) + vec3(.02, .05, 0.), uSe.w), mix(vec3(.62, .36, .03), vec3(.45, .07, .02), h1(ci.w * 91. + float(sp))), uSe.x * smoothstep(.05, .5, h1(ci.w * 13.) + .3));
  else if (ci.x > 2.5 && ci.x < 4.5) alb = mix(alb, vec3(.38, .27, .09), uSe.x * .7);
`;
// a flower: five petals round a yellow eye
export const FLW = `
  if (ty == 6) { vec2 q = u - vec2(.5, 0.); float r = length(q) * 2., a = atan(q.y, q.x); vein = step(r, .26); return step(r, .5 + .45 * abs(cos(a * 2.5 + sd * 6.))); }
`;
