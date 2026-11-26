# python3 tools/starpack.py : packs the real stars into cont/stardata.js. Input: the HYG database v3.8 (David Nash,
# astronexus.com, CC BY-SA 4.0; Hipparcos, Yale Bright Star and Gliese catalogues combined), tmp/data/new/hyg_v38.csv.gz.
# Kept: every star the eye can see (V <= 6.5) and every star within 20 parsecs, whatever its brightness.
# Each star: right ascension and declination (J2000, 16 bits each), distance (log10 of parsecs, 16 bits), absolute
# visual magnitude (in eighths, from -12) and B-V colour (in 1/80ths, from -0.5). Unknown distances (the catalogue's
# 100000 pc) become 500 pc, the absolute magnitude then set so the star is as bright from the Sun as it is.
# Stored as planes (all the right ascensions, sorted and differenced, then the rest), raw deflate, base64.
import gzip, csv, math, zlib, base64, numpy as np
rows = []
for r in csv.DictReader(gzip.open('tmp/data/new/hyg_v38.csv.gz', 'rt')):
    if r['id'] == '0' or not r['mag']: continue
    m, d = float(r['mag']), float(r['dist'])
    if not (m <= 6.5 or d < 20): continue
    if d <= 0: continue
    if d >= 100000: d = 500.
    M = m - 5 * math.log10(d / 10)
    ci = float(r['ci']) if r['ci'] else 0.6
    rows.append((float(r['ra']) / 24, (float(r['dec']) + 90) / 180, d, M, ci))
rows.sort()
n = len(rows)
ra = np.array([round(x[0] * 65535) for x in rows], np.int64); de = np.array([round(x[1] * 65535) for x in rows], np.int64)
ld = np.array([round((math.log10(x[2]) + 1) / 5 * 65535) for x in rows], np.int64).clip(0, 65535)
am = np.array([round((x[3] + 12) * 8) for x in rows], np.int64).clip(0, 255); bv = np.array([round((x[4] + .5) * 80) for x in rows], np.int64).clip(0, 255)
dra = np.diff(np.concatenate([[0], ra]))
p16 = lambda a: (a & 255).astype(np.uint8).tobytes() + ((a >> 8) & 255).astype(np.uint8).tobytes()
raw = n.to_bytes(4, 'little') + p16(dra % 65536) + p16(de) + p16(ld) + am.astype(np.uint8).tobytes() + bv.astype(np.uint8).tobytes()
c = zlib.compressobj(9, zlib.DEFLATED, -15); z = c.compress(raw) + c.flush()
open('cont/stardata.js', 'w').write("// the real stars: see tools/starpack.py for what they are, DATA.md for where they come from\nexport const STARS = '" + base64.b64encode(z).decode() + "';\n")
print(n, 'stars;', len(raw), 'raw ->', len(z), 'deflated')
