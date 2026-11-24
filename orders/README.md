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
large ones are not: the 200 kB rung uses about 28 kB and the 2 MB rung about 32 kB, because that is how many rules have
been written. The 2 MB build would fit in the 200 kB allowance; the split follows the order things were asked for.

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

The clock button steps through still, days (a year is 8 minutes), seasons (a year a minute) and decades (five years
every three seconds, trees only).

## What has and has not been checked

Checked: every forest of every 3D rung grows with no non-finite geometry at both detail levels and after mutation, and
400 steps of its animals stay finite; fourteen simulated years of births, hunts and deaths and three centuries of
succession run with populations bounded and nothing non-finite; each rung renders without console errors in headless Chrome with software WebGL,
at desktop and phone sizes; the published pages match the built files byte for byte and unpack on the live site.

Not checked: frame rate on real hardware (the upper rungs evaluate cloud shadow for every pixel, which costs
something), touch on a real phone, and all of the sound.
