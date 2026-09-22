"""Regression tests: the checks must fail on decks that carry the defects we have actually shipped.

A checker nobody has seen fail is not a checker. Each case here breaks the exporter on purpose and
asserts verify() rejects the result. Run: python3 test_export.py <scene.json>
"""
import sys, os, tempfile, contextlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build, verify, minipptx

SLIDES = ['statement/full', 'cover/light', 'cards/3-up', 'plan/detailed', 'spec/type']


def run(scene, **kw):
    out = os.path.join(tempfile.mkdtemp(), 'case.pptx')
    build.build(scene, out, SLIDES, **kw)
    with open(os.devnull, 'w') as null, contextlib.redirect_stdout(null):
        return verify.verify(out, scene, SLIDES, quiet=True)


def case(name, expect_pass, patch=None):
    original = build.text_shape
    if patch:
        build.text_shape = lambda o, mode='google', font_mode='names', _p=patch: _p(original(o, mode, font_mode))
    try:
        got = run(sys.argv[1])
    finally:
        build.text_shape = original
    ok = (got == expect_pass)
    print(f"  {'ok  ' if ok else 'FAIL'} {name}: verify {'passed' if got else 'failed'}"
          f"{'' if ok else '  <-- expected the opposite'}")
    return ok


def drop_breaks(t):
    """The statement slide bug: an explicit <br> lost, so two lines are glued into one."""
    x, y, w, h, para, pct = t
    for r in para['runs']:
        r['br'] = False
    return x, y, w, h, para, pct


def narrow_box(t):
    """A box too small for its text, which is what makes Slides re-wrap a title."""
    x, y, w, h, para, pct = t
    return x, y, w * 0.8, h, para, pct


def glue_runs(t):
    """A word space lost somewhere in the text, as happens when runs are concatenated raw."""
    x, y, w, h, para, pct = t
    for r in para['runs']:
        if ' ' in r['text'].strip():
            r['text'] = r['text'].replace(' ', '', 1)
            break
    return x, y, w, h, para, pct


def shift_box(t):
    """Baseline off by the default top inset, the classic 'everything sits low' defect."""
    x, y, w, h, para, pct = t
    return x, y + 4.8, w, h, para, pct


def fractional_size(t):
    x, y, w, h, para, pct = t
    for r in para['runs']:
        r['size_px'] = r['size_px'] + 0.5
    return x, y, w, h, para, pct


if __name__ == '__main__':
    print('export checks')
    results = [
        case('clean build passes', True),
        case('lost line break is caught', False, drop_breaks),
        case('box too narrow is caught', False, narrow_box),
        case('glued runs are caught', False, glue_runs),
        case('baseline shift is caught', False, shift_box),
        case('fractional point size is caught', False, fractional_size),
    ]
    # default insets are a builder-level setting, not a per-shape one
    out = os.path.join(tempfile.mkdtemp(), 'insets.pptx')
    build.build(sys.argv[1], out, SLIDES, insets=None)
    with open(os.devnull, 'w') as null, contextlib.redirect_stdout(null):
        got = verify.verify(out, sys.argv[1], SLIDES, quiet=True)
    print(f"  {'ok  ' if not got else 'FAIL'} default insets are caught: verify {'passed' if got else 'failed'}")
    results.append(not got)
    print('all checks behaved' if all(results) else 'SOME CHECKS MISBEHAVED')
    sys.exit(0 if all(results) else 1)
