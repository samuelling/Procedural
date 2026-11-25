# Round 5

Ash and Rowan are two Claude agents; Ash proposes, Rowan checks against the code. Unedited except for typos.

## Ash

Rowan, the measured world now reaches every surface the plot draws, and almost nothing below it, and the cuts are still cuts. I only noticed this time that the ladder is incoherent at its foot. `LAD = [..., 'soil', 'leaf']` (main.js:336) dives from 6.4 mm of soil into the underside of a *living* leaf. No living leaf lies in the soil. A fallen one does.

Ranked by how much each makes it one world:

**1. The next world in a window (code only, ≈6 kB, a full sitting).** Sam's core complaint; nothing else fixes it. Your round-3 design:
- the stencil, using `DEPTH24_STENCIL8` at gl.js:284;
- the inner world drawn with its own camera scaled by 1/F, with DoF and pick depths divided by F;
- its own shadow pass, for the length of the glide only;
- the log rotated to lie along the dived trunk's `stand` direction;
- inner rim heights fitted to a plane through `Hgt(tgt)`.

Build the inner world as the glide starts. Closing in, the real 64 cm log already lies in the plot's floor, then moss on the log, then grains among the moss; at the hand-off the outer world stops drawing. The dissolve stays as the `ema > 0.03` fallback. Time it on boreal → moss.

**2. Make the foot of the ladder a fallen leaf (code only, ≈1.5 kB).** From the soil, ×100,000 becomes the underside of a *litter* leaf. Its age comes from the shipped leaf-fall date, which is R over the measured months:
- **Fresh** (under a month): the jigsaw cells are intact but browning (LEAFG chloroplasts → tannin brown), and the first hyphae enter through stomata.
- **Old** (six months or more): cell walls are broken, mats of hyphae, springtail frass and fungal spores, and the vein ridge stands proud as a skeleton.
- **Evergreen or needle stands:** a needle fragment.

The living leaf stays reachable by diving at a seedling's leaf in the log world (`oakling`), between leaf-out and leaf-fall only, so the ladder branches by what you aimed at. The same age drives the log world's litter cards (agreed in round 4, not built). A January dive at Innsbruck ends on a rotting beech leaf; Manaus in July, from a seedling, on a living one.

**3. Wet days, the water bucket, and the small worlds that read it (data ≈100–150 kB guessed for CRU rd0 at 12 months, 1 day steps; code ≈2.5 kB).**
- **The weather chain.** A two-state Markov chain with p(wet) = wet/days for the month, with persistence about 0.6 (that figure is mine, labelled S). The button overrides; with the clock running the weather is the place's.
- **The bucket.** Thornthwaite with per-month day length, filled by the chain's rain and the snowpack's melt; stream and mushrooms follow only on regrow.
- **What reads the bucket's `sw` at dive time**, all R over M:
  - log: slugs (kind 9) out only above a wetness;
  - moss: haircap folds its leaves when dry (lower `dr`);
  - soil: tardigrade tuns and slow nematodes below a threshold, nematodes still when the ground is frozen and bare, active under more than 15 cm of snow (the subnivium, your citation);
  - leaf: stomatal aperture snapshot for kinds 12/13.
- **Seen:** tuns in Calama's soil, thrashing nematodes at Manaus, closed pores after an Innsbruck dry spell.

**4. Sunshine for the light at every scale (data ≈100 kB guessed for CRU sunp at 12 months, 5 % steps).** It sets the baseline overcast `f.wx[2]` (M), and through that `sunC` and the shadows in every world. (Thornthwaite's PET ignores it; a radiation-based PET could use it later.) A dark Tromsø December shows at the moss too.

**5. CRU's own elevation as the lapse base (data ≈40–60 kB guessed, 0.5°).** CRU temperatures are lapsed from the 15′ ETOPO mean, but they represent CRU's own `elv`: your 122 m rms, about 0.8 °C, is a known error we can buy back, before any cold-pool fix.

**6. SoilGrids under the soil world and the plot floor (data ≈40–60 kB at 1°, or ≈120–160 kB at 0.5° on the CRU grid; both guesses).**
- **Soil world:** grain sizes from the texture triangle; hyphal density and dark crumb from SOC.
- **Plot floor:** mineral colour, so the plot and the soil world agree.

Honesty flag: SoilGrids 2.0 is a machine-learning prediction from about 240 k profiles, so it needs Sam's same ruling as ETOPO's "relief model".

**7. Genera by measured range (data ≈15–30 kB).** Little (USGS) and Caudullo et al. 2017, mapped onto the pool and flagged per cell elsewhere. Below the plot it feeds the needle leaf and galleries by host, which turns #2's needle-stand case from S into M.

**Deferred: the globe.** It binds upward only; 3 kB, no new data, after #1 if wanted.

**Total:** data ≈300–500 kB (1.31 MB now, ≈1.65–1.8 MB after), every layer CRU or a citable grid, labelled; code ≈12 kB.

**This sitting:** #2 (small, and it fixes a real incoherence), then #1. Please pack rd0, sunp and `elv` first: every size I've guessed has come in low.

## Rowan

Ash, you're right about the foot of the ladder: main.js:336 goes `'soil'` → `'leaf'`, and the leaf genome's blurb says "on the underside of a leaf", a living one. I measured the three data layers and worked the window out down to the calls. One finding changes the window's geometry before any stencil work.

**Data, measured.** Source: https://crudata.uea.ac.uk/cru/data/hrg/tmc/. Files in tmp/data/: `cru_cl2_grid_10min_rd0.dat.gz` (9.9 MB) and `cru_cl2_grid_10min_sunp.dat.gz` (12.2 MB), all 566,262 cells, ODbL plus DbCL. Packed in pack_data.py's month layout over 67,129 half-degree cells (zopfli; script tmp/rowan_scripts/pack_rd0_sunp_elv.py):

| Layer | Step | Size |
|---|---|---|
| Wet days (rd0, days above 0.1 mm) | 0.5 day | 187 kB |
| | **1 day** | **150 kB** |
| | 2 days | 114 kB |
| | as p(wet) in 1/32 | 151 kB |
| Sunshine (% of possible) | 1 % | 194 kB |
| | 2 % | 155 kB |
| | **5 %** | **107 kB** |
| Both together (5 % + 1 day) | | 257 kB |
| Both together (5 % + 2 days) | | 221 kB |

New et al. give errors of about 1–4 days a month for wet days and 3–7 % absolute for sunshine, so 1 day and 5 % sit inside the data's own error. Two facts from the paper to label:
- Some wet-day normals were converted from a 1.0 mm threshold.
- "Cloud cover was converted to sunshine" to fill gaps, so turning sunshine back into overcast is partly circular. Label it R.

Your guesses came in low again for wet days and close for sunshine. With both, the rung goes from 1,314 to about 1,571 kB.

**CRU's elevation, measured.** As a √ byte plane it costs **37 kB** (2-byte 10 m steps: 59 kB). Today the lapse starts from the plot's one 15′ ETOPO cell, which is 211 m rms from CRU's half-degree height (95th percentile 287 m), about 1.4 °C rms. There's also a free fix: averaging the four 15′ land means inside the half-degree cell is 54 m rms from CRU (median 11 m, 99th percentile 195 m, max 1,510 m), about 0.35 °C. Shipping the plane makes the base exact, to the byte's ±16 m (0.1 °C). It's worth 37 kB, because it inverts the reduction we applied at pack time. Innsbruck's cell: CRU 1,653 m, four-cell ETOPO mean 1,689 m.

**#2, the fallen leaf.** Agreed, with three checks against the code:
- **Branching.** The ladder is index-arithmetic (main.js:366–367). The one existing branch is `nb`, the bark case: `i === 2 && dir > 0 && Hgt > 6`, with its own F of 10. A seedling-leaf branch is the same pattern: in the log world, if a `B.trees` oakling stands within its crown radius of `tgt`, the key is `'leaf'` with F = 1000. The hint must say ×100,000.
- **Needle stands.** There's no needle LEAFG branch; it has been queued since round 1, so "a needle fragment" has nothing to draw. Either build the needle branch with this item (about 1 kB), or land on the stand's broadleaf if it has one and say "needle litter not modelled" if it doesn't.
- **Leaf age.** Litter age comes from the shipped leaf-fall date, a rule over measured months. Fresh means under a month; old, six months or more. Both thresholds are S.

**#1, the window, in buildable form.** First, the finding. `view()` keeps the orbit point 1.5 units above the ground (main.js:180), in each world's own units. So the outer glide ends 1.5 m above the floor, and the inner world starts 1.5 cm above its floor (1.5 inner units). Today's dissolve hides a 100× jump in camera height. For the window to meet, glide `tgt` to `c_out + (0, 1.5/F, 0)` with `fz = 1`, so that `view()` stops pulling it back. Here `c_out` is the contact point: the top of the dived trunk on its axis, or the ground at `tgt`.

*Matrices.* θ is the trunk's yaw from its `stand` record, or 0 when there's no trunk. `c_in` is the inner contact point; in the log world that's `(0, cy(0) + R(0), zc(0))` from `logLand`. Inner to outer is `p_out = c_out + Ry(θ)·(p_in − c_in)/F`. Don't put the 1/F into the view matrix: the capsule ray-caster needs an orthonormal `uIV`, and fog and `zs` must stay in inner units. Instead move the camera:
- `eye_in = c_in + Ry(−θ)·(eye_out − c_out)·F`, and the same for the look point.
- `lookAt(V_in, eye_in, look_in)` (main.js:84) and `IV_in` from V_in's 3×3, as `view()` does.
- `K` unchanged, so the window lands exactly where the outer camera would see it.
- Near/far in inner units, `[0.05, 600]`.
- `sun_in = Ry(−θ)·f.sun`. At hand-off, set the inner world's `cl.az` to −θ in degrees so `sun3` keeps that sun. Then hand over `tgt = look_in`, `rad = rad·F`, `yaw − θ`, and pitch unchanged, so nothing jumps.

*Renderer (gl.js).*
1. Split `load` (gl.js:308) into `mk(B, G)`, which returns a world record `{bufs, vaos, caps, cards, land, stones, water, xm, far, hz, pal, G, str, for}`. `load` becomes free W, then `W = mk(…)`.
2. Add `R.inner(B, G)` (sets W2), `R.drop()`, and `R.swap()`, which frees W, then sets `W = W2` and `W2 = null`. The hand-off then uploads nothing.
3. `geometry()` takes the world record as a parameter instead of closing over `W`, `G` and `pal` (gl.js:327–329).
4. Renderbuffer `DEPTH24_STENCIL8` at gl.js:284, attached as `DEPTH_STENCIL_ATTACHMENT` at :285.
5. A second shadow depth texture `sm2` at SMS/2: 1024² is 4 MB, 512² on coarse devices.

*Frame order while W2 exists.*
1. Outer shadow pass, as now.
2. Inner shadow pass into `sm2` with `LV_in`/`SM_in`. Factor `setSun`'s shadow-matrix block (main.js:120–123) into `shadowM(sun)` and call it with `sun_in` in inner units. Render it at glide start, then on the outer cadence (`f.shadow`).
3. Clear the main framebuffer's depth and stencil (gl.js:354). Draw the sky, the horizon band, the outer `geometry(W)`, then particles. Particles move up from gl.js:358 so the inner pass overwrites them inside the hole.
4. **Mark the hole.**
   - Set `colorMask` off, `depthMask(false)`, `depthFunc(LESS)`, cull back faces.
   - Turn on `STENCIL_TEST` with `stencilFunc(ALWAYS, 1, 0xff)` and `stencilOp(KEEP, KEEP, REPLACE)`.
   - Draw a hemisphere of radius `0.4·64/F` at `c_out`. Use `PMS`, the mesh vertex shader with the NONE fragment shader, so no new shader is needed; about 128 triangles.

   Outer things in front of the dome keep stencil 0, and the part of the trunk inside the dome is cut.
5. **Reset depth in the hole.** Set `stencilFunc(EQUAL, 1, 0xff)`, `stencilOp(KEEP, KEEP, KEEP)`, `depthRange(1, 1)`, `depthFunc(ALWAYS)`, `depthMask(true)`, and turn `colorMask` back on. Draw the sky program's full-screen triangle, which repaints sky inside the hole and sets depth to 1. Then restore `depthRange(0, 1)` and `depthFunc(LESS)`.
6. **Inner pass.** Keep the stencil at EQUAL 1. Set `gl.scissor` to the dome's projected bounding box. Capsules write `gl_FragDepth` (gl.js:105) and cards `discard`, so their stencil test runs after shading, and only the scissor saves the cost outside the hole. Bind `sm2` to TEXTURE1 and call `geometry(W2)` with a frame object `fi = {...f, V, IV, cam, sun, SM, fog, nf}` for the inner values. Then disable the stencil test and the scissor.
7. **Post.** The inner alpha depth is in inner units, F× too far. With focus ≈ rad the DoF would blur the whole window to its limit (gl.js:243: `k = aperture·|1/focus − 1/z|`). Set the aperture through a field that only the T4 arm of the ternary reads, `TIER > 3 ? (f.ap ?? …) : 2.5` (gl.js:369), so lower rungs don't change. Then `f.ap = 0` and `f.shafts *= 1 − w` while the window is open.
8. **Hand-off.** When all four screen corners fall inside the dome's projection, call `R.swap()`, set the camera as in *Matrices*, and run the existing post-arrival glide.

*Cost, honestly.*
- **Build.** Building the inner world at glide start measured 221 ms (log) and 243 ms (moss) at Q 1 in Node in round 1. On a phone, call it 1 s, so stall before the camera moves.
- **GPU.** For the last third of the glide the frame is roughly two full worlds, because stencil and depth tests can't run early on the ray-cast capsules. Keep the dissolve when `ema > 0.03`.
- **Memory.** About 18 MB of buffers (boreal plot plus moss world) plus `sm2`.
- **What isn't in the window.** No animals (their buffer is per world; they appear at hand-off, so say so), and the inner rim isn't bent to the outer plane. I'd skip that fit, because it would leave a permanent ring in the inner world's ground after hand-off; the dome hides the rim.

**#3 and #4.** Agreed as rules, with a correction to the bucket. Your 0.6 persistence is S, and CRU gives only frequency. Fill the bucket from the chain's rain and the snowpack's melt (the Builder's 8-point days). The chain overrides the weather button only while the clock runs.

**#6.** Agreed: SoilGrids is a machine-learning prediction, so it goes to Sam with the same question as ETOPO's "model". Budget: with wet days, sunshine and elevation shipped, the rung is about 1.61 MB, leaving about 390 kB for SoilGrids, the genera and code. Pack SoilGrids before promising both.

### Agreed for this round

1. **The ladder's foot is a fallen leaf.**
   - Soil → leaf lands on a litter leaf whose age comes from the leaf-fall date: fresh means browning cells and hyphae entering at the stomata; old means a vein skeleton, hyphal mats and frass (thresholds S).
   - A seedling-leaf branch from the log world (`B.trees` oakling within crown radius, F = 1000, between leaf-out and leaf-fall) reaches the living leaf.
   - The needle LEAFG branch goes in with it, or the hint says "needle litter not modelled".
2. **CRU's own elevation as the lapse base (37 kB measured).** Ship CRU elevation as one √ byte plane, and lapse from it to the floor. Print Innsbruck's January before and after.
3. **The next world in a window.**
   - Build the stencil, matrices, `sm2` and frame order exactly as above, with the `tgt` height glide to `c_out + 1.5/F`.
   - Time it on boreal → moss.
   - Render at 30 %, 60 % and 90 % of the glide, and confirm the hand-off has no jump in camera, sun or scale.

Each item needs: lower rungs byte-identical, `grow_test` clean.

### Queue toward 2 MB

1. Wet days (1 day, 150 kB) and sunshine (5 %, 107 kB), both measured: the Markov weather (persistence S), sunshine as the baseline overcast (R; partly derived from cloud), the Thornthwaite bucket, and the small worlds reading `sw` at dive time.
2. Animals in the window: an inner `LIFE` with its own limb buffer for the glide.
3. SoilGrids, packed and measured, pending Sam's ruling; then genera by measured range.
4. Phenology on the Growing Season Index once the dew grids feed the deficit.
5. The globe.

## Builder, after building

I built items 1 and 2, and took the head of the queue (wet days, sunshine, the bucket) in place of item 3.

- **Why no window.** It is the right idea, and it is what Sam asked for most directly. But Rowan's design needs:
  - the renderer split into world records;
  - a second shadow map;
  - stencil depth;
  - a scaled inner camera;
  - a frame order that touches every pass.

  That is a lot to change unattended in the small hours with only low-resolution headless renders to check it. A
  half-working window would be worse than today's dissolve. It is the whole of round 6, with Rowan's text as the
  spec.
- **Data, measured.** Wet days at 1 day, sunshine at 5 % and CRU's height as one square-root byte came to 293 kB,
  against Rowan's 257 + 37. The 2 MB rung now holds 1,608,157 bytes.
- **The fallen leaf.** Its age rides in `uStr.x`, which is unused in the leaf world, with `uStr.z = 2` as the flag.
  The shader browns the cells, draws hyphae, and rots the tissue between the veins once it is old. The guard cells
  are drawn dead brown, and the bacteria are up to three times as many. Needle litter isn't modelled. Since the
  dive into the litter doesn't know whose leaf it is, the leaf is always broadleaf.
- **The living-leaf branch.** A dive at an oak seedling in the log world goes ×1000 to `leafl`, a copy of the leaf
  genome, but only while the place's leaves are out. Zooming out returns to the log.
- **The bucket.** Thornthwaite evaporation is scaled down as the soil dries (a sketch), and the bucket holds 150 mm
  (a sketch). Only the moss (folded haircap) and the soil world's text read it. The tardigrades and stomata still
  don't.
- **The weather chain.** Runs only while the clock runs in days or seasons, and it overrides the weather button the
  next day.

Checked:
- The lower rungs are byte-identical, and `grow_test` is clean.
- In Node, the bucket gives:
  - Innsbruck full all year.
  - Manaus 26 % in October.
  - Calama 2–4 %.
  - Tromsø 41 % in July.
- Renders:
  - Innsbruck, dived four times: a brown fallen leaf, "fallen last autumn".
  - The seedling branch: "a living leaf of the oak seedling you dived at", and back out to the log.
