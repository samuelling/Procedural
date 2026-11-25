# Round 4

Ash and Rowan are two Claude agents; Ash proposes, Rowan checks against the code. Unedited except for typos.

## Ash

Rowan, the measured world now stops at the plot. Below it, Innsbruck in January and Manaus in July differ only through `G.cl.T` feeding snow and `uTl`: both have a living leaf, a bare log, and dew every dawn (gl.js:211, `DEW = max(smoothstep(.5,.15,uSun.y), uWx.x)`, so even the Atacama gets dew). I mark each change **M** (measured number), **R** (rule applied to measured numbers) or **S** (sketch).

**1. Two buckets, water and snow, from the shipped months (reuse; ≈2 kB code).** Stepped beside `yearF` (main.js:252), passed down in the site record (main.js:134) as `sw` and `swe`.
- **Water:** Thornthwaite PET from `mon()`'s T, with day length per month from latitude and the continuous declination you specified.
- **Snow:** a degree-day snowpack. P is stored as SWE when T < 0 and melts at about 3 mm/°C/day.

Both R over M:
- **Plot:** snow cover from SWE, not the month's T, so late March at Innsbruck still has snow lying; mushrooms follow `sw`; the stream only on regrow.
- **Log (64 cm):** Innsbruck's January pack (20–30 cm if the rule holds) is a white land layer at `Hgt + depth` with only the log's top showing; slugs (kind 9) dormant, active only at high `sw`. Manaus: always wet, unchanged.
- **Moss (6.4 cm):** under a pack, a dim blue space below a snow ceiling near 0 °C, where springtails really winter; dry haircap folds its leaves (lower `dr`).
- **Soil (6.4 mm):** unfrozen under snow, so nematodes stay active; still on bare frozen ground; tardigrades tun when dry.
- **Leaf:** stomatal aperture is snapshotted from `sw` at dive time.

**2. Phenology from the measured months (reuse; ≈1 kB).** Replace the four-step leaf calendar with dates from `G.cl.T`: leaf-out at about 5 °C plus a degree-day sum, fall below about 10 °C; evergreens (`ev`) never. All R; thresholds from memory, marked unverified.
- **Plot:** `uSe.x/.y` from the dates: Innsbruck colours in October, Manaus never.
- **Log:** litter freshness follows days since fall: gold in November, skeletal by June.
- **Moss:** open canopy between fall and leaf-out, so more light in spring.
- **Leaf:** between fall and leaf-out a deciduous dive lands on a fallen leaf with hyphae, or a needle; LEAFG's chloroplasts yellow on the same date.

No data, all five scales: the best value here.

**3. Relative humidity and diurnal range from CRU (new data; I'd guess ≈40–60 kB each as three harmonics; please pack them).** Dawn is T − DTR/2; the dew point comes from `reh` by Magnus; dew when dawn is below it, hoar frost when also below 0 °C. R over M, replacing gl.js:211 with a `uDew` vec2 (dew, rime).
- **Plot:** dew only on nights that earn it; white needle tips; valley fog at saturated dawns (Innsbruck's January inversion).
- **Log:** rime along the bark edges, and the elf cups beaded.
- **Moss:** drops of about 1–3 mm on the shoot tips, as lenses at true scale.
- **Leaf:** dew droplets of about 100 µm, which is 10 units, sitting on the cuticle. Frost shows as a feathery rime on the hairs.

Check: harmonics may flatten DTR as they flattened Tmax; measure dew-night misclassification against twelve months before choosing the coding.

**4. Wet-day frequency and sunshine from CRU (new data; ≈40–60 kB each).** The clock's weather becomes a two-state Markov chain with wet probability `wet/days` (R over M); sunshine sets the baseline overcast `f.wx[2]` (M); the button stays as an override.
- **Plot:** the counts decide, not my memory: Manaus's wet March against its drier August, Innsbruck's summer storms.
- **Log:** slugs out after rain.
- **Moss:** raindrops.
- **Bucket:** #1 gets real rain events instead of clicks.

It binds less than #3, but makes the weather itself measured.

**5. SoilGrids under the soil world (new data, guessed ≈40–60 kB; pack it).** Sand, silt, clay, SOC and pH at 1°.
- **Soil world:** grain sizes from the texture triangle (M, mapped by R), and hyphal density from SOC (R).
- **Plot:** the floor's litter and mineral colour from the same numbers, so the plot and the soil world agree (R).
- **Moss:** low pH favours *Sphagnum* or haircap. That rule is S, so I'll keep it gentle.

**6. Genera by measured range (new data ≈10–20 kB).** Little plus Caudullo, mapped onto the pool. M for presence; everything below inherits it through `site.sp`, then the needle leaf and host galleries.

**Not proposed:**
- CRU wind: below the plot the air is near-still everywhere.
- CRU ground-frost days: CRU partly derives them from tmp and DTR, so with #3 we compute them (R) rather than ship a derived layer as measured.

**Ranked by one world per byte:** 2, 1, 3, 4, 5, 6. #1 and #2 are about 3 kB of code and no data, and make January and July differ at every rung. #3 adds about 100 kB and is the most visible, dew and rime at every scale. This sitting: #2 and #1, with render checks of the snow-covered log (Innsbruck, 15 January) and the leaf (Manaus, 15 July); then #3 once packed.

## Rowan

Ash, I checked your readings against the code, fetched the humidity and diurnal-range data, and tested your snow rule on the data we ship. One finding stops the Innsbruck render check before it starts.

**Your readings of the code.**
- **Dew.** The dew term is in CRDF, the card shader, only (gl.js:211). It is multiplied by `(1 − uWx.y)`, and it draws only on cards seen from very close (`FP < .004`, fx.js:666). So the Atacama does get dew, but only on close-up leaves.
- **Evergreens.** `ev` is set only on Earth's evergreen broadleaves (earth.js:139–146). The pool's conifers don't carry it, and larch is deciduous. Use `ev || (leaf.t === 1 && id !== 'larch')`.
- **Animals.** Slugs are life kind 9 (fx.js:135), as you said.

**Innsbruck has no snow at the floor in our data.** The shipped months, lapsed at 6.5 °C/km from the half-degree cell's mean height (about 1.65 km) down to the 585 m floor, give a January mean of **+1.9 °C**. The real valley is around −1.5 °C (from memory, unverified). Winter valleys pool cold air, and a fixed free-air lapse can't know that. Run with the degree-day rule, the plot builds **0 mm** of snow water by January and 0 by March (tmp/rowan_scripts/snow_test.py), so a render of the snow-covered log on 15 January would show bare ground.

We need a lapse rate that is weaker in winter; I recall Rolland (2003) reporting lower Alpine lapse rates in winter than in summer, unverified. And the README should state the bias. Until then, check the snow log at Tromsø.

**The snow rule.** Your 3 mm per °C per day is inside Hock's (2003) range for snow, "2 to 7 mm d⁻¹ °C⁻¹" ([Hock 2003, J. Glaciol.](https://cambridge.org/core/services/aop-cambridge-core/content/view/S0022143000003087)). The weak part is using the monthly mean, not the rate. I compared two versions:

| Place | Month-mean rule, Jan / Mar SWE | Days spread ±4 °C (σ), Jan / Mar SWE |
|---|---|---|
| Tromsø | 291 / 440 mm | 54 / 69 mm |
| Boston | 206 / 47 mm | 45 / 0 mm |

The choice of rule moves snow water by up to five times. With the diurnal range shipped (below), take the daily spread from each month's own range instead of my arbitrary 4 °C (still a rule, labelled). Convert snow water to depth at a stated density.

Under snow: at "around a half-foot or more", the subnivium stays "just around freezing", and "some invertebrates remain active" ([UW–Madison CALS](https://grow.cals.wisc.edu/departments/front-list/five-features-of-the-secret-ecosystem-under-the-snow)). That page doesn't name springtails; that part is unverified, though snow fleas are springtails.

**Phenology thresholds.**
- **Spring.** "A forcing temperature threshold of 5 °C is commonly used in temperate regions" ([Fu et al., PMC3468505](https://pmc.ncbi.nlm.nih.gov/articles/PMC3468505)). But the sum needed (F*) is fitted per species and depends on winter chilling, so any number we pick is a sketch. Mark it S.
- **Autumn.** I found no source for a 10 °C monthly-mean rule. Delpierre et al. model leaf colouring as triggered by photoperiod, followed by a cold-degree-day sum ([abstract](https://modis.gsfc.nasa.gov/sci_team/pubs/abstract_new.php?id=01144)); no numbers there. Mark it S.
- **A better rule.** Jolly, Nemani & Running's (2005) Growing Season Index ([record](https://scholarworks.umt.edu/ntsg_pubs/148)) multiplies three ramps: minimum temperature, photoperiod and vapour-pressure deficit. The photoperiod ramp of 10–11 h is confirmed through Daham et al. (2018) ([pdf](https://core.ac.uk/download/151188326.pdf)), who use their own 0–20 °C and 125–5,100 Pa for the other two. Jolly's own −2 to 5 °C and 900–4,100 Pa are from my memory, unverified. All three inputs come from tmp plus the new two grids: minimum temperature is T − DTR/2, and the deficit comes from vapour pressure and Tmax. That turns your rule into one fed by measured inputs, and it also handles savannas that drop leaves in the dry season, which a temperature rule can't. Ship the temperature-only version now, labelled S, and switch to GSI once the grids land.

**Humidity and diurnal range: measured.** Both came from https://crudata.uea.ac.uk/cru/data/hrg/tmc/ and are in tmp/data/:
- `cru_cl2_grid_10min_reh.dat.gz` (11.8 MB)
- `cru_cl2_grid_10min_dtr.dat.gz` (8.6 MB)

Both have all 566,262 cells and the same licence as before (ODbL plus DbCL). Packed in pack_data.py's month layout (12 planes, change from the month before, then change from the cell before) over the 67,129 half-degree cells, zopfli sizes:

| Coding | zopfli | Dew/no-dew flips | Worst error |
|---|---|---|---|
| reh 1 % + dtr 0.5 °C | 338 kB | 0.53 % | 0.62 °C |
| dew-point depression + dtr, 0.5 °C | 295 kB | 1.75 % | 0.37 °C |
| dew-point depression + dtr, 1 °C | **226 kB** | 3.5 % | 0.75 °C |
| mean + 2 harmonics of each, 0.25 °C | 122 kB | 1.7 % | 10.6 °C |

Flips are cell-months where the dew answer differs from the unquantised field. Separately, reh at 1 % alone is 181 kB, and dtr at 0.25/0.5 °C alone is 197/157 kB.

The harmonic form breaks badly in some cells. New et al. warn RH errors of "up to ±15 %", which is about ±2–3 °C in dew point, so 1 °C steps sit inside the data's own error. My pick is **226 kB**, which takes the rung from 1,085 to about 1,311 kB. Your guess of 40–60 kB each was low.

**How the dew rule should use them.**
1. **Vapour pressure.** CRU made its RH as 100·e/es(T mean) (New et al. 2002), so e = RH/100 · es(T) inverts it exactly. es is Magnus: 6.1094·exp(17.625T/(T + 243.04)) hPa. Compute it at the cell's own height (offline, so we ship the depression T − Td). At the plot, keep RH and recompute at the lapsed T. That step is a rule, R.
2. **Dew point.** Td is the inverse of Magnus.
3. **Leaf surface at dawn.** Tsurf = T − DTR/2 − ΔT. ΔT is about 2 °C on clear, calm nights ("a few degrees", [Met Office](https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/frost-and-ice/forecasting-frost); the 2 is unverified) and about 0 when overcast, windy or raining.
4. **Classify on the margin, don't scale by it.** Margin = Tsurf − Td, and dew = smoothstep(1, −1, margin). The size of a negative margin means nothing: Quito's months put Td 6 °C above dawn, and air can't be that supersaturated.
5. **Frost.** If also Td < 0 °C, it's hoar frost (rime). If Td ≥ 0 but Tsurf < 0, it's dew that then freezes. Strictly, frost needs the frost point over ice, which is a little above Td.
6. **Timing.** Multiply by the existing dawn envelope (`smoothstep(.5, .15, uSun.y)`) and send it as `uDew = (dew, rime)`.

The shipped months give:
- Manaus: margin −3 in both January and July, so dew on every clear night.
- Calama: +3.7 and +5.6, so never.
- Innsbruck's cell: January −1.3, hoar frost; July −1.7, dew.

Coastal fog in the Atacama (camanchaca) is outside this rule. Say so.

**Agreeing with you:** frost days computed from our own grids, not shipped (CRU derives them); no wind.

### Agreed for this round

1. **Phenology from the months, as a sketch.**
   - Leaf-out at a 5 °C base plus a degree-day sum, leaf-fall on a cold-season rule, evergreen = `ev || (leaf.t === 1 && id !== 'larch')`. Thresholds labelled S with these citations.
   - It drives `uSe.x/.y`, the log world's litter freshness, and the leaf world's fallen-leaf case.
   - Render check: Manaus in July stays green; a beech plot at Innsbruck colours in October.
2. **Winter valley temperatures, then the snowpack.**
   - A month-dependent lapse to the floor, weaker in winter, numbers marked unverified. Print January at the Innsbruck floor next to the station value in the place line's check.
   - Then the degree-day pack at 3 mm per °C per day (Hock's 2–7) and Thornthwaite water, both carried down in the site record.
   - Plot snow cover from snow water, the log under snow, snowpack depth at a stated density.
   - Render check: the snowy log at Tromsø; Innsbruck only once item 2's January is believable.
3. **Dew and rime from measured months.**
   - Ship dew-point depression and DTR, 12 months each at 1 °C (226 kB, measured), labelled CRU plus Magnus.
   - Feed `uDew` (dew, rime) by the rule above, replacing gl.js:211's always-dew.
   - Render check: Manaus at a July dawn, dew; Calama, dry; Innsbruck in January, rime.

Each item needs: lower rungs byte-identical, `grow_test` clean.

### Queue toward 2 MB

1. Phenology on the Growing Season Index (minimum temperature, photoperiod, deficit), once item 3's grids are in; the snowpack's daily spread from DTR.
2. Wet days (rd0, 10 MB source) for a Markov weather chain, and sunshine for the cloud baseline. Pack and measure first; my guess, unmeasured, is 100–150 kB each at 12 months.
3. The bucket's effects below the plot: haircap folding, tardigrade tuns, stomata snapshot, dormant slugs.
4. SoilGrids, then genera by measured range and the host-specific inward details.
5. The next world in a window, and the globe.

## Builder, after building

Built all three items. Where the build departs from the plan:

- **Dew and rime: as agreed.** I packed both variables into `pack_data.py`'s month layout (12 planes each) and
  measured the cost: 228 kB, against Rowan's 226. At the plot the dew-point depression is kept as shipped rather
  than recomputed at the lapsed temperature; humidity held, that is close enough at whole degrees. Dew and rime
  ride in `uCv.zw`, which is now a vec4: rime whitens the leaves at dawn, and the dew drops are gated by `uCv.z`.
  Fictional forests keep dew at every dawn, as before.
- **Snowpack: as agreed, with DTR spreading the day.** Eight points through each day, 3 mm of melt per degree-day,
  and snow below 1 °C, spun up over two years. The Thornthwaite water bucket isn't built yet. It moves to round 5
  with the small worlds that would read it.
- **Winter lapse: built, and still short.** The lapse rate is 5.4 − 1.2·cos(month) °C/km, scaled by latitude up to
  30°, applied from the 15′ cell mean (not CRU's half-degree height, which isn't shipped) down to the floor. That
  brings Innsbruck's January from +1.9 to −0.2 °C. Rowan's −1.5 for the station is from memory. Either way, the
  snow test is Tromsø's, as Rowan said.
- **Phenology: a sketch, labelled as one.** I used Ash's thresholds; for the colouring rule Rowan found no source.
  Only deciduous broadleaves are affected (`uSe` is already gated by the needle fraction in the shaders).
  Evergreen broadleaves on Earth hold their leaves. The Growing Season Index stays queued.

Checked:
- The lower rungs are byte-identical, and `grow_test` is clean.
- In Node, `place()` gives:
  - Tromsø: 123 and 261 mm of snow water in mid-January and mid-March.
  - Innsbruck: leaves out on 11 May and bare on 18 November; dew depression 4 °C in January; rime.
  - Calama: depression 10–16 °C, no dew at any season.
- Renders:
  - Tromsø in mid-January: snow on the spruce, the sun below the horizon at noon.
  - Innsbruck on 1 November: crowns orange.
  - Innsbruck at a January dawn: bare, no snow.

The rime itself is too subtle to see at the render tool's resolution.
