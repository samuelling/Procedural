// node tools/grow_test.mjs : grows every forest of every 3D rung, at both detail levels, and checks nothing is non-finite.
import { rng } from '../src/noise.js';
let fail = 0;
for (const tier of [2, 3, 4]) {
  globalThis.TIER = tier;
  const { GENOMES, mutate, extra } = await import('../src/genome.js?t=' + tier), { build } = await import('../src/grow.js?t=' + tier), { MORE, mkLife } = await import('../src/fx.js?t=' + tier);
  const G = structuredClone(GENOMES); if (tier > 3) Object.assign(G, extra());
  if (tier > 2) for (const k in MORE) { G[k].land.stream = MORE[k].stream; G[k].life = MORE[k].life; if (tier > 3) G[k].floor.flower = MORE[k].flower; }
  for (const key in G) for (const [label, g, q] of [['full', G[key], 1], ['low', G[key], 0.5], ['mutant', mutate(G[key], rng(7)), 1]]) {
    const t0 = Date.now(), B = build(g, 4821, q, 1), ms = Date.now() - t0; let bad = 0, limbs = 0;
    for (const a of [B.caps, B.cards, B.land.v, ...B.rocks, ...(B.water ? [B.water.v] : [])]) for (const v of a) if (!Number.isFinite(v)) bad++;
    if (tier > 2) { const L = mkLife(B, g, rng(3), q < 1); for (let i = 0; i < 400; i++) limbs = L.step(0.05, i * 0.05, [0, 2, 0], 0); for (let i = 0; i < limbs * 12; i++) if (!Number.isFinite(L.out[i])) bad++; }
    if (bad || !B.st.trees || (tier > 2 && ((g.land.stream && !B.water) || !limbs))) fail++;
    if (label === 'full') console.log(`tier ${tier} ${g.nm.padEnd(16)} ${JSON.stringify(G[key]).length} B genome -> ${B.st.trees} trees, ${B.caps.length / 12} capsules, ${B.cards.length / 12} cards${B.water ? ', stream' : ''}${limbs ? ', ' + limbs + ' limbs of animals' : ''}, ${ms} ms, non-finite ${bad}`);
  }
}
console.log(fail ? fail + ' FAILED' : 'all grown clean'); process.exit(fail ? 1 : 0);
