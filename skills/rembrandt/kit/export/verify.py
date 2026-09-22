"""Prove a built PPTX matches the browser, before anyone opens it.

Four checks, run over the package itself rather than over the builder's intentions:

  TEXT  every rendered line in the browser appears as its own line in the deck, character for
        character, in order. Catches a dropped <br>, glued runs, a lost or duplicated run.
  FIT   every line, shaped with the font Google will use, fits inside its box. Catches any
        re-wrap: if a line fits, Slides has nothing to re-flow.
  GEOM  the box position implies the browser's first baseline and line pitch under the measured
        Google model (first baseline = top + 0.96 * size * min(1, pct), pitch = 1.2 * size * pct).
  HOUSE insets zeroed, whole-point sizes, whole-percent spacing, no spcPts, no autofit.

Exits non-zero on any failure, naming the slide, the style and the text.
"""
import json, sys, os, zipfile
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shape

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU_PX = 12700.0          # the deck's canvas is 1 css px = 1 pt
G_ASC, G_LH = 0.96, 1.2
FIT_EPS = 0.01            # px
GEOM_EPS = 0.75           # px


def _lines_of(txbody):
    """[(line_text, [(text, typeface, size_px)])] for one text body, split at <a:br/>."""
    out, cur = [], []
    for para in txbody.findall(f'{A}p'):
        for node in para:
            if node.tag == f'{A}r':
                rpr = node.find(f'{A}rPr')
                t = node.find(f'{A}t').text or ''
                size = int(rpr.get('sz')) / 100.0          # pt == px on this canvas
                tf = rpr.find(f'{A}latin').get('typeface')
                cur.append((t, tf, size))
            elif node.tag == f'{A}br':
                out.append(cur); cur = []
        out.append(cur); cur = []
    return [(''.join(t for t, _, _ in ln).strip(), ln) for ln in out if ln]


def _text_shapes(slide_xml):
    root = ET.fromstring(slide_xml)
    shapes = []
    for sp in root.iter(f'{P}sp'):
        tx = sp.find(f'{P}txBody')
        if tx is None or tx.find(f'.//{A}t') is None:
            continue
        off = sp.find(f'.//{A}off'); ext = sp.find(f'.//{A}ext')
        body = tx.find(f'{A}bodyPr')
        ins = {k: int(body.get(k, -1)) for k in ('lIns', 'tIns', 'rIns', 'bIns')}
        pPr = tx.find(f'{A}p/{A}pPr')
        spc = pPr.find(f'{A}lnSpc/{A}spcPct') if pPr is not None else None
        spcPts = pPr.find(f'{A}lnSpc/{A}spcPts') if pPr is not None else None
        shapes.append(dict(
            name=sp.find(f'{P}nvSpPr/{P}cNvPr').get('name', ''),
            x=int(off.get('x')) / EMU_PX, y=int(off.get('y')) / EMU_PX,
            w=int(ext.get('cx')) / EMU_PX, h=int(ext.get('cy')) / EMU_PX,
            ins=ins, autofit=body.find(f'{A}noAutofit') is not None,
            pct=int(spc.get('val')) / 1000.0 if spc is not None else 100.0,
            pct_raw=int(spc.get('val')) if spc is not None else 100000,
            spcPts=spcPts is not None,
            lines=_lines_of(tx)))
    return shapes


def verify(pptx_path, scene_path, slides=None, quiet=False):
    scene = json.load(open(scene_path))
    if slides:
        scene = {k: v for k, v in scene.items() if k in slides}
    zf = zipfile.ZipFile(pptx_path)
    fails, widest_drift = [], (0.0, '')

    for i, (name, items) in enumerate(scene.items(), start=1):
        want = [o for o in items if o['type'] == 'text']
        got = _text_shapes(zf.read(f'ppt/slides/slide{i}.xml'))
        if len(want) != len(got):
            fails.append(f'{name}: {len(want)} text blocks in the browser, {len(got)} in the deck')
            continue
        for o, sp in zip(want, got):
            where = f"{name} [{o.get('cls') or o.get('tag')}]"
            wl = [L['text'] for L in o.get('lines', [])]
            gl = [t for t, _ in sp['lines']]
            if wl != gl:
                fails.append(f'TEXT  {where}\n        browser {wl}\n        deck    {gl}')
                continue
            inner = sp['w'] - (sp['ins']['lIns'] + sp['ins']['rIns']) / EMU_PX
            for (t, runs), L in zip(sp['lines'], o['lines']):
                w = shape.line_width_px(runs)
                if w > inner + FIT_EPS:
                    fails.append(f'FIT   {where} line {t[:44]!r} needs {w:.1f}px, box holds {inner:.1f}px')
                drift = (w - L['w']) / max(L['w'], 1)
                if drift > widest_drift[0]:
                    widest_drift = (drift, f'{where} {t[:36]!r}')
            # the size the deck actually carries (whole points), which is what Google lays out with
            size = max(sz for _, runs in sp['lines'] for _, _, sz in runs)
            pct = sp['pct'] / 100.0
            bl = sp['y'] + sp['ins']['tIns'] / EMU_PX + G_ASC * size * min(1.0, pct)
            if abs(bl - o['lines'][0]['baseline']) > GEOM_EPS:
                fails.append(f'GEOM  {where} first baseline {bl:.2f} vs browser {o["lines"][0]["baseline"]:.2f}')
            if len(o['lines']) > 1:
                pitch = G_LH * size * pct
                want_pitch = o['lines'][1]['baseline'] - o['lines'][0]['baseline']
                if abs(pitch - want_pitch) > GEOM_EPS:
                    fails.append(f'GEOM  {where} line pitch {pitch:.2f} vs browser {want_pitch:.2f}')
            if any(v != 0 for v in sp['ins'].values()):
                fails.append(f'HOUSE {where} insets not zeroed: {sp["ins"]}')
            if sp['spcPts']:
                fails.append(f'HOUSE {where} exact line spacing (spcPts); Google misconverts it')
            if sp['pct_raw'] % 1000:
                fails.append(f'HOUSE {where} line spacing {sp["pct_raw"] / 1000}% is not a whole percent')
            if not sp['autofit']:
                fails.append(f'HOUSE {where} missing noAutofit')
            for _, runs in sp['lines']:
                for t, tf, size_px in runs:
                    if round(size_px * 100) % 100:
                        fails.append(f'HOUSE {where} size {size_px}pt is not a whole point')

    if not quiet:
        n_lines = sum(len(o.get('lines', [])) for items in scene.values() for o in items if o['type'] == 'text')
        print(f'verify: {len(scene)} slides, {n_lines} rendered lines, '
              f'widest export/browser width drift {widest_drift[0] * 100:.1f}% ({widest_drift[1]})')
        for f in fails:
            print('  FAIL ' + f)
        print('verify: PASS' if not fails else f'verify: FAIL ({len(fails)})')
    return not fails


if __name__ == '__main__':
    sys.exit(0 if verify(sys.argv[1], sys.argv[2]) else 1)
