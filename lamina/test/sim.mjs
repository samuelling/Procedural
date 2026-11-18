// Checks each genome: what it grows, and how its circuit behaves at rest and after a stimulus.
import { GENOMES, mutate } from '../src/genome.js';
import { build, rng } from '../src/grow.js';
import { makeNet } from '../src/net.js';
const seed = +process.argv[2] || 4821;
for (const key in GENOMES) {
  const G = GENOMES[key], t0 = Date.now(), B = build(G, seed, 1), ms = Date.now() - t0;
  const kinds = {}; for (let i = 0; i < B.count; i++) { const k = B.inst[i * 12 + 11]; kinds[k] = (kinds[k] || 0) + 1; }
  let bad = 0; for (const v of B.inst) if (!Number.isFinite(v)) bad++;
  console.log(`\n== ${G.nm}: genome ${JSON.stringify(G).length} B -> ${B.count} capsules in ${ms} ms, ${B.units.length} units, neurite ${(B.st.neurite / 1e6).toFixed(2)} m, vessel ${(B.st.vessel / 1e3).toFixed(0)} mm, nuclei ${B.st.nuclei} (keep ${B.st.nucKeep.toFixed(3)}), non-finite ${bad}`);
  console.log('   kinds', JSON.stringify(kinds));
  const net = makeNet(G, B.units, seed), types = [...new Set(B.units.map((u) => u.t))], cnt = Object.fromEntries(types.map((t) => [t, B.units.filter((u) => u.t === t).length]));
  const row = (label, c) => console.log('   ' + label.padEnd(12) + types.map((t) => `${t} ${(c[t] / cnt[t]).toFixed(2)}`).join('  '));
  const run = (sec) => { const c = Object.fromEntries(types.map((t) => [t, 0])); for (let i = 0; i < sec * 60; i++) net.step(1 / 60, (j) => c[B.units[j].t]++); for (const t of types) c[t] /= sec; return c; };
  console.log('   synapses', net.syn, ' rates (spikes per cell per display second):');
  row('rest 0-10s', run(10)); row('rest 10-30s', run(20));
  const n = net.stim(0, 0); console.log('   stimulus at centre: ' + n + ' input fibres');
  for (let k = 0; k < 6; k++) row(`+${(k * 0.25).toFixed(2)}s`, run(0.25));
  row('after 1.5-6s', run(4.5));
  const M = mutate(G, rng(7)), BM = build(M, seed, 1); console.log(`   mutant: ${BM.count} capsules, thickness ${BM.T} (wild type ${B.T})`);
  const BL = build(G, seed, 0.4); console.log(`   low detail: ${BL.count} capsules, ${BL.units.length} units`);
}
