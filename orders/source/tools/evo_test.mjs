// node tools/evo_test.mjs [biome] [years] [deer] : runs the 2 MB rung's tree succession for a long time and reports
// evolution: new species, renamings and losses, then regrows the plot with whatever species it ends with.
import { rng } from '../src/noise.js';
globalThis.TIER = 4;
const { GENOMES, extra } = await import('../src/genome.js'), { build } = await import('../src/grow.js'), { MORE, succeed } = await import('../src/fx.js');
const G0 = structuredClone(GENOMES); Object.assign(G0, extra());
for (const k in MORE) { G0[k].land.stream = MORE[k].stream; G0[k].floor.flower = MORE[k].flower; }
const key = process.argv[2] || 'mixed', N = +process.argv[3] || 1000, deer = +process.argv[4] || 4, G = G0[key];
let B = build(G, 4821, 1, 1); const stand = B.trees, log = [];
const census = () => G.trees.map((s, i) => s.nm + (s.gone ? ' (gone ' + s.gone + ')' : ' ' + stand.filter((t) => t.si === i && !t.st).length)).join(', ');
console.log(key, 'year 0:', census());
for (let y = 1; y <= N; y++) {
  succeed(stand, G, B, rng(4821 + y * 7), (s) => log.push('  ' + y + ': ' + s), { deer, year: y });
  if (y % 100 === 0) { console.log('year ' + y + ':', census()); B = build(G, 4821, 1, 1, stand); stand.wet = B.trees.wet; }
}
const evo = log.filter((s) => /species|gone from/.test(s));
console.log(evo.length ? evo.join('\n') : '  no speciation or loss');
let bad = 0; for (const a of [B.caps, B.cards]) for (const v of a) if (!Number.isFinite(v)) bad++;
const tr = (s, d = 0) => (s.par && d < 12 ? tr(G.trees.find((o) => o.nm === s.par && o.born < s.born) || { nm: s.par }, d + 1) + ' > ' : '') + s.nm;
if (new Set(G.trees.map((s) => s.nm)).size < G.trees.length) { console.log('DUPLICATE NAMES'); process.exit(1); }
console.log('lineages:', G.trees.filter((s) => s.par).map(tr).join(' | ') || 'none');
console.log(bad ? bad + ' BAD VALUES' : 'all finite'); process.exit(bad ? 1 : 0);
