# Design system

The look and the rules every page follows: the character sheet, the DM
Helper and the site pages (sign-in, Your characters, Account). Agreed with
the owner on 2026-10-27, ahead of a dark theme.

**Status: partly applied (2026-10-27).**

- Applied everywhere (the sheet, the DM Helper, the sign-in, Your
  characters and Account pages): the colour tokens in light and dark, the
  light/dark toggle in each header, Barlow and Spectral. The tokens live in
  `src/ui/tokens.js`; `scripts/build-legacy.mjs` writes them into every
  page's `<head>`. Each page's older variable names now point at the tokens.
- Every page passes the contrast check in both themes
  (`scripts/contrast-scan.js`, run in the browser on a page served from the
  repo).
- Fields (boxed and open) are applied (stage 4a). Not yet: buttons, the
  surfaces, and moving non-interactive text off the action colour (section
  titles, the round number and such are still brass). Until then, new work
  should follow this document, and anything that looks different from it
  should say why in a comment next to it.

Live references (prototypes, not wired to the app):

- `prototypes/ui-preview.html`: a sheet-like screen in the system, light and
  dark, with every control's states and a "Show type roles" switch.
- `prototypes/style-directions.html`: the palette, with contrast measured live.
- `prototypes/type-specimen.html`: Barlow and Spectral, measured, and the
  alternatives that were considered.

## Principles

1. **Usable first, then attractive.** Contrast meets WCAG AA everywhere and
   AAA for body text (see Accessibility).
2. **The action colour is only for what you can press.** Buttons, the focus
   ring, links. Never results, labels or decoration.
3. **Destructive never borrows the action colour**, not even an edge.
4. **One component per kind of control.** Every select box is the same
   select; every button is one of two styles. A deviation needs a stated
   reason.
5. **Depth from one place per layer** (shadow in light, lighter surface in
   dark), and boxes don't nest inside boxes.
6. **Themes change tokens, not components.** Nothing in a component names a
   colour directly; light and dark differ only in token values.

## Colour: Midnight & Brass

Tokens are named by role. Light is "A3+": antique brass actions, slate
second accent, a charcoal header. Dark: brass actions, a soft blue second
accent.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--color-bg` | the page | `#eef2f6` | `#0a0f14` |
| `--color-surface` | cards, controls | `#fdfeff` | `#12181e` |
| `--color-raised` | menus, popovers, dialogs | `#fdfeff` | `#1b2129` |
| `--color-sunken` | wells, stat tiles | `#e3e8ee` | `#06080d` |
| `--color-divider` | hairlines between parts (decorative) | `#d8dde3` | `#242b33` |
| `--color-text` | body text | `#0f1923` | `#ebeff4` |
| `--color-text-muted` | labels, meta lines, hints | `#414f5d` | `#b2bbc8` |
| `--color-text-faint` | placeholders | `#596571` | `#969fab` |
| `--color-border` | control edges | `#687686` | `#5f6a77` |
| `--color-accent` | the action colour: primary fill | `#dcaf6c` | `#dcaf61` |
| `--color-accent-strong` | primary hover | `#ce9e58` | `#edc47d` |
| `--color-accent-edge` | primary's rim (a light fill needs a darker edge) | `#966b2e` | `#dcaf61` |
| `--color-on-accent` | text on the primary fill | `#261a09` | `#201300` |
| `--color-accent-text` | action-coloured text (secondary buttons, links) | `#754f19` | `#e0b771` |
| `--color-focus` | the focus ring | `#835a20` | `#e0b771` |
| `--color-accent2` | second accent: selected tab, featured card's top edge | `#334a62` | `#9bbeff` |
| `--color-on-accent2` | text on the second accent | `#f6f9fb` | `#0d1a32` |
| `--color-accent2-text` | second-accent text and outlines (the die, kickers) | `#334a62` | `#a5c5fe` |
| `--color-danger` | destructive fill | `#a03f3c` | `#f07f77` |
| `--color-on-danger` | text on the destructive fill | `#fefbfb` | `#290b0a` |
| `--color-danger-text` | destructive text, errors | `#983b38` | `#f4928a` |
| `--color-success-text` | hits, good outcomes | `#286648` | `#6ccea6` |
| `--color-highlight` | crit badge fill (success family, filled) | `#96ddb6` | `#5ed8a9` |
| `--color-on-highlight` | text on the crit badge | `#0e271b` | `#002115` |
| `--color-bar` | the header bar | `#1b222a` | `#04080d` |
| `--color-bar-text` | header text | `#f0f2f4` | `#ebeff4` |
| `--color-bar-muted` | header's secondary text, other page tabs | `#b0b8c1` | `#a3acb8` |
| `--color-bar-title` | the app's name in the header | `#e8bc7d` | `#e6bd77` |
| `--color-bar-active` | the current page tab's underline | `#e3b572` | `#e3b667` |

Where colour goes:

- **Brass** (`accent`): primary buttons, secondary buttons' text, the focus
  ring, links. Only things you can press.
- **Second accent:** the selected tab button, a featured card's top edge,
  small kicker labels ("In play"), the die's outline.
- **Success green:** a hit, a good result. A **crit** is the same family,
  filled (a badge): a stronger hit.
- **Red:** destructive actions and errors only.

Theme steps for hover and pressing mix toward **black in light** and
**white in dark**, so one rule serves both themes.

## Type

Two families: **Spectral** (serif) for the stylistic parts, **Barlow**
(sans) for controls and reading. Barlow was chosen for being narrow (the
most text per row of the candidates) with compact line spacing, which suits
a sheet full of fields. Weights loaded: Barlow 400, 500, 600; Spectral 600,
700.

| Role | Face, weight | Size / line height | Notes |
|---|---|---|---|
| Page title | Spectral 700 | 28px / 1.2 | |
| Character name | Spectral 700 | 24px / 1.2 | |
| Card title | Spectral 600 | 18px / 1.25 | an attack's name, a card's heading |
| Section title | Spectral 600 | 14px / 1.3 | all caps, letter-spaced 0.12em, muted |
| Big number | Spectral 700 | 32px / 1 | roll results; lining figures |
| Number | Spectral 700 | 22px / 1 | damage, stat tiles; lining figures |
| Body | Barlow 400 | 15px / 1.45 | notes, descriptions |
| Body small | Barlow 400 | 13px / 1.4 | meta lines, dice breakdowns; muted |
| Label | Barlow 600 | 12px / 1.2 | above a control; all caps, letter-spaced 0.08em, muted |
| Control, large / medium / small | Barlow 500 | 17 / 15 / 13px | inside the 44 / 36 / 28px controls |
| Numbers in fields and tables | Barlow 500 | as the control | tabular (same-width) figures so columns line up |

Italic: no italic font files are loaded. Where text is italic (an `<i>`, or
`font-style: italic`), Barlow is slanted by the browser, which is fine
(decided 2026-10-27; a Spectral italic for small labels was tried and set
aside in favour of the sans).

Serif numbers always use lining figures (`font-variant-numeric:
lining-nums`, set after any `font` shorthand, which resets it).

## Sizes

Every control inside a border (buttons, text fields, selects, the
select with checkboxes, tab buttons) comes in three sizes. Each size sets
one height for all of them, so controls of a size line up in a row, and
also the type, icon and padding.

| Size | Height | Type | Icon | Side padding |
|---|---|---|---|---|
| Small | 28px | 13px | 14px | 8px |
| Medium | 36px | 15px | 16px | 12px |
| Large | 44px | 17px | 20px | 16px |

Medium is the default. Small is for dense rows (tables, inline stats).
Large is defined for touch-first or prominent actions (44px is the usual
minimum touch target). Padding may be tightened where a row is short of
room; height, type and icon may not.

Corners: controls 6px, wells and items 8px, cards 10px.

## Fields

Two styles of editable field, both in `src/ui/components.js` and in every
page's `<head>`:

- **Boxed field**: text, number and select boxes, and text areas. A border,
  the S/M/L sizes above, Barlow 500, the chevron on selects. A dense area
  sets the small size on its container (`--field-h`, `--field-fs`,
  `--field-px`, or the class `size-sm`); the rest are medium. The select
  with checkboxes (`.ui-control`) looks the same.
- **Open field** (`class="open-field"`): text that's editable where it sits:
  names, notes and stat numbers in cards and headers. An underline at rest
  (the border colour, so it's clearly editable), the action colour on hover
  (it's interactive), a 2px focus-colour underline while editing. Its type
  comes from what it shows (a name, a big number), so it has no set height;
  small text in an open field is at least body small (13px).

- **Pairs** (a weapon's hit / damage, S/M / L; a proficiency's ability and
  adjustment) are two standard fields side by side, a light "/" between.
- **Number fields** hide the browser's spin buttons. One that keeps them
  (`class="has-spin"`: attack Hit/Dmg Mod, class level) shows our up/down
  icon in its right padding, no box behind it; clicking its top or bottom
  half steps the value (`src/ui/spin.js`); the arrow keys work everywhere.
- A select's open list follows the theme.
- `class="ui-native"` opts an element out of the field styles: the
  calculated values shown in read-only inputs (Missile, Hit and Damage Adj.)
  read as plain numbers, with no box, underline or hover.

## Tags

A small label for a kind or a level: a spell's level and type, a magic
item, a proficiency's roll (`src/ui/components.js`, class `tag` and a
modifier). A pill, Barlow 600 at 12px (11px capitals with `tag-caps`), 20px
tall, with a soft fill, a deep text colour and a hairline edge from one hue
(the `--tag-*` tokens, per theme). Quieter than a button, and never the
action colour. Every tag's text passes 4.5:1 on its fill in both themes.

"Rising power" (decided 2026-10-28):

- **Spell levels** `tag-l1` … `tag-l9`: one family that deepens and warms
  from slate (1st) through teal and green to brass-gold (9th), so a
  higher-level spell looks more potent. The slot badges above the spell list
  use the same.
- **Kinds**: `tag-wizard` (blue), `tag-priest` (green), `tag-magic` (violet,
  magic items), `tag-roll` (green, a proficiency's roll).

`prototypes/tag-palettes.html` shows it beside the two options not chosen.

## Buttons

- **Primary**: filled with the action colour (`accent`, rim `accent-edge`,
  text `on-accent`). The main action in a place: Roll to hit, Send to DM.
- **Secondary**: the surface colour, the standard `border`, text
  `accent-text`. Everything else.
- **Destructive** is a theme on either style, not a third style:
  - filled: `danger` fill, `danger` edge, `on-danger` text;
  - outlined: the standard border, `danger-text` text.
- **Icon-only, icon-start, icon-end** are variations of the above, scaled by
  size. Icon-only buttons are square (width = height) and always carry an
  accessible name (`aria-label`).
- **Tab buttons**: joined buttons for picking one of three or more options
  (Ground: Lower / Level / Higher). The selected one is filled with the
  second accent. Page navigation has its own tab style (the header's
  underlined tabs), not this one.

## States

| State | Primary | Secondary | Destructive | Fields (text, select) |
|---|---|---|---|---|
| Hover | `accent-strong` | border `accent-text`, a 9% tint | one step stronger red; outlined: red border, red tint | border darkens to `text-muted` |
| Active (held down) | one step stronger again, 1px down | 18% tint, 1px down | the same steps in red | n/a |
| Focus | 2px `focus` ring, 2px out | same | same | same ring, border `focus` |
| Disabled | 45% opacity, no hover, not-allowed cursor | same | same | same |
| Pressed (selected) | n/a | n/a | n/a | tab buttons: `accent2` fill, its own hover |
| Error | n/a | n/a | n/a | border `danger-text`, a message below linked with `aria-describedby` |

- Buttons show the focus ring for keyboard focus (`:focus-visible`); fields
  show it whenever they have focus.
- "Active" is the moment a button is held down; "pressed" is a choice that
  stays on (a selected tab, a toggle).
- An error message says what to do ("Use a number, like +2 or −1"), not
  only what's wrong.

## Surfaces and depth

| Layer | Used for | Light | Dark |
|---|---|---|---|
| Page | behind everything | `bg` | `bg` |
| Card | a top-level section (This round, Weapons, Notes) | `surface`, soft shadow, `divider` hairline | `surface` (lighter than the page), a faint top edge |
| Well | read-outs inside a card: roll results, stat tiles | `sunken`, no shadow | `sunken` |
| Item | a repeated thing inside a card (a character, a list row) | `surface` with a `divider` hairline, no shadow | same |
| Raised | menus, dropdown lists, tooltips, toasts | `raised`, a stronger shadow | `raised` (lighter again), a stronger shadow, a faint top edge |
| Overlay | dialogs, the page dimmed behind | `raised`, the strongest shadow | same |

Rules:

1. Depth comes from one place per layer: shadow in light, a lighter surface
   in dark (shadows barely show on dark backgrounds).
2. Cards don't nest. Inside a card, use a well or an item, never another
   shadowed card.
3. Wells don't nest, and a well isn't interactive by itself: it holds a
   result; the controls that make it sit beside it.
4. Corners shrink inward: card 10px, well and item 8px, control 6px.
5. A **featured** card (what matters most right now, such as This round) gets
   the second accent's top edge; at most one per screen.

Shadows (light): card `0 1px 2px rgb(20 16 12 / .06), 0 1px 3px rgb(20 16 12 /
.10)`; raised `0 12px 30px rgb(20 16 12 / .16), 0 2px 6px rgb(20 16 12 / .08)`.
Dark: card `0 1px 2px rgb(0 0 0 / .5)`; raised `0 14px 34px rgb(0 0 0 / .55),
0 2px 6px rgb(0 0 0 / .4)`; a top edge `inset 0 1px 0 rgb(255 255 255 / .05)`.

## Accessibility

Measured for every pairing in both themes (the prototypes check them live):

- Body text: at least 7:1 (AAA). Muted text: at least 4.5:1 (AA) everywhere,
  7:1 on the page and cards.
- Control borders, the focus ring, icons and other non-text cues: at least
  3:1 against what's next to them.
- A fill that's lighter than 3:1 against white (the brass button, the light
  second accent) gets a darker edge that carries the 3:1.
- Every button state keeps its text at 4.5:1 or more. The lowest is the
  light theme's primary while held down (4.6:1), accepted as it is.
- Colour is never the only signal: errors have a message, the selected tab
  has its own fill and weight, hits say "Hit".

## Open

- The page-navigation tab style is only sketched (the header's underlined
  tabs); its states aren't specified yet.
- Checkboxes, radio buttons, switches and the select with checkboxes' open
  list need their entries here once they're restyled.
- Moving the tools onto the system: tokens first, then controls by kind
  (selects, buttons, fields), then surfaces, page by page.
