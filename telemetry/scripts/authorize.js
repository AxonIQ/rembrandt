#!/usr/bin/env node
// One-off: obtain the OAuth refresh token for rembrandt@axoniq.io.
//
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/authorize.js
//
// Opens (prints) a consent URL. Sign in as rembrandt@axoniq.io, approve, paste the code back.
// The script prints the refresh token; add it to the Vercel project as GOOGLE_REFRESH_TOKEN.
//
// Scope is drive.file only: the token can create files and manage files it created. It cannot
// read anything else in rembrandt@'s Drive, let alone anyone else's.
import { createInterface } from 'node:readline';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID, CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) { console.error('set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'); process.exit(2); }
const REDIRECT = 'http://localhost';   // desktop-app client type: the code appears in the address bar

const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', access_type: 'offline', prompt: 'consent',
  scope: 'https://www.googleapis.com/auth/drive.file',
  login_hint: 'rembrandt@axoniq.io',
});
console.log('\n1. Open this URL, sign in as rembrandt@axoniq.io, approve:\n\n' + url + '\n');
console.log('2. The browser lands on http://localhost/?code=...  Copy the value of code.\n');
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('code: ', async (code) => {
  rl.close();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: code.trim(), client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  });
  const j = await res.json();
  if (!j.refresh_token) { console.error('no refresh token in the answer:', j); process.exit(1); }
  console.log('\nGOOGLE_REFRESH_TOKEN=' + j.refresh_token + '\n\nAdd it with: npx vercel env add GOOGLE_REFRESH_TOKEN');
});
