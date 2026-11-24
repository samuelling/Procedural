// Seeded random numbers and value noise: the only sources of irregularity.
const { floor, imul } = Math;
export const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = imul(s ^ (s >>> 15), 1 | s); t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const h = (x, y, z) => { let n = imul(x, 374761393) + imul(y, 668265263) + imul(z, 2147483647); n = imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const sm = (t) => t * t * (3 - 2 * t), mix = (a, b, t) => a + (b - a) * t;
export function vn3(x, y, z) {
  const i = floor(x), j = floor(y), k = floor(z), u = sm(x - i), v = sm(y - j), w = sm(z - k);
  return mix(mix(mix(h(i, j, k), h(i + 1, j, k), u), mix(h(i, j + 1, k), h(i + 1, j + 1, k), u), v),
    mix(mix(h(i, j, k + 1), h(i + 1, j, k + 1), u), mix(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), u), v), w);
}
export function fbm(x, y, z, o = 4) { let a = 0.5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vn3(x, y, z); n += a; a *= 0.5; x = x * 2.03 + 11.7; y = y * 2.03 + 5.3; z = z * 2.03 + 2.9; } return s / n; }
