// Measured extraction of Rembrandt slides -> JSON scene graph + PNG layers.
// usage: node extract.js master.html outdir "cover/light" "cards/3-up" ...
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const FONT_DIR = process.env.REMBRANDT_FONTS || path.join(__dirname, 'fonts');
const FONT_CSS = `
@font-face{font-family:'Inter Tight';src:url('file://${FONT_DIR}/inter-tight.woff2') format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:'Inter';src:url('file://${FONT_DIR}/inter.woff2') format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:'Geist';src:url('file://${FONT_DIR}/geist.woff2') format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:'Geist Mono';src:url('file://${FONT_DIR}/geist-mono.woff2') format('woff2');font-weight:100 900;font-style:normal}
`;

(async () => {
  const [,, src, outdir, ...wanted] = process.argv;
  fs.mkdirSync(outdir, { recursive: true });
  const html = fs.readFileSync(src, 'utf8');
  // Slides are `section.slide` in document order (the gate enforces that shape). Each is named by its
  // data-name when it has one, else by its position, so a rendered deck and the master both work.
  const sections = [];
  const secRe = /<section\b[^>]*\bclass="[^"]*\bslide\b[^"]*"[^>]*>/g;
  let m, n = 0;
  while ((m = secRe.exec(html))) {
    n += 1;
    const dn = /data-name="([^"]+)"/.exec(m[0]);
    let name = dn ? dn[1] : `slide-${String(n).padStart(2, '0')}`;
    if (sections.some(x => x.name === name)) name = `${name} #${n}`;   // a deck reuses templates; keys stay unique
    sections.push({ name, start: m.index });
  }
  const names = wanted.length ? wanted : sections.map(s => s.name);
  const startOf = (name) => { const s = sections.find(x => x.name === name); return s ? s.start : -1; };
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  // the symbol sprite lives outside the sections
  const spriteM = html.match(/<svg[^>]*(?:style="display:none"|hidden|aria-hidden)[^>]*>[\s\S]*?<\/svg>/);
  const sprite = spriteM ? spriteM[0] : '';
  console.log('sprite bytes', sprite.length);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const result = {};
  for (const name of names) {
    const s = startOf(name);
    if (s < 0) { console.error(`no slide named ${name}`); process.exitCode = 1; continue; }
    const e = html.indexOf('</section>', s) + 10;
    let sec = html.slice(s, e).replace(/<section\b([^>]*)\shidden(?=[\s>])/, '<section$1');
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}${style}
    html,body{margin:0;background:#fff;overflow:hidden;width:1920px;height:1080px} .slide{position:absolute;left:0;top:0}</style></head><body>${sprite}${sec}</body></html>`;
    await page.setContent(doc, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const slug = name.replace(/[\/\s]/g, '_');
    await page.screenshot({ path: path.join(outdir, `${slug}.ref.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    // Export rule (Sep 2026): Google Slides drops letter spacing, so everything set in Inter is exported in Inter Tight
    // with tracking 0. Substitute before measuring so wrapping, widths and baselines are those of the exported font.
    if (process.env.REMBRANDT_TITLES !== 'inter') {
      await page.evaluate(() => {
        document.querySelectorAll('.slide *').forEach(el => {
          const cs = getComputedStyle(el);
          if (/^["']?Inter["']?(,|$)/.test(cs.fontFamily.trim()) && el.childNodes.length) {
            el.style.fontFamily = "'Inter Tight', Inter, sans-serif"; el.style.letterSpacing = '0';
          }
        });
      });
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(outdir, `${slug}.export.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    }

    const scene = await page.evaluate(() => {
      const ASC = { 'Inter': 0.96875, 'Inter Tight': 0.96875, 'Geist': 1.005, 'Geist Mono': 1.005 };
      const out = []; let rasterId = 0;
      const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); if (p.length > 3 && p[3] === 0) return null; return { hex: p.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(), alpha: p.length > 3 ? p[3] : 1 }; };
      const fam = (ff) => { const f = ff.split(',')[0].replace(/['"]/g, '').trim(); return f; };
      const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      const isLeafBlock = (el) => {
        // element whose children are only text / inline elements with text
        let hasText = false;
        for (const n of el.childNodes) {
          if (n.nodeType === 3) { if (n.textContent.trim()) hasText = true; }
          else if (n.nodeType === 1) {
            const d = getComputedStyle(n).display;
            if (/^(svg|img|br)$/i.test(n.tagName)) continue;
            if (!/^inline/.test(d)) return false;
            if (n.querySelector('svg,img')) return false;
            const ns = getComputedStyle(n);
            if (ns.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(ns.borderTopWidth) > 0) return false;
            if (n.textContent.trim()) hasText = true;
          }
        }
        return hasText;
      };
      const walk = (el, depth) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = rectOf(el);
        if (/^(svg|img)$/i.test(el.tagName)) {
          out.push({ type: 'raster', id: `r${rasterId++}`, rect: r, tag: el.tagName, el });
          return;
        }
        // backgrounds
        const bg = rgb(cs.backgroundColor);
        const hasBgImage = cs.backgroundImage !== 'none';
        const bw = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs[`border${s}Width`]) || 0);
        const bcol = rgb(cs.borderTopColor);
        const radius = parseFloat(cs.borderTopLeftRadius) || 0;
        if (hasBgImage) {
          out.push({ type: 'raster', id: `r${rasterId++}`, rect: r, tag: 'BG', el, hideChildren: true });
        } else if (bg && el.tagName !== 'BODY' && !el.classList.contains('slide')) {
          const uniform = bw.every(v => v === bw[0]);
          out.push({ type: 'rect', rect: r, fill: bg.hex, alpha: bg.alpha, radius, line: uniform && bw[0] && bcol ? bcol.hex : null, line_px: uniform && bcol ? bw[0] : 0 });
          if (!uniform) sides(el, r, bw, cs);
        } else if (bw.some(v => v > 0)) {
          const uniform = bw.every(v => v === bw[0]);
          if (uniform) { if (bcol) out.push({ type: 'rect', rect: r, fill: null, radius, line: bcol.hex, line_px: bw[0] }); }
          else sides(el, r, bw, cs);
        }
        // pseudo elements with background (spark lines etc.)
        for (const ps of ['::before', '::after']) {
          const p = getComputedStyle(el, ps);
          if (p.content === 'none' || p.display === 'none') continue;
          if (p.backgroundImage === 'none' && !rgb(p.backgroundColor)) continue;
          if (p.position !== 'absolute') { out.push({ type: 'warn', msg: `pseudo ${ps} on ${el.className} not absolute` }); continue; }
          const pr = { x: r.x + bw[3] + (p.left !== 'auto' ? parseFloat(p.left) : NaN), y: r.y + bw[0] + (p.top !== 'auto' ? parseFloat(p.top) : NaN), w: parseFloat(p.width), h: parseFloat(p.height) };
          if (isNaN(pr.x) && p.right !== 'auto') pr.x = r.x + r.w - bw[1] - parseFloat(p.right) - pr.w;
          if (isNaN(pr.y) && p.bottom !== 'auto') pr.y = r.y + r.h - bw[2] - parseFloat(p.bottom) - pr.h;
          const inside = hasBgImage && pr.x >= r.x - 0.5 && pr.y >= r.y - 0.5 && pr.x + pr.w <= r.x + r.w + 0.5 && pr.y + pr.h <= r.y + r.h + 0.5;
          if (p.backgroundImage !== 'none') { if (!inside) out.push({ type: 'raster', id: `r${rasterId++}`, rect: pr, tag: 'PSEUDO', el, hideChildren: true, pseudo: ps }); }
          else { const c = rgb(p.backgroundColor); out.push({ type: 'rect', rect: pr, fill: c.hex, alpha: c.alpha, radius: parseFloat(p.borderTopLeftRadius) || 0, line: null, line_px: 0 }); }
        }
        if (isLeafBlock(el)) { text(el, cs, r, false); return; }
        if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) text(el, cs, r, true);
        for (const c of el.children) walk(c, depth + 1);
      };
      const sides = (el, r, bw, cs) => {
        const names = ['Top', 'Right', 'Bottom', 'Left'];
        bw.forEach((w, i) => {
          if (!w) return; const c = rgb(cs[`border${names[i]}Color`]); if (!c) return;
          const rr = i === 0 ? { x: r.x, y: r.y, w: r.w, h: w } : i === 2 ? { x: r.x, y: r.y + r.h - w, w: r.w, h: w } : i === 3 ? { x: r.x, y: r.y, w, h: r.h } : { x: r.x + r.w - w, y: r.y, w, h: r.h };
          out.push({ type: 'rect', rect: rr, fill: c.hex, alpha: c.alpha, radius: 0, line: null, line_px: 0 });
        });
      };
      const text = (el, cs, r, directOnly) => {
        const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight), padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
        const bLeft = parseFloat(cs.borderLeftWidth) || 0, bRight = parseFloat(cs.borderRightWidth) || 0;
        const content = { x: r.x + bLeft + padL, y: r.y + padT, w: r.w - bLeft - bRight - padL - padR, h: r.h - padT - padB };
        // Runs are split at RENDERED line boundaries, measured word by word. The exporter then replays
        // those lines, so an explicit <br>, a balanced wrap and an ordinary soft wrap are one mechanism
        // and none of them can be lost or re-flowed differently downstream.
        const runs = []; const lineMeta = new Map(); let pendingSpace = false;
        const keyOf = (top) => Math.round(top * 2) / 2;
        const visit = (node, style) => {
          for (const n of node.childNodes) {
            if (n.nodeType === 3) {
              const orig = n.textContent;
              if (!orig) continue;
              const words = [...orig.matchAll(/\S+/g)];
              if (!words.length) { if (runs.length) pendingSpace = true; continue; }
              const size = parseFloat(style.fontSize), family = fam(style.fontFamily);
              const asc = ASC[family] || 0.96, col = rgb(style.color);
              const upper = style.textTransform === 'uppercase';
              const rg = document.createRange();
              let group = null;
              const flush = () => {
                if (!group) return;
                let t = orig.slice(group.s, group.e).replace(/\s+/g, ' ');
                if (upper) t = t.toUpperCase();
                if (pendingSpace) {
                  if (runs.length && runs[runs.length - 1].key === group.key) t = ' ' + t;
                  pendingSpace = false;
                }
                runs.push({ text: t, key: group.key, family, size, weight: parseFloat(style.fontWeight),
                  italic: style.fontStyle === 'italic', color: col ? col.hex : '000000',
                  ls: style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) / size });
                group = null;
              };
              for (const w of words) {
                rg.setStart(n, w.index); rg.setEnd(n, w.index + w[0].length);
                const q = rg.getBoundingClientRect();
                if (!q.width && !q.height) continue;
                const key = keyOf(q.top);
                const m = lineMeta.get(key) || { x0: 1e9, x1: -1e9, baseline: -1e9 };
                m.x0 = Math.min(m.x0, q.left); m.x1 = Math.max(m.x1, q.right);
                m.baseline = Math.max(m.baseline, q.top + asc * size);
                lineMeta.set(key, m);
                if (group && group.key === key) group.e = w.index + w[0].length;
                else { flush(); group = { key, s: w.index, e: w.index + w[0].length }; }
              }
              flush();
              if (/\s$/.test(orig)) pendingSpace = true;
            } else if (n.nodeType === 1 && !/^(svg|img)$/i.test(n.tagName)) {
              if (/^br$/i.test(n.tagName)) { pendingSpace = false; continue; }
              if (directOnly && node === el) continue;
              const st = getComputedStyle(n);
              if (st.display === 'none' || st.visibility === 'hidden') continue;
              visit(n, st);
            }
          }
        };
        visit(el, cs);
        if (!runs.length) return;
        const keys = [...lineMeta.keys()].sort((a, b) => a - b);
        const idx = new Map(keys.map((k, i) => [k, i]));
        const lines = keys.map(k => { const m = lineMeta.get(k); return { x0: m.x0, x1: m.x1, w: m.x1 - m.x0, baseline: m.baseline, text: '' }; });
        for (const run of runs) { run.line = idx.get(run.key); lines[run.line].text += run.text; delete run.key; }
        for (const L of lines) L.text = L.text.trim();
        out.push({ type: 'text', rect: r, content, runs, lines, align: cs.textAlign,
          baselines: lines.map(L => L.baseline),
          textX0: Math.min(...lines.map(L => L.x0)), textX1: Math.max(...lines.map(L => L.x1)),
          maxLineW: Math.max(...lines.map(L => L.w)),
          lineHeight: cs.lineHeight === 'normal' ? 1.2 * parseFloat(cs.fontSize) : parseFloat(cs.lineHeight),
          size: parseFloat(cs.fontSize), tag: el.tagName, cls: el.className });
      };
      walk(document.querySelector('.slide'), 0);
      // expose raster elements for screenshotting
      window.__els = {}; out.filter(o => o.type === 'raster').forEach(o => { window.__els[o.id] = o.el; });
      return out.map(o => { const { el, ...rest } = o; return rest; });
    });

    // rasterize layers
    const rasters = scene.filter(o => o.type === 'raster');
    for (const o of rasters) {
      const clip = { x: Math.max(0, o.rect.x), y: Math.max(0, o.rect.y), width: Math.min(1920, o.rect.w), height: Math.min(1080, o.rect.h) };
      if (clip.width < 1 || clip.height < 1) { o.skip = true; continue; }
      // isolate the target: everything in the slide hidden, then the target (and, for svg/img, its subtree) shown again
      await page.evaluate(({ id, subtree }) => { const sl = document.querySelector('.slide'); sl.querySelectorAll('*').forEach(c => { c.__v = c.style.visibility; c.style.visibility = 'hidden'; });
        const el = window.__els[id]; let e = el; while (e && e !== sl) { e.style.visibility = 'visible'; e = e.parentElement; }
        if (subtree) el.querySelectorAll('*').forEach(c => c.style.visibility = 'visible');
        if (!subtree) { /* ancestors made visible again would paint their own backgrounds; hide those by making them transparent */ e = el.parentElement; while (e && e !== sl) { e.__bg = e.style.background; e.style.background = 'transparent'; e.__bs = e.style.borderColor; e.style.borderColor = 'transparent'; e = e.parentElement; } }
      }, { id: o.id, subtree: /^(svg|img)$/i.test(o.tag) });
      const isImg = /^(svg|img)$/i.test(o.tag);
      if (isImg) await page.evaluate(() => { document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent'; const sl = document.querySelector('.slide'); sl.__bg = sl.style.background; sl.style.background = 'transparent'; });
      await page.screenshot({ path: path.join(outdir, `${slug}.${o.id}.png`), clip, omitBackground: true, scale: (clip.width * clip.height > 400000 ? 'css' : 'device') });
      await page.evaluate(() => { document.body.style.background = ''; document.documentElement.style.background = ''; const sl = document.querySelector('.slide'); sl.style.background = sl.__bg || '';
        sl.querySelectorAll('*').forEach(c => { c.style.visibility = c.__v || ''; if (c.__bg !== undefined) { c.style.background = c.__bg; c.__bg = undefined; } if (c.__bs !== undefined) { c.style.borderColor = c.__bs; c.__bs = undefined; } }); });
      o.png = `${slug}.${o.id}.png`;
      if (o.tag === 'BG' && clip.width * clip.height > 500000) {
        const sharp = require('sharp');
        const jpg = `${slug}.${o.id}.jpg`;
        await sharp(path.join(outdir, o.png)).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toFile(path.join(outdir, jpg));
        fs.unlinkSync(path.join(outdir, o.png)); o.png = jpg;
      }
    }
    result[name] = scene;
    console.log(name, 'items', scene.length, 'text', scene.filter(o => o.type === 'text').length, 'rects', scene.filter(o => o.type === 'rect').length, 'rasters', rasters.length, scene.filter(o => o.type === 'warn').map(o => o.msg));
  }
  fs.writeFileSync(path.join(outdir, 'scene.json'), JSON.stringify(result, null, 1));
  await browser.close();
})();
