# Rembrandt service

One small Vercel project, one domain, three routes. Two record usage. The third keeps one Google
refresh token per person, so that connecting an account is something they do once rather than once
per session. Rembrandt's kit calls these; nothing else does.

The service never sees a deck. Rembrandt uploads straight from its sandbox to the person's own
Google Drive, so nothing here is bounded by a function timeout or a request size cap.

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
| `/api/token` | GET, POST, DELETE | `x-rembrandt-key` header, if set | stores, returns or forgets one person's Google refresh token, encrypted at rest |

## What the export log holds and why

`outcome` is one of `slides` (the deck landed in the person's Drive), `file` (they got the `.pptx`
and dropped it into Drive by hand), or `gate-failed` (the exporter's own checker rejected the PPTX
and nothing was handed over).

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
| `TOKEN_SECRET` | for `/api/token` | a different long random string. Encrypts the stored tokens and derives their pathname. Changing it makes every person reconnect. |
| `TELEMETRY_WRITE_KEY` | no | if set, `/api/collect` and `/api/token` require it. See the note below on what this is and is not worth. |
| `TELEMETRY_EMAIL_DOMAIN` | no | defaults to `axoniq.io`. Rows and token requests from other domains are rejected. |

The Google client id and secret are not here. They live in `skills/rembrandt/kit/service.json` and
ship with the kit, because the OAuth exchange happens in the person's own sandbox, not on the
server. It is an installed-app client, whose secret is not confidential by design.

## Deploy

```bash
cd telemetry
npx vercel link          # or vercel project add
npx vercel blob create-store rembrandt-telemetry --access public   # answer y, then Enter,
                                                                  # to link it to the project
npx vercel env add TELEMETRY_SECRET
npx vercel env add TELEMETRY_READ_KEY
npx vercel env add TOKEN_SECRET
npx vercel deploy --prod
```

The host lives in `skills/rembrandt/kit/service.json`, which ships with the kit, so no install needs
an environment variable. It is `https://rembrandt-telemetry.vercel.app` today.
`REMBRANDT_SERVICE_URL` overrides it for testing.

Three hosts have to be on Axoniq's Anthropic network allowlist: this one,
`www.googleapis.com` and `oauth2.googleapis.com`. Until they are, the sandbox proxy refuses
`CONNECT` with a 403 before the request leaves, every run reports `not recorded`, and the deck is
delivered as a `.pptx` file. The project is on a personal Hobby account for the trial; Hobby is
non-commercial personal use only, so it moves to an Axoniq Pro team or to Axoniq's own
infrastructure before this stops being a trial.

## Four things worth knowing

**The write key is not a secret.** Rembrandt ships to everyone at Axoniq, so anything the
plugin has to send is readable by anyone who installs it. `TELEMETRY_WRITE_KEY` keeps random
internet traffic out of the log. It does not make a row trustworthy, and the log should be
read as usage data, not as a system of record.

**`/api/token` trusts the caller's own word about who it is.** That follows from the line above:
anyone at Axoniq holding the plugin can ask for a colleague's token. Three things bound it. The
tokens are encrypted with `TOKEN_SECRET` and only ciphertext is stored, so the public blob URL is
worth nothing. The scope is `drive.file`, so a token can create files and manage the files
Rembrandt created, and cannot read anything else in that person's Drive. And anyone can revoke it
at https://myaccount.google.com/permissions, or with `node kit/export/authorize.js --forget`.
That is an acceptable trust boundary for an internal trial tool and not for anything wider: before
Rembrandt goes past Axoniq, this route needs real per-user authentication.

**Concurrent writes can drop a row.** Blob has no append operation, so `/api/collect` reads
the whole log, adds a line, and writes it back. Two deliveries landing in the same moment
means one overwrites the other. At Axoniq's volume this is unlikely. If it ever matters, write
one blob per event under the same prefix and stitch them together on read, which cannot
conflict. `/api/token` is one blob per person and does not have this problem.

**The log holds work email addresses.** That is personal data, and so is the token store. The
pathnames are unguessable and `/api/log` is token-gated, but if this ever grows past internal usage
counting, it wants a retention rule and a line in the internal privacy notice.
