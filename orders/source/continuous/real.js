// The real worlds: the Earth from its measured maps, and the Moon, Mercury, Venus and Mars from theirs; the giants
// to the tops of their clouds. Their sizes, pulls, days, years and tilts are their own; where the Sun is in their sky
// is where it really is (ephem.js), at the real date and time. The Earth's trees are real genera, each where it grows:
// nine of them where range maps say (North America and Europe: Little's atlas, Caudullo et al.), the rest by region and
// climate, each with the names of real species of that region (which species stands where within a region is not
// mapped: it is drawn from that region's list).
import { genome, amps, rng } from './planet.js';
import { earth, body, genAt } from './earth.js';
import { helio, frame, toBody, unit } from './ephem.js';

const { sin, cos, asin, atan2, PI, sqrt, max, min, abs, hypot } = Math;
const lin = (c) => c.map((v) => v ** 2.2);
const hsl = (h, s, l) => { const f = (n) => { const k = (n + h * 12) % 12, a = s * min(l, 1 - l); return l - a * max(-1, min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; };
export const REAL = { earth: 100, moon: 101, mercury: 102, venus: 103, mars: 104, jupiter: 105, saturn: 106, uranus: 107, neptune: 108 };
export const NAMES = { earth: 'Earth', moon: 'the Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune' };
// mean radius (m), surface gravity (g), sidereal day (h), year (days), mean distance from the Sun (m)
const PHYS = {
  earth: [6.371e6, 1, 23.934, 365.256, 1.496e11], moon: [1.7374e6, 0.1654, 655.72, 365.256, 1.496e11], mercury: [2.4394e6, 0.378, 1407.6, 87.969, 5.79e10],
  venus: [6.0518e6, 0.904, -5832.5, 224.701, 1.082e11], mars: [3.3895e6, 0.379, 24.623, 686.98, 2.279e11], jupiter: [6.9911e7, 2.528, 9.925, 4332.59, 7.785e11],
  saturn: [5.8232e7, 1.065, 10.656, 10759.2, 1.432e12], uranus: [2.5362e7, 0.886, -17.24, 30688.5, 2.867e12], neptune: [2.4622e7, 1.137, 16.11, 60182, 4.515e12],
};
// the solar day, in hours, from the sidereal day and the year
const solarH = (sd, yr) => 1 / (1 / sd - 1 / (yr * 24));

// ---- the Earth's trees ---------------------------------------------------------------------------------------------
// regions, by box (the order matters: the first that holds a place is its region)
export function region(la, lo) {
  if (la < -60) return 'ANT';
  if (la >= 18 && la < 23 && lo >= -161 && lo < -154) return 'PAC';
  if (la >= 24 && lo >= -170 && lo < -100 || la >= 50 && lo < -130) return 'NAw';
  if (la >= 24 && lo >= -100 && lo < -50) return 'NAe';
  if (la >= 10 && la < 27 && lo >= -86 && lo < -59) return 'CAR';
  if (la >= 7 && la < 24 && lo >= -118 && lo < -77) return 'MX';
  if (la >= -23 && la < 13 && lo >= -82 && lo < -34) return 'SAt';
  if (la < -23 && lo >= -82 && lo < -34) return 'SAs';
  if (la >= 30 && la < 44.5 && lo >= -10 && lo < 37) return 'MED';
  if (la >= 35 && la < 72 && lo >= -25 && lo < 45) return 'EU';
  if (la >= 12 && la < 37 && lo >= -19 && lo < 60) return 'NAF';
  if (la >= -26 && la < -11.5 && lo >= 43 && lo < 51) return 'MAD';
  if (la >= -23 && la < 12 && lo >= -18 && lo < 52) return 'AFt';
  if (la < -23 && lo >= 10 && lo < 40) return 'AFs';
  if (la >= 50 && lo >= 45) return 'SIB';
  if (la >= 35 && la < 50 && lo >= 45 && lo < 90) return 'CAS';
  if (la >= 30 && la < 46 && lo >= 129.6 && lo < 146) return 'JP';
  if (la >= 5 && la < 37 && lo >= 60 && lo < 92) return 'SAS';
  if (la >= 22 && la < 50 && lo >= 90 && lo < 146) return 'EAS';
  if (la >= -11 && la < 22 && lo >= 92 && lo < 155) return 'SEA';
  if (la >= -45 && la < -10 && lo >= 112 && lo < 155) return 'AU';
  if (la >= -48 && la < -34 && lo >= 165) return 'NZ';
  return 'X';
}
// where the range maps hold (and so where the nine mapped genera are taken from them, not from rules)
const mapped = (r, la, lo) => (r === 'NAe' || r === 'NAw') && la >= 25 && la < 72 || (r === 'EU' || r === 'MED') && la >= 36 && lo >= -11;
const box = (la, lo, a, b, c, d) => la >= a && la < b && lo >= c && lo < d;
// body plans, as in the invented worlds' families
const LOOK = {
  oak: { form: 'broad', spread: 0.55, depth: 4, kids: 3, droop: 0, leaf: [0.09, 0.45, 5], hue: 0.25, sat: 0.55, lit: 0.17, bark: [0.09, 0.075, 0.06], barkRough: 1, decid: 1, fall: 0.08 },
  ever: { form: 'broad', spread: 0.6, depth: 4, kids: 3, droop: 0, leaf: [0.06, 0.4, 0], hue: 0.27, sat: 0.45, lit: 0.13, bark: [0.2, 0.18, 0.15], barkRough: 0.7 },
  beech: { form: 'broad', spread: 0.4, depth: 4, kids: 3, droop: 0.1, leaf: [0.08, 0.55, 0], hue: 0.27, sat: 0.6, lit: 0.2, bark: [0.3, 0.29, 0.27], barkRough: 0.2, decid: 1, fall: 0.07 },
  birch: { form: 'broad', spread: 0.28, depth: 4, kids: 2, droop: 0.35, leaf: [0.05, 0.6, 0], hue: 0.24, sat: 0.6, lit: 0.24, bark: [0.75, 0.73, 0.68], barkRough: 0.4, decid: 1, fall: 0.14 },
  maple: { form: 'broad', spread: 0.5, depth: 4, kids: 3, droop: 0, leaf: [0.1, 0.9, 5], hue: 0.26, sat: 0.6, lit: 0.18, bark: [0.22, 0.2, 0.18], barkRough: 0.6, decid: 1, fall: 0.01 },
  ash: { form: 'broad', spread: 0.45, depth: 4, kids: 3, droop: 0.05, leaf: [0.07, 0.35, 0], hue: 0.26, sat: 0.5, lit: 0.19, bark: [0.3, 0.28, 0.25], barkRough: 0.7, decid: 1, fall: 0.13 },
  willow: { form: 'weep', spread: 0.6, depth: 3, kids: 3, droop: 0.8, leaf: [0.08, 0.18, 0], hue: 0.22, sat: 0.45, lit: 0.24, bark: [0.18, 0.15, 0.12], barkRough: 0.9, decid: 1, fall: 0.15 },
  spruce: { form: 'cone', spread: 0.2, depth: 2, kids: 5, droop: 0.4, leaf: [0.02, 0.06, 0], hue: 0.38, sat: 0.4, lit: 0.1, bark: [0.12, 0.08, 0.06], barkRough: 0.7 },
  fir: { form: 'cone', spread: 0.18, depth: 2, kids: 5, droop: 0.15, leaf: [0.025, 0.08, 0], hue: 0.36, sat: 0.45, lit: 0.11, bark: [0.3, 0.29, 0.28], barkRough: 0.3 },
  pine: { form: 'umbrella', spread: 0.5, depth: 3, kids: 3, droop: 0, leaf: [0.06, 0.05, 0], hue: 0.3, sat: 0.4, lit: 0.13, bark: [0.3, 0.15, 0.08], barkRough: 1 },
  larch: { form: 'cone', spread: 0.25, depth: 2, kids: 4, droop: 0.2, leaf: [0.025, 0.06, 0], hue: 0.25, sat: 0.55, lit: 0.22, bark: [0.3, 0.17, 0.1], barkRough: 0.8, decid: 1, fall: 0.13 },
  bigcone: { form: 'cone', spread: 0.22, depth: 2, kids: 5, droop: 0.25, leaf: [0.022, 0.07, 0], hue: 0.35, sat: 0.4, lit: 0.1, bark: [0.35, 0.18, 0.1], barkRough: 1 },
  spire: { form: 'spire', spread: 0.15, depth: 2, kids: 3, droop: 0, leaf: [0.02, 0.07, 0], hue: 0.33, sat: 0.4, lit: 0.11, bark: [0.35, 0.2, 0.12], barkRough: 0.9 },
  palm: { form: 'palm', spread: 0, depth: 1, kids: 14, droop: 0.6, leaf: [1.0, 0.12, 0], hue: 0.25, sat: 0.55, lit: 0.18, bark: [0.35, 0.3, 0.22], barkRough: 0.5 },
  fan: { form: 'palm', spread: 0, depth: 1, kids: 18, droop: 0.2, leaf: [0.6, 0.3, 0], hue: 0.24, sat: 0.45, lit: 0.18, bark: [0.3, 0.26, 0.2], barkRough: 0.6 },
  thorn: { form: 'umbrella', spread: 0.9, depth: 4, kids: 2, droop: 0, leaf: [0.04, 0.5, 0], hue: 0.22, sat: 0.4, lit: 0.17, bark: [0.2, 0.15, 0.1], barkRough: 0.8 },
  column: { form: 'column', spread: 0.3, depth: 1, kids: 3, droop: 0, leaf: [0.05, 0.3, 0], hue: 0.3, sat: 0.35, lit: 0.2, bark: [0.18, 0.32, 0.15], barkRough: 0.2 },
  fig: { form: 'broad', spread: 0.7, depth: 4, kids: 3, droop: 0, leaf: [0.16, 0.4, 0], hue: 0.3, sat: 0.6, lit: 0.13, bark: [0.35, 0.32, 0.26], barkRough: 0.3 },
  emergent: { form: 'umbrella', spread: 0.7, depth: 4, kids: 3, droop: 0, leaf: [0.12, 0.45, 0], hue: 0.29, sat: 0.55, lit: 0.13, bark: [0.4, 0.37, 0.32], barkRough: 0.3 },
  gum: { form: 'broad', spread: 0.5, depth: 4, kids: 2, droop: 0.3, leaf: [0.14, 0.18, 0], hue: 0.3, sat: 0.25, lit: 0.18, bark: [0.62, 0.58, 0.52], barkRough: 0.25 },
  bao: { form: 'umbrella', spread: 0.8, depth: 3, kids: 3, droop: 0, leaf: [0.1, 0.6, 0], hue: 0.25, sat: 0.45, lit: 0.17, bark: [0.45, 0.4, 0.35], barkRough: 0.3, decid: 1, fall: 0.12, fat: 4 },
  mangrove: { form: 'broad', spread: 0.7, depth: 3, kids: 3, droop: 0.2, leaf: [0.1, 0.45, 0], hue: 0.28, sat: 0.5, lit: 0.13, bark: [0.3, 0.26, 0.2], barkRough: 0.5 },
  dragon: { form: 'umbrella', spread: 0.6, depth: 3, kids: 4, droop: 0, leaf: [0.5, 0.06, 0], hue: 0.3, sat: 0.35, lit: 0.16, bark: [0.5, 0.48, 0.43], barkRough: 0.2, fat: 1.8 },
};
// a family: [common name, genus, body plan, mean yearly warmth and its spread (C), wetness and its spread, height (m),
// regions with their species, and (optional) a test of the place: (lat, lon, height above the sea, warmth, wetness)]
const F = (name, genus, look, T, W, h, R, ok, over) => ({ name, genus, ...LOOK[look], ...(over || {}), T, W, h, R, ok });
const FLORA = [
  F('oak', 'Quercus', 'oak', [12, 8], [0.6, 0.3], 22, { NAe: ['alba', 'rubra', 'velutina', 'coccinea', 'montana', 'macrocarpa', 'palustris', 'stellata', 'nigra', 'phellos', 'virginiana'], NAw: ['garryana', 'kelloggii', 'agrifolia', 'lobata', 'chrysolepis', 'douglasii', 'gambelii'], MX: ['rugosa', 'laurina', 'crassifolia', 'candicans', 'castanea'], EU: ['robur', 'petraea', 'pubescens', 'cerris', 'pyrenaica', 'frainetto'], MED: ['ilex', 'suber', 'coccifera', 'faginea', 'pubescens', 'cerris'], EAS: ['mongolica', 'acutissima', 'variabilis', 'aliena', 'dentata'], JP: ['crispula', 'serrata', 'acuta', 'glauca', 'dentata'], SAS: ['semecarpifolia', 'leucotrichophora', 'floribunda'], CAS: ['macranthera', 'castaneifolia'], NAF: ['ilex', 'suber', 'canariensis'] }, (la, lo, h, T) => T < 24),
  F('beech', 'Fagus', 'beech', [8, 5], [0.75, 0.22], 28, { NAe: ['grandifolia'], EU: ['sylvatica', 'orientalis'], MED: ['sylvatica', 'orientalis'], JP: ['crenata', 'japonica'], EAS: ['engleriana', 'longipetiolata', 'lucida'], CAS: ['orientalis'] }, (la, lo, h, T) => T > 2 && T < 17),
  F('birch', 'Betula', 'birch', [2, 8], [0.55, 0.3], 18, { NAe: ['papyrifera', 'alleghaniensis', 'lenta', 'populifolia', 'nigra'], NAw: ['papyrifera', 'occidentalis', 'neoalaskana', 'kenaica'], EU: ['pendula', 'pubescens'], MED: ['pendula'], SIB: ['pendula', 'pubescens', 'platyphylla', 'dahurica', 'ermanii'], EAS: ['platyphylla', 'ermanii', 'costata', 'albosinensis'], JP: ['ermanii', 'maximowicziana', 'platyphylla'], SAS: ['utilis'], CAS: ['pendula', 'tianschanica'] }, (la, lo, h, T) => T < 13),
  F('maple', 'Acer', 'maple', [9, 6], [0.65, 0.25], 20, { NAe: ['saccharum', 'rubrum', 'saccharinum', 'negundo', 'nigrum', 'pensylvanicum'], NAw: ['macrophyllum', 'circinatum', 'glabrum', 'grandidentatum'], EU: ['pseudoplatanus', 'platanoides', 'campestre', 'opalus'], MED: ['monspessulanum', 'opalus', 'campestre'], EAS: ['mono', 'truncatum', 'davidii', 'palmatum'], JP: ['palmatum', 'japonicum', 'mono', 'rufinerve'], CAS: ['turkestanicum', 'cappadocicum'], SAS: ['caesium', 'campbellii'] }, (la, lo, h, T) => T < 19),
  F('willow', 'Salix', 'willow', [6, 9], [0.75, 0.25], 14, { NAe: ['nigra', 'amygdaloides', 'lucida', 'bebbiana'], NAw: ['lasiandra', 'scouleriana', 'exigua', 'bebbiana'], EU: ['alba', 'fragilis', 'caprea', 'cinerea'], MED: ['alba', 'purpurea', 'eleagnos'], SIB: ['schwerinii', 'udensis', 'caprea'], EAS: ['babylonica', 'matsudana'], JP: ['babylonica', 'integra'], CAS: ['alba', 'songarica'] }, (la, lo, h, T) => T < 20),
  F('spruce', 'Picea', 'spruce', [-1, 7], [0.6, 0.3], 30, { NAe: ['glauca', 'mariana', 'rubens'], NAw: ['sitchensis', 'engelmannii', 'glauca', 'mariana', 'pungens'], EU: ['abies', 'omorika', 'orientalis'], SIB: ['obovata', 'ajanensis'], EAS: ['asperata', 'jezoensis', 'koraiensis', 'likiangensis'], JP: ['jezoensis', 'glehnii'], SAS: ['smithiana', 'spinulosa'], CAS: ['schrenkiana'] }, (la, lo, h, T) => T < 9),
  F('pine', 'Pinus', 'pine', [9, 11], [0.45, 0.3], 26, { NAe: ['strobus', 'resinosa', 'banksiana', 'taeda', 'palustris', 'echinata', 'elliottii', 'rigida', 'virginiana'], NAw: ['ponderosa', 'contorta', 'lambertiana', 'monticola', 'edulis', 'jeffreyi', 'albicaulis', 'flexilis', 'longaeva'], MX: ['hartwegii', 'montezumae', 'pseudostrobus', 'oocarpa', 'cembroides'], CAR: ['caribaea', 'occidentalis', 'cubensis'], EU: ['sylvestris', 'nigra', 'cembra', 'mugo'], MED: ['halepensis', 'pinea', 'pinaster', 'brutia', 'nigra'], SIB: ['sylvestris', 'sibirica', 'pumila'], EAS: ['tabuliformis', 'massoniana', 'koraiensis', 'armandii', 'yunnanensis'], JP: ['densiflora', 'thunbergii', 'parviflora'], SAS: ['roxburghii', 'wallichiana', 'gerardiana'], SEA: ['kesiya', 'merkusii'], CAS: ['sylvestris'], NAF: ['canariensis', 'halepensis'] }, (la, lo, h, T, W) => T < 24 || W < 0.5),
  F('fir', 'Abies', 'fir', [3, 7], [0.65, 0.25], 30, { NAe: ['balsamea', 'fraseri'], NAw: ['lasiocarpa', 'grandis', 'amabilis', 'concolor', 'procera', 'magnifica'], MX: ['religiosa', 'guatemalensis'], EU: ['alba', 'nordmanniana', 'borisii-regis'], MED: ['cephalonica', 'pinsapo', 'alba', 'cilicica'], SIB: ['sibirica', 'nephrolepis'], EAS: ['fabri', 'faxoniana', 'holophylla', 'georgei'], JP: ['sachalinensis', 'veitchii', 'firma', 'mariesii'], SAS: ['spectabilis', 'pindrow', 'densa'], CAS: ['sibirica', 'semenovii'], NAF: ['pinsapo', 'numidica'] }, (la, lo, h, T) => T < 14),
  F('larch', 'Larix', 'larch', [-4, 8], [0.5, 0.3], 26, { NAe: ['laricina'], NAw: ['occidentalis', 'lyallii', 'laricina'], EU: ['decidua'], SIB: ['sibirica', 'gmelinii', 'cajanderi'], EAS: ['olgensis', 'principis-rupprechtii', 'potaninii'], JP: ['kaempferi'], SAS: ['griffithii'] }, (la, lo, h, T) => T < 8),
  F('lime', 'Tilia', 'beech', [9, 5], [0.65, 0.22], 25, { NAe: ['americana'], EU: ['cordata', 'platyphyllos', 'tomentosa'], MED: ['tomentosa', 'platyphyllos'], EAS: ['amurensis', 'mongolica', 'tuan'], JP: ['japonica', 'maximowicziana'], SIB: ['amurensis', 'cordata'] }, (la, lo, h, T) => T > 0 && T < 17, { leaf: [0.08, 0.85, 0], fall: 0.14 }),
  F('aspen and poplar', 'Populus', 'birch', [3, 9], [0.55, 0.3], 24, { NAe: ['tremuloides', 'deltoides', 'balsamifera', 'grandidentata'], NAw: ['tremuloides', 'trichocarpa', 'balsamifera', 'fremontii'], EU: ['tremula', 'nigra', 'alba'], MED: ['alba', 'nigra'], SIB: ['tremula', 'suaveolens', 'laurifolia'], CAS: ['euphratica', 'tremula'], EAS: ['davidiana', 'simonii'], JP: ['maximowiczii', 'sieboldii'], NAF: ['euphratica'] }, (la, lo, h, T) => T < 15, { bark: [0.62, 0.62, 0.55], leaf: [0.06, 0.8, 0], fall: 0.15 }),
  F('ash', 'Fraxinus', 'ash', [10, 6], [0.62, 0.25], 25, { NAe: ['americana', 'pennsylvanica', 'nigra'], NAw: ['latifolia', 'velutina'], EU: ['excelsior', 'angustifolia'], MED: ['ornus', 'angustifolia'], EAS: ['mandshurica', 'chinensis'], JP: ['mandshurica', 'lanuginosa'] }, (la, lo, h, T) => T > 2 && T < 19),
  F('hickory', 'Carya', 'ash', [14, 5], [0.65, 0.2], 26, { NAe: ['ovata', 'glabra', 'tomentosa', 'cordiformis', 'illinoinensis'], EAS: ['cathayensis'] }, (la, lo, h, T) => T > 6 && T < 21, { bark: [0.3, 0.28, 0.25], barkRough: 1, fall: 0.12 }),
  F('tulip tree', 'Liriodendron', 'beech', [14, 4], [0.75, 0.18], 35, { NAe: ['tulipifera'], EAS: ['chinense'] }, (la, lo, h, T) => T > 8 && T < 20, { leaf: [0.12, 0.95, 4], fall: 0.13 }),
  F('chestnut', 'Castanea', 'oak', [12, 4], [0.65, 0.2], 25, { NAe: ['pumila', 'dentata'], EU: ['sativa'], MED: ['sativa'], EAS: ['mollissima', 'henryi'], JP: ['crenata'] }, (la, lo, h, T) => T > 7 && T < 18, { leaf: [0.16, 0.3, 0], fall: 0.12 }),
  F('plane', 'Platanus', 'maple', [15, 5], [0.6, 0.25], 30, { NAe: ['occidentalis'], NAw: ['racemosa', 'wrightii'], MED: ['orientalis'], MX: ['mexicana'] }, (la, lo, h, T) => T > 8, { bark: [0.6, 0.58, 0.5], barkRough: 0.2 }),
  F('Douglas fir', 'Pseudotsuga', 'bigcone', [8, 5], [0.6, 0.3], 60, { NAw: ['menziesii'], MX: ['menziesii'], EAS: ['sinensis', 'forrestii'], JP: ['japonica'] }, (la, lo, h, T) => T < 15),
  F('hemlock', 'Tsuga', 'fir', [6, 5], [0.8, 0.2], 40, { NAe: ['canadensis', 'caroliniana'], NAw: ['heterophylla', 'mertensiana'], JP: ['sieboldii', 'diversifolia'], EAS: ['chinensis', 'forrestii'], SAS: ['dumosa'] }, (la, lo, h, T) => T < 15, { droop: 0.5 }),
  F('arborvitae', 'Thuja', 'spire', [6, 6], [0.8, 0.2], 40, { NAe: ['occidentalis'], NAw: ['plicata'], JP: ['standishii'], EAS: ['koraiensis'] }, (la, lo, h, T) => T < 13),
  F('redwood', 'Sequoia', 'spire', [12, 3], [0.8, 0.2], 85, { NAw: ['sempervirens'] }, (la, lo) => box(la, lo, 35.7, 42.2, -124.5, -122.8)),
  F('giant sequoia', 'Sequoiadendron', 'bigcone', [9, 4], [0.55, 0.3], 80, { NAw: ['giganteum'] }, (la, lo, h) => box(la, lo, 35.8, 39.3, -120.8, -118.5) && h > 1300 && h < 2400, { bark: [0.45, 0.2, 0.1] }),
  F('juniper', 'Juniperus', 'spruce', [10, 9], [0.3, 0.2], 9, { NAe: ['virginiana'], NAw: ['osteosperma', 'occidentalis', 'scopulorum', 'monosperma'], MX: ['deppeana', 'flaccida'], EU: ['communis', 'thurifera'], MED: ['oxycedrus', 'phoenicea', 'thurifera'], CAS: ['excelsa', 'seravschanica', 'semiglobosa'], SAS: ['excelsa', 'indica'], EAS: ['tibetica', 'przewalskii'], NAF: ['phoenicea', 'thurifera', 'procera'], AFt: ['procera'] }, (la, lo, h, T, W) => T < 22 && !((la > -23 && la < 12 && lo > -18 && lo < 52) && h < 1800), { hue: 0.34, lit: 0.12 }),
  F('cypress', 'Cupressus', 'spire', [15, 5], [0.4, 0.25], 25, { MED: ['sempervirens', 'atlantica'], NAw: ['macrocarpa', 'arizonica'], MX: ['lusitanica'], SAS: ['torulosa'], EAS: ['funebris', 'duclouxiana'], NAF: ['dupreziana', 'atlantica'] }, (la, lo, h, T) => T > 8),
  F('cedar', 'Cedrus', 'pine', [10, 5], [0.45, 0.25], 35, { MED: ['libani', 'brevifolia'], NAF: ['atlantica'], SAS: ['deodara'] }, (la, lo, h) => (box(la, lo, 31, 36.5, -8, 1) || box(la, lo, 33, 38.5, 28, 37.5) || box(la, lo, 29.5, 36.5, 66, 80)) && h > 900 && h < 3000, { spread: 0.8, hue: 0.4, sat: 0.3 }),
  F('olive', 'Olea', 'ever', [16, 4], [0.38, 0.2], 9, { MED: ['europaea'], NAF: ['europaea'], AFt: ['europaea', 'capensis'], AFs: ['europaea', 'capensis'] }, (la, lo, h, T) => T > 12 && T < 24 && !((la > -23 && la < 12 && lo > -18 && lo < 52) && h < 1400), { hue: 0.24, sat: 0.2, lit: 0.22, leaf: [0.06, 0.15, 0] }),
  F('Japanese cedar', 'Cryptomeria', 'spire', [13, 4], [0.85, 0.15], 50, { JP: ['japonica'], EAS: ['japonica'] }, (la, lo, h, T) => T > 6 && (lo > 129.6 || la < 31)),
  F('eucalyptus', 'Eucalyptus', 'gum', [17, 7], [0.5, 0.3], 40, { AU: ['regnans', 'obliqua', 'camaldulensis', 'globulus', 'marginata', 'diversicolor', 'pauciflora', 'viminalis', 'tereticornis', 'populnea', 'miniata', 'tetrodonta', 'melliodora', 'saligna', 'delegatensis', 'coolabah', 'diversifolia'], SEA: ['deglupta', 'urophylla'] }, (la, lo, h, T, W) => true),
  F('wattle', 'Acacia', 'thorn', [21, 6], [0.3, 0.18], 8, { AU: ['aneura', 'harpophylla', 'pycnantha', 'melanoxylon', 'dealbata', 'cambagei', 'estrophiolata', 'shirleyi'] }, null, { hue: 0.27, sat: 0.3 }),
  F('African acacia', 'Vachellia', 'thorn', [24, 5], [0.32, 0.16], 10, { AFt: ['tortilis', 'xanthophloea', 'drepanolobium', 'seyal', 'sieberiana', 'gerrardii'], AFs: ['erioloba', 'karroo', 'tortilis', 'haematoxylon'], NAF: ['tortilis', 'raddiana', 'nilotica', 'seyal'], SAS: ['nilotica', 'leucophloea'], MAD: ['farnesiana'] }, (la, lo, h, T) => T > 16),
  F('baobab', 'Adansonia', 'bao', [26, 3], [0.38, 0.14], 18, { AFt: ['digitata'], AFs: ['digitata'], MAD: ['grandidieri', 'za', 'rubrostipa', 'madagascariensis'], AU: ['gregorii'] }, (la, lo, h, T) => T > 21 && (lo < 112 || box(la, lo, -19.5, -14, 121, 130.5))),
  F('miombo', 'Brachystegia', 'emergent', [22, 3], [0.52, 0.15], 16, { AFt: ['spiciformis', 'boehmii', 'longifolia', 'floribunda'] }, (la) => la < -3, { decid: 1, fall: 0.03, hue: 0.22 }),
  F('mopane', 'Colophospermum', 'ever', [23, 3], [0.3, 0.12], 10, { AFs: ['mopane'], AFt: ['mopane'] }, (la, lo) => box(la, lo, -25, -13, 12, 35), { decid: 1, fall: 0.06 }),
  F('candelabra tree', 'Euphorbia', 'column', [22, 6], [0.25, 0.14], 9, { AFt: ['ingens', 'candelabrum', 'tirucalli'], AFs: ['ingens', 'cooperi'], NAF: ['canariensis', 'abyssinica'], MAD: ['stenoclada'] }, (la, lo, h, T) => T > 14, { kids: 7 }),
  F('quiver tree', 'Aloidendron', 'dragon', [19, 4], [0.15, 0.1], 6, { AFs: ['dichotomum', 'pillansii'] }, (la, lo) => box(la, lo, -32.5, -20, 14, 22)),
  F('dragon tree', 'Dracaena', 'dragon', [19, 4], [0.3, 0.2], 10, { NAF: ['draco', 'cinnabari', 'ombet'] }, (la, lo) => box(la, lo, 27.5, 29.5, -18.5, -13.3) || box(la, lo, 12, 13, 53, 54.6) || box(la, lo, 14, 22, 36, 44)),
  F('kapok', 'Ceiba', 'emergent', [26, 3], [0.8, 0.2], 55, { SAt: ['pentandra', 'speciosa', 'samauma'], MX: ['pentandra', 'aesculifolia'], CAR: ['pentandra'], AFt: ['pentandra'] }, (la, lo, h, T) => T > 21 && (lo < -30 || la > -5)),
  F('mahogany', 'Swietenia', 'ever', [25, 3], [0.7, 0.2], 40, { SAt: ['macrophylla'], MX: ['macrophylla', 'humilis'], CAR: ['mahagoni'] }, (la, lo, h, T) => T > 20),
  F('rubber tree', 'Hevea', 'ever', [26, 2], [0.9, 0.12], 30, { SAt: ['brasiliensis', 'guianensis', 'spruceana'] }, (la, lo) => box(la, lo, -15, 8, -80, -45)),
  F('Brazil nut', 'Bertholletia', 'emergent', [26, 2], [0.9, 0.12], 50, { SAt: ['excelsa'] }, (la, lo) => box(la, lo, -15, 8, -75, -47)),
  F('trumpet tree', 'Cecropia', 'emergent', [25, 3], [0.85, 0.15], 15, { SAt: ['peltata', 'obtusifolia', 'pachystachya', 'sciadophylla'], MX: ['obtusifolia', 'peltata'], CAR: ['schreberiana', 'peltata'] }, (la, lo, h, T) => T > 18, { leaf: [0.3, 0.9, 8], hue: 0.24, lit: 0.22, bark: [0.6, 0.58, 0.52] }),
  F('fig', 'Ficus', 'fig', [25, 4], [0.8, 0.2], 32, { SAt: ['insipida', 'maxima'], MX: ['aurea', 'cotinifolia'], CAR: ['aurea', 'citrifolia'], AFt: ['sycomorus', 'thonningii', 'natalensis'], AFs: ['sycomorus'], SAS: ['benghalensis', 'religiosa', 'racemosa'], SEA: ['benjamina', 'elastica', 'microcarpa'], AU: ['macrophylla', 'watkinsiana'], EAS: ['microcarpa'], PAC: ['microcarpa'], NAF: ['sycomorus'] }, (la, lo, h, T) => T > 18),
  F('dipterocarp', 'Dipterocarpus', 'emergent', [26, 2], [0.85, 0.15], 55, { SEA: ['alatus', 'costatus', 'grandiflorus', 'retusus', 'turbinatus'], SAS: ['indicus', 'turbinatus'] }, (la, lo, h, T) => T > 21),
  F('meranti and sal', 'Shorea', 'emergent', [26, 3], [0.85, 0.18], 60, { SEA: ['leprosula', 'parvifolia', 'curtisii', 'macrophylla', 'faguetiana', 'siamensis'], SAS: ['robusta'] }, (la, lo, h, T) => T > 20, { h: 60 }),
  F('teak', 'Tectona', 'ever', [26, 3], [0.6, 0.18], 35, { SAS: ['grandis'], SEA: ['grandis'] }, (la, lo) => la > 8, { decid: 1, fall: 0.08, leaf: [0.4, 0.7, 0] }),
  F('coconut palm', 'Cocos', 'palm', [26, 3], [0.7, 0.3], 22, { CAR: ['nucifera'], MX: ['nucifera'], SAt: ['nucifera'], AFt: ['nucifera'], MAD: ['nucifera'], SAS: ['nucifera'], SEA: ['nucifera'], AU: ['nucifera'], PAC: ['nucifera'], NAe: ['nucifera'] }, (la, lo, h, T) => h < 20 && T > 22),
  F('date palm', 'Phoenix', 'palm', [22, 5], [0.2, 0.15], 18, { NAF: ['dactylifera', 'canariensis', 'atlantica'], MED: ['theophrasti', 'canariensis'], SAS: ['sylvestris'], AFt: ['reclinata'], AFs: ['reclinata'] }, (la, lo, h, T) => T > 16, { droop: 0.4 }),
  F('oil palm', 'Elaeis', 'palm', [26, 2], [0.8, 0.15], 18, { AFt: ['guineensis'], SAt: ['oleifera'] }, (la, lo) => lo < 32 && la > -10),
  F('açaí', 'Euterpe', 'palm', [26, 2], [0.9, 0.12], 20, { SAt: ['oleracea', 'precatoria', 'edulis'], CAR: ['broadwayi'] }, null, { kids: 10, droop: 0.8 }),
  F('moriche palm', 'Mauritia', 'fan', [26, 2], [0.9, 0.12], 30, { SAt: ['flexuosa'] }, (la, lo, h) => h < 400),
  F('palmetto', 'Sabal', 'fan', [21, 3], [0.75, 0.2], 15, { NAe: ['palmetto', 'minor'], MX: ['mexicana', 'yapa'], CAR: ['causiarum', 'domingensis'] }, (la, lo, h, T) => T > 16),
  F('fan palm', 'Washingtonia', 'fan', [21, 3], [0.2, 0.12], 20, { NAw: ['filifera'], MX: ['robusta'] }, (la, lo) => box(la, lo, 22, 35, -118, -109)),
  F('cabbage palm', 'Livistona', 'fan', [23, 4], [0.6, 0.25], 20, { AU: ['australis', 'mariae', 'rigida', 'decora'], SEA: ['rotundifolia', 'saribus'], EAS: ['chinensis'], JP: ['chinensis'] }, (la, lo, h, T) => T > 15),
  F('palmyra palm', 'Borassus', 'fan', [27, 2], [0.45, 0.2], 25, { SAS: ['flabellifer'], SEA: ['flabellifer'], AFt: ['aethiopum'], MAD: ['madagascariensis'] }, null),
  F('saguaro', 'Carnegiea', 'column', [20, 4], [0.15, 0.1], 12, { NAw: ['gigantea'], MX: ['gigantea'] }, (la, lo, h) => box(la, lo, 27, 34.9, -115, -110) && h < 1300, { kids: 3 }),
  F('cardón', 'Pachycereus', 'column', [22, 4], [0.18, 0.12], 12, { MX: ['pringlei', 'weberi', 'grandis'], NAw: ['pringlei'] }, (la, lo) => la < 31, { kids: 6 }),
  F('cactus', 'Echinopsis', 'column', [12, 7], [0.18, 0.12], 7, { SAs: ['atacamensis', 'terscheckii', 'chiloensis'], SAt: ['atacamensis', 'tarijensis'] }, (la, lo) => lo < -62),
  F('cactus', 'Cereus', 'column', [24, 4], [0.28, 0.14], 8, { SAt: ['jamacaru', 'hildmannianus'], SAs: ['forbesii', 'hildmannianus'], CAR: ['repandus', 'hexagonus'] }, (la, lo) => lo > -66 || la > 9),
  F('southern beech', 'Nothofagus', 'beech', [7, 5], [0.75, 0.22], 30, { SAs: ['pumilio', 'antarctica', 'dombeyi', 'obliqua', 'alpina', 'betuloides'], NZ: ['fusca', 'menziesii', 'solandri', 'truncata'], AU: ['cunninghamii', 'gunnii'], SEA: ['grandis', 'pullei'] }, (la, lo, h, T) => la < -34 ? (lo < -60 || lo > 140) && (lo > 0 || la < -35) && (lo < 140 || la < -37) : la > -11 && la < 0 && lo > 130 && T < 18, { decid: 0 }),
  F('monkey puzzle', 'Araucaria', 'pine', [14, 5], [0.7, 0.25], 40, { SAs: ['araucana', 'angustifolia'], SAt: ['angustifolia'], AU: ['bidwillii', 'cunninghamii'], PAC: ['columnaris'], SEA: ['hunsteinii', 'cunninghamii'] }, (la, lo) => box(la, lo, -40.5, -36.5, -73, -70) || box(la, lo, -30, -19, -56, -45) || box(la, lo, -29, -16, 145, 154) || box(la, lo, -10, 0, 140, 151) || box(la, lo, -23, -19, 163, 168), { spread: 0.75, hue: 0.33 }),
  F('kauri', 'Agathis', 'ever', [18, 4], [0.8, 0.2], 50, { NZ: ['australis'], AU: ['robusta', 'microstachya'], SEA: ['dammara', 'borneensis', 'labillardierei'] }, (la, lo) => lo > 160 ? la > -38.5 : la > -28, { bark: [0.5, 0.45, 0.4], barkRough: 0.15 }),
  F('podocarp', 'Podocarpus', 'spruce', [15, 5], [0.7, 0.2], 30, { AFt: ['latifolia', 'milanjianus'], AFs: ['latifolius', 'henkelii', 'falcatus'], NZ: ['totara', 'cunninghamii'], SAt: ['oleifolius', 'parlatorei'], SAs: ['salignus', 'parlatorei'], AU: ['elatus'], SEA: ['neriifolius', 'macrophyllus'], EAS: ['macrophyllus'], JP: ['macrophyllus'] }, (la, lo, h, T) => (T < 22 || h > 1200) && !((la > -23 && la < 12 && lo > -18 && lo < 52) && h < 1700), { leaf: [0.08, 0.14, 0], hue: 0.3 }),
  F('rātā and pōhutukawa', 'Metrosideros', 'ever', [13, 4], [0.75, 0.2], 20, { NZ: ['excelsa', 'robusta', 'umbellata'], PAC: ['polymorpha'] }, null),
  F('mangrove', 'Rhizophora', 'mangrove', [26, 2], [0.7, 0.3], 10, { CAR: ['mangle'], MX: ['mangle'], SAt: ['mangle', 'racemosa'], AFt: ['mangle', 'mucronata', 'racemosa'], MAD: ['mucronata'], SAS: ['mucronata', 'apiculata'], SEA: ['apiculata', 'mucronata', 'stylosa'], AU: ['stylosa'], NAe: ['mangle'], NAF: ['mucronata'], PAC: ['mangle'] }, (la, lo, h, T) => h < 4 && T > 21),
  F('mesquite', 'Prosopis', 'thorn', [19, 6], [0.22, 0.12], 8, { NAw: ['glandulosa', 'velutina'], MX: ['laevigata', 'glandulosa'], SAs: ['flexuosa', 'chilensis', 'alba'], SAt: ['pallida', 'juliflora'], SAS: ['cineraria'], NAF: ['africana', 'cineraria'], AFt: ['africana'] }, (la, lo, h, T) => T > 10),
];
// each family's species names, region by region, and its whole list (in the order the regions come)
// roughly when each genus first appears in the fossil record (millions of years; for deep time)
const ORIGIN = { Quercus: 56, Fagus: 50, Betula: 70, Acer: 60, Salix: 65, Picea: 140, Pinus: 150, Abies: 90, Larix: 50, Tilia: 60, Populus: 60, Fraxinus: 50, Carya: 60, Liriodendron: 90, Castanea: 50, Platanus: 100, Pseudotsuga: 30, Tsuga: 60, Thuja: 60, Sequoia: 150, Sequoiadendron: 100, Juniperus: 50, Cupressus: 60, Cedrus: 60, Olea: 30, Cryptomeria: 50, Eucalyptus: 52, Acacia: 25, Vachellia: 25, Adansonia: 20, Brachystegia: 30, Colophospermum: 20, Euphorbia: 20, Aloidendron: 10, Dracaena: 30, Ceiba: 40, Swietenia: 30, Hevea: 30, Bertholletia: 20, Cecropia: 30, Ficus: 80, Dipterocarpus: 40, Shorea: 40, Tectona: 30, Cocos: 55, Phoenix: 60, Elaeis: 30, Euterpe: 30, Mauritia: 65, Sabal: 80, Washingtonia: 20, Livistona: 40, Borassus: 40, Carnegiea: 5, Pachycereus: 5, Echinopsis: 10, Cereus: 10, Nothofagus: 85, Araucaria: 230, Agathis: 120, Podocarpus: 160, Metrosideros: 40, Rhizophora: 50, Prosopis: 30 };
const PR = FLORA.map((f) => { f.o = ORIGIN[f.genus] ?? 50; const idx = {}; const all = []; for (const [r, l] of Object.entries(f.R)) { idx[r] = [all.length, l.length]; for (const n of l) all.push(f.genus + ' ' + n); } f.names = all; f.idx = idx; f.nSp = all.length; return f; });
const MAPPED = ['Quercus', 'Fagus', 'Picea', 'Pinus', 'Betula', 'Abies', 'Larix', 'Acer', 'Tilia'];
// which families may grow at a place (true/false each), and which region's names they take there
export function present(G, u, h, T, W) {
  const la = asin(max(-1, min(1, u[2]))) * 180 / PI, lo = atan2(u[1], u[0]) * 180 / PI, r = region(la, lo), mp = mapped(r, la, lo), bits = mp ? genAt(G.dat, u) : 0;
  return { r, ok: G.species.map((f) => { if (G.maskless || !f.R) return true; const mi = MAPPED.indexOf(f.genus); if (mp && mi >= 0) return (bits >> mi & 1) === 1; if (!f.R[r]) return false; return !f.ok || f.ok(la, lo, h, T, W); }) };
}

// ---- the worlds --------------------------------------------------------------------------------------------------
const worlds = {};
export function realWorld(name) {
  if (worlds[name]) return worlds[name];
  const n = REAL[name], [R, g, sd, yr, dist] = PHYS[name], G = genome(name === 'earth' ? 0 : n);
  Object.assign(G, { n, id: 'R' + name, real: name, name: NAMES[name], kseed: n * 41, E: 0, spc: new Map(), mouths: [], dayH: abs(solarH(sd, yr)), yearD: yr, sunSize: 6.957e8 / dist, starK: 5772, moons: [], rings: 0 });
  G.sunCol = genome(0).sunCol; G.siderealH = sd;
  const fr = frame(name, 0); G.tilt = Math.acos(max(-1, min(1, toBody(fr, unit(eclN))[2]))); if (G.tilt > PI / 2) G.tilt = PI - G.tilt;
  if (name === 'earth') {
    const D = earth(); G.dat = D; G.kdat = 8; G.R = R; G.g = 1; G.relief = 1; G.base = 0; G.cities = true; G.seaFrac = 0.71;
    G.species = PR.map((f) => ({ ...f, canopy: lin(hsl(f.hue, f.sat, f.lit)) }));
    G.amp = amps(G); G.present = present;
    return (worlds[name] = G);
  }
  G.cities = false; G.species = []; G.fauna = { none: 1 }; G.birds = false; G.whales = false; G.lifeless = true; G.ground = 'bare'; G.seaFrac = 0; G.wet = -1;
  G.g = g; G.ridge = 1; G.lapse = 0;
  const rgb = (h, s, l) => lin(hsl(h, s, l));
  const noAir = () => { G.air = 0.002; G.beta = [5.8e-9, 13.5e-9, 33.1e-9]; G.cloud = 0; G.Hs = 8000; };
  if (name === 'moon') { noAir(); G.soil = rgb(0.1, 0.02, 0.36); G.rock = rgb(0.1, 0.015, 0.24); G.sand = rgb(0.1, 0.02, 0.46); G.Teq = -20; G.Tgrad = 0; G.snowOff = 1e3; }
  else if (name === 'mercury') { noAir(); G.soil = rgb(0.08, 0.08, 0.3); G.rock = rgb(0.07, 0.06, 0.23); G.sand = rgb(0.09, 0.1, 0.36); G.Teq = 170; G.Tgrad = 0; G.snowOff = 1e3; }
  else if (name === 'mars') { G.air = 0.35; G.beta = [24e-6, 13e-6, 6.5e-6].map((v) => v * 0.35); G.Hs = 11100; G.cloud = 0.04; G.soil = rgb(0.045, 0.5, 0.32); G.rock = rgb(0.04, 0.35, 0.22); G.sand = rgb(0.06, 0.55, 0.4); G.Teq = -20; G.Tgrad = 30; G.snowOff = 45; G.cloudBase = 8000; G.cloudTop = 15000; }
  else if (name === 'venus') { G.air = 6; G.beta = [9e-6, 6.5e-6, 2.6e-6].map((v) => v * 6); G.Hs = 15900; G.cloud = 1; G.cloudBase = 48000; G.cloudTop = 70000; G.soil = rgb(0.08, 0.25, 0.22); G.rock = rgb(0.07, 0.15, 0.17); G.sand = rgb(0.09, 0.3, 0.28); G.Teq = 464; G.Tgrad = 0; G.snowOff = 1e3; }
  else {                                                                     // the giants: the tops of their clouds, banded
    G.giant = true; G.air = 1.6; G.Hs = { jupiter: 27000, saturn: 59500, uranus: 27700, neptune: 19700 }[name]; G.cloud = 0.6; G.cloudBase = 2000; G.cloudTop = 9000; G.Teq = -120; G.Tgrad = 0; G.snowOff = 1e3;
    const B = { jupiter: [[0.86, 0.79, 0.64], [0.6, 0.42, 0.28], [24e-6, 22e-6, 18e-6]], saturn: [[0.86, 0.79, 0.58], [0.74, 0.64, 0.44], [22e-6, 20e-6, 14e-6]], uranus: [[0.62, 0.84, 0.87], [0.56, 0.78, 0.83], [6e-6, 16e-6, 22e-6]], neptune: [[0.33, 0.48, 0.86], [0.26, 0.38, 0.78], [5e-6, 12e-6, 30e-6]] }[name];
    G.bands = B.slice(0, 2).map(lin); G.beta = B[2]; G.soil = G.bands[0]; G.rock = G.bands[1]; G.sand = G.bands[0];
    if (name === 'saturn') { G.rings = 2.27; G.ring0 = 1.24; G.ringTilt = 0; }
    G.R = R; G.relief = 0.004; G.amp = amps(G); G.base = 0; G.base = 2000; G.dat = null;
    G.grass = G.soil; G.grassDry = G.rock; G.liquid = [0.01, 0.01, 0.01];
    return (worlds[name] = G);
  }
  G.grass = G.soil; G.grassDry = G.rock; G.liquid = [0.02, 0.02, 0.02]; G.leafHue = 0.1;
  const D = body(name, R); G.dat = D; G.R = R - D.base; G.base = 0; G.relief = 1; G.kdat = Math.floor(22 - Math.log2(D.cell));
  G.amp = amps(G); G.crP = { moon: 0.9, mercury: 0.9, mars: 0.35, venus: 0 }[name]; if (G.crP > 0.5) { G.relief = 0.35; G.amp = amps(G); }
  if (name !== 'mars') { let s = 0; for (let k = 0; k < D.g.w * D.g.h; k++) s += D.g.a[k * 4]; G.hMid = s / (D.g.w * D.g.h); }
  return (worlds[name] = G);
}
const eclN = [0, -sin(23.43928 * PI / 180), cos(23.43928 * PI / 180)];   // the ecliptic's pole, equatorial axes
void sqrt; void hypot; void rng;
