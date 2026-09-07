# Template catalog and selection guide

Select by what the slide is **trying to say**. Budgets only veto a choice; they never make it. Every template below is a section in `kit/master.html`. Copy it from there, do not rebuild it. Open the master's grid overview (press `G`) to see them all.

## How to choose

Ask, in order: What is this slide's job? What shape is the content? How much of it is there? The first two pick the template family; the third picks the variant.

| The slide is trying to say… | Family | Variant by |
|---|---|---|
| Here is the title | cover | context vs backdrop |
| Here is where we are in the deck | chapter cover = `index/spread` (master slide 3, large mono Numerals) | states `.cur` / `.past` on the rows |
| Here is a target against an actual | numbers/hero + gauge or before/after bars | one comparison per slide |
| Here are N parallel points of equal weight | cards | 2 / 3 / 4 / 6 by count |
| Here is a picture and a little context | image | three-quarter, top, bottom (wide), half-bleed by image shape |
| Here are the numbers | numbers | hero (one) / 4 / 6 / 9 by count |
| Here are structured records | table | comparison / matrix / dense / definitions by rows and cell length |
| Here is work and its status | plan | detailed (with descriptions) / compact |
| Here is how things unfold | roadmap | quarters (spans) / timeline (moments) |
| Here are the people | team | 1 / 3 / 5 / 6 by headcount |
| Here is one idea that must land | statement, quote, numbers/hero | n/a |
| Here are two things set against each other | versus, or table/matrix if more than two columns | n/a |
| Here is how the pieces connect | diagram | n/a |
| It fits none of these | free/body (the escape hatch) | used sparingly, flagged |

## Semantics matter more than shape

The same visual template carries different meaning depending on the content. Read the intent, not the form:

- **A timeline** is not only dates. It can be a **user journey** (steps a person takes), an **adoption path** (how a customer grows into the product), a **plan** (what happens when), or a **release calendar**. Same axis, different story, so write the labels to match the story, and pick `roadmap/timeline` for moments, `roadmap/quarters` for spans.
- **A versus** is not only competition. It can be **before / after**, **old way / new way**, **open source / commercial**, or **their approach / our approach**.
- **Cards** are not only features. They can be **reasons**, **steps**, **audiences**, **risks**, or **principles**.
- **Numbers** are not only metrics. A single hero number can be a **claim**, a **milestone**, or a **headline**; a grid can be a **scorecard** or an **operations snapshot**.
- **A table** is not only data. It can be a **comparison**, a **glossary** (definitions variant), a **matrix** of capability vs option, or a **fleet snapshot**.

When two templates could carry the meaning, prefer the one that shows the *relationship* the slide is about (sequence, contrast, magnitude, hierarchy) rather than the one that merely holds the words.

## `not_for`, when NOT to use a family

- **cards**. Not for a sequence where order matters (use roadmap or a numbered plan) and not for two things in contrast (use versus).
- **numbers**. Not for a number that needs its supporting rows to make sense (use a table); not to dress up a figure the audience will not remember.
- **table/matrix**. Not for two columns (use versus); not when the cells are prose (use cards or definitions).
- **chapter cover**. Never render the chapter list on any other slide type; the chapter cover owns the index. Do not use a chapter cover as a content slide. Never build it from the source deck's own agenda or from `chap-a`/`chap-b` (those are title dividers).
- **numbers** (again). A target-vs-actual or before-vs-after figure is never two numerals and a caption; it is drawn (gauge, bars, delta) with the hero numeral and the reading line anchored under it.
- **free/body**. Not a convenience. Reach for it only when no template fits, and flag every use.

## The chapter cover, exactly

Copy the master's `index/spread` section (slide 3) unchanged: left column with H1 `Agenda` and a Subtitle, both pinned to the bottom; right column `idx-list` of `idx-row`s spanning columns 5 to 13, each row `idx-name` (H2) + `idx-desc` (Body 1) on the left and `idx-num` (Numeral, the chapter number, large mono) on the right. No slide numbers. Then set the states for the position in the deck:

- `idx-row.cur` on the chapter being entered: its numeral in ink.
- `idx-row.past` on chapters already presented: name and description in `--n400`, numeral in `--n200`.
- Rows not yet reached stay as the master renders them (numeral `--n300`).

The first chapter cover is the deck's agenda. No slide called "Agenda" or "Index" exists separately. No kicker.

## Icons in cards

Cards and stat tiles with air above their text carry one Lucide icon (`kit/icons/`) at the top; the text sits at the bottom (`cards/3-up`, `cards/6-grid`, `numbers/6-grid` show it). One icon per card, chosen by meaning, 40px, ink or `--n500`. Never a row of icons, never emoji, never another set.

## Composition (applies to every content template)

The master anchors content to the bottom of the frame and pins the title to the top; the air is between them. When you drop content into a template, keep that: the content block ends within one grid row of y = 1012, cards put their text at the bottom and let media and avatars take the top, stacked groups are distributed rather than piled under the title. SKILL.md, section Composer, has the rules; Cohere measures them.

## Rhythm rules (deck level)

- Open with a cover; close with the closing layout.
- Over ten slides: chapters, with the master `index/spread` as the chapter cover (`.cur` on the current chapter, `.past` on those already shown). No separate index slide.
- Never place the same template on two consecutive content slides. Vary the family or the variant.
- Aim for at least six distinct template families across a fifteen-slide deck. Monotony is a defect Cohere checks for.
