"""Text advance widths for the fonts Google Slides will actually use.

HarfBuzz is the shaper behind Chrome and behind Google's own renderer, so shaping a string here with
the same font file gives the width Slides will lay out, kerning and ligatures included. That is what
lets the exporter size a text box so Slides cannot re-wrap it, and what lets the verifier prove it.
"""
import os, io, functools
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
import uharfbuzz as hb

FONTS = os.environ.get('REMBRANDT_FONTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts'))

# Vendored variable fonts (SIL Open Font License), the same files Google Fonts serves.
VARIABLE = {
    'Inter':       'inter.woff2',
    'Inter Tight': 'inter-tight.woff2',
    'Geist':       'geist.woff2',
    'Geist Mono':  'geist-mono.woff2',
}
SUFFIX = {' Medium': 500, ' SemiBold': 600, ' Bold': 700}


def split_typeface(typeface):
    """'Inter Tight SemiBold' -> ('Inter Tight', 600)"""
    for suffix, weight in SUFFIX.items():
        if typeface.endswith(suffix):
            return typeface[:-len(suffix)], weight
    return typeface, 400


@functools.lru_cache(maxsize=None)
def _font(family, weight):
    path = os.path.join(FONTS, VARIABLE[family])
    f = TTFont(path)
    f.flavor = None
    if 'fvar' in f:
        f = instancer.instantiateVariableFont(f, {'wght': weight}, updateFontNames=False)
    buf = io.BytesIO(); f.save(buf)
    face = hb.Face(buf.getvalue())
    return hb.Font(face), face.upem


def width_px(text, typeface, size_px):
    """Rendered advance width of `text` in px, as Google Slides will shape it."""
    if not text:
        return 0.0
    family, weight = split_typeface(typeface)
    if family not in VARIABLE:
        raise KeyError(f'no font file for typeface {typeface!r}')
    font, upem = _font(family, weight)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf)
    return sum(p.x_advance for p in buf.glyph_positions) / upem * size_px


def line_width_px(runs):
    """runs: [(text, typeface, size_px)] on one rendered line."""
    return sum(width_px(t, tf, s) for t, tf, s in runs)
