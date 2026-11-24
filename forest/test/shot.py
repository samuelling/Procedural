import sys, time, json
from playwright.sync_api import sync_playwright
out = sys.argv[1]; steps = json.loads(sys.argv[2]) if len(sys.argv) > 2 else [{}]
W, H = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1280, 760)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-watchdog"])
    pg = b.new_page(viewport={"width": W, "height": H}, has_touch=W < 600, is_mobile=W < 600)
    logs = []
    pg.on("console", lambda m: logs.append(m.type + ": " + m.text[:500]))
    pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)[:800]))
    pg.goto("file:///home/claude/forest/index.html" + (steps[0].get("hash", "") if steps else ""))
    time.sleep(2)
    for i, s in enumerate(steps):
        for k in s.get("keys", []): pg.evaluate("c => { dispatchEvent(new KeyboardEvent('keydown', {code: c})); dispatchEvent(new KeyboardEvent('keyup', {code: c})); }", k); time.sleep(0.4)
        if "click" in s: pg.evaluate("q => document.querySelector(q).click()", s["click"]); time.sleep(0.4)
        if "set" in s: pg.evaluate("o => window.sylva.set(o)", s["set"])
        if "slide" in s: pg.evaluate("([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }", s["slide"])
        time.sleep(s.get("wait", 1.5))
        pg.screenshot(path=f"{out}{i}.png")
        print(i, pg.evaluate("JSON.stringify(window.sylva ? window.sylva.info() : null)"), flush=True)
    for l in logs[:20]: print(l)
    b.close()
