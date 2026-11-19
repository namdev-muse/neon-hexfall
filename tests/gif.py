#!/usr/bin/env python3
"""Stitch tests/screenshot.js frames into docs/gameplay.gif (Block 13).
Usage: python3 tests/gif.py
Reads .shot-frames/f*.png, resizes to 480px wide, writes docs/gameplay.gif.
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAMES = sorted(glob.glob(os.path.join(ROOT, ".shot-frames", "f*.png")))
if not FRAMES:
    print("no frames found — run: node tests/screenshot.js", file=sys.stderr)
    sys.exit(1)

imgs = []
for f in FRAMES:
    im = Image.open(f).convert("RGB")
    im = im.resize((480, int(im.height * 480 / im.width)), Image.LANCZOS)
    imgs.append(im)

out = os.path.join(ROOT, "docs", "gameplay.gif")
imgs[0].save(out, save_all=True, append_images=imgs[1:],
             duration=180, loop=0, optimize=True)
print("wrote %s (%d bytes, %d frames)" % (out, os.path.getsize(out), len(imgs)))
