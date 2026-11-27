# Assembles site/: each rung's page under its own folder, the thumbnails, and an index that reports real bytes
# against each allowance. The index is a staircase: each rung's picture grows as the allowance does.
import os, shutil, html, re, markdown, json
BYTES = json.load(open('bytes.json'))   # where each rung's bytes go, from tools/bytes.mjs
HUES = {'Measured data': '#7fb3c8', 'The living world': '#a8c99a', 'Ground, water, towns and weather': '#c9a46c', 'Sky, space and the very small': '#ab9bd8',
        'The engine: drawing, moving, the readout': '#e8b25a', 'Map, compass and sound': '#d98f8a', 'The page and its unpackers': '#8f978a'}   # a group keeps its colour on every rung
HUE = ['#7fb3c8', '#a8c99a', '#e8b25a', '#ab9bd8', '#c9a46c', '#d98f8a', '#8f978a', '#b5b08a']   # for the small rungs' own parts
E = html.escape
TRY = ['Tap <b>Fallen leaf</b> on the scale at the right and fall 100,000 times smaller, a window at a time',
       '<b>Places → Anywhere on Earth</b>, then click where you grew up',
       '<b>Happenings → Wolves</b>, then <b>Time → Fast forward</b>, and watch the seedlings come back',
       '<b>Places → Another age</b>, and stand among the coal swamps’ scale trees',
       '<b>You → Walk</b> and keep going past the edge, at any scale. The forest, the mountain range, the lake bed, the log, the soil and the leaf all go on, grown around you as you come near']
R = [  # folder, allowance, built file, title, one line, as big as, things to try, everything in it
 ('0.2kb', 200, 'a/index.html', 'One formula',
  'Eighty firs fading into mist, from one loop. Each tree’s size, height and paleness come from its number in the line.',
  'about one text message', None, None),
 ('2kb', 2000, 'b/index.html', 'One shader',
  'Every pixel works out which tree it falls on. Ten rows of conifers, birches and oaks, sun shafts with dust in them, leaves falling, and now and then a deer.',
  'about a page of a paperback', ['Just watch. It drifts sideways forever, and the deer is in no hurry.'], None),
 ('20kb', 20000, 'c/index.html', 'A genome and a grammar',
  'Real 3D. Trees grown branch by branch from a genome, with moss where the rain runs, shadows, fog, wind and birdsong.',
  'a short story', ['Switch forests, then <b>Reseed</b> for a new one. No two are the same.'], None),
 ('200kb', 200000, 'd/index.html', 'The measured Earth, seen coarser',
  'The real-Earth forest: every animal, every age, every scale, grown on the climate of anywhere you click. The Earth is measured in 300 km squares.',
  'a short novel', TRY[:2], None),
 ('2mb', 2000000, 'w/index.html', 'The living Earth, from quarks to the cosmic web',
  'The real Earth from its measured maps: ground and sea floor, lakes, climate, and real trees where they grow, under the Sun, Moon and stars where they are right now, with its cities’ real lights on the night side. The Moon, Mercury, Venus and Mars from their own maps, the giants to their cloud tops. Herds, hares, hawks, fish and whales that are born, compete, evolve and die; trees that grow, seed and fight for light and water; weather and snow that build through the year. Zoom from the quarks in a grain of sand out past the Milky Way to the cosmic web without one cut, with synthesised sound, and through a wormhole at the Earth’s L4 point to six invented worlds.',
  'less than one photo from your phone', [
   'Open <b>Go to…</b> at the bottom right: a real place on Earth, the Moon, Mars, or a giant’s cloud tops. You arrive wherever the Sun now stands nicely',
   'Look at a tree to read its name: a real species, of a genus that grows there',
   'Use <b>time of day…</b> and <b>month…</b> at the bottom right to see the same place at sunrise, at midnight, or in another season',
   'Point at an animal to read who it is: its name, age, generation and how its genes differ from its ancestors’. Then set <b>ten years a second</b> (the time button, or <b>]</b>) and watch the herd and its hunters rise and fall, and the gaps in the forest fill. What you have seen is still there next visit',
   'Go to the boreal forest of Quebec, pick <b>month… March</b>, and walk on the snow; fly up to see the flocks; swim off a coast to see the schools and what hunts them',
   'Fly low and keep scrolling into the ground: past grains and crystals down to atoms and quarks. Scroll back out, or press <b>U</b>, to come up',
   'Scroll out until the Earth is a dot: the Moon, the planets and the Sun are where they are today. Keep going: the Milky Way in its true tilt, then galaxies, then the web',
   'Pick <b>Go to… → The wormhole at the Earth’s L4 point</b> and fly in. You come out on Sylva, the first of six invented worlds',
   'Pick an age (or press <b>,</b> and <b>.</b>): the same ground in the last ice age, or 150 million years ago, under that age’s plants'], [
   ('The Earth', 'ETOPO 2022 heights every 6 arc-minutes (11 km) on land, the sea floor every 24, and 255 lakes from Natural Earth at their own levels. Finer than the map, invented octaves as rough as the map is rough there, so ranges are craggy and plains stay plains, held back at the shore so the coast stays where the map has it. Around each of the 24 places in Go to…, a square about 44 km across is finer still, from ETOPO’s 15 arc-second heights (about 450 m), so the real ridges and gullies are there.'),
   ('Climate', 'CRU CL 2.0 normals (1961–90) every half degree: the year’s mean temperature, the swing from winter to summer, the year’s rain. They decide forest, savanna, grassland, desert, snow and the tree line; the season is the real one for the date.'),
   ('Trees', '64 real genera and 671 named species. Nine (oaks, beeches, spruces, pines, birches, firs, larches, maples, limes) grow where range maps put them in North America and Europe; the rest by region and climate (eucalyptus in Australia, baobabs in Africa and Madagascar, saguaros in the Sonoran Desert, southern beeches in Chile and New Zealand). Which species of a genus stands where within a region is drawn from that region’s list, not mapped. The forest is where the climate would put it: farms and cities are not in the maps.'),
   ('Sky and time', 'The real date and time: the Sun where it stands over your place, the Moon in its phase, the planets as points in the night sky (to a few minutes of arc). Speed time up and the seasons turn as they do. Overhead, the 10,526 real stars of the HYG catalogue; on the Earth’s night side, its real lights, from NASA’s Black Marble.'),
   ('The Moon and the planets', 'Land on the Moon (LOLA) and Mars (MOLA), each from a half-degree map, and Venus (Magellan) and Mercury (MESSENGER) from one-degree maps, with invented craters and detail finer than that. Jupiter, Saturn (with its rings), Uranus and Neptune go down to their cloud tops. Each turns on its real axis at its real rate, so a lunar day lasts a month, and from the Moon the Earth hangs in the sky.'),
   ('The wormhole', 'Sixty degrees ahead of the Earth in its orbit, at its L4 point, a mouth 1,000 km across bends the starlight and shows Sylva inside. Go in and you come out there; Sylva’s own mouths lead on to the other five invented worlds, and one leads back.'),
   ('Down to quarks', 'Zoom into anything under the pointer and it goes on down in its own kind: a leaf to veins, jigsaw cells, stomata and the wax of its cuticle; bark to cork cells and cellulose fibrils; water to the diatoms drifting under its skin; snow to six-armed crystals; sand, rock, soil and lunar dust to their grains and crystals. Each ends in its own atoms (carbon and hydrogen in wax, water’s bent molecules, oxygen and silicon in quartz), then an electron cloud, a nucleus of alpha clusters (or for hydrogen one proton), and three quarks held by the gluon field. Below about a fifth of a micrometre the colours are conventions, said so on screen. At night the microscope brings its own lamp.'),
   ('Out to the cosmic web', 'The Sun and the real planets on their orbits, then the real stars round the Sun (every one the eye can see and every one within 20 parsecs, from the HYG catalogue, at their measured places and distances, so the constellations come apart as you leave), invented stars beyond, the Milky Way marched through as disc, arms, bulge and dust in its real orientation, with its centre 8.2 kpc off toward Sagittarius, then other galaxies and the walls and filaments of the cosmic web. Forty-four powers of ten in all.'),
   ('Deep time', 'Eight ages back 450 million years: the climate warms or cools, the sea rises or falls, and the plants are those of the age, each genus from when it first appears in the fossil record, then cycads, tree ferns, scale trees and the first trees. The continents stay where they are today: their real past positions are not in this page’s data.'),
   ('Animals', 'Each square kilometre of open country keeps two food chains, chosen by place: a herd and its hunters (bison and wolves on the Great Plains, elk and cougars in the West, mule deer in its deserts, wildebeest and lions in the Serengeti, red deer and wolves in Europe, kangaroos and dingoes, guanacos and pumas, chital and tigers; mammoths in the ice age, sauropods and Allosaurus 150 million years ago), and in a 10-hectare plot of it, hares and the foxes, lynx or jackals that live on them (snowshoe hares and lynx in the boreal north). Every animal is an individual with a name, a sex, an age and four genes from both parents (size, speed, wariness, coat), born in spring and dying of age, hunger, cold or the hunters, and built to its kind: antlers on stags, horns, humps, manes, a trunk and tusks, a kangaroo that hops, an Allosaurus on two legs. Nothing is scripted: the hunters catch the slow, the young and the old; big bodies survive cold winters but starve first when grass is short; the wary are caught less but raise fewer young. So the herds evolve, and the hunters grow, starve, arrive and move on as their prey rise and fall. Near you there are chases, won and lost. Densities, kill rates and litters come from field studies (Yellowstone’s wolves and elk, the Serengeti’s lions, Kluane’s hares and lynx, Scotland’s red deer).'),
   ('Who lives where', 'Every square kilometre also keeps a census of a hectare of it, class by class, set by its climate the way field counts go: ants by the million in the tropics and warm deserts, earthworms by the million in cool damp soil (and none in frozen ground), red-backed salamanders near ten thousand a hectare in eastern North American forests, frogs in wet tropical litter, lizards in deserts, mice and voles, birds by what the land grows, bats sparsest of all; named by region (harvester ants and side-blotched lizards in the Mojave, weaver ants and litter frogs in Borneo, mantellas and chameleons in Madagascar), with the weight of each. Walk and look down: the ants foraging, salamanders and frogs out on wet nights, lizards basking on warm days, mice at night and bats after dusk are drawn as many as are out at that moment.'),
   ('Undergrowth and everyday animals', 'Under and between the trees, plants by climate and region: shrubs, heath and heather, saguaros in the Sonoran Desert and euphorbias in Africa’s, tussock and spinifex on dry plains, sagebrush, bamboo in East Asia, wildflowers in season, moss in wet woods and lichen on the tundra. And the animals you actually see on a walk: songbirds feeding and flitting about you by day (pigeons and sparrows in town) and squirrels, as many as the census holds.'),
   ('Towns', 'On today’s Earth the towns stand where people really live: how built-up each place is comes from NASA’s measured night lights (18 km cells), and the downtowns of 136 big cities are placed by hand with how tall they run, so Manhattan and Hong Kong rise in towers, Paris stays at six storeys, and Watertown is two- and three-storey houses with yards and street trees. The readout and the map name the nearest city; towns hum with traffic by day. The world’s major rivers (126 of them, from Natural Earth) run where they really run, good to about 2 km, named as you reach them. The streets and the buildings themselves are invented, and the wildlife thins where the ground is built over.'),
   ('Finding your way', 'A compass ball (top right) always shows where the sky and the ground are, north and the rest, and your target, even down a microscope where “up” is the surface you went into. A ruler under the scale shows where you are among the orders of magnitude, ten powers of ten at a time with something that size at each (a cell, a tree, a mountain, the Earth, the Milky Way), sliding as you zoom, over the whole span from quarks to the cosmic web. N opens a map, drawn from the same terrain and climate as the world, from 200 m across to the whole globe, with waypoints: the herds and water near you, the named places of each world, your own marks and the other worlds; pick one to follow it on the compass, or go. U rights you anywhere: out of the ground or the microscope, the view levelled, or turned to face the planet from space; and flying, the ground can no longer pin you. If you let the browser share your location, you start where you are standing, on today’s Earth (Go to… › Where you are brings you back).'),
   ('Plants, insects and birds', 'Within about 250 m every tree is a living thing: it grows by the light that gets past its taller neighbours and the water it wins against every crown near it, by its kind (a beech or fir grows on in shade where a birch or pine gives up), dies when it cannot keep up, stands as a snag and falls; mature trees seed the gaps, and a seedling takes where there is light and water and the deer do not eat it (more than about five deer to a square kilometre and the woods stop regenerating). Grass is shared by both chains of grazers and the insects, and grows short and brown where it is grazed hard. Midges, butterflies and, on warm nights, fireflies fly as thick as the insect numbers say; songbirds live on the insects and flock in murmurations; hawks live on the songbirds, rising a year or two after them. Under the microscope the soil tells you its springtails and the predatory mites that eat them.'),
   ('Water', 'Streams and ponds keep their own chain: insects in the water, trout (or tilapia, catfish, piranhas) on the insects, otters (a platypus in Australia) and herons on the fish; you may see a heron standing in the shallows. In the sea, plankton blooms with light and the nutrients of cold water, small fish eat it, seals, dolphins or sharks eat them, and whales strain the plankton and krill: the schools you swim among grow and shrink with these numbers, their hunters sweep round them, and the whales come and go.'),
   ('Weather', 'Each place’s measured mean, seasonal swing and rainfall, with the warmth a month behind the Sun (as land and sea are). On top, weather systems that bring spells warmer or colder than the season, and days that warm and nights that cool, most under dry skies. Rain falls as snow when it is below freezing where you are, and snow lies: a day-by-day account of the last nine months builds the snowpack and melts it by degree-days, so Quebec is deep in snow in March and Lake Baikal into April. The temperature is in the clock line.'),
   ('As on the invented worlds', 'Fire that runs before the wind, beaver ponds that fill and drain, kelp, reefs, fish and whales, caves with glow-worms, storms and aurora. On the invented worlds, towns stand where the land suits a town; on today’s Earth they stand where its measured lights say (see Towns).'),
   ('Sound', 'All synthesised, nothing recorded, and on from the first click or key (M turns it off): wind that swells with height, rain, thunder after lightning, fire crackling, birds by day (parrots in the tropics, crossbills and kinglets in the north), crickets and owls at night, and footsteps on moss, leaves or snow. It thins out as you climb, stops above the air and on airless worlds, and is muffled under water and in the microscope.')]),
]
os.makedirs('site/thumbs', exist_ok=True)
for f in os.listdir('thumbs'): shutil.copyfile('thumbs/' + f, 'site/thumbs/' + f)
os.makedirs('site/fonts', exist_ok=True)
for f in os.listdir('fonts'): shutil.copyfile('fonts/' + f, 'site/fonts/' + f)   # Doto, the dot-matrix face for headings (SIL OFL)
os.makedirs('site/2mb-earth', exist_ok=True); shutil.copyfile('e/index.html', 'site/2mb-earth/index.html')
def jar(r, size, lim):   # the fill bar, one stripe per group of parts
    i = ''.join(f'<i style="width:{100 * g['b'] / lim:.3f}%;background:{HUES.get(g['name'], HUE[k % len(HUE)])}" title="{E(g['name'])}: {g['b']:,} bytes"></i>' for k, g in enumerate(BYTES[r]['kids']) if not g.get('free'))
    return f'<button class="jar" data-r="{r}" aria-label="What the {size} rung’s bytes are spent on">{i}</button>'
SIZES = [  # each rung's allowance in things people already know the size of
 ('0.2 kB', 200, ['A text message and a bit (one holds 160 letters)', 'More than the Atari 2600 console’s whole memory: 128 bytes']),
 ('2 kB', 2000, ['A page of a paperback', 'The Gettysburg Address, with room to spare', 'Combat, the game packed in with the Atari 2600, on its 2 kB cartridge']),
 ('20 kB', 20000, ['A short story', 'The original Pac-Man arcade game: 16 kB of program']),
 ('200 kB', 200000, ['A short novel (The Great Gatsby is about 270 kB)', 'One floppy disk of the first IBM PC: 160 kB', 'Five copies of Super Mario Bros. (40 kB each)']),
 ('2 MB', 2000000, ['A little more than a 3½-inch floppy disk (1.44 MB)', 'Less than one photo from your phone (2 to 5 MB)', 'Less than a typical web page today (about 2.5 MB)', 'Two minutes of a song as an MP3']),
]
sizes = '<section class="sizes" aria-labelledby="sizes-h"><h2 id="sizes-h">How big is a kilobyte?</h2><p>A byte holds one letter. A kilobyte (kB) is a thousand bytes, about half a page of a book; a megabyte (MB) is a million, about a long novel. Each rung is ten times the one before, so the top one holds ten thousand times what the bottom one does. Each square below is drawn with an area in proportion to its rung’s allowance.</p><ol>' + ''.join(
    f'<li><span class="sq" style="width:{96 * (b / 2e6) ** .5:.2f}px;height:{96 * (b / 2e6) ** .5:.2f}px"></span><b>{k}</b><i>{b:,} bytes</i><ul>' + ''.join(f'<li>{E(t)}</li>' for t in things) + '</ul></li>' for k, b, things in SIZES) + '</ol><p class="more">For scale, a phone that holds 128 GB could hold sixty-four thousand copies of the top rung.</p></section>'
PIC = {  # "Everything in it": a screenshot of each part, taken in the 2 MB world by tools/scenes.py (tag, what it shows)
 'The Earth': ('earth', 'Flying over the Himalaya in the morning'), 'Climate': ('climate', 'Africa from 9,000 km up, desert to rainforest'),
 'Trees': ('trees', 'Under the trees in the Great Smoky Mountains'), 'Sky and time': ('sky', 'Europe’s night side, its cities lit'),
 'The Moon and the planets': ('moon', 'Over the Moon’s Tycho crater, 12 km up'), 'The wormhole': ('wormhole', 'The wormhole at the Earth’s L4 point'),
 'Down to quarks': ('quarks', 'Zoomed into the forest floor'), 'Out to the cosmic web': ('cosmos', 'Zoomed out past the galaxies'),
 'Deep time': ('deeptime', 'The Smokies 310 million years ago, among scale trees'), 'Animals': ('animals', 'The Serengeti from just above the grass'),
 'Who lives where': ('census', 'The forest floor in the Great Smoky Mountains'), 'Undergrowth and everyday animals': ('under', 'Saguaros in the Sonoran Desert'),
 'Towns': ('towns', 'Manhattan from 350 m up'), 'Finding your way': ('nav', 'The compass, the scale ruler and the map, in the Alps'),
 'Plants, insects and birds': ('plants', 'In the Black Forest'), 'Water': ('water', 'The shore of Lake Baikal in late November, from 900 m up'),
 'Weather': ('weather', 'Snow in the boreal forest of Quebec in March'), 'As on the invented worlds': ('aurora', 'Night over the Greenland ice sheet'),
 'Sound': ('sound', 'The Amazon at dawn, when the birds start'),
}
rows, W = '', [30, 42, 58, 78, 100]   # the picture's share of the row, rung by rung
for k, (folder, lim, src, title, line, like, tries, inside) in enumerate(R):
    os.makedirs('site/' + folder, exist_ok=True); shutil.copyfile(src, f'site/{folder}/index.html')
    n = os.path.getsize(src); assert n <= lim, (folder, n); pct = 100 * n / lim
    size = folder.replace('kb', ' kB').replace('mb', ' MB')
    extra = ''
    if folder == '0.2kb': extra = f'<figure class="code"><figcaption>All of it:</figcaption><code>{E(open(src).read().strip())}</code></figure>'
    if tries: extra += '<div class="try"><p>Try</p><ul>' + ''.join(f'<li>{t}</li>' for t in tries) + '</ul></div>'
    if folder == '2mb': extra += '<p class="was">This rung once held six invented worlds, still open on their own: <a href="worlds/">the invented worlds ↗</a>.</p>'
    if inside: extra += f'<details><summary>Everything in it <small>{len(inside)} parts, each seen in the world itself</small></summary><dl class="inside">' + ''.join(
        (f'<div><img src="thumbs/in-{PIC[a][0]}.webp" alt="" loading="lazy" width="640" height="400"><small class="seen">{E(PIC[a][1])}</small>' if a in PIC and os.path.exists(f'thumbs/in-{PIC[a][0]}.webp') else '<div>') + f'<dt>{E(a)}</dt><dd>{E(b)}</dd></div>' for a, b in inside) + '</dl></details>'
    step = '' if k == 0 else '<div class="step" aria-hidden="true"><span>×10 the room ↓</span></div>'
    rows += f'''{step}<section class="rung r{k}" id="rung-{folder}" style="--w:{W[k]}%">
<a class="pic" href="{folder}/"><img src="thumbs/{folder}.webp" alt="" loading="{'eager' if k < 2 else 'lazy'}" width="720" height="450"><span>Step in ↗</span></a>
<div class="txt"><h2><a href="{folder}/"><b>{size}</b> {E(title)}</a></h2>
<p class="line">{E(line)}</p>
<div class="fill">{jar(folder, size, lim)}<p><b>{pct:.1f}% full</b> · {n:,} of {lim:,} bytes, {E(like)} · <button class="where" data-r="{folder}">where they go</button></p></div>
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
<title>(M)orders of Magnitude: one world, five sizes</title>
<style>
:root { --field: #0d120d; --ink: #eef0e2; --dim: #a9b19c; --line: rgba(238,240,226,.16); --amber: #e8b25a; --lichen: #a8c99a; --serif: 'Fraunces', 'Iowan Old Style', Palatino, Georgia, serif; --dot: 'Doto', ui-monospace, monospace; --ui: system-ui, -apple-system, 'Segoe UI', sans-serif; }
@font-face { font-family: 'Doto'; src: url(fonts/doto.woff2) format('woff2'); font-weight: 100 900; font-display: swap; }
* { box-sizing: border-box; }
html { background: var(--field); }
body { margin: 0; background: radial-gradient(1400px 700px at 20% 0%, #1a2418 0%, rgba(13,18,13,0) 70%) no-repeat; color: var(--ink); font: 400 16px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { max-width: 980px; margin: 0 auto; padding: 64px 22px 90px; }
header { max-width: 640px; margin-bottom: 44px; }
h1 { margin: 0 0 14px; font: 800 clamp(40px, 7vw, 64px)/1 var(--dot); letter-spacing: -.01em; }
h1 small { display: block; margin-top: 10px; font: 700 clamp(19px, 2.6vw, 24px)/1.2 var(--dot); color: var(--lichen); letter-spacing: 0; }
.lede { margin: 0 0 22px; font-size: 17px; color: var(--ink); text-wrap: pretty; }
.how { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; } .how > p { width: 100%; margin: 0 0 2px; font: 500 15px/1 var(--ui); color: var(--lichen); }
.story { display: inline-block; background: none; cursor: pointer; padding: 10px 18px; border: 1px solid var(--amber); border-radius: 999px; color: var(--ink); text-decoration: none; font: 600 17px/1.2 var(--ui); }
.story:hover, .story:focus-visible { background: var(--amber); color: #1b160c; outline: none; }
.rung { display: grid; grid-template-columns: minmax(0, var(--w)) minmax(260px, 1fr); gap: 22px 28px; align-items: start; }
.r4 { grid-template-columns: 1fr; }
.pic { position: relative; display: block; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: #fff; }
.pic img { display: block; width: 100%; height: auto; transition: transform .5s cubic-bezier(.2,.7,.2,1); }
.pic span { position: absolute; right: 10px; bottom: 10px; padding: 5px 11px; border-radius: 999px; background: rgba(13,18,13,.72); font: 600 14px/1 var(--ui); opacity: 0; transition: opacity .2s; }
.pic:hover img, .pic:focus-visible img { transform: scale(1.04); } .pic:hover span, .pic:focus-visible span { opacity: 1; }
.pic:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; }
h2 { margin: 0 0 8px; font: 800 clamp(22px, 3vw, 28px)/1.15 var(--dot); }
h2 a { color: inherit; text-decoration: none; } h2 a:hover { color: var(--amber); }
h2 b { display: block; font: 800 clamp(30px, 5vw, 44px)/1 var(--dot); font-style: normal; color: var(--amber); margin-bottom: 4px; font-variant-numeric: lining-nums; }
.line { margin: 0 0 14px; max-width: 54ch; text-wrap: pretty; }
.fill p { margin: 6px 0 0; font-size: 13px; color: var(--dim); } .fill b { color: var(--ink); font-weight: 600; }
.code { margin: 16px 0 0; } .code figcaption { font: 500 14px/1 var(--ui); color: var(--lichen); margin-bottom: 6px; }
.code code { display: block; padding: 12px 14px; border-radius: 10px; background: rgba(0,0,0,.35); border: 1px solid var(--line); font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; color: var(--dim); word-break: break-all; }
.was { margin: 10px 0 0; font-size: 14px; opacity: .8; } .r4 .was { grid-column: 1; } .was a { color: var(--lichen); }
.try { margin-top: 16px; } .try p { margin: 0 0 6px; font: 500 15px/1 var(--ui); color: var(--lichen); }
.try ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.try li { padding-left: 20px; position: relative; font-size: 14.5px; max-width: 60ch; text-wrap: pretty; }
.try li::before { content: ''; position: absolute; left: 3px; top: .55em; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid var(--amber); }
.try b { font-weight: 600; color: var(--ink); }
.r4 .txt { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 36px; } .r4 .txt > h2, .r4 .txt > .line, .r4 .txt > .fill { grid-column: 1; } .r4 .try { grid-column: 2; grid-row: 1 / span 3; margin-top: 4px; } .r4 details { grid-column: 1 / -1; }
details { margin-top: 22px; border-top: 1px solid var(--line); }
summary { cursor: pointer; padding: 14px 0; font: 600 18px/1.2 var(--ui); color: var(--ink); list-style: none; }
summary::-webkit-details-marker { display: none; } summary::after { content: ' +'; color: var(--amber); } details[open] summary::after { content: ' −'; }
summary:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 26px 26px; }
.inside > div { display: flex; flex-direction: column; } .inside img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; margin-bottom: 10px; border-radius: 8px; border: 1px solid var(--line); background: #050805; }
summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; font: 800 26px/1.15 var(--dot) !important; letter-spacing: -.02em; } summary small { order: 3; width: 100%; }
.seen { margin: -4px 0 8px; font-size: 12.5px; font-style: italic; color: var(--dim); } summary small { display: block; margin-top: 4px; font: 500 14px/1.3 var(--ui); color: var(--dim); letter-spacing: 0; }
dt { font: 600 16px/1.2 var(--ui); color: var(--lichen); } dd { margin: 4px 0 0; font-size: 14px; color: var(--dim); text-wrap: pretty; }
.step { position: relative; height: 74px; }
.step::before { content: ''; position: absolute; left: 18px; top: 8px; bottom: 8px; width: 1px; background: linear-gradient(var(--line), var(--amber), var(--line)); }
.step span { position: absolute; left: 32px; top: 50%; transform: translateY(-50%); font: 500 14px/1 var(--ui); color: var(--lichen); }
dialog { padding: 0; border: 1px solid var(--line); border-radius: 16px; background: #121a12; color: var(--ink); width: min(900px, calc(100% - 24px)); max-height: calc(100dvh - 40px); box-shadow: 0 30px 80px rgba(0,0,0,.6); }
dialog::backdrop { background: rgba(5,8,5,.72); backdrop-filter: blur(3px); }
dialog[open] { animation: pop .22s cubic-bezier(.2,.8,.2,1); } @keyframes pop { from { transform: translateY(14px) scale(.98); opacity: 0; } }
.tk { display: flex; flex-direction: column; max-height: calc(100dvh - 42px); }
.tk header { max-width: none; margin: 0; padding: 22px 24px 0; border-bottom: 1px solid var(--line); position: relative; }
.tk h2 { margin: 0 0 8px; font: 800 28px/1.1 var(--dot); } .tk header p { margin: 0 0 14px; font-size: 14.5px; color: var(--dim); max-width: 70ch; text-wrap: pretty; }
.tk .a { color: var(--amber); } .tk .r { color: var(--lichen); }
.x { position: absolute; right: 14px; top: 12px; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: none; color: var(--ink); font-size: 22px; line-height: 1; cursor: pointer; } .x:hover { border-color: var(--amber); }
.tk nav { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: thin; }
.tk nav button { flex: none; display: flex; align-items: baseline; gap: 7px; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--line); background: none; color: var(--dim); font: 500 14px/1.2 var(--ui); cursor: pointer; }
.tk nav button b { font-style: normal; font-weight: 700; color: var(--amber); }
.tk nav button[aria-selected="true"] { background: var(--amber); border-color: var(--amber); color: #1b160c; } .tk nav button[aria-selected="true"] b { color: #1b160c; }
.body { overflow-y: auto; padding: 18px 24px 30px; display: flex; flex-direction: column; gap: 14px; }
.settled { margin: 0; padding: 12px 14px; border-radius: 10px; background: rgba(168,201,154,.08); font-size: 14px; color: var(--dim); } .settled b { color: var(--ink); font-weight: 600; }
.note { font-size: 13.5px; color: var(--dim); } .note p { margin: 0 0 8px; }
.turn { position: relative; max-width: 88%; padding: 12px 16px 6px; border-radius: 16px; font-size: 14.5px; line-height: 1.55; text-wrap: pretty; }
.turn .who { display: block; margin-bottom: 4px; font: 600 16px/1 var(--ui); }
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
.sizes { margin: -14px 0 56px; padding: 22px 24px 18px; border: 1px solid var(--line); border-radius: 14px; }
.sizes h2 { margin: 0 0 8px; font: 800 24px/1.15 var(--dot); }
.sizes > p { margin: 0 0 20px; max-width: 70ch; font-size: 15px; color: var(--dim); text-wrap: pretty; }
.sizes ol { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; margin: 0; padding: 0; list-style: none; }
.sizes ol > li { display: grid; grid-template-rows: 100px auto auto 1fr; align-content: start; }
.sizes .sq { align-self: end; display: block; min-width: 1px; min-height: 1px; margin-bottom: 10px; background: var(--lichen); border-radius: 1px; }
.sizes b { font: 800 22px/1.1 var(--dot); color: var(--ink); } .sizes i { font-style: normal; font-size: 13px; color: var(--dim); margin: 2px 0 8px; font-variant-numeric: tabular-nums; }
.sizes ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; font-size: 13.5px; line-height: 1.4; text-wrap: pretty; }
.sizes ul li { padding-left: 11px; position: relative; } .sizes ul li::before { content: ''; position: absolute; left: 0; top: .6em; width: 4px; height: 4px; border-radius: 50%; background: var(--amber); }
.sizes .more { margin: 18px 0 0; font-size: 14px; color: var(--dim); }
@media (max-width: 760px) { .sizes ol { grid-template-columns: 1fr; gap: 16px; } .sizes ol > li { grid-template-columns: 100px 1fr; grid-template-rows: auto auto 1fr; column-gap: 14px; } .sizes .sq { grid-row: 1 / 4; align-self: start; justify-self: center; margin: 4px 0 0; } }
#field { position: absolute; top: 0; left: 0; width: 100%; height: min(760px, 100vh); pointer-events: none; -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent); }
main { position: relative; }
@media (max-width: 760px) { #field { opacity: .45; } }
h1, h2 { letter-spacing: -.02em; } h1 { font-variation-settings: 'ROND' 100; text-shadow: 0 0 22px rgba(168,201,154,.35); }
.rung h2 b { text-shadow: 0 0 18px rgba(232,178,90,.35); }
.step span { font: 800 20px/1 var(--dot); letter-spacing: -.01em; }
.rail { position: fixed; right: max(14px, calc((100vw - 980px) / 2 - 120px)); top: 50%; transform: translate(10px, -50%); display: grid; gap: 0; opacity: 0; transition: opacity .3s, transform .3s; z-index: 2; }
.rail.show { opacity: 1; transform: translate(0, -50%); }
.rail a { display: flex; align-items: center; gap: 9px; padding: 9px 4px; color: var(--dim); text-decoration: none; font: 800 16px/1 var(--dot); position: relative; }
.rail a::before { content: ''; position: absolute; left: 7px; top: -9px; height: 18px; border-left: 1px dotted var(--line); } .rail a:first-child::before { display: none; }
.rail i { width: 9px; height: 9px; margin: 0 3px; border-radius: 50%; border: 1px solid var(--dim); flex: none; }
.rail a:hover { color: var(--ink); } .rail a[aria-current] { color: var(--amber); } .rail a[aria-current] i { background: var(--amber); border-color: var(--amber); box-shadow: 0 0 10px var(--amber); }
@media (max-width: 1200px) { .rail { display: none; } }
.sizes ul { align-content: start; } .sizes h2 { font-size: 30px; }
@media (prefers-reduced-motion: reduce) { .pic img { transition: none; } }
</style></head><body><canvas id="field" aria-hidden="true"></canvas><main>
<header>
<h1>(M)orders of Magnitude<small>one world, five sizes</small></h1>
<p class="lede">Each rung gets ten times more room than the one before, and has to fit in it whole. There are no pictures or 3D models inside, only rules and, at the top, the measured Earth: a forest at first, then the real world, measured and alive, from quarks to the cosmic web. Click any rung’s fill bar to see what its bytes are spent on. Start at the bottom and climb.</p>
<div class="how"><p>How it works</p><a class="story" href="story/">What’s happening… how each one was squeezed or stuffed ↗</a></div>
</header>
''' + sizes + rows + '''<footer>The pictures on this page are screenshots, taken for the index; the rungs themselves contain none. Rungs from 2 kB up unpack themselves in the browser, so open them from the web rather than as saved files. Measured data: ETOPO 2022 (NOAA), CRU CL 2.0, Natural Earth lakes, Little’s range maps (USGS), Caudullo et al. 2017, and the Moon, Mars, Venus and Mercury from LOLA, MOLA, Magellan and MESSENGER; see <a href="https://github.com/samuelling/procedural/blob/main/orders/DATA.md">DATA.md</a>. Source: <a href="https://github.com/samuelling/procedural/tree/main/orders">github.com/samuelling/procedural</a>.</footer>
</main>
<nav class="rail" aria-label="The rungs">''' + ''.join(f'<a href="#rung-{r[0]}"><i></i><span>{r[0].replace("kb", " kB").replace("mb", " MB")}</span></a>' for r in R) + '''</nav>
<script>''' + open('tools/field.js').read() + '''</script>
''' + open('tools/bytes_ui.html').read().replace('__BYTES__', json.dumps(BYTES, ensure_ascii=False).replace('</', '<\\/')).replace('__HUES__', json.dumps(HUES)).replace('__HUE__', json.dumps(HUE)) + '''
</body></html>
'''
open('site/index.html', 'w').write(page)
print(open('site/index.html').read().count('<section class="rung'), 'rungs listed;', sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk('site') for f in fs), 'bytes in site/')
