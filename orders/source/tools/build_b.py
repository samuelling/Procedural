# Minifies b/forest.glsl, drops it into b/main.js, and packs the result.
import re, subprocess, sys
g = open('b/forest.glsl').read()
g = re.sub(r'//[^\n]*', '', g); g = re.sub(r'\s+', ' ', g).strip()
g = re.sub(r' ?([{}()=+\-*/,;<>?:]) ?', r'\1', g)
js = open('b/main.js').read().replace('\n', '').replace('__GLSL__', g)
open('b/packed.js', 'w').write(js)
sys.exit(subprocess.call(['python3', 'tools/pack.py', 'b/packed.js', 'b/index.html', '2000']))
