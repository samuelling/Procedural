# Orders of Magnitude: a forest

The same subject at five sizes. Each rung is one HTML page that must fit its allowance whole: program, numbers and
unpacker. No stored images, models or sound files.

| Rung | Allowance | What it is |
|---|---|---|
| [`0.2kb/`](0.2kb/) | 200 bytes | One formula: firs in mist on a 2D canvas |
| [`2kb/`](2kb/) | 2,000 bytes | One fragment shader: ten rows of trees computed per pixel |
| [`20kb/`](20kb/) | 20,000 bytes | Sylva: a genome and a grammar growing a 3D plot |
| [`200kb/`](200kb/) | 200,000 bytes | The whole scene: water, clouds, weather, animals, birds |
| [`2mb/`](2mb/) | 2,000,000 bytes | Everything written so far |

`index.html` reports the real byte count of every rung against its allowance.

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
python3 tools/ladder.py                  # assembles the site and the index from real file sizes
```

The paths in the tools expect the working layout (`a/ b/ c/ d/ e/ src/ tools/`), not this published one.
