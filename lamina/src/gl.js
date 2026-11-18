// The microscope. Every capsule is one instanced quad; the fragment shader shades it as a fluorescent tube
// (brightness follows the chord through it) and the frame is a maximum-intensity projection, so nothing
// needs sorting. Spikes arrive as a small float texture and travel along each neurite by path length.
const VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 a0; layout(location=1) in vec4 a1; layout(location=2) in vec4 a2;
uniform mat4 uV; uniform vec2 uK, uR; uniform float uT; uniform highp sampler2D uS; uniform vec4 uM;
out vec2 q; flat out vec4 sg, cl, ax, fz; flat out float pu;
float kin(float x, float tau) { return x > 0. ? exp(-x / tau) * min(1., x * 30.) : 0.; }
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0., .6667, .3333)) * 6. - 3.) - 1., 0., 1.); }
void main() {
  vec4 v0 = uV * vec4(a0.xyz, 1.), v1 = uV * vec4(a1.xyz, 1.);
  if (max(v0.z, v1.z) > -4.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float u0 = uK.y * uR.y * .5 / -v0.z, u1 = uK.y * uR.y * .5 / -v1.z;   // pixels per micron at each end
  vec2 s0 = uK * v0.xy / -v0.z * uR * .5, s1 = uK * v1.xy / -v1.z * uR * .5;
  float r0 = a0.w * u0, r1 = a1.w * u1, sc = max(1., .75 / max(r0, r1)); r0 *= sc; r1 *= sc;
  int kd = int(a2.w + .5);
  pu = .5 * (u0 + u1);
  float ext = kd == 1 && pu > 3. ? 3.4 * pu : 0.;                      // room for spines
  vec2 b = s1 - s0; float L = length(b); vec2 dr = L > .001 ? b / L : vec2(1., 0.);
  float R = max(r0, r1) + ext + 1.;
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1) * 2. - 1.);
  vec2 p = mix(s0 - dr * R, s1 + dr * R, c.x) + vec2(-dr.y, dr.x) * R * c.y;
  q = p - s0; sg = vec4(b, r0, r1);
  gl_Position = vec4(p / (uR * .5), 0., 1.);
  vec3 col; float base, f0 = 0., f1 = 0.;
  if (kd < 4) {
    int id = int(a2.z + .5); vec4 S = texelFetch(uS, ivec2(id, 0), 0), Q = texelFetch(uS, ivec2(id, 1), 0);
    float vel = kd == 2 ? 1100. : 500., tau = kd == 2 ? .12 : .4;
    f0 = kin(uT - S.x - a2.x / vel, tau) + kin(uT - S.y - a2.x / vel, tau);
    f1 = kin(uT - S.x - a2.y / vel, tau) + kin(uT - S.y - a2.y / vel, tau);
    col = uM.x < .5 ? hue(Q.x) : uM.x < 1.5 ? hue(Q.y) : vec3(.12, 1., .32);
    base = (uM.x > 1.5 ? .085 : .55) * (kd == 2 ? .5 : kd == 3 ? 1.25 : 1.);
  } else if (kd == 4) { col = vec3(.17, .27, .8); base = .34 + .12 * fract(a2.z * 7.); }
  else if (kd == 5) { col = vec3(1., .13, .10); base = .3; }
  else if (kd == 6) { col = vec3(1., .55, .12); base = .3 * (.8 + .2 * sin(uT * .5 + a2.z)); }
  else { col = vec3(.5, .52, .75); base = a2.z > .5 ? .22 : .42; }
  if (uM.x > 1.5 && kd > 3) base *= .45;
  cl = vec4(col, base * clamp(1. / sc, .28, 1.));
  ax = vec4(a2.x, a2.y, float(kd), a2.z); fz = vec4(f0, f1, -v0.z, -v1.z);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 q; flat in vec4 sg, cl, ax, fz; flat in float pu;
uniform float uT; uniform vec4 uM; out vec4 o;
float hs(float n) { return fract(sin(n * 91.7) * 43758.5453); }
void main() {
  vec2 b = sg.xy; float bb = dot(b, b), h = clamp(dot(q, b) / max(bb, 1e-4), 0., 1.);
  float r = mix(sg.z, sg.w, h); vec2 e = q - b * h; float dp = length(e), d = dp / r;
  float I = clamp(r - dp + .5, 0., 1.) * mix(.3, 1., sqrt(max(0., 1. - d * d))) * mix(1., .62, smoothstep(5., 40., r));
  int kd = int(ax.z + .5); float s = mix(ax.x, ax.y, h), hh = dot(q, b) / max(bb, 1e-4);
  if (kd == 1 && pu > 3. && dp > r && hh > 0. && hh < 1.) {            // dendritic spines: a neck and a head
    float lp = sqrt(bb) / max(ax.y - ax.x, .01), sc = s * .9, sd = sign(e.x * b.y - e.y * b.x);
    float k = hs(floor(sc) + sd * 13.7 + ax.w * .37);
    if (k > .42) {
      float len = (.5 + 1.2 * hs(k * 7.)) * pu, al = abs(fract(sc) - .5 - (hs(k * 3.) - .5) * .6) / .9 * lp, dd = dp - r;
      float hd = length(vec2(al, dd - len)) - .33 * pu, nk = max(al - .1 * pu - .3, dd - len);
      I = max(I, .8 * clamp(.6 - min(hd, nk), 0., 1.));
    }
  }
  if (kd == 2) I *= 1. + 1.1 * smoothstep(.36, .5, abs(fract(s / 7. + hs(ax.w)) - .5));   // boutons along axons
  if (kd == 5) { float k = hs(ax.w); I *= mix(1., mix(.45, 1., smoothstep(.04, .13, abs(fract(s / 24. - uT * (.25 + .5 * k) * sign(hs(k * 3.) - .5)) - .5))), smoothstep(1.5, 4., pu)); }   // red cells as moving shadows
  float f = mix(fz.x, fz.y, h), z = mix(fz.z, fz.w, h);
  float w = uM.y > .5 ? 1.7 * exp(-pow((z - uM.z) / uM.w, 2.)) : exp(-max(z - uM.z * .8, 0.) / (uM.z * .5 + 150.)) * smoothstep(uM.z * .12, uM.z * .45, z);   // an optical section, or haze with depth and a fade just in front of the lens
  o = vec4((cl.rgb * (cl.a + 1.5 * f) + f * f * .4) * I * w, 1.);
}`;

export function mkRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const U = {}; for (const n of ['uV', 'uK', 'uR', 'uT', 'uS', 'uM']) U[n] = gl.getUniformLocation(pr, n);
  const buf = gl.createBuffer(), tex = gl.createTexture();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(i, 1); }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.uS, 0); gl.enable(gl.BLEND); gl.blendEquation(gl.MAX); gl.disable(gl.DEPTH_TEST); gl.clearColor(0.012, 0.014, 0.032, 1);
  let count = 0, N = 0;
  return {
    load(inst, n, t, units) { count = n; N = units; gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 2, 0, gl.RGBA, gl.FLOAT, t); },
    draw(V, K, t, spikes, mode) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, 2, gl.RGBA, gl.FLOAT, spikes);
      gl.uniformMatrix4fv(U.uV, false, V); gl.uniform2f(U.uK, K[0], K[1]); gl.uniform2f(U.uR, canvas.width, canvas.height);
      gl.uniform1f(U.uT, t); gl.uniform4f(U.uM, mode[0], mode[1], mode[2], mode[3]);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    },
  };
}
