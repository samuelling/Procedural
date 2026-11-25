// The sky, and clouds that are volumes: a layer of air 1.5 to 4 km up, its density a three-dimensional noise that the
// wind carries, lit by marching toward the sun through it. Inside the layer you are in cloud; above it, the tops
// are white in the sun; from orbit the layer is a skin over the world. The same clouds at every scale.
export function mkSky(gl, prog, PRE) {
  const QV = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const RAY = `
uniform vec3 uR, uU, uF; uniform vec2 uTan; in vec2 v;
vec3 ray() { vec2 s = (v * 2. - 1.) * uTan; return normalize(uF + uR * s.x + uU * s.y); }
vec3 skyc(vec3 rd) {
  float y = rd.y, mu = max(dot(rd, uSun), 0.), sp = smoothstep(12000., 90000., uAlt), dip = -sqrt(max(2. * uAlt / 6.371e6, 0.));   // above the air the sky goes black; the horizon dips as you climb
  float yy = max((y - dip) / (1. - dip), 0.);
  vec3 zen = uSky * vec3(.42, .62, 1.05), hor = uSky * vec3(1.05, 1.08, 1.12) + uSunC * .05 * (1. + 2. * pow(mu, 4.));
  vec3 c = mix(hor, zen, pow(yy, .5));
  c = mix(c, vec3(.002, .004, .012), sp * smoothstep(-.02, .25, yy));
  c += uSunC * (pow(mu, 3000.) * 60. + pow(mu, 30.) * .3 * (1. - sp * .6));
  return y < dip ? hor * .6 : c;
}`;
  const sky = prog(QV, PRE + RAY + `
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { oC = vec4(skyc(ray()), 1.); oD = vec4(1e12, 0, 0, 1); }`);
  // clouds: march the layer along the ray, no farther than whatever the ray hits first
  const cl = prog(QV, PRE + RAY + `
uniform sampler2D uDist; uniform float uCov; out vec4 o;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) { vec3 i = floor(p), f = p - i; f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + 1.), f.x), f.y), f.z); }
const float B0 = 1500., B1 = 4000.;
float uFp, gC;
float dens(vec3 p, int oc) {                                              // p: metres, absolute
  vec3 q = p / 2600. + vec3(uT * .006, 0., uT * .002);
  float g0 = smoothstep(.7, .25, uFp / 2600.), g1 = smoothstep(.7, .25, uFp / 1240.);   // from far off a pixel holds many clouds:
  float base = mix(.275, n3(q * vec3(1., 2.2, 1.)) * .55, g0) + mix(.14, n3(q * 2.1 + 3.1) * .28, g1);   // take their mean,
  float hf = clamp((p.y - B0) / (B1 - B0), 0., 1.), prof = smoothstep(0., .12, hf) * smoothstep(1., .45, hf);   // flat bases, rounded tops
  float cv = clamp(uCov + .5 * (n3(p / 70000. + 5.3) - .5) + .25 * (n3(p / 23000. + 1.7) - .5), 0., 1.);   // weather: clear spells and overcast, hundreds of km across
  float d = base * prof - (1. - cv) * .55, sg = (.16 * (1. - g0) + .08 * (1. - g1)) * prof + 1e-4;
  gC = smoothstep(-sg, sg, d); d = max(d, 0.) + sg * .6 * gC;              // and say how much of the pixel they cover, and how thick they are there
  if (d <= 0. || oc < 2) return max(d, 0.) * 3.;
  float f1 = smoothstep(.8, .2, uFp / 410.), f2 = smoothstep(.8, .2, uFp / 170.);   // finer billows only where a pixel can hold them
  d -= (mix(.25, n3(q * 6.3 + 7.) * .5, f1) + mix(.125, n3(q * 15. + 1.) * .25, f2)) * .16 * (1. - hf * .3);   // the edges frayed and billowed
  return max(d, 0.) * 3.;
}
void main() {
  vec3 rd = ray(), ro = uCam; float lim = texture(uDist, v).r;
  float ta = (B0 - ro.y) / rd.y, tb = (B1 - ro.y) / rd.y, t0 = max(min(ta, tb), 0.), t1 = min(max(ta, tb), lim);
  if (abs(rd.y) < 1e-4) { if (ro.y < B0 || ro.y > B1) { o = vec4(0, 0, 0, 1); return; } t0 = 0.; t1 = min(lim, 60000.); }
  t1 = min(t1, t0 + 60000.);
  if (t1 <= t0) { o = vec4(0, 0, 0, 1); return; }
  float T = 1., dt = (t1 - t0) / 48., t = t0 + dt * h1(gl_FragCoord.xy + fract(uT) * 37.);
  vec3 acc = vec3(0.); float mu = dot(rd, uSun), ph = .55 * (1. - .7 * .7) / pow(1. + .49 - 1.4 * mu, 1.5) / 12.566 + .45 * .0796;   // forward scattering toward the sun, and some every way
  float tw = 0., cm = 0.;
  for (int i = 0; i < 48; i++) {
    vec3 p = ro + rd * t; uFp = t * uPix; float d = dens(p, 3); cm = max(cm, gC);
    if (d > .002) {
      float sh = 0.; for (int j = 1; j <= 4; j++) sh += dens(p + uSun * 120. * float(j * j), 1);   // how much cloud lies toward the sun
      vec3 L = uSunC * exp(-sh * 1.1) * ph * 9. + uSky * (.35 + .5 * clamp((p.y - B0) / (B1 - B0), 0., 1.));
      float a = 1. - exp(-d * dt * .004); acc += T * a * L; tw += T * a * t; T *= 1. - a;
      if (T < .02) break;
    }
    t += dt;
  }
  float a0 = max(1. - T, 1e-3), al = (1. - T) * cm; if (al < .002) { o = vec4(0, 0, 0, 1); return; }
  vec3 c = air(acc / a0, rd, tw / a0, ro.y, ro.y + rd.y * tw / a0) * al;
  o = vec4(c, 1. - al);
}`);
  const vq = gl.createVertexArray(), fb2 = gl.createFramebuffer(); let fbFor = null;
  const basis = (cam, W, H) => { const d = [Math.cos(cam.pitch) * Math.sin(cam.yaw), Math.sin(cam.pitch), Math.cos(cam.pitch) * Math.cos(cam.yaw)], r0 = [-d[2], 0, d[0]], l = Math.hypot(r0[0], r0[2]) || 1, r = [r0[0] / l, 0, r0[2] / l], u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]], t = Math.tan(cam.fov / 2); return { d, r, u, tan: [t * W / H, t] }; };
  const setRay = (P, cam) => { const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, b = basis(cam, W, H); gl.uniform3fv(P.uR, b.r); gl.uniform3fv(P.uU, b.u); gl.uniform3fv(P.uF, b.d); gl.uniform2fv(P.uTan, b.tan); };
  const S = { cover: 0.42 };
  return {
    S,
    draw(common, VP, L, cam) { gl.useProgram(sky.p); common(sky); setRay(sky, cam); gl.uniform3f(sky.uCam, cam.C[0], cam.C[1], cam.C[2]); gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3); },
    clouds(common, VP, L, cam, FB) {
      if (fbFor !== FB.t[0]) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb2); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, FB.t[0], 0); fbFor = FB.t[0]; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb2); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
      gl.useProgram(cl.p); common(cl); setRay(cl, cam); gl.uniform3f(cl.uCam, cam.C[0], cam.C[1], cam.C[2]); gl.uniform1f(cl.uCov, S.cover);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, FB.t[1]); gl.uniform1i(cl.uDist, 0);
      gl.bindVertexArray(vq); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
    },
  };
}
