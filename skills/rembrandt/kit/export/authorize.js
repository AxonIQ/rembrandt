#!/usr/bin/env node
// Connect this person's Google account to Rembrandt. Once, ever.
//
//   node kit/export/authorize.js              prints the link to open
//   node kit/export/authorize.js "<code>"     finishes it with the code from the address bar
//   node kit/export/authorize.js --forget     disconnects the account
//
// Why the copy and paste: Rembrandt runs in a sandbox with no browser and no way for Google to
// redirect back into it. The consent page is opened by the person, in their own browser, on their
// own account. Google then lands on a dead http://localhost page whose address bar carries the
// code. That code is worth nothing on its own and expires in minutes.
'use strict';
const g = require('./gdrive.js');
const fs = require('fs'), os = require('os'), path = require('path');

function runner() {
  if (process.env.CLAUDE_CODE_USER_EMAIL) return process.env.CLAUDE_CODE_USER_EMAIL;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    return (j.oauthAccount && j.oauthAccount.emailAddress) || null;
  } catch { return null; }
}

(async () => {
  const email = runner();
  if (!email) { console.log('AUTHORIZE: FAIL, no signed-in Claude account to connect'); process.exit(1); }
  if (!g.ready()) {
    console.log('AUTHORIZE: FAIL, the Google client is not configured in kit/service.json');
    console.log('  Rembrandt will keep delivering the .pptx file until it is.');
    process.exit(1);
  }

  const arg = process.argv[2];

  if (arg === '--forget') {
    const c = g.config();
    const res = await fetch(`${c.host}/api/token?email=${encodeURIComponent(email)}`, {
      method: 'DELETE', headers: c.key ? { 'x-rembrandt-key': c.key } : {},
    }).catch(() => null);
    console.log(res && res.ok
      ? `AUTHORIZE: forgotten. ${email} is disconnected. Revoke it at https://myaccount.google.com/permissions too.`
      : 'AUTHORIZE: FAIL, could not reach the service to forget the token');
    process.exit(res && res.ok ? 0 : 1);
  }

  if (!arg) {
    console.log('AUTHORIZE: open this link, sign in as ' + email + ', and approve:');
    console.log('');
    console.log('  ' + g.consentUrl());
    console.log('');
    console.log('  The browser will land on a page that will not load. That is expected.');
    console.log('  Copy the value of code= from its address bar and paste it here.');
    console.log('  Rembrandt asks for one permission, drive.file: it can create files and manage');
    console.log('  the files it created, and cannot read anything else in your Drive.');
    process.exit(0);
  }

  const out = await g.exchange(arg, email);
  if (out.error) { console.log(`AUTHORIZE: FAIL, ${out.error}`); process.exit(1); }
  console.log(`AUTHORIZE: PASS, ${email} is connected. Every deck from now on lands in your own Drive.`);
})();
