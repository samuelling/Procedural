// Where the Sun, the Moon and the planets are, at any moment: the planets from their Keplerian elements and how those
// drift (Standish, JPL, "Keplerian elements for approximate positions of the major planets", good to a few minutes
// of arc between 1800 and 2050), the Moon from the largest terms of its theory (to about a third of a degree), and each
// body's turn from the IAU's rotation models (Archinal et al. 2011, without the small periodic terms). Positions are in
// metres in the ICRF equatorial frame (x to the March equinox, z to the celestial north pole), the origin at the Sun.
const { sin, cos, atan2, sqrt, hypot, PI } = Math, R = PI / 180, AU = 1.495978707e11;
export const J2000 = 946728000000;                                             // 2000 Jan 1 12:00 UT, in ms since 1970
export const dayOf = (ms) => (ms - J2000) / 864e5;                             // days from J2000
export const msOf = (d) => J2000 + d * 864e5;
// a, e, I, L, long. perihelion, long. node (AU, degrees), then their rates per Julian century
const EL = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};
const EPS = 23.43928 * R, ce = cos(EPS), se = sin(EPS);
const eq = (v) => [v[0], ce * v[1] - se * v[2], se * v[1] + ce * v[2]];       // ecliptic to equatorial
export function helio(name, d) {                                                // heliocentric, metres, equatorial
  if (name === 'sun') return [0, 0, 0];
  if (name === 'moon') return add(helio('earth', d), moonGeo(d));
  const E0 = EL[name], T = d / 36525, el = E0.slice(0, 6).map((v, i) => v + E0[i + 6] * T);
  const [a, e, I, L, wb, Om] = el, w = (wb - Om) * R, M = (((L - wb) % 360) + 540) % 360 * R - PI;
  let E = M + e * sin(M); for (let k = 0; k < 6; k++) E -= (E - e * sin(E) - M) / (1 - e * cos(E));
  const xp = a * (cos(E) - e), yp = a * sqrt(1 - e * e) * sin(E), cw = cos(w), sw = sin(w), cO = cos(Om * R), sO = sin(Om * R), cI = cos(I * R), sI = sin(I * R);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, z = sw * sI * xp + cw * sI * yp;
  return eq([x * AU, y * AU, z * AU]);
}
// the Moon from the Earth's centre (metres, equatorial)
export function moonGeo(d) {
  const Lp = 218.316 + 13.176396 * d, Mp = (134.963 + 13.064993 * d) * R, F = (93.272 + 13.22935 * d) * R, D = (297.850 + 12.190749 * d) * R, M = (357.529 + 0.98560028 * d) * R;
  const lam = (Lp + 6.289 * sin(Mp) + 1.274 * sin(2 * D - Mp) + 0.658 * sin(2 * D) + 0.214 * sin(2 * Mp) - 0.186 * sin(M) - 0.114 * sin(2 * F)) * R;
  const bet = (5.128 * sin(F) + 0.281 * sin(Mp + F) + 0.278 * sin(Mp - F) + 0.173 * sin(2 * D - F)) * R;
  const r = (385001 - 20905 * cos(Mp) - 3699 * cos(2 * D - Mp) - 2956 * cos(2 * D)) * 1000;
  return eq([r * cos(bet) * cos(lam), r * cos(bet) * sin(lam), r * sin(bet)]);
}
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
// pole (right ascension, declination, their rates per century) and prime meridian (W0, degrees a day), IAU 2009
const ROT = {
  mercury: [281.0103, -0.0328, 61.4155, -0.0049, 329.5988, 6.1385108],
  venus: [272.76, 0, 67.16, 0, 160.2, -1.4813688],
  earth: [0, -0.641, 90, -0.557, 190.147, 360.9856235],
  moon: [269.9949, 0.0031, 66.5392, 0.013, 38.3213, 13.17635815],
  mars: [317.68143, -0.1061, 52.8865, -0.0609, 176.63, 350.89198226],
  jupiter: [268.056595, -0.006499, 64.495303, 0.002413, 284.95, 870.536],
  saturn: [40.589, -0.036, 83.537, -0.004, 38.9, 810.7939024],
  uranus: [257.311, 0, -15.175, 0, 203.81, -501.1600928],
  neptune: [299.36, 0, 43.46, 0, 253.18, 536.3128492],
};
// the matrix (rows) from the equatorial frame to the body's own (x through its prime meridian, z its north pole)
export function frame(name, d) {
  const [a0, da, d0, dd, W0, Wd] = ROT[name], T = d / 36525, a = (a0 + da * T) * R, de = (d0 + dd * T) * R, W = ((W0 + Wd * d) % 360) * R;
  const z = [cos(de) * cos(a), cos(de) * sin(a), sin(de)], Q = [-sin(a), cos(a), 0], P = [z[1] * Q[2] - z[2] * Q[1], z[2] * Q[0] - z[0] * Q[2], z[0] * Q[1] - z[1] * Q[0]];
  const x = add(Q.map((v) => v * cos(W)), P, sin(W)), y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [x, y, z];
}
export const toBody = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
export const fromBody = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
export const unit = (v) => { const l = hypot(...v) || 1; return v.map((x) => x / l); };
// the galaxy's own axes in this frame: its north pole and the direction of its centre (IAU 1958, J2000)
const radec = (ra, dec) => [cos(dec * R) * cos(ra * R), cos(dec * R) * sin(ra * R), sin(dec * R)];
export const NGP = radec(192.85948, 27.12825), GC = radec(266.40499, -28.93617);
export { AU, atan2 };
// where the Sun is from a real body at day d, in its own axes
export function sunReal(name, d) { const p = helio(name, d); return toBody(frame(name, d), unit(p.map((v) => -v))); }
