// The microscope. Every capsule is one instanced quad that the fragment shader turns into a lit, textured tube
// with its own depth, so near things hide far things. Nuclei, the fibre felt and the frame are then added as
// light on top. A second stage reads the depth stored beside the colour and adds glow, depth of field and
// a soft shadow behind anything that stands in front of something else.
const VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 a0; layout(location=1) in vec4 a1; layout(location=2) in vec4 a2;
uniform mat4 uV; uniform vec2 uK, uR; uniform float uT; uniform highp sampler2D uS; uniform vec4 uM;
out vec2 q; flat out vec4 sg, cl, ax, fz; flat out vec3 pw;
float kin(float x, float tau) { return x > 0. ? exp(-x / tau) * min(1., x * 30.) : 0.; }
vec3 hue(float h) { return mix(clamp(abs(fract(h + vec3(0., .6667, .3333)) * 6. - 3.) - 1., 0., 1.), vec3(1.), .1); }
void main() {
  vec4 v0 = uV * vec4(a0.xyz, 1.), v1 = uV * vec4(a1.xyz, 1.);
  if (max(v0.z, v1.z) > -4.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float u0 = uK.y * uR.y * .5 / -v0.z, u1 = uK.y * uR.y * .5 / -v1.z;   // pixels per micron at each end
  vec2 s0 = uK * v0.xy / -v0.z * uR * .5, s1 = uK * v1.xy / -v1.z * uR * .5;
  float r0 = a0.w * u0, r1 = a1.w * u1, sc = max(1., .8 / max(r0, r1)); r0 *= sc; r1 *= sc;
  int kd = int(a2.w + .5);
  float pu = .5 * (u0 + u1), ext = kd == 1 && pu > 3. ? 2.6 * pu : 0.;   // room for spines
  vec2 b = s1 - s0; float L = length(b); vec2 dr = L > .001 ? b / L : vec2(1., 0.);
  float R = max(r0, r1) * (kd == 2 ? 1.85 : 1.15) + ext + 1.;
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1) * 2. - 1.);
  vec2 p = mix(s0 - dr * R, s1 + dr * R, c.x) + vec2(-dr.y, dr.x) * R * c.y;
  q = p - s0; sg = vec4(b, r0, r1);
  gl_Position = vec4(p / (uR * .5), 0., 1.);
  vec3 col; float base = 1., f0 = 0., f1 = 0.; bool ca = uM.x > 1.5;
  if (kd < 4) {
    int id = int(a2.z + .5); vec4 S = texelFetch(uS, ivec2(id, 0), 0), Q = texelFetch(uS, ivec2(id, 1), 0);
    float vel = kd == 2 ? 1100. : 500., tau = kd == 2 ? .12 : .4;
    f0 = kin(uT - S.x - a2.x / vel, tau) + kin(uT - S.y - a2.x / vel, tau);
    f1 = kin(uT - S.x - a2.y / vel, tau) + kin(uT - S.y - a2.y / vel, tau);
    col = uM.x < .5 ? hue(Q.x) : uM.x < 1.5 ? hue(Q.y) : vec3(.1, 1., .3);
    base = (ca ? .2 : 1.) * (kd == 2 ? .75 : 1.);
  } else if (kd == 4) { col = mix(vec3(.2, .34, 1.), vec3(.5, .3, 1.), fract(a2.z * 7.)); base = ca ? .5 : 1.; }
  else if (kd == 5) { col = vec3(1., .14, .1); base = ca ? .5 : 1.; }
  else if (kd == 6) { col = vec3(1., .5, .1); base = (ca ? .4 : 1.) * (.85 + .15 * sin(uT * .5 + a2.z)); }
  else if (kd == 7) { col = vec3(.55, .6, .9); base = a2.z > .5 ? .5 : 1.; }
  else { col = mix(vec3(.25, .45, .95), vec3(.65, .4, .9), fract(a2.z * 3.)); base = ca ? .5 : 1.; }
  cl = vec4(col, 1.); pw = vec3(pu, base, 1. / sc);
  ax = vec4(a2.x, a2.y, float(kd), a2.z); fz = vec4(f0, f1, -v0.z, -v1.z);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 q; flat in vec4 sg, cl, ax, fz; flat in vec3 pw;
uniform float uT; uniform vec4 uM; uniform vec3 uF; out vec4 o;
const vec3 FOG = vec3(.020, .024, .055);
float hs(float n) { return fract(sin(n * 91.7) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  vec2 b = sg.xy; float bb = dot(b, b), hh = dot(q, b) / max(bb, 1e-4), h = clamp(hh, 0., 1.);
  int kd = int(ax.z + .5); float s = mix(ax.x, ax.y, h), pu = pw.x, r = mix(sg.z, sg.w, h);
  if (kd == 2) r *= 1. + .8 * smoothstep(.34, .5, abs(fract(s / 7. + hs(ax.w)) - .5));   // boutons swell the axon
  else if (kd < 2) r *= .9 + .22 * vn(vec2(s * .3, ax.w * 7.3));                       // dendrites are never quite even
  vec2 e = q - b * h; float dp = length(e), d = dp / r, zc = mix(fz.z, fz.w, h), wr = r / pu * min(1., pw.z);
  vec3 col = cl.rgb, n = vec3(0., 0., 1.), c; float f = mix(fz.x, fz.y, h), zs = zc, tk = 0., al = 1.; bool sp_ = false;
  if (d < 1.) { float nz = sqrt(1. - d * d); n = vec3(e / max(dp, 1e-4) * d, nz); tk = wr * nz; zs = zc - tk; al = clamp((1. - d) * r, 0., 1.); }
  else if (kd == 1 && pu > 3. && hh > 0. && hh < 1.) {                                  // dendritic spines: a neck and a head
    float lp = sqrt(bb) / max(ax.y - ax.x, .01), sc = s * .9, sd = sign(e.x * b.y - e.y * b.x), k = hs(floor(sc) + sd * 13.7 + ax.w * .37);
    if (k < .42) discard;
    float len = (.5 + 1.2 * hs(k * 7.)) * pu, along = (fract(sc) - .5 - (hs(k * 3.) - .5) * .6) / .9 * lp, dd = dp - r, hr = .34 * pu;
    vec2 hv = vec2(along, dd - len) / hr;
    if (dot(hv, hv) < 1.) n = vec3(b / sqrt(bb) * hv.x + e / dp * hv.y, sqrt(1. - dot(hv, hv)));
    else if (abs(along) > .1 * pu + .3 || dd > len) discard;
    sp_ = true;
  } else discard;

  if (uM.y > .5) {                                                                      // optical section: only what the focal plane cuts
    float w = 1. - smoothstep(tk + uM.w * .4, tk + uM.w, abs(zc - uM.z));
    if (w < .02) discard;
    c = (col * (.4 * pw.y + 1.6 * f) + f * f * .5) * w * (kd == 4 ? .55 : kd > 6 ? .3 : 1.) * (.6 + .4 * n.z);
    o = vec4(c, 1.); gl_FragDepth = .5 - w * .4; return;
  }

  bool lit = kd == 4 || kd > 6;                                                        // drawn as added light, not as a solid
  if (!lit && zs < uF.z * .13) discard;                                                // nothing solid right at the lens
  float keep = smoothstep(uF.z * .2, uF.z * .7, zs);
  float sgn = sign(e.x * b.y - e.y * b.x), a = asin(clamp(d, 0., 1.)) * sgn;
  vec2 uv = kd == 3 || kd == 4 ? n.xy * wr * 1.3 + ax.w * 17. : vec2(s, a * wr * 1.6 + ax.w * 3.);   // microns across the surface
  float tex = kd < 3 ? .6 * vn(vec2(uv.x * .28, uv.y * 5.)) + .4 * vn(uv * 2.1 + 7.)   // streaks along the neurite, and mottling
    : kd == 3 ? .55 * vn(uv * .7) + .45 * vn(uv * 2.4 + 3.)                             // Nissl-like granules on the soma
    : kd == 5 ? .7 * vn(vec2(uv.x * .11, uv.y * .5)) + .3 * vn(uv * .9)                 // long endothelial cells
    : vn(uv * 1.2);
  if (!sp_ && kd < 7 && r > 1.5) n = normalize(vec3(n.xy - vec2(dFdx(tex), dFdy(tex)) * min(r, 30.) * .5, n.z));
  vec3 L = normalize(vec3(-.55, .62, .56));
  float df = max(dot(n, L), 0.), wp = df * .7 + .3, rim = pow(1. - max(n.z, 0.), 2.3), sp = pow(max(dot(n, normalize(L + vec3(0., 0., 1.))), 0.), 48.);
  float fl = max(dot(n, normalize(vec3(.6, -.5, .4))), 0.);
  vec3 alb = col * (.5 + .8 * tex) * pw.y;
  if (kd < 4 || kd == 6) {                                                              // a neurite or soma: a lit gel with bright edges
    c = alb * (.07 + df) + col * pw.y * (rim * .3 + .24 * smoothstep(3.5, 1., r)) + alb * fl * vec3(.14, .2, .3) + sp * .6 * (.4 + .6 * pw.y);   // thin, far neurites keep a glow of their own
    if (kd == 3) { vec2 pn = q - b * .3; float dn = length(pn) / (sg.z * .62); c += ((col * .5 + .2) * exp(-dn * dn * 2.2) * n.z * .8 + exp(-dn * dn * 55.) * .3) * pw.y; }   // the nucleus showing through
    c += (col * 1.5 + .4) * f * (.65 + rim);
  } else if (kd == 4) c = col * pw.y * (.07 + rim * .95 + .22 * df * tex) * .2 * al * keep;                 // a nucleus: a faint bubble, brightest at its edge
  else if (kd == 5) {                                                                   // a wet vessel with red cells moving under the wall
    float k = hs(ax.w), rb = smoothstep(.5, .78, vn(vec2((s - uT * (8. + 14. * k) * sign(hs(k * 3.) - .5)) * .2, a * 1.6 + k * 9.)));
    alb = (vec3(.34, .03, .04) * (.55 + .7 * tex) + vec3(.42, .1, .06) * rb) * pw.y;
    c = alb * (.1 + .6 * wp) + vec3(1., .22, .18) * rim * .12 * pw.y + sp * .5;
  } else if (kd == 7) c = col * .45 * pw.y * al * keep;
  else c = col * (.25 + .5 * wp) * .32 * pw.y * al * keep;
  float fd = clamp(pw.z, .5, 1.), fg = exp(-max(zs - uF.x, 0.) / uF.y);
  if (lit) o = vec4(c * fg * fd, 1.);              // added as light
  else o = vec4(mix(FOG, c, fg * fd), zs / 4000.);
  gl_FragDepth = clamp(zs / 8000., 0., 1.);
}`;

const QV = `#version 300 es
out vec2 v; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const DOWN = `#version 300 es
precision highp float; in vec2 v; uniform sampler2D uA; uniform vec2 uP; out vec4 o;
void main() { o = .25 * (texture(uA, v + uP * vec2(-1., -1.)) + texture(uA, v + uP * vec2(1., -1.)) + texture(uA, v + uP * vec2(-1., 1.)) + texture(uA, v + uP)); }`;
const POST = `#version 300 es
precision highp float; in vec2 v; uniform sampler2D uA, uB, uC, uD; uniform vec2 uP; uniform vec4 uO; out vec4 o;   // uO: focus, aperture, section, time
vec4 t4(sampler2D s, float m) { vec2 d = uP * m; return .25 * (texture(s, v + d * vec2(-1., -1.)) + texture(s, v + d * vec2(1., -1.)) + texture(s, v + d * vec2(-1., 1.)) + texture(s, v + d)); }
void main() {
  vec4 S = texture(uA, v); S.rgb = .5 * S.rgb + .5 * t4(uA, .75).rgb;
  vec4 B1 = t4(uB, 1.), B2 = t4(uC, 2.), B3 = t4(uD, 4.);
  float z = min(S.a, mix(S.a, B2.a, .7)) * 4000., k = uO.z > .5 ? 0. : clamp(uO.y * abs(1. / uO.x - 1. / z), 0., 3.);   // out of focus, in blur levels
  vec3 c = k < 1. ? mix(S.rgb, B1.rgb, k) : k < 2. ? mix(B1.rgb, B2.rgb, k - 1.) : mix(B2.rgb, B3.rgb, k - 2.);
  if (uO.z < .5) c *= 1. - .42 * clamp((S.a - B2.a) / max(S.a, 1e-3) * 5., 0., 1.);    // darker where something nearer stands beside
  vec3 bl = B1.rgb * .3 + B2.rgb * .35 + B3.rgb * .35;
  c += bl * .22 + max(bl - .8, 0.) * .6;
  c = 1. - exp(-c * 1.35); c = mix(c, c * c * (3. - 2. * c), .3);
  vec2 w = v - .5; c *= 1. - .4 * dot(w, w);
  c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy + uO.w * 60., vec2(.06711056, .00583715)))) - .5) / 110.;
  o = vec4(c, 1.);
}`;

export function mkRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const hdr = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  const prog = (vs, fs, names) => {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); gl.attachShader(p, s); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = { p }; for (const n of names) U[n] = gl.getUniformLocation(p, n); return U;
  };
  const P = prog(VS, FS, ['uV', 'uK', 'uR', 'uT', 'uS', 'uM', 'uF']), PD = prog(QV, DOWN, ['uA', 'uP']), PP = prog(QV, POST, ['uA', 'uB', 'uC', 'uD', 'uP', 'uO']);
  const buf = gl.createBuffer(), tex = gl.createTexture(), vO = gl.createVertexArray(), vT = gl.createVertexArray(), vQ = gl.createVertexArray();
  const lin = (t, f) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); };
  lin(tex, gl.NEAREST);
  // colour targets: the scene at full size (with depth in alpha), then three halvings of it
  const T = [0, 1, 2, 3].map(() => ({ t: gl.createTexture(), f: gl.createFramebuffer(), w: 0, h: 0 })), rb = gl.createRenderbuffer();
  const size = (w, h) => {
    T.forEach((x, i) => {
      x.w = Math.max(1, w >> i); x.h = Math.max(1, h >> i); lin(x.t, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, x.w, x.h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, x.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, x.t, 0);
    });
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T[0].f); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  };
  let nO = 0, nT = 0, N = 0;
  return {
    hdr: !!hdr,
    load(inst, opaque, count, t, units) {
      nO = opaque; nT = count - opaque; N = units;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
      for (const [v, off] of [[vO, 0], [vT, nO * 48]]) { gl.bindVertexArray(v); for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, off + i * 16); gl.vertexAttribDivisor(i, 1); } }
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 2, 0, gl.RGBA, gl.FLOAT, t);
    },
    draw(V, K, t, spikes, mode, rad) {
      const w = canvas.width, h = canvas.height; if (T[0].w !== w || T[0].h !== h) size(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[0].f); gl.viewport(0, 0, w, h);
      gl.clearColor(0.020, 0.024, 0.055, 1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, 2, gl.RGBA, gl.FLOAT, spikes);
      gl.uniform1i(P.uS, 0); gl.uniformMatrix4fv(P.uV, false, V); gl.uniform2f(P.uK, K[0], K[1]); gl.uniform2f(P.uR, w, h);
      gl.uniform1f(P.uT, t); gl.uniform4f(P.uM, mode[0], mode[1], mode[2], mode[3]); gl.uniform3f(P.uF, rad * 0.8, rad * 0.45 + 200, rad);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
      gl.bindVertexArray(vO); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nO);
      gl.enable(gl.BLEND); gl.blendEquationSeparate(gl.FUNC_ADD, gl.MIN); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.bindVertexArray(vT); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nT);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(vQ);
      gl.useProgram(PD.p); gl.uniform1i(PD.uA, 0);
      for (let i = 1; i < 4; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, T[i].f); gl.viewport(0, 0, T[i].w, T[i].h); gl.bindTexture(gl.TEXTURE_2D, T[i - 1].t);
        gl.uniform2f(PD.uP, 1 / T[i - 1].w, 1 / T[i - 1].h); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.useProgram(PP.p);
      ['uA', 'uB', 'uC', 'uD'].forEach((n, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, T[i].t); gl.uniform1i(PP[n], i); });
      gl.uniform2f(PP.uP, 1 / w, 1 / h); gl.uniform4f(PP.uO, rad, 520, mode[1], t);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0);
    },
  };
}
