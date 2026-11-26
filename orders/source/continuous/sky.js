// The sky of each planet, from the ground or from space: its air scattering its star's light (the colour its genome
// gives it), the star itself, the night side's stars, its moons, and its rings if it has them. Then the clouds: a
// shell of air whose density is a three-dimensional noise the wind carries, lit by marching toward the star through
// it. Inside the shell you are in cloud; above it the tops are lit; from space the shell is a skin over the globe.
export function mkSky(gl, prog, PRE) {
  const { hypot } = Math;
  const QV = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const RAY = `
uniform vec3 uR, uU, uF; uniform vec2 uTan; in vec2 v; uniform float uPR, uSunSz; uniform mat3 uLP; uniform vec3 uCamP;
vec3 ray() { vec2 s = (v * 2. - 1.) * uTan; return normalize(uF + uR * s.x + uU * s.y); }
vec2 sph(vec3 ro, vec3 rd, float r) { float b = dot(ro, rd), c = dot(ro, ro) - r * r, d = b * b - c; if (d < 0.) return vec2(1e30, -1e30); d = sqrt(d); return vec2(-b - d, -b + d); }
// light reaching a point from the star, through the air above it (and none if the planet is in the way)
vec3 sunT(vec3 p, float h) {
  float r = length(p), cz = dot(p / r, uSun), hz = -sqrt(max(0., 1. - pow(uPR / r, 2.)));
  if (cz < hz - .01) return vec3(0.);
  float ch = 1. / (max(cz - hz, 0.) + .02 + .2 * exp(-max(cz - hz, 0.) * 30.));
  return exp(-uBeta * uHs * exp(-max(h, 0.) / uHs) * min(ch, 60.) * 1.1) * smoothstep(hz - .01, hz + .01, cz);
}
// single scattering along the ray, up to tmax: the colour added and what passes
vec3 scatter(vec3 rd, float tmax, out vec3 tr) {
  vec3 ro = vec3(0., uPR + uAlt, 0.); float top = uPR + uHs * 14.; vec2 ta = sph(ro, rd, top); tr = vec3(1.);
  float t0 = max(ta.x, 0.), t1 = min(ta.y, tmax); if (t1 <= t0) return vec3(0.);
  vec3 acc = vec3(0.), od = vec3(0.); float dt = (t1 - t0) / 16., mu = dot(rd, uSun), pr = .0597 * (1. + mu * mu), pm = .12 * (1. - .64) / pow(1.64 - 1.6 * mu, 1.5);
  for (int i = 0; i < 16; i++) {
    float t = t0 + dt * (float(i) + .5); vec3 p = ro + rd * t; float h = length(p) - uPR, dn = exp(-max(h, 0.) / uHs);
    vec3 a = exp(-uBeta * od - uBeta * .2 * dn * dt * .5); od += dn * dt;
    acc += a * sunT(p, h) * dn * dt;
  }
  tr = exp(-uBeta * od);
  return uSunC * acc * (uBeta * pr + 2.2e-6 * pm * (uBeta.y / 1.35e-5)) * 14.;
}`;
  const sky = prog(QV, PRE + RAY + `
uniform vec4 uMoon[3]; uniform int uNm;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
float hh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 rd = ray(), ro = vec3(0., uPR + uAlt, 0.); vec2 tp = sph(ro, rd, uPR); bool hit = tp.x > 0.;
  vec3 tr, c = scatter(rd, hit ? tp.x : 1e30, tr);
  if (!hit) {
    vec3 wd = uLP * rd, a = abs(wd), cube = wd / max(a.x, max(a.y, a.z)); vec3 cell = floor(cube * 420.); float s = hh(cell);   // the stars, fixed to the sky
    float st = step(.9965, s) * pow(hh(cell + 3.1), 6.) * 3. * smoothstep(.0, .5, 1. - length(fract(cube * 420.) - .5) * 2.2);
    c += vec3(.8 + .4 * hh(cell + 9.), .85, 1.) * st * tr * (1. - smoothstep(.0, .25, dot(c, vec3(.3, .5, .2))) );
    for (int i = 0; i < 3; i++) { if (i >= uNm) break; vec4 m = uMoon[i]; vec3 md = normalize(m.xyz); float cs = dot(rd, md), sz = m.w;   // moons
      if (cs > cos(sz)) { float x = acos(clamp(cs, -1., 1.)) / sz; vec3 side = normalize(rd - md * cs + 1e-7), nn = normalize(-md * sqrt(max(0., 1. - x * x)) + side * x);
        float lit = max(dot(nn, uSun), 0.); c = c * .1 + (uSunC * .35 * (.55 + .45 * hh(floor(rd * 900.))) * lit + vec3(.004)) * tr; } }
    float sd = dot(rd, uSun), sz = uSunSz; c += uSunC * tr * (smoothstep(cos(sz * 1.2), cos(sz * .8), sd) * 40. + pow(max(sd, 0.), 1500. / (sz * 200.)) * .4);   // the star, and its glare
  }
  if (uUnder > .5) {                                                       // from under the water: the surface overhead, the sky through its window
    float t = rd.y > 0. ? uCamDep / rd.y : 1e5; vec2 w = rd.xz / max(rd.y, .05) * uCamDep * .15 + uT * .3;
    float win = smoothstep(.62, .7, rd.y + .03 * (n2(w * 3.) - .5)), rip = .6 + .8 * n2(w * 7. + uT);
    vec3 top = mix(uLiqC * uSky * 2., (uSky * 2.5 + uSunC * pow(max(dot(rd, uSun), 0.), 40.) * 3.) * rip, win);
    c = rd.y > 0. ? sea(top * seaLight(0.), t) : sea(vec3(0.), 1e5);
  }
  oC = vec4(c, 1.); oD = vec4(1e12, 0, 0, 1);
}`);
  // the clouds and the rings, over whatever is drawn, no farther than it
  const cl = prog(QV, PRE + RAY + `
uniform sampler2D uDist; uniform float uCov, uB0, uB1, uRing0, uRing1; uniform vec3 uRingN; out vec4 o;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) { vec3 i = floor(p), f = p - i; f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + 1.), f.x), f.y), f.z); }
float uFp, gC;
float dens(vec3 pl, float h, int oc) {                                    // pl: planet-fixed metres (folded); h: height above the sea
  float sc = uB1 - uB0; vec3 q = pl / (sc * 1.05) + vec3(uT * .006, 0., uT * .002);
  float g0 = smoothstep(.7, .25, uFp / (sc * 1.05)), g1 = smoothstep(.7, .25, uFp / (sc * .5));   // from far off a pixel holds many clouds: take their mean,
  float base = mix(.275, n3(q * vec3(1., 1., 1.)) * .55, g0) + mix(.14, n3(q * 2.1 + 3.1) * .28, g1);
  float w0 = smoothstep(.7, .25, uFp / 4e5), w1 = smoothstep(.7, .25, uFp / 7e4), w2 = smoothstep(.7, .25, uFp / 2.3e4);
  float cv = clamp(uCov + 1.3 * (n3(pl / 4e5 + 2.1) - .5) * w0 + .7 * (n3(pl / 7e4 + 5.3) - .5) * w1 + .3 * (n3(pl / 2.3e4 + 1.7) - .5) * w2, 0., 1.);   // weather: fronts, clear spells, overcast
  float hf = clamp((h - uB0) / sc, 0., 1.), prof = smoothstep(0., .12, hf) * smoothstep(1., .45, hf);
  float d = base * prof - (1. - cv) * .55, sg = (.16 * (1. - g0) + .08 * (1. - g1)) * prof + .55 * (.2 * (1. - w0) + .11 * (1. - w1) + .05 * (1. - w2)) + 1e-4;
  gC = smoothstep(-sg, sg, d); d = max(d, 0.) + sg * .6 * gC;          // and how much of the pixel they cover
  if (d <= 0. || oc < 2) return max(d, 0.) * 3.;
  float f1 = smoothstep(.8, .2, uFp / (sc * .16)), f2 = smoothstep(.8, .2, uFp / (sc * .07));
  d -= (mix(.25, n3(q * 6.3 + 7.) * .5, f1) + mix(.125, n3(q * 15. + 1.) * .25, f2)) * .16 * (1. - hf * .3);
  return max(d, 0.) * 3.;
}
void main() {
  vec3 rd = ray(), ro = vec3(0., uPR + uAlt, 0.); float lim = texture(uDist, v).r; vec4 res = vec4(0, 0, 0, 1);
  // the shell between the two spheres, along the ray, before whatever is drawn there
  float r0 = uPR + uB0, r1 = uPR + uB1, rc = length(ro); vec2 a = sph(ro, rd, r0), b = sph(ro, rd, r1); float t0, t1;
  if (rc < r0) { t0 = a.y; t1 = b.y; } else if (rc < r1) { t0 = 0.; t1 = a.x > 0. ? a.x : b.y; } else { t0 = b.x; t1 = a.x > 0. ? a.x : b.y; }
  t0 = max(t0, 0.); t1 = min(min(t1, lim), t0 + 90000.);
  vec3 acc = vec3(0.); float T = 1., cm = 0., tw = 0.;
  if (t1 > t0 && uCov > 0.) {
    float dt = (t1 - t0) / 48., t = t0 + dt * h1(gl_FragCoord.xy + fract(uT) * 37.), mu = dot(rd, uSun), ph = .55 * (1. - .49) / pow(1. + .49 - 1.4 * mu, 1.5) / 12.566 + .45 * .0796;
    for (int i = 0; i < 48; i++) {
      vec3 p = ro + rd * t; float h = length(p) - uPR; vec3 pl = uCamP + uLP * (p - ro); uFp = t * uPix; float d = dens(pl, h, 3); cm = max(cm, gC);
      if (d > .002) {
        float sh = 0.; for (int j = 1; j <= 4; j++) { vec3 pj = p + uSun * 120. * float(j * j); sh += dens(uCamP + uLP * (pj - ro), length(pj) - uPR, 1); }
        vec3 L = uSunC * exp(-sh * 1.1) * ph * 9. * sunT(p, h) + uSky * (.35 + .5 * clamp((h - uB0) / (uB1 - uB0), 0., 1.));
        float al = 1. - exp(-d * dt * .004); acc += T * al * L; tw += T * al * t; T *= 1. - al;
        if (T < .02) break;
      }
      t += dt;
    }
    float a0 = max(1. - T, 1e-3), al = (1. - T) * cm * mix(1., .7, smoothstep(2e3, 2e4, uAlt));
    if (al > .002) { vec3 tr; vec3 sc = scatter(rd, tw / a0, tr); res = vec4((acc / a0 * tr + sc) * al, 1. - al); }
  }
  // rings: a disc through the planet's centre, banded, lit unless the planet shadows it
  if (uRing1 > 0.) {
    vec3 roc = ro;   // the ray's origin, from the centre
    float dn = dot(rd, uRingN); if (abs(dn) > 1e-5) { float t = -dot(roc, uRingN) / dn; vec3 p = roc + rd * t; float r = length(p) / uPR;
      if (t > 0. && t < lim && r > uRing0 && r < uRing1) {
        float x = (r - uRing0) / (uRing1 - uRing0), bd = .55 + .45 * sin(x * 60. + sin(x * 13.) * 3.) * n3(vec3(x * 300., 0., 0.)), gap = smoothstep(.0, .02, abs(x - .62)) * smoothstep(.0, .01, abs(x - .3));
        float alp = clamp(bd * gap * (1. - pow(abs(x * 2. - 1.), 6.)), 0., 1.) * .85;
        vec2 sp = sph(p, uSun, uPR); float shad = sp.x > 0. ? .08 : 1.;
        vec3 rc2 = vec3(.75, .68, .58) * (.6 + .4 * n3(vec3(x * 90., 1., 0.))) * (uSunC * .5 * shad * (.4 + .6 * abs(dot(uRingN, uSun))) + uSky * .1);
        vec3 tr; vec3 sc = scatter(rd, t, tr); rc2 = rc2 * tr + sc;
        if (t < tw / max(1. - T, 1e-3) || res.a > .999) res = vec4(res.rgb * (1. - alp) + rc2 * alp, res.a * (1. - alp)); else res = vec4(res.rgb + rc2 * alp * res.a, res.a * (1. - alp));
      } } }
  if (uAur > 0. && rd.y > 0. && lim > 1e11) { vec3 c = vec3(0.), tr = vec3(1.);
    {                                          // aurora: curtains hanging from the high air, swaying
      float az = atan(rd.x, rd.z), el = asin(rd.y), ec = .45 + .18 * sin(az * 1.3 + uT * .03) + .08 * sin(az * 3.1 - uT * .05);
      float cur = smoothstep(ec - .25, ec, el) * exp(-max(el - ec, 0.) * 3.5) * (.35 + .65 * pow(.5 + .5 * sin(az * 23. + 4. * n2(vec2(az * 4., uT * .08))), 3.)) * (.5 + .5 * n2(vec2(az * 9., uT * .3)));
      c += mix(uAurC, uAurC.bgr * vec3(1., .4, .6), smoothstep(ec, ec + .35, el)) * cur * uAur * .5 * tr;
    }
    res.rgb += c * res.a; }
  o = res;
}`);
  const vq = gl.createVertexArray(), fb2 = gl.createFramebuffer(); let fbFor = null;
  const basis = (cam, W, H) => { const d = [Math.cos(cam.pitch) * Math.sin(cam.yaw), Math.sin(cam.pitch), Math.cos(cam.pitch) * Math.cos(cam.yaw)], r0 = [-d[2], 0, d[0]], l = hypot(r0[0], r0[2]) || 1, r = [r0[0] / l, 0, r0[2] / l], u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]], t = Math.tan(cam.fov / 2); return { d, r, u, tan: [t * W / H, t] }; };
  const setRay = (P, cam, G, S) => {
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, b = basis(cam, W, H); gl.uniform3fv(P.uR, b.r); gl.uniform3fv(P.uU, b.u); gl.uniform3fv(P.uF, b.d); gl.uniform2fv(P.uTan, b.tan);
    gl.uniform1f(P.uPR, G.R); gl.uniform1f(P.uSunSz, G.sunSize); gl.uniformMatrix3fv(P.uLP, false, S.F.flat()); gl.uniform3fv(P.uCamP, cam.P);
  };
  const loc = (S, v) => [0, 1, 2].map((i) => S.F[i][0] * v[0] + S.F[i][1] * v[1] + S.F[i][2] * v[2]);
  const S0 = { cover: null };
  return {
    S: S0,
    draw(common, cam, G, S) {
      gl.useProgram(sky.p); common(sky); setRay(sky, cam, G, S);
      const m = new Float32Array(12); G.moons.forEach((q, i) => { if (i < 3) { const d = [Math.cos(q[1]) * Math.cos(q[2]), Math.sin(q[1]) * Math.cos(q[2]), Math.sin(q[2])]; m.set([...loc(S, d), q[0]], i * 4); } });
      gl.uniform4fv(sky.uMoon, m); gl.uniform1i(sky.uNm, Math.min(3, G.moons.length));
      gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    clouds(common, cam, G, S, FB) {
      if (fbFor !== FB.t[0]) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb2); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, FB.t[0], 0); fbFor = FB.t[0]; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb2); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
      gl.useProgram(cl.p); common(cl); setRay(cl, cam, G, S);
      gl.uniform1f(cl.uCov, (S0.cover ?? G.cloud) + 0.45 * (S.rain || 0) * Math.min(1, Math.max(0, (20000 - S.cy) / 15000))); gl.uniform1f(cl.uB0, G.cloudBase); gl.uniform1f(cl.uB1, G.cloudTop);
      const tl = G.ringTilt, n = [Math.sin(tl), 0, Math.cos(tl)]; gl.uniform3fv(cl.uRingN, loc(S, n)); gl.uniform1f(cl.uRing0, G.rings ? 1.25 : 0); gl.uniform1f(cl.uRing1, G.rings);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, FB.t[1]); gl.uniform1i(cl.uDist, 1); gl.activeTexture(gl.TEXTURE0);
      gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, FB.f);
    },
  };
}
