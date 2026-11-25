# Round 1: binding the scales

Ash and Rowan are two Claude agents; Ash proposes, Rowan checks against the code. Unedited except for typos.

## Ash

Rowan, bytes aren't the limit: all of this is about 9 kB minified against 1.88 MB spare, inside existing `TIER > 3` branches, so the 20 kB rung never sees it. Frame time and honesty are the limits. The cheap ones rank first because they fix things that are actually broken.

**1. Pass a site record down every dive (≈700 B).** `zoom()` calls a bare `grow()`, so `day` resets from `G.air.sun`, `G.cl` is lost (the micro genomes lack it, so `sun3` uses the generic sun, not the place's), and `seed` never changes, so every log is the same log. My fix: in `zoom()`, before the swap, build `site = { cl: G.cl, day, seed: hash(seed, round(tgt[0]*4), round(tgt[2]*4)), sp, wet, ndl }`. `grow()` then takes `G = inherit(GENOMES[LAD[j]], site)`, ten lines in genome.js, and skips the `day` reset; `build()` must also return its `wet` closure. You'd see dawn on the plot stay dawn on the leaf, two spots give two logs, and the same spot gives the same log back. No frame or build cost.

**2. Park the plot instead of regrowing it (≈300 B).** A real bug: zooming out runs `key = home; grow()` without `aged`, which resets `year = 1`, clears the tape, drops the evolved species, burn and dam, and calls `mkLife` again. One round trip wipes out two centuries. Keep `{G, B, LIFE, stand, world, fire, year, yearF, tape}` when leaving i=1; on return, `R.load(B, G)` and restore them. Nothing is rebuilt, so the way out gets instant too. The cost is one plot's Float32Arrays held while you're deeper in; I'd guess 5 to 15 MB, so please measure it on a phone.

**3. The inner worlds are made of what you dived at (≈2.5 kB).** `site.sp` is the species of whatever is nearest `tgt`. That's a kind-1 log capsule (its `id` already encodes the species index) or a record in `B.trees`. It drives:
- **Log**: the wood and bark colours come from `G.trees[sp].bark`. Seedlings are the plot's species within 10 m, scaled as `oakling` is; litter cards (`card(..., 8, ..., pal)`) take `pal` from those species by distance, so spruce needles under spruce; acorns only near an oak, mast only near a beech.
- **Bark**: Ips-style two-armed galleries along the grain fit only spruce and pine. `barkLand()` could take `{arms, axis}` per host: one mother gallery along the grain for elm (Scolytus), and a short one across the grain on oak (S. intricatus, which I'm working from memory on, so it's marked unverified). On a broadleaf with no entry, the hint says so instead of showing spruce under oak.
- **Leaf**: `LEAFG` hard-codes a dicot epidermis and its colour. Feed it `sp.leaf.a/b` through one uniform, and add a needle branch for `leaf.t === 1 || 5`: stomata in rows within two pale wax bands, which the plot's close-detail needles already draw, so the scales agree.

Build cost: one scan of `B.caps`, a few ms; nothing per frame.

**4. The range is the plot's own range (≈600 B).** The out-dive always lands at `tgt = [0,0,0]` on an unrelated range. Instead, seed `rangeLand` from the home seed, and once erosion is done (it's cached in `HIST`), pick the river cell nearest the centre whose flow runs roughly along +x, like `strm.zc` does in the plot, and point `tgt` there. The camera moves, not the land. On Earth, put the treeline at the height where the warmest month in `G.cl.T` reaches about 6.5 °C at a 6.5 °C/km lapse rate, replacing the fixed `tl = 460.` in fx.js ~761; likewise the snowline. Also, `uFor` (the range canopy colour) seems to be bound only in the `W.far` draw, so the range may get a leftover value; please check, and if so set it from the home stand. You'd rise out of the valley and land on a real river among real ridges, with the plot marked and the forest its own colour.

**5. Dissolve from the spot, and a viewfinder (≈400 B).** Two cheap ways to see the next world before the swap. First, swap the global opacity fade on `#snap` for an animated CSS radial mask centred on where `tgt` projects, so the new world opens outward from the point you chose. Second, in the last 40 % of the glide, draw a thin square of the next world's true extent at `tgt` (64 cm for the log, 6.4 cm for the moss), four projected corners stroked on a 2D overlay. Neither adds a draw call. Drawing the inner world's real ground inset at 1/F is the fuller version, but it needs two builds and a second land buffer in gl.js, so it goes in the queue.

**6. The state you carry changes the small worlds (≈1.5 kB).** Once #1 is in, give each small world one honest response to `night`, `f.wx` and season:
- Leaf: stomata close at night and in drought; `uSe.x` yellows the chloroplasts in autumn; in leaf fall, the dive lands on a fallen leaf with hyphae in it.
- Moss: dry haircap folds its leaves to the stem (lower `dr`); rain falls as drops about 3 units across.
- Soil: when dry, tardigrades curl into tuns (a resting mode in fx.js) and nematodes slow.

**7. Things that cross scales (≈1.8 kB, queue).**
- Falling leaves (`uSe.y` particles) keep falling in the log world at true scale.
- A deer within 2 m of `tgt` sends one hoof, its own capsules ×100, stepping through the log world.
- The plot's springtail and mite density near `tgt` sets the moss world's counts.
- `audio.fx` keeps the home key's birds, muffled, audible from the leaf.

Ranked as numbered. Items 1, 2, 4 and 5 come to about 2 kB and one sitting. Where does this break on a phone?


## Rowan

Ash, I checked each claim against the code. Most hold; three readings are wrong and two fixes would break things.

**Confirmed.** `zoom()` calls a bare `grow()` (main.js:346), which resets the day from `G.air.sun` (:144). The way back up resets `year = 1` and the tape (:141), calls `mkFire` (:139) and `mkLife` (:149), and rebuilds `world` (:133). You missed one: `zoom` sets `mut = 0` (:346), so a mutant comes home unmutated. For kind-1 capsules, `floor(id)` is the species index (grow.js:112, :210). But plain logs and stumps draw theirs at random (:248, :258), so acorns must follow live trees, not the log.

**Corrected.**
- The range never reads `uFor`. The `tl = 460.` shader is FARD (fx.js:759), the valley round the plot. The range is RANGEG (fx.js:820), with fixed colours and `tl = 1.85` (heights ×10, so 1 unit is 1 km).
- The range already gets the home seed, since `seed` never changes in a dive. What it lacks is position.
- `build()` already returns its wetness function as `B.trees.wet` (grow.js:230).
- Season and weather already carry (they're globals). What's lost is `G.cl`: snow falls back to `G.cl ? G.cl.snow : 1` (:267), so a tropical winter snows on the leaf, which is the better case for #1. With the clock running, `day` comes from `dayPh` every frame (:248), so the reset shows only when the clock is stopped.
- Treeline: about 6.5 °C is Körner's growing-season mean, not the warmest month. earth.js uses Köppen's 10 °C warmest month for ET (:61), and `G.cl.T` already includes the climb (:67). Use (Tmax − 10)/6.5 km above the plot so the shading agrees with the class.

**Where it breaks.**
- The #1 hash must not overwrite the global `seed`, which regrows home and writes the URL (:162). And two dives at one log rarely share a 25 cm bin. Seed from the object: trees carry `sd` (grow.js:224); logs have their capsule index.
- The clock runs in small worlds. `pass(1)` (:250) and clock 3's `spool(); pass(5)` (:252) act on `stand`, now the log's oaklings, and push them onto the plot's tape. Parking must stop that, count the years away, and on return run `pass(n); LIFE.lapse(n)`. Otherwise we lie about time the other way.
- #5: the dive pitch is ≥ 0.75 (:343), so `lookAt` centres `tgt` (:181) and the mask needs no projection. On phones, a full-screen masked layer is the risk: fall back to the fade when `ema > 0.03`. Draw the viewfinder on `#snap`, which is empty during the glide.

**Memory, measured** (node, `build()` typed arrays): mixed plot 8.8 MB at Q 1, 5.0 MB at Q 0.5; boreal 10.7 / 6.2 MB; moss world 7.0 / 4.5 MB. A parked boreal plot plus the moss world is about 11 MB on a phone, which is fine. Park the JS arrays only and re-`R.load` on return: one upload, not a 430 ms build. `HIST` (range.js:10) never evicts, so keep site seeds out of the range.

**Renderer and bytes.** gl.js:259 asks only for `webgl2`; there is no WebGL1 path, so the phone risk is fill rate. Bytes are fine. Rule: after every change, rebuild all rungs; 0.2/2/20/200 kB must be byte-identical. Site data goes through G, never through a new `build()` or `grow()` parameter.

**Honesty.**
- #6: nothing records drought, so drought-closing stomata, haircap folding and tardigrade tuns need a wetness memory first. Stomata are built once (micro.js:133), so closing them at night per frame needs a CAPV branch.
- #7: at true scale, leaf fall over 64 cm is about 10⁻⁴ of 600 particles, essentially none; a hoof made of capsules ×100 is a blob.
- A ×100 dive shows "a rotting log" even when none is in view.

### Agreed for this round

1. **Park the plot.** Keep `{G, B, LIFE, stand, world, fire, year, yearF, tape, mut}` on leaving i=1; on return, `R.load(B, G)` and restore. No `pass`, `spool` or deep time in small worlds; catch up the years away on return.
2. **Site record in G.** Carry `cl`, `sp`, the home canopy colour and a seed from the object's `sd` or capsule index; leave the global `seed` alone. Skip the day reset when diving.
3. **Dive at a real log.** For ×100, glide `tgt` to the nearest kind-1 capsule (one pass over `B.caps`, about 1 ms) and say how far it was. The site species joins the log genome's `trees` with `n = 0` for a bark palette slot; log capsules use that index. Acorns only within 10 m of a live oak.
4. **Range out-dive onto a headwater.** `rangeLand` exposes `spot()`: the nearest cell with small drainage `A` (not a 600 km² river), flowing roughly along ±x; set `tgt` there after `grow()`. RANGEG takes `uFor` from home; on Earth, `tl = h_spot + (Tmax − 10)/6.5`.
5. **Open from the centre.** A radial mask replaces the fade; the viewfinder square is drawn on `#snap` over the last 40 % of the glide, with the `ema` fallback. Cut first if time runs short.

After each item: lower rungs byte-identical, `grow_test` passes, a round-trip shot shows the plot unchanged.

### Queue toward 2 MB

1. A wetness memory, then haircap folding, tardigrade tuns and stomata closing in the dry.
2. Per-frame night closing of stomata; autumn yellowing in LEAFG for deciduous `sp`.
3. A needle leaf: stomata in rows within wax bands, matching fx.js:652.
4. Galleries by host in `barkLand`: Ips on conifers, Scolytus ratzeburgi on birch, S. intricatus on oak (to be checked), and "none modelled" for the rest.
5. Plot seedlings and litter by distance in the log world; mite and springtail density sets the moss world.
6. FARD treeline and snowline from `cl`.
7. Park the whole stack of small worlds (at most about 13 MB on a phone).
8. An inner-world inset at 1/F (second land buffer).
9. Muffled home birds; rare true-scale leaf fall; a real hoof.

## Builder (the main Claude session), after building

Built all five, with these departures from the agreed list:

- **Parking keeps less than Rowan asked.** It keeps `G`, the animals, the stand, the fire, the dam, the year, the tape
  and the mutant number, but not `B`'s arrays: on return the plot is rebuilt from the kept stand (`grow(1, 1)`, as the
  clock already does each year). That costs one build, about 0.3 s, and none of the 5–11 MB Rowan measured. The years
  away are counted rather than run (one a year on the slow clocks, five a stride on decades, 250 on millennia) and
  lived on return, up to sixty at once; the chronicle says how many.
- **The log is found from the stand, not the capsules.** Fallen trunks are `stand` records with `st === 2`, which
  carry species, seed and direction, so the nearest point along each trunk is exact and the species comes free.
- **The seed rule.** Only the small worlds (log, bark, moss, soil, leaf) take the log's seed. The range, lake and cave
  keep the home seed, as Rowan warned (`HIST` never evicts).
- **No Earth treeline.** `G.cl` holds the climate class, not the warmest month's temperature, so Rowan's
  `(Tmax − 10)/6.5` can't be computed without more data. Left in the queue.
- **No viewfinder.** The radial opening is in; the viewfinder square was cut, as agreed.
- **Added: under the bark says whose log it is.** Diving at a birch log went under the bark into a spruce engraver's
  galleries, which was false. The blurb now names the log and says so on a broadleaf.

Checked:
- the 20 kB and 200 kB rungs are byte-identical to before;
- `grow_test` is clean;
- renders:
  - plot (year 41) → log (oak, legend shows it) → plot (same view, year 41) → range → plot;
  - beech plot → birch log (white bark) → under the bark → log → plot, year kept;
  - a boreal plot's range, landing on a forested headwater;
  - on the decades clock, five years counted in the log world and lived on return ("5 years went by while you were away").

Not seen: the radial opening (headless frames are too slow to catch it mid-dissolve), and anything on a phone.
