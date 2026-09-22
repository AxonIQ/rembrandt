# Rembrandt 2.0 rollout: from this branch to a Google Slides link on every run

Rembrandt 1.0 turns any material into an Axoniq deck as one HTML file. Rembrandt 2.0 adds a
Google Slides file to every run, for the people who present and edit in Slides. Nobody at Axoniq
has to install, connect or approve anything for that to work. The cost moves to two one-time
requests to two admins, described below, and to the code in this branch, which is what the admins
are asked to review.

This document is the whole plan, in order. Owner is in brackets.

## How a run ends up in Google Slides

```mermaid
flowchart LR
  A[/rembrandt in Cowork] --> B[HTML deck<br/>Cohere gate PASS]
  B --> C[export.js<br/>measure the HTML in a browser]
  C --> D[build.py<br/>write PPTX to Google's text model]
  D --> E{verify.py<br/>export gate}
  E -->|FAIL| F[no PPTX<br/>failing lines reported and logged]
  E -->|PASS| G[POST pptx to<br/>rembrandt service /api/slides]
  G -->|reachable| H[Drive API as rembrandt@axoniq.io<br/>convert to Slides, share with runner]
  H --> I[Slides link in the reply]
  G -->|unreachable| J[.pptx file in the reply<br/>drop into Drive by hand]
```

Everything left of the service runs inside the Cowork sandbox, on the runner's own session, with
nothing installed beyond what the kit carries. The one network call is the POST to the Rembrandt
service. The service is the only component that talks to Google, and it does so as one account,
`rembrandt@axoniq.io`, with the narrowest Drive scope there is.

## Why the Google Drive connector is not the pipe

Two reasons, and the second is decisive. First, the connector requires every user to authorise
Google Drive in their claude.ai settings once, a consent screen in the middle of onboarding. Second,
the connector takes the file as base64 inside the tool call, so the model has to reproduce every
byte of the deck through its own output. A 9 KB probe survived that; a 39 KB test deck did not (one
wrong character, corrupted zip); a real deck with screenshots is megabytes. No prompt fixes this.

## Why we need the two admin actions

**Anthropic network allowlist (org owner, Admin settings, Capabilities).** The Cowork sandbox can
reach package registries and nothing else. Every other host is refused by the sandbox proxy before
the request leaves. The Rembrandt service domain has to be on that list or the POST is refused, the
deck falls back to a file, and telemetry reports `not recorded` on every run. One domain covers the
collector and the Slides delivery because they are one Vercel project.

**Google Workspace (Workspace admin).** The service needs an identity in Axoniq's Workspace to
create files with. `rembrandt@axoniq.io` is that identity: a normal user account, no admin rights,
no domain-wide delegation. It needs to be a manager of one shared drive, `Rembrandt`, where every
exported deck lands, and it needs a Google Cloud project with the Drive API enabled and one OAuth
client, so a refresh token can be issued to the service. The token's scope is `drive.file`: create
files, manage the files it created, nothing else. It cannot read the rest of rembrandt@'s Drive and
it cannot see anyone else's.

If creating Cloud projects is restricted in the Workspace, the admin creates the project and the
OAuth client and hands us the client id and secret with the account credentials.

## What telemetry sends, and why

Telemetry exists so we can see whether Rembrandt is used and whether it is working, without asking
anyone. It is code in the gate, not a prose instruction, so it fires the same way on every run. It
never changes the outcome of a run: a collector that is down costs a run nothing but a `not
recorded` line.

Two logs, both markdown tables behind a token in Vercel Blob.

| log | when a row is written | what the row holds |
| --- | --- | --- |
| decks | once per deck that passed Cohere and was delivered | when, runner's email, deck name, Rembrandt version, slide count, chapter count, dense-slide count |
| exports | once per PPTX export attempt | when, runner's email, deck name, version, outcome (`slides`, `file`, or `gate-failed`), number of gate failures, and the failing lines |

The failing lines are the new part and the reason the exports log exists. When the export gate
rejects a PPTX, the row carries `verify.py`'s output for each failure: the slide, which check failed
(TEXT, FIT, GEOM or HOUSE), and up to 44 characters of the text on that line. That is enough to
reproduce the defect and fix the exporter without ever asking the runner for their deck. It is also
the only place telemetry holds words from a slide, so: it is sent only on a gate failure, only for
the lines that failed, capped at 40 lines, and a passing run sends no text at all. The runner's
email comes from the signed-in Claude account, first-hand, not inferred. `REMBRANDT_TELEMETRY=0`
turns all of it off.

Because the log holds work email addresses, it is personal data. The blob path is unguessable and
the read endpoint is token-gated. If this grows past internal usage counting, it wants a retention
rule and a line in the internal privacy notice.

## What the admins are reviewing

| path | what it is | why it matters for review |
| --- | --- | --- |
| `skills/rembrandt/kit/export/` | the exporter: `extract.js`, `build.py`, `minipptx.py`, `shape.py`, `verify.py`, `test_export.py`, `export.js`, vendored fonts | runs in every user's sandbox; makes the one outbound POST |
| `skills/rembrandt/kit/telemetry.js` | the telemetry client | what leaves the sandbox and when |
| `skills/rembrandt/kit/service.json` | the service host, shipped with the kit | the single domain to allowlist |
| `telemetry/api/collect.js`, `telemetry/api/log.js` | the collector and the token-gated reader | what is stored and who can read it |
| `telemetry/api/slides.js` | the Slides delivery route | the only code that holds Google credentials and calls Google |
| `telemetry/scripts/authorize.js` | one-off, obtains rembrandt@'s refresh token | shows the exact OAuth scope requested |
| `telemetry/README.md` | environment, deploy, and the three things worth knowing | operational truth |
| `skills/rembrandt/SKILL.md`, **Export** section | what the model is told to do with the export | the human-readable contract |

No dependency is fetched at run time except three Python wheels from PyPI (`uharfbuzz`, `fonttools`,
`brotli`), which the sandbox already allows. Playwright and Chromium are preinstalled in Cowork.

## The steps

**A. Code review and merge** [Ayadi]

1. Push this branch to `github.com/AxonIQ/rembrandt` and open a pull request against `main`. The
   commit is already made locally on branch `rembrandt-2.0`.
2. Share the PR with both admins as the thing to review. This file is at the root of the branch.
3. Merge when reviewed. Do not tag a release yet; the service has to exist first.

**B. Anthropic allowlist** [Axoniq org owner in claude.ai]

4. The service already exists: `rembrandt-telemetry.vercel.app`, the Vercel project that has been
   holding the telemetry collector. Slides delivery is another route on the same project, so this is
   one entry and it covers both. Worth doing first, though: put a custom domain in front of it,
   `rembrandt.axoniq.io` as a CNAME to the same project. An admin can judge an Axoniq host on sight,
   and the allowlist entry then survives a project rename.
5. Admin settings, Capabilities, add that host to the network allowlist.
6. It is not on the list today. Checked from inside a Cowork sandbox on 22 September 2026, the proxy
   answers `CONNECT rembrandt-telemetry.vercel.app:443` with `403 Forbidden`, which means no
   telemetry row has ever been recorded and every run so far reported `not recorded`. Until the
   entry exists, runs deliver the PPTX as a file. That is the designed fallback, not a failure, and
   it is why the code can ship before the allowlist lands.

**C. Google Workspace** [Workspace admin, then Ayadi]

7. Create the user `rembrandt@axoniq.io`. Ordinary account, no admin role. Share the credentials
   with Ayadi. Two-factor is fine; the service never signs in interactively after step 10.
8. Create a shared drive named `Rembrandt` with `rembrandt@axoniq.io` as Manager. Inside it, a
   folder `Decks`. Its folder id (the last part of its URL) becomes `SLIDES_FOLDER_ID`.
9. In Google Cloud, a project `rembrandt-service` with the Drive API enabled and an OAuth client of
   type Desktop app. OAuth consent screen: internal. Either the admin does this and hands over the
   client id and secret, or rembrandt@ is allowed to create the project itself.
10. Ayadi runs `node telemetry/scripts/authorize.js` with the client id and secret, signs in as
    rembrandt@, approves the single `drive.file` scope, and receives the refresh token.

**D. Deploy the service** [Ayadi]

The project must sit on an Axoniq Pro team, not a personal Hobby account. Hobby is restricted to
non-commercial personal use, and a company tool written by a paid consultant is commercial by
Vercel's own definition; it also puts a shared service on one person's account. Cost is not the
reason: a run costs two function invocations and a few megabytes, so at any volume Axoniq will
reach, this stays inside the free allowances either way.

11. In `telemetry/`: `vercel link`, create the Blob store, add the environment variables listed in
    `telemetry/README.md` (secret, read key, Google client id and secret, refresh token, folder id,
    and a write key), `vercel deploy --prod`, attach the domain from step 4.
12. Prove it from outside the sandbox: `curl -X POST --data-binary @deck.pptx -H 'x-rembrandt-email: ayadi@axoniq.io' -H 'x-rembrandt-deck: Test' https://rembrandt.axoniq.io/api/slides` returns a link that opens in Slides, shared with you.
13. Write the host into `skills/rembrandt/kit/service.json`. Commit.

**E. Prove the fidelity model once against Google** [Ayadi, with Claude]

14. Run one Google round trip of the 37-slide master: drop the exported PPTX into Drive, open with
    Slides, export PDF, run `python3 kit/export/measure.py scene.json export.pdf`. Every text block
    should land within 1 px of the browser. This is the check that Google still behaves as measured;
    the export gate does not need it per run.
15. Fix anything it shows; re-run the gate and the tests (`test_export.py`).

**F. Release** [Ayadi]

16. Bump `skills/rembrandt/kit/VERSION` and `.claude-plugin/plugin.json` to `2.0.0`. Move the
    CHANGELOG's Unreleased entry under 2.0.0 with the date. Decks now carry `Rembrandt v2.0` in their
    filename, and the gate enforces it.
17. Tag `v2.0.0`, push the tag. Cowork installs with Sync automatically on pick it up on their own.
18. Run `/rembrandt` once yourself, from a fresh chat, and confirm the reply ends with the Cohere
    PASS line, the export gate PASS line, a Google Slides link, and two telemetry lines that say
    `sent as ...`. Then check `/api/log` and `/api/log?which=exports` show the two rows.

**G. Announce** [Ayadi]

19. One message to the people who use Rembrandt: every deck now comes with a Google Slides link;
    nothing to set up; the deck is 26.67 by 15 in, so paste slides into a 10 in deck and they scale;
    the HTML remains the source and the thing Cohere checks.

## What a run looks like afterwards

The person types `/rembrandt`, answers the questionnaire, and at the end receives the HTML artifact,
a Google Slides link that is already shared with them, and the change report. Nothing was installed,
connected, or approved on their side. If the service is down or unreachable that day, they get the
`.pptx` and one line telling them to drop it into Drive.

## Known limits, on purpose

- Google Slides drops letter spacing, so text set in Inter ships as Inter Tight; 470 to 540 ship as
  Medium, 550 and 560 as SemiBold. The study doc has the measurements.
- The canvas is 26.67 by 15 in so that every size is a whole point. Slides pasted into a 10 in deck
  are rescaled by Slides.
- The delivery route accepts up to 4 MB (Vercel's function limit). Bigger decks fall back to the
  file. If that starts happening often the fix is not a bigger plan: the service hands the sandbox a
  short-lived Google resumable upload URL and the bytes never touch Vercel, which needs
  `googleapis.com` on the allowlist as a second entry.
- The route is pinned to a 60 second `maxDuration`, the Hobby ceiling. The default 10 seconds is not
  enough to refresh a token and push a few megabytes to Drive.
- Gradients, dot patterns and icons are 2x rasters in the PPTX; they look right and are not editable.
- The export runs after Cohere and adds about 40 seconds for a 37-slide deck.
