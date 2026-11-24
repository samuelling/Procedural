# Filling the 2 MB rung

The top rung holds about 39.3 kB of its 2,000,000 bytes. This is the plan for the rest, and the state of it. Sizes are
guesses at packed bytes. Nothing here is padding: every track is rules, or tables of knowledge about real forests.

| Track | Guess | State |
|---|---|---|
| **Powers of ten.** The same grammar at other scales. | 400 kB | **Started.** Moss on a log at 6.4 cm (a unit is a millimetre): haircap and fork moss as the trees, sand grains as boulders, springtails hunted by mites. Haircap moss now fruits: bristles with spore capsules. Outward: **the valley** around the plot, 6 km across (ridges, river, lake, a near band of simple trees, a canopy beyond). Inward: **a rotting log at 64 cm** and **soil at 6.4 mm** (fungal threads, a root and root hairs, moulds, nematodes, tardigrades), with a dive between scales (+ and −). To do: inside a leaf (cells, stomata) at 0.64 mm; under the bark; a range at 640 km; a truly continuous zoom rather than a dive and a fade. |
| **Anywhere on Earth.** Latitude, longitude and altitude choose climate, day length, soils and species. | 300 kB | Not started. Needs a coarse climate table and species ranges. |
| **Any time.** Four hundred million years of forests, and the ice retreating. | 200 kB | Not started. Needs new branching rules (forking scale trees, fronds, cycads) and period animals. |
| **The world's flora and fauna.** A few thousand tree species as genome rows, and regional animals. | 400 kB | 17 species, 7 kinds of animal; bracket fungi on snags and beard lichen in the wet forests. |
| **An acoustic atlas.** A song grammar per bird, frog and insect, by place and month. | 250 kB | **Started.** Eight calls, and ten bird songs sketched from memory (unverified), each bird singing only in its kind of wood and most of all at dawn, and a cicada in summer. Not yet by month or place, and no song has been checked against a recording. |
| **Close detail.** What a leaf, needle, bark, moss, litter, stone, fur, flower and water look like from a hand's breadth, appearing only when a pixel is small enough. | 60 kB | **Second pass.** Every surface, double-click to fly close, gills and pores, feathers, single needles, lichen colonies, three kinds of flower, dew, ants, ladybirds. Walking in first person (Ashland's controls) with floating to reach the canopy and caps. To do: a third layer (cells in a leaf, soil animals). |
| **Evolution.** Heritable traits, selection, speciation and extinction. | 30 kB | **Started.** Trees: two heritable traits (wetness, pace of life), local pollen, selection at establishment, new species named and drawn when a group drifts far enough, extinction, a tree of life. Animals still only drift in two genes within their kinds; no animal speciation, no hybrids, no traits beyond two. |
| **Builders and minds.** Webs, nests, ant trails, a bee's dance, memory and teaching. | 200 kB | Beavers build; deer remember where wolves killed and avoid it (a landscape of fear, which also lightens browsing there); spiders string orb webs between trunks (frame, spokes, spiral); birds leave nests with eggs and woodpeckers leave holes in snags; jays plant oaks and beeches in mast years; animals have needs and two genes. No memory yet. |
| **Real physics.** Water that erodes and meanders, light traced through the canopy, carbon budgets, wind-throw. | 150 kB | Fire spread, a dam and pond, a yearly gap model with mast years, nurse logs and gales that throw the tallest trees. |
| **Other forests.** Mangrove, cloud forest, bamboo, redwoods, kelp. | 100 kB | Eleven forests: redwood grove and cloud forest added. Still all temperate or boreal. |

## Rules of the work

- Every rung is one page that must fit its allowance whole. The 20 kB rung has about 24 bytes to spare, so anything
  new must sit behind `TIER > 2` or `TIER > 3` and fold away in the 20 kB build. Check with `node tools/build.mjs 2 c 20000`.
- `node tools/grow_test.mjs` and `node tools/life_test.mjs <biome>` must pass before publishing.
- The index reports real byte counts; the bars are never rounded up.
- Tables written from memory will contain errors. Mark any such table as unverified in its comment until it has been
  checked against a source. Measured data from a real dataset is allowed if it is not an image or a model, and is
  labelled as measured.
- What has only been confirmed in the simulation log, and not seen in a render, is listed in the README.
