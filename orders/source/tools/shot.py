# python3 tools/shot.py <path under orders/> <out.png> [W H wait] : serves this folder over http and screenshots a page in headless Chrome
import sys, time, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path, out = sys.argv[1], sys.argv[2]
W, H, wait = (int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])) if len(sys.argv) > 5 else (1100, 700, 3)
socketserver.TCPServer.allow_reuse_address = True
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Q, directory=root)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-watchdog"])
    pg = b.new_page(viewport={"width": W, "height": H}, has_touch=W < 600, is_mobile=W < 600)
    logs = []
    pg.on("console", lambda m: logs.append(m.type + ": " + m.text[:400]))
    pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)[:600]))
    pg.goto(f"http://127.0.0.1:{port}/{path}")
    for i, w in enumerate(str(wait).split(",") if False else [wait]):
        time.sleep(w)
    for k, extra in enumerate(sys.argv[6:]):       # extra args: js to evaluate, then another screenshot each
        pg.screenshot(path=out.replace(".png", f"_{k}.png")); pg.evaluate(extra); time.sleep(wait)
    pg.screenshot(path=out)
    for l in logs[:12]:
        if "GPU stall" not in l: print(l)
    b.close()
srv.shutdown()
