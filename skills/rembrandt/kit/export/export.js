#!/usr/bin/env node
// Rembrandt export: HTML deck -> verified PPTX -> Google Slides link (or the file, when it cannot deliver).
//
//   node kit/export/export.js "Bi-Weekly ONE House - Rembrandt v2.0.html"
//
// Runs after Cohere has passed. Four stages, each one fails closed:
//   1. extract   measure every slide in headless Chromium (extract.js)
//   2. build     write the PPTX against Google Slides' text model (build.py), which runs verify.py
//   3. deliver   upload the PPTX straight to the runner's own Google Drive, which converts it to
//                Slides; if they have not connected their account yet, or anything fails, deliver
//                the .pptx file instead and print the one-time connect link
//   4. report    one telemetry row for the export (outcome and, on a gate failure, the failing lines)
//
// Prints a block the skill relays verbatim. Exit code is 0 when a deliverable exists (Slides link or
// PPTX file), 1 when the gate failed and there is nothing to hand over.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const telemetry = require('../telemetry.js');
const gdrive = require('./gdrive.js');

const HERE = __dirname;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function ensurePython() {
  const probe = sh('python3', ['-c', 'import uharfbuzz, fontTools, brotli']);
  if (probe.code === 0) return true;
  const inst = sh('pip', ['install', '--break-system-packages', '-q', 'uharfbuzz', 'fonttools', 'brotli']);
  return inst.code === 0 && sh('python3', ['-c', 'import uharfbuzz, fontTools, brotli']).code === 0;
}

function runner() {
  if (process.env.CLAUDE_CODE_USER_EMAIL) return process.env.CLAUDE_CODE_USER_EMAIL;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    return (j.oauthAccount && j.oauthAccount.emailAddress) || null;
  } catch { return null; }
}

// The deck goes from here to Google directly. Our own service is only asked for the person's
// refresh token, which is a kilobyte, so nothing here is bounded by a function timeout or a
// request size cap. `connect` in the result means: this person has never authorised, say so once.
async function deliver(pptxPath, deckName, email) {
  if (!email) return { mode: 'file', note: 'no signed-in account to put the deck in' };
  if (!gdrive.ready()) return { mode: 'file', note: 'the Google client is not configured in kit/service.json yet' };

  const auth = await gdrive.accessToken(email);
  if (auth.error) {
    const fresh = /not authorised yet|no longer valid/.test(auth.error);
    return { mode: 'file', connect: fresh, note: fresh ? `${email} has not connected a Google account yet` : auth.error };
  }

  const up = await gdrive.upload(pptxPath, deckName, auth.token);
  if (up.error) return { mode: 'file', note: up.error };
  return { mode: 'slides', url: up.url, folder: up.folder };
}

(async () => {
  const deck = process.argv[2];
  if (!deck || !fs.existsSync(deck)) { console.error('usage: node kit/export/export.js "<deck>.html"'); process.exit(2); }
  const deckName = path.basename(deck).replace(/ - Rembrandt v[\d.]+\.html$/i, '').replace(/\.html$/i, '');
  const version = fs.readFileSync(path.join(HERE, '..', 'VERSION'), 'utf8').trim();
  const outDir = path.join(path.dirname(path.resolve(deck)), '.rembrandt-export');
  const pptx = path.join(path.dirname(path.resolve(deck)), path.basename(deck).replace(/\.html$/i, '.pptx'));
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };

  if (!ensurePython()) {
    say('EXPORT: FAIL, python packages uharfbuzz, fonttools and brotli could not be installed');
    process.exit(1);
  }

  // 1. extract
  const ex = sh('node', [path.join(HERE, 'extract.js'), deck, outDir]);
  if (ex.code !== 0 || !fs.existsSync(path.join(outDir, 'scene.json'))) {
    say('EXPORT: FAIL, extraction did not complete'); say(ex.out.trim().split('\n').slice(-5).join('\n')); process.exit(1);
  }

  // 2. build + verify (build.py exits non-zero when verify.py fails)
  const bd = sh('python3', [path.join(HERE, 'build.py'), path.join(outDir, 'scene.json'), pptx, 'google']);
  const verifyLines = bd.out.split('\n').filter(l => /^verify:|^\s+FAIL /.test(l));
  const failures = verifyLines.filter(l => /^\s+FAIL /.test(l)).map(l => l.trim());
  const passed = bd.code === 0 && verifyLines.some(l => /^verify: PASS/.test(l));
  say(passed ? `EXPORT GATE: PASS (${verifyLines[0] ? verifyLines[0].replace(/^verify: /, '') : 'ok'})`
             : `EXPORT GATE: FAIL (${failures.length} problem${failures.length === 1 ? '' : 's'})`);
  failures.forEach(f => say('  ' + f));

  // 3. deliver, only a deck that passed
  let delivery = { mode: 'none' };
  const email = runner();
  if (passed) {
    delivery = await deliver(pptx, deckName, email);
    if (delivery.mode === 'slides') {
      say(`GOOGLE SLIDES: ${delivery.url}`);
      say(`  In your own Drive, owned by you${delivery.folder ? `, under "${gdrive.FOLDER_NAME}"` : ''}.`);
    } else {
      say(`GOOGLE SLIDES: not created (${delivery.note}). Deliver the PPTX file instead:`);
      say(`PPTX: ${pptx}`);
      say('  Drop it into Google Drive and open it with Google Slides. Nothing else is needed.');
      if (delivery.connect) {
        say('CONNECT GOOGLE (once, then every deck lands in your Drive by itself):');
        say('  Run: node kit/export/authorize.js');
        say('  It prints a link to approve, and you paste the code back.');
      }
    }
    say('  Note: the deck is 26.67 by 15 in so every size is a whole point. Pasting slides from it into a 10 in deck rescales them.');
  } else {
    try { fs.unlinkSync(pptx); } catch {}
    say('PPTX: not delivered, the gate failed. Fix the deck or report the failure; never hand over a PPTX the gate rejected.');
  }

  // 4. report (never blocks, never throws)
  const status = await telemetry.reportExport({
    file: deck, deck: deckName, version, email,
    outcome: !passed ? 'gate-failed' : delivery.mode,
    failures,
  });
  say(`TELEMETRY (export): ${status}`);
  process.exit(passed ? 0 : 1);
})();
