# python3 tools/story.py : writes site/story/, the "What's happening…" pages. One page goes through the five rungs
# order by order; each of the six rounds of the overnight dialogue gets its own page, its markdown rendered unedited.
# Byte counts are read from the built rungs; the 2 MB rung's history is from the repo's commits (git log of
# orders/2mb/index.html).
import os, re, html, markdown

S = 'site/story'; os.makedirs(S, exist_ok=True)
size = lambda f: os.path.getsize(f)
B = {k: size(f) for k, f in [('0.2kb', 'a/index.html'), ('2kb', 'b/index.html'), ('20kb', 'c/index.html'), ('200kb', 'd/index.html'), ('2mb', 'e/index.html')]}
LIM = {'0.2kb': 200, '2kb': 2000, '20kb': 20000, '200kb': 200000, '2mb': 2000000}
ROUNDS = [  # file, title, what it settled, 2 MB rung's bytes after it was built
  ('round-01', 'Binding the scales', 'The plot waits while you dive; you dive at a real log of its own species; the range is the plot’s surroundings; worlds open from the spot.', 114327),
  ('round-02', 'Measured ground and months', 'ETOPO 2022 heights and CRU CL 2.0 months under every Earth place; the range becomes the real 640 km; treeline from the warmest month.', 919258),
  ('round-03', 'The horizon', 'Measured land to 120 km behind the valley, the Earth curving away; valley relief from data; true north and a smooth year in every world.', 1084760),
  ('round-04', 'The place’s year at every scale', 'Snowpack, leaf-out and leaf-fall, dew and rime from measured humidity and diurnal range; winter inversions.', 1313751),
  ('round-05', 'Weather, water, and the foot of the ladder', 'Daily weather from wet days and sunshine; a soil-water bucket the moss reads; a fallen leaf at the bottom, aged since autumn.', 1608157),
  ('round-06', 'Which trees, and stopping', 'Tree genera from measured range maps carried down to the log; measured wind; a moving frozen frame; and why to stop short.', 1740098),
]
pct = lambda k: 100 * B[k] / LIM[k]

CSS = '''
:root { --field: #0a0d0a; --ink: #f1f3ea; --dim: #b9c0ad; --line: rgba(241,243,234,.18); --sun: #ffc457; --ash: #9fd28a; --rowan: #e8a07a; --build: #8fb8e0; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--field); color: var(--ink); font: 400 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 48px 20px 96px; }
a { color: var(--ink); text-decoration-color: rgba(241,243,234,.4); text-underline-offset: 3px; }
a:hover { text-decoration-color: var(--sun); }
.crumb { font-size: 13px; color: var(--dim); margin: 0 0 28px; }
.crumb a { color: var(--dim); }
h1 { margin: 0 0 10px; font-size: 30px; line-height: 1.15; font-weight: 650; letter-spacing: -.01em; text-wrap: balance; }
h2 { margin: 56px 0 6px; font-size: 13px; font-weight: 600; letter-spacing: .25em; text-transform: uppercase; color: var(--dim); }
h3 { margin: 28px 0 8px; font-size: 19px; font-weight: 600; }
p, li { text-wrap: pretty; }
.lede { font-size: 18px; color: var(--ink); max-width: 62ch; }
.dim { color: var(--dim); }
.rung { border-top: 1px solid var(--line); padding: 28px 0 8px; margin-top: 28px; }
.rung header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; }
.rung header b { font: 600 30px/1 ui-monospace, Menlo, Consolas, monospace; }
.rung header span { font-size: 19px; font-weight: 600; }
.rung header a { margin-left: auto; font-size: 14px; }
.bytes { font: 400 13px/1.3 ui-monospace, Menlo, Consolas, monospace; color: var(--dim); margin: 12px 0 6px; font-variant-numeric: tabular-nums; }
.bar { height: 6px; background: rgba(241,243,234,.1); margin: 0 0 18px; }
.bar i { display: block; height: 100%; background: var(--sun); }
.bar.split i { display: inline-block; vertical-align: top; }
.is { font-size: 17px; border-left: 3px solid var(--sun); padding: 2px 0 2px 14px; margin: 0 0 16px; }
dl { margin: 0; display: grid; grid-template-columns: 9.5em 1fr; gap: 10px 18px; }
dt { color: var(--dim); font-size: 14px; padding-top: 2px; }
dd { margin: 0; }
dd ul { margin: 0; padding-left: 18px; }
code { font: 13.5px ui-monospace, Menlo, Consolas, monospace; background: rgba(241,243,234,.08); padding: 1px 5px; border-radius: 3px; }
pre { overflow-x: auto; background: rgba(241,243,234,.06); padding: 12px 14px; border-radius: 4px; font-size: 12.5px; line-height: 1.5; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 8px 0 16px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--dim); font-weight: 500; }
td.n { text-align: right; white-space: nowrap; font-family: ui-monospace, Menlo, Consolas, monospace; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: var(--dim); margin: -8px 0 18px; }
.legend i { display: inline-block; width: 10px; height: 10px; margin-right: 6px; vertical-align: -1px; }
.rounds { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--line); }
.rounds li { border-bottom: 1px solid var(--line); }
.rounds a { display: grid; grid-template-columns: 4.5em 1fr auto; gap: 4px 14px; padding: 14px 4px; text-decoration: none; }
.rounds a:hover { background: rgba(241,243,234,.05); }
.rounds b { font: 600 14px ui-monospace, Menlo, Consolas, monospace; color: var(--dim); }
.rounds em { font-style: normal; font: 13px ui-monospace, Menlo, Consolas, monospace; color: var(--dim); white-space: nowrap; }
.rounds small { grid-column: 2 / 4; color: var(--dim); font-size: 14px; }
.who { display: flex; gap: 18px; flex-wrap: wrap; margin: 18px 0 8px; }
.who div { flex: 1 1 200px; border-top: 3px solid; padding-top: 8px; font-size: 14px; color: var(--dim); }
.who b { display: block; color: var(--ink); font-size: 16px; }
.turn { border-left: 3px solid var(--line); padding: 2px 0 2px 18px; margin: 34px 0; }
.turn > h2:first-child { margin-top: 0; letter-spacing: .2em; }
.turn.ash { border-color: var(--ash); } .turn.ash > h2:first-child { color: var(--ash); }
.turn.rowan { border-color: var(--rowan); } .turn.rowan > h2:first-child { color: var(--rowan); }
.turn.builder { border-color: var(--build); } .turn.builder > h2:first-child { color: var(--build); }
.turn h3 { font-size: 16px; }
nav.pn { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--line); margin-top: 48px; padding-top: 18px; font-size: 15px; }
@media (max-width: 560px) { dl { grid-template-columns: 1fr; gap: 2px 0; } dt { padding-top: 12px; } h1 { font-size: 25px; } .rounds a { grid-template-columns: 3.6em 1fr; } .rounds em { grid-column: 2; } }
'''

def page(title, body):
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title><style>{CSS}</style></head><body><main>
{body}
</main></body></html>
'''

def bar(k): return f'<div class="bytes">{B[k]:,} of {LIM[k]:,} bytes · {pct(k):.1f}% of the allowance</div><div class="bar"><i style="width:{max(pct(k), .4):.2f}%"></i></div>'

# ---- the overview -----------------------------------------------------------------------------------------------
code_kb, kg_kb = 89, 36                                       # measured: the 2 MB page's script with the grids removed, compressed (see the note below)
data_kb = B['2mb'] / 1000 - code_kb - kg_kb
rows = ''.join(f'<li><a href="{f}.html"><b>Round {i + 1}</b><span>{html.escape(t)}</span><em>→ {n / 1e6:.2f} MB</em><small>{html.escape(w)}</small></a></li>' for i, (f, t, w, n) in enumerate(ROUNDS))
hist = ''.join(f'<tr><td>{a}</td><td class="n">{b:,}</td></tr>' for a, b in [
  ('Before the night: everything written as rules (lives, fire, beavers, the zoom, caves, nine ages, the Köppen map)', 113207),
  ('Round 1: binding the scales, all code', 114327), ('Round 2: measured heights and months', 919258), ('Round 3: highest points, the horizon', 1084760),
  ('Round 4: humidity and diurnal range', 1313751), ('Round 5: wet days, sunshine, CRU’s own heights', 1608157), ('Round 6: wind, tree genera', 1740098)])

body = f'''
<p class="crumb"><a href="../">Orders of Magnitude</a> › What’s happening…</p>
<h1>What’s happening: one forest, five orders of magnitude</h1>
<p class="lede">The same subject, a forest, written five times, each time with ten times the room: 200 bytes, 2 kB, 20 kB, 200 kB and 2 MB. Each rung is a single page that must fit its allowance whole, program and numbers and unpacker, with no stored images, models or sounds.</p>
<p>The bottom rungs are a problem of cutting. The top one turned into a problem of honest filling. Think of the same forest described as a haiku, a postcard, a field guide, a natural history, and an atlas. Each is not just longer than the one before: it is a different idea of what a forest is.</p>

<h2>Order by order</h2>

<section class="rung"><header><b>0.2 kB</b><span>One formula</span><a href="../0.2kb/">Open ↗</a></header>
{bar('0.2kb')}
<p class="is">Here a forest is an <b>impression</b>: eighty firs in mist, and a tree is nothing but its number.</p>
<dl>
<dt>What is in it</dt><dd>One loop. Tree <i>i</i> stands at <code>i·i·7 mod 900</code>, is built from 28 stacked bars that widen downward, and is paler the further back it is (<code>hsl(120,15%,90−i%)</code>). Size, height, place and haze all come from the one index.</dd>
<dt>What had to go</dt><dd><ul>
<li>Any <code>&lt;script&gt;</code> tag: the code runs from an SVG’s <code>onload</code>.</li>
<li>Looking anything up: the canvas’s <code>id=c</code> is used as a global.</li>
<li>Brackets: <code>getContext`2d`</code> is a tagged template.</li>
<li>Randomness, animation and colour beyond one hue: none of them fit.</li></ul>
198 bytes; there are two left.</dd>
</dl></section>

<section class="rung"><header><b>2 kB</b><span>One shader</span><a href="../2kb/">Open ↗</a></header>
{bar('2kb')}
<p class="is">Here a forest is a <b>view</b>: every pixel works out which of ten rows of trees it is looking at.</p>
<dl>
<dt>What is in it</dt><dd>One fragment shader. Conifers with drooping tiers and ragged broadleaves, birches, boulders, mushrooms, grass, sun shafts with dust, falling leaves and a deer, under a camera drifting sideways forever. A hash and a few octaves of value noise stand in for every random choice.</dd>
<dt>How it fits</dt><dd>The shader source is stripped of comments and spaces and spliced into a few lines of WebGL setup. The page is a 163-byte bootstrap: it fetches its own file, inflates everything after itself with the browser’s own <code>DecompressionStream</code>, and runs it. Everything above it is raw deflate. That trick is what every rung from here up stands on.</dd>
<dt>What had to go</dt><dd>Geometry of any kind. Nothing exists between frames: no tree is anywhere until a pixel asks.</dd>
</dl></section>

<section class="rung"><header><b>20 kB</b><span>A genome and a grammar</span><a href="../20kb/">Open ↗</a></header>
{bar('20kb')}
<p class="is">Here a forest is a <b>grown thing</b>: species are genomes, and trees are grown from them branch by branch in 3D.</p>
<dl>
<dt>What is in it</dt><dd>Sylva: four biomes and eight species, pipe-model trunks, moss as a rule, stones, logs, ferns, sun shadows, fog, light shafts, depth of field, wind and birdsong.</dd>
<dt>How it fits</dt><dd>It is built from the same source as the two rungs above it. <code>TIER</code> is a constant at build time, so every higher rung’s code folds away before minifying. It stands 40 bytes under its cap, so it is the tightest constraint on the whole project: every change since, overnight included, had to leave this page byte for byte the same.</dd>
<dt>The traps</dt><dd>Things that do nothing in this build still leave crumbs, and a few bytes is enough to break it. A stray <code>let</code>, an empty <code>...[]</code>, or a newline between two pieces of shader text each did. Overnight, a helper written as <code>TIER &gt; 3 &amp;&amp; (…)</code> left <code>lu=!1</code> behind and reshuffled every minified name in the file. Only copying the code inline kept the rung identical.</dd>
</dl></section>

<section class="rung"><header><b>200 kB</b><span>A whole scene</span><a href="../200kb/">Open ↗</a></header>
{bar('200kb')}
<p class="is">Here a forest is a <b>living scene</b>: weather, water and animals with needs.</p>
<dl>
<dt>What is in it</dt><dd>A stream that falls across the plot into a pool. Clouds whose shadows move. Rain, snow and mist that wet, settle and drip. Wind in gusts. Deer that get hungry, thirsty and tired and act on it, and a flock of birds.</dd>
<dt>Why it is not full</dt><dd>It holds what was asked for at this order, and nothing was added to fill it. The bar is honest: about a sixth used. Most of what came later went to the rung above.</dd>
</dl></section>

<section class="rung"><header><b>2 MB</b><span>A world that keeps time and place</span><a href="../2mb/">Open ↗</a></header>
{bar('2mb')}
<div class="bar split" title="program, climate classes, measured grids"><i style="width:{code_kb / 20:.2f}%;background:#f1f3ea"></i><i style="width:{kg_kb / 20:.2f}%;background:#8fb8e0"></i><i style="width:{data_kb / 20:.2f}%;background:var(--sun)"></i></div>
<div class="legend"><span><i style="background:#f1f3ea"></i>program, about {code_kb} kB</span><span><i style="background:#8fb8e0"></i>Köppen climate classes, about {kg_kb} kB</span><span><i style="background:var(--sun)"></i>measured grids, about {data_kb / 1000:.2f} MB</span></div>
<p class="is">Here a forest is a <b>place in the world, in time</b>. It has a history: animals are born, hunt, age and die, and trees grow, fall, burn and evolve over centuries. It has a whereabouts: click anywhere on Earth and its measured ground, months, humidity and wind, and, where range maps cover it, its native trees, decide what grows. And it holds together from a mountain range 640 km across down to the underside of a leaf.</p>
<dl>
<dt>The problem</dt><dd>By the evening before, everything here had been written as rules: lives and succession, fire, beavers, nine past ages, caves, the powers-of-ten zoom. It came to 113 kB, so the whole program would have fitted in the 200 kB rung with room to spare. More rules would not have filled 2 MB honestly. Padding was out, so the remaining 1.88 MB had to be things that are true.</dd>
<dt>What filled it</dt><dd>Measured Earth, chosen layer by layer for what it changes at every scale:
<table><tr><th>Layer</th><th>Source</th><th>What it decides</th></tr>
<tr><td>Ground height: mean, lowest, highest per quarter degree</td><td>ETOPO 2022, NOAA</td><td>where the plot stands, the real range around it, the horizon to 120 km</td></tr>
<tr><td>12 months of temperature and rain</td><td>CRU CL 2.0, 1961–90</td><td>the forest grown, snow, leaf-out and fall, treeline and snowline</td></tr>
<tr><td>Humidity and daily temperature range</td><td>CRU CL 2.0</td><td>dew or rime at dawn, or neither</td></tr>
<tr><td>Wet days, sunshine, wind; CRU’s own heights</td><td>CRU CL 2.0</td><td>each day’s weather while time runs, sway, temperatures lapsed correctly</td></tr>
<tr><td>Nine tree genera</td><td>Little (USGS); Caudullo et al. 2017</td><td>which trees are native, down to the log and its seedlings</td></tr></table>
Each layer’s size was measured before it was shipped; Ash’s first guesses came in low almost every time. What the rules make of the data (the snowpack, the water bucket, the leaf thresholds) is labelled as a sketch on the page and in the README.</dd>
<dt>Over the night</dt><dd><table><tr><th>Stage</th><th>Bytes</th></tr>{hist}</table>
It stopped at 87% on purpose. The last candidates either needed a ruling (is a machine-learning soil map data or a model?) or rendering work that should be watched as it is built. The window, where the next world is drawn inside the old one before the cut, was built the next morning, once you could watch it: about 7 kB more program and no data.</dd>
<dt>Note</dt><dd class="dim">The split is measured by compressing the page’s script with and without the grids (zlib at level 9; the page itself uses zopfli, a little smaller), so the program and class shares are approximate to a few kB.</dd>
</dl></section>

<h2>What the world is, at every order</h2>
<p>Read upward, the rungs show how much has to be written down before a forest is anywhere at all. At 200 bytes a tree is its index. At 2 kB it is a distance worked out per pixel. At 20 kB it is a genome grown into a body. At 200 kB the forest has weather, water and hunger. At 2 MB it has a past and an address: what grows there is decided by measurements of that place, and those same measurements reach down through the log and the moss to the age of a fallen leaf.</p>
<p>The rule all five share is the one in the brief: no pictures of a forest, only ways of making one. The lower rungs prove how little that takes. The top one tests whether, given room, the making can be made true.</p>

<h2>The overnight dialogue</h2>
<p>The 2 MB rung was filled by an argument. Two Claude agents took turns on each round, then the main session built what they agreed, checked it, published it, and wrote what it changed and why.</p>
<div class="who">
<div style="border-color:var(--ash)"><b>Ash</b>Proposes. A naturalist and builder: what would make the scales one world, ranked by how much each buys per byte.</div>
<div style="border-color:var(--rowan)"><b>Rowan</b>Checks. A sceptical engineer: reads the code, quotes line numbers, fetches and packs the data to measure it, and pushes back on anything fake.</div>
<div style="border-color:var(--build)"><b>Builder</b>The main session. Builds the agreed list, says where it departed and why, and what was and was not seen.</div></div>
<p>The format earned its keep. Rowan caught a shader that never read the uniform Ash was counting on. He measured data that came in at two to four times Ash’s guesses: humidity and daily range, guessed at 40–60 kB each, packed to 226 kB together. And he warned that Innsbruck’s January would come out too warm for snow before any render showed it. Ash found that dew formed at every dawn everywhere, even in the Atacama, and kept pulling the work back to the brief: the scales felt like separate slides, and every round had to make them less so. The Builder found its own worst bug: a sea at negative height that sent the range’s flood fill round forever and hung the page.</p>
<ol class="rounds">{rows}</ol>
<p class="dim" style="font-size:14px;margin-top:14px">Each round page is the agents’ own text, unedited except for typos; the markdown originals are in <a href="../dialogue/">dialogue/</a>. The brief they were given is <a href="brief.html">here</a>.</p>

<h2>Still open</h2>
<ul>
<li><b>Is a relief model a model?</b> ETOPO calls itself a Global Relief Model. It is a grid of measured heights, and the page uses it as data, but it is the borderline case under the "no stored models" rule.</li>
<li><b>SoilGrids</b> is a machine-learning prediction of soil. It is left out until that is ruled on.</li>
<li><b>The window</b>, designed by Rowan in round 5, was built the morning after: going in, the next world now appears inside a disc on the ground where its patch lies, at true scale and under the same sun, and takes over when it fills the view. Going out still dissolves.</li>
</ul>
'''
open(f'{S}/index.html', 'w').write(page('What’s happening: Orders of Magnitude', body))

# ---- the dialogue rounds ----------------------------------------------------------------------------------------
def render(md):
    out, cur = [], None
    for part in re.split(r'(?m)^(?=## )', md):
        h = re.match(r'## (\w+)', part)
        who = h and h.group(1).lower()
        cls = {'ash': 'ash', 'rowan': 'rowan', 'builder': 'builder'}.get(who)
        part = re.sub(r'(?m)^(  +)(?=[-*] |\d+\. )', lambda m: '    ' * (len(m.group(1)) // 2), part)        # nested items: python-markdown wants four spaces
        part = re.sub(r'(?m)^((?![ \t]*(?:[-*] |\d+\. |\|))[^\n]*\S[^\n]*)\n(?=[ \t]*(?:[-*] |\d+\. ))', r'\1\n\n', part)   # and a blank line before a list
        x = markdown.markdown(part, extensions=['tables', 'fenced_code'])
        out.append(f'<section class="turn {cls}">{x}</section>' if cls else x)
    return '\n'.join(out)

files = [('brief', 'The brief', '', None)] + ROUNDS
for k, (f, t, w, n) in enumerate(files):
    md = open(f'dialogue/{f}.md').read()
    prev = files[k - 1] if k > 0 else None; nxt = files[k + 1] if k + 1 < len(files) else None
    nav = '<nav class="pn"><span>' + (f'<a href="{prev[0]}.html">← {html.escape(prev[1])}</a>' if prev else '') + '</span><span><a href="./">All orders</a></span><span>' + (f'<a href="{nxt[0]}.html">{html.escape(nxt[1])} →</a>' if nxt else '') + '</span></nav>'
    head = f'<p class="crumb"><a href="../">Orders of Magnitude</a> › <a href="./">What’s happening</a> › {"Round " + str(k) if k else "Brief"}</p>'
    sz = f'<p class="dim">After this round the 2 MB rung stood at {n:,} bytes.</p>' if n else ''
    open(f'{S}/{f}.html', 'w').write(page(f'{t}: Orders of Magnitude dialogue', head + render(md) + sz + nav))
print('story:', len(files) + 1, 'pages;', sum(size(f'{S}/{x}') for x in os.listdir(S)), 'bytes')
