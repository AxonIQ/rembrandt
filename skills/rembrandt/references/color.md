# Color

The palette is a neutral ramp plus five hues and the brand orange. Every value is a token
in the master's `:root`; never write a hex.

## The rule

**When you use color, use the 500.**

| Step | What it is for |
|---|---|
| **500** — `--blue-500` `--orange-500` `--success-500` `--warning-500` `--error-500` `--violet-500` | Every accent. An icon, a bar, a rule, a dot, a chart series, a colored word, a status glyph. This is the default and usually the only step a slide needs. |
| **25 / 50 / 100 / 200** | Surfaces and the borders on them: a tinted card, a chip background, a highlighted table column, a code pill. Never text. |
| **600 / 700** | Text or a glyph **on** one of those surfaces, where the tint underneath leaves the 500 too faint. A chip's label on its own 50 ground. Nothing else. |
| **Neutrals** `--n25` … `--n950`, `--ink` | Not "using color". Unrestricted, and most slide text is one of these. |

`--blue` and `--orange` are the same values as `--blue-500` and `--orange-500`; prefer the explicit
`-500` spelling so the step is visible in the code.

## Worked cases

- **A stat in the success hue on a white slide.** `--success-500`. Not 700: on white the 700 reads
  as a duller green, not a stronger one.
- **A status chip.** Background `--success-50`, border `--success-200`, label `--success-700`. Three
  steps, each doing its job. This is the case the 700 exists for.
- **A KPI icon above its number.** `--n500` if the icon is furniture, the hue's 500 if the icon
  carries the status. Never a 600.
- **A chart with three series.** Three 500s, or one 500 plus neutrals for the comparison lines. A
  budget line is `--n400`, an actual is `--blue-500`, a forecast is `--orange-500` dashed.
- **A tinted callout band.** Surface `--violet-50`, and then the text on it may be `--violet-700`.
- **A dark cover.** White and `rgba(255,255,255,…)` text; the hue lives in the backdrop gradient.
- **An accent rule or an underline.** The 500, at 2px or more. A hairline in a hue at 1px
  disappears; use a neutral hairline instead.

## What goes wrong

The failure is always the same shape: reaching for a 600 or 700 because the 500 feels bright, on a
ground where nothing supports it. That produces a deck of slightly-off accents that no longer match
each other or the brand. If the 500 feels too loud, the answer is less color, not a darker step:
make the element smaller, make it a neutral, or put the hue on a surface and the text on top of it.

The second failure is a surface tint used as text. A `--blue-200` label on white is unreadable, and
it is a sign the element wanted to be a chip.

## Check it

```bash
node kit/verify.js deck.html    # must print: VERIFY: PASS
```

It reads the palette from the deck's own `:root`, so it stays correct if the tokens change, and it
reports three kinds of failure: `deep-on-plain` (a 600/700 with no colored surface under it),
`surface-as-text` (a 25/50/100/200 used as a text color) and `not-a-token` (a color outside the
palette). Cohere runs it and it must pass.
