// Google Drive, from inside the sandbox.
//
// The deck goes straight from here to Google. It does not pass through our own service, which
// only keeps the refresh token so that authorising once means once. That is why there is no size
// cap and no function timeout to design around.
//
// Everything here fails soft: every function either returns a result or an { error } string, and
// nothing throws at the caller. A deck that cannot be uploaded is still a deck.
'use strict';
const fs = require('fs'), path = require('path');

const HERE = __dirname;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const REDIRECT = 'http://localhost';          // installed-app client: the code lands in the address bar
const SLIDES_MIME = 'application/vnd.google-apps.presentation';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const FOLDER_NAME = process.env.REMBRANDT_DRIVE_FOLDER || 'Rembrandt decks';

function config() {
  let j = {};
  try { j = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'service.json'), 'utf8')); } catch {}
  return {
    host: (process.env.REMBRANDT_SERVICE_URL || j.host || '').replace(/\/$/, ''),
    clientId: process.env.REMBRANDT_GOOGLE_CLIENT_ID || j.googleClientId || '',
    clientSecret: process.env.REMBRANDT_GOOGLE_CLIENT_SECRET || j.googleClientSecret || '',
    key: process.env.REMBRANDT_TELEMETRY_KEY || '',
  };
}

const ready = () => { const c = config(); return Boolean(c.host && c.clientId && c.clientSecret); };

function consentUrl() {
  const c = config();
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: c.clientId, redirect_uri: REDIRECT, response_type: 'code',
    access_type: 'offline', prompt: 'consent', scope: SCOPE,
  });
}

async function json(url, opts = {}, ms = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: {}, err: err.name === 'AbortError' ? 'timed out' : String(err.message || err) };
  } finally { clearTimeout(t); }
}

const keyHeader = () => { const c = config(); return c.key ? { 'x-rembrandt-key': c.key } : {}; };

// --- the token, kept by our service because the sandbox is wiped between sessions ---

async function saveToken(email, refresh) {
  const c = config();
  const r = await json(`${c.host}/api/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...keyHeader() },
    body: JSON.stringify({ email, refresh_token: refresh }),
  });
  return r.ok ? { ok: true } : { error: r.body.error || r.err || `service answered ${r.status}` };
}

async function storedToken(email) {
  const c = config();
  const r = await json(`${c.host}/api/token?email=${encodeURIComponent(email)}`, { headers: keyHeader() });
  if (r.status === 404) return { error: 'not authorised yet' };
  return r.ok && r.body.refresh_token ? { refresh: r.body.refresh_token }
                                      : { error: r.body.error || r.err || `service answered ${r.status}` };
}

// One-time: turn the pasted code into a refresh token and hand it to the service.
async function exchange(code, email) {
  const c = config();
  const r = await json('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code).trim(), client_id: c.clientId, client_secret: c.clientSecret,
      redirect_uri: REDIRECT, grant_type: 'authorization_code',
    }),
  });
  if (!r.ok || !r.body.refresh_token) {
    return { error: r.body.error_description || r.body.error || r.err || 'Google did not return a refresh token' };
  }
  const saved = await saveToken(email, r.body.refresh_token);
  return saved.error ? { error: `authorised, but the token could not be stored: ${saved.error}` } : { ok: true };
}

async function accessToken(email) {
  const c = config();
  const stored = await storedToken(email);
  if (stored.error) return stored;
  const r = await json('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId, client_secret: c.clientSecret,
      refresh_token: stored.refresh, grant_type: 'refresh_token',
    }),
  });
  if (!r.ok || !r.body.access_token) {
    const why = r.body.error || r.err || r.status;
    // invalid_grant means the person revoked it or it expired: ask for consent again, do not retry.
    return { error: why === 'invalid_grant' ? 'the stored authorisation is no longer valid' : `token refresh failed (${why})` };
  }
  return { token: r.body.access_token };
}

// --- the upload ---

// drive.file can only see what Rembrandt itself created, so this finds the folder from earlier
// runs or makes it. Any failure here is not worth failing an upload over: fall back to My Drive.
async function folderId(token) {
  const q = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${FOLDER_NAME.replace(/'/g, "\\'")}' and trashed = false`);
  const found = await json(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,
    { headers: { authorization: `Bearer ${token}` } });
  if (found.ok && found.body.files && found.body.files[0]) return found.body.files[0].id;
  const made = await json('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return made.ok && made.body.id ? made.body.id : null;
}

// Resumable rather than multipart: a deck with screenshots is comfortably past the 5 MB that
// multipart is meant for, and this is two calls either way.
async function upload(pptxPath, name, token) {
  const bytes = fs.readFileSync(pptxPath);
  const parent = await folderId(token);
  const meta = { name, mimeType: SLIDES_MIME, ...(parent ? { parents: [parent] } : {}) };

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 120000);
  try {
    const start = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', {
      method: 'POST', signal: ctl.signal,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': PPTX_MIME,
        'x-upload-content-length': String(bytes.length),
      },
      body: JSON.stringify(meta),
    });
    if (!start.ok) {
      const why = await start.text().catch(() => '');
      return { error: `Drive refused the upload (${start.status}) ${why.slice(0, 160)}`.trim() };
    }
    const session = start.headers.get('location');
    if (!session) return { error: 'Drive did not return an upload session' };

    const put = await fetch(session, {
      method: 'PUT', signal: ctl.signal,
      headers: { 'content-type': PPTX_MIME, 'content-length': String(bytes.length) },
      body: bytes,
    });
    const file = await put.json().catch(() => ({}));
    if (!put.ok || !file.id) return { error: `Drive rejected the deck (${put.status}) ${file.error?.message || ''}`.trim() };
    return { url: file.webViewLink || `https://docs.google.com/presentation/d/${file.id}/edit`, id: file.id, folder: Boolean(parent) };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'the upload to Google took longer than two minutes' : String(err.message || err) };
  } finally { clearTimeout(t); }
}

module.exports = { ready, config, consentUrl, exchange, accessToken, upload, storedToken, saveToken, FOLDER_NAME };
