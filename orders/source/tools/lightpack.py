# python3 tools/lightpack.py : packs the Earth's lights at night into cont/lightdata.js. Input: NASA Earth Observatory's
# Black Marble 2016 colour composite at 3 km (Suomi NPP VIIRS day/night band; public domain), tmp/data/new/bm3km.jpg.
# The lights are what is warmer than the moonlit blue ground (R - 0.55 B, less a floor), taken back to linear light,
# averaged over sixth-of-a-degree cells (2160 x 1080, from 90N and 180W), and stored as 16 levels of its cube root.
import numpy as np, zlib, base64
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
a = np.asarray(Image.open('tmp/data/new/bm3km.jpg')).astype(np.float32)
lin = np.clip(np.clip(a[..., 0] - 0.55 * a[..., 2] - 8, 0, None) / (255 * .45), 0, 1) ** 2.2
m = np.asarray(Image.fromarray(lin).resize((2160, 1080), Image.BOX))
v = np.clip(m, 0, 1) ** (1 / 3); q = np.round(v * 15).astype(np.uint8); q[v < 1.2 / 16] = 0
c = zlib.compressobj(9, zlib.DEFLATED, -15); z = c.compress(q.tobytes()) + c.flush()
open('cont/lightdata.js', 'w').write("// the Earth's lights at night: see tools/lightpack.py for what they are, DATA.md for where they come from\nexport const LIGHTS = '" + base64.b64encode(z).decode() + "';\n")
print(len(z), 'deflated;', (q > 0).mean())
