# python3 tools/riverpack.py ne_10m_rivers_lake_centerlines.geojson cont/riverdata.js
# The world's major rivers for the 2 MB rung: Natural Earth 1:10m river centerlines (public domain), the rivers of
# scale rank 1-3 plus a list of well-known smaller ones by name; lake centerlines left out (the lakes are in the maps).
# Each line simplified (Ramer-Douglas-Peucker, 2 km), its points snapped to 0.02 degrees and written as differences:
# "<rank><name>|lon,lat dlon,dlat ...;" in units of 0.02 degrees. Courses are good to about 2 km.
import json, math, sys

WL = {'Rhine', 'Rhein', 'Rio Grande', 'Yenisey', 'Dnieper', 'Dicle', 'Tigris', 'Seine', 'Salween', 'Ebro', 'Elbe', 'Colorado',
      'Tajo', 'Tagus', 'Vistula', 'Loire', 'Rhône', 'Don', 'Thames', 'Hudson', 'Potomac', 'Uruguay', 'Po', 'Krishna', 'Orange',
      'Xi', 'Fraser', 'Sacramento', 'Tennessee', 'Arkansas', 'Kolyma', 'Ural', 'Oder', 'Connecticut', 'Delaware', 'Chao Phraya',
      'Pearl', 'Kama', 'Limpopo', 'Narmada', 'Nelson', 'Saskatchewan', 'Indigirka'}
TOL, Q = 2.0, 0.02

def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]; dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy)
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]; d = abs(dy * (x - x1) - dx * (y - y1)) / L if L > 1e-12 else math.hypot(x - x1, y - y1)
        if d > best: best, bi = d, i
    return rdp(pts[:bi + 1], eps)[:-1] + rdp(pts[bi:], eps) if best > eps else [pts[0], pts[-1]]

def main(src, out):
    d = json.load(open(src)); lines = []; npts = 0
    for f in d['features']:
        p = f['properties']; n = (p.get('name_en') or p.get('name') or '').replace('|', ' ').replace(';', ' ')
        r = p['scalerank']
        if p['featurecla'] != 'River' or r is None or not (r <= 3 or (n in WL and r <= 8)): continue
        g = f['geometry']; cs = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for c in cs:
            k = math.cos(math.radians(c[0][1]))
            s = rdp([(x * k * 111, y * 111) for x, y in c], TOL)
            qq = [(round(x / k / 111 / Q), round(y / 111 / Q)) for x, y in s]
            dd = [qq[0]] + [(qq[i][0] - qq[i - 1][0], qq[i][1] - qq[i - 1][1]) for i in range(1, len(qq))]
            dd = [t for i, t in enumerate(dd) if i == 0 or t != (0, 0)]
            if len(dd) < 2: continue
            lines.append(f"{int(min(r, 9))}{n}|" + ' '.join(f'{a},{b}' for a, b in dd)); npts += len(dd)
    s = ';'.join(lines)
    open(out, 'w').write("// the world's major rivers (Natural Earth 1:10m centerlines, public domain), packed by tools/riverpack.py\nexport const RIVERS = '" + s.replace("'", "\\'") + "';\n")
    print(out, len(lines), 'lines', npts, 'points', len(s), 'B')

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
