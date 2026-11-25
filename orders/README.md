# Orders of Magnitude: a forest

The same subject at five sizes. Each rung is one HTML page that must fit its allowance whole: program, numbers and
unpacker. No stored images, models or sound files.

| Rung | Allowance | What it is |
|---|---|---|
| [`0.2kb/`](0.2kb/) | 200 bytes | One formula: firs in mist on a 2D canvas |
| [`2kb/`](2kb/) | 2,000 bytes | One fragment shader: ten rows of trees computed per pixel |
| [`20kb/`](20kb/) | 20,000 bytes | Sylva: a genome and a grammar growing a 3D plot |
| [`200kb/`](200kb/) | 200,000 bytes | A living scene: a stream and pool, clouds with moving shadows, rain, snow and mist, deer, a flock of birds |
| [`2mb/`](2mb/) | 2,000,000 bytes | A forest that keeps time: animals are born, hunt, age and die; trees grow, die, fall and are replaced; plus night, seasons, flowers, insects, storms, and four more forests |

`index.html` reports the real byte count of every rung against its allowance. The three small rungs are full. The two
large ones are not: the 200 kB rung uses about 31 kB and the 2 MB rung about 37 kB, because that is how many rules have
been written. The 2 MB build would fit in the 200 kB allowance; the split follows the order things were asked for.

[`ROADMAP.md`](ROADMAP.md) is the plan for filling the 2 MB rung, track by track, and the state of each.

## How the pages fit

From 2 kB up, a page is a 150-byte bootstrap followed by a raw deflate stream. The bootstrap fetches the page's own
bytes, inflates everything after itself with the browser's `DecompressionStream`, and runs the result. The whole file
counts against the allowance. Because a page has to fetch itself, these rungs need a web address; they do not run
from `file://`.

## Build

```bash
cd source
npm install
pip install zopfli playwright
python3 tools/build_b.py                 # 2 kB: minifies 2kb/forest.glsl into 2kb/main.js and packs it
node tools/build.mjs 2 c 20000           # 20 kB rung; TIER is a build-time constant, higher rungs' code is dropped
node tools/build.mjs 3 d 200000          # 200 kB rung
node tools/build.mjs 4 e 2000000         # 2 MB rung
node tools/grow_test.mjs                 # grows every forest of every 3D rung and steps its animals; fails on non-finite numbers
python3 tools/ladder.py                  # assembles the site and the index from real file sizes
```

The paths in the tools expect the working layout (`a/ b/ c/ d/ e/ src/ tools/`), not this published one.

## Where the upper rungs' rules live

`src/fx.js` holds everything above 20 kB: the weather functions spliced into every material (cloud shadow, wetness,
snow), the water shader, the formula-placed particles (rain, snow, fireflies, leaves, motes), the seasons, and the
animals. Animals are drawn with the same tapered capsules as the trees: a deer is twenty limbs whose feet find the
ground. `src/genome.js` ends with the extra species and forests.

## Lives and succession (2 MB rung)

Nothing in the top rung is scripted. Each animal carries hunger, thirst, tiredness, an age and a lifespan, and picks
what to do from whichever presses hardest; a hunt, a birth or a death in the snow happens when the numbers bring it
about. Each tree is a record (species, place, age, height, its own seed) and each species has a lifespan, a growth rate
and a shade tolerance; one call to `succeed` is one year of growth, death, fall, rot and seeding, after which the plot
is regrown from the records. `node tools/life_test.mjs [biome]` runs 14 years of animals and 300 years of trees and
prints what happened. In the aspen grove, spruce climbs from 7 trees to about 40 over two centuries.

Things act on each other. Deer eat the smallest trees, in proportion to how many deer there are and how palatable the
species is, so regeneration depends on wolves keeping the deer down (`node tools/life_test.mjs aspen 0 12` shows aspen
giving way to unpalatable spruce under twelve deer). Beavers fell soft young trees near the water; each one raises a dam
that floods the low ground and drowns what stands there. Fire is a grid of fuel: a burning cell lights its neighbours
readily downwind, hardly at all when wet, never across water; trees survive by bark and height; light-loving species
seed into the ash. Animals inherit leg length and boldness from both parents, and seedlings a pace of life from theirs
(fast growers bear shade badly and die young), each with a small random change, so selection shows up in the counts.

Some years are different. Every few years a species masts: it sets four times the seed, the plant-eaters breed more
the next spring, and in an oak or beech mast jays carry the seed across the whole plot. Seedlings take more easily
beside a rotting log. About one year in eleven a gale throws some of the tallest trees, all lying the same way.

Smaller builders work on the trees. Spiders string orb webs between neighbouring trunks (four guy lines, fourteen
spokes, a frame and a nine-turn spiral). Dead standing trees carry bracket fungi and woodpecker holes, seated on the
real trunk surface. In the wet forests beard lichen hangs from the thin branches. About one tall tree in seven holds a
nest of twigs with three eggs. In the moss world the haircap moss is in fruit. The top rung also has a bird table:
ten songs, each bird singing only in its kind of wood and most of all at dawn, and a cicada in summer. The songs were
written from memory and none has been checked against a recording.

Species evolve. Every tree carries two heritable traits, the wetness it is suited to and its pace of life. A seedling
takes the mean of its mother and a father within 14 m (pollen travels only so far), plus a small mutation, and it only
takes hold where the ground is about as wet as it is suited to. Along the plot's wet-to-dry gradient that pulls a
species apart. When at least six of one species (three of them grown) have drifted a fixed distance from where the
species began, in the same direction, everything leaning that way becomes a new species: it gets a name (Marsh, Upland,
Swift, Slow and so on, plus the parent's name), its own height range, lifespan, growth and shade tolerance taken from
its members, a slightly bent branching grammar, a shifted leaf colour, and from then on breeds only with its own kind.
If the whole species has drifted, it is renamed instead. A species with nothing left alive is gone from the plot. Six
species can live at once; a lost species' place goes to the next new one. The Lineages button draws the tree of life.
`node tools/evo_test.mjs [biome] [years]` runs it without a browser. This is a model of ecological speciation along a
gradient with instant reproductive isolation at the split, not a population-genetics simulation: inheritance is
blending, there is no hybridisation, and how far is far enough is a threshold chosen here.

Deer remember. They keep a map of where wolves have killed, feed elsewhere, and the fear fades over a year or two; the
succession reads the same map, so browsing is lighter where the deer are afraid. This is the "landscape of fear" idea
from Yellowstone, whose real-world strength is still argued over. Here too the effect on where young trees end up was not
clear in 300-year runs at this plot size (in one forest of three the most feared eighth of the plot held more young trees
than the rest; in the other two it did not); what is certain is only that the rule is in and the deer act on it.

The clock button steps through still, days (a year is 8 minutes), seasons (a year a minute) and decades (five years
every three seconds, trees only).

## Close detail (2 MB rung)

Double-click (or double-tap) anything to fly up to it; the camera now comes as close as 20 cm and focuses there. Every
fragment knows how many metres one pixel spans where it lands, and a pattern is drawn only once it is a few pixels
across, so close detail costs nothing from afar and never shimmers. Leaves get toothed margins, side veins and a net of
fine veins, holes something has eaten, a dry edge, a fungus's spots and a leaf-miner's trail on some, a sheen in
front and dark veins against the light behind. Spruce and pine sprays resolve into single needles, round in section
with a pale band of stomata. Fern pinnae get lobed edges and spore dots beneath. Flowers get veined petals and pollen.
Bark gets fissures within its fissures and fibres along the limb, lichen rosettes with lobed rims and fruiting cups,
beetles' exit holes, and galleries in dead wood. Moss turns into separate shoots. The forest floor turns into single
fallen leaves (midrib, side veins, curled darker edges, some eaten down to their veins), needles under conifers, and
twigs, in three layers that shade one another, over soil grains. Stones show mineral grains, glints of mica and map
lichen. Fur shows hairs, birds feathers. Water shows fine ripples, pebbles on the bed and specks of pollen drifting downstream.
Mushrooms show gills (short ones between the long) or pores beneath, and fibrils above. Lichens grow as irregular colonies
that favour the bark's ridges and pale at their growing rim. Conifer sprays break into single needles, each with its own
angle, length and taper. Flowers come as daisies (many narrow rays), buttercups (five glossy cups) or campions (notched
petals). At dawn and after rain, leaves, fronds and blades carry dew: each drop a small lens with a dark rim and a point of
sky. Ants run up some trunks, and about one leaf in thirty has a ladybird on it.

## Powers of ten (2 MB rung)

Five more worlds, built from the same parts as the forest at other scales, and one continuous zoom through them: + (or
Zoom in) goes a step further in, − (or Zoom out) back out, along range ÷10,000 → forest ×1 → rotting log ×100 → moss
×1000 → soil ×10,000 → leaf ×100,000. Zooming in at the log itself rather than the ground beside it goes under its bark
instead of into the moss.

The zoom keeps true scale the whole way. Going in, the view closes on the spot you are looking at until it is exactly
as close as the next world is wide; that world is then grown and seen from the same distance in its own units, and the
last frame of the old one (copied off the canvas the moment before) dissolves into it while the view settles. Going
out runs the other way: the bigger world arrives seen from as close as you were and pulls back. Between the forest and
the range, the valley around the plot carries the first stretch, so the path is plot → valley (2.5 km up) → range.
The two worlds are never drawn at once, so the dissolve is between matched views, not one scene seen through another.

- **Mountain range ÷10,000** (a unit is ten kilometres, 640 km across; heights drawn ten times taller, as relief maps
  do). Raised in two or three belts with ridged noise, then worn down by its own rivers: thirty passes, each filling
  the hollows (a priority flood from the edges), routing every cell to its steepest neighbour, summing the area that
  drains through each, and cutting each in proportion to the square root of that area times its slope (the
  stream-power law), with a little creep that rounds the ridges. Hollows still deeper than 100 m become lakes; wherever
  more than about 600 km² drains, a river is traced from its source and smoothed so it bends (drawn half a km to 2 km
  wide so it shows, which is wider than real). Forest up to a treeline that sits higher on sunny slopes, then alpine
  turf, rock where it is steep, snow above a line that comes down in winter, larch-gold low forest in autumn, and
  cumulus over the high ground.

- **Rotting log ×100** (a unit is a centimetre, 64 cm across). The log is part of the ground, so animals, seedlings,
  fallen leaves and your feet go over it. Loose bark over grey wood, bracket fungi in tiers up one flank, a tuft of
  bonnet mushrooms on top, scarlet elf cups beside it, acorns (some in their cups), twigs, about 300 fallen leaves
  (a new card type: one blade, tan, russet, gold or rotting brown), oak seedlings, and haircap moss on the log.
  Woodlice (seven plates, seven pairs of legs) graze; a centipede (fifteen rippling segments) hunts them; a ground
  beetle and slugs (soft bodies that swell and thin as they glide, a mantle, two pairs of tentacles).
- **Under the bark ×1000** (a unit is a millimetre, 6.4 cm across): the sapwood of a dead spruce where the bark has
  come away, pale with the grain along it, growth rings showing as broad flames, and patches of the blue-grey stain
  the beetles carry in. On it, one family of engraver beetles' work, cut into the ground itself: a mating chamber, a
  mother gallery each way along the grain, egg niches on alternate sides, and from each a grub's tunnel out across the
  grain, wider as it grew, packed with brown frass, ending in an oval pupal chamber. The oldest eggs are nearest the
  chamber, so those tunnels are longest and further along: eggs, then curled white grubs with brown heads, then pupae,
  then pale young adults; the mother is still at the end of her gallery. A strip of bark still clings along one side
  (red-brown scales on top, cream inner bark under cork at the torn edge, round exit holes through it) and the tunnels
  run on beneath it. Ambrosia beetles' black pinholes, beads of resin along the edge, and honey fungus: a white fan of
  mycelium from one corner and black bootlace rhizomorphs along the grain. Bark beetles walk over it all; checkered
  beetles (black head, red front, banded wing cases) hunt them.
- **Soil ×10,000** (a unit is a tenth of a millimetre, 6.4 mm across): sand grains; a fine root with root hairs
  behind its tip; fungal threads that grow tip-first, branch, follow the surface over the grains and wrap the root,
  with spores resting on them; pin moulds (a stalk a millimetre or two tall with a black ball of spores) and
  Penicillium brushes whose bristles are chains of blue-green spores. Nematodes thrash through it in sine waves and
  tardigrades (a plump barrel in four segments, eight stubby clawed legs) hunt them.
- **Leaf ×100,000** (a unit is ten micrometres, 0.64 mm across), the underside of a leaf: epidermal cells drawn per
  pixel as a jigsaw (wavy Voronoi walls, a slight dome to each cell, chloroplast specks showing through), a vein ridge
  of long narrow cells, stomata (two kidney-shaped guard cells around a dark pore), plain hairs and glandular hairs with
  a sticky head, spiny pollen grains, a germinating fungal spore whose thread grows over the surface and into a stoma,
  and rod bacteria. Spider mites feed on it and the faster orange predatory mites hunt them. A spider mite is half a
  millimetre long, so a patch this size holds only two to four: they boom, crash and drift back in from outside.

The sizes are right to within a factor of two or so; the shapes are simplified, and the soil is lit as if the litter
above had been lifted away.

## One world through the scales (2 MB rung)

The ladder used to grow each world from a fixed genome, so every log was the same log and the plot was regrown, and
its history lost, when you came back out. Now:

- **The plot waits for you.** Going in or out keeps the plot as it is (its year, its tape, its evolved species, its
  fire scars and dam, its animals) and comes back to the same spot. Time runs on while you are away: the season turns
  in every world, the years are counted, and on return the plot lives them (up to sixty at once) and says how many.
- **You dive at a real log.** Zooming in from the plot glides to the fallen trunk nearest where you were looking (within
  14 m) and the log world is that log: its wood and bark are that species' (a birch log is white), its seed comes from
  that trunk, so two logs give two different worlds and the same log the same one every time, down through the moss,
  the soil and the leaf. Acorns lie by it only if a live oak stands within 10 m. Under the bark says whose log it is,
  and, on a broadleaf, that the galleries drawn are a spruce engraver's and its own beetles' are not drawn yet.
- **The place goes with you.** On Earth the inner worlds keep the place's sun and its snow (or lack of it).
- **The range is your plot's surroundings.** Going out lands on a headwater stream in the range (12 to 60 km²
  draining through it, flowing east or west, below the treeline, nearest the middle), and the range's forest is the
  colour of the forest you came from. The plot is not marked: at this scale it would be a fortieth of a pixel.
- **The new world opens from the spot.** The last frame of the old world now opens outward from the middle of the view,
  the point you went toward, instead of fading all at once (a plain fade when motion is reduced or frames are slow).

How this was decided, and what is queued, is in `dialogue/`: two Claude agents arguing it out, Ash proposing and
Rowan checking against the code.

## Deep time, and the tape (2 MB rung)

**Rewind and Fast forward.** Before every stride of time (five years in decades, 250 in millennia) the forest, its
species and their lineages, the beavers' dam and the cut ground are put on a tape, up to 400 strides. Rewind runs the
tape backwards a stride every 0.6 s to where it began; Fast forward steps the stride rate ×3 and ×10, and from a still
clock starts time running. The animals are not on the tape: they carry on as they are. Growing a new forest clears it.

**Millennia: water carving the plot.** A fifth setting of Time, for forests with a stream. When it begins, the valley
floor 68 m downstream of the plot's centre drops 16 m along a fault (a wavy line across the valley), as base level does
when land is lifted or a river below cuts down; a bed of hard sandstone lies a metre or so under the stream, between
shale and soil. Then, on a 1 m grid 256 m across, every 25 years: the hollows are filled to find where water goes
(priority flood), every cell drains to its steepest neighbour, the area draining through each is summed with the
stream's catchment (30 hectares, a guess) coming in upstream, and each cell is cut by the stream-power law E = K A^½ S,
solved implicitly; K is ten times smaller in sandstone. Banks steeper than their rock allows give way (shale and soil
at about 37°, sandstone near vertical) except in the stream's own bed, and soil creeps. The ground, the stream's water
(each pool filled to its lip, following the deepest line through the gorge) and the valley around are drawn from the
result; trees whose ground fell away or went under water are lost, and the forest lives 25 of each 250 years to fill
the gaps. Gorge walls show the rock: finely layered grey shale, the sandstone in thicker pale beds. Water steep enough
to fall is drawn white and streaming.

What comes out, in node: the falls start at the fault, 15 m high, and walk upstream: to 46 m from the centre by 1,250
years, 25 m by 2,500, about 8 m by 5,000, slowing as the gorge below them fills and the drop shrinks to 5 to 10 m,
with a gorge 12 to 15 m deep left behind. The rates (falls moving a few centimetres a year) are set to the order of small
sandstone falls and are not measured for any one: unverified.

**The range** has its own version: Rewind and Fast forward step through eleven stages of its wearing-down, from the
land as raised to the last pass. Over them its mean height falls from 1.25 to 1.18 km, the lakes in its hollows go
from 6% of it to 1.4% as rivers cut outlets, and its rivers lengthen. The stages are stages of wear, not measured years.

## Any time (2 MB rung)

Any time… lists nine forests of other ages; each is grown like any other forest, with its own sun latitude, snow and
leaf fall, and a line saying when it is. All are sketches after the fossil record's broad picture, not reconstructions
of a place: unverified.

- **Devonian, 385 million years ago:** Archaeopteris, the first true tree (wood, bark, fern-like sprays, no seeds),
  and nothing walking or flying among them. No grass and no flowers here or in the next three ages; grasses only
  begin in the Eocene. No birdsong until the Cretaceous's birds, and no song at all until the Eocene.
- **Carboniferous, 305 million years ago:** a coal swamp near the equator. Lepidodendron (a straight trunk forking two
  by two at the top, grass-like leaf tufts, its bark a lattice of diamond leaf scars, a new bark rule), Sigillaria,
  Calamites (giant horsetails, whorls of branches at every joint), Psaronius tree ferns and Cordaites. Arthropleura,
  a millipede over two metres long, and Meganeura, a dragonfly with 70 cm wings.
- **Jurassic, 150 million years ago:** Araucaria, cycads (diamond-scarred stumps, a crown of stiff fronds), ginkgos and
  tree ferns, and a pair of sauropods: a barrel on four pillars with a neck and a tail each longer than the body.
- **Cretaceous, 70 million years ago:** magnolias among redwoods, cycads, tree ferns and palms; birds; sauropods.
- **Eocene, 50 million years ago:** dawn redwoods and palms far north in the warm world.
- **The ice going**, four steps: the last ice age 20,000 years ago (mammoth steppe of grass, dwarf birch and willow,
  a few junipers; woolly mammoths), 12,000 years ago (birch first), 9,000 (pine and hazel), 6,000 (the wildwood of
  oak, elm, lime and hazel).

## The partway tracks, moved on (2 MB rung)

- **Kelp:** a kelp forest under the sea off a rocky coast, giant kelp from the bed to the surface, sea urchins on the
  rock, garibaldi.
- **Song by season, place and age:** birds sing most in spring and least in winter; on Earth a tropical place has its
  own sketch of calls (a parrot-like screech among them), deserts few, tundra and ice none; the ages above get their
  own sets, empty before birds sing. Sketches, unverified.
- **Animal memory and teaching:** an animal remembers where it last ate its fill and goes back half the time; a young
  one takes its mother's places as its own; a deer forgets a place where wolves have since killed. In a fourteen-year
  run of the mixed wood, 20 of 21 animals alive at the end remembered a place and 18 had learned theirs from a mother.
- **Animal evolution:** when a kind's mean gene drifts more than 15% from its founders it is named as a new form
  (long-legged, stocky, bold or wary) in the chronicle.

## Under the lake, and into the rock (2 MB rung)

Two worlds at the forest's own scale, a unit a metre. Walking into water too deep to wade, in any forest, takes you
under; − brings you back up to the forest you came from. Both have buttons too.

- **Under the lake.** 64 m of lake bed, 8 m at its deepest. Olive silt, sand rippled in the shallows, a film of algae,
  sunken logs and boulders; pondweed (the tree grammar again: a soft stem and small leaves) stands up from the bed and
  sways; lily pads float in the shallows, a few in flower. The light is the water's: dense green fog with no thinning
  upward, sunlight tinted green and its beams faint, and moving caustics, the light the ripples gather and throw across
  the bed, fading with depth. Looking up, the surface shows Snell's window: within 48.6° of straight up the sky,
  bent and bright; beyond it the surface mirrors the dim water beneath. Perch shoal and pike hunt them (a pair of
  pike, eight perch; over fourteen simulated years the pike caught eight). Fish swim between the bed and the surface
  rather than on the ground, their tails sweeping, the perch barred, the pike long with its dorsal fin far back.
- **The cave**, now in true 3D: the rock is a field on a half-metre grid 64 m across and 34 deep, passages stamped
  into it along wandering lines as tubes with flatter floors, the hillside's surface above, the walls roughened with
  noise, and the surface between rock and air found by surface nets (a vertex in each cell the surface crosses, a
  quad across each crossed edge): 27,000 vertices, built in about 0.35 s. So passages run one above another, from
  about 0 m down to 18 m below: an older high level, the main level and its chamber, a stream's canyon cut down to a
  sump with a pool, shafts between, and the way in climbing to daylight on the hillside. Each vertex keeps how much
  sky it can see (five rays up through the rock), so daylight dies away down the entrance and is gone in the deep
  passages; there the only light is your lamp. Walking finds the floor under your feet and the roof over your head.
  **Every forest now has a cave mouth** in a limestone outcrop near one corner: walk into it and you go in.

**Into the gorge.** Walking now has a cliff rule: a rise of more than a metre at a step is a wall. You can drop into
the gorge deep time has cut and walk its floor below the falls, but not climb its walls (F to float out).

## Anywhere on Earth (2 MB rung)

Earth… opens a map of the world's climates. Click any land, choose how high to climb (0 to 5,000 m), and Grow here
grows a forest for that place. What is measured, computed, modelled and guessed is kept apart:

- **Measured:** the Köppen-Geiger climate class at the point, from a quarter-degree grid (1440 × 720, about 35 kB of
  the page once packed), downsampled from the 100-arc-second map distributed with kgcpy (Yu et al., Case Western
  Reserve University, BSD licence; after Rubel et al.). Each cell takes the commonest land class in it; on a sample
  of 200,000 land points the quarter-degree grid gives the full map's class 95.4% of the time and calls 0.7% of land
  sea. A point at sea snaps to the nearest coast within 3°. The map is that grid, coloured by class; the coastline
  is its own.
- **Computed:** the sun's path for the latitude and the season (declination ±23.44° at the solstices, the usual
  solar-elevation and azimuth formulas); the Time of day slider runs from 3 in the morning to 9 at night, so the
  Arctic summer keeps its sun up and the winter keeps it down. Day lengths at both solstices are shown.
- **Measured, new:** the height of the ground, and twelve months of temperature and rain. See *Measured ground and
  climate* below. Where they exist (everywhere on land except Antarctica's climate), they replace the sketch that
  follows; the sketch is kept for Antarctica and for the moment before the grids are inflated.
- **Modelled (now only the fallback):** twelve monthly temperatures and rainfalls. A zonal sketch (warmth by latitude; a yearly swing that
  grows with latitude and with distance from the sea upwind, west in the westerlies and east in the trades; a
  warmer oceanic west coast in the north; rain belts by latitude, less inland) is nudged as little as possible until
  the Köppen rules (Kottek et al. 2006) give the measured class. So the numbers belong to the class, made plausible
  for the place: Yakutsk comes out −9 °C a year with −38 to 20 by month (close to the station), London 9.8 °C with
  3 to 17 (cooler than it is), Boston 12 °C and 780 mm (rain about 30% short), Cairo 77 mm (three times too wet).
- **Rules:** climbing cools 6.5 °C a kilometre and adds a little rain, and the class is worked out again, so Boston
  at 2,500 m is tundra.
- **Unverified tables:** soils by class (podzol, brown earth, terra rossa, ferralsol, chernozem, desert soil, gley
  over permafrost and so on, each with its colour on the ground), and which trees grow by class and region, with
  regional names. Eight species were added for places the temperate pool could not cover: holm oak (live oak,
  African olive), stone pine, eucalyptus, acacia (umbrella thorn, wattle), juniper, a rainforest emergent (kapok,
  mahogany or dipterocarp by region), a rainforest canopy tree (fig in Asia), a palm, and dwarf birch for the tundra.
  Southern beech stands in for Nothofagus. Heights shrink with a short or dry growing season; stems thin with less
  rain; deserts get a handful of trees or none; ice gets none.
- The climate also sets the floor (grass that goes tawny where summers are dry, ferns and moss with rain), snow only
  where winters freeze, leaf fall and autumn colour only where the class is seasonal (none in the rainforest, a
  little in the Mediterranean and tropical savanna), fog, and the aurora above 58°.

The address keeps the place: `#earth-4821@42.625,-71.125,0`.

### Measured ground and climate

The 2 MB rung now carries about 800 kB of measured data, packed by `tools/pack_data.py` into one string the browser
inflates when the page loads (about 0.1 s):

- **Ground height: ETOPO 2022** (NOAA National Centers for Environmental Information, 2022, ETOPO 2022 15 Arc-Second
  Global Relief Model, doi:10.25921/fd45-gt74; US government work). Read every 3 arc-minutes from the 60-arc-second
  surface grid, 25 samples to each quarter-degree cell of the Köppen grid; for each land cell, the mean height of
  the samples on land and the lowest one, each kept to a square-root byte (within 26 m at worst, 6 m on average,
  for the mean). The plot stands at the lowest point: the valley floor, in the mountains. Innsbruck's cell has a mean
  of 1,433 m and a floor of 579 m; the town is at 574 m. ETOPO calls itself a relief *model*: it is a grid of
  measured heights (from survey, satellite and sounding data) like the climate grids, not a 3D model, and is used
  here as data. It is the one entry on this page that is arguably a borderline case for the "no stored models" rule.
- **Months: CRU CL 2.0** (New, Lister, Hulme and Makin 2002, *Climate Research* 21; Climatic Research Unit,
  University of East Anglia; 1961–90 normals, 10 arc-minutes, averaged here to half a degree). Twelve monthly mean
  temperatures, carried to sea level at 6.5 °C a kilometre with CRU's own heights and kept to half a degree, and
  twelve monthly rainfalls as a log byte. At a place they are carried back up to the measured ground. The derived
  grid is shared under the Open Database Licence (ODbL 1.0) like its source; the rest of this project is unchanged.
- **Nudged to the class.** The Köppen map is from a later period (1980–2016) on a finer grid, and CRU's months give
  the map's class in only about 78% of cells. So the months are moved as little as possible (a shift in °C, a
  stretch of the yearly swing, a scaling of the rain) until the rules give the map's class, and the place's line
  says by how much ("nudged −1 °C, swing ×0.98, rain ×1.00"), or says nothing when they already agree. Innsbruck
  needs no nudge: 10.2 °C a year, 2 to 19 by month, 1,084 mm, ground 585 m. Quito's cell floor (2,095 m) is below the
  city (2,850 m), so it comes out warmer than Quito.
- **The treeline and snowline follow from them.** In the valley and in the range, forest stops where the warmest
  month falls to 10 °C (the rule that also divides Köppen's tundra from forest) and permanent snow starts, roughly,
  where it falls to 1 °C, at 6.5 °C a kilometre. Elsewhere they stay at the old fixed heights.
- **The range is the real 640 km.** Zooming out from a place on Earth, the range is built from the measured mean
  heights of the 640 km square round it (north is −z), with ridged noise adding relief where the ground is high, worn
  by its rivers as before, then put back to the measured heights at their own 28 km scale. The sea is the Köppen grid's
  sea, so coasts are stepped at 28 km. Seen: the Andes above Quito with the Pacific to the west; the Alps around
  Innsbruck with the Adriatic to the south, lower and greener than they are, because a 28 km mean takes the peaks off.
- **The horizon (round 3).** Around an Earth plot, the land out to 120 km is drawn behind the valley, in a depth range
  of its own: the measured mean of each cell between the four nearest, ridged noise (modelled) that reaches toward
  the cell's measured highest point on its crests, the sea where the cells are more sea than land, and the Earth
  curving away (a radius of 1.15 times the Earth's, the usual allowance for the air bending light). Seen from above
  Innsbruck's valley: forest to about 2 km, then distant pale tops; from Des Moines, flat land to the edge of sight.
  The valley's own ridges now stand as high over the plot as the cell's measured mean stands over its lowest point
  (854 m at Innsbruck, 40 m at Des Moines); their shape is still noise. A third height plane, each cell's highest
  point, cost 164 kB. Rowan guessed 70 kB.
- **One sun, one year (round 3).** On Earth the sun is placed for true north (south is +z, east +x, as on the range)
  in every world you dive to. Its declination now runs smoothly through the year, not in four steps; the year starts
  on 1 March, at the start of spring. Snow lies when the month's measured temperature, interpolated between months,
  is below freezing at the plot. The seasonal snowline in the valley and the range rises and falls with it.

## The valley (2 MB rung)

The plot is no longer an island. The same height field carries on past its edge and, beyond, is lifted into a valley:
the floor follows the stream, ridges rise a few hundred metres either side (ridged noise), and 700 m downstream the
stream slows into a lake. The river carries on beyond the plot in both directions and out of the lake. The nearest
110 m around the plot get about 1,300 simple trees (a trunk and a crown: a spire of three for conifers, two or three
lobes for broadleaves) chosen by the plot's own species and wetness rules; beyond that the forest is the ground's colour
and texture, crowns lit on their sunward side with dark gaps between, turning in autumn and bare in winter where the
forest is broadleaved, giving way to rock where it is steep, to turf above a treeline and to snow on the tops in
winter. The Overview button now steps from close, to the plot, to the whole valley. The ground is 48 rings of vertices,
fine at the plot's edge and 270 m apart at the horizon, 3 km out.

## Walking (2 MB rung)

Press W, A, S or D (or the Walk button) to walk the plot in first person, the way Ashland walks Ashland State Park:
feet on the ground and eyes 1.7 m up, gravity and a hop (Space), Shift to run, Z to sneak, trunks and large boulders in
the way (you slide around them), and a stream you can wade, which slows you, though not into water over your head. Click to take
the mouse for looking and Esc to give it back; Esc again or O leaves. The head rises and sways a little with each
step, and each footstep is synthesised from what is underfoot: a crackle of dry leaves (more in autumn), a soft thud
on moss, a squeak in snow, a slosh in water, now and then a snapped twig. The animals hear you: sneaking lets them
come closer, running or a snapped twig sends them off sooner. F floats you free of the ground (Space up, C down) to
reach the canopy or the underside of a cap, and a double-click floats you up to whatever you clicked. On a phone, the
left thumb is a joystick (push it all the way to run) and a drag on the right looks.

## What has and has not been checked

Checked: every forest of every 3D rung grows with no non-finite geometry at both detail levels and after mutation, and
400 steps of its animals stay finite; fourteen simulated years of births, hunts and deaths and three centuries of
succession run with populations bounded and nothing non-finite; each rung renders without console errors in headless Chrome with software WebGL,
at desktop and phone sizes; the published pages match the built files byte for byte and unpack on the live site.

Lake and cave: both grown clean and fourteen years of their animals run (perch 8 to 10 and pike 2 throughout; bats 4
to 8); both seen in renders, the lake from its bed and looking up at the surface, the cave from the chamber floor in two
directions (stalactites over stalagmites, columns, the skylight, the roof, a passage going dark). Not yet seen in a
render: the fish themselves, the lily pads from below, the cave's pool, the bats, and walking into deep water to go
under. Standing in the gorge after 5,000 years seen in a render looking downstream between its walls; the falls
themselves still not framed head-on.

Deep time: the falls' march and the gorge measured in node over 5,000 years; the gorge's layered walls and a sliver
of white water seen in a render looking along it, but the falls have not been framed head-on in a render (the camera
does not go down into a 10 m gorge well), and the valley's coarse rings around the plot do not show the gorge beyond the
plot's edge. Rewinding the whole tape seen to return to year 1. With sound on, changing the weather or the time of day
used to stop the page (an undefined variable); fixed and checked.

Anywhere on Earth: sixteen places grown in node with nothing non-finite and their animals stepped (Boston, Manaus,
Yakutsk, Cairo, the Serengeti, Rome, Perth, Seattle, Tromsø, Greenland, Nairobi, Boston at 2,500 m, Ulaanbaatar,
Borneo, Hobart, and a point in the Atlantic, which is refused as sea); the map panel, the Amazon and Rome seen in
renders. The palms have not been picked out in a render.

Worlds of other scales: all five seen in renders (the range from above and low over it, and after zooming out from a
forest and back in; under the bark from above and close in, and after zooming in at the log and back out; the soil also after diving into it from the moss, the leaf from above and
from a few cell-widths away (jigsaw cells, stomata, hairs, pollen and both mites seen; the bacteria and the hypha's
entry into the stoma not picked out); woodlice, beetles, slugs, the centipede, nematodes, tardigrades, both mites and both bark beetles
confirmed in the simulation over fourteen years (births, deaths, arrivals) but the log and soil animals not looked at up close.
The zoom: the start and end of every step seen, and the dissolve's first frames; headless Chrome draws a frame only
every second or two, so the glide itself has not been watched at full frame rate.

Valley: seen in renders from the valley overview in summer, autumn and winter, from the plot overview, and from the
ground while walking. Not checked: how it runs on a phone (about 4,500 more capsules and 25,000 more vertices).

Walking, checked headless by sending key presses: W walks, Space hops, D strafes, a walk straight at a 0.22 m oak
stopped 0.52 m from its centre. Not checked: how walking feels at a real frame rate, the mouse capture, the phone
joystick on a real phone, and the footsteps (no sound has been listened to).

Seen in close-up renders: a broad leaf (teeth, veins, spots), single spruce needles, a lobed fern, a flower's veins and
pollen, a trunk's fissures and lichens, moss shoots, leaf and needle litter, a stone's grains, the stream's bed and
floating specks. Also seen: dew at dawn on a sapling's leaves, single spruce needles, lichen colonies, a fly agaric from the side. Not seen
close up: mushroom gills (the camera stays 35 cm above the ground), feathers (birds stay overhead), ants, a ladybird, new
flower shapes up close, fern spores (the frond rendered was seen from above), a leaf-miner's trail, a hole
in a leaf, beetle holes and galleries, mica glints, and fur (the deer rendered was a metre away). Frame rate with the
close detail on real hardware is untested.

Seen in a render: an orb web close up and at a distance, moss with spore capsules, bracket fungi on a snag, the redwood
grove and the cloud forest. Seen only as a pale thread in one close-up: beard lichen.

Not seen in a render: a hare or a beaver up close, a hunt or a birth as it happens, a large fire, a nest (fifteen are
built in the mixed wood, but the camera cannot climb to one), and a woodpecker hole (dark on a dark trunk). Wolves
have been seen only as two grey animals in the middle distance. Mast years, jays and gales are confirmed in the
simulation log only (in the mixed wood over 300 years: 91 mast years, 55 of them carried by jays, 29 gales).

Not checked: frame rate on real hardware (the upper rungs evaluate cloud shadow for every pixel, which costs
something), touch on a real phone, and all of the sound.
