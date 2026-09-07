# Cohere, the final check

Cohere is the last step before delivery. It is a **reading and checking pass, not a visual one. Do not take or look at screenshots.** Work from the HTML source, the DOM, and the text. You are checking the finished deck two ways: against the original material, and against itself.

The ban is on pictures of **your output**: never render the deck you just built and look at it. `kit/verify.js` is the eyes, and it measures what a screenshot could only suggest. Reading images of the **source** at Ingest is a different thing and is allowed under the rules in SKILL.md, section Ingest.

Run it, fix everything it finds, then run it again. Report what it caught.

## A. Against the original material

Completion and fidelity. Go back to the content inventory you built at Ingest.

- [ ] Every point, metric, table, name, date, and quote from the inventory appears in the deck, or was explicitly a note-to-self you dropped, or is a placeholder the person approved in the questionnaire.
- [ ] Nothing was added beyond what the fidelity level allows. Verbatim: no rewording at all. High fidelity: no meaning changed, so spot-check three rewritten lines against their source. Liberal: every invented fact is in the report.
- [ ] Every questionnaire answer is in the deck, in the right place (dates on the event slide, roles on the team slide, URLs where they were promised).
- [ ] Nothing invented silently. Grep your own copy for numbers, dates, and names that were not in the source or the answers.

## B. In itself

Structure, completion and coherence, all checkable from the DOM and text.

**Zero. The gate**
- [ ] `node kit/verify.js "<your file>"` prints `VERIFY: PASS`. That single command runs all four audits and the house rules, and every one of them fails closed:
  - **shell**. The deck was copied from the master: slides are `section.slide` inside `#scaler`, `symbol#lockup` and `symbol#mk` are present, the logo is a `<use>` and not typed text, `window.__go` and `window.__count` exist, `#frame` gets a real size, no invented or stale classes. It also checks the v0.4 chrome: dark presenter surface, the `.hud-meta` group (`#counter`, `#deckname`, `#slidename`), the EDIT and FULL SCREEN buttons, and `script#rb-editor` with a live `window.__rbEditor`. A deck that fails this is not a Rembrandt deck, and the other audits cannot be trusted on it.
  - **styles**. Every text node is exactly one of the 18 (family, size, weight); SVG chart labels are the only exemption.
  - **colour**. Accents are the 500; a 600/700 only on a coloured surface; no tint as text; nothing outside the palette. See `references/color.md`.
  - **layout**. Geometry, which no style audit can see: no two pieces of text overlap (a `.num` without its `.stat` wrapper collides with its own label), nothing falls outside the 64px margins or below y=1012, and no content slide stops more than one grid row short of the bottom.
  - **house rules**. No em dash, no emoji or dingbats as content, Axoniq spelled correctly, header numbers zero-padded, no placeholder text, filename matching `kit/VERSION`.
- [ ] The audits are only meaningful on a deck built from the master. If `shell` fails, fix that first: the style and colour audits measure the master's classes, and a retyped deck can pass them by having none.

**Structure**
- [ ] First slide is a cover; last is the closing layout.
- [ ] Over ten slides → chapters present. Each chapter cover is the master `index/spread` (`idx-list` / `idx-row` markup, large mono Numeral per chapter, no slide numbers), with `.cur` on the chapter being entered and `.past` on the ones already shown. No separate index slide; no two slides showing the chapter list; no `chap-a` / `chap-b` divider used as a chapter cover.
- [ ] Slide order tells a coherent story (cover → chapters of content → close).

**Numbering**
- [ ] Header meta on every non-cover slide reads `Chapter · Presentation title · #N`, and `#N` matches the slide's actual 1-based position.
- [ ] The chapter label on each slide matches the chapter it belongs to.
- [ ] The counter total equals the slide count.

**Completion**
- [ ] No slide overflows. Check character counts per slot against `references/text-styles.md` budgets; check that no text node's content length exceeds its slot's max. (This is why Cohere needs no screenshot: fit is a measured property of the text, not a look.)
- [ ] No empty slots and no leftover placeholder text. Grep for: `xxx`, `lorem`, `ipsum`, `TODO`, `\[insert`, `Vestibulum`, `Lorem`, `{{`, `}}`.
- [ ] No broken images: every `<img>` has a real `src` (data URI or the checkerboard placeholder), none point at a missing file.

**Composition and type** (the Composer rules, measured)
- [ ] On every content slide, the bottom edge of the lowest content box is within 86px of y = 1012 (one grid row). Statement, quote, and hero-number layouts that are centered on purpose are exempt; nothing else is. `kit/verify.js` measures this.
- [ ] Nothing collides. A numeral and its label sharing a line is the signature of a component copied without its wrapper.
- [ ] No reading text (paragraph, list item, card body, table cell, annotation) has a computed `font-size` below 21px. Caption 17 only on captions and notes; Label/Meta/Foot only on chips, header meta, table heads, footnotes.
- [ ] No kicker (`.kicker`, eyebrow line with the dot) anywhere. Subtitles, where present, are `.sub`.
- [ ] Icons come from `kit/icons/` (Lucide) as inline symbols; none from any other set.
- [ ] Both columns of a two-column slide meet the same floor; the right column is not quietly smaller.
- [ ] Every slide that uses the compact styles is listed in the report with the reason it overflowed at regular.
- [ ] Any target-vs-actual or before-vs-after metric is drawn, not captioned.

**Coherence**
- [ ] No template family repeats on two consecutive content slides.
- [ ] At least six distinct template families across a fifteen-slide deck.
- [ ] Chapter labels, subtitles, and terminology are consistent across the deck.

**House rules**
- [ ] No em dashes (`—`) anywhere in the copy. Use periods, commas, or restructured sentences.
- [ ] The company is written **Axoniq** everywhere. Grep for `AxonIQ` and fix any hit.
- [ ] Only Geist, Inter, and Geist Mono are referenced; no other `font-family`.
- [ ] No raw hex colors or off-scale font sizes introduced in scoped CSS. Only tokens.
- [ ] The HUD names the deck, not the shell it was copied from. `#deckname` and the overview header both read the presentation's name, and `<title>` matches. `set_deck_name()` does all three.
- [ ] The delivered filename is `<Presentation name> - Rembrandt v<version>.html`, with the version read from `kit/VERSION`.

## Handy checks

Run these against the output HTML (adjust the filename):

```bash
# house rules
grep -n "—"        deck.html && echo "FAIL: em dash present"
grep -n "AxonIQ"   deck.html && echo "FAIL: wrong company spelling"
grep -niE "\b(lorem|ipsum|vestibulum|todo|\[insert)\b|xxx" deck.html && echo "FAIL: placeholder text"
grep -oE "font-family:[^;}]+" deck.html | grep -viE "geist|inter|mono|fallback|helvetica|arial|sans-serif|monospace|menlo|consolas" && echo "FAIL: stray font"

# broken images (should print nothing)
grep -oE '<img[^>]*src="[^"]*"' deck.html | grep -v 'data:image' | grep -v 'checker'

# slide count and header numbers, for a manual read
grep -c 'class="slide' deck.html
grep -oE '&middot; Product Perspective &middot; #[0-9]+' deck.html   # replace with the deck's title
```

```bash
# the gate: five checks in one command
node kit/verify.js "My Deck - Rembrandt v1.0.html"   # must print: VERIFY: PASS
# any hand-written font declaration outside the style classes is a smell
grep -oE 'style="[^"]*font-(size|weight|family)[^"]*"' deck.html
```

For per-slot fit and for composition, a short headless DOM script (no screenshot) is the reliable check. Load the file in headless Chromium at 1920×1080, then for each `section.slide` that is not a cover, chapter cover, statement, quote, or hero number, read `getBoundingClientRect()` of every element inside `.body` and take the largest `bottom`; it must be ≥ 926 (1012 minus one grid row). In the same pass, read `getComputedStyle(el).fontSize` of every element whose direct text is longer than 24 characters and is not inside `.label`, `.meta`, `.hd-meta`, `.foot`, `.img-cap`, `.code`, or a chip; it must be ≥ 21. Print the slide number and the value for every failure. Fix, re-run, then move on. Do not eyeball a render for overflow or for balance.

## After Cohere

State plainly: what Cohere caught and fixed, what gaps remain as approved placeholders, and (for High fidelity) the change report. Then deliver.
