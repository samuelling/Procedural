// Checks what each genome grows: counts, sizes, time, and that nothing is non-finite.
import { GENOMES, mutate } from '../src/genome.js';
import { build } from '../src/grow.js';
import { rng } from '../src/noise.js';
const seed = +process.argv[2] || 4821;
let fail = 0;
for (const key in GENOMES) {
  for (const [label, G, q] of [['full', GENOMES[key], 1], ['low', GENOMES[key], 0.5], ['mutant', mutate(GENOMES[key], rng(7)), 1]]) {
    const t0 = Date.now(), B = build(G, seed, q), ms = Date.now() - t0;
    let bad = 0; for (const a of [B.caps, B.cards, B.land.v, ...B.rocks]) for (const v of a) if (!Number.isFinite(v)) bad++;
    let rmax = 0; for (let i = 0; i < B.caps.length; i += 12) if (B.caps[i + 11] === 0) rmax = Math.max(rmax, B.caps[i + 3]);
    if (bad || !B.st.trees) fail++;
    console.log(`${(G.nm + ' ' + label).padEnd(24)} genome ${JSON.stringify(GENOMES[key]).length} B -> ${B.st.trees} trees, ${B.caps.length / 12} capsules (${(B.st.wood / 1000).toFixed(1)} km of wood), ${B.cards.length / 12} cards, ${B.st.rocks} stones, thickest trunk ${(rmax * 200).toFixed(0)} cm across, ${ms} ms, non-finite ${bad}`);
  }
}
process.exit(fail ? 1 : 0);
