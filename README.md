# Rembrandt

**Version 1.0.6** (`skills/rembrandt/kit/VERSION`). Rembrandt renders any input, a slide deck, a markdown file, a
PDF, or a plain description, into an Axoniq-branded presentation built to the master standard: the
real templates, the real tokens, the real brand assets. The output is always **one self-contained
HTML file** you can present from any browser.

Rembrandt ships as a Claude plugin for **Cowork**, the Claude desktop app. It does not run in
Claude Code: the five checks a deck must pass before delivery measure the rendered page in a real
browser, which Cowork provides and a laptop generally does not.

## Install

In Cowork: **Customize**, then **Plugins**, then **Add marketplace**, and enter `AxonIQ/rembrandt`.
Leave **Sync automatically** on and new versions arrive by themselves.

Start a new chat for each deck. Rembrandt reads the whole conversation, so leftovers from a previous
run bleed into the next one and no check can catch it.

## How it works

The model never designs. It **selects** a master template per slide, **fills** it with content
fitted to that template's budget, and runs a final **Cohere** check against the source and against
itself. All design lives in the kit; the model makes only editorial decisions.

The flow: Ingest, Fidelity, Questionnaire, Outline, Fill, Assemble, Adjust for fit, **Cohere**,
Deliver. See [`skills/rembrandt/SKILL.md`](skills/rembrandt/SKILL.md).

Every deck is delivered as `<Presentation name> - Rembrandt v<version>.html`, so any output can be
traced to the rules that made it.

## Layout

```
rembrandt/
├── .claude-plugin/
│   ├── plugin.json                 # plugin manifest
│   └── marketplace.json            # this repo is its own marketplace
├── skills/rembrandt/               # everything the skill needs, in one folder
│   ├── SKILL.md                    # the flow, the rules, fidelity, the questionnaire, Cohere
│   ├── references/
│   │   ├── templates.md            # the template catalogue, selected by meaning
│   │   ├── text-styles.md          # the 18 styles and the two density modes
│   │   ├── color.md                # when to use the 500, and what the other steps are for
│   │   └── cohere.md               # the final-check checklist
│   └── kit/
│       ├── master.html             # 37 layouts, tokens, header, viewer, editor, type spec
│       ├── verify.js               # THE GATE: five checks, one command
│       ├── VERSION                 # the version every rendered deck is stamped with
│       ├── assets/                 # official brand assets (logos, product marks)
│       └── icons/                  # Lucide icons (ISC, see icons/LICENSE)
├── CHANGELOG.md
└── README.md
```

## The gate

```
npm install && npx playwright install chromium     # once
node skills/rembrandt/kit/verify.js "My Deck - Rembrandt v1.0.html"   # must print VERIFY: PASS
```

Five checks, one browser, all failing closed. An empty or unrecognisable deck is a FAIL, never a
quiet pass.

| Check | What it catches |
| --- | --- |
| shell | the deck was copied from the master, not retyped from memory |
| styles | every text node is exactly one of the 18 styles |
| colour | accents use the 500; deep steps only on coloured surfaces; nothing off-palette |
| layout | collisions, text outside the frame, content stopping short of the bottom |
| house | em dashes, emoji, company spelling, padded numbers, placeholders, filename |

The master passes its own gate. If it ever does not, that is the bug.

## Presenting

Arrow keys move. `G` opens every slide at once. `F` is full screen. `E` turns on editing: text
becomes editable and icons and cards can be removed, and the type system holds no matter what gets
pasted in. Edits live in the browser until saved; Save writes a file.
