# Assembles site/: each rung's page under its own folder, the thumbnails, and an index that reports real bytes
# against each allowance. The index is a staircase: each rung's picture grows as the allowance does.
import os, shutil, html, re, markdown
E = html.escape
TRY = ['Tap <b>Fallen leaf</b> on the scale at the right and fall 100,000 times smaller, a window at a time',
       '<b>Places → Anywhere on Earth</b>, then click where you grew up',
       '<b>Happenings → Wolves</b>, then <b>Time → Fast forward</b>, and watch the seedlings come back',
       '<b>Places → Another age</b>, and stand among the coal swamps’ scale trees',
       '<b>You → Walk</b> and keep going past the edge, at any scale. The forest, the mountain range, the lake bed, the log, the soil and the leaf all go on, grown around you as you come near']
R = [  # folder, allowance, built file, title, one line, as big as, things to try, everything in it
 ('0.2kb', 200, 'a/index.html', 'One formula',
  'Eighty firs fading into mist, from one loop. Each tree’s size, height and paleness come from its number in the line.',
  'about a text message and a half', None, None),
 ('2kb', 2000, 'b/index.html', 'One shader',
  'Every pixel works out which tree it falls on. Ten rows of conifers, birches and oaks, sun shafts with dust in them, leaves falling, and now and then a deer.',
  'about a page of a paperback', ['Just watch. It drifts sideways forever, and the deer is in no hurry.'], None),
 ('20kb', 20000, 'c/index.html', 'A genome and a grammar',
  'Real 3D. Trees grown branch by branch from a genome, with moss where the rain runs, shadows, fog, wind and birdsong.',
  'a short story', ['Switch forests, then <b>Reseed</b> for a new one. No two are the same.'], None),
 ('200kb', 200000, 'd/index.html', 'The measured Earth, seen coarser',
  'The real-Earth forest: every animal, every age, every scale, grown on the climate of anywhere you click. The Earth is measured in 300 km squares.',
  'a novella', TRY[:2], None),
 ('2mb', 2000000, 'w/index.html', 'Worlds without a cut',
  'Six whole planets, each grown from a genome of physics and plant genetics, with thousands of tree species apiece, seas, caves, fire, beavers and 450 million years of past, joined by wormholes. Zoom from a globe in space to a leaf’s cells without one cut.',
  'one photo from your phone', [
   'Click to look, press <b>F</b> and fly to the glowing sphere ahead, then go in. You come out on another planet',
   'Press <b>F</b> and fly up until the planet is a globe with moons, then scroll back down into a single grain of soil',
   'Pick an age from the menu at the bottom right (or press <b>,</b> and <b>.</b>): the same hillside 150 or 310 million years ago',
   'Press <b>L</b> to call lightning down where you look, then speed time up and watch the fire run before the wind',
   'Fly round to the night side and find a city: its streets and windows are lit'], [
   ('Planets', 'Six genomes: size, gravity, the colour the air scatters, the star, the liquid in the seas, rings and moons. Weaker gravity makes taller mountains, deeper air, taller trees, longer wings and higher jumps.'),
   ('Genetics', 'Ten to sixteen families per planet, each a body plan (dome, cone, palm, column, umbrella, weeping, orb or spire) and hundreds of species within each: some 3,500 to 5,000 per planet, every one a mutation of its family, named from its genes. Look at a tree to read its name; the Tree of life shows them all, and lights the ones you have met.'),
   ('Lives', 'Herds of grazers in open country, with four or six legs as the planet’s genome says, and packs of hunters circling them; a herd scatters when the pack comes close. Flocks wheel overhead.'),
   ('Time', 'Each planet turns on its own day (9 to 60 hours) and tilts its own way, so it has its own year and seasons: deciduous species colour, drop their leaves and flush again; grass browns; snow comes down the hills. Speed time up, stop it, or let it run.'),
   ('One world, every scale', 'A single height field of 40 octaves from 4,000 km to micrometres, measured from the camera so a grain beside you is as exact as a continent: the globe, continents and rivers, forests tree by tree, leaves, litter, stones, soil grains, silt.'),
   ('Weather and light', 'Volumetric clouds over the whole globe, fronts and clear spells, rain and snow under storms with lightning, a night side with stars, aurora over the poles, sun shadows through the canopy.'),
   ('Towns', 'On inhabited planets: street grids, towers that rise toward the core, brick, glass and concrete, windows lit at night.'),
   ('Wormholes', 'Three on each planet, bending the light around them and showing the far world inside. Every planet is a few jumps from every other.'),
   ('Seas', 'Swim out and dive: light dims and takes the colour of each sea’s own liquid with depth. Kelp forests, seagrass and coral reefs where the depth and warmth suit them; schools of fish, jellyfish, and whales in deep water.'),
   ('Caves', 'Dark mouths in hillsides lead into winding caves: stalactites and stalagmites, flowstone and still pools, glow-worms on the roof, lit by your lamp.'),
   ('Fire', 'Lightning starts fires where the land is dry enough, now and then by itself, or where you call it down. The wind drives the front: fast downwind, slow against it. Behind it, ash; trees left as black snags that fall over the years; then saplings, and the forest back in half a century.'),
   ('Beavers', 'On small rivers in cool, wet woods, beavers dam the stream. The water backs up into a pond that drowns what it reaches, with a lodge out in it and the beavers swimming. After a dozen years the dam fails, the pond drains to a meadow, and the woods come back until beavers do.'),
   ('Deep time', 'Eight ages of every planet, back 450 million years. The ground keeps its shape (no drifting continents), but the climate warms or cools, the sea rises or falls, and the plants are other plants. On Sylva: ice-age woods; palms and figs before grass; monkey puzzles, cycads and tree ferns; scale trees and giant horsetails; the first trees; then bare rock. Every species in every age is its own, with its own name, and the animals change with them.')]),
]
os.makedirs('site/thumbs', exist_ok=True)
for f in os.listdir('thumbs'): shutil.copyfile('thumbs/' + f, 'site/thumbs/' + f)
os.makedirs('site/2mb-earth', exist_ok=True); shutil.copyfile('e/index.html', 'site/2mb-earth/index.html')
rows, W = '', [30, 42, 58, 78, 100]   # the picture's share of the row, rung by rung
for k, (folder, lim, src, title, line, like, tries, inside) in enumerate(R):
    os.makedirs('site/' + folder, exist_ok=True); shutil.copyfile(src, f'site/{folder}/index.html')
    n = os.path.getsize(src); assert n <= lim, (folder, n); pct = 100 * n / lim
    size = folder.replace('kb', ' kB').replace('mb', ' MB')
    extra = ''
    if folder == '0.2kb': extra = f'<figure class="code"><figcaption>All of it:</figcaption><code>{E(open(src).read().strip())}</code></figure>'
    if tries: extra += '<div class="try"><p>Try</p><ul>' + ''.join(f'<li>{t}</li>' for t in tries) + '</ul></div>'
    if folder == '2mb': extra += '<p class="was">Until today this rung held the measured Earth (1.74 MB of real heights, climate and tree ranges): <a href="2mb-earth/">still open here ↗</a></p>'
    if inside: extra += '<details><summary>Everything in it</summary><dl>' + ''.join(f'<dt>{E(a)}</dt><dd>{E(b)}</dd>' for a, b in inside) + '</dl></details>'
    step = '' if k == 0 else '<div class="step" aria-hidden="true"><span>×10 the room</span></div>'
    rows += f'''{step}<section class="rung r{k}" style="--w:{W[k]}%">
<a class="pic" href="{folder}/"><img src="thumbs/{folder}.webp" alt="" loading="{'eager' if k < 2 else 'lazy'}" width="720" height="450"><span>Open ↗</span></a>
<div class="txt"><h2><a href="{folder}/"><b>{size}</b> {E(title)}</a></h2>
<p class="line">{E(line)}</p>
<div class="fill"><div class="jar"><i style="width:{max(pct, .4):.2f}%"></i></div><p><b>{pct:.1f}% full</b> · {n:,} of {lim:,} bytes, {E(like)}</p></div>
{extra}</div></section>
'''
# ---- the two agents, readable in a pop-up on this page: each round as turns, Ash on the left and Rowan on the right
exec(re.search(r'(?ms)^ROUNDS = \[.*?^\]', open('tools/story.py').read()).group(0))
def render(md):
    out = []
    for part in re.split(r'(?m)^(?=## )', md):
        h = re.match(r'## (\w+)', part); who = h and h.group(1).lower()
        cls = {'ash': 'ash', 'rowan': 'rowan', 'builder': 'builder'}.get(who)
        if h: part = part[h.end():]
        part = re.sub(r'(?m)^(  +)(?=[-*] |\d+\. )', lambda m: '    ' * (len(m.group(1)) // 2), part)
        part = re.sub(r'(?m)^((?![ \t]*(?:[-*] |\d+\. |\|))[^\n]*\S[^\n]*)\n(?=[ \t]*(?:[-*] |\d+\. ))', r'\1\n\n', part)
        x = markdown.markdown(part, extensions=['tables', 'fenced_code'])
        if cls: out.append(f'<section class="turn {cls}"><b class="who">{h.group(1)}</b>{x}</section>')
        else: out.append('<div class="note">' + re.sub(r'<h1>.*?</h1>', '', x) + '</div>')
    return '\n'.join(out)
chips, tpls = '', ''
for k, (fn, t, w, n) in enumerate(ROUNDS):
    chips += f'<button role="tab" data-r="{k}" aria-selected="{"true" if k == 0 else "false"}"><b>{k + 1}</b>{E(t)}</button>'
    tpls += f'<template id="rd{k}"><p class="settled"><b>Round {k + 1}: {E(t)}.</b> {E(w)} After it, the 2 MB rung stood at {n:,} bytes.</p>{render(open(f"dialogue/{fn}.md").read())}</template>\n'
talk = f'''<dialog id="talk" aria-labelledby="talk-h"><div class="tk">
<header><h2 id="talk-h">Ash and Rowan</h2><button class="x" aria-label="Close">×</button>
<p>The measured-Earth 2 MB rung (now at <a href="2mb-earth/">2mb-earth</a>) was filled by an argument. Overnight, two Claude agents took turns, six rounds of them. <b class="a">Ash</b> proposed: a naturalist and builder, ranking ideas by what each bought per byte. <b class="r">Rowan</b> checked: a sceptical engineer who read the code, measured the data, and pushed back on anything fake. Then the main session built what they agreed. Their own words, unedited except for typos.</p>
<nav role="tablist" aria-label="Rounds">{chips}</nav></header>
<div class="body" id="talk-b" tabindex="0"></div></div></dialog>
{tpls}'''
page = '''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orders of Magnitude: one forest, five sizes</title>
<style>
:root { --field: #0d120d; --ink: #eef0e2; --dim: #a9b19c; --line: rgba(238,240,226,.16); --amber: #e8b25a; --lichen: #a8c99a; --serif: 'Fraunces', 'Iowan Old Style', Palatino, Georgia, serif; }
* { box-sizing: border-box; }
html { background: var(--field); }
body { margin: 0; background: radial-gradient(1400px 700px at 20% 0%, #1a2418 0%, rgba(13,18,13,0) 70%) no-repeat; color: var(--ink); font: 400 16px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { max-width: 980px; margin: 0 auto; padding: 64px 22px 90px; }
header { max-width: 640px; margin-bottom: 44px; }
h1 { margin: 0 0 14px; font: italic 600 clamp(40px, 7vw, 64px)/1 var(--serif); letter-spacing: -.01em; }
h1 small { display: block; margin-top: 10px; font: italic 400 clamp(19px, 2.6vw, 24px)/1.2 var(--serif); color: var(--lichen); letter-spacing: 0; }
.lede { margin: 0 0 22px; font-size: 17px; color: var(--ink); text-wrap: pretty; }
.how { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; } .how > p { width: 100%; margin: 0 0 2px; font: italic 400 15px/1 var(--serif); color: var(--lichen); }
.story { display: inline-block; background: none; cursor: pointer; padding: 10px 18px; border: 1px solid var(--amber); border-radius: 999px; color: var(--ink); text-decoration: none; font: italic 500 17px/1.2 var(--serif); }
.story:hover, .story:focus-visible { background: var(--amber); color: #1b160c; outline: none; }
.rung { display: grid; grid-template-columns: minmax(0, var(--w)) minmax(260px, 1fr); gap: 22px 28px; align-items: start; }
.r4 { grid-template-columns: 1fr; }
.pic { position: relative; display: block; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: #fff; }
.pic img { display: block; width: 100%; height: auto; transition: transform .5s cubic-bezier(.2,.7,.2,1); }
.pic span { position: absolute; right: 10px; bottom: 10px; padding: 5px 11px; border-radius: 999px; background: rgba(13,18,13,.72); font: italic 500 14px/1 var(--serif); opacity: 0; transition: opacity .2s; }
.pic:hover img, .pic:focus-visible img { transform: scale(1.04); } .pic:hover span, .pic:focus-visible span { opacity: 1; }
.pic:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; }
h2 { margin: 0 0 8px; font: italic 500 clamp(22px, 3vw, 28px)/1.15 var(--serif); }
h2 a { color: inherit; text-decoration: none; } h2 a:hover { color: var(--amber); }
h2 b { display: block; font: 700 clamp(30px, 5vw, 44px)/1 var(--serif); font-style: normal; color: var(--amber); margin-bottom: 4px; font-variant-numeric: lining-nums; }
.line { margin: 0 0 14px; max-width: 54ch; text-wrap: pretty; }
.fill p { margin: 6px 0 0; font-size: 13px; color: var(--dim); } .fill b { color: var(--ink); font-weight: 600; }
.jar { height: 8px; max-width: 320px; border-radius: 999px; background: rgba(238,240,226,.1); overflow: hidden; }
.jar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--lichen), var(--amber)); }
.code { margin: 16px 0 0; } .code figcaption { font: italic 400 14px/1 var(--serif); color: var(--lichen); margin-bottom: 6px; }
.code code { display: block; padding: 12px 14px; border-radius: 10px; background: rgba(0,0,0,.35); border: 1px solid var(--line); font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; color: var(--dim); word-break: break-all; }
.was { margin: 10px 0 0; font-size: 14px; opacity: .8; } .r4 .was { grid-column: 1; } .was a { color: var(--lichen); }
.try { margin-top: 16px; } .try p { margin: 0 0 6px; font: italic 400 15px/1 var(--serif); color: var(--lichen); }
.try ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.try li { padding-left: 20px; position: relative; font-size: 14.5px; max-width: 60ch; text-wrap: pretty; }
.try li::before { content: ''; position: absolute; left: 3px; top: .55em; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid var(--amber); }
.try b { font-weight: 600; color: var(--ink); }
.r4 .txt { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 36px; } .r4 .txt > h2, .r4 .txt > .line, .r4 .txt > .fill { grid-column: 1; } .r4 .try { grid-column: 2; grid-row: 1 / span 3; margin-top: 4px; } .r4 details { grid-column: 1 / -1; }
details { margin-top: 22px; border-top: 1px solid var(--line); }
summary { cursor: pointer; padding: 14px 0; font: italic 500 18px/1.2 var(--serif); color: var(--ink); list-style: none; }
summary::-webkit-details-marker { display: none; } summary::after { content: ' +'; color: var(--amber); } details[open] summary::after { content: ' −'; }
summary:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px 28px; }
dt { font: italic 600 16px/1.2 var(--serif); color: var(--lichen); } dd { margin: 4px 0 0; font-size: 14px; color: var(--dim); text-wrap: pretty; }
.step { position: relative; height: 74px; }
.step::before { content: ''; position: absolute; left: 18px; top: 8px; bottom: 8px; width: 1px; background: linear-gradient(var(--line), var(--amber), var(--line)); }
.step span { position: absolute; left: 32px; top: 50%; transform: translateY(-50%); font: italic 400 14px/1 var(--serif); color: var(--lichen); }
dialog { padding: 0; border: 1px solid var(--line); border-radius: 16px; background: #121a12; color: var(--ink); width: min(900px, calc(100% - 24px)); max-height: calc(100dvh - 40px); box-shadow: 0 30px 80px rgba(0,0,0,.6); }
dialog::backdrop { background: rgba(5,8,5,.72); backdrop-filter: blur(3px); }
dialog[open] { animation: pop .22s cubic-bezier(.2,.8,.2,1); } @keyframes pop { from { transform: translateY(14px) scale(.98); opacity: 0; } }
.tk { display: flex; flex-direction: column; max-height: calc(100dvh - 42px); }
.tk header { max-width: none; margin: 0; padding: 22px 24px 0; border-bottom: 1px solid var(--line); position: relative; }
.tk h2 { margin: 0 0 8px; font: italic 600 28px/1.1 var(--serif); } .tk header p { margin: 0 0 14px; font-size: 14.5px; color: var(--dim); max-width: 70ch; text-wrap: pretty; }
.tk .a { color: var(--amber); } .tk .r { color: var(--lichen); }
.x { position: absolute; right: 14px; top: 12px; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: none; color: var(--ink); font-size: 22px; line-height: 1; cursor: pointer; } .x:hover { border-color: var(--amber); }
.tk nav { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: thin; }
.tk nav button { flex: none; display: flex; align-items: baseline; gap: 7px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--line); background: none; color: var(--dim); font: 400 14px/1.2 var(--serif); cursor: pointer; }
.tk nav button b { font-style: normal; font-weight: 700; color: var(--amber); }
.tk nav button[aria-selected="true"] { background: var(--amber); border-color: var(--amber); color: #1b160c; } .tk nav button[aria-selected="true"] b { color: #1b160c; }
.body { overflow-y: auto; padding: 18px 24px 30px; display: flex; flex-direction: column; gap: 14px; }
.settled { margin: 0; padding: 12px 14px; border-radius: 10px; background: rgba(168,201,154,.08); font-size: 14px; color: var(--dim); } .settled b { color: var(--ink); font-weight: 600; }
.note { font-size: 13.5px; color: var(--dim); } .note p { margin: 0 0 8px; }
.turn { position: relative; max-width: 88%; padding: 12px 16px 6px; border-radius: 16px; font-size: 14.5px; line-height: 1.55; text-wrap: pretty; }
.turn .who { display: block; margin-bottom: 4px; font: italic 700 16px/1 var(--serif); }
.turn.ash { align-self: flex-start; background: rgba(232,178,90,.08); border: 1px solid rgba(232,178,90,.35); border-bottom-left-radius: 4px; } .turn.ash .who { color: var(--amber); }
.turn.rowan { align-self: flex-end; background: rgba(168,201,154,.08); border: 1px solid rgba(168,201,154,.35); border-bottom-right-radius: 4px; } .turn.rowan .who { color: var(--lichen); }
.turn.builder { align-self: center; max-width: 94%; background: rgba(238,240,226,.05); border: 1px dashed var(--line); } .turn.builder .who { color: var(--ink); }
.turn p, .turn ul, .turn ol { margin: 0 0 10px; } .turn ul, .turn ol { padding-left: 20px; } .turn li { margin-bottom: 4px; }
.turn code { font: 12.5px ui-monospace, Menlo, Consolas, monospace; background: rgba(0,0,0,.3); padding: 1px 4px; border-radius: 4px; word-break: break-word; }
.turn pre { overflow-x: auto; background: rgba(0,0,0,.3); padding: 10px; border-radius: 8px; } .turn pre code { background: none; padding: 0; }
.turn table { border-collapse: collapse; font-size: 13px; margin: 0 0 10px; display: block; overflow-x: auto; } .turn th, .turn td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; }
.turn strong { color: var(--ink); }
@media (max-width: 720px) { .tk header p { font-size: 13.5px; } dialog { width: 100%; max-height: 100dvh; height: 100dvh; border-radius: 0; margin: 0; max-width: none; } .tk { max-height: 100dvh; height: 100%; } .turn { max-width: 96%; } .tk header, .body { padding-left: 16px; padding-right: 16px; } }
footer { margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--dim); font-size: 13.5px; max-width: 70ch; text-wrap: pretty; }
footer a { color: var(--ink); }
@media (max-width: 720px) {
  .rung { grid-template-columns: 1fr; } .pic { width: var(--w); min-width: 46%; }
  .r4 .txt { display: block; } .step { height: 56px; }
}
@media (prefers-reduced-motion: reduce) { .pic img { transition: none; } }
</style></head><body><main>
<header>
<h1>Orders of Magnitude<small>one forest, five sizes</small></h1>
<p class="lede">Each rung gets ten times more room than the one before, and has to fit in it whole. There are no pictures or 3D models inside, only rules. At the top there are also measurements of the real Earth. Smallest first:</p>
<div class="how"><p>How it works</p><a class="story" href="story/">What’s happening… how each one was squeezed or stuffed ↗</a><button class="story" id="talk-o" type="button">Listen in: two agents arguing over how to fill 2 MB</button></div>
</header>
''' + rows + talk + '''<footer>The pictures on this page are screenshots, taken for the index; the rungs themselves contain none. Rungs from 2 kB up unpack themselves in the browser, so open them from the web rather than as saved files. Measured data: ETOPO 2022 (NOAA), CRU CL 2.0, Little’s range maps (USGS) and Caudullo et al. 2017; see <a href="https://github.com/samuelling/procedural/blob/main/orders/DATA.md">DATA.md</a>. Source: <a href="https://github.com/samuelling/procedural/tree/main/orders">github.com/samuelling/procedural</a>.</footer>
</main>
<script>
const d = document.getElementById('talk'), b = document.getElementById('talk-b'), tabs = d.querySelectorAll('nav button');
const show = (k) => { for (const t of tabs) t.setAttribute('aria-selected', t.dataset.r == k); b.replaceChildren(document.getElementById('rd' + k).content.cloneNode(true)); b.scrollTop = 0; };
document.getElementById('talk-o').addEventListener('click', () => { if (!b.firstChild) show(0); d.showModal(); });
d.querySelector('.x').addEventListener('click', () => d.close());
d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
for (const t of tabs) t.addEventListener('click', () => show(t.dataset.r));
if (location.hash === '#agents') { show(0); d.showModal(); }
</script></body></html>
'''
open('site/index.html', 'w').write(page)
print(open('site/index.html').read().count('<section class="rung'), 'rungs listed;', sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk('site') for f in fs), 'bytes in site/')
