// The DNA. Three genomes, one grammar. All lengths in µm.
//
// size      [width, depth] of the block.
// layers    [name, thickness, cells per mm³ in thousands, nucleus radius, grain], listed from the pia down.
//           grain is how the layer's unlabelled fibres run: 0 any way · 1 radial · 2 tangential · 3 along z · 4 along x
// felt      unlabelled fibres per mm³, in thousands
// cells     one entry per cell type:
//   id, nm  short id and display name
//   ly      [layer (or a list to pick from), from, to]: where the soma sits, as a fraction of that layer (0 bottom, 1 top)
//   n       how many to label at full detail
//   so      [soma radius, elongation]; 0 for a bare fibre
//   h       hue used in "cell type" colours
//   I       1 inhibitory · in 1 an input fibre (fires on its own, and on a stimulus) · x 1 not part of the network (glia)
//   b       baseline drive (tonic cells have a large one)
//   ar      arbor genes, each grown tip by tip:
//     k   0 smooth dendrite · 1 spiny dendrite · 2 axon · 6 glial process
//     n   primaries · el their elevation, -1 straight down to 1 straight up
//     L   path length of a branch · st step · r starting radius · tp taper per step
//     br  chance of branching per µm · bo how many times a branch may split · ba split angle · bs length kept after a split
//     sf  how the parent's calibre is shared at a split, by Rall's 3/2 power law (0.5 even, 0.86 trunk and twig)
//     tr  tropism: + toward the pia, - toward the white matter · to tortuosity · fl flatness (1 = a plane)
//     c   overrides for side branches (hd 1: they hold their starting direction)
//     tuft {at [layer, from, to], ...overrides}: what the tip turns into on reaching that depth;
//          ax + fork: turn along an axis, or split into a T
//     tv  direction for tropism instead of "up" · edge 1 on the cell: start at the block's edge
// vessels  pen: spacing of penetrating vessels · cap: [lattice spacing, chance of an edge]
// net      conn [from, to, weight, out-degree, σx, σz] ("E" = every excitatory cell) · sig default reach [σx, σz]
//          rm peak rate · sg semi-saturation · ks weight of the suppressive pool · ka adaptation · v conduction speed
//          stim [Rx, Rz]: reach of a stimulus volley in the input fibres

const obl = { el: [0.1, 0.5], L: [50, 110], br: 0.006, sf: 0.5, bo: 1, tr: 0, to: 0.3, tp: 0.97 };
const col = { el: [-0.15, 0.15], L: [110, 240], br: 0.002, bo: 1, tr: 0.25, to: 0.1, hd: 1 };
const astro = { id: 'as', nm: 'Astrocyte', ly: [[1, 2, 3], 0, 1], n: 34, so: [5, 1], x: 1, ef: 1, ar: [{ k: 6, n: [6, 8], el: [-1, 1], L: [26, 40], st: 6, r: 0.6, tp: 0.93, br: 0.11, bo: 4, ba: 0.8, bs: 0.85, to: 0.6 }] };
const basket = (ly, n) => ({ id: 'bc', nm: 'Basket cell', ly, n, so: [7, 1], h: 0.0, I: 1, b: 0.22, ar: [
  { k: 0, n: [4, 6], el: [-1, 1], L: [80, 140], st: 14, r: 0.6, tp: 0.97, br: 0.006, bo: 2, to: 0.3 },
  { k: 2, n: [2, 3], el: [-1, 1], L: [60, 110], st: 14, r: 0.28, tp: 1, br: 0.022, bo: 4, ba: 0.9, bs: 0.85, to: 0.5 }] });

export const GENOMES = {
  cortex: {
    nm: 'Neocortex', size: [700, 700],
    felt: 13,
    layers: [['L1', 100, 15, 4, 2], ['L2/3', 260, 130, 4, 0], ['L4', 140, 180, 3.6, 0], ['L5', 220, 110, 4.4, 1], ['L6', 230, 140, 4, 1], ['WM', 50, 12, 3.4, 4]],
    cells: [
      { id: 'p23', nm: 'L2/3 pyramidal', ly: [1, 0.08, 0.95], n: 105, so: [8, 1.5], h: 0.36, b: 0.2, ar: [
        { k: 1, n: 1, el: [1, 1], L: [900, 900], st: 14, r: 1.5, tp: 0.985, br: 0.012, sf: 0.86, tr: 0.5, to: 0.12, c: obl,
          tuft: { at: [0, 0, 0.5], L: [70, 130], br: 0.02, sf: 0.5, bo: 3, ba: 0.9, tr: 0.05, to: 0.45, c: 0 } },
        { k: 1, n: [4, 6], el: [-0.7, 0.1], L: [70, 120], st: 12, r: 0.8, tp: 0.97, br: 0.012, bo: 3, to: 0.3 },
        { k: 2, n: 1, el: [-1, -1], L: [250, 480], st: 22, r: 0.3, tp: 1, br: 0.006, sf: 0.9, tr: -0.5, to: 0.15, c: col }] },
      { id: 'ss4', nm: 'L4 spiny stellate', ly: [2, 0.05, 0.95], n: 60, so: [6.5, 1], h: 0.5, b: 0.18, ar: [
        { k: 1, n: [5, 7], el: [-1, 1], L: [50, 90], st: 10, r: 0.6, tp: 0.97, br: 0.014, bo: 3, to: 0.35 },
        { k: 2, n: 1, el: [1, 1], L: [150, 300], st: 20, r: 0.28, tp: 1, br: 0.008, sf: 0.9, tr: 0.4, to: 0.15, c: { ...col, L: [60, 140] } }] },
      { id: 'p5', nm: 'L5 thick-tufted pyramidal', ly: [3, 0.15, 0.9], n: 52, so: [11, 1.6], h: 0.13, b: 0.24, ar: [
        { k: 1, n: 1, el: [1, 1], L: [1400, 1400], st: 14, r: 2.2, tp: 0.988, br: 0.011, sf: 0.86, tr: 0.5, to: 0.1, c: { ...obl, L: [60, 130] },
          tuft: { at: [0, 0, 0.6], L: [100, 180], br: 0.02, sf: 0.5, bo: 4, ba: 0.9, tr: 0.05, to: 0.45, c: 0 } },
        { k: 1, n: [5, 7], el: [-0.7, 0.1], L: [90, 150], st: 12, r: 1, tp: 0.97, br: 0.012, bo: 3, to: 0.3 },
        { k: 2, n: 1, el: [-1, -1], L: [300, 500], st: 22, r: 0.4, tp: 1, br: 0.005, sf: 0.9, tr: -0.5, to: 0.12, c: col }] },
      { id: 'p6', nm: 'L6 corticothalamic', ly: [4, 0.1, 0.9], n: 44, so: [8, 1.4], h: 0.85, b: 0.18, ar: [
        { k: 1, n: 1, el: [1, 1], L: [700, 700], st: 14, r: 1.1, tp: 0.985, br: 0.008, sf: 0.86, tr: 0.5, to: 0.12, c: { ...obl, L: [40, 80] },
          tuft: { at: [2, 0.2, 0.9], L: [40, 80], br: 0.02, sf: 0.5, bo: 2, ba: 0.8, tr: 0.1, to: 0.4, c: 0 } },
        { k: 1, n: [4, 5], el: [-0.7, 0.1], L: [60, 100], st: 12, r: 0.7, tp: 0.97, br: 0.01, bo: 2, to: 0.3 },
        { k: 2, n: 1, el: [-1, -1], L: [120, 260], st: 22, r: 0.3, tp: 1, br: 0.004, sf: 0.9, tr: -0.5, to: 0.12, c: col }] },
      basket([[1, 2, 3, 4], 0, 1], 40),
      { id: 'mc', nm: 'Martinotti cell', ly: [[1, 3], 0.1, 0.9], n: 24, so: [7, 1.3], h: 0.72, I: 1, b: 0.2, ar: [
        { k: 0, n: [2, 3], el: [-1, -0.5], L: [80, 140], st: 14, r: 0.6, tp: 0.97, br: 0.006, bo: 2, to: 0.25 },
        { k: 0, n: [1, 2], el: [0.5, 1], L: [60, 110], st: 14, r: 0.6, tp: 0.97, br: 0.006, bo: 2, to: 0.25 },
        { k: 2, n: 1, el: [1, 1], L: [1200, 1200], st: 20, r: 0.3, tp: 1, br: 0.004, sf: 0.9, tr: 0.5, to: 0.12, c: { ...col, L: [40, 90] },
          tuft: { at: [0, 0.1, 0.7], L: [120, 220], br: 0.012, sf: 0.5, bo: 3, ba: 1, tr: 0, to: 0.3, c: 0 } }] },
      { id: 'tc', nm: 'Thalamic afferent', ly: [5, 0, 0.6], n: 44, so: 0, h: 0.58, in: 1, b: 0.5, ar: [
        { k: 2, n: 1, el: [1, 1], L: [2000, 2000], st: 22, r: 0.4, tp: 1, tr: 0.5, to: 0.1,
          tuft: { at: [2, 0.1, 0.8], L: [80, 150], br: 0.02, sf: 0.5, bo: 4, ba: 0.9, tr: 0, to: 0.45 } }] },
      astro],
    vessels: { pen: 170, cap: [58, 0.3] },
    net: { sig: [110, 110], v: 1500, rm: 7, sg: 1, ks: 1.5, ka: 0.3, stim: [220, 220],
      conn: [['tc', 'ss4', 1.1, 12], ['tc', 'bc', 0.6, 3], ['ss4', 'ss4', 0.3, 5], ['ss4', 'p23', 0.6, 10], ['p23', 'p23', 0.26, 8], ['p23', 'p5', 0.55, 8],
        ['p5', 'p5', 0.26, 6], ['p5', 'p6', 0.5, 6], ['p6', 'ss4', 0.16, 4], ['E', 'bc', 0.5, 3], ['bc', 'E', 1, 22], ['p23', 'mc', 0.5, 2], ['mc', 'p23', 0.8, 12], ['mc', 'p5', 0.8, 10]] },
  },

  cerebellum: {
    nm: 'Cerebellar cortex', size: [700, 700], plane: 0,
    felt: 16,
    layers: [['ML', 230, 30, 3.4, 3], ['PCL', 30, 60, 4, 0], ['GL', 260, 2500, 2.7, 0], ['WM', 70, 15, 3.4, 1]],
    cells: [
      { id: 'pc', nm: 'Purkinje cell', ly: [1, 0.3, 0.7], n: 46, so: [11, 1.25], h: 0.36, I: 1, b: 0.62, cap: 900, ar: [
        { k: 1, n: 1, el: [1, 1], L: [215, 240], st: 9, r: 2.6, tp: 0.985, br: 0.05, bo: 7, ba: 0.5, bs: 0.93, tr: 0.1, to: 0.2, fl: 0.97 },
        { k: 2, n: 1, el: [-1, -1], L: [330, 330], st: 20, r: 0.5, tp: 1, tr: -0.5, to: 0.1 }] },
      { id: 'gc', nm: 'Granule cell', ly: [2, 0.02, 0.98], n: 250, so: [3.2, 1], h: 0.13, b: 0.12, ar: [
        { k: 0, n: 4, el: [-1, 1], L: [10, 16], st: 6, r: 0.4, tp: 0.95, to: 0.5 },
        { k: 2, n: 1, el: [1, 1], L: [900, 900], st: 18, r: 0.22, tp: 1, tr: 0.7, to: 0.06,
          tuft: { at: [0, 0.08, 0.95], ax: [0, 0, 1], fork: 2, L: [260, 420], st: 24, tr: 1.5, to: 0.03 } }] },
      { id: 'mli', nm: 'Molecular layer interneuron', ly: [0, 0.08, 0.9], n: 56, so: [5, 1], h: 0.0, I: 1, b: 0.25, ar: [
        { k: 0, n: [3, 5], el: [-1, 1], L: [50, 90], st: 10, r: 0.5, tp: 0.97, br: 0.008, bo: 2, to: 0.3, fl: 0.9 },
        { k: 2, n: 1, el: [-0.3, 0.3], L: [110, 200], st: 14, r: 0.25, tp: 1, br: 0.012, sf: 0.9, tr: 0, to: 0.15, fl: 0.9,
          c: { el: [-1, -0.6], L: [30, 70], br: 0, tr: -0.3, to: 0.25, hd: 0 } }] },
      { id: 'go', nm: 'Golgi cell', ly: [2, 0.5, 1], n: 14, so: [9, 1], h: 0.72, I: 1, b: 0.25, ar: [
        { k: 0, n: [2, 3], el: [0.5, 1], L: [200, 300], st: 14, r: 0.8, tp: 0.98, br: 0.004, bo: 2, tr: 0.2, to: 0.2 },
        { k: 2, n: [2, 3], el: [-1, 0.2], L: [60, 100], st: 12, r: 0.25, tp: 1, br: 0.03, bo: 4, ba: 0.9, bs: 0.85, to: 0.5 }] },
      { id: 'mf', nm: 'Mossy fibre', ly: [3, 0, 0.6], n: 40, so: 0, h: 0.58, in: 1, b: 0.5, ar: [
        { k: 2, n: 1, el: [1, 1], L: [1000, 1000], st: 20, r: 0.5, tp: 1, tr: 0.4, to: 0.15,
          tuft: { at: [2, 0.1, 0.9], L: [60, 120], br: 0.02, sf: 0.5, bo: 3, ba: 0.9, tr: 0, to: 0.5 } }] },
      { id: 'bg', nm: 'Bergmann glia', ly: [1, 0, 1], n: 44, so: [5, 1], x: 1, ar: [{ k: 6, n: [2, 3], el: [0.9, 1], L: [400, 400], st: 12, r: 0.5, tp: 1, tr: 0.8, to: 0.08 }] }],
    vessels: { pen: 190, cap: [62, 0.3] },
    net: { sig: [80, 80], v: 1500, rm: 7, sg: 1, ks: 1.5, ka: 0.25, stim: [170, 170],
      conn: [['mf', 'gc', 1.1, 14], ['mf', 'go', 0.4, 2], ['gc', 'pc', 0.3, 9, 50, 330], ['gc', 'mli', 0.45, 3, 50, 260], ['mli', 'pc', 1, 8, 120, 40], ['gc', 'go', 0.4, 2], ['go', 'gc', 0.9, 30]] },
  },

  hippocampus: {
    nm: 'Hippocampus CA1', size: [700, 700],
    felt: 14,
    layers: [['SLM', 140, 25, 3.6, 4], ['SR', 300, 18, 3.6, 4], ['SP', 60, 520, 4.2, 1], ['SO', 150, 28, 3.8, 0], ['Alv', 50, 10, 3.4, 4]],
    cells: [
      { id: 'pyr', nm: 'CA1 pyramidal', ly: [2, 0.05, 0.95], n: 180, so: [8, 1.5], h: 0.36, b: 0.2, ar: [
        { k: 1, n: 1, el: [1, 1], L: [900, 900], st: 14, r: 1.6, tp: 0.988, br: 0.016, sf: 0.86, tr: 0.5, to: 0.1, c: { ...obl, L: [50, 120] },
          tuft: { at: [0, 0, 0.6], L: [70, 120], br: 0.022, sf: 0.5, bo: 3, ba: 0.9, tr: 0.05, to: 0.45, c: 0 } },
        { k: 1, n: [3, 5], el: [-0.85, -0.15], L: [80, 130], st: 12, r: 0.8, tp: 0.97, br: 0.012, bo: 3, to: 0.3 },
        { k: 2, n: 1, el: [-1, -1], L: [400, 400], st: 22, r: 0.3, tp: 1, tr: -0.5, to: 0.12,
          tuft: { at: [4, 0.2, 0.8], ax: [1, 0, 0], fork: 1, L: [250, 450], tr: 1.2, to: 0.05 } }] },
      basket([[2, 3], 0, 1], 22),
      { id: 'olm', nm: 'O-LM cell', ly: [3, 0.1, 0.9], n: 16, so: [8, 1.4], h: 0.72, I: 1, b: 0.2, ar: [
        { k: 0, n: [2, 4], el: [-0.1, 0.1], L: [100, 180], st: 14, r: 0.7, tp: 0.98, br: 0.004, bo: 1, to: 0.15 },
        { k: 2, n: 1, el: [1, 1], L: [900, 900], st: 20, r: 0.3, tp: 1, tr: 0.6, to: 0.08,
          tuft: { at: [0, 0.1, 0.9], L: [80, 160], br: 0.02, sf: 0.5, bo: 4, ba: 1, tr: 0, to: 0.5 } }] },
      { id: 'sc', nm: 'Schaffer collateral', ly: [1, 0.1, 0.92], n: 60, so: 0, h: 0.58, in: 1, b: 0.4, edge: 1, ar: [
        { k: 2, n: 1, tv: [1, 0, 0], L: [1000, 1000], st: 25, r: 0.3, tp: 1, tr: 1.2, to: 0.06 }] },
      { ...astro, ly: [[0, 1, 3], 0, 1] }],
    vessels: { pen: 180, cap: [58, 0.3] },
    net: { sig: [100, 100], v: 1500, rm: 7, sg: 1, ks: 1.5, ka: 0.3, stim: [900, 110],
      conn: [['sc', 'pyr', 0.75, 16, 700, 80], ['sc', 'bc', 0.5, 2, 700, 80], ['pyr', 'pyr', 0.1, 3], ['pyr', 'bc', 0.6, 2], ['bc', 'pyr', 1, 20], ['pyr', 'olm', 0.6, 2], ['olm', 'pyr', 0.7, 12]] },
  },
};

// A mutant: the same genome with its growth numbers nudged by up to ±amt, repeatably from a seed.
export function mutate(G, rnd, amt = 0.3) {
  const keys = ['L', 'br', 'ba', 'tr', 'to', 'r', 'fl', 'bs'];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return o;
    const out = Array.isArray(o) ? [] : {};
    for (const k in o) {
      const v = o[k], f = () => 1 + (rnd() * 2 - 1) * amt;
      if (keys.includes(k) && typeof v === 'number') out[k] = k === 'fl' || k === 'bs' ? Math.min(0.99, v * f()) : v * f();
      else if (k === 'L' && Array.isArray(v)) { const m = f(); out[k] = v.map((x) => x * m); }
      else out[k] = k === 'at' || k === 'ax' || k === 'tv' || k === 'ly' || k === 'el' ? v : walk(v);
    }
    return out;
  };
  const M = { ...G, cells: G.cells.map((c) => ({ ...c, ar: walk(c.ar) })) };
  M.layers = G.layers.map((l) => [l[0], Math.round(l[1] * (1 + (rnd() * 2 - 1) * amt * 0.6)), l[2], l[3], l[4]]);
  return M;
}
