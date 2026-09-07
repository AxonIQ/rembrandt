// Rembrandt usage telemetry.
//
// One row per delivered deck: who ran it, which deck, when, which version, how big.
// Called by kit/verify.js and by nothing else.
//
// Three rules, in order of importance:
//   1. It never fails the gate. Every path here returns a string; none of them throw.
//   2. It only fires on PASS. A deck that failed was not delivered and is not a data point.
//   3. It fires once per deck. Cohere runs the gate repeatedly; the log gets one row.
//
// Opt out with REMBRANDT_TELEMETRY=0. Point it somewhere else with REMBRANDT_TELEMETRY_URL.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');

const ENDPOINT   = process.env.REMBRANDT_TELEMETRY_URL || '';
const WRITE_KEY  = process.env.REMBRANDT_TELEMETRY_KEY || '';
const OFF        = /^(0|false|off|no)$/i.test(process.env.REMBRANDT_TELEMETRY || '');
const TIMEOUT_MS = 2000;

// Who ran this. Cowork puts the signed-in account in the environment, and every subprocess
// inherits it, so this is first-hand and needs no help from the agent. The .claude.json
// fallback is the same value by another route, for older builds that predate the env var.
function runner() {
  if (process.env.CLAUDE_CODE_USER_EMAIL) return process.env.CLAUDE_CODE_USER_EMAIL;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    if (j.oauthAccount && j.oauthAccount.emailAddress) return j.oauthAccount.emailAddress;
  } catch { /* not signed in, or no such file */ }
  return null;
}

// One row per deck, not per gate run. Keyed by the deck's own bytes, so a re-render after a
// fix is a new deck and does report, while three clean runs of the same file report once.
function marker(email, file) {
  const h = crypto.createHash('sha1')
    .update(String(email)).update('\0')
    .update(fs.readFileSync(file))
    .digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), `rembrandt-telemetry-${h}`);
}

async function report({ file, deck, version, slides, chapters, dense }) {
  if (OFF) return 'off (REMBRANDT_TELEMETRY=0)';
  if (!ENDPOINT) return 'skipped, no REMBRANDT_TELEMETRY_URL set';

  const email = runner();
  if (!email) return 'skipped, no signed-in account to attribute this to';

  let seen;
  try {
    seen = marker(email, file);
    if (fs.existsSync(seen)) return 'skipped, this deck was already reported';
  } catch { /* unreadable deck is the gate's problem, not ours */ }

  const body = JSON.stringify({
    email, deck, version,
    at: new Date().toISOString(),
    slides, chapters, dense,
  });

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(WRITE_KEY ? { 'x-rembrandt-key': WRITE_KEY } : {}) },
      body, signal: ctl.signal,
    });
    if (!res.ok) return `not recorded, the collector answered ${res.status}`;
    try { fs.writeFileSync(seen, ''); } catch {}
    return `sent as ${email}`;
  } catch (err) {
    // The usual cause in Cowork is the sandbox proxy refusing a host that is not on the
    // org allowlist. Say so plainly rather than printing a bare fetch error.
    return err.name === 'AbortError'
      ? `not recorded, the collector did not answer within ${TIMEOUT_MS}ms`
      : 'not recorded, network unreachable (is the collector domain allowlisted?)';
  } finally {
    clearTimeout(t);
  }
}

module.exports = { report };
