# python3 tools/pack_data.py : packs the measured grids the 2 MB rung carries into src/data.js (one base64 string of
# raw deflate, inflated in the page by the browser's own DecompressionStream). Inputs, downloaded once into tmp/data/:
#   Tree genera: Little's range maps (USGS 1971-78, public domain, digitised at github.com/wpetry/ustreeatlas) and
#     Caudullo et al. 2017 chorological maps (CC BY 4.0), rasterised by Rowan's tmp/rowan_scripts/genera.py to
#     tmp/data/genera_15min_9_overlap.npy: a genus counts in a cell where any of its species' native range touches it
#   ETOPO 2022 60-arc-second surface elevation (NOAA NCEI, doi:10.25921/fd45-gt74; US government work), read over
#     OPeNDAP every 3 arc-minutes from .../ETOPO2022/60s/60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc
#   CRU CL 2.0 10-arc-minute monthly normals 1961-90 (New et al. 2002, Climatic Research Unit, University of East
#     Anglia; ODbL 1.0 with DbCL): tmp, pre, reh, dtr, rd0 (wet days), sunp (sunshine), wnd (wind) and elv, from https://crudata.uea.ac.uk/cru/data/hrg/tmc/
# Layout of the inflated bytes:
#   1. CRU land mask, 720 x 360 half-degree cells from 90N and 180W, one bit each, high bit first (32,400 bytes)
#   2. 24 planes over CRU land cells in row order: Jan-Dec temperature reduced to sea level at 6.5 C/km (half degrees
#      from -60 C), then Jan-Dec rainfall (a log byte up to 2,500 mm), then Jan-Dec dew-point depression (the mean
#      temperature less the dew point from CRU's relative humidity by the Magnus formula, whole degrees), then
#      Jan-Dec diurnal temperature range (whole degrees), then Jan-Dec wet days (days with 0.1 mm or more, whole
#      days), then Jan-Dec sunshine (per cent of daylight, in steps of 5; 255 where CRU has none), then Jan-Dec wind
#      speed at 10 m (half metres a second; 255 where CRU has none); each value stored as the change from the month before, and
#      each plane as the change from the cell before, all mod 256; then CRU's own height for each cell (a square-root
#      byte from -500 to 7,000 m, as the change from the cell before), the height its temperatures belong to
#   4. nine planes over the Köppen land cells, one byte each: whether Quercus, Fagus, Picea, Pinus, Betula, Abies,
#      Larix, Acer, Tilia are mapped there (after the heights)
#   3. three planes over the Köppen grid's land cells (kg.js, quarter degrees, row order): the mean height of the land
#      in each cell, its lowest point, then its highest, each as a square-root byte from -500 to 7,000 m, stored as the change from the
#      cell to the west (sea counted as 0)
import re, sys, gzip, base64, numpy as np, zopfli.zlib as zz
D = 'tmp/data/'
# python3 tools/pack_data.py [out kg fc fe]: the 200 kB rung carries the same grids seen through bigger cells, each
# stored once: the climate as the mean over blocks of fc x fc half-degree cells, the three heights as the mean over
# blocks of fe x fe quarter-degree cells of each cell's mean, floor and top (so a valley is as deep as it is locally,
# not as deep as the whole block), and a genus counting in a block if it counts in any cell of it. The layout is the
# one below with blocks for cells: the land mask is of blocks, and the planes run over land blocks in row order.
OUT, KGF, FC, FE = (sys.argv[1:] + ['src/data.js', 'src/kg.js', '1', '1'][len(sys.argv) - 1:])[:4]; FC, FE = int(FC), int(FE)
# the Köppen land mask, decoded exactly as kg.js does
KG = re.search(r"export const KG = '([^']*)'", open(KGF).read()).group(1)
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
    Hm = np.nanmean(L, axis=2); Hn = np.nanmin(L, axis=2); Hx = np.nanmax(L, axis=2)
Hm = np.where(np.isnan(Hm), B.mean(axis=2), Hm); Hn = np.where(np.isnan(Hn), B.min(axis=2), Hn); Hx = np.where(np.isnan(Hx), B.max(axis=2), Hx)
def plane(H):
    q = np.round(255 * np.sqrt((np.clip(H, -500, 7000) + 500) / 7500)).astype(np.int32); q[~m] = 0
    P = np.zeros_like(q); P[:, 1:] = q[:, :-1]; return ((q - P)[m] & 255).astype(np.uint8).tobytes(), q
m1 = m
if FE > 1:                                                                      # land blocks: any land in them; values the mean over their land
    sh = lambda X: X.reshape(720 // FE, FE, 1440 // FE, FE).transpose(0, 2, 1, 3).reshape(720 // FE, 1440 // FE, FE * FE)
    with np.errstate(all='ignore'): Hm, Hn, Hx = (np.nanmean(sh(np.where(m, H, np.nan)), axis=2) for H in (Hm, Hn, Hx))
    m = sh(m).any(axis=2)
em, qm = plane(Hm); en, qn = plane(Hn); ex, qx = plane(Hx)
# climate
def load(v, n):
    a = np.loadtxt(gzip.open(D + f'cru_cl2_grid_10min_{v}.dat.gz', 'rt')); return a[:, 0], a[:, 1], a[:, 2:2 + n]
la, lo, T = load('tmp', 12); la2, lo2, P = load('pre', 12); la3, lo3, E = load('elv', 1); la4, lo4, RH = load('reh', 12); la5, lo5, DT = load('dtr', 12)
key = lambda a, b: np.round(a * 1000).astype(np.int64) * 1000000 + np.round(b * 1000).astype(np.int64)
k1, k2, k3 = key(la, lo), key(la2, lo2), key(la3, lo3); kc = np.intersect1d(np.intersect1d(k1, k2), k3)
pick = lambda k, X: X[np.argsort(k)][np.searchsorted(np.sort(k), kc)]
T, P, E, la, lo = pick(k1, T), pick(k2, P), pick(k3, E)[:, 0], pick(k1, la), pick(k1, lo); RH, DT = pick(key(la4, lo4), RH), pick(key(la5, lo5), DT)
def pickn(v):                                                                    # wet days and sunshine: not every cell has them
    a, b, X = load(v, 12); k = key(a, b); o = np.argsort(k); s = k[o]; ix = np.clip(np.searchsorted(s, kc), 0, len(s) - 1); ok = s[ix] == kc
    X = X[o][ix].astype(float); X[~ok] = np.nan; return X
WD, SU, WN = pickn('rd0'), pickn('sunp'), pickn('wnd')
es = lambda t: 6.1094 * np.exp(17.625 * t / (t + 243.04)); lv = np.log(np.maximum(RH, 1) / 100 * es(T) / 6.1094); Dd = T - 243.04 * lv / (17.625 - lv)   # dew-point depression
j = ((90 - la) * 2).astype(int); i = ((lo + 180) * 2).astype(int); u, inv, cnt = np.unique(j * 720 + i, return_inverse=True, return_counts=True)
agg = lambda X: (lambda S: (np.add.at(S, inv, X), S / cnt.reshape((-1,) + (1,) * (X.ndim - 1)))[1])(np.zeros((len(u),) + X.shape[1:]))
if FC > 1:                                                                      # gather the half-degree land cells into blocks
    bj, bi = (u // 720) // FC, (u % 720) // FC; bu, binv = np.unique(bj * 10000 + bi, return_inverse=True)
    def bl(X):
        S = np.zeros((len(bu),) + X.shape[1:]); N = np.zeros_like(S); W = ~np.isnan(X); np.add.at(S, binv, np.nan_to_num(X)); np.add.at(N, binv, W)
        with np.errstate(all='ignore'): return np.where(N > 0, S / np.maximum(N, 1e-9), np.nan)
    agg0 = agg
    agg = lambda X: bl(agg0(X))
Ts = agg(T + 6.5 * E[:, None]); Pm = agg(P)                                     # CRU's elevations are in km
qT = np.clip(np.round((Ts + 60) * 2), 0, 255).astype(np.int64); qP = np.clip(np.round(np.log1p(Pm) / np.log1p(2500) * 255), 0, 255).astype(np.int64)
mk = np.zeros(720 * 360, np.uint8); mk[u] = 1
if FC > 1: mk = np.zeros((360 // FC) * (720 // FC), np.uint8); mk[(bu // 10000) * (720 // FC) + bu % 10000] = 1
dm = lambda Q: np.diff(np.concatenate([np.zeros((len(Q), 1), np.int64), Q], 1), axis=1) % 256
dc = lambda x: (np.diff(np.concatenate([[0], x])) % 256).astype(np.uint8).tobytes()
def aggn(X):
    W = (~np.isnan(X)).astype(float); S = np.zeros((len(u),) + X.shape[1:]); N = np.zeros_like(S); np.add.at(S, inv, np.nan_to_num(X)); np.add.at(N, inv, W)
    with np.errstate(all='ignore'): R = np.where(N > 0, S / np.maximum(N, 1e-9), np.nan)
    return bl(R) if FC > 1 else R
qW = np.nan_to_num(np.clip(np.round(aggn(WD)), 0, 31), nan=255).astype(np.int64); qS = np.nan_to_num(np.clip(np.round(aggn(SU) / 5), 0, 20), nan=255).astype(np.int64)
qN = np.nan_to_num(np.clip(np.round(aggn(WN) * 2), 0, 60), nan=255).astype(np.int64)
qE = np.round(255 * np.sqrt((np.clip(agg(E) * 1000, -500, 7000) + 500) / 7500)).astype(np.int64)
qD = np.clip(np.round(agg(Dd)), 0, 255).astype(np.int64); qR = np.clip(np.round(agg(DT)), 0, 255).astype(np.int64)
cru = b''.join(dc(dm(Q)[:, k]) for Q in (qT, qP, qD, qR, qW, qS, qN) for k in range(12)) + dc(qE)
gen0 = np.load(D + 'genera_15min_9_overlap.npy'); m0 = np.zeros(1440 * 720, bool); i = 0      # the genera were rasterised on the fine grid's land
for c, n in re.findall(r'([A-Za-e.])(\d*)', re.search(r"export const KG = '([^']*)'", open('src/kg.js').read()).group(1)): n = int(n or 1); m0[i:i + n] = c != '.'; i += n
G = np.zeros((720, 1440, 9), np.uint8); G[m0.reshape(720, 1440)] = gen0
if FE > 1: G = G.reshape(720 // FE, FE, 1440 // FE, FE, 9).max(axis=(1, 3))
gen = G[m]
raw = np.packbits(mk).tobytes() + cru + em + en + ex + b''.join(gen[:, k].astype(np.uint8).tobytes() for k in range(9))
import os, zlib
if os.environ.get('SIZES'):
    for nm, x in [('mask', np.packbits(mk).tobytes()), ('cru', cru), ('heights', em + en + ex), ('genera', b''.join(gen[:, k].astype(np.uint8).tobytes() for k in range(9)))]: print(nm, len(x), len(zlib.compress(x, 9)))
    for k, nm in enumerate('T P D R W S N'.split()): print(' ', nm, len(zlib.compress(cru[k * 12 * int(mk.sum()):(k + 1) * 12 * int(mk.sum())], 9)))
    sys.exit()
inner = zz.compress(raw, numiterations=15)[2:-4]
open(OUT, 'w').write(f'// measured grids for the {"2 MB" if FC == 1 else "200 kB"} rung: see tools/pack_data.py for what they are and where they come from\nexport const DATA = \'' + base64.b64encode(inner).decode() + '\';\n')
print(f'CRU land cells {int(mk.sum())}, Köppen land cells {int(m.sum())}; {len(raw)} bytes raw -> {len(inner)} deflated -> {len(inner) * 4 // 3} base64')
for nm, (a, b) in {'Innsbruck': (47.27, 11.39), 'Quito': (-0.18, -78.47), 'Tromso': (69.65, 18.96)}.items():
    jj, ii = int((90 - a) * 4) // FE, int((b + 180) * 4) // FE; print(nm, 'mean', round(Hm[jj, ii]), 'floor', round(Hn[jj, ii]), 'q', qm[jj, ii], qn[jj, ii])
