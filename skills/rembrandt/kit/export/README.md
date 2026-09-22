# Rembrandt PPTX export

Turns a Rembrandt HTML deck into a PPTX that Google Slides lays out the way the browser did.

```bash
# the whole thing, as the skill runs it (after Cohere has passed):
node kit/export/export.js "Deck name - Rembrandt v2.0.html"

# the pieces:
node kit/export/extract.js deck.html out            # every section.slide; or name slides: "cover/light" "cards/3-up"
python3 kit/export/build.py out/scene.json out/deck.pptx        # builds, then verifies; non-zero exit on any failure
python3 kit/export/test_export.py out/scene.json                # the gate itself, on known-bad decks
python3 kit/export/test_delivery.py                             # the delivery path, against a stubbed Google
python3 kit/export/measure.py out/scene.json google-export.pdf  # optional: diff against a real Slides PDF export

# once per person, to connect their Google account:
node kit/export/authorize.js            # prints the link to approve
node kit/export/authorize.js "<code>"   # finishes it with the code from the address bar
node kit/export/authorize.js --forget   # disconnects
```

## Where the deck goes

Straight from the sandbox to the runner's own Drive, into a folder called `Rembrandt decks`, owned
by them. `gdrive.js` holds all of it: the consent URL, the one-time code exchange, the refresh, and
a resumable upload that asks Drive for a Slides mimeType, which is what performs the conversion. The
scope is `drive.file`, so Rembrandt can see the files it made and nothing else in anyone's Drive.

The only thing kept on a server is the refresh token, because the sandbox is wiped between sessions.
The deck itself never passes through our service, which is why there is no size cap and no function
timeout anywhere in this path. `test_delivery.py` stubs Google and asserts on what the runner would
see: never authorised, authorisation revoked, a normal upload, the first upload that has to make the
folder, a deck Google refuses, and a service that is not on the allowlist yet.

Fonts are vendored in `fonts/` (Inter, Inter Tight, Geist, Geist Mono, variable, OFL). Playwright and
Chromium are preinstalled in Cowork; `export.js` installs `uharfbuzz`, `fonttools` and `brotli` from
PyPI if they are missing.

## Why it holds together

The exporter never re-derives layout. `extract.js` measures the browser word by word and records the
**rendered lines**: each run carries the index of the line it was drawn on. `build.py` replays those
lines as explicit breaks and sizes every box from the shaped width of its widest line, so an explicit
`<br>`, a balanced wrap and an ordinary soft wrap are the same mechanism and Slides has nothing left
to re-flow. Widths come from HarfBuzz shaping the exact font file Slides will use, so the prediction
is the rendering, kerning included.

Rules measured on Google Slides (Sep 2026, full write-up in the study doc):

- insets are written as 0; Slides honours that, and its 0.1in / 0.05in default is the usual misalignment
- line spacing is `css line-height / (1.2 * size)` as a percentage, never `spcPts`, which Slides misconverts
- box top = browser first baseline minus `0.96 * size * min(1, pct)`
- weights by typeface name: under 450 Regular, under 545 Medium, under 650 SemiBold, else the bold flag
- Inter exports as Inter Tight at zero tracking, because Slides drops letter spacing
- the canvas is 1 css px = 1 pt, so every size is a whole point and every spacing a whole percent
- backgrounds and borders stay native shapes; `background-image`, `svg` and `img` are rasterised at 2x

## The gate

`verify.py` reads the built package back and checks it against the browser measurement. It runs
automatically at the end of every build.

| Check | Catches |
| --- | --- |
| TEXT | every browser line is its own line in the deck, character for character, in order: a lost `<br>`, glued runs, a dropped or duplicated run |
| FIT | every line, shaped in the exported font, fits its box: any re-wrap |
| GEOM | box position implies the browser's first baseline and line pitch under the measured model |
| HOUSE | insets zeroed, whole-point sizes, whole-percent spacing, no `spcPts`, no autofit |

`test_export.py` breaks the exporter on purpose (drops the breaks, narrows the boxes, glues runs,
shifts the baseline, writes fractional sizes, restores default insets) and asserts the gate rejects
each one. A checker nobody has seen fail is not a checker.

For a visual second opinion, install the fonts locally and render with LibreOffice
(`soffice --headless --convert-to pdf`): with Inter Tight, Geist and Geist Mono present it agrees with
the browser, and without them it substitutes wider faces and re-wraps, which tells you nothing.
