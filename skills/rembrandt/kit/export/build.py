"""scene.json (from extract.js) -> PPTX laid out the way Google Slides lays text out.

Measured model (Sep 2026, see the study doc):
  line pitch     = 1.2 * size * pct        (no font metrics involved)
  first baseline = box top + tIns + 0.96 * size * min(1, pct)
  insets default to 0.1in / 0.05in unless written as 0; letter spacing is dropped on import;
  exact line spacing (spcPts) is misconverted, so spacing is always written as a percentage.

Fidelity rule: the browser's rendered lines are replayed as explicit line breaks, and every box is
sized from the shaped width of its widest line, so Slides never re-wraps and cannot lose a break.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from minipptx import Deck, b64, ptint
import shape

G_ASC, G_LH = 0.96, 1.2
PAD = 3.0  # px of slack on a text box, so rounding can never trigger a re-wrap

# Weight map (Ayadi, 22 Sep 2026): 470 -> 500, 530 and 540 -> 500, 550 and 560 -> 600.
WEIGHT_NAMES = {400: '', 500: ' Medium', 600: ' SemiBold', 700: ''}
# Google Slides drops letter spacing, so Inter's tracked display styles export as Inter Tight.
FAMILY_MAP = {'Inter': 'Inter Tight'}


def font_for(family, weight, mode='names'):
    w = 400 if weight < 450 else 500 if weight < 545 else 600 if weight < 650 else 700
    if mode == 'bold':
        return family, weight >= 600
    return FAMILY_MAP.get(family, family) + WEIGHT_NAMES[w], w == 700


def text_shape(o, mode='google', font_mode='names'):
    """Return (x, y, w, h, paragraph, pct) for one measured text block."""
    c = dict(o['content']); runs = o['runs']; lh = o['lineHeight']
    lines = o.get('lines') or []
    n_lines = max(1, len(lines))
    # Sizes are written as whole points, so every prediction below uses the size that will actually
    # be rendered, not the browser's fractional one (17.5px body copy ships as 18pt).
    size = ptint(o['size'])
    pct = round(lh / (G_LH * size) * 100)
    if mode == 'google':
        first_bl = lines[0]['baseline'] if lines else c['y'] + lh / 2 + 0.35 * size
        y = first_bl - G_ASC * size * min(1.0, pct / 100)
    else:
        pct = round(lh / size * 100)
        y = c['y']

    prs = []
    for i, r in enumerate(runs):
        fname, bold = font_for(r['family'], r['weight'], font_mode)
        nxt = runs[i + 1] if i + 1 < len(runs) else None
        prs.append(dict(text=r['text'], font=fname, size_px=ptint(r['size']), bold=bold,
                        italic=r.get('italic', False), color=r['color'],
                        br=bool(nxt and nxt.get('line') != r.get('line'))))

    algn = {'center': 'ctr', 'right': 'r', 'end': 'r'}.get(o['align'], 'l')
    # Left-aligned text starts where the glyphs start (a chip's dot sits before its label).
    if algn == 'l' and mode == 'google' and o.get('textX0') is not None:
        shift = o['textX0'] - c['x']; c['x'] = o['textX0']; c['w'] -= shift

    w = c['w']
    if mode == 'google':
        widest = 0.0
        for li in range(n_lines):
            on_line = [(p['text'], p['font'], p['size_px'])
                       for p, r in zip(prs, runs) if r.get('line', 0) == li]
            widest = max(widest, shape.line_width_px(on_line))
        w = max(widest, o.get('maxLineW', 0)) + PAD
        if algn == 'ctr':
            c['x'] -= (w - c['w']) / 2
        elif algn == 'r':
            c['x'] -= (w - c['w'])
    h = max(c['h'], n_lines * G_LH * size * pct / 100)
    return c['x'], y, w, h, dict(runs=prs, line_pct=pct, align=algn), pct


def build(scene_path, out_path, slides=None, *, mode='google', font_mode='names', verbose=False,
          deck=None, insets=(0, 0, 0, 0)):
    scene = json.load(open(scene_path)); base = os.path.dirname(scene_path)
    d = deck or Deck()
    for name, items in scene.items():
        if slides and name not in slides:
            continue
        s = d.slide()
        for o in items:
            t = o['type']
            if t == 'rect':
                r = o['rect']
                if r['w'] <= 0 or r['h'] <= 0:
                    continue
                s.rect(r['x'], r['y'], r['w'], r['h'], fill=o.get('fill'), line=o.get('line'),
                       line_px=o.get('line_px') or 1, radius_px=o.get('radius') or 0,
                       alpha=(o.get('alpha') if o.get('alpha', 1) < 1 else None), name='rect')
            elif t == 'raster':
                if o.get('skip') or not o.get('png'):
                    continue
                r = o['rect']
                s.image(open(os.path.join(base, o['png']), 'rb').read(), max(0, r['x']), max(0, r['y']),
                        min(1920, r['w']), min(1080, r['h']), name=o['tag'].lower())
            elif t == 'text':
                x, y, w, h, para, pct = text_shape(o, mode, font_mode)
                s.text(x, y, w, h, [para], insets=insets, anchor='t',
                       name=f"{o.get('tag', '').lower()} {o.get('cls', '')}".strip())
                if verbose:
                    print(f"  {o.get('cls', '')!r:26} {n if (n := len(o.get('lines', []))) else 1} line(s) "
                          f"size={o['size']} pct={pct} y={y:.1f}")
    if deck is None:
        return d.save(out_path)
    return d


if __name__ == '__main__':
    scene, out = sys.argv[1], sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else 'google'
    if mode == 'ab':
        d = build(scene, None, mode='google', deck=Deck())
        d = build(scene, None, mode='naive', font_mode='bold', deck=d, insets=None)
        data = d.save(out)
    else:
        data = build(scene, out, mode=mode, verbose='-v' in sys.argv)
    open(out + '.b64', 'w').write(b64(data))
    print(f'{out} {len(data)} bytes')
    if mode == 'google':
        import verify
        sys.exit(0 if verify.verify(out, scene) else 1)
