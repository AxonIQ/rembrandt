#!/usr/bin/env node
// Rembrandt gate. Usage: node kit/verify.js "My Deck - Rembrandt v1.0.html"
//
// Five checks, one command, one browser. Cohere runs this and it must print PASS.
// Every check fails closed: an empty or unrecognisable deck is a FAIL, never a quiet pass.
//
//   shell   provenance. The deck was copied from kit/master.html, not retyped from memory.
//           A retyped shell looks plausible and fails everything quietly, and the style and
//           colour checks can pass it by finding nothing to measure. So this runs first.
//   styles  every text node is exactly one of the 18 styles. SVG chart labels exempt.
//   colour  accents use the 500. A 600/700 only on a coloured surface. No tint as text.
//   layout  geometry, which no style check can see: collisions, out-of-frame, dead bands.
//   house   em dashes, emoji, company spelling, padded numbers, placeholders, filename.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const STYLES = [
  ['Inter',122,470,'Display'],['Inter',88,500,'Display sm'],['Inter',54,530,'H1'],['Inter',40,540,'H2'],['Inter',33,550,'H2 compact'],
  ['Inter',96,560,'Stat'],['Inter',58,560,'Stat sm'],['Inter',220,560,'Stat xl'],['Geist Mono',96,400,'Numeral'],
  ['Geist',25,400,'Lede / Subtitle'],['Geist',21,400,'Body 1'],['Geist',21,560,'Body 1 strong'],['Geist',17.5,400,'Body 1 compact'],
  ['Geist',17,400,'Caption'],['Geist Mono',17,400,'Code'],['Geist Mono',15,500,'Label'],['Geist Mono',14,500,'Meta'],['Geist Mono',12.5,400,'Foot'],
];
const REQUIRED_CLASSES = ['body1','body1s','body1--c','title-sm','title-sm--c','num','sub','img-cap','idx-num','idx-name','hd-meta','foot','label','meta','display'];
const BANNED_CLASSES   = ['body-1','body-1-strong','body-1-compact','subtitle','h2-compact','stat-sm','caption','kicker','hud-mid'];
const LEFT = 64, RIGHT = 1856, BOTTOM = 1012, ROW = 86;
const EXEMPT = /cover|index|divider|closing|statement|quote|culture|image|logos|spec|chapter|numbers\/hero/;

const SEL = '#scaler > .slide, section.slide';

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) { console.error('usage: node kit/verify.js <deck.html>'); process.exit(2); }
  const here = __dirname;
  const results = [];

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(file));
  await p.waitForTimeout(600);

  /* ---------------------------------------------------------------- shell */
  {
    const r = await p.evaluate(({ REQUIRED_CLASSES, BANNED_CLASSES }) => {
      let sel = '';
      for (const sh of document.styleSheets) { try { for (const rule of sh.cssRules) if (rule.selectorText) sel += rule.selectorText + ',' } catch {} }
      const hasClass = c => new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])').test(sel);
      const frame = document.getElementById('frame');
      const fb = frame ? frame.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        slides:         document.querySelectorAll('#scaler > section.slide').length,
        slidesAnyTag:   document.querySelectorAll('#scaler > .slide').length,
        lockup:         !!document.querySelector('symbol#lockup'),
        mark:           !!document.querySelector('symbol#mk'),
        textLogo:       !!document.querySelector('.logo svg text'),
        goHook:         typeof window.__go === 'function',
        countHook:      typeof window.__count === 'number',
        frameSized:     Math.round(fb.width) > 0 && Math.round(fb.height) > 0,
        frameBox:       Math.round(fb.width) + 'x' + Math.round(fb.height),
        missingClasses: REQUIRED_CLASSES.filter(c => !hasClass(c)),
        inventedClasses: BANNED_CLASSES.filter(c => hasClass(c)),
        icons:          document.querySelectorAll('.ico use, .ico svg').length,
        navzoneInStage: !!document.querySelector('#stage > .navzone'),
        editor:         typeof (window.__rbEditor || {}).setMode === 'function',
        editBtn:        !!document.getElementById('btnEdit'),
        fullBtn:        !!document.getElementById('btnFull'),
        metaGroup:      !!document.querySelector('#hud .hud-meta #counter') && !!document.querySelector('#hud .hud-meta #deckname'),
        darkChrome:     getComputedStyle(document.body).backgroundColor === 'rgb(8, 10, 15)',
      };
    }, { REQUIRED_CLASSES, BANNED_CLASSES });
    const f = [];
    if (!r.slides) f.push(`slides are not \`section.slide\` inside \`#scaler\` (found ${r.slidesAnyTag} with class .slide). Copy the master; do not rebuild it.`);
    if (!r.lockup || !r.mark) f.push(`the brand sprite is missing (symbol#lockup ${r.lockup?'ok':'absent'}, symbol#mk ${r.mark?'ok':'absent'}). Copy the <svg><defs> block from the master.`);
    if (r.textLogo) f.push('the logo is <svg><text>, a typed stand-in. Use <use href="#lockup"/>.');
    if (!r.goHook || !r.countHook) f.push('the viewer contract is gone (window.__go / window.__count). Copy the master\'s script block verbatim.');
    if (!r.frameSized) f.push(`#frame is ${r.frameBox}: fit() never sized it, so the stage is collapsed. Copy the master's viewer.`);
    if (r.missingClasses.length) f.push('text-style classes absent from the CSS: .' + r.missingClasses.join(', .'));
    if (r.inventedClasses.length) f.push('invented or stale classes present: .' + r.inventedClasses.join(', .') + ' (a retyped or out-of-date shell)');
    if (!r.navzoneInStage) f.push('.navzone is not inside #stage, so the click zones cover the whole page.');
    if (!r.editor) f.push('the editor is gone (window.__rbEditor). It lives in the master; copying the master keeps it.');
    if (!r.editBtn || !r.fullBtn) f.push(`the hud is out of date (#btnEdit ${r.editBtn?'ok':'absent'}, #btnFull ${r.fullBtn?'ok':'absent'}).`);
    if (!r.metaGroup) f.push('the hud meta group is missing: #counter, #deckname, #slidename inside .hud-meta, so the counter never shifts.');
    if (!r.darkChrome) f.push('the presenter chrome is not dark. Copy a current master rather than an older light shell.');
    results.push({ name: 'shell', ok: !f.length,
      out: f.length ? `SHELL: ${f.length} problem${f.length>1?"s":""}\n  - ` + f.join('\n  - ')
                    : `SHELL: pass (${r.slides} slides, sprite present, viewer and editor intact, ${r.icons} icons)` });
  }

  /* --------------------------------------------------------------- styles */
  {
    const r = await p.evaluate(({ STYLES, SEL }) => {
      const fam = f => { f = f.split(',')[0].replace(/["']/g,'').trim();
        if (/mono/i.test(f)) return 'Geist Mono'; if (/^inter/i.test(f)) return 'Inter'; if (/^geist/i.test(f)) return 'Geist'; return f; };
      const key = (f,s,w) => `${f}|${s}|${w}`;
      const allowed = new Set(STYLES.map(([f,s,w]) => key(f,s,w)));
      const seen = new Map();
      [...document.querySelectorAll(SEL)].forEach((sl, i) => {
        sl.hidden = false;
        sl.querySelectorAll('*').forEach(el => {
          if (el.closest('svg')) return;
          const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
          if (!txt) return;
          const cs = getComputedStyle(el);
          const k = key(fam(cs.fontFamily), Math.round(parseFloat(cs.fontSize)*2)/2, parseInt(cs.fontWeight));
          if (allowed.has(k)) return;
          const id = k + '|' + (el.className || el.tagName);
          if (!seen.has(id)) seen.set(id, { slide: i+1, style: k,
            el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
            text: txt.slice(0,40), n: 0 });
          seen.get(id).n++;
        });
        sl.hidden = true;
      });
      return { rows: [...seen.values()], slides: document.querySelectorAll(SEL).length };
    }, { STYLES, SEL });
    let out;
    if (!r.slides) out = 'STYLES: FAIL, no slides found. The deck does not use the master shell.';
    else if (!r.rows.length) out = 'STYLES: pass, every text node is exactly one style';
    else out = `STYLES: ${r.rows.length} violating combinations\n` +
      r.rows.map(x => `  #${String(x.slide).padStart(2,'0')} ${x.style.padEnd(24)} x${x.n}  ${x.el}  "${x.text}"`).join('\n');
    results.push({ name: 'styles', ok: !!r.slides && !r.rows.length, out });
  }

  /* --------------------------------------------------------------- colour */
  {
    const r = await p.evaluate((SEL) => {
      const hex2rgb = h => { h = h.trim().replace('#',''); if (h.length===3) h = [...h].map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(','); };
      const rgb = v => { const m = v.match(/\d+/g); return m ? m.slice(0,3).join(',') : null; };
      const alpha = v => { const m = v.match(/^rgba\([^)]*?([\d.]+)\)$/); return m ? parseFloat(m[1]) : 1; };
      const cs0 = getComputedStyle(document.documentElement);
      const names = new Set();
      for (const sheet of document.styleSheets) { let rules; try { rules = sheet.cssRules } catch { continue }
        for (const rl of rules||[]) if (rl.style) for (const prop of rl.style) if (prop.startsWith('--')) names.add(prop); }
      const tok = {};
      for (const n of names) { const v = cs0.getPropertyValue(n).trim(); if (/^#[0-9a-f]{3,8}$/i.test(v)) tok[n] = hex2rgb(v); }
      const FIVE = {}, DEEP = {}, SURF = {}, NEUTRAL = new Set();
      for (const [n,v] of Object.entries(tok)) {
        if (/^--n\d+$/.test(n) || n === '--ink' || /^--ch-/.test(n)) { NEUTRAL.add(v); continue }
        const m = n.match(/^--([a-z]+)(?:-(\d+))?$/);
        if (!m) continue;
        const step = m[2] ? +m[2] : 500;
        if (step === 500) FIVE[v] = n; else if (step >= 600) DEEP[v] = n; else SURF[v] = n;
      }
      const onColoured = el => {
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (alpha(cs.backgroundColor) > 0.05) {
            const k = rgb(cs.backgroundColor); const [r0,g0,b0] = k.split(',').map(Number);
            if (r0 + g0 + b0 < 200) return true;
            if (SURF[k] || FIVE[k] || DEEP[k]) return true;
          }
          if (n.matches && n.matches('.slide')) break;
        }
        return false;
      };
      const out = new Map();
      const note = (i, kind, token, el, text) => {
        const id = kind+'|'+token+'|'+(el.className||el.tagName);
        if (!out.has(id)) out.set(id, { slide:i, kind, token,
          el: el.tagName.toLowerCase() + (el.className ? '.'+String(el.className).split(' ').join('.') : ''),
          text: (text||'(mark)').slice(0,34), n:0 });
        out.get(id).n++;
      };
      [...document.querySelectorAll(SEL)].forEach((sl,i) => {
        sl.hidden = false;
        sl.querySelectorAll('*').forEach(el => {
          const text = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
          if (!text && el.tagName !== 'svg') return;
          const cs = getComputedStyle(el);
          if (alpha(cs.color) < 0.05) return;
          const k = rgb(cs.color);
          if (NEUTRAL.has(k) || k === '255,255,255') return;
          if (DEEP[k] && !onColoured(el)) note(i+1, 'deep-on-plain', DEEP[k], el, text);
          else if (SURF[k]) note(i+1, 'surface-as-text', SURF[k], el, text);
          else if (!FIVE[k] && !DEEP[k]) note(i+1, 'not-a-token', 'rgb('+k+')', el, text);
        });
        sl.hidden = true;
      });
      return { rows:[...out.values()], slides: document.querySelectorAll(SEL).length,
               palette:{ five:Object.values(FIVE).length, deep:Object.values(DEEP).length } };
    }, SEL);
    let out;
    if (!r.slides) out = 'COLOUR: FAIL, no slides found. The deck does not use the master shell.';
    else if (!r.rows.length) out = `COLOUR: pass (${r.palette.five} 500-tokens, ${r.palette.deep} deep tokens seen)`;
    else out = `COLOUR: ${r.rows.length} off-rule uses\n` +
      r.rows.map(x => `  #${String(x.slide).padStart(2,'0')} ${x.kind.padEnd(16)} ${x.token.padEnd(14)} x${x.n}  ${x.el}  "${x.text}"`).join('\n') +
      '\n  deep-on-plain   = a 600/700 on a plain ground; use the 500' +
      '\n  surface-as-text = a 25/50/100/200 used as text; those are surfaces' +
      '\n  not-a-token     = a colour outside the palette';
    results.push({ name: 'colour', ok: !!r.slides && !r.rows.length, out });
  }

  /* --------------------------------------------------------------- layout */
  {
    const r = await p.evaluate(({ LEFT, RIGHT, BOTTOM, SEL }) => {
      const slides = [...document.querySelectorAll(SEL)];
      if (!slides.length) return { noSlides: true };
      const out = [];
      slides.forEach((sl, i) => {
        const was = sl.hidden, wasD = sl.style.display; sl.hidden = false; sl.style.display = 'block';
        const sr = sl.getBoundingClientRect(); const sc = sr.width / 1920 || 1;
        const norm = r0 => ({ x:(r0.left-sr.left)/sc, y:(r0.top-sr.top)/sc, w:r0.width/sc, h:r0.height/sc,
                              r:(r0.right-sr.left)/sc, b:(r0.bottom-sr.top)/sc });
        const leaves = [...sl.querySelectorAll('*')].filter(el => {
          if (el.closest('svg')) return false;
          if (getComputedStyle(el).visibility === 'hidden') return false;
          return [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        });
        const items = [];
        for (const el of leaves) for (const r0 of el.getClientRects()) {
          if (r0.width < 2 || r0.height < 2) continue;
          items.push({ el, box: norm(r0), text: el.textContent.trim().slice(0,30) });
        }
        const name = sl.dataset.name || '';
        const seen = new Set();
        const surfaced = el => { const cs = getComputedStyle(el);
          return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 || cs.position === 'absolute'; };
        for (let a = 0; a < items.length; a++) for (let c = a+1; c < items.length; c++) {
          const A = items[a], B = items[c];
          if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
          if (surfaced(A.el) || surfaced(B.el)) continue;
          const ix = Math.min(A.box.r,B.box.r) - Math.max(A.box.x,B.box.x);
          const iy = Math.min(A.box.b,B.box.b) - Math.max(A.box.y,B.box.y);
          if (ix <= 1 || iy <= 1) continue;
          const area = ix * iy, small = Math.min(A.box.w*A.box.h, B.box.w*B.box.h);
          if (area < 120 || area / small < 0.15) continue;
          const key = A.text + '|' + B.text;
          if (seen.has(key)) continue; seen.add(key);
          out.push({ slide:i+1, name, kind:'collision', detail:`"${A.text}" overlaps "${B.text}" by ${Math.round(area)}px2` });
        }
        const body = sl.querySelector('.body');
        for (const it of items) {
          const { x, r: rr, b: bb } = it.box; const bad = [];
          if (x < LEFT - 2) bad.push(`left ${Math.round(x)}`);
          if (rr > RIGHT + 2) bad.push(`right ${Math.round(rr)}`);
          if (bb > 1080) bad.push(`below canvas ${Math.round(bb)}`);
          else if (body && bb > BOTTOM + 4 && !it.el.closest('header')) bad.push(`past content bottom ${Math.round(bb)}`);
          if (bad.length) out.push({ slide:i+1, name, kind:'out-of-frame', detail:`"${it.text}" ${bad.join(', ')}` });
        }
        let maxB = 0;
        if (body) body.querySelectorAll('*').forEach(el => {
          const cs = getComputedStyle(el);
          const hasTxt = [...el.childNodes].some(n => n.nodeType===3 && n.textContent.trim());
          const vis = hasTxt || /^(IMG|SVG|TABLE|HR)$/.test(el.tagName) || cs.backgroundImage !== 'none'
                   || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !el.children.length)
                   || (parseFloat(cs.borderTopWidth) > 0 && !el.children.length);
          if (!vis) return;
          const r0 = el.getBoundingClientRect();
          if (r0.width > 0 && r0.height > 0) maxB = Math.max(maxB, (r0.bottom - sr.top)/sc);
        });
        out.push({ slide:i+1, name, kind:'_bottom', value: Math.round(maxB) });
        sl.hidden = was; sl.style.display = wasD;
      });
      return { rows: out };
    }, { LEFT, RIGHT, BOTTOM, SEL });
    let out, ok;
    if (r.noSlides) { out = 'LAYOUT: FAIL, no slides found. The deck does not use the master shell.'; ok = false; }
    else {
      const rows = r.rows.filter(x => x.kind !== '_bottom');
      for (const x of r.rows.filter(y => y.kind === '_bottom')) {
        if (EXEMPT.test(x.name || '')) continue;
        if (x.value === 0) { rows.push({ slide:x.slide, name:x.name, kind:'empty', detail:'no content in .body' }); continue; }
        if (x.value < BOTTOM - ROW) rows.push({ slide:x.slide, name:x.name, kind:'dead-band',
          detail:`content stops at ${x.value}, ${BOTTOM - x.value}px short of ${BOTTOM}` });
      }
      rows.sort((a,c) => a.slide - c.slide);
      ok = !rows.length;
      out = ok ? 'LAYOUT: pass, nothing collides, overflows or floats'
               : `LAYOUT: ${rows.length} problems\n` + rows.map(x =>
                 `  #${String(x.slide).padStart(2,'0')} ${x.kind.padEnd(13)} ${(x.name||'').padEnd(20)} ${x.detail}`).join('\n');
    }
    results.push({ name: 'layout', ok, out });
  }

  /* ----------------------------------------------------------- deck shape */
  // Read before the browser closes. Everything here is measured off the finished deck,
  // so nothing about the payload depends on the agent remembering to report it.
  const shape = await p.evaluate((SEL) => {
    const slides = [...document.querySelectorAll(SEL)];
    const chapters = new Set();
    for (const sl of slides) {
      const m = sl.querySelector('.hd-meta');
      if (!m) continue;                                   // covers and dividers carry no header
      const chapter = m.textContent.split('\u00b7')[0].trim();
      if (chapter) chapters.add(chapter);
    }
    return {
      slides:   slides.length,
      chapters: chapters.size,
      dense:    slides.filter(sl => sl.querySelector('.body1--c, .title-sm--c')).length,
    };
  }, SEL);

  await b.close();

  /* ---------------------------------------------------------------- house */
  {
    const html = fs.readFileSync(file, 'utf8');
    const body = html.slice(html.indexOf('<div id="scaler">'));
    const noData = body.replace(/data:[^"')]+/g, '');
    const h = [];
    const em = (noData.match(/—/g) || []).length;
    if (em) h.push(`${em} em dash${em>1?'es':''} in the copy`);
    const emoji = [...new Set(noData.match(/[←-⇿☀-➿️\u{1F000}-\u{1FAFF}]/gu) || [])].filter(c => !'←→↑↓'.includes(c));
    if (emoji.length) h.push(`emoji or dingbats used as content: ${emoji.join(' ')}`);
    if (/AxonIQ/.test(html)) h.push('company spelled AxonIQ');
    const nums = [...body.matchAll(/&middot; #(\d+)</g)].map(m => m[1]);
    if (nums.some(n => n.length < 2)) h.push(`header slide numbers are not zero-padded (${nums.filter(n=>n.length<2).map(n=>'#'+n).join(', ')})`);
    const ph = noData.match(/\b(lorem|ipsum|vestibulum|TODO|\[insert)\b/i);
    if (ph) h.push(`placeholder text: ${ph[0]}`);

    const version = fs.readFileSync(path.join(here, 'VERSION'), 'utf8').trim();
    const manifest = path.join(here, '..', '.claude-plugin', 'plugin.json');
    if (fs.existsSync(manifest)) {
      const pv = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
      if (pv !== version) h.push(`kit/VERSION says ${version} but plugin.json says ${pv}`);
    }
    const name = path.basename(file);
    const isKitFile = path.dirname(path.resolve(file)) === path.resolve(here);   // the master itself carries no delivery name
    if (!isKitFile) {
      const m = name.match(/^(.+) - Rembrandt v(\d+\.\d+)\.html$/);
      if (!m) h.push('filename is not "<Presentation name> - Rembrandt v<version>.html"');
      else {
        const want = version.split('.').slice(0,2).join('.');
        if (m[2] !== want) h.push(`filename says v${m[2]}, kit/VERSION says ${want}`);
      }
    }
    results.push({ name:'house', ok: !h.length,
      out: h.length ? `HOUSE: ${h.length} problem${h.length>1?"s":""}\n  - ` + h.join('\n  - ') : 'HOUSE: pass' });
  }

  for (const r of results) console.log(r.out + '\n');
  const failed = results.filter(r => !r.ok);
  if (!failed.length) console.log('VERIFY: PASS. Shell, styles, colour, layout and house rules all clean.');
  else console.log(`VERIFY: FAIL. ${failed.map(f => f.name).join(', ')}. Fix and run again; nothing ships on a FAIL.`);

  /* ------------------------------------------------------------- telemetry */
  // Only on PASS: a deck that failed was never delivered. Never throws, never changes
  // the exit code. See kit/telemetry.js; REMBRANDT_TELEMETRY=0 turns it off.
  if (!failed.length) {
    let status;
    try {
      const version = fs.readFileSync(path.join(here, 'VERSION'), 'utf8').trim();
      const base = path.basename(file);
      const deck = (base.match(/^(.+) - Rembrandt v\d+\.\d+\.html$/) || [])[1] || path.basename(base, '.html');
      status = await require('./telemetry.js').report({ file, deck, version, ...shape });
    } catch (err) {
      status = 'not recorded, ' + ((err && err.message) || 'unknown error');
    }
    console.log(`TELEMETRY: ${status}`);
  }

  process.exit(failed.length ? 1 : 0);
})();
