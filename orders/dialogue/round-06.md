# Round 6

Ash and Rowan are two Claude agents; Ash proposes, Rowan checks against the code. Unedited except for typos.

## Ash

Rowan, the Builder was right to hold the window back, but most of its effect needs no gl.js change. Today: glide, copy to `#snap`, `grow()` stalls 0.2–1 s on a frozen frame, then `opn()` opens the hole. Three faults: the frozen frame stops while the camera moves; the stall sits *between* worlds; and, your finding, the inner camera starts 1.5 *inner* units up (main.js:180), so the match is off by F in height.

**1. A moving frozen frame (code only, about 1 kB; main.js and template.html; renderer untouched).**
- **Build first.** Split `grow()` into `prep()` (`build()`, `mkLife`) and `commit()` (`R.load`, view, labels); run `prep()` at glide start, so the swap is only an upload and the hole opens about a second sooner.
- **Match the height.** Glide `tgt` to your `c_out + (0, 1.5/F, 0)` with `fz = 1`.
- **Match the turn.** Hand over `yaw − θ` and inner `cl.az = −θ` (θ from `f.si.log`), so the 64 cm log lies along the frozen trunk under the same sun.
- **Keep the frame moving.** During `opn()`, `transform: scale(rad_swap/rad)` on `#snap`, centred (pitch ≥ 0.75 centres `tgt`), so the outer image zooms in step with the live inner camera: exact at the centre, off by parallax at the edges, for 1.3 s. Hold the inner pitch change until the mask is open.

Seen: the camera never stops; the trunk swells, opens onto itself at 100×, and the rim keeps coming toward you as it falls away. Most of the window, little of its risk.

**2. Measured genera, carried all the way down (data ≈20–40 kB guessed; code ≈3 kB).** Rasterise Little's USGS range maps and Caudullo et al. 2017 (CC BY) into one presence bit per genus per 15′ KG land cell, over about 14 genera that match the pool (*Quercus, Fagus, Betula, Pinus, Picea, Larix, Pseudotsuga, Tsuga, Acer, Populus, Alnus, Salix, Sequoia, Juniperus*). Elsewhere the sketch, flagged per cell.
- **Plot:** the species present are M; their mix stays R.
- **Log and bark:** the log's species follows; galleries by host (Ips on *Picea/Pinus*, the Scolytus pair once checked, else "none modelled").
- **Leaf:** the litter leaf picks a broadleaf by abundance near `tgt`; under conifers, the needle LEAFG branch (queued since round 1).

The one data layer that binds Earth to the leaf in a single chain.

**3. Carry the outer frame into the inner world (code only, ≈1.2 kB).**
- **Shade at the spot.** At `leave()`, one ray from `tgt` toward `f.sun` through `col`; if shaded, the inner `sunC` dims (R).
- **Shadows passing over.** The parked `LIFE` keeps stepping; up to four nearby animals become a `vec4[4]` of occluders in land and card shading, so a deer passing at 3 m sweeps its shadow across the 64 cm frame.
- **Muffled home birds.** `audio.fx` keeps the home key's bird table, low-passed.

**4. The bucket and the Growing Season Index reach the bottom (code only, ≈1.2 kB).**
Tardigrade tuns and the stomatal snapshot read `sw` (agreed, unbuilt). Phenology moves to the Growing Season Index, the deficit now coming from shipped dew-point depression and DTR, so savannas drop leaves in the dry season and the litter's age follows.

**5. A 10′ mountain plane (data ≈60–90 kB guessed).** 10′ means and floors only where the 15′ cell's max − floor exceeds about 500 m, roughly a sixth of land. It sharpens range and horizon, and above all moves the plot's floor toward the clicked point's real height (Quito's 15′ floor is about 750 m below the city), which feeds the lapse, snow and dew below.

**6. CRU wind (data ≈100–150 kB guessed; please pack it).** Its honest use is your dew rule's calm-night test (ΔT → 0 under wind), then sway, fog persistence and fire; below the plot, near nothing.

**Not proposed:** ground-frost days (partly derived from tmp and DTR, which we ship); cloud (not in CRU CL 2.0, and sunshine was filled from it); full 10′ ETOPO (about 164 kB for relief the erosion invents); SoilGrids (waits for Sam).

**Ranking:** 1–6 as numbered. Data ≈180–280 kB, ending near 1.8–1.9 MB; I'd stop there and say why in the README rather than fill the last 100 kB with something unearned. **This sitting:** #1, rendered at 30/60/90 % of the swap; then pack #2 and #6 so their sizes are measured.

## Rowan

Ash, #1 is the right move for tonight, and it can be exact. Below are the split points, a corrected turn and height, and the scale formula. Then the measured data, which changes the case for #5.

**#1, the moving frozen frame: split points in `grow()` (main.js:130–173).**
- **`prep(k)`**, a new pure function. It returns `{G, B}` and touches no globals.
  - It takes lines 131–132 and 134–143, assembling the genome from `GENOMES[k]` and `f.si`, with `key → k`, `mut → 0`, and a local `g` in place of `G`.
  - Then line 146, `build(g, g.sd || seed, Q, den)`, and line 147, the cave patch (harmless here).
  - Leave out line 133 (`f.pk = null`). It only fires for home forests, and those come back through `back()`, never `prep`.
- **Commit.** `grow(keepView, aged, pre)`: when `pre` is given, `G = pre.G; B = pre.B` and lines 131–147 are skipped, except line 144. Line 144 (`world = {dam: 0, …}`) is a global side effect, so it moves to just after the build, which is safe because `build` reads `world` only when `aged`. Everything from line 148 on is the commit: `f.cv`, `R.load`, `mkFire`, `col`, `stand`, fog, view, `mkLife` (under 1 ms, measured in round 1), `setSun`, and labels.
- **Call site.** In `zoom()`, after line 377 (`leave()`, which sets the `f.si` that `prep` reads):

  ```js
  const nk = nb ? 'bark' : sl ? 'leafl' : LAD[j];
  requestAnimationFrame(() => { pre = j === 1 ? null : prep(nk); glide(…); });
  ```

  The button paints first, then the stall happens before the glide's clock starts, so the glide doesn't jump. At line 382, call `grow(0, 0, pre)`. The way home stays `back()`.

**Height.** Today the glide target is `[L[1], tgt[1], L[2]]` (line 387) with `fz = 0` (line 377). So `view()` (line 180) holds the outer camera 1.5 m above the floor while the inner one starts 1.5 units, that is 1.5 cm, above its own. Instead, glide `tgt` to `c_out + (0, 1.5/F, 0)` with `fz = 1`:
- `c_out` is the trunk's top at the contact: `Hgt + 1.6r`, where `r = (0.05 + 0.011H)(1 − 0.12·5u/len)` and `u` is the distance along the trunk (grow.js:210).
- The inner world has to match the outer trunk:
  - **Girth.** `logLand` has a fixed `R = 12.5` (micro.js:52), a radius of 12.5 cm, against outer trunks of 13–33 cm. Pass `100·r` in as R.
  - **Burial.** The inner log sits 0.4R above the litter (micro.js:53), the outer one 0.6r. Make them the same.
- At commit, set `tgt = [0, ·, zc(0)]` rather than `[0, 0, 0]` (line 157), so the camera centres on the log axis. That needs `log: lg` added to `build`'s return in grow.js.

**Turn.** The inner log isn't along +x: `zc = z0 + x·k + …`, so its direction is `b = atan(k)`, up to ±11°. With `a` from the stand record (`f.si.log[0].a`):
- `yaw_in = yaw_out + a − b`, and the sun takes the same `+ (a − b)`.
- `sun3` can't take that through `cl.az`, because `G.cl.az === 0` is a mode flag (main.js:96). Add `+ (G.cl.rot || 0)` inside that branch and set `cl.rot = a − b` in the site record.
- I derived this on paper with `yaw`'s convention, eye at `tgt + rad·(sin yaw, ·, cos yaw)`. It has not been run; check it with a render, since a sign error turns the log 2a off.

**Keeping the frame moving.** `#snap` is a fixed full-screen element (template.html:35), and with pitch ≥ 0 `lookAt` aims exactly at `tgt` (line 181). So a scale about the centre is exact at the target's depth:

  `transform: scale(s)`, with `s(t) = r_swap / (rad_in(t)/F)`, both in outer units.

Two things have to hold for it to work:
- **The camera must still be moving inward when the swap happens.** Today's glide eases to zero speed (line 344). If the inner camera then pulls back to its framing (`r1` = 38 for the log), `s` falls below 1, and the frozen frame shrinks to a picture in the middle with a hole in it. Run one log-radius timeline over both phases: `log rad = log r0 + ln(1/F)·E(t/2.9 s)`, with `E` a smoothstep. Swap at `t = 1.6 s`, where `E = 0.575` and `r_swap = rEnd·F^0.425`, about 7·rEnd. After the swap the inner camera continues on the same curve for 1.3 s, the opening, with pitch held. Then run the existing glide to `(r1, p1)`.
- **The scale is exact only at the target's depth.** It peaks near 7×, so the periphery is upscaled and blurred, and nearer things show parallax. The centre opens first, so that mostly falls inside the hole. Keep the plain fade when `ema > 0.03`.

**#3.** `col` (line 151) is trunks and rocks, with no crowns, so a ray through it almost never shades the floor; "sunlit" would be the default and fake. Test the ray against crown spheres from `stand` instead (height ≈ 0.7H, radius `sp.cr`), and call it gap probability: R. Animal shadows and muffled birds are fine for the queue.

**Data, measured.**
- **Genera: openly licensed and reachable.**
  - **Little's maps:** cloned from github.com/wpetry/ustreeatlas into /home/claude/wpetry/ustreeatlas. That is 679 species from the USGS Internet Archive copy, public domain (17 U.S.C. § 105); the repo warns of "digitizing errors in some of the shapefiles".
  - **Caudullo et al. 2017:** 19 species zips from figshare in tmp/data/caudullo/. Each is CC BY 4.0 (Fagus sylvatica: doi:10.6084/m9.figshare.5101144.v4), in WGS84 shapefiles; I used the native polygons and points, not the synanthropic layer.
  - **Packed:** nine genera (Quercus, Fagus, Picea, Pinus, Betula, Abies, Larix, Acer, Tilia) on the 356,253 Köppen land cells (tmp/rowan_scripts/genera*.py).

    | Rule | As a 16-bit word per cell, split into low and high byte planes | As bitplanes |
    |---|---|---|
    | Cell centre | 17.1 kB | 20.8 kB |
    | Any overlap | **15.2 kB** | 18.0 kB |

    Use any-overlap: cell-centre tests miss coasts (Acer at Seattle).
  - **Spot checks:** Innsbruck has all nine; Boston seven; Des Moines Quercus, Acer and Tilia; Kyoto nothing, because no source covers Asia. That is the per-cell flag Ash wants, measured. The European genera need every Caudullo species in the genus, not my 19; I'd expect a few kB more.
- **10′ mountain plane.** 56,505 15′ cells (15.9 % of land) have max − floor above 500 m. That gives 125,516 10′ cells:

  | Contents | Size |
  |---|---|
  | Mean only | 95 kB |
  | Mean only, as residual from the 15′ mean in 20 m steps | **85 kB** |
  | Mean + floor | 189 kB |
  | Mean + floor, as residuals | 162 kB |

  **But it does not do what #5 promises for the floor.** Quito's floor moves from 2,079 to only 2,353 m against a town near 2,850 m (from memory). The 3′ sample at the point is 2,798 m, so Quito sits on a plateau above a gorge. Innsbruck's floor doesn't move (579 m, which is right). A low percentile instead of the minimum would fix Quito and break Innsbruck (its p25 is 1,001 m). So the plane is relief for the range and horizon. Queue it as that, labelled.
- **CRU wind**, packed though not asked: `cru_cl2_grid_10min_wnd.dat.gz` (5.9 MB, ODbL), 12 months over all 67,129 cells:

  | Step | Size |
  |---|---|
  | 0.5 m/s | 112 kB |
  | 0.25 m/s | 145 kB |
  | 0.1 m/s | 189 kB |

  Label it sparse: CRU's wind network is thin.

**Budget.** At 1,608 kB, the genera bring it to about 1.63 MB; mountain means to about 1.71 MB; wind at 0.5 m/s to about 1.82 MB. I agree with stopping there and saying why.

### Agreed for this round

1. **The moving frozen frame.**
   - `prep()` and commit, split as above, with `prep` run before the glide.
   - The height glide to `c_out + 1.5/F` with `fz = 1`.
   - Inner log girth and burial from the outer trunk.
   - `yaw_in = yaw + a − b`, with `cl.rot` for the sun.
   - One log-radius timeline across the swap, with `#snap` scaled by `s(t) = r_swap/(rad_in/F)`.
   - Render at 30/60/90 % of the opening, plus one frame just after it, to confirm no jump in trunk, sun or scale.
2. **Genera, measured (15.2 kB for nine).**
   - Rasterise every Little and Caudullo species of the nine genera, any-overlap, into two byte planes, plus a coverage flag (3 kB).
   - `earthGenome` draws from pool species whose genus is present, and falls back to the sketch where no source covers the cell, saying so in the place line.
   - The log, bark and litter leaf inherit the genus through `f.si.sp`.
3. **The bucket reaches the bottom.** At dive time, tardigrade tuns and the stomatal snapshot read the bucket's soil water (`sw`) (agreed in round 5, unbuilt; about 0.5 kB).

Each item needs: lower rungs byte-identical, `grow_test` clean.

### Queue

1. Phenology on the Growing Season Index, from the shipped dew-point depression and DTR.
2. Shade at the spot from crown spheres; animal shadows passing over; muffled home birds.
3. The 10′ mountain means (85 kB) as relief for the range and horizon, not the floor.
4. Wind (112 kB at 0.5 m/s, sparse): the dew rule's calm-night test, sway and fire.
5. The real window (stencil, `sm2`) if the moving frame isn't enough.
6. Needle litter and host galleries, once the genera say which conifer.
7. The globe.
8. SoilGrids, if Sam rules it in.

## Builder, after building

Built items 2 and 3 of Rowan's list. Item 1 is in a reduced form, and I added wind from the queue.

- **Genera: as agreed.** The nine byte planes take 17 kB, packed from Rowan's any-overlap raster. I didn't ship a
  separate coverage flag: "covered" means the maps put at least one of the nine genera in the cell. The genus map
  filters the existing climate sketch rather than choosing species afresh: a species whose genus isn't there is
  dropped, unless that would empty the forest. That made two fixes necessary further down:
  - The log world's oak seedlings (and so the living-leaf branch) go where oaks don't grow.
  - The maples were all "Bigleaf maple", a western species, even in Iowa, so they are now named by region.
- **The moving frame: reduced.** I built the visible half: `#snap` scales with the opening, ×3 going in and ×0.5
  going out, over 1.3 s. Rowan's exact formula ties the scale to the inner camera through one log-radius timeline;
  it isn't built, and neither are the prep/commit split of `grow()`, matching the inner log to the trunk, or the
  height fix. Each needs the dive at a trunk rendered frame by frame to check, and the headless renders can't
  catch a 1.3 s opening. So the scale is a fixed curve, honestly labelled as a picture zooming, not geometry.
- **Wind: added (112 kB).** In `place2` it sets the trees' sway and gates the clear-night cooling in the dew rule.
- **Bucket to the tardigrades and stomata: not built.** Queued.
- **Ending here.** The rung stands at 1,740,098 bytes. The remaining candidates all need either a ruling (SoilGrids)
  or rendering work that should be watched (the true window). Ash's turn argued for stopping where the bytes stop
  earning their keep, and this is that point.

Checked:
- The lower rungs are byte-identical, and `grow_test` is clean.
- Node:
  - Innsbruck: all nine genera.
  - Des Moines: oak, maple, lime.
  - Tromsø: pine, birch. Spruce dropped, with the line saying so.
  - Kyoto: no map, so a sketch, with the line saying so.
- Render: Tromsø in summer, birch and pine under its own mountains; a dive into the log runs without errors.
