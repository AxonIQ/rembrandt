#!/usr/bin/env node
/**
 * Renders every master template at the three sizes into docs/sizes/img, for docs/sizes/index.html.
 *
 *   node tools/build-sizes.js
 *
 * Compact and Regular come from kit/master.html with <html data-size> set; Stage comes from
 * kit/stage.html (run tools/build-stage.py first if the master changed). Each slide is rendered at
 * 1920 x 1080 in the deck's own viewer and saved as a 1280 x 720 JPEG.
 *
 * The page's template list is hand-written (it carries a note per template), so this script fails
 * when the master's templates and the page's list disagree, rather than publishing a mismatch.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const KIT = path.join(ROOT, 'skills', 'rembrandt', 'kit');
const OUT = path.join(ROOT, 'docs', 'sizes');
const IMG = path.join(OUT, 'img');

const master = fs.readFileSync(path.join(KIT, 'master.html'), 'utf8');
const TAG = '<html lang="en" data-size="regular">';
if (!master.includes(TAG)) { console.error(`build-sizes: FAIL, master.html no longer starts with ${TAG}`); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-sizes-'));
const decks = {
  compact: path.join(tmp, 'compact.html'),
  regular: path.join(KIT, 'master.html'),
  stage: path.join(KIT, 'stage.html'),
};
fs.writeFileSync(decks.compact, master.replace(TAG, '<html lang="en" data-size="compact">'));

const pageList = [...fs.readFileSync(path.join(OUT, 'index.html'), 'utf8').matchAll(/^ \['([a-z0-9/-]+)','/gm)].map(m => m[1]);

// Check the page's list against the master before rendering anything, so a mismatch leaves the
// published images untouched.
const masterNames = [...master.matchAll(/<section class="slide[^"]*" data-name="([^"]+)"/g)].map(m => m[1]);
if (JSON.stringify(masterNames) !== JSON.stringify(pageList)) {
  console.error('build-sizes: FAIL, docs/sizes/index.html lists different templates from the master. Update its list:');
  console.error('  master: ' + masterNames.join(', '));
  process.exit(1);
}

(async () => {
  // Render into a scratch folder and swap it in only when every size rendered, so a failed run never
  // leaves a half-updated set, and images of templates that no longer exist go away.
  const fresh = path.join(tmp, 'img');
  fs.mkdirSync(fresh, { recursive: true });
  const browser = await chromium.launch();
  // 1992 x 1188 makes the viewer fit the slide at exactly scale 1 (72px side and 108px chrome margins); a 2/3 device scale writes 1280 x 720 pixels.
  const page = await browser.newPage({ viewport: { width: 1992, height: 1188 }, deviceScaleFactor: 2 / 3 });
  for (const [size, file] of Object.entries(decks)) {
    await page.goto('file://' + file);
    await page.addStyleTag({ content: '.narrow,#hud{display:none!important}' });   // viewer chrome, not the slide
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const these = await page.evaluate(() => [...document.querySelectorAll('#scaler > section.slide')].map(s => s.dataset.name));
    if (JSON.stringify(these) !== JSON.stringify(masterNames)) {
      console.error(`build-sizes: FAIL, ${size} has different templates from the master; run tools/build-stage.py`);
      await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1);
    }
    for (let i = 0; i < these.length; i++) {
      await page.evaluate(n => window.__go(n), i + 1);
      await page.waitForTimeout(120);
      const clip = await page.evaluate(() => { const r = document.getElementById('frame').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      await page.screenshot({ path: path.join(fresh, `${size}-${String(i + 1).padStart(2, '0')}.jpg`), clip, type: 'jpeg', quality: 84 });
    }
    console.log(`build-sizes: ${size}, ${these.length} slides`);
  }
  await browser.close();
  fs.rmSync(IMG, { recursive: true, force: true });
  fs.cpSync(fresh, IMG, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`build-sizes: wrote ${masterNames.length * 3} images to docs/sizes/img`);
})();
