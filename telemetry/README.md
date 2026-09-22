# Rembrandt service

One small Vercel project, one domain, three routes. Two record usage; one turns a Rembrandt PPTX
into a Google Slides file for the person who ran Rembrandt. Rembrandt's kit calls these; nothing
else does. Keeping them on one host means Axoniq's network allowlist needs exactly one entry.

Two logs, both markdown tables in Vercel Blob:

```
log.md      | when | who | deck | version | slides | chapters | dense |            one row per delivered deck
exports.md  | when | who | deck | version | outcome | failures | detail |         one row per PPTX export attempt
```

## Endpoints

| route | method | auth | does |
| --- | --- | --- | --- |
| `/api/collect` | POST | `x-rembrandt-key` header, if `TELEMETRY_WRITE_KEY` is set | appends a row to `log.md`, or with `kind: "export"` to `exports.md` |
| `/api/log` | GET | `Authorization: Bearer $TELEMETRY_READ_KEY` | returns `log.md`; `?which=exports` returns `exports.md` |
| `/api/slides` | POST | `x-rembrandt-key` header, if set | body is a `.pptx`; creates a Google Slides file in the Rembrandt shared drive as rembrandt@axoniq.io, shares it with `x-rembrandt-email` as editor, returns `{ url }` |

## What the export log holds and why

`outcome` is one of `slides` (a link was created), `file` (the service was unreachable or refused,
the runner got the `.pptx` and dropped it into Drive by hand), or `gate-failed` (the exporter's own
checker rejected the PPTX and nothing was handed over).

On `gate-failed` the row carries `verify.py`'s failing lines: which slide, which check (TEXT, FIT,
GEOM, HOUSE), and up to 44 characters of the text on the line that failed. That snippet is deck
content, and it is the only place telemetry ever holds words from a slide. It is sent only when the
gate fails and only for the lines that failed. It is what lets us reproduce and fix an exporter bug
from the log alone, without asking anyone to send us their deck. A run that passes sends no text.

## Environment

| var | required | what it is |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | yes | injected automatically once a Blob store is linked to the project |
| `TELEMETRY_SECRET` | yes | any long random string. Only used to derive the blob pathname, so the log is not sitting on a guessable public URL. Changing it starts a new empty log. |
| `TELEMETRY_READ_KEY` | yes | bearer token for `/api/log` |
| `TELEMETRY_WRITE_KEY` | no | if set, `/api/collect` requires it. See the note below on what this is and is not worth. |
| `TELEMETRY_EMAIL_DOMAIN` | no | defaults to `axoniq.io`. Rows and Slides requests from other domains are rejected. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for `/api/slides` | an OAuth client (Desktop type) in a Google Cloud project that has the Drive API enabled |
| `GOOGLE_REFRESH_TOKEN` | for `/api/slides` | rembrandt@axoniq.io's refresh token for the `drive.file` scope, from `node scripts/authorize.js` |
| `SLIDES_FOLDER_ID` | for `/api/slides` | the folder in the Rembrandt shared drive that new decks land in |

## Deploy

```bash
cd telemetry
npx vercel link          # or vercel project add
npx vercel blob create-store rembrandt-telemetry --access public   # answer y, then Enter,
                                                                  # to link it to the project
npx vercel env add TELEMETRY_SECRET
npx vercel env add TELEMETRY_READ_KEY
npx vercel env add GOOGLE_CLIENT_ID
npx vercel env add GOOGLE_CLIENT_SECRET
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/authorize.js   # sign in as rembrandt@axoniq.io
npx vercel env add GOOGLE_REFRESH_TOKEN
npx vercel env add SLIDES_FOLDER_ID
npx vercel deploy --prod
```

Then set, in the environment Rembrandt runs in, `REMBRANDT_TELEMETRY_URL=https://<host>/api/collect`
and `REMBRANDT_SLIDES_URL=https://<host>/api/slides`.

Then set `REMBRANDT_TELEMETRY_URL` to `https://<host>/api/collect` in the environment
Rembrandt runs in, and give the deployment's domain to an Axoniq admin so it can be added to
the network allowlist. Until that allowlist entry exists the POST is refused by the sandbox
proxy and every run reports `skipped (network unreachable)`.

## Three things worth knowing

**The write key is not a secret.** Rembrandt ships to everyone at Axoniq, so anything the
plugin has to send is readable by anyone who installs it. `TELEMETRY_WRITE_KEY` keeps random
internet traffic out of the log. It does not make a row trustworthy, and the log should be
read as usage data, not as a system of record.

**Concurrent writes can drop a row.** Blob has no append operation, so `/api/collect` reads
the whole log, adds a line, and writes it back. Two deliveries landing in the same moment
means one overwrites the other. At Axoniq's volume this is unlikely. If it ever matters, write
one blob per event under the same prefix and stitch them together on read, which cannot
conflict.

**`/api/slides` acts as one account, on purpose.** rembrandt@axoniq.io holds a `drive.file` token,
which lets it create files and manage the files it created, nothing else. Files land in the
Rembrandt shared drive and are shared to the runner as editor, so the runner's own Drive is never
touched and no runner ever sees a consent screen. Vercel functions cap the request at 4.5 MB; a
bigger deck is handed over as a file instead, which the kit does on its own.

**The log holds work email addresses.** That is personal data. The pathname is unguessable
and `/api/log` is token-gated, but if this ever grows past internal usage counting, it wants a
retention rule and a line in the internal privacy notice.
