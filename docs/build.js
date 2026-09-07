#!/usr/bin/env node
/**
  * Renders CHANGELOG.md into docs/changelog.html, in the same house style
 * as the homepage. CHANGELOG.md stays the single source of truth: the page is
 * generated, never hand-edited.
 *
 *   node docs/build.js
 *
 * The changelog uses a narrow, predictable subset of markdown, so this parses
 * that subset rather than pulling in a dependency:
 *   # Title            the page title, once, first line
 *   ## 1.0.0           a release. Everything until the next ## belongs to it.
 *   paragraphs         blank-line separated, soft-wrapped
 *   - bullets          soft-wrapped, continuation lines indented
 *   **bold** `code` [text](url)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'CHANGELOG.md');
const OUT = path.join(ROOT, 'docs', 'changelog.html');
const VERSION = fs.readFileSync(path.join(ROOT, 'kit', 'VERSION'), 'utf8').trim();

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline markdown, applied after escaping so tags in the source stay inert. */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
}

/**
 * Group soft-wrapped lines into blocks. A bullet runs until the next bullet or
 * a blank line; a paragraph runs until a blank line or a bullet.
 */
function blocks(lines) {
  const out = [];
  let cur = null;
  const flush = () => { if (cur) out.push(cur); cur = null; };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const bullet = line.match(/^\s*-\s+(.*)$/);
    if (bullet) {
      flush();
      cur = { type: 'li', text: bullet[1] };
    } else if (cur) {
      cur.text += ' ' + line.trim();
    } else {
      cur = { type: 'p', text: line.trim() };
    }
  }
  flush();
  return out;
}

function renderBlocks(bs) {
  const html = [];
  let inList = false;
  for (const b of bs) {
    if (b.type === 'li') {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(b.text)}</li>`);
    } else {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<p>${inline(b.text)}</p>`);
    }
  }
  if (inList) html.push('</ul>');
  return html.join('\n');
}

function parse(md) {
  const lines = md.split('\n');
  let title = 'Changelog';
  const intro = [];
  const releases = [];
  let cur = null;

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    if (h1) { title = h1[1].trim(); continue; }
    if (h2) { cur = { version: h2[1].trim(), lines: [] }; releases.push(cur); continue; }
    (cur ? cur.lines : intro).push(line);
  }
  return { title, intro, releases };
}

const { title, intro, releases } = parse(fs.readFileSync(SRC, 'utf8'));

if (!releases.length) {
  console.error('build_changelog: no "## <version>" sections found in CHANGELOG.md');
  process.exit(1);
}

const wordmark = fs.readFileSync(path.join(ROOT, 'kit', 'assets', 'Axoniq - company.svg'), 'utf8')
  .replace(/^<svg[^>]*>/, '<svg viewBox="0 0 1185 300" fill="currentColor" aria-label="Axoniq" role="img">')
  .replace(/ fill="black"/g, '')
  .replace(/\s*fill="none"\s*/g, ' ')
  .trim();

const entries = releases.map((r) => {
  const isCurrent = r.version === VERSION;
  return `
      <article class="rel${isCurrent ? ' current' : ''}">
        <div class="relv">
          <h2 id="v${r.version.replace(/\./g, '-')}">${esc(r.version)}</h2>
          ${isCurrent ? '<span class="tag">Current</span>' : ''}
        </div>
        <div class="relbody">
${renderBlocks(blocks(r.lines))}
        </div>
      </article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Changelog · Rembrandt · Axoniq</title>
<meta name="description" content="Every version of Rembrandt, and what changed.">
<meta name="robots" content="index,follow">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="apple-touch-icon" href="favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..600&family=Geist+Mono:wght@400;500&display=swap">
<style>
:root{
  color-scheme:light;
  --ink:#181D27; --g700:#414651; --g600:#535862; --g500:#717680;
  --line:#E9EAEB; --line-2:#D5D7DA; --surface:#FAFAFA; --white:#FFFFFF;
  --n950:#0C111D;
  --orange:#FF4405; --orange-50:#FFF4ED;
  --blue:#1570EF;
  /* One family for everything on this page. Geist only. */
  --f-disp:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;
  --f-body:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;
  --f-mono:'Geist Mono','SF Mono',Menlo,Consolas,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{background:var(--white);color:var(--g600);font-family:var(--f-body);
  font-size:16.5px;line-height:1.65;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 28px}
a{color:var(--blue);text-decoration:none;border-bottom:1px solid rgba(21,112,239,.3)}
a:hover{border-bottom-color:var(--blue)}
:focus-visible{outline:2px solid var(--blue);outline-offset:3px;border-radius:4px}

.masthead{border-bottom:1px solid var(--line)}
.masthead .wrap{display:flex;align-items:center;justify-content:space-between;
  gap:24px;height:68px}
.brand{display:flex;align-items:center;gap:11px;color:var(--ink)}
.brand svg{display:block;height:19px;width:auto}
.brand .sep{width:1px;height:20px;background:var(--line-2);flex:none}
.brand .prod{font-family:var(--f-mono);font-size:11.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--g500);white-space:nowrap}
.mnav a{font-size:14px;font-weight:500;color:var(--ink);background:var(--white);
  border:0;box-shadow:inset 0 0 0 1px var(--line-2);border-radius:8px;padding:8px 14px}
.mnav a:hover{background:var(--surface)}

.head{padding:72px 0 46px}
.eyebrow{font-family:var(--f-mono);font-size:11.5px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--g500);display:flex;align-items:center;
  gap:9px;margin-bottom:20px}
.eyebrow::before{content:"";width:7px;height:7px;border-radius:999px;
  background:var(--orange);flex:none}
h1{font-family:var(--f-disp);font-size:clamp(38px,5vw,58px);font-weight:500;
  line-height:1.06;letter-spacing:-.026em;color:var(--ink);margin-bottom:20px}
.intro{max-width:70ch}
.intro p{color:var(--g600);margin-bottom:14px}
.intro p:last-child{margin-bottom:0}

.rels{border-top:1px solid var(--line)}
.rel{display:grid;grid-template-columns:180px 1fr;gap:40px;
  padding:44px 0;border-bottom:1px solid var(--line)}
.relv{display:flex;flex-direction:column;align-items:flex-start;gap:9px}
.rel h2{font-family:var(--f-mono);font-size:22px;font-weight:500;
  letter-spacing:-.01em;color:var(--ink);scroll-margin-top:88px}
.tag{font-family:var(--f-mono);font-size:10px;font-weight:500;letter-spacing:.11em;
  text-transform:uppercase;color:#B93815;background:var(--orange-50);
  box-shadow:inset 0 0 0 1px #F9DBAF;border-radius:999px;padding:4px 10px}
.relbody{max-width:76ch}
.relbody p{margin-bottom:16px;color:var(--g600)}
.relbody ul{list-style:none;display:flex;flex-direction:column;gap:13px}
.relbody li{position:relative;padding-left:20px;color:var(--g600)}
.relbody li::before{content:"";position:absolute;left:2px;top:11px;
  width:5px;height:5px;border-radius:999px;background:var(--line-2)}
.relbody strong{color:var(--ink);font-weight:600}
code{font-family:var(--f-mono);font-size:.87em;color:var(--ink);
  background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:1px 6px}

footer{border-top:1px solid var(--line);background:var(--surface)}
footer .wrap{display:flex;flex-wrap:wrap;gap:14px 26px;align-items:center;
  padding:26px 28px;font-family:var(--f-mono);font-size:11px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--g500)}
footer svg{display:block;height:15px;width:auto;color:var(--g600)}
footer .push{margin-left:auto}
footer a{color:var(--g500);border:0}
footer a:hover{color:var(--ink)}

@media (max-width:820px){
  .rel{grid-template-columns:1fr;gap:18px;padding:36px 0}
  .relv{flex-direction:row;align-items:center}
  .head{padding:52px 0 36px}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
</style>
</head>
<body>

<header class="masthead">
  <div class="wrap">
    <div class="brand">
      ${wordmark}
      <span class="sep"></span>
      <span class="prod">Rembrandt</span>
    </div>
    <nav class="mnav"><a href="./">Back to Rembrandt</a></nav>
  </div>
</header>

<div class="wrap">
  <div class="head">
    <div class="eyebrow">Axoniq &middot; Rembrandt</div>
    <h1>${esc(title)}</h1>
    <div class="intro">
${renderBlocks(blocks(intro))}
    </div>
  </div>
</div>

<div class="wrap">
  <div class="rels">
${entries}
  </div>
</div>

<footer>
  <div class="wrap">
    ${wordmark}
    <span>Rembrandt v${esc(VERSION)}</span>
    <span class="push"><a href="https://axoniq.io">axoniq.io</a></span>
  </div>
</footer>

</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

// The homepage is hand-written, so its footer version used to be edited by hand and
// went stale. Stamp it from kit/VERSION here instead, since this runs every release.
const HOME = path.join(ROOT, 'docs', 'index.html');
if (fs.existsSync(HOME)) {
  const before = fs.readFileSync(HOME, 'utf8');
  const after = before.replace(/(<span>Rembrandt v)\d+\.\d+\.\d+(<\/span>)/, `$1${VERSION}$2`);
  if (after !== before) {
    fs.writeFileSync(HOME, after);
    console.log(`build_changelog: stamped docs/index.html footer with ${VERSION}`);
  } else if (!/<span>Rembrandt v\d+\.\d+\.\d+<\/span>/.test(before)) {
    console.error('build_changelog: WARNING, no version span found in docs/index.html');
  }
}
console.log(
  `build_changelog: wrote ${path.relative(ROOT, OUT)} ` +
  `(${releases.length} releases, current ${VERSION})`
);
