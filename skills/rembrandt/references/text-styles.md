# Text styles and density

The master's spec slide (`spec/type`, the last slide of `kit/master.html`) renders every one of these at true size with its class name and metrics. That slide is the source of truth — edit the token there and every layout follows. This file is the quick reference.

## Fonts (never any others)

- **Inter** — display headlines (the Helvetica Now stand-in).
- **Geist** — body and UI text.
- **Geist Mono** — meta labels, the header, stat numerals, footnotes.

## The hard rule

Every text node on a slide is **exactly one** of the styles below, matched on computed family, size and weight. The only exemption is text inside an `<svg>` chart (axis labels, legends). Nothing else: not a unit suffix at 0.45em, not a `<b>` at weight 700, not a card title "a little smaller to fit". `node kit/verify.js deck.html` enforces this and prints every violating combination with its slide number; Cohere runs it and it must pass.

## The styles

| Style | Class | Face / size / line / tracking | Used for |
|---|---|---|---|
| Display | `.display` | Inter 470 · 122 / 1.07 · -2.5% | cover titles |
| Display sm | `.display-sm` | Inter 500 · 88 / 1.08 · -2.2% | statements, chapter titles |
| H1 | `.title` | Inter 530 · 54 / 1.1 · -1.5% | one per slide |
| H2 | `.title-sm` | Inter 540 · 40 / 1.16 · -1.2% | card and column titles, index chapter names |
| H2 compact | `.title-sm--c` | Inter 550 · 33 / 1.2 · -1% | small cards (4-up, tagged), dense mode |
| Stat | `.num` | Inter 560 · 96 / 1 · -3% · tabular | numbers |
| Stat sm | `.num-sm` | Inter 560 · 58 / 1 · -2.5% · tabular | 6-grid and 9-grid numbers |
| Stat xl | `.num-xl` | Inter 560 · 220 / .95 · -3.5% · tabular | the one hero number |
| Numeral | `.numeral` | Geist Mono 400 · 96 / 1 · -2% · tabular | index and chapter numbers |
| Lede | `.lede` | Geist 400 · 25 / 1.52 · n800 | the one lead line of a slide |
| Subtitle | `.sub` | Geist 400 · 25 / 1.52 · n500 | gray line under a title, on slides that need one |
| Body 1 | `.body1` | Geist 400 · 21 / 1.6 | paragraphs, bullets, cells, annotations |
| Body 1 strong | `.body1s` | Geist 560 · 21 / 1.4 | names, small card titles, table lead cells, `<b>` |
| Body 1 compact | `.body1--c` | Geist 400 · 17.5 / 1.5 | dense mode only |
| Caption | `.img-cap` | Geist 400 · 17 / 1.55 | image captions, table notes |
| Code | `.code` | Geist Mono 400 · 17 / 1.55 | identifiers, mono table cells |
| Label | `.label` | Geist Mono 500 · 15 · +14% caps | chips, tags, legends |
| Meta | `.hd-meta` `.meta` | Geist Mono 500 · 14 · +9% caps | header right, table heads, card indexes |
| Foot | `.foot` | Geist Mono 400 · 12.5 · +7% | footnotes, sources |

`<b>` and `<strong>` inside a slide render at weight 560, so bold inside Body 1 is Body 1 strong, not an off-style 700. There is no kicker style any more; the eyebrow line above titles is gone from every layout.

## Header

The header meta reads `Chapter · Presentation title · #N`. The part that changes from slide to slide (the chapter) goes first, so the title and the number never shift position.

## Which style carries what

Reading text is anything the audience is meant to read as content: paragraphs, list items, card bodies, table cells, chart annotations, the right-hand column of a two-column slide. **Reading text is Body 1 (21px) or larger, always.**

| Text | Style |
|---|---|
| The one lead line of a slide | Lede 25 |
| Paragraphs, bullets, card bodies, table cells, annotations | Body 1 21 |
| Card and column headings | H2 40; H2 compact 33 in 4-up or tagged cards; Body 1 strong in 6-grids |
| Image captions, table notes, axis labels | Caption 17 |
| Chips, tags, legends | Label 15 |
| Header meta, table heads, card indexes | Meta 14 |
| Footnotes and sources | Foot 12.5 |

Caption, Code, Label, Meta and Foot are never used for reading text. A bullet at 17px is a defect, not a variant.

## Density modes

Every content template runs in one of two densities.

- **Regular** — H2 (`.title-sm`) + Body 1 (`.body1`). Budget ≈ 100 words on the slide. **The default.** If the content fits at regular with room to spare, the room stays: it is the design, not a problem to fill or shrink around.
- **Dense** — H2 compact (`.title-sm--c`) + Body 1 compact (`.body1--c`). Budget ≈ 150 words. Allowed only when a slide has been composed at regular (see Composer in SKILL.md) and still overflows. Never chosen for tidiness, balance, or to make a slide "look designed". Every dense slide is listed in the report.

Escalation when copy overflows: compose → rewrite tighter → switch to dense → switch to a higher-capacity template variant → split the slide. Scoped CSS is the last resort, and only for spacing. Shrinking type off the scale is never a step.

## Small-type failure modes (seen in practice, do not repeat)

- Copying a component from an example deck and inheriting its small sizes (`.img-cap` used as a bullet, `.vs-item` at 20, list items at 17.5). Correct the component to Body 1 before using it.
- Sizing the right column of a two-column slide with component CSS while the left column gets H2 and Lede. Both columns get the same floor.
- Hand-setting `font-size:18px` or `19px` because the number "looked right". Only sizes on the scale exist.

## Later

Density is driven entirely by these text styles today. Interactive components (collapsible sections, tabs) can layer on later without changing the type system.
