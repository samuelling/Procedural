# python3 tools/patchpack.py : the fine ground round each Go-to place on the Earth, into cont/patchdata.js. For each
# place, the middle 96 x 96 cells of the 128 x 128 of ETOPO 2022 15" fetched (tools/patchfetch.py) less the page's own 6' ground there (so the patch is
# only what the coarse map misses), tapered to nothing over its outer 10 cells, in 5 m steps; stored as the residuals
# of the median edge predictor, low and high bytes as planes, after a JSON header of where each patch lies.
import json, math, subprocess, zlib, base64, numpy as np, scipy.io as sio
P = json.loads(subprocess.run(['node', '-e', "const s=require('fs').readFileSync('cont/main.js','utf8'), m=s.match(/const PLACES = (\\[[\\s\\S]*?\\]\\]);/); console.log(JSON.stringify(eval(m[1]).filter((p) => p[1] === 100)))"], capture_output=True, text=True, check=True).stdout); N = 96; C0 = 16   # the Go-to places on the Earth (main.js)
def med(q):
    A = np.zeros_like(q); B = np.zeros_like(q); C = np.zeros_like(q); A[:, 1:] = q[:, :-1]; B[1:, :] = q[:-1, :]; C[1:, 1:] = q[:-1, :-1]
    p = np.where(C >= np.maximum(A, B), np.minimum(A, B), np.where(C <= np.minimum(A, B), np.maximum(A, B), A + B - C)); return q - p
t = np.arange(N); s = lambda e0, e1, x: np.clip((x - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((x - e0) / (e1 - e0), 0, 1))
win1 = s(0, 10, t) * s(N - 1, N - 11, t); win = np.outer(win1, win1)
hdr, planes, pts, grids = [], [], [], []
for i in range(len(P)):
    f = sio.netcdf_file(f'tmp/data/new/etopo15/{i}.nc', 'r', mmap=False); la = f.variables['latitude'][:].copy(); lo = f.variables['longitude'][:].copy(); z = f.variables['z'][:].astype(np.float64)
    if la[0] < la[-1]: la = la[::-1]; z = z[::-1]
    assert z.shape == (128, 128), z.shape
    la, lo, z = la[C0:C0 + N], lo[C0:C0 + N], z[C0:C0 + N, C0:C0 + N]
    grids.append((la, lo, z)); pts += [[float(a), float(b)] for a in la for b in lo]
json.dump(pts, open('/tmp/pp.json', 'w')); subprocess.run(['node', 'tools/patchbase.mjs', '/tmp/pp.json', '/tmp/pp.bin'], check=True)
base = np.fromfile('/tmp/pp.bin', np.float64).reshape(len(P), N, N)
lo8, hi8 = [], []
for i, (la, lo, z) in enumerate(grids):
    zl = np.where(z < 0, np.maximum(z, base[i]), z)                          # (under the sea the coarse map stands: only the land is sharpened)
    r = (zl - base[i]) * win; q = np.round(r / 5).astype(np.int64)
    hdr.append([round(float(la[0]), 7), round(float(lo[0]), 7)]); m = med(q) % 65536
    lo8.append((m & 255).astype(np.uint8).tobytes()); hi8.append((m >> 8).astype(np.uint8).tobytes())
    print(i, P[i][0], 'resid rms %.0f m, max %.0f m' % (np.sqrt((r ** 2).mean()), np.abs(r).max()))
H = json.dumps({'n': len(P), 'N': N, 'd': 15 / 3600, 'step': 5, 'o': hdr}).encode()
raw = len(H).to_bytes(4, 'little') + H + b''.join(lo8) + b''.join(hi8)
c = zlib.compressobj(9, zlib.DEFLATED, -15); zz = c.compress(raw) + c.flush()
open('cont/patchdata.js', 'w').write("// the fine ground round the Go-to places: see tools/patchpack.py for what it is, DATA.md for where it comes from\nexport const PATCHES = '" + base64.b64encode(zz).decode() + "';\n")
print(len(raw), 'raw ->', len(zz), 'deflated')
