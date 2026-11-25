// One world, every scale. The ground is a single height field: K octaves of value noise, each half the size of the
// last, from 524 km down to a few micrometres. Each octave is looked up in its own lattice of 256 x 256 cells (so
// any octave can be evaluated near any point with small numbers), and everything is measured from the camera, so a
// grain of sand beside you is as precise as a mountain range far off. The same function exists twice, here (in
// double precision, for the camera, picking and placing) and in GLSL (for drawing); they agree to the last bit of the
// lattice hash and to float precision in the smooth parts.

export const K = 37, LS = 19, SEA = 0, R_EARTH = 6.371e6, GOLD = 2.39996323;
export const sOf = (k) => 2 ** (LS - k);                                 // octave k's cell size, metres
export const RIDGE = 9;                                                    // octaves of 2 km and up are ridged: mountains

// how rough the ground is at each scale, as a fraction of the scale (by log2 of the scale)
const RT = [[19, .004], [17, .01], [15, .03], [13, .06], [12, .07], [11, .06], [9, .045], [7, .035], [5, .03], [2, .028], [-1, .03], [-4, .048], [-7, .058], [-10, .04], [-18, .03]];
export const ampOf = (k) => { const l = LS - k; for (let i = 1; i < RT.length; i++) if (l >= RT[i][0]) { const [l0, a0] = RT[i - 1], [l1, a1] = RT[i]; return 2 ** l * (a1 + (a0 - a1) * (l - l1) / (l0 - l1)); } return 2 ** l * .03; };
export const AMP = Array.from({ length: K }, (_, k) => ampOf(k));
export const BASE = 700;                                                   // metres: the mean ground stands this far above the sea

// the lattice hash, the same bits as the shader's
export const hsh = (x, y, k) => { let h = (Math.imul((x + 17 * k) & 255, 374761393) + Math.imul((y + 91 * k) & 255, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h & 16777215) / 16777215; };
const fade = (f) => f * f * f * (f * (f * 6 - 15) + 10);
export const vn = (ux, uy, k) => { const ix = Math.floor(ux), iy = Math.floor(uy), fx = ux - ix, fy = uy - iy, wx = fade(fx), wy = fade(fy), a = hsh(ix, iy, k), b = hsh(ix + 1, iy, k), c = hsh(ix, iy + 1, k), d = hsh(ix + 1, iy + 1, k); return a + (b - a) * wx + (c - a) * wy + (a - b - c + d) * wx * wy; };
const m256 = (v) => ((v % 256) + 256) % 256;
// octave k at world (x, z): its lattice coordinate, folded into 0..256
export const lat = (k, x, z) => { const a = k * GOLD, c = Math.cos(a), s = Math.sin(a), S = sOf(k); return [m256((c * x - s * z) / S), m256((s * x + c * z) / S)]; };
export const shape = (k, n) => (k < RIDGE ? 1 - Math.abs(2 * n - 1) : n);
export const oct = (k, x, z) => { const [u, v] = lat(k, x, z); return shape(k, vn(u, v, k)); };
export function H(x, z, kmax = K) { let h = BASE; for (let k = 0; k < kmax; k++) h += AMP[k] * (oct(k, x, z) - 0.5); return h; }
// the octave's value, gradient and curvature (in lattice units) at a point, for the shader's near field
export function taylor(k, x, z) {
  const [u, v] = lat(k, x, z), f = (a, b) => shape(k, vn(a, b, k)), e = 1e-4, f0 = f(u, v);
  const fx1 = f(u + e, v), fx0 = f(u - e, v), fy1 = f(u, v + e), fy0 = f(u, v - e);
  return [u, v, f0, (fx1 - fx0) / (2 * e), (fy1 - fy0) / (2 * e), (fx1 - 2 * f0 + fx0) / (e * e), (f(u + e, v + e) - f(u + e, v - e) - f(u - e, v + e) + f(u - e, v - e)) / (4 * e * e), (fy1 - 2 * f0 + fy0) / (e * e)];
}

// where the forest is: a slow noise of its own, above the sea, below the treeline, off the steepest slopes
export const forest = (x, z, h) => { const n = vn(m256(x / 900 + 31.7), m256(z / 900 + 12.9), 5) * 0.6 + vn(m256(x / 260 + 7.3), m256(z / 260 + 3.1), 6) * 0.4; return Math.min(1, Math.max(0, (n - 0.34) * 4)) * Math.min(1, Math.max(0, (h - 3) / 6)) * Math.min(1, Math.max(0, (1900 - h) / 250)); };
export const TREE = 7;                                                    // metres between tree sites
// the tree in site (i, j), if there is one: [x, z, kind, seed] or null
export function tree(i, j) {
  const r1 = hsh(i, j, 40), r2 = hsh(i, j, 41), x = (i + 0.15 + 0.7 * r1) * TREE, z = (j + 0.15 + 0.7 * r2) * TREE, h = H(x, z, 24);
  if (hsh(i, j, 42) > forest(x, z, h)) return null;
  return [x, z, hsh(i, j, 43) < 0.45 + 0.4 * Math.min(1, Math.max(0, (h - 900) / 700)) ? 1 : 0, hsh(i, j, 44), h];   // conifers higher up
}

// ---- the same, for the shaders -------------------------------------------------------------------------------------
export const GLSL_NOISE = `
uniform vec4 uA[${K}];   // per octave: where the camera is in its lattice (x, y), its value there, its amplitude
uniform vec4 uB[${K}];   // its gradient and curvature there (gx, gy, hxx, hxy)
uniform float uC[${K}];  // (hyy)
float hsh(ivec2 c, int k) { uint x = uint((c.x + 17 * k) & 255), y = uint((c.y + 91 * k) & 255); uint h = x * 374761393u + y * 668265263u; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h & 16777215u) / 16777215.; }
vec3 vnd(vec2 u, int k) {
  vec2 i = floor(u), f = u - i, w = f * f * f * (f * (f * 6. - 15.) + 10.), dw = 30. * f * f * (f * (f - 2.) + 1.);
  ivec2 c = ivec2(i); float a = hsh(c, k), b = hsh(c + ivec2(1, 0), k), d = hsh(c + ivec2(0, 1), k), e = hsh(c + ivec2(1, 1), k), m = a - b - d + e;
  return vec3(a + (b - a) * w.x + (d - a) * w.y + m * w.x * w.y, dw * vec2(b - a + m * w.y, d - a + m * w.x));
}
float sOf(int k) { return exp2(float(${LS} - k)); }
float forest(vec2 w, float h, float fp) { vec2 a = mod(w / 900. + vec2(31.7, 12.9), 256.), b = mod(w / 260. + vec2(7.3, 3.1), 256.); float n = mix(vnd(a, 5).x, .5, smoothstep(200., 700., fp)) * .6 + mix(vnd(b, 6).x, .5, smoothstep(60., 200., fp)) * .4; return clamp((n - .34) * 4., 0., 1.) * clamp((h - 3.) / 6., 0., 1.) * clamp((1900. - h) / 250., 0., 1.); }
float forest(vec2 w, float h) { return forest(w, h, 0.); }
// octave k's contribution at p (metres from the camera, on the ground plane): its height relative to under the
// camera, and its slope. Near the camera (within a five-hundredth of its cell) it is the octave's own Taylor series,
// so no octave ever has to resolve a millimetre against a mountain's coordinates.
vec3 oct(int k, vec2 p) {
  float s = sOf(k), a = float(k) * ${GOLD}, cs = cos(a), sn = sin(a); vec2 du = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) / s;
  vec4 A = uA[k]; float n; vec2 g;
  if (dot(du, du) < 4e-6) { vec4 B = uB[k]; float c = uC[k]; n = dot(B.xy, du) + .5 * (B.z * du.x * du.x + 2. * B.w * du.x * du.y + c * du.y * du.y); g = B.xy + vec2(B.z * du.x + B.w * du.y, B.w * du.x + c * du.y); }
  else { vec3 q = vnd(A.xy + du, k); if (k < ${RIDGE}) { float sg = sign(2. * q.x - 1.); n = 1. - abs(2. * q.x - 1.) - A.z; g = -2. * sg * q.yz; } else { n = q.x - A.z; g = q.yz; } }
  return vec3(n, vec2(cs * g.x + sn * g.y, -sn * g.x + cs * g.y) / s) * A.w;
}
`;
