"""Compare CSS text positions (scene.json) with the Google Slides PDF export.
For each text item: find the PDF text line whose content starts with the same words, closest to the CSS position,
and report dx (first glyph x) and dy (first baseline) in px, plus line count differences."""
import json, sys, re
from collections import defaultdict
import pdfplumber

def lines_of(page):
    k = 1920 / page.width; H = page.height
    groups = defaultdict(list)
    for c in page.chars:
        bl = round((H - c['matrix'][5]) * k, 1)
        groups[bl].append(c)
    out = []
    for bl, cs in groups.items():
        cs.sort(key=lambda c: c['x0'])
        # split into runs separated by big gaps (different boxes on the same baseline)
        cur = [cs[0]]
        for a, b in zip(cs, cs[1:]):
            if (b['x0'] - a['x1']) * k > 40: out.append((bl, cur)); cur = [b]
            else: cur.append(b)
        out.append((bl, cur))
    res = []
    for bl, cs in out:
        txt = ''.join(c['text'] for c in cs)
        res.append(dict(bl=bl, x0=cs[0]['x0'] * k, x1=cs[-1]['x1'] * k, text=txt, font=cs[0]['fontname'].split('+')[-1], size=cs[0]['size'] * k))
    return res

def norm(s): return re.sub(r'\s+', ' ', s.replace('­', '')).strip().lower()

def compare(scene_path, pdf_path, page_offset=0, names=None):
    scene = json.load(open(scene_path)); pdf = pdfplumber.open(pdf_path)
    rows = []
    for i, (name, items) in enumerate(scene.items()):
        if names and name not in names: continue
        page = pdf.pages[i + page_offset]; pl = lines_of(page)
        for o in items:
            if o['type'] != 'text': continue
            full = norm(''.join(r['text'] for r in o['runs']))
            head = full[:14]
            css_bl = o['baselines'][0] if o['baselines'] else None
            css_x = o['textX0']
            cands = [l for l in pl if norm(l['text']).startswith(head[:min(len(head), 8)]) or head.startswith(norm(l['text'])[:8])]
            if not cands or css_bl is None:
                rows.append((name, o.get('cls') or o.get('tag'), full[:30], None)); continue
            best = min(cands, key=lambda l: abs(l['bl'] - css_bl) + abs(l['x0'] - css_x) / 4)
            # count pdf lines belonging to this block: lines within the css block vertical range +-, same x0 approx
            n_pdf = len([l for l in pl if abs(l['x0'] - best['x0']) < 3 and o['content']['y'] - 5 <= l['bl'] <= o['content']['y'] + o['content']['h'] + o['size'] * 1.5])
            rows.append((name, o.get('cls') or o.get('tag'), full[:30], dict(dx=best['x0'] - css_x, dy=best['bl'] - css_bl, n_css=len(o['baselines']), n_pdf=n_pdf, font=best['font'], size=best['size'], weight=o['runs'][0]['weight'])))
    return rows

if __name__ == '__main__':
    rows = compare(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 0)
    import statistics
    dys = []; dxs = []
    for name, cls, txt, m in rows:
        if m is None: print(f'{name:18} {str(cls)[:22]:22} {txt:30} NOT FOUND'); continue
        flag = '' if abs(m['dy']) < 1 and abs(m['dx']) < 1 and m['n_css'] == m['n_pdf'] else ' <--'
        print(f"{name:18} {str(cls)[:22]:22} {txt:30} dx={m['dx']:+6.2f} dy={m['dy']:+6.2f} lines css/pdf={m['n_css']}/{m['n_pdf']} w={m['weight']:.0f} {m['font']}{flag}")
        dys.append(abs(m['dy'])); dxs.append(abs(m['dx']))
    print('median |dy| %.2f px, max %.2f; median |dx| %.2f, max %.2f; n=%d' % (statistics.median(dys), max(dys), statistics.median(dxs), max(dxs), len(dys)))
