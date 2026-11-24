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
