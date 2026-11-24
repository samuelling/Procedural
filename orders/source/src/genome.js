// The DNA. Four forests, one grammar. Lengths in metres, angles in degrees, colours as linear RGB.
//
// size   side of the plot.
// land   amp, f: height and frequency of the terrain noise · tilt: overall slope
//        rock [count, typical size] · peb pebbles · log fallen trunks · stump · ra, rb the stone's two colours
// air    sun [elevation, azimuth] · fog density · haze: horizon colour · sky: zenith colour · wind
// floor  moss 0..1: how readily moss takes hold · lit: leaf-litter colour, la how much of it
//        fern, grass [count, moisture each prefers] · shroom · fa fb, ga gb: frond and blade colours
// trees  one entry per species:
//   n, sap   stems and saplings in the plot · H height range · cr crown radius (sets spacing) · wet moisture it prefers
//   rt, dv   the pipe model: every leaf cluster needs rt^dv of sapwood, and a branch's calibre is the dv-th root of all
//            it carries. With dv = 2 that is Leonardo's rule: the limbs above a fork add up to the limb below.
//   fl       butt flare · clear: how far up the trunk the live crown starts · stub 1: dead stubs remain below it
//   ax       growth rules by branching order. ax[0] is the trunk; ax[1] its branches; ax[2] theirs.
//     st step · tr gravitropism (+ up, - down) · up: extra upturn toward the tip · to tortuosity
//     in internode · wh buds per node · ph phyllotaxis: degrees turned between nodes (137.5 is the golden angle)
//     an insertion angle from the parent, [low on the parent, high on it] · len length as a share of the parent
//     sh crown shape: 0 cone · 1 round · 2 column · 3 umbrella
//   leaf     t: 0 broad leaves · 1 flat needle spray · 2 small round leaves · 5 needle tuft
//            sz size · per clusters per metre of twig · o lowest branching order that bears them · a, b colour range · dr droop
//   bark     t: 0 furrowed · 1 plated · 2 papery with lenticels · 3 smooth · sc scale · a, b colours

const sp = (base) => (n, o = {}) => ({ ...base, n, ...o });
const oak = sp({ id: 'oak', nm: 'Oak', sap: 3, H: [15, 22], cr: 5, wet: 0.45, rt: 0.008, dv: 2.25, fl: 0.5, clear: [0.25, 0.4],
  ax: [{ st: 0.8, tr: 0.35, to: 0.07 }, { st: 0.6, tr: 0.06, up: 0.1, to: 0.2, in: 0.9, wh: 1, ph: 137.5, an: [78, 34], len: 0.7, sh: 1 },
    { st: 0.45, tr: 0.02, to: 0.25, in: 1, wh: 1, ph: 137.5, an: [58, 44], len: 0.4, sh: 2 }],
  leaf: { t: 0, sz: 0.95, per: 4.5, o: 2, a: [0.1, 0.26, 0.04], b: [0.3, 0.45, 0.08], dr: 0.15 },
  bark: { t: 0, sc: 1, a: [0.34, 0.29, 0.24], b: [0.1, 0.085, 0.07] } });
const birch = sp({ id: 'birch', nm: 'Birch', sap: 4, H: [12, 18], cr: 2.6, wet: 0.55, rt: 0.0058, dv: 2.4, fl: 0.25, clear: [0.3, 0.5],
  ax: [{ st: 0.8, tr: 0.4, to: 0.05 }, { st: 0.5, tr: 0.1, up: -0.14, to: 0.15, in: 0.55, wh: 1, ph: 137.5, an: [62, 28], len: 0.36, sh: 1 },
    { st: 0.4, tr: -0.1, to: 0.25, in: 0.8, wh: 1, ph: 137.5, an: [50, 50], len: 0.5, sh: 2 }],
  leaf: { t: 2, sz: 0.7, per: 6, o: 2, a: [0.22, 0.42, 0.07], b: [0.45, 0.6, 0.12], dr: 0.35 },
  bark: { t: 2, sc: 1, a: [0.84, 0.82, 0.76], b: [0.07, 0.06, 0.055] } });
const pine = sp({ id: 'pine', nm: 'Pine', sap: 2, H: [20, 28], cr: 4, wet: 0.3, rt: 0.0085, dv: 2.2, fl: 0.35, clear: [0.5, 0.68], stub: 1,
  ax: [{ st: 0.9, tr: 0.5, to: 0.03 }, { st: 0.6, tr: 0.02, up: 0.26, to: 0.12, in: 1.2, wh: 4, ph: 47, an: [86, 58], len: 0.27, sh: 3 },
    { st: 0.45, tr: 0.05, up: 0.2, to: 0.2, in: 1, wh: 2, ph: 90, an: [50, 50], len: 0.5, sh: 2 }],
  leaf: { t: 5, sz: 0.9, per: 5, o: 2, a: [0.06, 0.2, 0.09], b: [0.15, 0.32, 0.13], dr: 0.1 },
  bark: { t: 1, sc: 1, a: [0.46, 0.3, 0.21], b: [0.15, 0.09, 0.07] } });
const spruce = sp({ id: 'spruce', nm: 'Spruce', sap: 6, H: [16, 26], cr: 2.5, wet: 0.5, rt: 0.0058, dv: 2.15, fl: 0.4, clear: [0.06, 0.2], stub: 1,
  ax: [{ st: 0.8, tr: 0.6, to: 0.02 }, { st: 0.5, tr: -0.1, up: 0.24, to: 0.06, in: 0.6, wh: 5, ph: 37, an: [98, 62], len: 0.2, sh: 0 }],
  leaf: { t: 1, sz: 1.15, per: 4, o: 1, a: [0.04, 0.14, 0.08], b: [0.1, 0.25, 0.13], dr: 0.4 },
  bark: { t: 1, sc: 0.8, a: [0.32, 0.26, 0.23], b: [0.13, 0.095, 0.085] } });
const giant = sp({ id: 'giant', nm: 'Douglas-fir', sap: 2, H: [34, 46], cr: 5, wet: 0.55, rt: 0.013, dv: 2.05, fl: 0.9, clear: [0.42, 0.6], stub: 1,
  ax: [{ st: 1.2, tr: 0.6, to: 0.015 }, { st: 0.7, tr: -0.07, up: 0.2, to: 0.08, in: 0.85, wh: 3, ph: 53, an: [94, 58], len: 0.15, sh: 0 }],
  leaf: { t: 1, sz: 1.5, per: 3.5, o: 1, a: [0.04, 0.15, 0.07], b: [0.11, 0.27, 0.11], dr: 0.35 },
  bark: { t: 0, sc: 1.9, a: [0.4, 0.25, 0.17], b: [0.13, 0.075, 0.055] } });
const hemlock = sp({ id: 'hemlock', nm: 'Hemlock', sap: 8, H: [10, 20], cr: 2.6, wet: 0.7, rt: 0.0058, dv: 2.2, fl: 0.4, clear: [0.15, 0.35], stub: 1,
  ax: [{ st: 0.8, tr: 0.5, to: 0.04 }, { st: 0.5, tr: -0.16, up: 0.1, to: 0.1, in: 0.6, wh: 3, ph: 61, an: [92, 66], len: 0.24, sh: 0 }],
  leaf: { t: 1, sz: 1.2, per: 4, o: 1, a: [0.07, 0.22, 0.09], b: [0.18, 0.36, 0.13], dr: 0.6 },
  bark: { t: 0, sc: 1.1, a: [0.33, 0.24, 0.2], b: [0.12, 0.08, 0.07] } });
const maple = sp({ ...oak(0), id: 'maple', nm: 'Bigleaf maple', H: [11, 17], cr: 4.5, wet: 0.7, clear: [0.18, 0.3],
  leaf: { t: 0, sz: 1.2, per: 4, o: 2, a: [0.16, 0.34, 0.05], b: [0.4, 0.52, 0.09], dr: 0.25 },
  bark: { t: 3, sc: 1, a: [0.33, 0.31, 0.27], b: [0.16, 0.15, 0.13] } });
const aspen = sp({ ...birch(0), id: 'aspen', nm: 'Aspen', sap: 10, H: [13, 20], cr: 2.3, wet: 0.5, clear: [0.45, 0.62],
  leaf: { t: 2, sz: 0.65, per: 6, o: 2, a: [0.8, 0.5, 0.04], b: [1, 0.8, 0.12], dr: 0.3 },
  bark: { t: 2, sc: 1.2, a: [0.8, 0.82, 0.72], b: [0.06, 0.06, 0.05] } });

export const GENOMES = {
  mixed: { nm: 'Temperate mixed', size: 64,
    land: { amp: 2.4, f: 0.03, tilt: 0.03, rock: [30, 0.6], peb: 220, log: 7, stump: 4, ra: [0.42, 0.41, 0.4], rb: [0.17, 0.17, 0.18] },
    air: { sun: [34, 35], fog: 0.011, haze: [0.72, 0.78, 0.8], sky: [0.2, 0.4, 0.8], wind: 0.5 },
    floor: { moss: 0.34, lit: [0.34, 0.2, 0.07], la: 0.8, fern: [170, 0.6], grass: [200, 0.4], shroom: 26, fa: [0.1, 0.28, 0.06], fb: [0.3, 0.46, 0.1], ga: [0.16, 0.3, 0.07], gb: [0.4, 0.5, 0.15] },
    trees: [oak(28), birch(32), pine(17)] },
  boreal: { nm: 'Boreal', size: 64,
    land: { amp: 1.8, f: 0.035, tilt: 0.01, rock: [48, 0.75], peb: 300, log: 9, stump: 5, ra: [0.5, 0.5, 0.5], rb: [0.2, 0.21, 0.23] },
    air: { sun: [25, 20], fog: 0.014, haze: [0.7, 0.76, 0.84], sky: [0.22, 0.38, 0.7], wind: 0.35 },
    floor: { moss: 0.62, lit: [0.26, 0.15, 0.08], la: 0.45, fern: [70, 0.65], grass: [120, 0.4], shroom: 40, fa: [0.1, 0.26, 0.08], fb: [0.26, 0.4, 0.12], ga: [0.2, 0.3, 0.1], gb: [0.42, 0.46, 0.2] },
    trees: [spruce(62), birch(13, { H: [9, 14] }), pine(6, { H: [16, 22] })] },
  oldgrowth: { nm: 'Old growth', size: 64,
    land: { amp: 3.2, f: 0.027, tilt: 0.04, rock: [22, 0.9], peb: 120, log: 16, stump: 7, ra: [0.36, 0.37, 0.35], rb: [0.14, 0.15, 0.15] },
    air: { sun: [40, 50], fog: 0.011, haze: [0.7, 0.8, 0.78], sky: [0.3, 0.45, 0.7], wind: 0.25 },
    floor: { moss: 0.82, lit: [0.24, 0.14, 0.06], la: 0.4, fern: [420, 0.5], grass: [40, 0.4], shroom: 50, fa: [0.08, 0.3, 0.05], fb: [0.28, 0.5, 0.09], ga: [0.14, 0.3, 0.06], gb: [0.34, 0.48, 0.12] },
    trees: [giant(15), hemlock(22), maple(8)] },
  aspen: { nm: 'Aspen grove', size: 64,
    land: { amp: 1.5, f: 0.025, tilt: 0.05, rock: [16, 0.5], peb: 160, log: 5, stump: 3, ra: [0.5, 0.47, 0.42], rb: [0.24, 0.22, 0.2] },
    air: { sun: [27, 215], fog: 0.007, haze: [0.8, 0.78, 0.7], sky: [0.16, 0.38, 0.85], wind: 0.7 },
    floor: { moss: 0.12, lit: [0.75, 0.5, 0.08], la: 0.9, fern: [40, 0.6], grass: [900, 0.45], shroom: 10, fa: [0.2, 0.34, 0.06], fb: [0.5, 0.48, 0.1], ga: [0.4, 0.38, 0.1], gb: [0.75, 0.62, 0.2] },
    trees: [aspen(86), spruce(7, { H: [8, 15] })] },
};

// A mutant: the same genome with its growth numbers nudged by up to ±amt, repeatably from a seed.
export function mutate(G, rnd, amt = 0.3) {
  const keys = ['tr', 'up', 'to', 'in', 'len', 'sz', 'per', 'dv', 'fl', 'ph'], f = () => 1 + (rnd() * 2 - 1) * amt;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return o;
    const out = Array.isArray(o) ? [] : {};
    for (const k in o) {
      const v = o[k];
      if (keys.includes(k) && typeof v === 'number') out[k] = k === 'dv' ? Math.max(1.9, v * (1 + (rnd() * 2 - 1) * amt * 0.3)) : v * f();
      else if ((k === 'an' || k === 'H') && Array.isArray(v)) { const m = f(); out[k] = v.map((x) => x * m); }
      else out[k] = k === 'a' || k === 'b' || k === 'clear' ? v : walk(v);
    }
    return out;
  };
  return { ...G, trees: G.trees.map(walk), land: { ...G.land, amp: G.land.amp * f() }, floor: { ...G.floor, moss: Math.min(1, G.floor.moss * f()) } };
}

// ---- the 2 MB rung adds species made by bending the ones above, and two more forests for them
const droop = (s, k) => ({ ...s, ax: s.ax.map((a, i) => (i ? { ...a, tr: a.tr - k } : a)) });
export const extra = () => {
  const beech = sp({ ...oak(0), id: 'beech', nm: 'Beech', H: [20, 28], cr: 5.5, clear: [0.4, 0.55], leaf: { t: 0, sz: 0.8, per: 5.5, o: 2, a: [0.1, 0.3, 0.05], b: [0.32, 0.5, 0.1], dr: 0.2 }, bark: { t: 3, sc: 1, a: [0.5, 0.5, 0.48], b: [0.3, 0.3, 0.29] } });
  const alder = sp({ ...birch(0), id: 'alder', nm: 'Alder', H: [10, 16], cr: 2.8, wet: 0.9, leaf: { t: 2, sz: 0.8, per: 5.5, o: 2, a: [0.07, 0.22, 0.05], b: [0.2, 0.38, 0.08], dr: 0.15 }, bark: { t: 0, sc: 0.7, a: [0.25, 0.22, 0.2], b: [0.09, 0.08, 0.07] } });
  const willow = sp({ ...droop(birch(0), 0.24), id: 'willow', nm: 'Willow', H: [9, 14], cr: 4, wet: 0.95, clear: [0.2, 0.35], leaf: { t: 2, sz: 0.75, per: 7, o: 2, a: [0.2, 0.36, 0.1], b: [0.45, 0.58, 0.2], dr: 0.8 }, bark: { t: 0, sc: 0.9, a: [0.3, 0.27, 0.22], b: [0.11, 0.1, 0.08] } });
  const larch = sp({ ...spruce(0), id: 'larch', nm: 'Larch', H: [18, 28], cr: 3, clear: [0.25, 0.4], leaf: { t: 1, sz: 1, per: 4, o: 1, a: [0.3, 0.42, 0.1], b: [0.55, 0.62, 0.18], dr: 0.5 }, bark: { t: 1, sc: 0.9, a: [0.4, 0.3, 0.25], b: [0.16, 0.11, 0.09] } });
  // powers of ten: the same grammar a thousand times smaller. Here a unit is a millimetre, the trees are moss shoots,
  // the boulders are grains of sand, and the animals have six legs or eight.
  const haircap = sp({ ...spruce(0), id: 'haircap', nm: 'Haircap moss', H: [8, 17], cr: 1.5, clear: [0, 0.06], wet: 0.6, leaf: { t: 1, sz: 0.75, per: 5, o: 1, a: [0.1, 0.3, 0.04], b: [0.32, 0.58, 0.1], dr: 0.2 }, bark: { t: 3, sc: 1, a: [0.3, 0.34, 0.12], b: [0.14, 0.2, 0.06] } });
  const fork = sp({ ...aspen(0), id: 'fork', nm: 'Fork moss', H: [6, 11], cr: 1.4, clear: [0.05, 0.2], wet: 0.5, leaf: { t: 0, sz: 0.5, per: 6, o: 2, a: [0.12, 0.34, 0.04], b: [0.4, 0.62, 0.1], dr: 0.1 }, bark: { t: 3, sc: 1, a: [0.28, 0.36, 0.1], b: [0.12, 0.2, 0.05] } });
  return {
    moss: { nm: 'Moss on a log', span: '6.4 cm', size: 64,
      land: { amp: 3, f: 0.03, tilt: 0.05, rock: [40, 0.6], peb: 300, log: 0, stump: 0, ra: [0.78, 0.74, 0.66], rb: [0.42, 0.4, 0.36] },
      air: { sun: [38, 120], fog: 0.013, haze: [0.78, 0.84, 0.74], sky: [0.3, 0.5, 0.75], wind: 0.15 },
      floor: { moss: 1, lit: [0.16, 0.1, 0.05], la: 0.2, fern: [600, 0.5], grass: [900, 0.5], shroom: 60, fa: [0.08, 0.3, 0.05], fb: [0.3, 0.55, 0.1], ga: [0.14, 0.36, 0.06], gb: [0.4, 0.6, 0.14] },
      trees: [haircap(100), fork(40)], life: { deer: 0, birds: 0, springtail: 12, mite: 3 } },
    pine: { nm: 'Pine heath', size: 64,
      land: { amp: 1.6, f: 0.028, tilt: 0.02, rock: [26, 0.8], peb: 260, log: 5, stump: 6, ra: [0.55, 0.5, 0.45], rb: [0.26, 0.23, 0.2], stream: [1, 7, -0.2, 3] },
      air: { sun: [44, 80], fog: 0.006, haze: [0.8, 0.8, 0.74], sky: [0.16, 0.4, 0.88], wind: 0.6 },
      floor: { moss: 0.16, lit: [0.5, 0.3, 0.12], la: 1, fern: [50, 0.6], grass: [700, 0.35], shroom: 14, fa: [0.14, 0.3, 0.07], fb: [0.36, 0.46, 0.12], ga: [0.3, 0.34, 0.1], gb: [0.6, 0.56, 0.22], flower: 600 },
      trees: [pine(44, { H: [16, 24] }), birch(10, { H: [8, 13] }), oak(4, { H: [9, 13] })], life: { deer: 4, birds: 18, hare: 5, fox: 1 } },
    larch: { nm: 'Larch slope', size: 64,
      land: { amp: 3.6, f: 0.03, tilt: 0.09, rock: [44, 1], peb: 260, log: 8, stump: 4, ra: [0.5, 0.5, 0.5], rb: [0.22, 0.22, 0.24], stream: [1.1, 5, 0.3, 2.5] },
      air: { sun: [30, 250], fog: 0.008, haze: [0.76, 0.8, 0.84], sky: [0.14, 0.36, 0.86], wind: 0.55 },
      floor: { moss: 0.4, lit: [0.5, 0.36, 0.1], la: 0.7, fern: [80, 0.6], grass: [600, 0.45], shroom: 24, fa: [0.12, 0.28, 0.07], fb: [0.3, 0.44, 0.12], ga: [0.24, 0.36, 0.1], gb: [0.5, 0.56, 0.2], flower: 800 },
      trees: [larch(48), spruce(10, { H: [10, 18] }), birch(8, { H: [8, 12] })], life: { deer: 4, birds: 16, hare: 3, fox: 1 } },
    beech: { nm: 'Beech wood', size: 64,
      land: { amp: 2.8, f: 0.025, tilt: 0.03, rock: [14, 0.7], peb: 100, log: 6, stump: 3, ra: [0.45, 0.44, 0.42], rb: [0.2, 0.2, 0.2], stream: [1.2, 6, 0.2, 3.5] },
      air: { sun: [36, 140], fog: 0.009, haze: [0.74, 0.78, 0.74], sky: [0.22, 0.42, 0.78], wind: 0.4 },
      floor: { moss: 0.3, lit: [0.42, 0.22, 0.06], la: 1, fern: [60, 0.6], grass: [80, 0.4], shroom: 30, fa: [0.1, 0.28, 0.06], fb: [0.3, 0.46, 0.1], ga: [0.16, 0.3, 0.07], gb: [0.4, 0.5, 0.15], flower: 700 },
      trees: [beech(30), oak(5), birch(6)], life: { deer: 4, birds: 22, hare: 2, fox: 1 } },
    carr: { nm: 'Alder carr', size: 64,
      land: { amp: 1, f: 0.03, tilt: 0.01, rock: [10, 0.5], peb: 200, log: 8, stump: 4, ra: [0.4, 0.4, 0.38], rb: [0.16, 0.17, 0.17], stream: [2.4, 8, 0, 7] },
      air: { sun: [30, 300], fog: 0.016, haze: [0.7, 0.78, 0.76], sky: [0.24, 0.4, 0.72], wind: 0.3 },
      floor: { moss: 0.7, lit: [0.2, 0.13, 0.06], la: 0.5, fern: [380, 0.7], grass: [500, 0.6], shroom: 30, fa: [0.08, 0.3, 0.05], fb: [0.28, 0.5, 0.09], ga: [0.14, 0.32, 0.06], gb: [0.36, 0.52, 0.12], flower: 400 },
      trees: [alder(44), willow(14), birch(10, { H: [9, 14] })], life: { deer: 3, birds: 26, hare: 2, fox: 1 } },
  };
};
