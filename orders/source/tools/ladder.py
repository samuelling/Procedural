# Assembles site/: each rung's page under its own folder, the thumbnails, and an index that reports real bytes
# against each allowance. The index is a staircase: each rung's picture grows as the allowance does.
import os, shutil, html
E = html.escape
TRY = ['Tap <b>Fallen leaf</b> on the scale at the right and fall 100,000 times smaller, a window at a time',
       '<b>Places → Anywhere on Earth</b>, then click where you grew up',
       '<b>Happenings → Wolves</b>, then <b>Time → Fast forward</b>, and watch the seedlings come back',
       '<b>Places → Another age</b>, and stand among the coal swamps’ scale trees']
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
 ('200kb', 200000, 'd/index.html', 'The whole world, seen coarser',
  'Everything the top rung does: every animal, every age, every scale. Only the Earth is blurrier, measured in 300 km squares.',
  'a novella', TRY[:2], None),
 ('2mb', 2000000, 'e/index.html', 'A world that keeps time and place',
  'A forest where things happen to each other, from 640 km of mountains down to the mites on a leaf, grown on the real climate of anywhere you click.',
  'one photo from your phone', TRY, [
   ('Lives', 'Deer, wolves, foxes, hares, beavers and birds, each with hunger, an age and two inherited genes. Does fawn in spring, stags roar, wolves hunt, deer remember where the kills were.'),
   ('A wood that changes', 'Trees grow, age, fall and burn. Lightning fires run on the wind and stop at water. Beavers drown a stand under their pond. Over centuries the trees evolve into new species, with a tree of life to prove it.'),
   ('Time', 'Day and night, aurora, four seasons, storms. Rewind and fast forward. Nine other ages, from the first trees of the Devonian to mammoths and the wildwood.'),
   ('Places', 'Anywhere on Earth, from measured heights, months, rain and tree ranges. Ten forests, a kelp forest, under a lake, inside a limestone cave.'),
   ('Scales', 'Mountain range, plot, rotting log, moss or under the bark, soil, the underside of a leaf: ten times smaller each step, each world seen through a window into the next.'),
   ('Look closer', 'Walk it on foot, with animals that hear you coming. Double-click anything: leaf veins, single needles, lichens, dew at dawn, a ladybird or two.')]),
]
os.makedirs('site/thumbs', exist_ok=True)
for f in os.listdir('thumbs'): shutil.copyfile('thumbs/' + f, 'site/thumbs/' + f)
rows, W = '', [30, 42, 58, 78, 100]   # the picture's share of the row, rung by rung
for k, (folder, lim, src, title, line, like, tries, inside) in enumerate(R):
    os.makedirs('site/' + folder, exist_ok=True); shutil.copyfile(src, f'site/{folder}/index.html')
    n = os.path.getsize(src); assert n <= lim, (folder, n); pct = 100 * n / lim
    size = folder.replace('kb', ' kB').replace('mb', ' MB')
    extra = ''
    if folder == '0.2kb': extra = f'<figure class="code"><figcaption>All of it:</figcaption><code>{E(open(src).read().strip())}</code></figure>'
    if tries: extra += '<div class="try"><p>Try</p><ul>' + ''.join(f'<li>{t}</li>' for t in tries) + '</ul></div>'
    if inside: extra += '<details><summary>Everything in it</summary><dl>' + ''.join(f'<dt>{E(a)}</dt><dd>{E(b)}</dd>' for a, b in inside) + '</dl></details>'
    step = '' if k == 0 else '<div class="step" aria-hidden="true"><span>×10 the room</span></div>'
    rows += f'''{step}<section class="rung r{k}" style="--w:{W[k]}%">
<a class="pic" href="{folder}/"><img src="thumbs/{folder}.webp" alt="" loading="{'eager' if k < 2 else 'lazy'}" width="720" height="450"><span>Open ↗</span></a>
<div class="txt"><h2><a href="{folder}/"><b>{size}</b> {E(title)}</a></h2>
<p class="line">{E(line)}</p>
<div class="fill"><div class="jar"><i style="width:{max(pct, .4):.2f}%"></i></div><p><b>{pct:.1f}% full</b> · {n:,} of {lim:,} bytes, {E(like)}</p></div>
{extra}</div></section>
'''
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
.story { display: inline-block; padding: 10px 18px; border: 1px solid var(--amber); border-radius: 999px; color: var(--ink); text-decoration: none; font: italic 500 17px/1.2 var(--serif); }
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
<a class="story" href="story/">What’s happening… how each one was squeezed or stuffed ↗</a>
</header>
''' + rows + '''<footer>The pictures on this page are screenshots, taken for the index; the rungs themselves contain none. Rungs from 2 kB up unpack themselves in the browser, so open them from the web rather than as saved files. Measured data: ETOPO 2022 (NOAA), CRU CL 2.0, Little’s range maps (USGS) and Caudullo et al. 2017; see <a href="https://github.com/samuelling/procedural/blob/main/orders/DATA.md">DATA.md</a>. Source: <a href="https://github.com/samuelling/procedural/tree/main/orders">github.com/samuelling/procedural</a>.</footer>
</main></body></html>
'''
open('site/index.html', 'w').write(page)
print(open('site/index.html').read().count('<section'), 'rungs listed;', sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk('site') for f in fs), 'bytes in site/')
