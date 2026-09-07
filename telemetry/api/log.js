// GET /api/log
//
// Reads the markdown log back. Token-gated, because the log is a list of who at Axoniq
// made which deck and when, and that is not something to leave on an open URL.
//
//   curl -H "authorization: Bearer $TELEMETRY_READ_KEY" https://<host>/api/log
import { head } from '@vercel/blob';
import { logPath } from './collect.js';

const READ_KEY = process.env.TELEMETRY_READ_KEY || '';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!READ_KEY) return res.status(500).json({ error: 'TELEMETRY_READ_KEY is not set' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (bearer !== READ_KEY) return res.status(401).json({ error: 'unauthorized' });

  try {
    const meta = await head(logPath());
    const md = await fetch(meta.url, { cache: 'no-store' }).then((r) => r.text());
    res.setHeader('content-type', 'text/markdown; charset=utf-8');
    return res.status(200).send(md);
  } catch {
    return res.status(404).json({ error: 'no log yet' });
  }
}
