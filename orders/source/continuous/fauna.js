// Flocks: birds (or whatever flies there) wheeling over the land, each flock tied to a point on the planet (a 3 km
// lattice on the cube face) so it is always there when you come back. Their build follows the planet's pull: under
// weak gravity long wings beat slowly; under strong, short wings beat fast. Drawn as small flapping shapes, lit and
// hazed like everything else.
import { AX, H, hs2, climate, rng } from './planet.js';
import { drawn } from './eco.js';

export function mkFauna(gl, prog, PRE) {
  const { floor, max, min, abs, hypot, sin, cos, sqrt, cbrt } = Math, SP = 1000, NB = 260;
  const bird = prog(PRE + `
layout(location = 0) in vec3 aP; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform float uSpan, uBeat, uCy;
out vec3 vP; out float vW, vSh;
void main() {
  float ph = uT * uBeat + iS.z * 6.28, fl = sin(ph), side = sign(aP.x), w = abs(aP.x);   // a wing beat
  vec3 p = vec3(aP.x * uSpan, w * fl * uSpan * .6 + aP.y * uSpan, aP.z * uSpan) * max(1., 2.6 * length(iP.xyz) * uPix / uSpan);   // never smaller than a couple of pixels: a far flock still shows as specks
  float c = cos(iS.y), s = sin(iS.y); vec3 r = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vP = iP.xyz + r; vSh = iS.w; vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w);
}`, PRE + `
in vec3 vP; in float vW, vSh; uniform vec3 uCol, uEm; uniform float uCy;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { CAST vec3 col = uCol * (uSunC * .5 * max(uSun.y, 0.) + uSky * .5) + uEm * vSh; col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y); oC = vec4(col, 1.); oD = vec4(length(vP), 0, 0, 1); gl_FragDepth = fdep(vW); }`);
  // a bird: body and two wings (x across, y up, z ahead), as triangles
  const g = new Float32Array([0, 0, 0.5, -0.06, 0, -0.4, 0.06, 0, -0.4, 0, 0, 0.15, -1, 0.05, -0.05, 0, 0, -0.2, 0, 0, 0.15, 1, 0.05, -0.05, 0, 0, -0.2, -1, 0.05, -0.05, -0.55, 0, 0.12, 0, 0, 0.15, 1, 0.05, -0.05, 0, 0, 0.15, 0.55, 0, 0.12]);
  const vao = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, g, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ib); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } gl.bindVertexArray(null);
  // a small animal on the ground (ant, salamander, lizard, mouse): body, tail and four legs, flat, one unit long
  const gc = new Float32Array([0, 0, 0.5, -0.13, 0, 0, 0.13, 0, 0, -0.13, 0, 0, 0.13, 0, 0, 0, 0, -0.45, -0.05, 0, -0.35, 0.05, 0, -0.35, 0, 0, -0.95,
    0.08, 0, 0.22, 0.32, 0, 0.38, 0.1, 0, 0.12, -0.08, 0, 0.22, -0.32, 0, 0.38, -0.1, 0, 0.12, 0.08, 0, -0.15, 0.3, 0, -0.32, 0.1, 0, -0.25, -0.08, 0, -0.15, -0.3, 0, -0.32, -0.1, 0, -0.25]);
  const cvao = gl.createVertexArray(); gl.bindVertexArray(cvao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, gc, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ib); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } gl.bindVertexArray(null);
  const memo = new Map(), imemo = new Map(), gmemo = new Map();
  // ---- grazers: a body plan per planet (legs four or six, long-legged under weak pull, squat under strong), herds on a
  // 1 km lattice in open grassy country, each animal ambling and grazing round its herd's ground ------------------------
  const beast = prog(PRE + `
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in vec4 aL; layout(location = 4) in vec4 iP; layout(location = 5) in vec4 iS;
uniform float uCy, uHop, uBow; out vec3 vP, vN, vO; out float vW, vSd, vId, vMat;
void main() {
  vec3 p = aP, n = aN; vId = float(gl_InstanceID); vMat = aL.x > 0. ? 0. : aL.w;   // what a part is made of: coat, dark hair or horn, ivory, antler, pale
  if (aL.x > 0.) { float a = sin(iS.z + aL.w * (1. - uHop)) * .55 * iS.y; float c = cos(a), s = sin(a); vec2 r = vec2(p.y - aL.y, p.z - aL.z); p.yz = vec2(c * r.x - s * r.y, s * r.x + c * r.y) + aL.yz; n.yz = vec2(c * n.y - s * n.z, s * n.y + c * n.z); }   // a leg swings from its hip
  if (aL.x < 0.) { float a = (1. - iS.y) * uBow * (.5 + .5 * sin(iS.z * .2)); float c = cos(a), s = sin(a); vec2 r = vec2(p.y - aL.y, p.z - aL.z); p.yz = vec2(c * r.x + s * r.y, -s * r.x + c * r.y) + aL.yz; }   // the head goes down to graze
  p.y += uHop * .3 * max(0., sin(iS.z)) * max(iS.y, 0.);                   // a hopper's bound
  if (iS.y < 0.) p.y *= .5;                                                // lying down to rest
  if (iP.w < 0.) { p.xy = vec2(p.y - .3, .3 - p.x); n.xy = vec2(n.y, -n.x); }   // dead, on its side
  p *= abs(iP.w); float ch = cos(iS.x), sh = sin(iS.x); vO = aP; vSd = iS.w;
  vP = iP.xyz + vec3(ch * p.x + sh * p.z, p.y, -sh * p.x + ch * p.z); vN = vec3(ch * n.x + sh * n.z, n.y, -sh * n.x + ch * n.z);
  vec4 q = uVP * vec4(vP, 1.); vW = q.w; gl_Position = vec4(q.xy, 0., q.w);
}`, PRE + `
in vec3 vP, vN, vO; in float vW, vSd, vId, vMat; uniform vec3 uCol, uCol2; uniform float uCy, uSpots, uCode;
layout(location = 0) out vec4 oC; layout(location = 1) out vec4 oD;
void main() { CAST
  vec3 n = normalize(vN); float belly = smoothstep(.1, -.4, vN.y);
  vec3 alb = mix(uCol, uCol2, belly) * (.9 + .2 * fract(fract(vSd) * 7.7)) * mix(vec3(1.25, 1., .78), vec3(.8, .95, 1.22), floor(vSd) / 20.);   // the coat gene: from russet to grey
  float sp = n2(vO.xz * 9. + vO.y * 5. + vSd * 30.);
  if (uSpots > 2.5) { float r = n2(vO.xz * 13. + vO.y * 6.); alb = mix(alb, uCol * .2, smoothstep(.6, .64, r) - .8 * smoothstep(.68, .72, r)); }   // rosettes
  else if (uSpots > 1.5) alb = mix(alb, vec3(.02), smoothstep(.5, .85, sin(vO.z * 26. + n2(vO.xy * 4.) * 5.)) * step(.2, vO.y));   // stripes
  else alb = mix(alb, uSpots > .5 ? vec3(.82, .78, .68) : alb, smoothstep(.74, .78, sp) * step(.1, vN.y + .4));   // spots
  if (vMat > .5) alb = vMat < 1.5 ? uCol * .4 : vMat < 2.5 ? vec3(.72, .66, .52) : vMat < 3.5 ? vec3(.46, .38, .27) : vec3(.8, .76, .68);
  float fp = vW * uPix; alb *= mix(1., .85 + .3 * n2(vO.xy * 900. + vO.z * 500.), smoothstep(.003, .0008, fp));   // hair
  float dif = max(dot(n, uSun), 0.) * shadow(vP + n * .05);
  vec3 col = alb * (uSunC * dif + uSky * (.45 + .3 * n.y)); col = air(col, normalize(vP), length(vP), uAlt, uCy + vP.y);
  oC = vec4(col, 1.); oD = vec4(length(vP), uCode + vId, 0, 1); gl_FragDepth = fdep(vW); }`);
  const bodies = new Map();
  const blob = (V, c, rx, ry, rz, tag, ax = 0, az = 0) => {             // an ellipsoid of 12 x 8 quads, turned about z then x
    const ca = Math.cos(ax), sa = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az), R = (v) => { const x = v[0] * cz - v[1] * sz, y = v[0] * sz + v[1] * cz; return [x, y * ca - v[2] * sa, y * sa + v[2] * ca]; };
    for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) {
      const th = (i + a) / 12 * 6.2832, ph = (j + b) / 8 * 3.1416, n = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], q = R([n[0] * rx, n[1] * ry, n[2] * rz]), m = R([n[0] / rx, n[1] / ry, n[2] / rz]);
      V.push(c[0] + q[0], c[1] + q[1], c[2] + q[2], ...m, ...tag);
    }
  };
  // a real kind's build, by its form: the parts of a deer, a cat, a kangaroo or a sauropod, each an ellipsoid; the head
  // and whatever it carries (antlers, horns, a trunk) bow together to graze; legs swing from the hip
  function build(k, hunter, male) {
    const V = [], f = k.form || 'deer', L = (hunter ? 0.5 : 0.8) * k.L, len = (hunter ? 1.05 : 1.4) * k.len, ht = L, neck = k.neck, B = (c, r, tag = [0, 0, 0, 0], ax = 0, az = 0) => blob(V, c, r[0], r[1], r[2], tag, ax, az);
    const by = ht + 0.25, hp = [ht + 0.3, len * 0.45], HD = (m = 0) => [-1, hp[0], hp[1], m], S = [-1, 1];
    let hy = ht + 0.3 + neck, hz = len * 0.5 + neck * 0.35 + 0.15, legs = [], lw = 0.045, hop = 0;
    const quad = (w = 0.16) => { for (let q = 0; q < 4; q++) legs.push([(q % 2 ? 1 : -1) * w, (Math.floor(q / 2) - 0.5) * len * 0.75, (q % 2) * 3.1416 + Math.floor(q / 2) * 3.1416]); };
    const ears = (r = [0.02, 0.06, 0.035], up = 0.1, sp = 0.07, tilt = 0.6) => { for (const s of S) B([s * sp, hy + up, hz - 0.08], r, HD(), 0, -s * tilt); };
    if (f === 'heron') {                                                   // a wader: long legs, a small body, an S of a neck, a dagger of a bill
      B([0, by + 0.1, 0], [0.13, 0.14, 0.3], [0, 0, 0, 0], -0.25); B([0, by + 0.32, 0.22], [0.05, 0.22, 0.05], HD(), 0.35); hy = by + 0.55; hz = 0.33;
      B([0, hy, hz], [0.05, 0.055, 0.09], HD()); B([0, hy - 0.01, hz + 0.16], [0.012, 0.014, 0.12], HD(3)); B([0, by + 0.06, -0.33], [0.06, 0.03, 0.12], [0, 0, 0, 1], 0.3);
      for (const s of S) legs.push([s * 0.05, 0, s > 0 ? 3.1416 : 0]); lw = 0.012;
    } else if (f === 'roo' || f === 'theropod') {                          // two legs
      const th = f === 'theropod';
      B([0, by + (th ? 0.05 : 0.1), 0], th ? [0.32, 0.38, len * 0.45] : [0.25, 0.42, 0.22], [0, 0, 0, 0], th ? 0 : 0.5);
      B([0, by - (th ? 0 : 0.35), -len * 0.5 - (th ? 0.7 : 0.35)], th ? [0.14, 0.16, 1] : [0.06, 0.06, 0.55], [0, 0, 0, 0], th ? -0.08 : -0.5);   // tail
      hy = th ? by + 0.45 : by + 0.55; hz = th ? len * 0.45 + 0.35 : 0.28;
      if (th) { B([0, by + 0.3, len * 0.45], [0.13, 0.22, 0.15], HD(), 0.5); B([0, hy, hz], [0.15, 0.2, 0.4], HD()); for (const s of S) B([s * 0.18, by, len * 0.35], [0.04, 0.04, 0.15], [0, 0, 0, 0], 0.8); }
      else { B([0, hy, hz], [0.08, 0.09, 0.16], HD()); ears([0.02, 0.09, 0.03], 0.12, 0.04, 0.15); for (const s of S) B([s * 0.1, by, 0.2], [0.03, 0.12, 0.03], [0, 0, 0, 0], 0.6); }
      for (const s of S) legs.push([s * (th ? 0.2 : 0.12), 0, s > 0 ? 3.1416 : 0]); lw = th ? 0.1 : 0.07; hop = th ? 0 : 1;
    } else if (f === 'millipede') {
      for (let q = 0; q < 10; q++) B([0, 0.18, (q / 9 - 0.5) * len], [0.38, 0.12, 0.16], [0, 0, 0, q % 2]);
      for (let q = 0; q < 16; q++) legs.push([(q % 2 ? 1 : -1) * 0.4, (Math.floor(q / 2) / 7 - 0.5) * len * 0.9, q * 0.7]);
      lw = 0.025;
    } else {
      const big = f === 'bison' || f === 'mammoth' || f === 'musk' || f === 'sauropod', slim = hunter || f === 'camel' || f === 'hare';
      const br = f === 'mammoth' ? [0.45, 0.48] : f === 'sauropod' ? [0.55, 0.5] : big ? [0.38, 0.4] : hunter ? [0.2, 0.22] : slim ? [0.24, 0.27] : [0.28, 0.3];
      B([0, by, 0], [br[0], br[1], len * 0.5], [0, 0, 0, 0], f === 'gnu' ? -0.12 : 0);
      if (f === 'sauropod') { B([0, by + 0.25 + neck * 0.4, len * 0.5 + neck * 0.3], [0.15, neck * 0.55, 0.15], HD(), 0.6); hy = by + 0.25 + neck * 0.85; hz = len * 0.5 + neck * 0.62; B([0, hy, hz], [0.1, 0.1, 0.2], HD());
        B([0, by, -len * 0.5 - 0.8], [0.18, 0.18, 1], [0, 0, 0, 0], -0.1); B([0, by - 0.25, -len * 0.5 - 2], [0.08, 0.08, 0.8]); quad(0.3); lw = 0.16; }
      else if (f === 'mammoth') { hy = ht + 0.75; hz = len * 0.5 + 0.15; B([0, hy, hz], [0.3, 0.32, 0.3], HD()); B([0, by + 0.35, len * 0.25], [0.35, 0.3, 0.35], [0, 0, 0, 1]);
        B([0, hy - 0.3, hz + 0.28], [0.08, 0.22, 0.08], HD(), 0.2); B([0, hy - 0.65, hz + 0.32], [0.06, 0.2, 0.06], HD()); B([0, hy - 0.95, hz + 0.3], [0.05, 0.15, 0.05], HD());
        for (const s of S) { B([s * 0.15, hy - 0.45, hz + 0.35], [0.04, 0.04, 0.35], HD(2), -0.6, s * 0.3); B([s * 0.28, hy - 0.3, hz + 0.68], [0.03, 0.18, 0.03], HD(2), 0.4); B([s * 0.26, hy, hz - 0.05], [0.03, 0.15, 0.12], HD()); }
        B([0, ht * 0.6 + 0.15, 0], [0.47, ht * 0.55, len * 0.52], [0, 0, 0, 1]); quad(0.24); lw = 0.12; }
      else {
        // the neck leans forward from the withers (a camel's nearly upright, a bison's or a wolf's nearly level); the head
        // sits at its end, nose a little down, and the two bow together about the withers to graze
        const tilt = f === 'camel' ? 0.35 : f === 'bison' || f === 'musk' ? 1.35 : hunter || f === 'hare' ? 1.15 : f === 'horse' || f === 'gnu' ? 0.65 : 0.75;
        const base = [0, by + 0.12, len * 0.42], nl = neck + (big ? 0.15 : 0.25), dv = [0, Math.cos(tilt), Math.sin(tilt)], nw = f === 'camel' ? 0.07 : big ? 0.2 : hunter ? 0.09 : f === 'horse' || f === 'gnu' ? 0.11 : 0.085;
        const nb = [0, base[1] + dv[1] * nl / 2, base[2] + dv[2] * nl / 2]; hy = base[1] + dv[1] * nl + 0.02; hz = base[2] + dv[2] * nl + 0.1; hp[0] = base[1]; hp[1] = base[2];
        B(nb, [nw, nl / 2 + nw * 0.5, nw * 1.15], HD(), tilt);
        const hr = f === 'bison' ? [0.18, 0.2, 0.24] : f === 'musk' ? [0.16, 0.17, 0.22] : f === 'cat' ? [0.12, 0.11, 0.13] : f === 'canid' ? [0.09, 0.09, 0.15] : f === 'horse' || f === 'gnu' ? [0.11, 0.13, 0.3] : f === 'camel' ? [0.07, 0.08, 0.16] : f === 'hare' ? [0.1, 0.11, 0.16] : [0.09, 0.1, 0.22];
        B([0, hy, hz], hr, HD(f === 'bison' ? 1 : 0), hunter ? 0 : 0.35);
        if (f === 'canid') B([0, hy - 0.03, hz + 0.16], [0.05, 0.05, 0.1], HD());
        if (f === 'cat') B([0, hy - 0.04, hz + 0.1], [0.06, 0.05, 0.06], HD());
        if (f === 'saiga') B([0, hy - 0.02, hz + 0.16], [0.07, 0.07, 0.08], HD());
        // ears
        if (f === 'hare') { for (const s of S) B([s * 0.05, hy + 0.22, hz - 0.06], [0.03, 0.2, 0.05], HD(), -0.3, -s * 0.15); }
        else if (f === 'canid') ears([0.025, 0.08, 0.03], 0.11, 0.06, 0.2);
        else if (f === 'cat') ears([0.035, 0.04, 0.02], 0.1, 0.07, 0.4);
        else if (f !== 'bison' && f !== 'musk') ears();
        // antlers, horns, manes, beards, humps, coats
        const ant = k.ant || 1;
        if (f === 'deer' && (male || k.both)) for (const s of S) {
          const bx = s * 0.06, b0 = [bx + s * 0.2 * ant, hy + 0.08 + 0.36 * ant, hz - 0.2];
          B(b0, [0.022, 0.42 * ant, 0.022], HD(3), -0.35, -s * 0.55);
          for (let q = 1; q <= (ant > 0.6 ? 3 : 0); q++) B([bx + s * 0.1 * q * ant, hy + 0.1 + 0.2 * q * ant, hz - 0.1], [0.014, 0.13 * ant, 0.014], HD(3), 0.9, -s * 0.15);
        }
        if (f === 'gnu') { for (const s of S) { B([s * 0.12, hy + 0.08, hz - 0.12], [0.12, 0.025, 0.025], HD(1), 0, s * 0.3); B([s * 0.22, hy + 0.17, hz - 0.12], [0.02, 0.08, 0.02], HD(1)); } B([0, nb[1] - 0.12, nb[2] + 0.05], [0.04, 0.14, 0.04], HD(1)); B([0, nb[1] + 0.05, nb[2] - 0.06], [0.03, neck * 0.5, 0.07], HD(1)); }
        if (f === 'saiga' && male) for (const s of S) B([s * 0.04, hy + 0.18, hz - 0.08], [0.015, 0.15, 0.015], HD(3), -0.2);
        if (f === 'bison') { B([0, by + 0.38, len * 0.22], [0.3, 0.35, 0.35], [0, 0, 0, 1]); B([0, by, len * 0.28], [0.4, 0.42, 0.32], [0, 0, 0, 1]); B([0, hy - 0.2, hz], [0.08, 0.14, 0.08], HD(1)); for (const s of S) B([s * 0.2, hy + 0.12, hz - 0.08], [0.07, 0.02, 0.02], HD(1), 0, -s * 0.6); }
        if (f === 'musk') { B([0, ht * 0.6 + 0.12, 0], [0.4, ht * 0.6, len * 0.55], [0, 0, 0, 1]); B([0, hy + 0.12, hz - 0.06], [0.2, 0.05, 0.07], HD(3)); for (const s of S) B([s * 0.2, hy - 0.02, hz], [0.03, 0.1, 0.03], HD(3)); }
        if (f === 'horse') B([0, nb[1] + 0.05, nb[2] - 0.07], [0.03, neck * 0.55, 0.08], HD(1));
        if (f === 'cat' && k.mane && male) B([0, hy - 0.02, hz - 0.12], [0.2, 0.2, 0.2], HD(1));
        // tails
        if (f === 'canid') B([0, by - 0.05, -len * 0.5 - 0.2], [0.07, 0.07, 0.25], [0, 0, 0, 0], 0.6);
        else if (f === 'cat') B([0, by - 0.08, -len * 0.5 - 0.35], [0.035, 0.035, 0.4], [0, 0, 0, 0], 0.35);
        else if (f === 'horse' || f === 'gnu') B([0, by - 0.1, -len * 0.5 - 0.08], [0.05, 0.3, 0.06], [0, 0, 0, 1], -0.3);
        else if (f === 'hare') B([0, by + 0.05, -len * 0.5 - 0.04], [0.08, 0.08, 0.06], [0, 0, 0, 4]);
        else B([0, by + 0.08, -len * 0.5 - 0.02], [0.05, 0.08, 0.05], [0, 0, 0, f === 'deer' ? 4 : 0], -0.4);
        quad(big ? 0.24 : hunter ? 0.12 : 0.16); lw = big ? 0.07 : f === 'camel' || hunter ? 0.04 : 0.045; if (f === 'hare') hop = 1;
      }
    }
    legs.forEach(([x, z, ph], q) => { const hip = f === 'millipede' ? 0.15 : ht + 0.15; B([x, hip * 0.5, z], [lw, hip * 0.5, lw * 1.2], [1 + q, hip, z, ph]); if (f === 'roo') B([x, 0.04, z + 0.12], [0.04, 0.03, 0.18], [1 + q, hip, z, ph]); });
    return { V, hop, bow: f === 'heron' ? 0.9 : hunter ? 0.3 : f === 'camel' ? 1.5 : f === 'bison' || f === 'musk' ? 0.4 : f === 'mammoth' || f === 'sauropod' ? 0.5 : 1.1 };
  }
  function bodyPlan(G, hunter, k, male) {                                 // k: a real kind's build (eco.js); else the planet's own
    const kk = k && k.col, dim = kk && ((k.form === 'deer' && !k.both) || k.mane || k.form === 'saiga'), key = G.id + (G.E || 0) + (hunter ? ':h' : '') + (kk ? k.nm + (dim && male ? ':m' : '') : ''); if (bodies.has(key)) return bodies.get(key);
    let V = [], hop = 0, bow = 0.6, hue, sp0 = 0;
    if (kk) { ({ V, hop, bow } = build(k, hunter, male)); hue = k.col; }
    else {
      const A = G.fauna || {}, r = rng(G.n * 313 + 5 + (hunter ? 77 : 0)), legs = hunter ? 4 : A.legs || (G.n === 0 ? 4 : r() < 0.35 ? 6 : 4), L = (hunter ? 0.4 + 0.15 * r() : (0.55 + 0.5 * r()) * (A.L ? A.L / 0.8 : 1)) * G.g ** -0.5, len = hunter ? 0.9 + 0.3 * r() : (1 + 0.8 * r()) * (A.len || 1), ht = L, neck = hunter ? 0.15 : (A.neck ?? 0.3 + 0.7 * r());
      const B = (c, rx, ry, rz, tag) => blob(V, c, rx, ry, rz, tag);
      B([0, ht + 0.25, 0], 0.28, 0.3, len * 0.5, [0, 0, 0, 0]);
      const nb = [0, ht + 0.35 + neck * 0.5, len * 0.5 + neck * 0.2], hd = [0, ht + 0.3 + neck, len * 0.5 + neck * 0.35 + 0.15];
      B(nb, 0.1, neck * 0.55, 0.12, [-1, ht + 0.3, len * 0.45, 0]); B(hd, 0.1, 0.11, 0.22, [-1, ht + 0.3, len * 0.45, 0]);
      for (let q = 0; q < legs; q++) { const side = q % 2 ? 1 : -1, z = (Math.floor(q / 2) / (legs / 2 - 1) - 0.5) * len * 0.75, hip = ht + 0.15; B([side * 0.16, hip * 0.5, z], 0.05, hip * 0.5, 0.06, [1 + q, hip, z, (q % 2) * 3.1416 + Math.floor(q / 2) * (legs === 6 ? 2.1 : 3.1416)]); }
      B([0, ht + 0.3, -len * 0.5 - 0.1], 0.04, 0.04, 0.2, [0, 0, 0, 0]);
      hue = hunter ? (G.n === 0 ? [0.12, 0.11, 0.1] : G.rock.map((v) => v * 0.45)) : A.col ? A.col : G.n === 0 ? [0.32, 0.2, 0.1] : G.soil.map((v) => Math.min(1, v * (1.2 + r()) + 0.05));
      sp0 = !hunter && r() < 0.5 ? 1 : 0;
    }
    const vao = gl.createVertexArray(), ib = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, ib); for (const [l, o] of [[4, 0], [5, 16]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(l, 1); } gl.bindVertexArray(null);
    const b = { vao, ib, n: V.length / 10, hop, bow, col: kk ? hue.map((v) => v * 0.6) : hue, col2: hue.map((v) => Math.min(1, kk ? v * 0.85 + 0.04 : v * 1.8 + 0.15)), spots: kk ? k.spots || 0 : sp0, scale: 1 };
    bodies.set(key, b); return b;
  }
  let lastT = 0;
  return {
    // the herds and hunters that eco.js keeps, each where it is and doing what it does
    beasts(common, cam, G, S, eco) {
      if (S.hc > 1500 || (G.fauna && G.fauna.none) || !eco) return;
      const F = S.F, foot = S.foot, t = performance.now() / 1000, dt = min(0.1, max(0, t - lastT)), groups = new Map(); lastT = t; drawn.length = 0;
      for (const R of eco.near()) {
        if (!R.ch.length && !(R.herons && R.herons.length) || hypot(...R.p.map((v, k) => v - foot[k])) > 2400) continue;
        for (const d of R.ch.flatMap((C) => C.herd.concat(C.pack)).concat(R.herons || [])) {
          const bp = bodyPlan(G, d.hunter, d.k, d.male); let gr = groups.get(bp); if (!gr) groups.set(bp, gr = { b: bp, out: [], ds: [] });
          const P = [0, 1, 2].map((q) => R.p[q] + R.ea[q] * d.x + R.eb[q] * d.z), l = hypot(...P), pg = P.map((v) => v / l * G.R), h = d.hy !== undefined && abs(d.x - d.hx0) + abs(d.z - d.hz0) < 0.5 ? d.hy : H(G, pg, 20);
          d.hy = h; d.hx0 = d.x; d.hz0 = d.z;
          const D = pg.map((v, q) => v - foot[q]), qq = [0, 1, 2].map((r) => D[0] * F[r][0] + D[1] * F[r][1] + D[2] * F[r][2]);
          const sc = d.k.sz * d.gn[0] * (0.42 + 0.58 * min(1, d.age / d.k.mat)) * (d.hunter ? 1.1 : 1) * (d.k.col ? 1 : gr.b.scale) * G.g ** -0.3, walk = d.dead >= 0 || d.v < 0.05 && d.mode !== 0 ? (d.mode === 3 || d.dead >= 0 ? -1 : 0) : min(1, 0.3 + d.v / 3);
          d.gp = (d.gp || 0) + dt * (d.v > 0.05 ? 3 + d.v * 1.6 : 0) * G.g ** 0.5;
          gr.out.push(qq[0], qq[1] + (h - S.cy) + qq[1] * h / G.R, qq[2], d.dead >= 0 ? -sc : sc, d.a, d.mode === 0 && d.dead < 0 ? 0 : walk, d.gp, floor(d.gn[3] * 19.99) + d.sd * 0.99);
          gr.ds.push(d);
        }
      }
      if (!groups.size) return;
      gl.useProgram(beast.p); common(beast); gl.uniform1f(beast.uCy, S.cy); gl.disable(gl.CULL_FACE);
      for (const { b, out, ds } of groups.values()) {
        gl.uniform3fv(beast.uCol, b.col); gl.uniform3fv(beast.uCol2, b.col2); gl.uniform1f(beast.uSpots, b.spots); gl.uniform1f(beast.uHop, b.hop); gl.uniform1f(beast.uBow, b.bow); gl.uniform1f(beast.uCode, 2e6 + drawn.length); drawn.push(...ds);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW); gl.bindVertexArray(b.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, b.n, out.length / 8);
      }
      gl.bindVertexArray(null);
      S.nBeasts = drawn.length;
    },
    // insects round you, as many as eco.js says the place holds: midges dancing in the air, butterflies by day where it
    // is warm, fireflies on warm nights; each tied to a 2.5 m cell of the ground
    insects(common, cam, G, S, eco) {
      if (!eco || S.hc > 40 || !G.air || !(G.real === 'earth' || !G.real)) return;
      const R = eco.at(S.foot); if (!R) return;
      const foot = S.foot, F = S.F, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0), CS = 2.5;
      const t = performance.now() / 1000, day = (S.sun || [0, 1, 0])[1], warm = R.T, dens = min(1.5, R.ins) * 0.35, i0 = floor(foot[b] / CS), j0 = floor(foot[c] / CS), out = [[], [], [], []];
      for (let i = i0 - 6; i <= i0 + 6; i++) for (let j = j0 - 6; j <= j0 + 6; j++) {
        const r0 = hs2(i, j, 211 + fk); if (r0 > dens) continue;
        const kind = day > 0.02 ? (warm > 10 && hs2(i, j, 212 + fk) < 0.3 ? 1 + floor(hs2(i, j, 213 + fk) * 2.99) : 0) : warm > 12 && day < -0.08 ? 4 : -1; if (kind < 0) continue;
        const key = `${G.id}:${fk}:${i}:${j}`; let cell = imemo.get(key);
        if (!cell) { const p = [0, 0, 0]; p[b] = (i + hs2(i, j, 214 + fk)) * CS; p[c] = (j + hs2(i, j, 215 + fk)) * CS; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c]; if (d <= 0) continue; p[a] = sg * sqrt(d); cell = { p, h: H(G, p, 16), s: hs2(i, j, 216 + fk) * 50 }; imemo.set(key, cell); if (imemo.size > 4000) imemo.clear(); }
        if (cell.h < 0.3) continue;
        const D = cell.p.map((v, k) => v - foot[k]), q = [0, 1, 2].map((k) => D[0] * F[k][0] + D[1] * F[k][1] + D[2] * F[k][2]), s0 = cell.s, amp = kind === 0 ? 0.4 : 1.5;
        const o = [sin(t * (0.7 + 0.1 * (s0 % 3)) + s0) * amp + (kind === 0 ? 0.08 * sin(t * 9 + s0) : 0), (kind === 0 ? 1.2 : kind === 4 ? 0.9 : 0.8) + 0.4 * sin(t * 0.9 + s0 * 1.3) + (kind === 0 ? 0.06 * sin(t * 7.3 + s0) : 0), cos(t * (0.6 + 0.1 * (s0 % 5)) + s0 * 0.7) * amp];
        const n = kind === 0 ? 6 : 1;
        for (let m = 0; m < n; m++) out[min(kind, 3)].push(q[0] + o[0] + (m ? sin(m * 3.1 + t * 5) * 0.25 : 0), q[1] + (cell.h - S.cy) + q[1] * cell.h / G.R + o[1] + (m ? cos(m * 2.3 + t * 4) * 0.2 : 0), q[2] + o[2] + (m ? cos(m * 1.7 + t * 6) * 0.25 : 0), 1, 1, t * 0.6 + s0, s0 + m, kind === 4 ? max(0, sin(t * 2.1 + s0 * 3)) ** 6 : 0);
      }
      gl.useProgram(bird.p); common(bird); gl.uniform1f(bird.uCy, S.cy); gl.disable(gl.CULL_FACE); gl.bindVertexArray(vao);
      const K = [[0.006, 160, [0.03, 0.03, 0.03]], [0.035, 9, [0.9, 0.45, 0.08]], [0.03, 10, [0.85, 0.85, 0.8]], [0.03, 11, [0.85, 0.75, 0.15]]];
      for (let k = 0; k < 4; k++) { const o = out[k]; if (!o.length) continue; const fire = k === 3 && day < 0;
        gl.uniform1f(bird.uSpan, fire ? 0.008 : K[k][0]); gl.uniform1f(bird.uBeat, fire ? 40 : K[k][1]); gl.uniform3fv(bird.uCol, fire ? [0.05, 0.05, 0.03] : K[k][2]); gl.uniform3fv(bird.uEm, fire ? [2.5, 3, 0.6] : [0, 0, 0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(o), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLES, 0, g.length / 3, o.length / 8); }
      gl.bindVertexArray(null);
      // on the ground round you, as many as the census says are out on the surface now: each 1 m cell gets its expected
      // share of ants, salamanders or frogs, lizards and mice; and above, bats after dusk, one 20 m cell at a time
      const cz = S.cen; if (!cz || S.hc > 12) return;
      const u = cz.surf, sal = /salamander/.test(cz.N.amph), toad = /toad/.test(cz.N.amph), dry = R.W < 0.3;
      const CL = [['ant', 0.005, [0.07, 0.035, 0.02], 0.03, 6], ['amph', sal ? 0.09 : 0.05, sal ? [0.45, 0.12, 0.05] : toad ? [0.4, 0.33, 0.22] : [0.22, 0.3, 0.1], 0.004, 1], ['rept', 0.13, dry ? [0.55, 0.45, 0.3] : [0.24, 0.21, 0.14], 0.4, 1], ['rod', 0.15, [0.36, 0.28, 0.2], 0.5, 1]];
      const gout = CL.map(() => []), gi = floor(foot[b]), gj = floor(foot[c]);
      for (let i = gi - 9; i <= gi + 9; i++) for (let j = gj - 9; j <= gj + 9; j++) {
        let cell = null;
        CL.forEach(([k, len, , spd, cap], ci) => {
          const lam = u[k] || 0, h0 = hs2(i, j, 231 + ci * 7 + fk), nk = min(cap, floor(lam + h0)); if (!nk) return;
          if (!cell) { const key = `${G.id}:${fk}:${i}:${j}`; cell = gmemo.get(key); if (!cell) { const p = [0, 0, 0]; p[b] = i + 0.5; p[c] = j + 0.5; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c]; if (d <= 0) return; p[a] = sg * sqrt(d); cell = { p, h: H(G, p, 16) }; gmemo.set(key, cell); if (gmemo.size > 3000) gmemo.clear(); } }
          if (cell.h < 0.3) return;
          const D = cell.p.map((v, m) => v - foot[m]), q = [0, 1, 2].map((m) => D[0] * F[m][0] + D[1] * F[m][1] + D[2] * F[m][2]);
          for (let m = 0; m < nk; m++) { const s0 = hs2(i * 7 + m, j, 232 + ci + fk) * 60, ph = t * 0.12 + s0, n0 = floor(ph), fr = ph - n0;
            const w = k === 'rept' ? s0 + (n0 + min(1, max(0, (fr - 0.2) * 8))) * 1.5 : t * spd / 0.35 + s0;   // a lizard dashes, then basks
            gout[ci].push(q[0] + 0.35 * sin(w) + 0.1 * sin(s0), q[1] + (cell.h - S.cy) + q[1] * cell.h / G.R + 0.004, q[2] + 0.35 * cos(w * 0.8) + 0.1 * cos(s0), 1, 1, Math.atan2(cos(w), -0.8 * sin(w * 0.8)), 0, 0); }
        });
      }
      S.nGround = gout.map((o) => o.length / 8);
      gl.uniform1f(bird.uBeat, 0); gl.uniform3f(bird.uEm, 0, 0, 0); gl.bindVertexArray(cvao);
      CL.forEach(([, len, col], ci) => { const o = gout[ci]; if (!o.length) return; gl.uniform1f(bird.uSpan, len / 1.45); gl.uniform3fv(bird.uCol, col); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(o), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLES, 0, gc.length / 3, o.length / 8); });
      const bo = [], bi = floor(foot[b] / 20), bj = floor(foot[c] / 20);
      if (u.bat > 0) for (let i = bi - 2; i <= bi + 2; i++) for (let j = bj - 2; j <= bj + 2; j++) { if (hs2(i, j, 241 + fk) > u.bat * 400) continue;
        const s0 = hs2(i, j, 242 + fk) * 50, x = (i + 0.5) * 20 - foot[b], z = (j + 0.5) * 20 - foot[c], P = [0, 0, 0]; P[b] = x; P[c] = z;
        const q = [0, 1, 2].map((m) => P[0] * F[m][0] + P[1] * F[m][1] + P[2] * F[m][2]), w = t * 1.3 + s0, jk = sin(t * 5.1 + s0) * 0.8;   // a bat's jinks after moths
        bo.push(q[0] + 7 * sin(w) + jk, 5 + 3 * sin(w * 0.7 + s0) - S.hc, q[2] + 7 * cos(w * 1.1) + jk, 1, 1, -w, s0, 0); }
      if (bo.length) { gl.bindVertexArray(vao); gl.uniform1f(bird.uSpan, 0.14); gl.uniform1f(bird.uBeat, 13); gl.uniform3fv(bird.uCol, [0.05, 0.04, 0.04]); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bo), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLES, 0, g.length / 3, bo.length / 8); }
      gl.bindVertexArray(null);
    },
    draw(common, cam, G, S, eco) {
      if (S.hc > 6000 || G.birds === false) return;
      const foot = S.foot, F = S.F, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1, fk = a * 2 + (sg > 0 ? 1 : 0);
      const out = [], t = performance.now() / 1000, i0 = floor(foot[b] / SP), j0 = floor(foot[c] / SP);
      for (let i = i0 - 3; i <= i0 + 3; i++) for (let j = j0 - 3; j <= j0 + 3; j++) {
        const key = `${G.id}:${fk}:${i}:${j}`; let f = memo.get(key);
        if (f === undefined) {
          f = null; if (hs2(i, j, 150 + fk) < 0.85) { const p = [0, 0, 0]; p[b] = (i + hs2(i, j, 151 + fk)) * SP; p[c] = (j + hs2(i, j, 152 + fk)) * SP; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c]; if (d > 0) { p[a] = sg * sqrt(d); const h = H(G, p, 16), cl = climate(G, p, h); if (h > 0 && cl.T > -8) f = { p, h, n: 30 + floor(hs2(i, j, 153 + fk) ** 2 * NB), r: 60 + 200 * hs2(i, j, 154 + fk), alt: 30 + 220 * hs2(i, j, 155 + fk), sd: hs2(i, j, 156 + fk) }; } }
          memo.set(key, f);
        }
        if (!f) continue;
        const D = f.p.map((v, k) => v - foot[k]), q = [0, 1, 2].map((k) => D[0] * F[k][0] + D[1] * F[k][1] + D[2] * F[k][2]); if (hypot(q[0], q[2]) > 6000) continue;
        const base = [q[0], q[1] + (f.h + f.alt - S.cy) + q[1] * f.h / G.R, q[2]];
        const nf = eco ? Math.round(f.n * min(2.2, eco.birdsAt(f.p))) : f.n;   // as many as the insects there feed
        // a flock moves as one: its centre wanders a loop, and its shape (each bird a fixed place in a ball) is stretched,
        // flattened and turned as a whole, with a wave running through it, so it swells, thins and folds like a murmuration
        const w = t * (0.12 + 0.05 * f.sd) / G.g ** -0.3, cx = cos(w) * f.r + sin(w * 2.3 + f.sd * 9) * f.r * 0.3, cz = sin(w) * f.r * 0.7 + cos(w * 1.7) * f.r * 0.3, cy = 12 * sin(w * 1.3 + f.sd * 5);
        const hd = Math.atan2(-sin(w) * f.r, cos(w) * f.r * 0.7), sz = 6 + nf * 0.25, st = [1 + 0.6 * sin(t * 0.21 + f.sd * 7), 0.35 + 0.3 * sin(t * 0.17 + f.sd * 3), 1 + 0.6 * cos(t * 0.13 + f.sd)], tw = t * 0.07 + f.sd * 6, ct = cos(tw), stw = sin(tw);
        for (let k = 0; k < nf; k++) {
          const fr = (x) => x - floor(x), u = [fr(sin(k * 12.9898 + f.sd) * 43758.5) * 2 - 1, fr(sin(k * 78.233 + f.sd) * 12543.1) * 2 - 1, fr(sin(k * 39.425 + f.sd) * 24634.6) * 2 - 1], r3 = cbrt(fr(sin(k * 3.7) * 9631.7) + 0.05);
          const bx = u[0] * r3 * sz * st[0], by = u[1] * r3 * sz * st[1], bz = u[2] * r3 * sz * st[2], wave = sin(bx * 0.15 - t * 1.6) * sz * 0.25;
          const ox = cx + ct * bx - stw * bz, oz = cz + stw * bx + ct * bz, oy = cy + by + wave;
          out.push(base[0] + ox, base[1] + oy, base[2] + oz, 1, 1, hd + 0.3 * sin(k + t), k * 0.37 + f.sd, 0);
        }
      }
      // the birds' hunters: a few circling high over each square, as many as the small birds keep
      const hk = eco ? eco.hawksAt(foot) : 0, hout = [];
      for (let k = 0; k < Math.round(min(3, hk * 1.2)); k++) { const w = t * (0.08 + 0.02 * k) + k * 2.1, rr = 60 + 30 * k, h0 = 70 + 40 * k + 10 * sin(t * 0.1 + k); hout.push(cos(w) * rr + k * 80 - 80, h0 - min(S.hc, 60), sin(w) * rr, 1, 1, -w, k * 0.7, 0); }
      if (hout.length) { gl.useProgram(bird.p); common(bird); gl.uniform1f(bird.uSpan, 0.6); gl.uniform1f(bird.uBeat, 2.2); gl.uniform1f(bird.uCy, S.cy); gl.uniform3fv(bird.uCol, [0.12, 0.08, 0.05]); gl.uniform3f(bird.uEm, 0, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hout), gl.DYNAMIC_DRAW); gl.disable(gl.CULL_FACE); gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, g.length / 3, hout.length / 8); gl.bindVertexArray(null); }
      if (!out.length) return;
      gl.useProgram(bird.p); common(bird); const span = (G.fauna && G.fauna.span || 0.45) * G.g ** -0.5; gl.uniform1f(bird.uSpan, span); gl.uniform1f(bird.uBeat, 9 * G.g ** 0.6); gl.uniform1f(bird.uCy, S.cy);
      gl.uniform3fv(bird.uCol, G.soil.map((v) => v * 0.6 + 0.02)); gl.uniform3f(bird.uEm, 0, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, g.length / 3, out.length / 8); gl.bindVertexArray(null);
    },
  };
}
