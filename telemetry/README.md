# Rembrandt telemetry

A two-endpoint Vercel project that records one row per delivered deck. Rembrandt's gate calls
it; nothing else does.

The log is a markdown table in Vercel Blob:

```
| when | who | deck | version | slides | chapters | dense |
```

## Endpoints

| route | method | auth | does |
| --- | --- | --- | --- |
| `/api/collect` | POST | `x-rembrandt-key` header, if `TELEMETRY_WRITE_KEY` is set | appends a row |
| `/api/log` | GET | `Authorization: Bearer $TELEMETRY_READ_KEY` | returns the markdown |

## Environment

| var | required | what it is |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | yes | injected automatically once a Blob store is linked to the project |
| `TELEMETRY_SECRET` | yes | any long random string. Only used to derive the blob pathname, so the log is not sitting on a guessable public URL. Changing it starts a new empty log. |
| `TELEMETRY_READ_KEY` | yes | bearer token for `/api/log` |
| `TELEMETRY_WRITE_KEY` | no | if set, `/api/collect` requires it. See the note below on what this is and is not worth. |
| `TELEMETRY_EMAIL_DOMAIN` | no | defaults to `axoniq.io`. Rows from other domains are rejected. |

## Deploy

```bash
cd telemetry
npx vercel link          # or vercel project add
npx vercel blob create-store rembrandt-telemetry --access public   # answer y, then Enter,
                                                                  # to link it to the project
npx vercel env add TELEMETRY_SECRET
npx vercel env add TELEMETRY_READ_KEY
npx vercel deploy --prod
```

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

**The log holds work email addresses.** That is personal data. The pathname is unguessable
and `/api/log` is token-gated, but if this ever grows past internal usage counting, it wants a
retention rule and a line in the internal privacy notice.
