# Round 3

Ash and Rowan are two Claude agents; Ash proposes, Rowan checks against the code. Unedited except for typos.

## Ash

Rowan, the top of the ladder is true and the rest isn't. From Innsbruck the real Alps arrive only after a dissolve, the valley is still `420 * ridge()` noise (valley.js:20), and nothing below the plot reads the measured months. This round is about the seams.

Five of seven reuse the 802 kB we ship; only #6 and #7 need new data. Ranked by one world per byte and per hour:

**1. Put the range on the valley's horizon (reuse; code ≈1.2 kB; one sitting).** Today the valley stops at 3 km and the range appears only after the cut. Instead:
- Build the range lazily after an Earth plot's first frame (`HIST` caches it).
- Add a third band of rings to `valley()`, from 3 km out to about 150 km, sampling the range's eroded `Hgt` at true height (the range draws heights ×10, so divide here).
- Inside 3 km, drive the valley's ridge amplitude from ETOPO's mean minus floor at the clicked cell, which is 854 m at Innsbruck, instead of the fixed 420 m. Label it "relief measured, shape modelled".

You'd see the Nordkette above the plot's own trees, and zooming out becomes one camera move; valley to range just sheds the near rings. Cost: the range build, maybe 0.3–0.8 s off the critical path, plus one far, fogged mesh of about 4N×K vertices. **The biggest seam for the fewest bytes.**

**2. One sky, one calendar (reuse; ≈500 B; two hours).** Three jumps at every dive:
- **North rotates.** With `G.cl`, `sun3` puts the azimuth at `A.sun[1]*RAD + …` (main.js:96), and every world has its own `A.sun[1]`: an Earth plot inherits its base forest's 35, the range uses 150, the log 140, the soil 200. Carry the home `A.sun[1]` in the site record, so the sun stands in the same part of the sky at every scale.
- **The year moves in quarters.** `season = floor(yearF*4)` (main.js:253) and the declination comes from a four-entry table. Use `decl = 23.44·sin(2π(yearF − 0.22))`, read the measured month as `T[floor(yearF*12)]`, and interpolate between months. `uTl` then rises and falls through the year instead of in steps. Keep `season` for the buttons.
- **Snow, rain and the treeline** read the current month, not the class.

**3. A Thornthwaite bucket from the shipped months (reuse; ≈1.5 kB; one sitting).** Your queue item 1. Compute PET from the month's T and `G.cl.day`, take the monthly P from CRU, and step soil water on `yearF`, with rain the user clicked as a short decaying term on top. Pass `soilW` down through G at each dive. Then:
- Plot: stream level and mushroom flushes follow it.
- Moss: haircap folds its leaves when dry.
- Soil: tardigrade tuns and slow nematodes.
- Leaf: stomatal aperture is snapshotted at dive time, as you said, for kinds 12 and 13.

Innsbruck in August and Quito in its dry season differ at 0.64 mm: the first measured number to reach the bottom.

**4. The next world in a window before the swap (reuse; ≈3 kB; a full sitting).** This makes the transition itself continuous:
- Build the inner world as the glide starts (about 0.3 s, so the stall comes before the camera moves).
- Give gl.js a second loaded world, drawn with one model transform: scale 1/F, translated to `tgt`, offset so its ground meets the outer `Hgt(tgt)`.
- Add one `uHole` vec4 to the mesh, cap and card fragment shaders, so the outer world discards inside a disc of radius 0.4·S/F around `tgt`.

As the camera closes, the real 64 cm log already lies in the plot's floor with its moss; at the hand-off the outer world stops drawing. No dissolve, no frozen frame. Memory: two worlds, about 11 MB by your phone figures. The inner world's vertices all run but fill a small disc; time the boreal moss step. Fit the inner rim to a plane through the outer ground. This is what turns the slideshow into one world, but #1–#3 are cheaper.

**5. The globe as the top rung, Earth homes only (reuse; ≈3 kB; a sitting).** Your queue item 2, as scoped:
- KG class NEAREST and height LINEAR, in two textures;
- the sphere in `B.xm`;
- the ladder re-indexed;
- the terminator from #2's continuous declination, so it's no longer seasonal steps.

It binds upward only, so it ranks below the inward work.

**6. SoilGrids under the soil world and the plot floor (new data; ~40–60 kB guessed, not packed; a sitting).** Sand, silt, clay, SOC and pH from the 5 km aggregates at 1°, about 22 k land cells × 4 B.
- The soil world: grain sizes from the texture triangle, hyphal density from SOC.
- The plot: `G.floor.lit` and the soil colour from the same numbers, so the plot floor and the soil world agree.

It replaces `soil()`'s unverified table; CC BY 4.0. Pack it before we decide.

**7. Genera by measured range, then the hosts below (new data ~10–20 kB; two sittings).** Little (USGS) plus Caudullo et al. 2017, mapped onto the 13 pool species and flagged per cell where neither source covers it. Then the needle LEAFG branch and galleries by host, so the measured tree carries on into its log, its bark and its leaf.

**Not proposing** a hydrology chain, the range's drainage area setting the plot's stream width. The range's `A` is modelled erosion over a 28 km mean, so the number would look measured and isn't.

This sitting: #1 and #2, which share the site record; #3 and #4 next. Three checks: time `rangeLand` under an Earth plot; confirm the per-world `A.sun[1]` rotation in a render; and tell me whether the `uHole` discard breaks early-z badly enough on a phone to matter.

## Rowan

Ash, I ran your three checks. Your line readings hold: valley.js:20 is the fixed `420 * ridge`, main.js:96 adds `A.sun[1]`, and main.js:253 quarters the year. The fixes need changing in four places.

**Check 1: timing.** In Node I gave `rangeLand` the real `elev` window, the same call grow.js:73 makes, after `ready` inflated (58 ms).

| Place | Cold | Cached in `HIST` |
|---|---|---|
| Innsbruck | 778 ms | 83 ms |
| Quito | 666 ms | 77 ms |
| Tromsø | 596 ms | 77 ms |
| Iowa | 770 ms | 88 ms |

That is on this sandbox's CPU; a phone is likely 3–5× slower, so 2–4 s. "Off the critical path" isn't true: it's one synchronous call on the main thread, so the plot freezes while it runs. A Worker won't help in a minified single-file IIFE, because `rangeLand.toString()` loses its closure. Turn the 30 erosion passes (range.js:33–47) into a generator and run one per frame. That's about 25 ms a pass here.

**Check 2: north.** Confirmed in code; the render doesn't show it.
- The range is north-up: grow.js:73 maps −z to north.
- The solar term in `sun3` is measured from south, so `A.sun[1] = 0` puts the noon sun at +z, which is south.
- So the range's own `150` lights the measured Alps from 150° off true. The plot's inherited `35` and the log's `140` are arbitrary too.

Your fix of carrying the home azimuth down is backwards for the range: the range is the one world with a true north. Set `A.sun[1] = 0` in `earthGenome` and carry that down. Then every Earth world shares one north, and the valley rings need no rotation.

The render (tmp/r3/inn.png, Innsbruck at noon, range from above) is too coarse at render scale 0.44 to read the shading. It does show something else: **the measured window is blocky**, squares a cell wide. The cause is grow.js:73 calling `elev()`, which returns the nearest cell (earth.js:38). The blur correction (range.js:45) keeps the steps because they're already in `h` (range.js:21). Interpolate between the four nearest cells.

**Check 3: `uHole` and early-z.** I can't measure a phone here; this is from the code. Capsules already write `gl_FragDepth` (gl.js:80, :105), and cards already `discard` (gl.js:204, :208), so both already lose early-z and Apple's hidden-surface removal. Adding `discard` to MSHF costs it only for the land. The land is drawn first (gl.js:332), but its shader is the heaviest per pixel (FARD noise). Use a stencil instead: draw the inner world where stencil = 1 and the outer world where it isn't. Then nothing discards, and neither world's depth has to agree with the other's. That needs `DEPTH24_STENCIL8` at gl.js:284.

**#1, the horizon.** Three problems you missed:
- **Far plane.** At plot range `f.nf` is `[0.1, 4000]` (main.js:288), so nothing beyond 4 km draws at all. Pushing the far plane to 150 km with a 0.1 m near plane leaves a 24-bit depth step of about 13 km out there, so ridges would mis-sort. Draw the far band in its own pass with near/far `[1000, 150000]`, clear depth, then draw the near world.
- **Earth's curvature.** The drop is d²/2R: about 200 m at 50 km and 1.8 km at 150 km. Without it, distant peaks loom far too high. Subtract d²/(2 · 1.15 R), where the 1.15 allows for refraction.
- **Index range.** Fog won't hide the band, because `fogc` thins with height at a 14 m scale (`uFog.y` = 0.07, gl.js:51). So the peaks will show and the low ground will haze out, which is right. The valley's mesh is 49 rings of 512 vertices with `Uint16` indices (valley.js:74). A separate band mesh stays under 65,536 vertices up to about 120 rings.

The range's centre sits 740 m above the plot at Innsbruck (1,325 m against a 585 m floor). The band has to ramp from the valley rim up to it; that wall is real (the Nordkette). Peaks top out at 2,903 m in that window, against 3,768 m for the Wildspitze, because the 15′ mean flattens them. Say so, or add a cell-maximum byte. The floor byte cost about 68 kB, so expect something similar.

**#2, the calendar.** Your `23.44·sin(2π(yearF − 0.22))` assumes year 0 is 1 January. But `season = floor(yearF·4)` with `SEA[0] = 'Spring'` (main.js:24) means year 0 is the start of spring. Take 1 March:
- the declination is `23.44·sin(2π(yf − 0.054))`;
- the calendar month is `(floor(yf·12) + 2) % 12` in the north and `+ 8` in the south, because `season` is local (main.js:95 flips the declination's sign for the south), while CRU months are calendar months;
- interpolate `uTl` from the two nearest months.

**#3, the bucket.** `G.cl.day` holds two numbers, the solstice day lengths (earth.js:109). Thornthwaite needs a day length for every month, which is one line from latitude and declination. The stream level is fixed at build time (`strm.lvl`), so it can follow the bucket only when the plot regrows. Say so.

**#4, the window.** It's about 5–6 kB, not 3:
- The capsules are ray-cast in world space from `uCam` (gl.js:105), so one model transform won't do. Draw the inner world with its own scaled camera.
- Its pick and DoF depth (`vz/300`) has to be divided by F.
- It needs its own shadow pass, which doubles shadow cost for the length of the glide.
- It needs a rotation as well as scale and translation. The log in the window has to lie along the trunk you dived at (`stand` records carry its direction), or the 64 cm log will cross the outer trunk at an angle.

### Agreed for this round

1. **One north and a continuous year.** Set `A.sun[1] = 0` in `earthGenome` and carry it down in the site record. Make the declination continuous with year 0 = 1 March, and read the calendar month as `+2` north and `+8` south. Interpolate `uTl` and snow between months. Keep `season` for the buttons and the chronicle.
2. **A smooth measured window built in steps.**
   - Interpolate `elev` across the four nearest 15′ cells, so the range has no cell-sized steps.
   - Make `rangeLand`'s erosion a generator that runs one pass per frame and caches into `HIST`.
   - After an Earth plot's first frame, build its range that way in the background.
3. **The range on the plot's horizon.**
   - **Mesh:** a separate band mesh from 3 km out to about 120 km. Heights are `rangeHgt·1000 − floor − d²/(2·1.15R)`, ramping from the valley rim.
   - **Drawing:** its own pass at near/far `[1000, 150000]`, drawn first, then clear depth.
   - **Near relief:** set the near ridge amplitude from mean minus floor, labelled "relief measured, shape modelled".

   Check it with a render of Innsbruck looking north at the Nordkette, and time it with the clock running.

Each item needs: lower rungs byte-identical, `grow_test` clean, and renders of Innsbruck, Quito and Iowa (where the far band must show flat ground).

### Queue toward 2 MB

1. A Thornthwaite bucket with day length per month, snapshotted to stomata, haircap and tardigrades at dive time; stream and mushrooms follow it only on regrow.
2. The next world in a window: stencil, not `discard`; a scaled inner camera with its own shadow pass; aligned to the trunk's axis. Time it on boreal → moss.
3. A cell-maximum height byte, so real peaks reach the range and the horizon (about 70 kB).
4. The globe, for Earth homes only, with the terminator from item 1.
5. SoilGrids, packed and measured before deciding.
6. Genera by measured range, then the needle leaf and galleries by host.

## Builder, after building

Built items 1 and 3, half of item 2, and one extra.

- **One north and a continuous year: built as agreed.** The site record carries the place's azimuth (`G.cl.az = 0`)
  down every dive, and the solar azimuth's sign is flipped for real places so afternoon light comes from the west
  (+x is east). The declination is continuous. Snow on the ground follows the interpolated month at the plot. The
  valley and range snowlines are now computed per frame on the CPU, so the shaders just read `uTl`. Fictional forests
  get the same numbers as before.
- **Smooth window: half done.** The bilinear four-cell lookup is in, so the range is no longer one cell blocky and the
  coast steps half as hard. Not done: the erosion generator. The range still builds all at once on zoom-out (about
  0.8 s on a laptop), because the horizon turned out not to need the range at all.
- **The horizon: built differently.** Rowan planned it as the range sampled out to 120 km. Instead it is a band
  built straight from the measured cells (14,600 vertices, a few ms to build, using the valley's vertex layout and
  shader). For relief within a cell I added each cell's highest point as a third plane. It cost 164 kB, not
  Rowan's ~70; I measured it. The band is drawn first with near/far [300, 200,000] and the depth buffer is then
  cleared, as Rowan proposed. Its inner edge sinks 40 m so the valley's rim hides the seam.
- **Extra: valley relief from data.** The ridge amplitude is (mean − floor) × 0.9, clamped to 40–1,500 m.
- **A trap for next time.** Pulling the land uniforms into a helper `const lu = TIER > 3 && (...)` left `lu=!1` in
  the 20 kB build and reshuffled every minified name. Only inlining the T4 copy kept the lower rungs byte-identical.

Checked:
- The lower rungs are byte-identical, and `grow_test` is clean.
- Renders from 3.2 km out:
  - Innsbruck, north and south: the valley, then hills to the skyline, with pale tops far off to the south.
  - Des Moines: flat to the edge.
  - Quito: green relief to the west.

Honestly, the renders are too low-resolution to judge how the band's ridges read. Its canopy pattern at 50 km may
shimmer on a real screen. Not seen at all: a phone, and the horizon at night or in winter.
