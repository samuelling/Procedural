# Assembles site/: each rung's page under its own folder, and an index that reports real bytes against each allowance.
import os, shutil, html
R = [  # folder, allowance in bytes, built file, title, what is in it
 ('0.2kb', 200, 'a/index.html', 'One formula', 'Eighty firs in mist. One loop draws every tree as stacked bars; size, height and paleness all come from the tree\'s index.'),
 ('2kb', 2000, 'b/index.html', 'One shader', 'Ten rows of trees computed per pixel: conifers with drooping tiers, ragged broadleaves, birches, boulders, mushrooms, grass, sun shafts with dust, falling leaves, a deer walking through. It drifts sideways forever.'),
 ('20kb', 20000, 'c/index.html', 'A genome and a grammar', 'Sylva: real 3D. Four biomes, eight species grown branch by branch, pipe-model trunks, moss as a rule, stones, logs, ferns, sun shadows, fog, light shafts, depth of field, wind and birdsong.'),
 ('200kb', 200000, 'd/index.html', 'The whole world, seen coarser', ''),
 ('2mb', 2000000, 'e/index.html', 'A world that keeps time and place', ''),
]
notes = {}
if os.path.exists('tools/notes.py'): exec(open('tools/notes.py').read(), notes)
rows = ''
for folder, lim, src, title, what in R:
    what = notes.get('WHAT', {}).get(folder, what)
    if not os.path.exists(src):
        rows += f'<li class="off"><div class="h"><b>{folder.replace("kb"," kB").replace("mb"," MB")}</b><span>{html.escape(title)}</span><em>still growing</em></div></li>\n'; continue
    os.makedirs('site/' + folder, exist_ok=True); shutil.copyfile(src, f'site/{folder}/index.html')
    n = os.path.getsize(src); assert n <= lim, (folder, n)
    pct = 100 * n / lim
    rows += (f'<li><a href="{folder}/"><div class="h"><b>{folder.replace("kb"," kB").replace("mb"," MB")}</b><span>{html.escape(title)}</span>'
             f'<em>{n:,} of {lim:,} bytes · {pct:.1f}%</em></div><div class="bar"><i style="width:{max(pct, .4):.2f}%"></i></div><p>{html.escape(what)}</p></a></li>\n')
page = '''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orders of Magnitude: a forest</title>
<style>
:root { --field: #0a0d0a; --ink: #f1f3ea; --dim: #b9c0ad; --line: rgba(241,243,234,.2); --sun: #ffc457; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--field); color: var(--ink); font: 400 16px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 56px 20px 80px; }
h1 { margin: 0 0 8px; font: italic 600 34px/1.1 'Fraunces', 'Iowan Old Style', Palatino, Georgia, serif; }
.lede { margin: 0 0 36px; color: var(--dim); max-width: 60ch; text-wrap: pretty; }
ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
li { border-bottom: 1px solid var(--line); }
li a, li.off { display: block; padding: 20px 4px; color: inherit; text-decoration: none; }
li a:hover, li a:focus-visible { background: rgba(241,243,234,.05); outline: none; }
.h { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }
.h b { font: 600 22px/1.1 ui-monospace, Menlo, Consolas, monospace; min-width: 5.2em; font-variant-numeric: tabular-nums; }
.h span { font: italic 500 19px/1.2 'Fraunces', 'Iowan Old Style', Palatino, Georgia, serif; }
.h em { margin-left: auto; font: 400 12px/1.2 ui-monospace, Menlo, Consolas, monospace; color: var(--dim); font-style: normal; font-variant-numeric: tabular-nums; }
.bar { height: 5px; margin: 12px 0 10px; background: rgba(241,243,234,.1); }
.bar i { display: block; height: 100%; background: var(--sun); }
li p { margin: 0; color: var(--dim); font-size: 14px; max-width: 68ch; text-wrap: pretty; }
.off { opacity: .5; }
.story { margin: -12px 0 32px; } .story a { display: block; padding: 14px 16px; border: 1px solid var(--sun); color: var(--ink); text-decoration: none; font-weight: 600; } .story a:hover { background: rgba(255,196,87,.08); } .story span { display: block; font-weight: 400; font-size: 14px; color: var(--dim); }
footer { margin-top: 32px; color: var(--dim); font-size: 13px; max-width: 68ch; text-wrap: pretty; }
footer a { color: var(--ink); }
</style></head><body><main>
<h1>Orders of Magnitude</h1>
<p class="lede">The same subject, a forest, at five sizes. Each rung is one page that must fit its allowance whole: program, numbers and unpacker. No stored images, models or sound. The bar shows how much of the allowance the rung really uses.</p>
<p class="story"><a href="story/">What’s happening… <span>order by order: what each rung had to cut, how the top one was filled, and the two agents who argued it out</span></a></p>
<ol>
''' + rows + '''</ol>
<footer>__FOOT__ Rungs from 2 kB up unpack themselves in the browser, so they need to be served from a web address rather than opened as a file. Source: <a href="https://github.com/samuelling/procedural/tree/main/orders">github.com/samuelling/procedural</a>.</footer>
</main></body></html>
'''
open('site/index.html', 'w').write(page.replace('__FOOT__', notes.get('FOOT', '')))
print(open('site/index.html').read().count('<li'), 'rungs listed;', sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk('site') for f in fs), 'bytes in site/')
