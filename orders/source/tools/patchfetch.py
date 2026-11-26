# python3 tools/patchfetch.py : downloads ETOPO 2022 15-arc-second surface heights round each Go-to place on the Earth
# (NOAA NCEI via the CoastWatch ERDDAP server; US government work), 128 x 128 cells centred on the place, into
# tmp/data/new/etopo15/<i>.nc. The cells are the ETOPO grid's own (centres at 7.5" past each 15").
import json, math, os, subprocess
P = json.loads(subprocess.run(['node', '-e', "const s=require('fs').readFileSync('cont/main.js','utf8'), m=s.match(/const PLACES = (\\[[\\s\\S]*?\\]\\]);/); console.log(JSON.stringify(eval(m[1]).filter((p) => p[1] === 100)))"], capture_output=True, text=True, check=True).stdout)   # the Go-to places on the Earth (main.js); N = 128; d = 15 / 3600
for i, (name, w, lat, lon) in enumerate(P):
    f = f'tmp/data/new/etopo15/{i}.nc'
    if os.path.exists(f) and os.path.getsize(f) > 30000: continue
    la0 = (math.floor((lat + 63.5 * d - d / 2) / d) + 0.5) * d; lo0 = (math.floor((lon - 63.5 * d - d / 2) / d) + 0.5) * d   # the northmost row, the westmost column
    la1 = la0 - (N - 1) * d; lo1 = lo0 + (N - 1) * d
    url = f'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.nc?z%5B({la1 - d / 4:.6f}):1:({la0 + d / 4:.6f})%5D%5B({lo0 - d / 4:.6f}):1:({lo1 + d / 4:.6f})%5D'
    subprocess.run(['curl', '-s', '--max-time', '200', '-o', f, url]); print(i, name, os.path.getsize(f))
