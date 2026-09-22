// /api/token
//
// Holds one Google refresh token per person, so that "authorise once" means once and not once
// per session. Rembrandt runs in a sandbox that is wiped when the session ends, so there is
// nowhere on that side to keep it.
//
//   POST   { email, refresh_token }     store it (overwrites)
//   GET    ?email=...                   give it back
//   DELETE ?email=...                   forget it
//
// All three require x-rembrandt-key when TELEMETRY_WRITE_KEY is set, and an @axoniq.io address.
//
// Two things to be honest about.
//
// The blob store is public-read, so the token is encrypted here with AES-256-GCM under
// TOKEN_SECRET and only ciphertext is ever written. Someone who guesses the pathname gets bytes.
// The pathname is derived from TOKEN_SECRET too, and from a different secret than the logs, so
// knowing where the log lives says nothing about where the tokens live.
//
// The caller asserts its own identity. Anyone at Axoniq holding the plugin's write key can ask
// for anyone else's token. That is the trust boundary of an internal trial tool, and it is bounded
// by the scope of the token itself: drive.file lets Rembrandt create files and manage the files it
// created, nothing else in anyone's Drive. Anyone can revoke it from their Google account page.
// If Rembrandt ever leaves Axoniq, this route needs real per-user authentication first.
import { put, head, del } from '@vercel/blob';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const SECRET    = process.env.TOKEN_SECRET || '';
const WRITE_KEY = process.env.TELEMETRY_WRITE_KEY || '';
const ALLOW     = (process.env.TELEMETRY_EMAIL_DOMAIN || 'axoniq.io').toLowerCase();

const key = () => createHash('sha256').update('rembrandt-token-key:' + SECRET).digest();

const pathFor = (email) => {
  const dir = createHash('sha256').update('rembrandt-token-dir:' + SECRET).digest('hex').slice(0, 32);
  const who = createHash('sha256').update(SECRET + '\0' + email).digest('hex').slice(0, 32);
  return `rembrandt/${dir}/${who}.bin`;
};

function seal(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
}

function open(sealed) {
  const raw = Buffer.from(sealed, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  if (!SECRET) return res.status(500).json({ error: 'TOKEN_SECRET is not set' });
  if (WRITE_KEY && req.headers['x-rembrandt-key'] !== WRITE_KEY)
    return res.status(401).json({ error: 'bad or missing x-rembrandt-key' });

  let email = '';
  let refresh = '';
  try {
    if (req.method === 'POST') {
      const b = await readBody(req);
      email = String(b.email || '').trim().toLowerCase();
      refresh = String(b.refresh_token || '');
    } else {
      email = String(new URL(req.url, 'http://x').searchParams.get('email') || '').trim().toLowerCase();
    }
  } catch { return res.status(400).json({ error: 'bad request body' }); }

  if (!email.endsWith('@' + ALLOW)) return res.status(403).json({ error: `email must be @${ALLOW}` });
  const path = pathFor(email);

  try {
    if (req.method === 'POST') {
      if (!refresh) return res.status(400).json({ error: 'refresh_token is required' });
      await put(path, seal(refresh), {
        access: 'public',
        contentType: 'application/octet-stream',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      try { await del(path); } catch { /* already gone is success */ }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      let sealed;
      try {
        const meta = await head(path);
        sealed = await fetch(meta.url, { cache: 'no-store' }).then((r) => r.text());
      } catch { return res.status(404).json({ error: 'no token stored for that address' }); }
      return res.status(200).json({ refresh_token: open(sealed) });
    }

    return res.status(405).json({ error: 'GET, POST or DELETE' });
  } catch (err) {
    console.error('token route failed', err);
    return res.status(500).json({ error: 'token store failed' });
  }
}
