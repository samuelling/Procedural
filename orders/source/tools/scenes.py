# python3 tools/scenes.py [tag ...] : screenshots the 2 MB world in set scenes for the index's "Everything in it" pictures
# (headless Chrome, software WebGL). Each scene is steps of (js, seconds to wait); the shot lands in /tmp/sc_<tag>.png.
import sys, time, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HELP = """
window.T = (h, lo, ds = 0) => { let f = ((h - lo / 15) / 24 - .5) % 1;   // J2000 days start at noon UTC
  if (f < 0) f += 1; sylva.setRealT(Math.floor(sylva.realT()) + ds + f); };
window.go = (name) => sylva.goPlace(sylva.PLACES.findIndex((p) => p[0].startsWith(name)));
window.clean = (...keep) => { for (const e of document.body.children) if (e.id !== 'c' && !keep.includes(e.id)) e.style.visibility = 'hidden'; };
window.ll = (la, lo) => { la *= Math.PI / 180; lo *= Math.PI / 180; const R = sylva.G().R; return [Math.cos(la) * Math.cos(lo) * R, Math.cos(la) * Math.sin(lo) * R, Math.sin(la) * R]; };
window.zoom = async (f, n, ms) => { const c = document.getElementById('c'); for (let i = 0; i < n; i++) { sylva.zoomAt(c.clientWidth / 2, c.clientHeight / 2, f); await new Promise((r) => setTimeout(r, ms)); } };
"""
SC = {
 'earth':   [("T(8.5, 86.85); go('Himalaya'); clean()", 14), ("sylva.setMode('fly'); sylva.moveLocal([0, 9000, 0]); sylva.cam.pitch = -0.28", 14)],
 'climate': [("T(12, 34.8); go('The Serengeti'); clean()", 12), ("sylva.setMode('fly'); sylva.moveLocal([0, 9e6, 0]); sylva.cam.pitch = -1.5", 14)],
 'trees':   [("T(10, -83.45); go('Great Smoky'); clean()", 14), ("sylva.cam.pitch = 0.02", 10)],
 'sky':     [("T(23, 11.3); go('Tuscany'); clean()", 12), ("sylva.setMode('fly'); sylva.moveLocal([0, 2.5e6, 0]); sylva.cam.pitch = -1.25", 14)],
 'moon':    [("go('The Moon, Tycho'); clean()", 14), ("sylva.setMode('fly'); sylva.moveLocal([0, 12000, 0]); sylva.cam.pitch = -0.4", 14)],
 'wormhole':[("go('The wormhole'); clean()", 16)],
 'quarks':  [("T(11, 8.2); go('The Black Forest'); clean()", 14), ("sylva.cam.pitch = -1.3", 4), ("zoom(0.4, 30, 500)", 22)],
 'cosmos':  [("T(12, 11.3); go('Tuscany'); clean()", 12), ("sylva.setMode('fly'); sylva.cam.pitch = -1.45", 3), ("zoom(5, 40, 450)", 30)],
 'deeptime':[("T(10, -83.45); go('Great Smoky'); clean()", 12), ("sylva.setAge(310)", 16)],
 'animals': [("T(8, 34.8); go('The Serengeti'); clean()", 22), ("sylva.setMode('fly'); sylva.moveLocal([0, 6, 0]); sylva.cam.pitch = -0.06", 16)],
 'census':  [("T(11, -83.45); go('Great Smoky'); clean()", 14), ("sylva.cam.pitch = -0.75", 10)],
 'under':   [("T(9, -111.1); go('Sonoran'); clean()", 14), ("sylva.cam.pitch = -0.08", 8)],
 'towns':   [("T(13, -74); sylva.arrive(100, ll(40.76, -73.98)); clean()", 14), ("sylva.setMode('fly'); sylva.moveLocal([0, 350, 0]); sylva.cam.pitch = -0.25", 14)],
 'nav':     [("T(11, 8.04); go('The Alps'); clean('hud', 'compass', 'map', 'mapb')", 14), ("sylva.nav.toggle(true)", 8)],
 'plants':  [("T(10, 8.2); go('The Black Forest'); clean()", 14), ("sylva.cam.pitch = 0.12", 8)],
 'water':   [("T(12, 105.5); go('Siberian taiga'); clean()", 14), ("sylva.setMode('fly'); sylva.moveLocal([0, 900, 0]); sylva.cam.pitch = -0.3", 14)],
 'weather': [("T(10, -73.4, 95); go('Boreal forest'); clean()", 16), ("sylva.cam.pitch = 0", 8)],
 'aurora':  [("T(23, -40); go('Greenland'); clean()", 14), ("sylva.cam.pitch = 0.6", 10)],
 'sound':   [("T(6.6, -60.1); go('Amazon'); clean()", 14), ("sylva.cam.pitch = 0.05", 10)],
}
socketserver.TCPServer.allow_reuse_address = True
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Q, directory=root)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
tags = sys.argv[1:] or list(SC)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-watchdog"])
    for tag in tags:
        pg = b.new_page(viewport={"width": 640, "height": 400}); errs = []; pg.set_default_timeout(300000)
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.goto(f"http://127.0.0.1:{port}/cont/out/index.html"); time.sleep(6); pg.evaluate(HELP)
        for js, w in SC[tag]: pg.evaluate(js); time.sleep(w)
        pg.screenshot(path=f"/tmp/sc_{tag}.png"); print(tag, errs[:3], flush=True); pg.close()
    b.close()
srv.shutdown()
