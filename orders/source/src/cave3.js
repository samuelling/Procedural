// A cave in true 3D (2 MB rung): passages that run one above another, shafts between them, a chamber whose roof has
// fallen in, and an entrance that comes up into daylight on the hillside.
//
// The rock is a field on a half-metre grid 64 m across and 34 m deep: positive where there is air, negative in rock.
// Passages are stamped into it along wandering lines as tubes with flatter floors (the shape water leaves when it fills
// a passage, then cuts a floor down), the hillside's surface bounds it above, and a little noise roughens the walls.
// The surface between rock and air is found by surface nets: a vertex in every grid cell the surface passes through,
// at the average of where it crosses the cell's edges, and a quad across every edge it crosses. Each vertex keeps how
// much sky it can see, so daylight dies away down the entrance and the shafts and is gone in the deep passages.
/* global TIER */
import { fbm } from './noise.js';

export function cave3(rnd, hs) {
  const { hypot, min, max, floor, cos, sin, atan2, PI } = Math, R = 0.5, Y0 = -22, Y1 = 12, NX = Math.round(2 * hs / R) + 1, NY = Math.round((Y1 - Y0) / R) + 1, NN = NX * NY * NX;
  const P = new Float32Array(NN), D = new Float32Array(NN), id = (i, j, k) => i + NX * (j + NY * k), rr = (a, b) => a + (b - a) * rnd();
  const ox = rnd() * 50, oz = rnd() * 50, surf = (x, z) => 5 + 4 * (fbm(x * 0.035 + ox, 1, z * 0.035 + oz, 3) - 0.5) + 0.06 * x;
  const stamp = (a, b, w, h) => {
    const r = max(w, h) + 1, lo = [min(a[0], b[0]) - r, min(a[1], b[1]) - r, min(a[2], b[2]) - r], hi = [max(a[0], b[0]) + r, max(a[1], b[1]) + r, max(a[2], b[2]) + r];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
    for (let k = max(0, floor((lo[2] + hs) / R)); k <= min(NX - 1, (hi[2] + hs) / R); k++) for (let j = max(0, floor((lo[1] - Y0) / R)); j <= min(NY - 1, (hi[1] - Y0) / R); j++) for (let i = max(0, floor((lo[0] + hs) / R)); i <= min(NX - 1, (hi[0] + hs) / R); i++) {
      const x = -hs + i * R, y = Y0 + j * R, z = -hs + k * R, t = max(0, min(1, ((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / L)), cx = a[0] + d[0] * t, cy = a[1] + d[1] * t, cz = a[2] + d[2] * t;
      const dv = y - cy, e = (hypot(x - cx, z - cz) / w) ** 2 + (dv / (dv < 0 ? h * 0.7 : h)) ** 2, q = id(i, j, k); if (e < 1 && 1 - e > P[q]) P[q] = 1 - e;
    }
  };
  // a passage: a line that wanders from a toward b, stamped as a tube
  const path = (a, b, w, h, wob = 0.5) => { const pts = [a]; let p = a.slice(); for (let s = 0; s < 80; s++) { const dx = b[0] - p[0], dy = b[1] - p[1], dz = b[2] - p[2], l = hypot(dx, dy, dz); if (l < 1.6) break; const hd = atan2(dz, dx) + rr(-wob, wob), st = 1.5, q = [p[0] + cos(hd) * st, p[1] + dy / l * st, p[2] + sin(hd) * st]; stamp(p, q, w * rr(0.85, 1.15), h * rr(0.85, 1.15)); pts.push(q); p = q; } stamp(p, b, w, h); pts.push(b); return pts; };
  const cx = rr(-5, 5), cz = rr(-5, 5), ch = [cx, -8, cz];
  stamp([cx - 6, -8, cz - 1], [cx + 6, -8, cz + 1], 7, 4.5);                         // the chamber
  const sky = [cx + rr(-3, 3), cz + rr(-3, 3)]; stamp([sky[0], -6, sky[1]], [sky[0], surf(sky[0], sky[1]) + 3, sky[1]], 2.2, 1);   // where its roof fell in
  const ez = rr(-hs * 0.5, hs * 0.5), ent = path([cx - 6, -9, cz], [-hs + 2, surf(-hs + 2, ez) + 0.6, ez], 2.2, 1.8);   // the way in, up to the hillside
  const up = path([cx + 3, -3.2, cz - 2], [hs - 3, -1.5, rr(-hs * 0.6, hs * 0.6)], 1.8, 1.4);   // an older, higher level
  const side = path([cx, -9, cz + 5], [rr(-hs * 0.5, hs * 0.5), -8.5, hs - 3], 2, 1.6);
  stamp(side[(side.length * 0.6) | 0], [side[(side.length * 0.6) | 0][0], -2, side[(side.length * 0.6) | 0][2]], 1.1, 1);   // a shaft up from it
  path(side[(side.length * 0.6) | 0].map((v, i) => (i === 1 ? -2 : v)), up[(up.length * 0.5) | 0], 1.5, 1.2);
  const low = path([cx + 4, -11, cz + 3], [cx + rr(8, 14), -17, cz + rr(-12, -6)], 0.9, 3.2, 0.7);   // a canyon cut down by a stream
  const sump = low[low.length - 1]; stamp([sump[0] - 2, sump[1] - 0.5, sump[2]], [sump[0] + 2, sump[1] - 0.5, sump[2]], 2.8, 1.8);
  // the field: passages, roughened; the hillside above; rock everywhere else, and capped at the grid's edges
  for (let k = 0; k < NX; k++) for (let i = 0; i < NX; i++) {
    const x = -hs + i * R, z = -hs + k * R, s = surf(x, z), edge = !i || !k || i === NX - 1 || k === NX - 1;
    for (let j = 0; j < NY; j++) { const y = Y0 + j * R, q = id(i, j, k), a = y - s; let v = a; if (!edge && j && P[q] > 0) v = max(a, 2 * P[q] - 1 + 0.45 * (fbm(x * 0.4, y * 0.4, z * 0.4, 2) - 0.5)); else if (!edge && j) v = max(a, -1); if (!j) v = -1; D[q] = v; }
  }
  const dAt = (x, y, z) => { const u = min(NX - 1.001, max(0, (x + hs) / R)), v = min(NY - 1.001, max(0, (y - Y0) / R)), w = min(NX - 1.001, max(0, (z + hs) / R)), i = u | 0, j = v | 0, k = w | 0, a = u - i, b = v - j, c = w - k, q = id(i, j, k), s = NX, t = NX * NY;
    return ((D[q] * (1 - a) + D[q + 1] * a) * (1 - b) + (D[q + s] * (1 - a) + D[q + s + 1] * a) * b) * (1 - c) + ((D[q + t] * (1 - a) + D[q + t + 1] * a) * (1 - b) + (D[q + t + s] * (1 - a) + D[q + t + s + 1] * a) * b) * c; };
  const floorAt = (x, y, z) => { let h = y; if (dAt(x, h, z) <= 0) { for (let s = 0; s < 24 && dAt(x, h, z) <= 0; s++) h += 0.25; return h; } for (let s = 0; s < 160 && dAt(x, h - 0.25, z) > 0; s++) h -= 0.25; let a = h - 0.25, b = h; for (let s = 0; s < 6; s++) { const m = (a + b) / 2; if (dAt(x, m, z) > 0) b = m; else a = m; } return b; };
  const ceilAt = (x, y, z) => { let h = y; for (let s = 0; s < 160 && dAt(x, h + 0.25, z) > 0; s++) h += 0.25; return h + 0.25; };
  // surface nets
  const V = new Int32Array(NN).fill(-1), pos = [], ed = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < NX - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const c = co.map((o) => D[id(i + o[0], j + o[1], k + o[2])]); let m = 0; for (let n = 0; n < 8; n++) if (c[n] > 0) m |= 1 << n; if (!m || m === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0; for (const [a, b] of ed) if ((c[a] > 0) !== (c[b] > 0)) { const t = c[a] / (c[a] - c[b]); px += co[a][0] + (co[b][0] - co[a][0]) * t; py += co[a][1] + (co[b][1] - co[a][1]) * t; pz += co[a][2] + (co[b][2] - co[a][2]) * t; n++; }
    V[id(i, j, k)] = pos.length / 3; pos.push(-hs + (i + px / n) * R, Y0 + (j + py / n) * R, -hs + (k + pz / n) * R);
  }
  const quads = [], q4 = (a, b, c, d, f) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; quads.push(f ? [a, b, c, d] : [d, c, b, a]); };
  for (let k = 0; k < NX; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const d0 = D[id(i, j, k)] > 0;
    if (i < NX - 1 && j && k && d0 !== D[id(i + 1, j, k)] > 0) q4(V[id(i, j - 1, k - 1)], V[id(i, j, k - 1)], V[id(i, j, k)], V[id(i, j - 1, k)], d0);
    if (j < NY - 1 && i && k && d0 !== D[id(i, j + 1, k)] > 0) q4(V[id(i - 1, j, k - 1)], V[id(i - 1, j, k)], V[id(i, j, k)], V[id(i, j, k - 1)], d0);
    if (k < NX - 1 && i && j && d0 !== D[id(i, j, k + 1)] > 0) q4(V[id(i - 1, j - 1, k)], V[id(i, j - 1, k)], V[id(i, j, k)], V[id(i - 1, j, k)], d0);
  }
  // each vertex: a normal toward the air, and how much sky it sees (five rays up through the rock)
  const nv = pos.length / 3, attr = new Float32Array(nv * 5);
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], e = 0.3, g = [dAt(x + e, y, z) - dAt(x - e, y, z), dAt(x, y + e, z) - dAt(x, y - e, z), dAt(x, y, z + e) - dAt(x, y, z - e)], l = hypot(...g) || 1;
    let seen = 0; for (const [dx, dz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) { let ok = 1; for (let s = 1; s < 60; s++) { const yy = y + g[1] / l * 0.4 + s * 0.6, xx = x + g[0] / l * 0.4 + dx * s * 0.6, zz = z + g[2] / l * 0.4 + dz * s * 0.6; if (yy > Y1 || Math.abs(xx) > hs || Math.abs(zz) > hs) break; if (dAt(xx, yy, zz) < 0) { ok = 0; break; } } seen += ok; }
    attr.set([g[0] / l, g[1] / l, g[2] / l, max(0.012, seen / 5), 0], v * 5);
  }
  // cut into meshes of fewer than 65,536 vertices
  const meshes = [], map = new Int32Array(nv).fill(-1); let vs = [], is = [], used = [];
  const flush = () => { if (is.length) meshes.push({ v: new Float32Array(vs), i: new Uint16Array(is) }); for (const u of used) map[u] = -1; vs = []; is = []; used = []; };
  const loc = (g) => { if (map[g] < 0) { map[g] = vs.length / 8; used.push(g); vs.push(pos[g * 3], pos[g * 3 + 1], pos[g * 3 + 2], attr[g * 5], attr[g * 5 + 1], attr[g * 5 + 2], attr[g * 5 + 3], 0.6); } return map[g]; };
  for (const qd of quads) { if (vs.length / 8 > 65000) flush(); const [a, b, c, d] = qd.map(loc); is.push(a, b, c, a, c, d); }
  flush();
  // where water drips through the roof: pairs of a stalactite above and a stalagmite under it
  const drips = []; for (let t = 0; t < 3000 && drips.length < 170; t++) {
    const x = rr(-hs + 2, hs - 2), z = rr(-hs + 2, hs - 2), s = surf(x, z); let y = s - 0.6;
    while (y > Y0 + 1) { if (dAt(x, y, z) > 0) { const c = ceilAt(x, y, z), f = floorAt(x, y, z); if (c < s - 0.5 && c - f > 0.9 && c - f < 10 && hypot(x - sky[0], z - sky[1]) > 4) drips.push([x, f, c, z]); y = f - 0.5; } else y -= 0.5; }
  }
  const s0 = ent[max(0, ent.length - 4)], s1 = ent[max(0, ent.length - 6)];   // start just inside the way in, facing down it
  return { meshes, floorAt, ceilAt, surf, drips, sky, sump, start: [s0[0], s0[2], atan2(-(s1[0] - s0[0]), -(s1[2] - s0[2]))], ent: ent[ent.length - 1], ch, low, up, verts: nv };
}
