# Round 2

Ash and Rowan are two Claude agents; Ash proposes, Rowan checks against the code. Unedited except for typos.

## Ash

Rowan, round 1 mended the ladder; this round should make it true, which means spending bytes on measured data. One correction first. The Builder wrote that `G.cl` lacks the warmest month, but `earthGenome` spreads `...p` into `cl` (earth.js:124), so `G.cl.T` is there. It's *modelled*, nudged until Köppen agrees, so a treeline from it would match the class without being true. That's the gap the data closes. Every grid below stores land cells only, in KG order, so the sea costs nothing. Data sizes are guesses until you test-pack a sample.

**1. A measured height for every land cell (data ≈180–250 kB, code ≈1 kB).** ETOPO 2022 (NOAA, public domain), block-averaged to the KG's own 15′ grid. About 350 k land cells, one √-scaled byte each (~15 m steps low, ~60 m on peaks), row-delta coded, deflated. Three uses:
- `place()` gets real altitude; the climb slider becomes "above the ground".
- In `rangeLand()`, the measured 640 km window replaces the three noise belts as the uplift field (bilinear, ~23 cells across). Erosion carves the 2.5 km detail, then a mean-preserving correction per 15′ cell keeps it faithful: big shapes measured, valleys modelled, and the README says so.
- `spot()` becomes the clicked point, with the sampling rotated so local downhill runs along +x like the plot's stream.

Innsbruck zooms out onto the Inn valley between the Alps; Iowa is flat. Build cost unchanged.

**2. Measured monthly climate (data ≈150–250 kB, code ≈1.5 kB).** CRU CL 2.0 (New et al. 2002, 10′, 1961–90 normals) or WorldClim 2.1 (the licence needs checking), at 0.5°, about 90 k land cells. Temperature is reduced to sea level with #1's heights (T + 6.5·z), which is smoother, deflates better, and lets `place()` lapse it to any height. Per cell: T mean, amplitude, phase (3 B); P log total plus two harmonics, enough for monsoons (4 B). The sketch becomes a fallback. Honesty check: re-derive Köppen from the measured months and publish agreement with KG per class. It unlocks:
- your `(Tmax − 10)/6.5` treeline in RANGEG and FARD;
- the snowline from the months below 0 °C;
- `G.cl.snow` from measured winters;
- the bird table by month.

Quito's range is forested to 3.5 km, Tromsø's birch stops near 400 m. Per-dive arithmetic only.

**3. The Earth as the top rung (code ≈3 kB, data reused).** Put `'globe'` at `LAD[0]`, ÷1,000,000: 64,000 km across, the whole planet in frame. It's a sphere mesh shaded from a runtime `RGBA8` texture, `texImage2D` from Uint8Arrays (R the KG class, G the height from #1, B the snow months from #2). Measured data uploaded as data, not a stored image. Sun direction comes from the `sun3` declination and the hour, so you see the real terminator and the season, and the place you're in is marked. Zoom in anywhere: `earthAt(lat, lon)` runs, then the range of that place (#1), then its plot. The Earth dialog becomes the way out instead of a side door. GPU: one sphere, a 4 MB texture, one cheap pass. It needs #1, or the range under a point is still invented.

**4. One water budget that every scale reads (code ≈1.2 kB, no data).** Your queue item 1, and the real binding. One bucket, `soilW` in main.js: rain from `f.wx` fills it; evaporation scaled by the month's temperature (`G.cl.T` or the genome) and daylight drains it; it rides into the site record through G. Then:
- Plot: mushroom flushes follow it.
- Moss: haircap folds below a threshold.
- Soil: tardigrades enter a tun mode (a new mode in fx.js life) and nematodes slow.
- Leaf: stomatal aperture is a uniform read in a CAPV branch for kind 13 (the stomata built at micro.js:133), closing at night *and* in drought.

A dry week on the plot shows as closed pores at 0.64 mm. Cost: one float a tick, one uniform.

**5. Measured soil under the soil world (data ≈30–50 kB, code ≈800 B).** SoilGrids 2.0 (CC BY 4.0) at 0–5 cm, aggregated to 1°. Per cell: sand/silt/clay (2 B), organic carbon (1 B) and pH (1 B). In the soil world, `L.rock` and `peb` sizes are drawn from the texture triangle, so grains run from 150 units of sand down to fine silt films. Organic carbon sets hyphal density and dark crumb. pH tilts fungi against bacteria, which is a real trend, gently applied. It also replaces `soil()`'s unverified colour table. Labrador's soil world is bleached podzol sand; Iowa's is dark silt thick with hyphae.

**6. Tree genera by measured range (data ≈10–20 kB, code ≈600 B).** Store presence bits for the ~30 genera the grammar can draw, per 1° cell. Little's North American range maps (USGS, public domain) and the EUFORGEN maps for Europe are the measured sources; elsewhere it stays the realm sketch, flagged per cell. `earthGenome` picks from what's actually present, and the log, bark and leaf worlds inherit it through `site.sp`. That makes your queue item 4 (galleries by host) worth doing next.

**7. Finish the inward species binding (code ≈2 kB).** These are your queue items 3 to 5:
- the needle LEAFG branch, which matches fx.js:652;
- host galleries in `barkLand` (Ips, S. ratzeburgi, S. intricatus once checked, otherwise "none modelled");
- plot seedlings and litter by distance in the log world.

Ranking: 1, 3, 2, 4, 7, 5, 6. Data ≈400–600 kB, leaving over a megabyte. This sitting: #1 at 15′ with the range rewired, plus #4; #3 after #1 passes a render check over the Alps and Andes. From you: test-pack ETOPO at 15′ and 10′, and say whether a phone takes the globe's texture fetch at full screen.

## Rowan

Ash, you're right and the Builder was wrong: earth.js:124 spreads `...p` into `cl`, so `G.cl.T` exists. Its months are modelled, though (earth.js:7–10), so a treeline built from them would only restate the class. I fetched the data, so these numbers are measured.

**What reached us.** NOAA NCEI answered. I pulled ETOPO 2022 60″ surface elevation over OPeNDAP, every third arc-minute: 104 MB in `tmp/data/etopo2022_60s_s3_band*.dods`. CRU CL 2.0 also answered, and I have the 10′ `tmp`, `pre` and `elv` files and the readme. WorldClim answered too, but its licence says "Redistribution or commercial use is not allowed without prior permission", so it's out. NOAA PSL refused the connection, and I didn't retry it. SoilGrids' 5 km aggregates are listed (sand, silt, clay, soc, phh2o) but I haven't downloaded them. Licences: ETOPO is US-government data (cite NOAA NCEI 2022, doi:10.25921/fd45-gt74). CRU is ODbL plus DbCL, attribution and share-alike, so the packed grid itself must ship under ODbL with a notice.

**#1 packed.** The KG grid has 356,253 land cells, as you said. Each cell is a mean of 25 three-arc-minute samples, stored as a √ byte (error 26 m at most, 6 m on average), delta-coded from the left neighbour, then zopfli. That is 149.5 kB, and **149.9 kB in the page** as base64 inside the page's deflate, unpacked with `DecompressionStream('deflate-raw')`, which the bootstrap already uses. Raw base64 under the outer deflate costs 188 kB and raw UTF-8 bytes 173 kB, so pre-compress the data. At 10′ it's 801 k cells and 314 kB, which is twice the cost for detail the range's erosion invents anyway. Stay at 15′.

Two corrections:
- I first averaged all samples in a cell, and that put 11,187 "land" cells below sea level, because coastal cells pick up sea floor. Average land samples only; that leaves 2,025, mostly the Caspian and Dead Sea basins.
- A cell mean is not where a plot stands. Innsbruck's cell mean is 1,433 m; its lowest sample is 579 m, which is the valley floor (574 m). Plots sit on streams, so add a floor byte (floor as a fraction of the mean). Mean plus floor is **218 kB**.

**#2 packed.** CRU has 67,129 land cells at 0.5°, not 90 k, because it leaves out Antarctica. Reduce temperature to sea level with CRU's *own* `elv` offline, not ETOPO's: they differ by 122 m rms (about 0.8 °C). Then lapse at run time to the #1 floor.

Your 7-byte code (one temperature harmonic) is 167 kB, but it moves 12.5 % of cells to a different Köppen class from CRU's own months: ET drops from 93 % to 82 % agreement with KG, and Dwb from 67 % to 41 %. The one harmonic flattens the warmest month, which is the very month the 10 °C rule reads. Two temperature harmonics (9 B) cost **197 kB** and keep 90.7 %. All twelve months cost 507 kB.

The honesty problem is bigger than the coding. Measured CRU 1961–90 months reproduce the KG class (Rubel 2017, 1986–2010) in only **78 %** of cells, and the first letter in 92 %. If the class comes from KG and the months from CRU, a fifth of places would show months that contradict their label. So keep KG as the class, start `place()`'s nudge from the CRU months instead of the zonal sketch, and publish the size of the nudge. Agreement by class is in `tmp/rowan_scripts/kop.mjs`'s output: Dsc agrees 12 % of the time and Aw 51 %.

**A rule question for Sam.** ETOPO calls itself a "Global Relief *Model*", and CRU is splined from station data. I read the brief's "no model" as "no meshes or assets", but that's the owner's call. Ask before shipping.

**#3 globe.** No WebGL1 concern (gl.js:259 is WebGL2-only), and one texture fetch per fragment is nothing on a phone. The trouble is elsewhere:
- Linear filtering of a class channel blends class indices, and mipmaps average them. Keep class (or its palette colour, computed at run time) NEAREST in its own texture, and height LINEAR in another.
- `sun3` declination comes in four steps (`[0, 23.44, 0, -23.44][season]`, main.js:95), so the terminator jumps between seasons. Call it seasonal, not "real".
- The ladder is index-bound: `LAD`/`STEP` at :333, and `i === 1`, `i + j === 1`, `j === 1` at :366–371. Putting the globe at index 0 renumbers all of them.
- A `mixed` or `boreal` home has no place on Earth. The globe rung must exist only for Earth homes, or it marks a fiction on a real planet.
- Build the sphere as `B.xm` meshes (gl.js:334, as the cave does), not as the heightfield.

**#4 water.** The bucket's inputs aren't physical: the weather is whatever the user clicked, and a clock "day" is an eighth of a year (main.js:247). A "dry week" doesn't exist in this sim. Do it after CRU: run a Thornthwaite balance from the place's months, T and day length (`G.cl.day`), on `yearF`, with current rain as a short decaying term. The stomata are kinds 12 (guard cells) and 13 (pore) at micro.js:136–137. A vertex shader can't find the pore centre for kind 12, so snapshot the aperture at dive time. Real stomata take tens of minutes to close anyway.

**#6.** `extra.pool` has 13 species (genome.js:139), not ~30 genera. For Europe, cite Caudullo et al. 2017 (CC BY 4.0, figshare, which I didn't test) rather than the EUFORGEN maps. **#1 range:** `HIST` (range.js:10) keeps 11 × 256² floats, which is 2.9 MB per place, and never evicts. Key it on lat/lon and keep three places. Longitude spans need cos(lat): 640 km at Tromsø is 16.6°.

### Agreed for this round

1. **Measured ground.** Ship `etopo.js`: the 15′ land mean plus a floor byte (218 kB measured), base64 of raw deflate, decoded once on first use. `place()` takes the floor at the clicked cell, and the climb slider means "above the ground". The README states the source, how it was sampled and the licence.
2. **Range from the measured window** (Earth homes only). Build the uplift bilinearly from the 15′ means over a cos(lat)-correct 640 km window. Erosion carves it, and a mean-preserving correction per measured cell follows. `spot()` is the clicked point, with sampling rotated so downhill runs +x and the hint giving north. Key `HIST` on the place, evicting past three. Fictional genomes keep their belts and say so.
3. **Treeline from months.** In RANGEG and FARD, `tl = h_plot + (Tmax − 10)/6.5` km from `G.cl.T`, with a uniform carrying it. Label it "modelled months" until item 4 lands.
4. **CRU months as the starting point.** 9 B per cell (197 kB), reduced to sea level with CRU's own elevation offline and lapsed to the floor at run time. `place()` nudges from these months instead of the sketch. The README gives agreement with KG per class and the median nudge. ODbL notice in the page.

Checks: lower rungs byte-identical, `grow_test` clean, renders of Innsbruck (valley floor, Inn range), Quito and Tromsø, and Sam's ruling on "model" before publishing.

### Queue toward 2 MB

1. A Thornthwaite water bucket from the measured months, then haircap folding, tardigrade tuns and stomata snapshotted at dive time.
2. The globe at the top, for Earth homes only: re-index the ladder, NEAREST class and LINEAR height textures, a mesh in `B.xm`, a seasonal terminator.
3. SoilGrids 5 km at 1° (CC BY 4.0; reachable, not yet packed) under the soil world.
4. Genera by measured range: Little (USGS) and Caudullo et al. 2017, mapped onto the 13 species in the pool, flagged elsewhere.
5. The needle leaf, galleries by host, and plot seedlings and litter by distance.
6. Snowline and `G.cl.snow` from the measured months below 0 °C.

## Builder, after building

Built items 1–4. Where I departed from the plan:

- **All twelve months, not two harmonics.** Rowan measured the 9-byte harmonic code at 197 kB, keeping 90.7% of
  cells in their class. Storing all twelve months costs 505 kB, and the 2 MB rung has room. I chose the measured
  months over a fit to them, so the only loss is quantisation (half a degree; a log byte for rain). Elevation (mean
  plus floor) and climate together come to 802 kB of deflate in one string, inflated once in about 0.1 s. The 2 MB
  rung went from 114 kB to 919 kB.
- **The nudge works on the months themselves.** It searches a shift, a stretch of the yearly swing and a rain scale,
  in that cost order, and the place's line prints the result. The old sketch is kept only as the fallback, for
  Antarctica and the instant before the grids are inflated.
- **The snowline as well as the treeline.** Both are in one `uTl` vec4: treeline at a warmest month of 10 °C,
  snowline roughly at 1 °C. Without the snowline, Quito's valley would have shown snow below its own forest. The
  1 °C rule is mine and isn't checked against glacier data; the README says so.
- **The range window is north-up, not rotated.** Rowan wanted downhill turned along +x. The plot sits at the window's
  centre, which is the clicked point.
- **One bug worth recording.** The range's priority flood marks a cell as visited by giving it a height of zero or
  more, so a sea at −0.3 km was pushed again forever and the tab ran out of memory. Heights in the range are now
  kept above zero.

Checked:
- The 20 kB and 200 kB rungs are byte-identical.
- `grow_test` is clean.
- Place lines read right:
  - Innsbruck: no nudge, 10.2 °C a year, 2 to 19 °C by month, 1,084 mm, ground 585 m.
  - Quito: nudged −1 °C, ground 2,095 m, which is the cell floor, below the city.
  - Tromsø: Dfc, −4 to 12 °C by month, ground 18 m.
- The ranges, rendered:
  - Quito: the Andes, with the Pacific to the west.
  - Innsbruck: the Alps, with the Adriatic to the south. They are lower and greener than the real Alps, because a
    28 km mean flattens the peaks.

Not done: Tromsø's range, the globe, the bucket, and anything on a phone.

Open question for Sam: ETOPO calls itself a relief model. Is a DEM a "model" under the page's rules? It is shipped
as data and labelled, it is easy to remove, and the README says it is the borderline case.
