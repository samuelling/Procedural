# python3 tools/pack.py in.js out.html [limit] : wraps a script as a page that fetches itself, inflates everything after the
# bootstrap, and runs it. The whole file (bootstrap + deflate stream) is what counts against the allowance.
import sys, zlib
src = open(sys.argv[1], 'rb').read()
try:
    import zopfli.zlib as zz
    raw = zz.compress(src, numiterations=int(__import__("os").environ.get("PACKIT", 60)))[2:-4]          # strip the zlib header and checksum: raw deflate
except Exception:
    co = zlib.compressobj(9, zlib.DEFLATED, -15); raw = co.compress(src) + co.flush()
assert zlib.decompress(raw, -15) == src
boot = lambda n: ('<body hidden onload="fetch``.then(r=>r.blob()).then(b=>new Response(b.slice(%d).stream().pipeThrough(new DecompressionStream(\'deflate-raw\'))).text()).then(eval)">' % n).encode()
n = len(boot(0)); n = len(boot(n)); n = len(boot(n))
out = boot(n) + raw
open(sys.argv[2], 'wb').write(out)
lim = int(sys.argv[3]) if len(sys.argv) > 3 else 0
print(f"{sys.argv[2]}: {len(src)} B of script -> {len(out)} B on disk" + (f" (allowance {lim}, {lim - len(out)} to spare)" if lim else ""))
if lim and len(out) > lim: sys.exit(1)
