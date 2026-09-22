// POST /api/slides
//
// Turns a Rembrandt PPTX into a Google Slides file and shares it with the person who ran Rembrandt.
// The sandbox Rembrandt runs in cannot reach Google directly and cannot ask the runner for Drive
// access without a consent screen, so this one route does it on their behalf:
//
//   body                          the .pptx bytes (raw, up to Vercel's 4.5 MB request cap)
//   x-rembrandt-email             the runner's work address (must be @axoniq.io)
//   x-rembrandt-deck              the deck's name, URL-encoded, becomes the Slides title
//   x-rembrandt-key               same write key as /api/collect, if TELEMETRY_WRITE_KEY is set
//
// It acts as rembrandt@axoniq.io, a normal Workspace user whose OAuth refresh token lives in this
// project's environment (scripts/authorize.js obtains it once). The file is created in the Rembrandt
// shared drive folder, converted to Slides by Drive itself, and shared with the runner as editor.
// Nothing about the runner's own Drive is touched or needed.
//
// Returns { url, id, note }. Every error is a JSON { error } with a status the client can act on.
import { createHash } from 'node:crypto';

export const config = { api: { bodyParser: false } };

const WRITE_KEY  = process.env.TELEMETRY_WRITE_KEY || '';
const ALLOW      = (process.env.TELEMETRY_EMAIL_DOMAIN || 'axoniq.io').toLowerCase();
const FOLDER     = process.env.SLIDES_FOLDER_ID || '';          // folder in the Rembrandt shared drive
const CLIENT_ID  = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SEC = process.env.GOOGLE_CLIENT_SECRET || '';
const REFRESH    = process.env.GOOGLE_REFRESH_TOKEN || '';
const PPTX_MIME  = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const SLIDES_MIME = 'application/vnd.google-apps.presentation';

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

// Access tokens live an hour; one refresh per request is simplest and well inside Google's limits.
async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SEC, refresh_token: REFRESH, grant_type: 'refresh_token' }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(`token refresh failed: ${j.error || res.status}`);
  return j.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!CLIENT_ID || !CLIENT_SEC || !REFRESH) return res.status(500).json({ error: 'Google credentials are not configured' });
  if (WRITE_KEY && req.headers['x-rembrandt-key'] !== WRITE_KEY) return res.status(401).json({ error: 'bad or missing x-rembrandt-key' });

  const email = String(req.headers['x-rembrandt-email'] || '').trim().toLowerCase();
  if (!email.endsWith('@' + ALLOW)) return res.status(403).json({ error: `x-rembrandt-email must be @${ALLOW}` });
  const deck = decodeURIComponent(String(req.headers['x-rembrandt-deck'] || 'Rembrandt deck')).slice(0, 120);

  const bytes = await readBody(req);
  if (bytes.length < 1000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return res.status(400).json({ error: 'body is not a PPTX' });

  try {
    const token = await accessToken();
    const boundary = 'rembrandt-' + createHash('sha1').update(String(Date.now())).digest('hex').slice(0, 12);
    const meta = JSON.stringify({ name: deck, mimeType: SLIDES_MIME, ...(FOLDER ? { parents: [FOLDER] } : {}) });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\ncontent-type: ${PPTX_MIME}\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    // Asking Drive for a Slides mimeType on a PPTX upload is the conversion; no Slides API call is needed.
    const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const file = await up.json();
    if (!up.ok || !file.id) return res.status(502).json({ error: `Drive upload failed: ${file.error?.message || up.status}` });

    const share = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }),
    });
    const note = share.ok ? '' : 'created, but sharing with the runner failed; it is in the Rembrandt shared drive';
    return res.status(200).json({ url: file.webViewLink || `https://docs.google.com/presentation/d/${file.id}/edit`, id: file.id, note });
  } catch (err) {
    console.error('slides failed', err);
    return res.status(502).json({ error: String(err.message || err) });
  }
}
