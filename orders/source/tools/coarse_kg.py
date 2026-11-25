# python3 tools/coarse_kg.py <f> <out> : the Köppen-Geiger grid of src/kg.js seen through f x f blocks of its quarter-degree
# cells, for the 200 kB rung: each block takes the commonest class among its cells (sea where most of it is sea). The
# grid keeps its size and coding, so the page reads it the same way.
import re, sys, numpy as np
f, out = int(sys.argv[1]), sys.argv[2]
src = open('src/kg.js').read(); KG = re.search(r"export const KG = '([^']*)'", src).group(1)
codes = '.' + ''.join(chr(65 + i) for i in range(26)) + 'abcde'
g = np.zeros(1440 * 720, np.int16); i = 0
for c, n in re.findall(r'([A-Za-e.])(\d*)', KG): n = int(n or 1); g[i:i + n] = codes.index(c); i += n
g = g.reshape(720, 1440); B = g.reshape(720 // f, f, 1440 // f, f).transpose(0, 2, 1, 3).reshape(720 // f, 1440 // f, f * f)
C = np.apply_along_axis(lambda v: np.bincount(v, minlength=len(codes)), 2, B)
sea = C[..., 0] * 2 > f * f; C[..., 0] = -1; M = np.where(sea, 0, C.argmax(2))
G = np.repeat(np.repeat(M, f, 0), f, 1)
def row(R):                                                                     # runs within a row, rows split by commas, as kg.js has them
    o, s = [], 0
    for k in range(1, len(R) + 1):
        if k == len(R) or R[k] != R[s]: n = k - s; o.append(codes[R[s]] + (str(n) if n > 1 else '')); s = k
    return ''.join(o)
runs = [','.join(row(R) for R in G)]
head = src[:src.index('export const KG')]
open(out, 'w').write(head.replace('// Köppen-Geiger climate classes on a quarter-degree grid', f'// Köppen-Geiger climate classes in {f / 4:g}-degree blocks (200 kB rung) on a quarter-degree grid') + "export const KG = '" + ''.join(runs) + "';\n" + src[src.index("';", src.index('export const KG')) + 3:])
print(out, len(''.join(runs)), 'chars, was', len(KG))
