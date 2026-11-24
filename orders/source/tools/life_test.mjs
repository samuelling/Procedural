// node tools/life_test.mjs [biome] : lets the 2 MB rung's animals live for some years and its trees for some centuries,
// prints what happened, and fails if anything goes non-finite or a population runs away.
import { rng } from '../src/noise.js';
globalThis.TIER = 4;
const { GENOMES, extra } = await import('../src/genome.js'), { build } = await import('../src/grow.js'), { MORE, mkLife, succeed } = await import('../src/fx.js');
const G0 = structuredClone(GENOMES); Object.assign(G0, extra());
for (const k in MORE) { G0[k].land.stream = MORE[k].stream; G0[k].life = MORE[k].life; G0[k].floor.flower = MORE[k].flower; }
const key = process.argv[2] || 'mixed', G = G0[key]; let B = build(G, 4821, 1, 1), bad = 0;
const log = [], env = { stand: B.trees, world: { dam: 0 } }, L = mkLife(B, G, rng(11), false, (s) => log.push(s), () => {}, env);
if (process.argv[3]) L.pack(1);
let yearF = 0.3, season = 1, year = 1; const YL = 64, dt = 0.1, pop = [];
for (let i = 0; i < 14 * YL / dt; i++) {
  const y0 = Math.floor(yearF); yearF += dt / YL; const se = Math.floor((yearF % 1) * 4), ph = (i * dt * 8 / YL) % 1;
  if (se !== season) { if (se === 0) L.spring(); season = se; }
  if (Math.floor(yearF) > y0) { year++; pop.push(Object.values(L.counts).join('/')); }
  const n = L.step(dt, i * dt, [900, 2, 900], ph > 0.75 ? 1 : 0, dt / YL, season, season === 3 ? 0.95 : 0);
  if (i % 50 === 0) for (let j = 0; j < n * 12; j++) if (!Number.isFinite(L.out[j])) bad++;
  if (n >= 1500) bad++;
}
console.log(key, '· deer/birds/hares/foxes at each new year:', pop.join('  '));
console.log(log.length + ' things happened in 14 years, e.g.\n  ' + log.filter((_, i) => i % Math.ceil(log.length / 14) === 0).join('\n  '));
console.log('genes:', L.genes() || 'no change yet');
const kinds = {}; for (const s of log) { const k = /caught|pulled down|felled|born|dropped|whelped|old age|starved|came in|moved on|roaring/.exec(s); kinds[k ? k[0] : 'other'] = (kinds[k ? k[0] : 'other'] || 0) + 1; } console.log(kinds);
// the forest: three centuries
const stand = B.trees, flog = [], census = () => G.trees.map((sp, si) => sp.nm + ' ' + stand.filter((t) => t.si === si && !t.st && t.H >= 5).length + '+' + stand.filter((t) => t.si === si && !t.st && t.H < 5).length).join(', ') + ' · snags ' + stand.filter((t) => t.st === 1).length + ', logs ' + stand.filter((t) => t.st === 2).length;
const cum = new Float32Array(256), born = new Float32Array(256);
console.log('year 0:   ' + census());
for (let y = 1; y <= 300; y++) {
  for (let c = 0; c < 256; c++) cum[c] += L.fear(((c >> 4) + 0.5) / 16 * B.S - B.S / 2, ((c & 15) + 0.5) / 16 * B.S - B.S / 2);
  succeed(stand, G, B, rng(4821 + y * 7), (s) => flog.push(s), { deer: +process.argv[4] || 4, year: y, fear: process.argv[5] === 'nofear' ? null : L.fear }); if (y % 5 === 0) L.lapse(5);
  if (y % 60 === 0) { console.log('year ' + y + ': ' + census()); const t0 = Date.now(); B = build(G, 4821, 1, 1, stand); for (const a of [B.caps, B.cards]) for (const v of a) if (!Number.isFinite(v)) bad++; console.log('          regrown in ' + (Date.now() - t0) + ' ms: ' + B.caps.length / 12 + ' capsules, ' + B.cards.length / 12 + ' cards'); }
}
{ const cell = (t) => Math.max(0, Math.min(15, Math.floor((t.x / B.S + 0.5) * 16))) * 16 + Math.max(0, Math.min(15, Math.floor((t.z / B.S + 0.5) * 16)));
  const young = stand.filter((t) => !t.st && t.age < 40), order = [...cum.keys()].sort((a, b) => cum[b] - cum[a]), top = new Set(order.slice(0, 32)), bot = new Set(order.slice(-128));
  const per = (S) => (young.filter((t) => S.has(cell(t))).length / S.size).toFixed(2);
  console.log('trees under 40 years per cell: in the most feared eighth of the plot', per(top), '· in the least feared half', per(bot), '· mean fear there', (order.slice(0, 32).reduce((s, c) => s + cum[c], 0) / 32 / 300).toFixed(2), 'vs', (order.slice(-128).reduce((s, c) => s + cum[c], 0) / 128 / 300).toFixed(3)); }
console.log('saplings under 2.2 m at the end:', stand.filter((t) => !t.st && t.H < 2.2).length, '· deer told to keep clear', log.filter((x) => /keep clear/.test(x)).length + flog.filter((x) => /keep clear/.test(x)).length, 'times');
console.log(flog.length + ' things in the forest chronicle, e.g. ' + flog.filter((s) => /ancestors|browsed/.test(s)).slice(0, 5).join(' | '));
console.log(flog.filter((s) => /gale/.test(s)).length + ' gales, ' + flog.filter((s) => /jays/.test(s)).length + ' jay years; ' + (flog.find((s) => /gale/.test(s)) || ''));
console.log(flog.filter((s) => /mast year/.test(s)).length + ' mast years in 300, e.g. ' + (flog.find((s) => /mast year/.test(s)) || 'none'));
console.log('after 300 years unwatched:', JSON.stringify(L.counts), L.genes());
console.log(bad ? bad + ' BAD VALUES' : 'all finite'); process.exit(bad ? 1 : 0);
