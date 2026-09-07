---
name: rembrandt
description: Turn any slide deck, markdown, PDF, or plain description into a presentation rendered to the Axoniq master standard: the real templates and tokens, always as a single self-contained HTML file. Use whenever someone at Axoniq wants to make, build, format, rebrand, or clean up a slide deck, presentation, or slides.
---

# Rembrandt

**Version: read `kit/VERSION`.** Every deck you deliver carries that version in its filename, so
any output can be traced back to the rules that produced it. See **Deliver** below.

Rembrandt turns raw material into an Axoniq-branded presentation. The output is always **one self-contained HTML file** that renders to the master standard: the real slide templates, the real tokens, the real brand assets. The person feeds in a deck, a markdown file, a PDF, or just a description, and gets back a finished deck they can present from any browser.

## Before you start

Three things, in order, before you touch the input.

**1. Rembrandt only runs in Cowork.** Before anything else, confirm you can launch a browser:
`node -e "require('playwright')"`. If that fails, you are not in Cowork, and you must **stop**:

> Rembrandt only works in the Claude desktop app. The checks a deck has to pass before delivery
> measure the rendered page in a real browser, and this environment has none. Open this in Cowork
> and I will render it there.

Do not offer to build a deck without the checks, do not install a browser, and do not deliver
something unverified. A deck that skipped the gate is not a Rembrandt deck, whatever its filename
says. This is the one condition where the right answer is to build nothing.

**2. Say which version you are, and name the model to use.** Read `kit/VERSION`, then open with one line:

> Rembrandt v1.0. This runs best on Opus 5 at Low effort. Sonnet is not faster here, and Haiku will not produce a usable deck.

That is a recommendation, not a question. Do not wait for an answer, and do not ask the person to confirm which model is running: a session cannot verify which model is serving it, the configured identifier can differ from the model actually answering, and the filename no longer records it. If the person says they are on Haiku, tell them plainly that the deck will not come out right, and let them decide.

**3. One run per chat.** If this conversation has already done any of the following, **stop, tell the person to start a new chat, and wait** rather than proceeding:

- run Rembrandt before, on this source or any other;
- loaded, quoted, or discussed an earlier version of these rules;
- been used to design, edit, review or debug the skill, the kit, or the master deck.

The reason is mechanical, not ceremonial: an earlier version's text stays in the context window for the rest of the conversation, and rules already in context win over the file on disk. A deck built in a contaminated chat is not a v`<version>` deck whatever its filename claims, and no audit can catch it, because the wrong rule will have been applied consistently. Say it plainly, in one sentence: "This chat has already run Rembrandt, so its older rules are still in my context. Start a new chat and invoke me there, and I will render this properly."

If the conversation is clean, carry on to Ingest.

## The hard rule

**Every text node on every slide is exactly one of the text styles. No exceptions except labels inside an SVG chart.**

The styles are the 18 classes documented in `references/text-styles.md` and rendered live on the master's last slide: Display, Display sm, H1, H2, H2 compact, Stat, Stat sm, Stat xl, Numeral, Lede, Subtitle, Body 1, Body 1 strong, Body 1 compact, Caption, Code, Label, Meta, Foot. A text node is on-style when its computed family, size and weight match one of them exactly. There is no "a bit smaller to fit", no `font-size` written by hand, no `font-weight:600` on a `<b>`, no 0.45em unit suffix. If the words do not fit in the style, change the words, the template, or the split; never the style.

`node kit/verify.js deck.html` checks this in a headless browser and prints every violating combination with its slide number. It runs in Cohere and it must pass before delivery. If Rembrandt had only one rule, this would be it.

## The second rule

**You do not design. You select, fill, compose, and cohere.**

All design already exists in the kit: 37 layouts, the tokens, the header, the viewer shell, the type system, the icon library. The kit lives at the Rembrandt root: `${CLAUDE_PLUGIN_ROOT}/kit/master.html` when installed as a plugin, or `kit/master.html` from the repo. (Every `kit/...` and `references/...` path below is relative to that root.) Your job is editorial:

1. Decide **what each slide is trying to say**.
2. Pick the master template that says that.
3. Write the content to fit it.
4. **Cohere**. Check the finished deck against the source and against itself.

You may write **scoped CSS** for spacing and fit, and you may **invent a layout as a last resort**, but the master is always the source of truth. When the master has a template for the job, use it exactly, and never restyle it or substitute a look-alike.

## The flow

Run these in order. Do not skip 2 or 3 for existing material, and never skip 7 or 9.

1. **Ingest.** Extract the text, then look at the source only where the text is ambiguous. See **Ingest** below for the exact procedure and its stopping rule. Build a content inventory: every point, metric, table, name, date, quote, sequence, and image. Note what is a real content point versus a note-to-self ("show sample", "keep this?", "dates").
2. **Fidelity** (existing material only, skipped when building from scratch). Ask which level applies, once, before writing anything. See **Fidelity** below.
3. **Questionnaire.** Collect **all** missing information in one pass. See **Questionnaire** below. Do this before outlining. A deck built on holes wastes everyone's time.
4. **Outline.** Map the inventory to templates by meaning (see `references/templates.md`). Apply the deck rhythm rules: open with a cover, use chapters once the deck passes ten slides, never repeat a template back to back, close with the closing layout.
5. **Fill.** Write each slide's copy to the template's density budget (see `references/text-styles.md`). This is where most of the work is: it is writing, not layout.
6. **Assemble.** **Copy** the shell out of `kit/master.html` with a script. Do not retype it. See **Assemble** below for the exact method; it is three lines of Python and it is not optional.
7. **Compose.** Distribute every slide vertically the way the master does: title at the top, content anchored to the bottom, air in between. See **Composer** below. Composition comes before any fit decision, because most "does not fit" and most "looks empty" problems are composition problems.
8. **Adjust for fit.** Only if a composed slide still overflows at regular density, in this order: rewrite tighter, switch to the dense density mode, switch to a higher-capacity template variant, or split the slide. **At Verbatim the first rung does not exist**, so the order there is density, then template, then split: never reword to make something fit. Only then touch scoped CSS. Never let text spill, and never shrink type to make it fit.
9. **Cohere.** Run `node kit/verify.js "<your file>"` until it prints PASS, then do the reading checks. See **Cohere** below.
10. **Deliver.** Name the file, publish as an artifact, hand over the HTML. See **Deliver** below. Report every gap you filled, every place you invented content, and every slide that went dense.

## Ingest

**Text is the content of record. Pictures of the source are a lookup, not a reading pass.** Follow this in order and stop as soon as the inventory is unambiguous.

1. **Extract the text.** `markitdown source.pptx` (or the `pptx` / `pdf` skills) gives you every string, slide by slide. For a pptx, `unzip -o source.pptx -d x` then the slide rels give you the real images to carry over. This is where the content comes from; nothing below replaces it.
2. **One contact sheet, one read.** If the source is a deck and layout carries meaning, render it once at low resolution and look at all the slides in a single image:
   ```bash
   soffice --headless --convert-to pdf source.pptx   # LibreOffice; skip if absent
   pdftoppm -jpeg -r 50 source.pdf slide             # ~50 dpi is enough to see structure
   python3 -c "from PIL import Image; import glob; fs=sorted(glob.glob('slide-*.jpg')); ims=[Image.open(f) for f in fs]; w,h=ims[0].size; c=4; r=-(-len(ims)//c); sheet=Image.new('RGB',(w*c,h*r),'white'); [sheet.paste(im,((i%c)*w,(i//c)*h)) for i,im in enumerate(ims)]; sheet.save('contact.jpg',quality=80)"
   ```
   Read `contact.jpg`. That is one image read for the whole deck, and it is usually all the seeing the job needs.
3. **Full-size single slides, only with a reason.** Read `slide-NN.jpg` on its own only when the extracted text for that slide is genuinely ambiguous and the deck cannot be built without resolving it. Legitimate reasons: two labels ran together (`POLITIE NLIND · KADASTER`), a chart whose values never appear in the text, a table whose cells lost their columns, a diagram whose arrows carry the meaning, a figure you cannot attach to its label. Write the reason into the inventory. If the text is clear, do not open the picture: "let me check the rest of the slides" is not a reason, and reading nineteen slides one at a time to confirm what markitdown already gave you exactly is waste.
4. **If LibreOffice is absent,** skip straight to the questionnaire and ask about the specific ambiguities instead. Never guess a number off a chart you could not read.

Two hard limits on this step:

- **Never read a picture of your own output.** Cohere is a text and DOM pass; `kit/verify.js` is the eyes. Rendering the deck you just built and looking at it is the one visual habit this skill forbids outright.
- **You are reading the source for content, never for design.** The source's own agenda slide, its type sizes, its card look, its color: none of that comes across. Every layout decision comes from the master. A source deck that looks good is still not a template.

## Assemble

**You copy the shell. You never write it.** The shell is the tokens, the `:root` palette, every
text-style class, the brand sprite (`symbol#lockup`, `symbol#mk`, the product marks), the header,
the viewer script and the HUD. It is about 25KB of CSS and JS that has to be byte-identical, and a
model that types it from memory produces something that looks right and is broken in a dozen
invisible ways: invented class names, a `<svg><text>Axoniq</text></svg>` in place of the logo, a
viewer that never sizes its frame, and audits that pass because they cannot find any slides.

Split the master into a head and a tail, put your slides between them:

```python
M = open(f"{KIT}/master.html").read()
head = M[:M.index('<section class="slide')]                    # doctype, CSS, sprite, #app, #stage, #scaler
tail = M[M.index('  </div></div>\n</div>\n<div id="hud">'):]   # HUD, overview, the viewer script
open(out, 'w').write(head + "\n\n".join(slides) + "\n" + tail)
```

**Name the deck in the chrome.** The tail carries the presenter HUD and the overview header, both
still saying "Master Slide Deck". Three replacements, no helper:

```python
import re
name = "Bi-Weekly ONE House"
tail = re.sub(r'(<span id="deckname">)[^<]*', lambda m: m.group(1) + name, tail, count=1)
tail = re.sub(r'(<div class="ov-head"><b>)[^<]*', lambda m: m.group(1) + 'AXONIQ &middot; ' + name.upper(), tail, count=1)
head = re.sub(r'<title>[^<]*</title>', f'<title>{name}</title>', head, count=1)
```

Then, and only then:

- **Each slide is a `<section class="slide" data-name="<template>" data-chapter="<chapter>" hidden>`**, a direct child of `#scaler`, with `data-name` set to the master template you used (`cards/3-up`, `index/spread`), not to the slide's title. The first slide alone has no `hidden`.
- **Copy each slide's markup from its master section too**, then replace the words. Copying `cards/3-up` and rewriting three cards is the whole job. Writing a `<div class="card-item">` of your own invention is not.
- **A component is its markup, not its look.** The master's components carry their structure in their wrappers, and the wrapper is what makes them work. A stat is `<div class="stat"><span class="s">label</span><span class="v num">10-13</span><span class="l">the reading line</span></div>`: `.stat` is the flex column that stacks those three, and without it a 96px numeral and a 21px label become inline neighbours that collide. A `.idx-row` is the grid that puts the numeral on the right. A `.card` is the padding and the border. Take the whole wrapper every time. If you find yourself writing `<span class="num">` next to a bare text node, you have dropped a wrapper.
- **Two templates on one slide is inventing a layout.** It is allowed as a last resort and it is flagged in the report, but you still use each component's own markup inside your composition, and you still run the layout audit, which is what catches the collision you are about to cause.
- **Any CSS you add is scoped and built from the style tokens**, appended before `</style>`. Never redefine a text style, never introduce a class that duplicates one (`.body-1` when `.body1` exists is the signature of a retyped shell, and `kit/verify.js` fails on it).
- **Renumber the headers at the end**, from the final slide order, zero-padded: `#02`, not `#2`.

## The shell chrome

The viewer around the slide is part of the deck and you never rebuild it. Copying the shell gets
you all of it, and `kit/verify.js` fails the deck if any piece is missing or out of date.

- **It is dark.** The presenter surface is `--ch-bg` and the HUD is `--ch-panel`, so the slide is
  the only lit thing on screen. Never lighten it back; a light chrome is the signature of a deck
  copied from a pre-0.4 shell, and the audit says so by name.
- **The HUD reads `07/23 . Deck name . slide name`**, in that order, with the buttons to the right.
  The counter and the deck name are pinned and the slide name grows into its own reserved box, so
  nothing on the bar ever shifts as you page through. `#counter`, `#deckname` and `#slidename` live
  inside `.hud-meta`; do not reorder them.
- **Three buttons: EDIT, FULL SCREEN (F), GRID (G).** Full screen takes the slide edge to edge and
  hides the chrome after a few seconds of stillness.
- **Every deck ships the editor**, inlined in the master as `script#rb-editor`, so copying the master carries it. The person can
  fix a typo, retype a card, or hide an icon without coming back to you. Editing is
  `contenteditable="plaintext-only"` with a paste interceptor, so a hand edit cannot introduce a
  font, a size or a colour, and the hard rule survives contact with a human. A live geometry guard
  runs the layout-audit logic in the page and warns when an edit overflows the frame.
- **First time the person clicks EDIT they get a dismissible notice**: edits live in the browser and
  not in the file, Save writes a file, and Rembrandt may overwrite hand edits if the file is fed
  back into the skill. That last line is real. If someone hands you an edited deck, read it as
  source material, do not silently regenerate over it.

## Deliver

The output filename is:

```
<Presentation name> - Rembrandt v<version>.html
```

- **Presentation name** is the deck's name as it appears in the header meta, in its own capitalisation: `Bi-Weekly ONE House`, `Product Perspective`. That is the short name, not the full cover headline.
- **version** is the contents of `kit/VERSION`, major and minor only: `v1.0`. Read the file; never guess it.

So: `Bi-Weekly ONE House - Rembrandt v1.0.html`. The spaces and the hyphens are part of the format,
and `kit/verify.js` fails a deck whose filename does not match it, or whose version does not match
`kit/VERSION`. The point is that any deck can be traced to the rules that made it without opening it.

## Color

**When you use color, use the 500.** That is the one accent step: `--blue-500`, `--orange-500`,
`--success-500`, `--warning-500`, `--error-500`, `--violet-500`. An icon, a bar, a rule, a dot, a
chart series, a colored word: all the 500.

The other steps are not alternatives to it, they have jobs:

- **25 / 50 / 100 / 200** are **surfaces** and the borders on those surfaces: a tinted card, a chip
  background, a highlighted table column, a code pill. Never text.
- **600 / 700** are for **text or a glyph sitting on a colored surface**, where the tint underneath
  would leave the 500 too faint: the label inside a chip on its own 50 background, a figure on a
  tinted band. On a plain white slide they are off-rule, and they read as a muddier version of the
  500 rather than as a deliberate choice.
- **Neutrals** (`--n25` to `--n950`, `--ink`) are not "using color" and are unrestricted. Most text
  on a Rembrandt slide is a neutral; reach for a hue only when the hue means something.

`node kit/verify.js deck.html` enforces this. It reads the palette from the deck's own
`:root`, then flags a 600/700 on a plain ground, a surface tint used as text, and any color that is
not in the palette at all. It runs in Cohere and it must pass. `references/color.md` has the
worked cases.

## Fidelity

For existing material, ask which level applies before writing:

- **Verbatim**. Zero rewriting. The source words land on slides as written. Fit comes only from template choice, density, and splitting. Never reword, even to fix a widow.
- **High fidelity**. Your content, minimal edits for aesthetic fit, no semantic changes. Compress and tighten, never change meaning. Finish with a short change report: old line, new line, why.
- **Liberal**. Full editorial control. Rewrite freely to make each slide land.

When the source is speaker notes rather than prose ("Show sample", "Dates", "Tickets CTA"), say so when you ask, because Verbatim is meaningless against notes-to-self.

## Questionnaire

Rembrandt's first real interaction is collecting what the source is missing. Scan the inventory for holes (undated events, unnamed people, "show URL", "show sample", empty roles, TBD figures) and ask for **all of them at once**, grouped, before you outline.

- Accept a **URL as an answer**. If the person answers "https://axoniq.io/our-people" or a concept page, go fetch it and use what it says. A pasted link is a complete answer, not a deferral.
- Offer a visible **placeholder** option for anything genuinely not-yet-known ("DATES · TBD" in mono), so the deck can ship with the hole marked rather than blocked.
- Ask once. If you are working unattended, state your assumptions at the top of the deliverable and proceed.

Never invent a date, a name, a figure, or a URL silently. Either ask, use a marked placeholder, or (Liberal only) draft it and flag it in the report.

## Template selection

Select by what the slide is **trying to say**, then let budgets veto, never the other way around. A timeline is not "events across time"; it can be a user journey, an adoption path, or a plan, and each reads differently. `references/templates.md` is the catalog: each template carries what it is for, what it is *not* for, and worked examples. Read it before outlining.

## Density and type

Every content template supports two density modes driven by text styles: **regular** (~100 words, Body 1 / H2) and **dense** (~150 words, Body 1 compact / H2 compact). `references/text-styles.md` documents every style; the master's spec slide renders them live.

**Regular is the default and Body 1 (21px) is the floor for reading text.** The compact styles exist for exactly one situation: a slide that still overflows after it has been composed at regular density. They are not a way to make a slide look designed, tidy, or balanced. Presentation text is read from the back of a room; if it fits with room to spare at 21px, that room is the design.

- Body 1 `21` for every paragraph, list item, card body, table cell, and chart annotation. Body 1 strong for names, small card titles, and table lead cells. Lede `25` for the one lead line of a slide; Subtitle `25` gray under a title.
- Caption `17` only for image captions and table notes. Code `17` mono for identifiers. Label `15`, Meta `14`, Foot `12.5` only for chips and legends, header meta and table heads, footnotes and sources. None of these are body text.
- Never write a `font-size`, `font-weight`, or `font-family` by hand. Use the class. If a component you copied from an example deck carries its own sizes, correct the component, do not inherit it.
- A slide may go dense only after Composer has run and the slide still overflows. Every dense slide is listed in the report.

## Titles, subtitles, no kickers

There is **no kicker** (the small mono line with the orange dot above a title). Not on covers, not on content slides, not anywhere. Every slide has one H1 title. Slides that need context get a **Subtitle** (`.sub`, gray Lede metrics) directly under the title; most slides do not need one. Chapter context lives in the header, not above the title.

## Composer

The master composes every slide the same way: the **title occupies the top of the content area**, the **content is anchored to the bottom edge** (y = 1012), and the space between them is deliberate air. Nothing floats in the top half with a dead band under it. Composer applies this to every content slide after Assemble:

1. **Title top, content bottom.** The content block is bottom-anchored (`margin-top:auto` in a column flex, or `align-content:end` on the grid). When there are several stacked groups, distribute them (`justify-content:space-between`) so the last one still touches the bottom row.
2. **Inside a card or column, text sits at the bottom.** Media, avatars, numerals, and icons take the space freed above the text and grow into it. A card is never a small cluster of text in the top-left of a large box.
3. **Two-column slides compose both columns.** The right column gets the same treatment as the left: a heading at Body 1 or larger, bottom-anchored content, no component CSS that is quietly smaller than the left side.
4. **No dead band.** After composing, no slide has more than one grid row (86px) of empty canvas between the lowest content and y = 1012, unless the layout is a statement or hero number that is centered on purpose.
5. **A metric needs a picture.** Numbers with a comparison (target vs actual, before vs after) are drawn (gauge, bars, delta), with the hero numeral in Display or Stat style and the reading line anchored under it. Two figures and a caption is not a slide.

Composer is a DOM property, not a look: the bottom edge of the last content box is measurable, so Cohere checks it without screenshots.

## CSS and inventing layouts

- You may write **scoped CSS** for spacing, spans, and alignment using existing tokens. You may not introduce new colors, new fonts, or sizes off the type scale.
- You may **invent a layout** only as a last resort, and only inside the fixed frame: keep the header, grid, tokens, and components, compose freely, and flag it in the report. A layout you keep inventing is a signal it should become a named template.

## Chapters

If a deck passes **ten slides**, use chapters. The **chapter cover is the master's `index/spread` template** (slide 3 of the master): H1 "Agenda" with a Subtitle bottom-left, and on the right one `idx-row` per chapter with the chapter name (H2), a one-line description (Body 1), and the **chapter number as a large mono Numeral** on the right edge. There are no slide numbers on it. It is shown before each chapter with two state classes: `idx-row.cur` on the chapter being entered (its numeral in ink), `idx-row.past` on chapters already seen (grayed). Chapters not yet reached keep the light numeral.

Do not build a chapter cover from any other source: not the source deck's agenda, not the example decks, not the master's `chap-a`/`chap-b` dividers (those are title dividers, not indexes). There is no separate "index" slide and no separate big-title divider; the first chapter cover doubles as the opening agenda. Never render two slides that both show the chapter list.

## Assets

Use the real brand assets in `kit/assets/`: the company lockup and icon, and the product marks (Axon Framework `#FF4405`, Axoniq Framework and Server `#2E90FA`, Insights `#7A5AF8`). Embed images the deck needs as data URIs so the output stays a single file. When an image is missing, use the checkerboard placeholder; never leave a raw broken image.

The company mark appears at two sizes and no others: the header lockup, and the 84px icon on the closing slide. A dark cover carries its own backdrop gradient; it does not need a decorative sphere or an enlarged mark behind the title, and the master no longer has one.

## Icons

The icon library is **Lucide** (`kit/icons/*.svg`, 2,057 line icons, 24px grid, 2px stroke, ISC licensed). Names are Lucide's own, so `zap`, `shield-check`, `trending-up`, not a vendor-numbered variant. Use them, especially where a card or column has air above its text: the icon sits at the top, the text sits at the bottom, and the space between is the composition (see the master's cards/3-up, cards/6-grid, numbers/6-grid). Inline each icon you use as a `<symbol id="i-<name>">` in the deck's sprite and place it with `<svg class="ico"><use href="#i-<name>"/></svg>`; `.ico` is 40px, ink, and takes color from tokens only. Pick by meaning, one icon per card, never a decorative row of them. Never use another icon set, emoji, or Material icon names.

## Cohere (required final step)

Cohere is two parts: a gate you run, and a reading pass you do.

**The gate.** One command, and it must print PASS before you deliver anything:

```bash
node kit/verify.js "Bi-Weekly ONE House - Rembrandt v0.5 - Opus 5.html"
```

It runs five checks and fails closed on every one:

- **shell**. The deck was copied from the master: slides are `section.slide` in `#scaler`, the sprite and viewer are intact, no invented classes.
- **styles**. Every text node is exactly one of the 18.
- **colour**. Accents are the 500.
- **layout**. Geometry a style audit cannot see: no two pieces of text **collide**, nothing sits **outside the frame** (past the 64px margins or below y=1012), and no content slide leaves a **dead band** more than one grid row short of the bottom. This is the check that catches a stat built without its `.stat` wrapper, a card that overflows, and a slide that is a title floating above nothing.
- **house rules**. No em dash, no emoji, Axoniq spelled right, `#NN` padded, filename correct for `kit/VERSION`.

If it says FAIL, you have not finished; fix and run it again. Never report a deck as done without pasting its PASS line.

**The reading pass.** The gate cannot read. Everything below is your job, and it is **not a visual one, so do not use screenshots**. Work from the HTML, the DOM, and the text. Check two things:

**Against the original material**, for completion and fidelity.
- Every content point, metric, table, name, and date from the inventory is present in the deck (or was explicitly dropped as a note-to-self, or is a marked placeholder the person approved).
- Nothing was invented beyond what the fidelity level allows; for High fidelity, no meaning changed.
- Every questionnaire answer landed where it belongs.

**In itself**, for coherence, completion, and structure.
- Structure: cover first; chapters used if over ten slides; each chapter cover is the master `index/spread` with `.cur` and `.past` correct for its position; closing slide last. No kicker anywhere.
- Styles and colour: `node kit/verify.js deck.html` passes. Every text node is exactly one style; every accent is a 500, with the deep steps only on coloured surfaces.
- Numbering: header meta (`Chapter · Title · #N`) matches actual slide order; the counter total is right.
- Composition: every content slide's lowest content box reaches within one grid row of y = 1012; no `font-size` below 21px on reading text; no off-scale sizes; dense slides are listed in the report.
- Completion: no slide overflows its budget; no empty slots, no leftover placeholder text (`xxx`, `lorem`, `TODO`, `[insert]`); no broken images.
- Coherence: no template repeats back to back; chapter labels are consistent; the deck reads as one deck.
- House rules: **no em dashes** anywhere in the copy; the company is written **Axoniq** everywhere (never AxonIQ); fonts are only Geist, Inter, Geist Mono.

`references/cohere.md` is the concrete checklist with the exact commands and DOM checks. Fix everything Cohere finds, then re-run it. Report what it caught.

## Output contract

- One self-contained `.html` file, named `<Presentation name> - Rembrandt v<version>.html`. Fonts from Google Fonts with real fallback stacks; all CSS, JS, and images inline.
- 1920×1080 canvas, 12-column grid (margin 64, gutter 20, content from y=184).
- Every non-cover slide carries the header: Axoniq logo on the dotted pattern, spark gradient as the bottom border, and on the right `Chapter · Presentation title · #N` (the part that changes goes first, so the title and number never shift).
- Keyboard navigation, the grid overview, full screen, and the editor come from the shell. Keep all of it; see **The shell chrome**.
- Publish it as an artifact and deliver the file.
