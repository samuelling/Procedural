# python3 tools/earthpack.py : packs the measured maps the 2 MB rung carries into cont/earthdata.js (one base64 string
# of raw deflate, inflated in the page). Inputs, downloaded once into tmp/data/ (see DATA.md for sources and terms):
#   ETOPO 2022 60-arc-second surface elevation, read every 3 arc-minutes (tmp/data/etopo2022_60s_s3_band*.dods)
#   Natural Earth 1:50m lakes (public domain), tmp/data/ne/ne_50m_lakes.*
#   CRU CL 2.0 10-arc-minute normals 1961-90: temperature, rainfall, the grid's own height
#   the nine tree-genus range maps on the quarter-degree Koppen land grid (tmp/data/genera_15min_9_overlap.npy)
#   LOLA (Moon), MOLA (Mars), Magellan (Venus) and MESSENGER (Mercury) global elevation, quarter degrees (*_025.npy)
# Every grid runs from 90N in rows and from 180W in columns. The sections, in order (sizes in the JSON header):
#   land  6' grid (3600 x 1800) of q: -1 open sea, 0 a lake, else land of height (q / 2.3)^2 m; stored as the residual of
#         the median edge predictor (Weinberger's MED, as in LOCO-I), mod 256
#   sea   24' grid (900 x 450) of the sea floor, q = sqrt(depth) * 0.45 (land filled from the nearest sea), as residuals
#   lake  6' grid of lake numbers (0 none), then each lake's surface height (int16 m) in 'lakes'
#   clim  half-degree grids (720 x 360), each as residuals: the year's mean temperature brought to sea level at
#         6.5 C/km (half degrees, +128), the swing from winter to summer (half the July less January mean, half degrees,
#         signed, +128) and the year's rainfall (2.5 sqrt(mm)); the sea filled from the nearest land, eased far out
#         toward a band average
#   gen   the genus bits on the quarter-degree grid (uint16, two planes)
#   moon, mars: half-degree grids (720 x 360) of height in 50 m steps; venus, mercury: one-degree grids (360 x 180) in
#         40 m steps (int16 residuals, two planes)
import numpy as np, zlib, json, base64, gzip, re, sys
from scipy import ndimage
import shapefile
from PIL import Image, ImageDraw
D = 'tmp/data/'

def med(q):
    A = np.zeros_like(q); B = np.zeros_like(q); C = np.zeros_like(q)
    A[:, 1:] = q[:, :-1]; B[1:, :] = q[:-1, :]; C[1:, 1:] = q[:-1, :-1]
    p = np.where(C >= np.maximum(A, B), np.minimum(A, B), np.where(C <= np.minimum(A, B), np.maximum(A, B), A + B - C))
    return q - p
r8 = lambda q: (med(q.astype(np.int32)) % 256).astype(np.uint8).tobytes()
r16 = lambda q: (lambda r: (r & 255).astype(np.uint8).tobytes() + ((r >> 8) & 255).astype(np.uint8).tobytes())(med(q.astype(np.int32)) % 65536)
block = lambda a, f: a.reshape(a.shape[0] // f, f, a.shape[1] // f, f).mean((1, 3))
secs = []
def add(name, data, **kw): secs.append((name, data, kw))

# ---- heights -----------------------------------------------------------------------------------------------------
def load3():
    out = []
    for b in range(4):
        raw = open(D + f'etopo2022_60s_s3_band{b}.dods', 'rb').read(); i = raw.index(b'Data:\n') + 6
        out.append(np.frombuffer(raw[i + 8:i + 8 + 4 * 900 * 7200], dtype='>f4').reshape(900, 7200))
    return np.concatenate(out, 0)[::-1].astype(np.float32)              # rows from the north
a3 = load3()                                                              # 3600 x 7200, 3'
h6 = block(a3, 2)                                                         # 1800 x 3600, 6'
neg = h6 < 0
lab, n = ndimage.label(neg, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
# join labels across the date line
for j in range(1800):
    x, y = lab[j, 0], lab[j, -1]
    if x and y and x != y: lab[lab == y] = x
sz = np.bincount(lab.ravel()); sz[0] = 0; big = sz.argmax()
ocean = lab == big
# the Black Sea, the Mediterranean and others join the ocean already; small seas cut off at 6' (fjords, the Baltic's
# straits) are counted as ocean if they are large or touch the ocean's edge within a cell
near = ndimage.binary_dilation(ocean, iterations=2)
for k in range(1, n + 1):
    if k == big or sz[k] == 0: continue
    m = lab == k
    if (m & near).any() and sz[k] < 4000: ocean |= m
print('ocean cells', ocean.sum(), 'inland below-sea cells', (neg & ~ocean).sum())

# lakes from Natural Earth, rasterised on the 6' grid and the 3' grid
sf = shapefile.Reader(D + 'ne/ne_50m_lakes')
im6 = Image.new('I', (3600, 1800), 0); im3 = Image.new('I', (7200, 3600), 0); d6 = ImageDraw.Draw(im6); d3 = ImageDraw.Draw(im3)
names = []
for sr in sf.iterShapeRecords():
    s = sr.shape; nm = sr.record.as_dict().get('name') or ''
    if not s.points: continue
    names.append(nm); idn = len(names)
    pts = s.points; parts = list(s.parts) + [len(pts)]
    for a, b in zip(parts[:-1], parts[1:]):
        ring = pts[a:b]
        if len(ring) < 3: continue
        d6.polygon([((x + 180) * 10, (90 - y) * 10) for x, y in ring], fill=idn)
        d3.polygon([((x + 180) * 20, (90 - y) * 20) for x, y in ring], fill=idn)
L6 = np.array(im6, np.int32); L3 = np.array(im3, np.int32)
# the Caspian: Natural Earth counts it as sea; here it is the inland basin below sea level that is deepest
cas = np.zeros_like(ocean)
for k in range(1, n + 1):
    if sz[k] > 2000 and not ocean[lab == k].any():
        m = lab == k
        if h6[m].min() < -300: cas |= m & (h6 < -26)
if cas.any():
    names.append('Caspian Sea'); L6[cas] = len(names); c3 = np.kron(cas, np.ones((2, 2), bool)); L3[c3 & (a3 < -26)] = len(names)
levels = {}; keep = []
objs = ndimage.find_objects(L3)
for idn in range(1, len(names) + 1):
    m6 = L6 == idn
    if m6.sum() < 2 or idn > len(objs) or objs[idn - 1] is None: L6[m6] = 0; continue
    sj, si = objs[idn - 1]; sj = slice(max(0, sj.start - 6), sj.stop + 6); si = slice(max(0, si.start - 6), si.stop + 6)
    m3 = L3[sj, si] == idn; A = a3[sj, si]
    inside = A[m3]; ring = A[ndimage.binary_dilation(m3, iterations=2) & ~m3]
    mi, rp = np.median(inside), (np.percentile(ring, 5) if len(ring) else np.median(inside))
    lv = rp if mi < rp - 20 and np.percentile(inside, 90) - np.percentile(inside, 10) > 40 else mi                                       # sounded lakes (ETOPO has their floors): the shore; others: their surface
    if names[idn - 1] == 'Caspian Sea': lv = -28.0
    levels[idn] = lv; keep.append(idn)
# renumber
lake = np.zeros((1800, 3600), np.uint8); lvl = [0]
for i, idn in enumerate(sorted(keep, key=lambda k: -(L6 == k).sum())[:255]):
    lake[L6 == idn] = i + 1; lvl.append(levels[idn])
lake[ocean] = 0
print('lakes', len(lvl) - 1, [(names[idn - 1], round(levels[idn])) for idn in sorted(keep, key=lambda k: -(L6 == k).sum())[:14]])
# land below sea level away from the ocean (the Caspian's shores, the Dead Sea, Qattara, Death Valley, the polders) is
# lifted to between 1 and 3 m: the engine's sea fills everything below 0. Lakes below 0 are raised to 2 m with them.
lvl = np.array(lvl, np.float32)
inland = neg & ~ocean & (lake == 0)
h6l = h6.copy()
if inland.any():
    labi, ni = ndimage.label(inland)
    mn = ndimage.minimum(h6, labi, np.arange(1, ni + 1)); mn = np.concatenate([[0], mn])
    lo = mn[labi]; h6l[inland] = 1 + 2 * (h6[inland] - lo[inland]) / np.maximum(-lo[inland], 1)
lvl = np.where(lvl < 2, 2, lvl)
q = np.where(h6l > 0, np.maximum(1, np.round(np.sqrt(np.maximum(h6l, 0)) * 2.3)), 1).astype(np.int32)
q[ocean] = -1; q[lake > 0] = 0
add('land', r8(q), w=3600, h=1800)
# the sea floor at 24'
sea = np.where(ocean, h6, np.nan); s24 = np.nanmean(sea.reshape(450, 4, 900, 4), (1, 3)) if False else None
with np.errstate(all='ignore'): s24 = np.nanmean(sea.reshape(450, 4, 900, 4).transpose(0, 2, 1, 3).reshape(450, 900, 16), 2)
miss = np.isnan(s24); idx = ndimage.distance_transform_edt(miss, return_distances=False, return_indices=True); s24 = s24[tuple(idx)]
qs = np.clip(np.round(np.sqrt(np.maximum(-s24, 0)) * 0.45), 1, 60).astype(np.int32)
add('sea', r8(qs), w=900, h=450)
add('lake', lake.tobytes(), w=3600, h=1800)
add('lakes', np.round(lvl).astype('<i2').tobytes(), n=len(lvl))

# ---- climate -------------------------------------------------------------------------------------------------------
def load(v, k):
    a = np.loadtxt(gzip.open(D + f'cru_cl2_grid_10min_{v}.dat.gz', 'rt')); return a[:, 0], a[:, 1], a[:, 2:2 + k]
la, lo, T = load('tmp', 12); la2, lo2, P = load('pre', 12); la3, lo3, E = load('elv', 1)
key = lambda a, b: np.round(a * 1000).astype(np.int64) * 1000000 + np.round(b * 1000).astype(np.int64)
k1, k2, k3 = key(la, lo), key(la2, lo2), key(la3, lo3); kc = np.intersect1d(np.intersect1d(k1, k2), k3)
pick = lambda k, X: X[np.argsort(k)][np.searchsorted(np.sort(k), kc)]
T, P, E, la, lo = pick(k1, T), pick(k2, P), pick(k3, E)[:, 0], pick(k1, la), pick(k1, lo)
T0 = T.mean(1) + 6.5 * E; Am = (T[:, 6] - T[:, 0]) / 2; Py = P.sum(1)
j = np.clip(((90 - la) * 2).astype(int), 0, 359); i = np.clip(((lo + 180) * 2).astype(int), 0, 719)
def grid(x):
    S = np.zeros(360 * 720); N = np.zeros(360 * 720); np.add.at(S, j * 720 + i, x); np.add.at(N, j * 720 + i, 1)
    with np.errstate(all='ignore'): return (S / N).reshape(360, 720), (N > 0).reshape(360, 720)
gT, mk = grid(T0); gA, _ = grid(Am); gP, _ = grid(Py)
dist, idx = ndimage.distance_transform_edt(~mk, return_indices=True)
lat = 90 - (np.arange(360) + 0.5) / 2; sl2 = np.sin(np.radians(lat))[:, None] ** 2
zT = 28 - 45 * sl2 + 0 * dist; zA = np.sign(lat)[:, None] * 6 * sl2 + 0 * dist; zP = 900 + 0 * dist
w = np.clip((dist - 4) / 26, 0, 1); w = w * w * (3 - 2 * w)
fill = lambda g, z: np.where(mk, g, g[tuple(idx)] * (1 - w) + z * w)
gT, gA, gP = fill(gT, zT), fill(gA, zA), fill(gP, zP)
qT = np.clip(np.round(gT * 2) + 128, 0, 255); qA = np.clip(np.round(gA * 2) + 128, 0, 255); qP = np.clip(np.round(np.sqrt(np.maximum(gP, 0)) * 2.5), 0, 255)
add('clim', r8(qT) + r8(qA) + r8(qP), w=720, h=360)

# ---- tree genera ---------------------------------------------------------------------------------------------------
gen0 = np.load(D + 'genera_15min_9_overlap.npy'); m0 = np.zeros(1440 * 720, bool); i = 0
for c, nn in re.findall(r'([A-Za-e.])(\d*)', re.search(r"export const KG = '([^']*)'", open('src/kg.js').read()).group(1)): nn = int(nn or 1); m0[i:i + nn] = c != '.'; i += nn
bits = (gen0.astype(np.uint16) << np.arange(9, dtype=np.uint16)).sum(1).astype(np.uint16)
g = np.zeros(1440 * 720, np.uint16); g[m0] = bits; g = g.reshape(720, 1440)
add('gen', (g & 255).astype(np.uint8).tobytes() + (g >> 8).astype(np.uint8).tobytes(), w=1440, h=720)

# ---- the rocky bodies ------------------------------------------------------------------------------------------------
for nm, roll, f, st in [('moon', True, 2, 50), ('mars', True, 2, 50), ('venus', False, 4, 40), ('mercury', True, 4, 40)]:   # the Moon and Mars every half degree, the others every degree
    a = np.load(D + f'{nm}_025.npy')
    if (a < -30000).any(): m = a < -30000; ix = ndimage.distance_transform_edt(m, return_distances=False, return_indices=True); a = a[tuple(ix)]
    if roll: a = np.roll(a, 720, axis=1)                                   # from 0E to 180W at the left
    b = block(a, f); off = float(np.ceil((-b.min() + 150) / 100) * 100)
    add(nm, r16(np.round((b + off) / st)), w=b.shape[1], h=b.shape[0], base=off, step=st)
    print(nm, 'min', b.min(), 'max', b.max(), 'offset', off)

# ---- out -------------------------------------------------------------------------------------------------------------
hdr, body, o = [], b'', 0
for nm, data, kw in secs: hdr.append(dict(name=nm, off=o, len=len(data), **kw)); body += data; o += len(data)
H = json.dumps(hdr, separators=(',', ':')).encode()
raw = len(H).to_bytes(4, 'little') + H + body
if '--sizes' in sys.argv:
    for nm, data, kw in secs: print(f'{nm:8s} {len(data):9d} raw {len(zlib.compress(data, 9)):8d} deflated')
try:
    import zopfli.zlib as zz; inner = zz.compress(raw, numiterations=int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8)[2:-4]
except ImportError:
    co = zlib.compressobj(9, zlib.DEFLATED, -15); inner = co.compress(raw) + co.flush()
open('cont/earthdata.js', 'w').write('// the measured maps: see tools/earthpack.py for what they are, DATA.md for where they come from\nexport const EARTH = \'' + base64.b64encode(inner).decode() + '\';\n')
print(len(raw), 'raw ->', len(inner), 'deflated')
