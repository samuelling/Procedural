# python3 tools/pack_data.py : packs the measured grids the 2 MB rung carries into src/data.js (one base64 string of
# raw deflate, inflated in the page by the browser's own DecompressionStream). Inputs, downloaded once into tmp/data/:
#   ETOPO 2022 60-arc-second surface elevation (NOAA NCEI, doi:10.25921/fd45-gt74; US government work), read over
#     OPeNDAP every 3 arc-minutes from .../ETOPO2022/60s/60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc
#   CRU CL 2.0 10-arc-minute monthly normals 1961-90 (New et al. 2002, Climatic Research Unit, University of East
#     Anglia; ODbL 1.0 with DbCL): tmp, pre and elv, from https://crudata.uea.ac.uk/cru/data/hrg/tmc/
# Layout of the inflated bytes:
#   1. CRU land mask, 720 x 360 half-degree cells from 90N and 180W, one bit each, high bit first (32,400 bytes)
#   2. 24 planes over CRU land cells in row order: Jan-Dec temperature reduced to sea level at 6.5 C/km (half degrees
#      from -60 C), then Jan-Dec rainfall (a log byte up to 2,500 mm); each value stored as the change from the month
#      before, and each plane as the change from the cell before, all mod 256
#   3. two planes over the Köppen grid's land cells (kg.js, quarter degrees, row order): the mean height of the land in
#      each cell, then its lowest point, each as a square-root byte from -500 to 7,000 m, stored as the change from the
#      cell to the west (sea counted as 0)
import re, gzip, base64, numpy as np, zopfli.zlib as zz
D = 'tmp/data/'
# the Köppen land mask, decoded exactly as kg.js does
KG = re.search(r"export const KG = '([^']*)'", open('src/kg.js').read()).group(1)
m = np.zeros(1440 * 720, bool); i = 0
for c, n in re.findall(r'([A-Za-e.])(\d*)', KG):
    n = int(n or 1); m[i:i + n] = c != '.'; i += n
m = m.reshape(720, 1440)
# elevation: 3-arc-minute samples, 25 to a quarter-degree cell; the mean of those on land, and the lowest
def band(k):
    b = open(D + f'etopo2022_60s_s3_band{k}.dods', 'rb').read(); i = b.index(b'Data:\n') + 6
    n = np.frombuffer(b[i:i + 4], '>u4')[0]; return np.frombuffer(b[i + 8:i + 8 + 4 * n], '>f4').reshape(900, 7200)
Z = np.vstack([band(k) for k in range(4)])[::-1].astype(np.float64)
B = Z.reshape(720, 5, 1440, 5).transpose(0, 2, 1, 3).reshape(720, 1440, 25)
L = np.where(B > 0, B, np.nan)
with np.errstate(all='ignore'):
    Hm = np.nanmean(L, axis=2); Hn = np.nanmin(L, axis=2)
Hm = np.where(np.isnan(Hm), B.mean(axis=2), Hm); Hn = np.where(np.isnan(Hn), B.min(axis=2), Hn)
def plane(H):
    q = np.round(255 * np.sqrt((np.clip(H, -500, 7000) + 500) / 7500)).astype(np.int32); q[~m] = 0
    P = np.zeros_like(q); P[:, 1:] = q[:, :-1]; return ((q - P)[m] & 255).astype(np.uint8).tobytes(), q
em, qm = plane(Hm); en, qn = plane(Hn)
# climate
def load(v, n):
    a = np.loadtxt(gzip.open(D + f'cru_cl2_grid_10min_{v}.dat.gz', 'rt')); return a[:, 0], a[:, 1], a[:, 2:2 + n]
la, lo, T = load('tmp', 12); la2, lo2, P = load('pre', 12); la3, lo3, E = load('elv', 1)
key = lambda a, b: np.round(a * 1000).astype(np.int64) * 1000000 + np.round(b * 1000).astype(np.int64)
k1, k2, k3 = key(la, lo), key(la2, lo2), key(la3, lo3); kc = np.intersect1d(np.intersect1d(k1, k2), k3)
pick = lambda k, X: X[np.argsort(k)][np.searchsorted(np.sort(k), kc)]
T, P, E, la, lo = pick(k1, T), pick(k2, P), pick(k3, E)[:, 0], pick(k1, la), pick(k1, lo)
j = ((90 - la) * 2).astype(int); i = ((lo + 180) * 2).astype(int); u, inv, cnt = np.unique(j * 720 + i, return_inverse=True, return_counts=True)
agg = lambda X: (lambda S: (np.add.at(S, inv, X), S / cnt.reshape((-1,) + (1,) * (X.ndim - 1)))[1])(np.zeros((len(u),) + X.shape[1:]))
Ts = agg(T + 6.5 * E[:, None]); Pm = agg(P)                                     # CRU's elevations are in km
qT = np.clip(np.round((Ts + 60) * 2), 0, 255).astype(np.int64); qP = np.clip(np.round(np.log1p(Pm) / np.log1p(2500) * 255), 0, 255).astype(np.int64)
mk = np.zeros(720 * 360, np.uint8); mk[u] = 1
dm = lambda Q: np.diff(np.concatenate([np.zeros((len(Q), 1), np.int64), Q], 1), axis=1) % 256
dc = lambda x: (np.diff(np.concatenate([[0], x])) % 256).astype(np.uint8).tobytes()
cru = b''.join(dc(dm(qT)[:, k]) for k in range(12)) + b''.join(dc(dm(qP)[:, k]) for k in range(12))
raw = np.packbits(mk).tobytes() + cru + em + en
inner = zz.compress(raw, numiterations=15)[2:-4]
open('src/data.js', 'w').write('// measured grids for the 2 MB rung: see tools/pack_data.py for what they are and where they come from\nexport const DATA = \'' + base64.b64encode(inner).decode() + '\';\n')
print(f'CRU land cells {len(u)}, Köppen land cells {int(m.sum())}; {len(raw)} bytes raw -> {len(inner)} deflated -> {len(inner) * 4 // 3} base64')
for nm, (a, b) in {'Innsbruck': (47.27, 11.39), 'Quito': (-0.18, -78.47), 'Tromso': (69.65, 18.96)}.items():
    jj, ii = int((90 - a) * 4), int((b + 180) * 4); print(nm, 'mean', round(Hm[jj, ii]), 'floor', round(Hn[jj, ii]), 'q', qm[jj, ii], qn[jj, ii])
