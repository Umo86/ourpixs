#!/usr/bin/env python3
"""
Capture store screenshots from the demo web export (Playwright + Chromium).

  cd apps/mobile
  EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir dist-web
  pip install playwright && python -m playwright install chromium   # once
  python store/capture_screenshots.py                 # -> store/screenshots/raw/<size>/<lang>/NN-<screen>.png
  python store/capture_screenshots.py --fastlane      # also copies into fastlane deliver/supply folders

These are full-bleed UI renders of the real React Native screens (react-native-web), at exact store sizes.
For final submission, prefer native captures from a simulator/emulator build with EXPO_PUBLIC_DEMO=1
(open bizimresimler://demo/<screen>?lang=en) — see store/screenshot-plan.md.
"""
import argparse
import asyncio
import functools
import http.server
import os
import shutil
import socketserver
import threading

from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)

# Gallery order (see screenshot-plan.md)
SCREENS = ["album", "join-event", "qr", "feed", "guest-missions", "guest-upload", "guestbook", "settings"]

SIZES = {
    # name: (css width, css height, scale) -> pixels
    "ios-6.9": (430, 932, 3),   # 1290 x 2796 (6.9"/6.7" slot)
    "ios-6.5": (428, 926, 3),   # 1284 x 2778
    "android-phone": (360, 640, 3),  # 1080 x 1920
}
LANGS = {"en": ("en-GB", "en-GB"), "tr": ("tr", "tr-TR")}  # lang -> (deliver locale, supply locale)

FEATURE_GRAPHIC = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital@1&family=Inter+Tight:wght@900&display=swap" rel="stylesheet">
<style>body{margin:0}.g{width:1024px;height:500px;background:#0A0A0A;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 72px;box-sizing:border-box;font-family:'Inter Tight',sans-serif}
.b{font-family:'Bodoni Moda',serif;font-style:italic;font-size:34px}.b span{color:#4D6BFF}
h1{margin:18px 0 0;font-weight:900;font-size:76px;line-height:.95;letter-spacing:-3px}h1 em{font-family:'Bodoni Moda',serif;font-weight:400;color:#8097FF}
.s{position:absolute;right:80px;top:80px;width:150px;height:150px;border-radius:50%;background:#2347E0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:22px;transform:rotate(12deg)}</style></head>
<body><div class="g"><div class="s">%STICKER%</div><div class="b">%BRAND%<span>.</span></div><h1>%L1%<br><em>%L2%</em></h1></div></body></html>"""
FG_TEXT = {
    "en": {"BRAND": "BizimResimler", "L1": "Every guest's photos,", "L2": "one album.", "STICKER": "No app for guests"},
    "tr": {"BRAND": "BizimResimler", "L1": "Tüm misafirlerin karesi,", "L2": "tek albümde.", "STICKER": "Misafire uygulama yok"},
}


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = "/index.html"
        return super().send_head()


def serve(root, port):
    handler = functools.partial(SpaHandler, directory=root)
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


async def main(args):
    dist = os.path.join(APP, "dist-web")
    if not os.path.exists(os.path.join(dist, "index.html")):
        raise SystemExit("dist-web not found. Run: EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir dist-web")
    httpd = serve(dist, args.port)
    out = os.path.join(HERE, "screenshots", "raw")
    async with async_playwright() as p:
        browser = await p.chromium.launch(**({"executable_path": args.chrome} if args.chrome else {}))
        for size, (w, h, scale) in SIZES.items():
            ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=scale)
            page = await ctx.new_page()
            for lang in LANGS:
                d = os.path.join(out, size, lang)
                os.makedirs(d, exist_ok=True)
                for i, screen in enumerate(SCREENS, 1):
                    await page.goto(f"http://127.0.0.1:{args.port}/demo/{screen}?lang={lang}")
                    await page.wait_for_timeout(args.wait)
                    path = os.path.join(d, f"{i:02d}-{screen}.png")
                    await page.screenshot(path=path)
                    print("wrote", os.path.relpath(path, APP))
            await ctx.close()
        # Play feature graphic 1024x500
        ctx = await browser.new_context(viewport={"width": 1024, "height": 500}, device_scale_factor=1)
        page = await ctx.new_page()
        for lang, txt in FG_TEXT.items():
            html = FEATURE_GRAPHIC
            for k, v in txt.items():
                html = html.replace(f"%{k}%", v)
            await page.set_content(html)
            await page.wait_for_timeout(800)
            path = os.path.join(out, f"feature-graphic-{lang}.png")
            await page.screenshot(path=path)
            print("wrote", os.path.relpath(path, APP))
        await browser.close()
    httpd.shutdown()

    if args.fastlane:
        meta = os.path.join(HERE, "fastlane", "metadata")
        for lang, (ios_loc, play_loc) in LANGS.items():
            ios_dir = os.path.join(HERE, "fastlane", "screenshots", ios_loc)
            os.makedirs(ios_dir, exist_ok=True)
            for size in ("ios-6.9", "ios-6.5"):
                for f in sorted(os.listdir(os.path.join(out, size, lang))):
                    shutil.copy(os.path.join(out, size, lang, f), os.path.join(ios_dir, f"{size}-{f}"))
            phone = os.path.join(meta, "android", play_loc, "images", "phoneScreenshots")
            os.makedirs(phone, exist_ok=True)
            for f in sorted(os.listdir(os.path.join(out, "android-phone", lang))):
                shutil.copy(os.path.join(out, "android-phone", lang, f), os.path.join(phone, f))
            shutil.copy(os.path.join(out, f"feature-graphic-{lang}.png"), os.path.join(meta, "android", play_loc, "images", "featureGraphic.png"))
        print("copied into fastlane deliver/supply folders")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fastlane", action="store_true", help="also copy into fastlane screenshot folders")
    ap.add_argument("--port", type=int, default=8123)
    ap.add_argument("--wait", type=int, default=2500, help="ms to wait per screen")
    ap.add_argument("--chrome", default=os.environ.get("CHROME_PATH"), help="path to a Chrome/Chromium binary (optional)")
    asyncio.run(main(ap.parse_args()))
