#!/usr/bin/env python3
# Neon Hexfall — PWA icon + social preview generator (Block 19).
# Redraws the hex logo from favicon.svg with PIL (no external assets) and
# writes the PNG icons the manifest needs plus a 1200x630 social preview.
# Regenerate with:  python3 tests/make-icons.py
# Needs Pillow (pip install pillow) and DejaVu fonts (standard on Linux).
import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
FONT_DIR = "/usr/share/fonts/truetype/dejavu"

BG = (11, 6, 32)        # #0b0620
BG2 = (24, 12, 58)      # gradient end
CYAN = (34, 230, 255)   # #22e6ff
PINK = (255, 45, 149)   # #ff2d95
LIME = (166, 255, 62)   # #a6ff3e
WHITE = (255, 255, 255)
MUTED = (179, 166, 221) # #b3a6dd — menu muted text

# Hexagon points from favicon.svg (64x64 viewBox).
OUTER = [(32, 8), (52, 19), (52, 41), (32, 52), (12, 41), (12, 19)]
INNER = [(32, 20), (42, 26), (42, 38), (32, 44), (22, 38), (22, 26)]


def hex_points(pts, scale, cx, cy):
    return [(cx + (x - 32) * scale, cy + (y - 32) * scale) for (x, y) in pts]


def draw_logo(draw, size, cx, cy, hex_scale, stroke_w):
    """Draw the favicon logo centred at (cx, cy); hexes span hex_scale*64px."""
    s = hex_scale
    draw.polygon(hex_points(OUTER, s, cx, cy), outline=CYAN,
                 width=max(2, int(stroke_w)))
    draw.polygon(hex_points(INNER, s, cx, cy), fill=PINK)
    draw.ellipse([cx - 5 * s, cy - 5 * s, cx + 5 * s, cy + 5 * s], fill=LIME)


def rounded_bg(size, radius):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
    return img, d


def app_icon(size, path, maskable=False):
    """Launcher icon. Maskable variant is full-bleed with the logo shrunk
    into the central safe zone (maskable safe zone is the middle 80%)."""
    if maskable:
        img = Image.new("RGB", (size, size), BG)
        d = ImageDraw.Draw(img)
        draw_logo(d, size, size / 2, size / 2, size / 64 * 0.62, 4 * size / 64)
    else:
        img, d = rounded_bg(size, int(size * 14 / 64))
        draw_logo(d, size, size / 2, size / 2, size / 64, 4 * size / 64)
    img.save(path, "PNG")
    print("wrote", path, img.size)


def social_preview(path):
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # Vertical gradient.
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)],
               fill=tuple(int(BG[i] + (BG2[i] - BG[i]) * t) for i in range(3)))
    # Faint hex outlines scattered across the right half.
    for (hx, hy, hr) in [(980, 120, 70), (1120, 330, 90), (900, 480, 55),
                          (1060, 560, 40), (820, 220, 38)]:
        pts = [(hx + hr * math.cos(math.radians(60 * k - 90)),
                hy + hr * math.sin(math.radians(60 * k - 90))) for k in range(6)]
        d.polygon(pts, outline=(20, 90, 110))
    # Big logo on the left.
    draw_logo(d, 0, 240, H // 2, 260 / 64, 4 * 260 / 64)
    # Title + tagline.
    bold = lambda px: ImageFont.truetype(
        os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), px)
    reg = lambda px: ImageFont.truetype(
        os.path.join(FONT_DIR, "DejaVuSans.ttf"), px)
    d.text((430, 170), "NEON", font=bold(118), fill=WHITE)
    d.text((430, 290), "HEXFALL", font=bold(118), fill=CYAN)
    d.text((432, 440), "Match 3+ hexes. Chain combos.",
           font=reg(40), fill=WHITE)
    d.text((432, 490), "Outrun the rising tide.",
           font=reg(40), fill=WHITE)
    d.text((432, 566), "Play free  ·  namdev-muse.github.io/neon-hexfall",
           font=reg(26), fill=MUTED)
    img.save(path, "PNG")
    print("wrote", path, img.size)


def main():
    app_icon(192, os.path.join(ROOT, "icon-192.png"))
    app_icon(512, os.path.join(ROOT, "icon-512.png"))
    app_icon(180, os.path.join(ROOT, "apple-touch-icon.png"))
    app_icon(512, os.path.join(ROOT, "maskable-512.png"), maskable=True)
    social_preview(os.path.join(DOCS, "social-preview.png"))


if __name__ == "__main__":
    main()
