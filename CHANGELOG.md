# Changelog

Rembrandt is versioned as a whole: the skill, the kit and the master deck move together,
because a deck built by one version cannot be checked by another's rules. Every rendered
deck carries its version in the filename, so any output can be traced to the rules that made it.

Releases are git tags from v1.0.0 on. Earlier history is not in this repository: it was rebuilt
from a single commit before publication, because the example decks it carried held internal
figures and customer names. The entries below remain the full record of what changed and why.

## 1.0.4

- **An example deck on the site.** A second hero button, secondary to Install, opens a finished
  24-slide deck straight in the browser: `docs/example-deck.html`. It is entirely synthetic, with
  invented figures, invented people and initials in place of photographs, and it passes all five
  checks. It carries the 1.0.3 chrome fix, so the F key works in the deck people judge Rembrandt by.

## 1.0.3

Two fixes in the presenter chrome.

- **The F key now works.** The button has advertised `FULL SCREEN . F` since 0.4, but the key was
  never added to the viewer's keyboard handler, so only the button did anything. Typing an f while
  editing text still types an f, because the editor's handler claims the key first.
- **The edit button names its shortcut**, `EDIT . E`, like the other two. It was the only button in
  the bar whose keyboard shortcut was hidden.

## 1.0.2

The model step is gone, and the site explains the actual workflow.

- **Rembrandt no longer mentions which model is running.** It opens with its version and nothing
  else. A session cannot verify what is serving it, the configured identifier can differ from the
  model actually answering, and nothing downstream depends on it. Removed from the skill, the
  README and the site.
- **The site now walks the real flow.** "How to set up Rembrandt" and "How to use Rembrandt"
  replace "Getting it" and "Then", the second as three steps with a screenshot each: invoke it,
  answer the fidelity question and leave it for five to ten minutes, get an HTML file with the
  presenting controls built in.
- **A section on editing a deck**: ask Claude in the same thread and it checks each change against
  the spec, or press E and retype text in place. With one thing said loudly, because it is the
  thing people lose work to: inline edits are not saved until you press Save.
- **No Inter on the site.** Its letter spacing was wrong at display sizes and two attempts did not
  fix it, so the page is Geist and Geist Mono only. The deck itself is unaffected: the master's
  type system is untouched.
- Best practices reads before what it isn't. The raw-code bullet says which formats to use.

## 1.0.1

Rembrandt is Cowork only, stated rather than implied, and one gap in the fit ladder closed.

- **Cowork only.** The gate measures the rendered page in a real browser, and Cowork has one ready
  while a laptop generally does not. Claude Code was never able to run the checks, and the failure
  was silent: `chromium.launch()` threw a stack trace rather than printing FAIL, so a model that
  could not verify a deck would likely have delivered it anyway. That turned a hard gate into no
  gate through the back door. The skill now checks for a browser before it touches the input and
  stops outright if there is none, rather than building something it cannot check. The landing page
  and the README say so plainly instead of offering terminal instructions that half work.
- **The fit ladder no longer contradicts Verbatim.** Step 8 led with "rewrite tighter" while the
  Fidelity section says Verbatim means zero rewriting, fit from template, density and splitting
  only. A model reading the flow in order would reach for the first rung and reword a Verbatim
  deck, and no check would catch it: the five checks measure type, colour, geometry and house
  rules, never whether the words still match the source. Step 8 now names the exception.
- **Fixed the filename shown on the landing page**, which advertised a three-digit version. Decks
  are stamped with major and minor only, which is what `verify.js` enforces.

## 1.0.0

The cleanup. Nothing was added; a lot was taken away. Five versions of solving problems left a
repository where scaffolding outnumbered the tool, so this release removes everything that was true
once and is now archaeology, without dropping a single check.

- **`kit/` is three files and two directories.** `master.html` (renamed from `master-slide-deck.html`),
  `verify.js`, `VERSION`, plus `assets/` and `icons/`. It was sixteen files.
- **The four audits are one file.** `kit/verify.js` now runs shell, styles, colour, layout and the
  house rules itself, in a single browser instead of launching Chromium four times. Every check is
  the same check, with the same thresholds and the same messages.
- **The editor and the presenter chrome live in the master.** Copying the master carries them, so
  `editor.js` and `patch_shell.py` no longer exist. `set_deck_name()` is three lines of regex in
  SKILL.md rather than a shipped helper.
- **Removed the one-shot migrations.** `retype_master.py`, `lucide_swap.py` and `cssedit.py` did
  their job once and were never going to run again. `shots.js` took screenshots, which `cohere.md`
  forbids. `cohere_measure.js` was superseded by the layout check. `shell-q3-retyped.html` was a
  second copy of the shell that failed three of the five checks.
- **Removed `Asset package/`**, a duplicate of `kit/assets/`, and `tools/`, which packaged a zip for
  a distribution route no longer in use.
- **The filename drops the model.** `<Presentation name> - Rembrandt v<version>.html`. The skill now
  opens by recommending Opus 5 at Low effort instead of asking which model is running: a session
  cannot verify what is serving it, and asking put a wrong name on a delivered file.
- **`verify.js` checks that `kit/VERSION` and `plugin.json` agree**, so the version cannot drift
  between the stamp and the manifest.
- **Distribution is this repository.** It is the marketplace, it is public, and Cowork's automatic
  sync means a push is the whole release. The icons are Lucide under ISC, which is what makes a
  public repository possible.

## 0.5.0

Rembrandt can now be hosted. That is the whole point of this release.

Untitled UI's licence permits commercial use but forbids redistribution, and
`/plugin marketplace add <url>` fetches with no authentication, so the package could
never legally sit at a URL a teammate could install from. Every distribution plan ran
into the same wall: a private bucket the plugin system cannot read, or a public one we
are not allowed to fill.

- **The icon library is Lucide** (`kit/icons/`, ISC), 2,057 icons in place of 1,173.
  Same 24px grid, same 2px round-capped single stroke, so the decks look the same. ISC
  permits redistribution outright, which makes the plugin freely hostable and removes
  the "internal only" caveat from every install instruction.
- **Icon names are Lucide's own**: `zap`, `shield-check`, `trending-up`, `chart-column`.
  No vendor-numbered variants (`shield-01`, `trend-up-01`) to guess at any more, which
  should reduce the wrong-icon-name failures weaker models were producing.
- **`kit/lucide_swap.py`** carries the 33 mappings and rewrites a deck's inlined sprite
  in place. It is idempotent and it fails loudly on an unmapped name rather than
  silently dropping a glyph. Kept in the repo so an older deck can be brought forward.
- **`icon_symbols()` moves the stroke attributes onto the `<symbol>`.** Lucide carries
  them on the root `<svg>`, which a `<use>` does not inherit from; on the symbol the
  children pick them up as ordinary inherited presentation attributes. Without this the
  icons render as solid black blobs.
- Master and both examples regenerated and re-verified. All three pass the gate.

## 0.4.0

The deck stops being a rendering and becomes an application. Until now a one-word typo meant a new
chat, a full regeneration and another trip through the gate. Now the person fixes it themselves,
and the type system survives them doing it.

- **`kit/editor.js` ships with every deck**, inlined as `script#rb-editor` and inert until the
  person presses EDIT. Three jobs:
  - **Edit text.** `contenteditable="plaintext-only"` plus a paste interceptor that forces
    `text/plain` and an Enter that is suppressed. This is the whole point: plain `contenteditable`
    would let a paste from Word carry a font stack, a size and a colour into a text node and
    silently break the one rule Rembrandt exists to enforce. A person can retype every word in the
    deck and cannot violate it.
  - **Remove an item.** Icons, images and marks fade to `opacity:0` on hover-and-click. Repeated
    units (card, stat, row, chip, table row) are removed outright and the grid column count is
    recomputed, because a hidden card in a fixed 3-up leaves a hole. The last sibling is never
    removable, so a slide cannot be emptied.
  - **Save.** Three layers. A patch object in `localStorage` keyed on the document title, so a
    reload never loses work. `showSaveFilePicker` writing back into the same file, which works on
    `file://` in Chromium and is a genuine in-place save. A Blob download everywhere else.
- **A live geometry guard** runs the `audit_layout.js` logic inside the page and reports overflow or
  collision in the edit bar as the person types. Verified to agree with the offline audit on the
  same broken edit. Editing invalidates the audits, so the audit had to move into the page.
- **A baked deck carrying hand edits passes the full gate.** `bake()` strips every editor artefact,
  and `verify.js` prints PASS on the output. That is the test that made this shippable.
- **The presenter chrome is dark.** `--ch-bg` and `--ch-panel`, so the slide is the only lit surface
  on screen. The overview grid, the arrows and the edit bar moved with it.
- **The HUD reads `07/23 . Deck name . slide name`.** The counter and the deck name are pinned and
  only the slide name grows, into its own reserved box, so nothing on the bar shifts as you page.
  Previously the counter sat in a centre cell and drifted.
- **Full screen**, on the FULL SCREEN button or `F`. The slide goes edge to edge and the chrome
  slides away after a few seconds of stillness.
- **A first-run notice** on the first EDIT, dismissible and remembered in `localStorage`, plus a
  line in the edit bar that never goes away. It says the three things that are true and easy to get
  wrong: edits live in the browser and not in the file, Save writes a file, and Rembrandt may
  overwrite hand edits if the file is fed back into the skill.
- **`kit/patch_shell.py`** applies all of this to a deck in place and is idempotent, so old decks
  can be brought forward without regenerating them. It also exposes `set_deck_name()`, which names
  the deck in the HUD, the overview header and `<title>` in one call.
- **`kit/audit_shell.js` enforces the chrome.** Dark surface, the `.hud-meta` group, the EDIT and
  FULL SCREEN buttons, and a live `window.__rbEditor`. Every v0.3 deck fails it, which is correct:
  a deck without the editor is a deck the person cannot fix a typo in. `.hud-mid` joins the banned
  classes.
- **Two shell faults found while testing.** The `.navzone` click strips sat above the slide and
  swallowed every hover in the left and right thirds, so an icon at x=147 was unreachable. And the
  editor's injected style block duplicated on each bake cycle. Both fixed.


## 0.3.3

The same component broke in a Sonnet run and an Opus run: a stat built without its `.stat`
wrapper, so a 96px numeral and its 21px label became inline neighbours and collided. Both were
perfectly on-style, so the style and colour audits passed them. Geometry was unchecked.

- **`kit/audit_layout.js`** is new and checks three things a style audit cannot see: **collisions**
  (two pieces of text overlapping, with labels that carry their own surface exempted as deliberate
  overlays), **out-of-frame** (past the 64px margins, below y=1012, or off the canvas), and
  **dead bands** (a content slide stopping more than one grid row short). It is part of
  `kit/verify.js`, which now runs five checks.
- **The master had nine of its own layout faults** and now passes: `table/comparison`,
  `table/definitions`, `table/matrix`, `team/solo`, `team/trio`, `team/five`, `team/six`,
  `versus/split` and `diagram/architecture` were piling content at the top or overrunning the
  bottom, and `chapter/typographic` and `spec/type` sat a few pixels past the frame.
- **Assemble** now says a component is its markup and not its look, with the stat as the worked
  example: `.stat` is the flex column that stacks label, numeral and reading line, and dropping it
  is what produces the collision. Combining two templates on one slide is called out as inventing a
  layout, which is allowed, flagged, and still audited.
- **Model identity.** A run stamped the wrong model on a filename by trusting the environment's
  configured-model line. A model cannot verify which model is serving a turn, so the skill now
  reports it as configured and unverified, asks the person to confirm, and uses their answer. It is
  told explicitly not to infer it from its own style, the session URL, or an example deck's name.

## 0.3.2

Investigating a Haiku run that produced a broken deck turned up a worse problem: **the audits
passed on it.** They queried `section.slide`, the deck used `div.slide`, so they measured nothing
and reported success. An audit that fails open is worse than no audit, because it certifies the
thing it was built to catch.

- **Every audit now fails closed** and finds slides by class rather than tag. Zero slides is a FAIL.
- **`kit/audit_shell.js`** is new and checks provenance: slides are `section.slide` inside
  `#scaler`, `symbol#lockup` and `symbol#mk` are present, the logo is a `<use>` and not typed text,
  `window.__go` / `__count` exist, `#frame` is actually sized, no invented or stale classes. The
  Haiku deck failed all eight of its checks; it had retyped the shell from memory, so its logo was
  `<svg><text>Axoniq</text></svg>`, its type scale was fabricated, and its viewer left `#frame` at
  0×0.
- **`kit/verify.js`** is the single gate: four audits plus the house rules (em dash, emoji, Axoniq,
  padded `#NN`, placeholder text, filename against `kit/VERSION`), one PASS or FAIL. Cohere is now
  "run this until it passes", which is far harder to skip than four separate commands.
- **Assemble rewritten.** The shell is *copied* with a three-line head/tail split, never retyped,
  and the skill says why: a retyped shell looks right and is broken invisibly. Slides must be
  `section.slide` with `data-name` set to the master template used.
- **`kit/cssedit.py`** replaces loose-regex CSS deletion. A pattern like `\.kicker\{[^}]*\}` also
  matches the tail of `.cover-b .kicker{…}` and leaves a dangling selector that eats the next rule.
  That bug destroyed `.cat-row` in 0.2 and `.cover-b .cv-title` in 0.3; both are repaired, and a
  selector-level diff against 0.1 now shows no unintended losses.
- The dead `.kicker` class is gone from the master and the deck shell. Both example decks
  regenerated and passing the gate.

## 0.3.1

- **One run per chat.** The skill opens by stating its version and model, then stops if the
  conversation has already run Rembrandt, quoted an earlier version of the rules, or been used to
  work on the skill itself. Rules already in the context window beat the file on disk, so a deck
  built in a reused chat is stamped with a version it was not built to, and no audit can catch it
  because the wrong rule was applied consistently.
- **Master:** the gradient sphere is gone from the cover backdrop and the closing slide, not just
  the mark inside it. Those slides stand on their own backdrop gradient. The company mark now
  appears at two sizes only: the header lockup and the 84px closing icon, and the skill no longer
  tells anyone to place a ball behind a title.
- **Fixed:** `index/catalog` (slide 4) had lost its `.cat-row` grid in the 0.2 retype, when a regex
  meant to delete `.idx-page` also matched the tail of a selector list and left a dangling selector
  that swallowed the next rule. A selector-level diff of 0.1 against 0.3 confirmed it was the only
  casualty; the same diff on the deck shell came back clean.
- Decks are unaffected, so the two examples keep their `v0.3` filenames: the stamp is major.minor.

## 0.3.0

- **Color rule.** When you use color, use the **500**. The 600 and 700 are only for text or a
  glyph on a colored surface (a chip, a tinted band, a dark slide); the 25/50/100/200 are
  surfaces and their borders, never text. `kit/audit_colors.js` enforces it, reading the
  palette from the deck's own `:root`.
- **Named output.** Every deck is delivered as
  `<Presentation name> - Rembrandt v<version> - <Model>.html`.
- **Master:** the oversized Axoniq mark is gone from the cover backdrop and the closing slide.
- Explicit `--blue-500` and `--orange-500` aliases, so every hue has a 500 to name.

## 0.2.0

- **The hard rule.** Every text node on every slide is exactly one of 18 text styles
  (family, size, weight); only SVG chart labels are exempt. `kit/audit_styles.js` enforces it.
  The master was retyped onto those styles: 92 CSS rules and 65 inline sizes, from roughly 45
  distinct sizes down to 18 named ones.
- New named styles the layouts needed: Display sm, Stat sm, Stat xl, Numeral, Subtitle,
  Body 1 strong, Code, Label.
- **Kickers removed** from all 37 layouts; a gray Subtitle under the title replaces them.
- **Header** reads `Chapter · Presentation title · #N`, the moving part first.
- **Chapter cover** is the master `index/spread`: chapter name and description left, a large
  mono Numeral right, no slide numbers.
- **Icons:** Untitled UI Icons in `kit/icons/`, icon at the top of a card, text at the bottom.
- **Ingest** specified: text first, one low-res contact sheet, single-slide reads only with a
  named reason. Never read a picture of your own output.

## 0.1.0

- The skill, the flow (Ingest, Fidelity, Questionnaire, Outline, Fill, Assemble, Cohere,
  Deliver), and the kit: the 37-layout master deck, the tokens, the brand assets.
- **Composer** step and the Body 1 floor: title top, content anchored to y=1012,
  compact styles only on genuine overflow.
- Plugin and marketplace manifests; the Q3 deck as the first worked example.
