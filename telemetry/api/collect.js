// POST /api/collect
//
// One row per delivered deck. Rembrandt's gate (kit/telemetry.js) calls this once,
// only after kit/verify.js prints PASS, fire and forget with a 2s timeout.
//
// The log is a markdown table held in Vercel Blob. Blob has no append, so this is a
// read-concat-write. Two deliveries in the same second can lose a row; at a few decks
// a day that is theoretical, and README.md says what to do if it ever stops being.
import { put, head } from '@vercel/blob';
import { createHash } from 'node:crypto';

const SECRET     = process.env.TELEMETRY_SECRET || '';
const WRITE_KEY  = process.env.TELEMETRY_WRITE_KEY || '';
const ALLOW      = (process.env.TELEMETRY_EMAIL_DOMAIN || 'axoniq.io').toLowerCase();

// Blob is public-read, so the pathname is the only thing standing between a log full of
// work emails and anyone who guesses a URL. Derive it from the secret and it is unguessable.
export const logPath = () =>
  `rembrandt/${createHash('sha256').update(SECRET).digest('hex').slice(0, 32)}/log.md`;

const HEADER = [
  '# Rembrandt deck log',
  '',
  'One row per deck that passed the gate and was delivered.',
  '',
  '| when | who | deck | version | slides | chapters | dense |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  '',
].join('\n');

const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SECRET) return res.status(500).json({ error: 'TELEMETRY_SECRET is not set' });
  if (WRITE_KEY && req.headers['x-rembrandt-key'] !== WRITE_KEY)
    return res.status(401).json({ error: 'bad or missing x-rembrandt-key' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { email, deck, at, version, slides, chapters, dense } = b;

  if (!email || !deck || !version) return res.status(400).json({ error: 'email, deck and version are required' });
  if (!String(email).toLowerCase().endsWith('@' + ALLOW))
    return res.status(403).json({ error: `email must be @${ALLOW}` });

  const when = at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : new Date().toISOString();
  const row = `| ${cell(when)} | ${cell(email)} | ${cell(deck)} | ${cell(version)} | ${cell(slides)} | ${cell(chapters)} | ${cell(dense)} |\n`;

  try {
    const path = logPath();
    let current = '';
    try {
      const meta = await head(path);
      current = await fetch(meta.url, { cache: 'no-store' }).then((r) => r.text());
    } catch {
      current = HEADER; // first write
    }
    await put(path, current + row, {
      access: 'public',
      contentType: 'text/markdown; charset=utf-8',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('collect failed', err);
    return res.status(500).json({ error: 'write failed' });
  }
}
