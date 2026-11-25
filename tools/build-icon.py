#!/usr/bin/env python3
"""Build Rembrandt's app icon from the portrait in docs/hero.jpg.

The portrait is masked to a squircle (a superellipse, the app-icon shape, not a rounded rectangle)
and given a soft drop shadow, on a transparent canvas with enough margin that the shadow never
reaches the edge. A shadow that touches the canvas edge shows up cropped wherever the icon is placed.

    python3 tools/build-icon.py

Writes:
    docs/logo.png                  1024 px, squircle and shadow, transparent; the master asset
    docs/favicon.png               256 px, the same at tab size
    docs/apple-touch-icon.png      180 px, the square portrait, opaque: iOS applies its own squircle
                                   mask and shadow, so the icon it gets must be neither
    telemetry/public/favicon.png   a copy of docs/favicon.png
"""
import os, shutil
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')
SRC = os.path.join(DOCS, 'hero.jpg')

CANVAS = 1024
ICON = 740            # the squircle's width; the rest of the canvas is room for the shadow
LIFT = 16             # the squircle sits slightly above centre so the shadow below has room
N = 5.0               # superellipse exponent: 5 is the app-icon curve (4 rounder, 6 squarer)
SS = 4                # supersampling for a clean edge


def squircle_mask(size):
    big = size * SS
    r = big / 2
    m = Image.new('L', (big, big), 0)
    px = m.load()
    for y in range(big):
        dy = abs((y + 0.5 - r) / r) ** N
        if dy >= 1:
            continue
        half = r * (1 - dy) ** (1 / N)          # half-width of the shape on this row
        x0, x1 = int(round(r - half)), int(round(r + half))
        for x in range(max(0, x0), min(big, x1)):
            px[x, y] = 255
    return m.resize((size, size), Image.LANCZOS)


def shadow(mask, canvas, pos, offset, blur, alpha):
    s = Image.new('L', (canvas, canvas), 0)
    s.paste(mask, (pos[0], pos[1] + offset))
    s = s.filter(ImageFilter.GaussianBlur(blur))
    s = s.point(lambda v: int(v * alpha))
    layer = Image.new('RGBA', (canvas, canvas), (16, 24, 40, 0))
    layer.putalpha(s)
    return layer


def build(canvas, icon, lift):
    portrait = Image.open(SRC).convert('RGB').resize((icon, icon), Image.LANCZOS)
    mask = squircle_mask(icon)
    pos = ((canvas - icon) // 2, (canvas - icon) // 2 - lift)
    k = icon / 800
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    # two shadows, like an app icon on a light surface: a wide soft one and a tight contact one
    out = Image.alpha_composite(out, shadow(mask, canvas, pos, round(34 * k), 44 * k, 0.30))
    out = Image.alpha_composite(out, shadow(mask, canvas, pos, round(8 * k), 10 * k, 0.22))
    face = Image.new('RGBA', (icon, icon))
    face.paste(portrait, (0, 0))
    face.putalpha(mask)
    out.alpha_composite(face, pos)
    # the shadow must fade out before the canvas edge, or it shows up cropped
    a = out.getchannel('A')
    edge = max(a.crop(box).getextrema()[1] for box in ((0, 0, canvas, 1), (0, canvas - 1, canvas, canvas),
                                                       (0, 0, 1, canvas), (canvas - 1, 0, canvas, canvas)))
    assert edge == 0, f'shadow reaches the canvas edge (alpha {edge}); give it more room'
    return out


logo = build(CANVAS, ICON, LIFT)
logo.save(os.path.join(DOCS, 'logo.png'), optimize=True)
fav = build(256, 184, 4)
fav.save(os.path.join(DOCS, 'favicon.png'), optimize=True)
shutil.copyfile(os.path.join(DOCS, 'favicon.png'), os.path.join(ROOT, 'telemetry', 'public', 'favicon.png'))
Image.open(SRC).convert('RGB').resize((180, 180), Image.LANCZOS).save(os.path.join(DOCS, 'apple-touch-icon.png'), optimize=True)
print('build-icon: wrote docs/logo.png, docs/favicon.png, docs/apple-touch-icon.png, telemetry/public/favicon.png')
