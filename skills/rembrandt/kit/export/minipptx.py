"""Tiny OOXML writer. Produces the smallest valid PPTX we can, with full control over
bodyPr / pPr / rPr, which is what the Google Slides study needs.
Canvas: 1920x1080 CSS px -> 26.667in x 15in. 1 px = 12700 EMU = 1 pt, so every size is an integer point value.
"""
import zipfile, io, base64
from xml.sax.saxutils import escape

PX = 12700  # 1 css px = 1 pt
import math
def E(v): return int(round(v * PX))
def ptint(px): return int(math.floor(px + 0.5))  # whole points, half rounds up
def pt100(px): return ptint(px) * 100

NS = ('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"')

class Slide:
    def __init__(self, deck):
        self.deck = deck; self.shapes = []; self.rels = []; self._id = 2
        self.bg = None
    def nid(self):
        self._id += 1; return self._id
    def background(self, hex6):
        self.bg = hex6
    def rect(self, x, y, w, h, fill=None, line=None, line_px=1, radius_px=0, name="rect", alpha=None):
        geom = 'roundRect' if radius_px else 'rect'
        adj = ''
        if radius_px:
            r = min(50000, int(round(radius_px / min(w, h) * 100000)))
            adj = f'<a:avLst><a:gd name="adj" fmla="val {r}"/></a:avLst>'
        else:
            adj = '<a:avLst/>'
        fillx = f'<a:solidFill><a:srgbClr val="{fill}">{f"<a:alpha val=%d/>" % int(alpha*100000) if alpha is not None else ""}</a:srgbClr></a:solidFill>' if fill else '<a:noFill/>'
        linex = (f'<a:ln w="{E(line_px)}"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>' if line
                 else '<a:ln><a:noFill/></a:ln>')
        self.shapes.append(f'''<p:sp><p:nvSpPr><p:cNvPr id="{self.nid()}" name="{escape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="{E(x)}" y="{E(y)}"/><a:ext cx="{E(w)}" cy="{E(h)}"/></a:xfrm><a:prstGeom prst="{geom}">{adj}</a:prstGeom>{fillx}{linex}</p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>''')
    def line(self, x1, y1, x2, y2, color, w_px=1, name="line"):
        x, y = min(x1, x2), min(y1, y2); w, h = abs(x2 - x1), abs(y2 - y1)
        self.shapes.append(f'''<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="{self.nid()}" name="{escape(name)}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
<p:spPr><a:xfrm><a:off x="{E(x)}" y="{E(y)}"/><a:ext cx="{E(w)}" cy="{E(h)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom>
<a:ln w="{E(w_px)}"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:ln></p:spPr></p:cxnSp>''')
    def image(self, png_bytes, x, y, w, h, name="img"):
        import hashlib
        key = hashlib.sha1(png_bytes).hexdigest()
        ext = 'jpg' if png_bytes[:3] == b'\xff\xd8\xff' else 'png'
        if key in self.deck.media_index:
            idx, ext = self.deck.media_index[key]
        else:
            idx = len(self.deck.media) + 1
            self.deck.media.append((f'image{idx}.{ext}', png_bytes)); self.deck.media_index[key] = (idx, ext)
        rid = f'rId{len(self.rels) + 2}'
        self.rels.append((rid, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', f'../media/image{idx}.{ext}'))
        self.shapes.append(f'''<p:pic><p:nvPicPr><p:cNvPr id="{self.nid()}" name="{escape(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="{E(x)}" y="{E(y)}"/><a:ext cx="{E(w)}" cy="{E(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>''')
    def text(self, x, y, w, h, paragraphs, *, insets=(0, 0, 0, 0), anchor='t', wrap=True, autofit='none', name="text"):
        """paragraphs: list of dicts {runs:[{text, font, size_px, bold, italic, color, spc_em, caps}], align, line_pct, line_px, space_before_px, space_after_px}"""
        ins = '' if insets is None else ' '.join(f'{k}="{E(v)}"' for k, v in zip(('lIns', 'tIns', 'rIns', 'bIns'), insets))
        af = {'none': '<a:noAutofit/>', 'norm': '<a:normAutofit/>', 'shape': '<a:spAutoFit/>', '': ''}[autofit]
        ps = []
        for p in paragraphs:
            ppr = ''
            if p.get('align'): ppr += f' algn="{p["align"]}"'
            inner = ''
            if p.get('line_pct') is not None: inner += f'<a:lnSpc><a:spcPct val="{int(round(p["line_pct"])) * 1000}"/></a:lnSpc>'
            if p.get('line_px') is not None: inner += f'<a:lnSpc><a:spcPts val="{pt100(p["line_px"])}"/></a:lnSpc>'
            if p.get('space_before_px'): inner += f'<a:spcBef><a:spcPts val="{pt100(p["space_before_px"])}"/></a:spcBef>'
            if p.get('space_after_px'): inner += f'<a:spcAft><a:spcPts val="{pt100(p["space_after_px"])}"/></a:spcAft>'
            if p.get('bullet'):
                inner += f'<a:buClr><a:srgbClr val="{p.get("bullet_color","101828")}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="{p["bullet"]}"/>'
                ppr += f' marL="{E(p.get("indent_px", 28))}" indent="-{E(p.get("indent_px", 28))}"'
            else:
                inner += '<a:buNone/>'
            rs = ''
            for r in p['runs']:
                attrs = f'lang="en-US" sz="{pt100(r.get("size_px", 21))}" b="{1 if r.get("bold") else 0}" i="{1 if r.get("italic") else 0}"'
                if r.get('spc_em') is not None: attrs += f' spc="{int(round(r["spc_em"] * r.get("size_px", 21) * 100))}"'
                if r.get('caps'): attrs += ' cap="all"'
                if r.get('baseline'): attrs += f' baseline="{r["baseline"]}"'
                f = r.get('font', 'Geist')
                rs += (f'<a:r><a:rPr {attrs}><a:solidFill><a:srgbClr val="{r.get("color", "101828")}"/></a:solidFill>'
                       f'<a:latin typeface="{escape(f)}"/><a:ea typeface="{escape(f)}"/><a:cs typeface="{escape(f)}"/></a:rPr>'
                       f'<a:t>{escape(r["text"])}</a:t></a:r>')
                if r.get('br'): rs += f'<a:br><a:rPr {attrs}/></a:br>'
            ps.append(f'<a:p><a:pPr{ppr}>{inner}</a:pPr>{rs}</a:p>')
        self.shapes.append(f'''<p:sp><p:nvSpPr><p:cNvPr id="{self.nid()}" name="{escape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="{E(x)}" y="{E(y)}"/><a:ext cx="{E(w)}" cy="{E(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="{'square' if wrap else 'none'}" {ins} anchor="{anchor}" rtlCol="0">{af}</a:bodyPr><a:lstStyle/>{''.join(ps)}</p:txBody></p:sp>''')
    def xml(self):
        bg = f'<p:bg><p:bgPr><a:solidFill><a:srgbClr val="{self.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' if self.bg else ''
        return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld {NS}><p:cSld>{bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
{''.join(self.shapes)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''

class Deck:
    def __init__(self, w_px=1920, h_px=1080):
        self.w, self.h = w_px, h_px; self.slides = []; self.media = []; self.media_index = {}
    def slide(self):
        s = Slide(self); self.slides.append(s); return s
    def save(self, path=None):
        buf = io.BytesIO(); z = zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED)
        n = len(self.slides)
        ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>',
              '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
              '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
              '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
              '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>']
        for i in range(1, n + 1):
            ct.append(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')
        ct.append('</Types>')
        z.writestr('[Content_Types].xml', ''.join(ct))
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
        sldids = ''.join(f'<p:sldId id="{256 + i}" r:id="rId{i + 1}"/>' for i in range(1, n + 1))
        z.writestr('ppt/presentation.xml', f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation {NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>{sldids}</p:sldIdLst><p:sldSz cx="{E(self.w)}" cy="{E(self.h)}"/><p:notesSz cx="6858000" cy="9144000"/>
<p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>''')
        rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>']
        for i in range(1, n + 1):
            rels.append(f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>')
        rels.append(f'<Relationship Id="rId{n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>')
        z.writestr('ppt/_rels/presentation.xml.rels', ''.join(rels))
        z.writestr('ppt/slideMasters/slideMaster1.xml', f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster {NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>''')
        z.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>')
        z.writestr('ppt/slideLayouts/slideLayout1.xml', f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout {NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>''')
        z.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>')
        z.writestr('ppt/theme/theme1.xml', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Axoniq"><a:themeElements>
<a:clrScheme name="Axoniq"><a:dk1><a:srgbClr val="101828"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="344054"/></a:dk2><a:lt2><a:srgbClr val="F2F4F7"/></a:lt2><a:accent1><a:srgbClr val="2E90FA"/></a:accent1><a:accent2><a:srgbClr val="FF4405"/></a:accent2><a:accent3><a:srgbClr val="7A5AF8"/></a:accent3><a:accent4><a:srgbClr val="17B26A"/></a:accent4><a:accent5><a:srgbClr val="F79009"/></a:accent5><a:accent6><a:srgbClr val="667085"/></a:accent6><a:hlink><a:srgbClr val="1570EF"/></a:hlink><a:folHlink><a:srgbClr val="7A5AF8"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Axoniq"><a:majorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Geist"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Axoniq"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>''')
        for i, s in enumerate(self.slides, 1):
            z.writestr(f'ppt/slides/slide{i}.xml', s.xml())
            r = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
                 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>']
            for rid, typ, tgt in s.rels:
                r.append(f'<Relationship Id="{rid}" Type="{typ}" Target="{tgt}"/>')
            r.append('</Relationships>')
            z.writestr(f'ppt/slides/_rels/slide{i}.xml.rels', ''.join(r))
        for name, data in self.media:
            z.writestr(f'ppt/media/{name}', data)
        z.close()
        data = buf.getvalue()
        if path:
            open(path, 'wb').write(data)
        return data

def b64(data): return base64.b64encode(data).decode()
