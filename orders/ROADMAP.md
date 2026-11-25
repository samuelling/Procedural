# Filling the 2 MB rung

The top rung holds about 1.61 MB, about 1.49 MB of it measured ground and climate of its 2,000,000 bytes. This is the plan for the rest, and the state of it. Sizes are
guesses at packed bytes. Nothing here is padding: every track is rules, or tables of knowledge about real forests.

| Track | Guess | State |
|---|---|---|
| **Powers of ten.** The same grammar at other scales. | 400 kB | **Done.** Moss on a log at 6.4 cm (a unit is a millimetre): haircap and fork moss as the trees, sand grains as boulders, springtails hunted by mites. Haircap moss now fruits: bristles with spore capsules. Outward: **the valley** around the plot, 6 km across (ridges, river, lake, a near band of simple trees, a canopy beyond). Inward: **a rotting log at 64 cm** **soil at 6.4 mm** (fungal threads, a root and root hairs, moulds, nematodes, tardigrades) **under the bark of a dead spruce at 6.4 cm** (an engraver beetle family's galleries with eggs, grubs, pupae and young adults; honey fungus; checkered beetles hunting) and **the underside of a leaf at 0.64 mm** (jigsaw cells, stomata, hairs, pollen, a fungal thread entering a stoma, spider mites and predatory mites), with a dive between scales (+ and −). **A range at 640 km** (raised, then eroded by its rivers: lakes, smoothed rivers, treeline, snowline, cumulus) and **one continuous zoom** through all seven scales at true scale, the old world's last frame dissolving into the new. **Done** for this track's plan; what is left is depth in each world rather than more scales. |
| **Anywhere on Earth.** Latitude, longitude and altitude choose climate, day length, soils and species. | 300 kB | **Done, first pass.** The measured Köppen-Geiger class on a quarter-degree grid (35 kB packed), real sun paths and day lengths, monthly climate modelled to fit the class, climbing with a lapse rate, soils, and trees by class and region (eight new species). To do: measured monthly temperatures and rainfall in place of the modelled ones; a terrain height at each point, so altitude is the place's own; regional animals. |
| **Any time.** Four hundred million years of forests, and the ice retreating. | 200 kB | **First pass.** Nine ages from the Devonian to the wildwood, with forking scale trees, horsetail whorls, fronds, cycads, a diamond leaf-scar bark, and Arthropleura, Meganeura, sauropods and mammoths. To do: moving through the ages continuously rather than by buttons; period sounds; more animals. |
| **The world's flora and fauna.** A few thousand tree species as genome rows, and regional animals. | 400 kB | 17 species, 7 kinds of animal; bracket fungi on snags and beard lichen in the wet forests. |
| **An acoustic atlas.** A song grammar per bird, frog and insect, by place and month. | 250 kB | **Started.** Eight calls, and ten bird songs sketched from memory (unverified), each bird singing only in its kind of wood and most of all at dawn, and a cicada in summer. Not yet by month or place, and no song has been checked against a recording. |
| **Close detail.** What a leaf, needle, bark, moss, litter, stone, fur, flower and water look like from a hand's breadth, appearing only when a pixel is small enough. | 60 kB | **Second pass.** Every surface, double-click to fly close, gills and pores, feathers, single needles, lichen colonies, three kinds of flower, dew, ants, ladybirds. Walking in first person (Ashland's controls) with floating to reach the canopy and caps. Cells in a leaf and soil animals now have worlds of their own (Leaf ×100,000, Soil ×10,000) rather than a third layer here. |
| **Evolution.** Heritable traits, selection, speciation and extinction. | 30 kB | **Started.** Trees: two heritable traits (wetness, pace of life), local pollen, selection at establishment, new species named and drawn when a group drifts far enough, extinction, a tree of life. Animals still only drift in two genes within their kinds; no animal speciation, no hybrids, no traits beyond two. |
| **Builders and minds.** Webs, nests, ant trails, a bee's dance, memory and teaching. | 200 kB | Beavers build; deer remember where wolves killed and avoid it (a landscape of fear, which also lightens browsing there); spiders string orb webs between trunks (frame, spokes, spiral); birds leave nests with eggs and woodpeckers leave holes in snags; jays plant oaks and beeches in mast years; animals have needs and two genes. No memory yet. |
| **Real physics.** Water that erodes and meanders, light traced through the canopy, carbon budgets, wind-throw. | 150 kB | Fire spread, a dam and pond, a yearly gap model with mast years, nurse logs and gales that throw the tallest trees. **Water carving the land:** in deep time a stream cuts back from a fault, a waterfall retreats through the plot over thousands of years and leaves a gorge through layered rock; the range wears down by stream-power erosion in eleven stages; Rewind and Fast forward over a tape of the forest and ground. **A lake bed** (caustics, Snell's window, pondweed, lily pads, perch and pike) reached by walking into deep water, and **a limestone cave** (a height field with a roof: passages, a fallen-in chamber, stalactites over stalagmites, a pool, bats, a lamp). The cave is now true 3D (surface nets, levels one above another) and every forest has a cave mouth. To do: the valley drawn fine enough to show the gorge beyond the plot. |
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

## Binding the scales (overnight, from the dialogue in `dialogue/`)

| Step | State |
| --- | --- |
| Park the plot across dives; years away lived on return | **Done** (round 1) |
| Site record: place, sun, log species and seed carried in | **Done** (round 1) |
| Dive at a real log; acorns only near an oak | **Done** (round 1) |
| Range out-dive onto a headwater; home forest colour | **Done** (round 1). Treeline from the place's climate: **done** (round 2) |
| Radial dissolve from the spot | **Done** (round 1). To do: a viewfinder of the next world's extent |
| Leaf world takes the species' colour and, for conifers, needle stomata in rows | Queued |
| Bark beetle galleries per host | Queued |
| Weather and night change the small worlds (stomata close, moss folds, tardigrades curl) | Queued |
| Things that cross scales: falling leaves, a hoof, the plot's mites setting the moss world's | Queued |
| Measured ground (ETOPO 2022) and months (CRU CL 2.0) under Earth places | **Done** (round 2) |
| The range is the real 640 km round an Earth place | **Done** (round 2). To do: smoother coasts; finer relief where peaks are lost |
| The globe as the top rung | Queued |
| A soil-water bucket from the measured months, read by every scale | Queued |
| Measured soil (SoilGrids) under the soil world; tree genera by measured range | Queued |
| The horizon: measured land to 120 km behind the valley, Earth curving away | **Done** (round 3) |
| Valley relief from the cell's measured mean over its floor | **Done** (round 3) |
| True north and a continuous year; snow from the month | **Done** (round 3) |
| The range built a pass per frame instead of at once | Queued (it still freezes the page for about 0.8 s on a laptop) |
| The next world drawn in a window before the swap (stencil) | Queued |
| Snowpack, leaf-out and leaf-fall from the months, in every world | **Done** (round 4), thresholds a sketch |
| Dew and rime from measured humidity and diurnal range | **Done** (round 4) |
| Winter inversions in valleys | First pass (round 4); Innsbruck still too warm in January |
| Phenology on the Growing Season Index (dry-season leaf drop) | Queued |
| The litter's age and the fallen-leaf case in the small worlds | Queued |
| Wet days and sunshine: a daily weather chain while time runs | **Done** (round 5) |
| A soil-water bucket read by the moss and the soil | **Done** (round 5); tardigrade tuns and stomata still to do |
| The foot of the ladder a fallen leaf, aged from leaf fall; living leaves from a seedling | **Done** (round 5) |
| Lapse from CRU's own heights | **Done** (round 5) |
| The next world in a window before the swap (stencil, inner camera, second shadow map) | Designed in round 5; not built |

