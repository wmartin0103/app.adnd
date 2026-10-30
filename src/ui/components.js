// ── COMPONENTS ──────────────────────────────────────────────────
// The shared controls from docs/design-system.md, as CSS that every page
// gets in its <head> with the tokens (scripts/build-legacy.mjs). They're
// written to win over a page's older styles for the same element; a page
// that needs something different says why in a comment, with a more
// specific rule (or class="ui-native" for the browser's own control).

// ── Fields ──
// Two styles of editable field:
// - the boxed field (text, number and select boxes, text areas): a border,
//   the S/M/L sizes; a dense area sets the small size on its container with
//   --field-h / --field-fs / --field-px (or the class size-sm, size-lg;
//   size-xs only for the quantity stepper in a tight card header);
// - the open field (class="open-field"): text that's editable where it sits,
//   names, notes and stat numbers in cards and headers. An underline at rest,
//   brass on hover (it's interactive), the focus colour while editing. Its
//   type comes from what it shows, so it has no set height.
const BOXED = ':is(input:not([type]), input[type=text], input[type=number], input[type=email], input[type=password], input[type=search], input[type=url], input[type=tel], select, textarea):not(.ui-native):not(.open-field)';
export const FIELDS_CSS = `/* Fields (docs/design-system.md: Sizes, States) */
:root { --field-h: var(--ctl-md); --field-fs: var(--ctl-fs-md); --field-px: var(--ctl-pad-md); }
.size-xs { --field-h: var(--ctl-xs); --field-fs: var(--ctl-fs-xs); --field-px: var(--ctl-pad-xs); }
.size-sm { --field-h: var(--ctl-sm); --field-fs: var(--ctl-fs-sm); --field-px: var(--ctl-pad-sm); }
.size-md { --field-h: var(--ctl-md); --field-fs: var(--ctl-fs-md); --field-px: var(--ctl-pad-md); }
.size-lg { --field-h: var(--ctl-lg); --field-fs: var(--ctl-fs-lg); --field-px: var(--ctl-pad-lg); }
${BOXED} {
  box-sizing: border-box; height: var(--field-h); min-height: 0; margin: 0; padding: 0 var(--field-px);
  font-family: var(--font-sans); font-size: var(--field-fs); font-weight: 500; font-style: normal; line-height: normal;
  letter-spacing: normal; text-transform: none; color: var(--color-text);
  background-color: var(--color-surface); background-image: none;
  border: 1px solid var(--color-border); border-radius: var(--radius-ctl); box-shadow: none; outline: none;
  transition: border-color .12s, background-color .12s;
}
${BOXED}:is(textarea) { height: auto; padding: 8px var(--field-px); line-height: 1.45; font-weight: 400; }
${BOXED}:is(select) {
  -webkit-appearance: none; appearance: none; cursor: pointer; text-overflow: ellipsis;
  padding-right: calc(var(--field-px) + 1.2em);
  background-image: var(--chevron); background-repeat: no-repeat; background-position: right calc(var(--field-px) - 0.1em) center; background-size: 0.7em auto;
}
${BOXED}::placeholder { color: var(--color-text-faint); opacity: 1; }
${BOXED}:hover:not(:disabled):not(:focus):not([readonly]) { border-color: var(--color-text-muted); }
${BOXED}:focus { border-color: var(--color-focus); outline: 2px solid var(--color-focus); outline-offset: 2px; }
${BOXED}[readonly] { background-color: var(--color-sunken); }
${BOXED}:disabled { opacity: .45; cursor: not-allowed; }
${BOXED}[aria-invalid="true"] { border-color: var(--color-danger-text); }
/* A select's open list follows the theme */
select option { background-color: var(--color-raised); color: var(--color-text); }
/* Spin buttons, where a number field keeps them (class="has-spin"): our up/down
   icon in its right padding, no box behind it (src/ui/spin.js makes it work).
   The browser's own are hidden. */
input[type=number].has-spin:not(.ui-native) {
  -moz-appearance: textfield; appearance: textfield;
  padding-right: calc(var(--field-px) + 1em);
  background-image: var(--spin); background-repeat: no-repeat; background-position: right calc(var(--field-px) - 2px) center; background-size: 0.55em auto;
}
input[type=number].has-spin.open-field { padding-right: 1.1em; background-position: right 0 center; }
input[type=number].has-spin::-webkit-inner-spin-button, input[type=number].has-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number].has-spin.on-spin { cursor: pointer; }

/* The open field */
:is(input, select, textarea).open-field {
  background-color: transparent; border: 0; border-bottom: 1px solid var(--color-border); border-radius: 0;
  box-shadow: none; outline: none; color: var(--color-text); transition: border-color .12s;
}
select.open-field { -webkit-appearance: none; appearance: none; cursor: pointer; padding-right: 1.4em;
  background-image: var(--chevron); background-repeat: no-repeat; background-position: right 0.1em center; background-size: 0.7em auto; }
:is(input, select, textarea).open-field:hover:not(:disabled):not(:focus):not([readonly]) { border-bottom-color: var(--color-accent-text); }
:is(input, select, textarea).open-field:focus { border-bottom: 2px solid var(--color-focus); margin-bottom: -1px; }
:is(input, select, textarea).open-field::placeholder { color: var(--color-text-faint); opacity: 1; }
:is(input, select, textarea).open-field:disabled { opacity: .45; cursor: not-allowed; }
:is(input, select, textarea).open-field[aria-invalid="true"] { border-bottom-color: var(--color-danger-text); }`;

// ── Tags ──
// A small label for a kind or a level (a spell's level and type, a magic
// item, a proficiency's roll): a pill with a soft fill, deep text and a
// hairline edge from one hue (the --tag-* tokens). Quieter than a button, and
// never the action colour. tag-caps for a kind written in capitals.
export const TAGS_CSS = `/* Tags (docs/design-system.md, Tags) */
:is(span, div, b, a).tag {
  display: inline-flex; align-items: center; box-sizing: border-box; height: 20px; padding: 0 7px; border: 0; border-radius: 999px;
  font: 600 12px/1 var(--font-sans); letter-spacing: .03em; text-transform: none; white-space: nowrap;
  background: var(--tag-bg, var(--color-sunken)); color: var(--tag-text, var(--color-text-muted)); box-shadow: inset 0 0 0 1px var(--tag-edge, var(--color-divider));
}
:is(span, div, b, a).tag.tag-caps { text-transform: uppercase; letter-spacing: .1em; font-size: 11px; }
.tag-l1 { --tag-bg: var(--tag-l1-bg); --tag-text: var(--tag-l1-text); --tag-edge: var(--tag-l1-edge); }
.tag-l2 { --tag-bg: var(--tag-l2-bg); --tag-text: var(--tag-l2-text); --tag-edge: var(--tag-l2-edge); }
.tag-l3 { --tag-bg: var(--tag-l3-bg); --tag-text: var(--tag-l3-text); --tag-edge: var(--tag-l3-edge); }
.tag-l4 { --tag-bg: var(--tag-l4-bg); --tag-text: var(--tag-l4-text); --tag-edge: var(--tag-l4-edge); }
.tag-l5 { --tag-bg: var(--tag-l5-bg); --tag-text: var(--tag-l5-text); --tag-edge: var(--tag-l5-edge); }
.tag-l6 { --tag-bg: var(--tag-l6-bg); --tag-text: var(--tag-l6-text); --tag-edge: var(--tag-l6-edge); }
.tag-l7 { --tag-bg: var(--tag-l7-bg); --tag-text: var(--tag-l7-text); --tag-edge: var(--tag-l7-edge); }
.tag-l8 { --tag-bg: var(--tag-l8-bg); --tag-text: var(--tag-l8-text); --tag-edge: var(--tag-l8-edge); }
.tag-l9 { --tag-bg: var(--tag-l9-bg); --tag-text: var(--tag-l9-text); --tag-edge: var(--tag-l9-edge); }
.tag-wizard { --tag-bg: var(--tag-wizard-bg); --tag-text: var(--tag-wizard-text); --tag-edge: var(--tag-wizard-edge); }
.tag-priest { --tag-bg: var(--tag-priest-bg); --tag-text: var(--tag-priest-text); --tag-edge: var(--tag-priest-edge); }
.tag-magic { --tag-bg: var(--tag-magic-bg); --tag-text: var(--tag-magic-text); --tag-edge: var(--tag-magic-edge); }
.tag-roll { --tag-bg: var(--tag-roll-bg); --tag-text: var(--tag-roll-text); --tag-edge: var(--tag-roll-edge); }`;

// ── Buttons ──
// class="ui-button" with a style: is-primary (filled, the action colour) or
// is-secondary (outlined). is-danger turns either destructive (red fill, or
// red text on the standard outline). is-icon makes it square; is-bare is an
// icon button with no box until hover or focus (small icons in rows and
// cards); is-link looks like a link (text in the action colour, underlined on
// hover) but is a button. is-remove is the × that removes something (its icon
// a little larger than other icons). The S/M/L size comes from the same --field-* values
// as fields, so a button and a field of a size line up. :not(#\#) lifts these rules over a
// page's older button styles; a page that needs something different says why.
const BTN = ':is(button, a, label, [role=button]).ui-button:not(.ui-native):not(#\\#)';
export const BUTTONS_CSS = `/* Buttons (docs/design-system.md: Buttons, States) */
${BTN} {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 0.4em; vertical-align: middle;
  height: var(--field-h); min-height: 0; min-width: 0; padding: 0 var(--field-px);
  font-family: var(--font-sans); font-size: var(--field-fs); font-weight: 600; font-style: normal; line-height: 1;
  letter-spacing: normal; text-transform: none; text-decoration: none; white-space: nowrap;
  border: 1px solid transparent; border-radius: var(--radius-ctl); background-image: none; box-shadow: none; opacity: 1;
  cursor: pointer; transition: background-color .12s, border-color .12s, color .12s;
}
${BTN} svg { width: 1.1em; height: 1.1em; flex: none; }
${BTN}.is-icon { width: var(--field-h); padding: 0; }
${BTN}.is-primary { background-color: var(--color-accent); border-color: var(--color-accent-edge); color: var(--color-on-accent); }
${BTN}.is-primary:hover:not(:disabled) { background-color: var(--color-accent-strong); border-color: var(--color-accent-strong); }
${BTN}.is-primary:active:not(:disabled) { background-color: color-mix(in oklab, var(--color-accent-strong) 85%, var(--toward)); border-color: color-mix(in oklab, var(--color-accent-strong) 85%, var(--toward)); }
${BTN}.is-secondary { background-color: var(--color-surface); border-color: var(--color-border); color: var(--color-accent-text); }
${BTN}.is-secondary:hover:not(:disabled) { border-color: var(--color-accent-text); background-color: color-mix(in oklab, var(--color-accent-text) 9%, var(--color-surface)); }
${BTN}.is-secondary:active:not(:disabled) { border-color: var(--color-accent-text); background-color: color-mix(in oklab, var(--color-accent-text) 18%, var(--color-surface)); }
${BTN}.is-primary.is-danger { background-color: var(--color-danger); border-color: var(--color-danger); color: var(--color-on-danger); }
${BTN}.is-primary.is-danger:hover:not(:disabled) { background-color: color-mix(in oklab, var(--color-danger) 86%, var(--toward)); border-color: color-mix(in oklab, var(--color-danger) 86%, var(--toward)); }
${BTN}.is-primary.is-danger:active:not(:disabled) { background-color: color-mix(in oklab, var(--color-danger) 74%, var(--toward)); border-color: color-mix(in oklab, var(--color-danger) 74%, var(--toward)); }
${BTN}.is-secondary.is-danger { color: var(--color-danger-text); }
${BTN}.is-secondary.is-danger:hover:not(:disabled) { border-color: var(--color-danger-text); background-color: color-mix(in oklab, var(--color-danger-text) 9%, var(--color-surface)); }
${BTN}.is-secondary.is-danger:active:not(:disabled) { border-color: var(--color-danger-text); background-color: color-mix(in oklab, var(--color-danger-text) 18%, var(--color-surface)); }
${BTN}.is-bare { background-color: transparent; border-color: transparent; color: var(--color-text-muted); }
${BTN}.is-bare:is(:hover, :focus-visible):not(:disabled) { border-color: var(--color-border); color: var(--color-accent-text); background-color: color-mix(in oklab, var(--color-accent-text) 9%, transparent); }
${BTN}.is-bare.is-danger:is(:hover, :focus-visible):not(:disabled) { color: var(--color-danger-text); background-color: color-mix(in oklab, var(--color-danger-text) 9%, transparent); }
${BTN}.is-bare:is([aria-pressed="true"], .is-active) { color: var(--color-accent2-text); background-color: color-mix(in oklab, var(--color-accent2) 16%, transparent); }
${BTN}.is-remove svg { width: calc(var(--field-fs) * 1.15); height: calc(var(--field-fs) * 1.15); }
${BTN}.is-link { height: var(--field-h); padding: 0 0.1em; background-color: transparent; border-color: transparent; color: var(--color-accent-text);
  text-decoration: none; text-underline-offset: 0.2em; }
${BTN}.is-link:hover:not(:disabled) { color: color-mix(in oklab, var(--color-accent-text) 85%, var(--toward)); text-decoration: underline; text-decoration-thickness: 1px; }
${BTN}.is-link.is-danger { color: var(--color-danger-text); }
${BTN}:active:not(:disabled):not(.is-link) { transform: translateY(1px); }
${BTN}:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
${BTN}:is(:disabled, [aria-disabled="true"]) { opacity: .45; cursor: not-allowed; }

/* Tab buttons: joined buttons for picking one of three or more (class="ui-tabs" on the group) */
:is(div, span, fieldset, [role=group]).ui-tabs:not(#\\#) {
  display: inline-flex; flex-wrap: nowrap; box-sizing: border-box; height: var(--field-h); padding: 0; gap: 0;
  border: 1px solid var(--color-border); border-radius: var(--radius-ctl); overflow: hidden; background: var(--color-surface);
}
:is(div, span, fieldset, [role=group]).ui-tabs:not(#\\#) > button {
  box-sizing: border-box; height: 100%; margin: 0; padding: 0 var(--field-px); border: 0; border-left: 1px solid var(--color-border); border-radius: 0;
  background: transparent; color: var(--color-text-muted); font: 600 var(--field-fs)/1 var(--font-sans); letter-spacing: normal; text-transform: none;
  white-space: nowrap; cursor: pointer; box-shadow: none; transition: background-color .12s, color .12s;
}
:is(div, span, fieldset, [role=group]).ui-tabs:not(#\\#) > button:first-child { border-left: 0; }
:is(div, span, fieldset, [role=group]).ui-tabs:not(#\\#) > button:hover:not(:is([aria-pressed="true"], .is-active)) { background: color-mix(in oklab, var(--color-text-muted) 10%, var(--color-surface)); color: var(--color-text); }
:is(div, span, fieldset, [role=group]).ui-tabs:not(#\\#) > button:is([aria-pressed="true"], .is-active) { background: var(--color-accent2); color: var(--color-on-accent2); }
:is(div, span, fieldset, [role=group]).ui-tabs:not(#\\#) > button:is([aria-pressed="true"], .is-active):hover { background: color-mix(in oklab, var(--color-accent2) 88%, var(--toward)); }
:is(div, span, fieldset, [role=group]).ui-tabs:not(#\\#) > button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -3px; }
`;

// ── Surfaces ──
// The layers (docs/design-system.md, Surfaces and depth): a card for a
// top-level section (is-featured: the one that matters most now, at most one
// per screen); inside a card, a well for read-outs and items for repeated
// things; raised for menus and lists that float; an overlay for dialogs.
// Cards don't nest; wells don't nest. Depth comes from the shadow in light and
// the lighter surface in dark. :not(#\#) lifts these over a page's older box
// styles; a page that needs something different says why.
// ── Choices ──
// Checkboxes and radios (every one, unless class="ui-native"), the switch
// (class="ui-switch" on a <button role="switch" aria-checked>) and page tabs
// (class="ui-pagetabs" on the row, aria-selected or .active on the current
// tab). "On" is the second accent, like a selected tab button; page tabs are
// brass. Sized from the fields: half a control's height (14 / 18 / 22px).
const CHOICE = ':is(input[type=checkbox], input[type=radio]):not(.ui-native):not(#\\#)';
export const CHOICES_CSS = `/* Checkboxes, radios, switches, page tabs (docs/design-system.md: Choices) */
${CHOICE} { appearance: none; -webkit-appearance: none; box-sizing: border-box; flex: none; margin: 0; padding: 0;
  width: calc(var(--field-h) * .5); height: calc(var(--field-h) * .5); min-width: 0; min-height: 0;
  display: inline-grid; place-content: center; vertical-align: middle; cursor: pointer;
  background: var(--color-surface); border: 1.5px solid var(--color-border); box-shadow: none; transition: background-color .12s, border-color .12s; }
:is(input[type=checkbox]):not(.ui-native):not(#\\#) { border-radius: 4px; }
:is(input[type=radio]):not(.ui-native):not(#\\#) { border-radius: 50%; }
:is(input[type=checkbox]):not(.ui-native):not(#\\#)::before { content: ''; width: calc(var(--field-h) * .31); height: calc(var(--field-h) * .31); background: var(--color-on-accent2);
  clip-path: polygon(12% 50%, 0 64%, 40% 100%, 100% 22%, 87% 9%, 40% 72%); transform: scale(0); transition: transform .1s; }
:is(input[type=radio]):not(.ui-native):not(#\\#)::before { content: ''; width: calc(var(--field-h) * .21); height: calc(var(--field-h) * .21); border-radius: 50%; background: var(--color-on-accent2); transform: scale(0); transition: transform .1s; }
${CHOICE}:checked { background: var(--color-accent2); border-color: var(--color-accent2); }
${CHOICE}:checked::before { transform: scale(1); }
${CHOICE}:hover:not(:disabled):not(:checked) { border-color: var(--color-text-muted); }
${CHOICE}:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
${CHOICE}:disabled { opacity: .45; cursor: not-allowed; }
button.ui-switch:not(#\\#) { box-sizing: border-box; flex: none; position: relative; margin: 0; padding: 0; cursor: pointer;
  width: calc(var(--field-h) * .95); height: calc(var(--field-h) * .5); border-radius: 999px;
  background: var(--color-sunken); border: 1.5px solid var(--color-border); box-shadow: none; transition: background-color .12s, border-color .12s; }
button.ui-switch:not(#\\#)::after { content: ''; position: absolute; top: 50%; left: 2px; width: calc(var(--field-h) * .5 - 7px); height: calc(var(--field-h) * .5 - 7px);
  border-radius: 50%; background: var(--color-text-muted); transform: translateY(-50%); transition: left .15s, background-color .12s; }
button.ui-switch:not(#\\#)[aria-checked="true"] { background: var(--color-accent2); border-color: var(--color-accent2); }
button.ui-switch:not(#\\#)[aria-checked="true"]::after { left: calc(100% - var(--field-h) * .5 + 5px); background: var(--color-on-accent2); }
button.ui-switch:not(#\\#):hover:not(:disabled):not([aria-checked="true"]) { border-color: var(--color-text-muted); }
button.ui-switch:not(#\\#):focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
button.ui-switch:not(#\\#):disabled { opacity: .45; cursor: not-allowed; }
:is(nav, div, [role=tablist]).ui-pagetabs:not(#\\#) { display: flex; gap: 2px; border-bottom: 0; box-shadow: inset 0 -1px 0 var(--color-divider); overflow-x: auto; }
.ui-pagetabs:not(#\\#) > :is(button, a) { flex: none; background: none; border: 0; border-bottom: 2px solid transparent; border-radius: 0; margin: 0; padding: 8px 12px;
  cursor: pointer; font: 600 15px/1.2 var(--font-serif); letter-spacing: normal; text-transform: none; text-decoration: none; color: var(--color-text-muted); box-shadow: none; }
.ui-pagetabs:not(#\\#) > :is(button, a):hover { color: var(--color-text); }
.ui-pagetabs:not(#\\#) > :is(button, a):is([aria-selected="true"], [aria-current="page"], .active) { color: var(--color-accent-text); border-bottom-color: var(--color-accent); }
.ui-pagetabs:not(#\\#) > :is(button, a):focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
`;

// A disclosure (accordion) toggle: a button holding the chevron and the title.
// It is the whole hit area, so other controls in the same header (a select, an
// Add button, a field) don't light it up or toggle it. Hover is the bare
// button's tint, drawn just around the toggle.
export const DISCLOSURE_CSS = `
button.ui-disclosure:not(#\\#) { display: inline-flex; align-items: center; gap: 0.45em; padding: 0.2em 0.45em; margin: -0.2em -0.45em; background: none; border: 0; border-radius: var(--radius-ctl); font: inherit; color: inherit; letter-spacing: inherit; text-transform: inherit; text-align: left; cursor: pointer; }
button.ui-disclosure:not(#\\#):hover { color: var(--color-accent-text); background: color-mix(in oklab, var(--color-accent-text) 9%, transparent); }
button.ui-disclosure:not(#\\#):focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.ui-disclosure-chev { flex: none; width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-0.12em) rotate(45deg); transition: transform 0.15s; }
.ui-disclosure[aria-expanded="false"] .ui-disclosure-chev { transform: rotate(-45deg); }
`;

// A quantity stepper: − / the number / + in one box, so it reads as one control
// (apart from a remove × beside it). The number can be typed. Sized like a
// field (size-xs where a card header is tight).
const QTY = '.ui-qty:not(#\\#)';
export const QTY_CSS = `
${QTY} { box-sizing: border-box; display: inline-flex; align-items: stretch; flex: none; height: var(--field-h); background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-ctl); transition: border-color .12s; }
${QTY}:hover { border-color: var(--color-text-muted); }
${QTY}:focus-within { border-color: var(--color-focus); }
${QTY} > button { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: calc(var(--field-h) - 4px); margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--color-text-muted); font: 600 var(--field-fs)/1 var(--font-sans); cursor: pointer; transition: background-color .12s, color .12s; }
${QTY} > button:first-child { border-radius: calc(var(--radius-ctl) - 1px) 0 0 calc(var(--radius-ctl) - 1px); }
${QTY} > button:last-child { border-radius: 0 calc(var(--radius-ctl) - 1px) calc(var(--radius-ctl) - 1px) 0; }
${QTY} > button:hover:not(:disabled) { color: var(--color-accent-text); background-color: color-mix(in oklab, var(--color-accent-text) 9%, transparent); }
${QTY} > button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; position: relative; }
${QTY} > button:disabled { opacity: .45; cursor: not-allowed; }
${QTY} > input { box-sizing: border-box; width: calc(var(--field-fs) * 1.9); height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; outline: none; box-shadow: none; text-align: center; color: var(--color-text); font: 600 var(--field-fs)/1 var(--font-sans); font-variant-numeric: tabular-nums; }
`;

// ── Patterns ──
// The choice card (class="ui-choice" on a <button>, or an <a> when it goes
// somewhere): a whole card that is the button, for a few big choices (Create a new character / Import a file). A
// card at rest; hover and focus give it a brass edge. Inside: .t (the title,
// Spectral, brass) and .d (a line about it, muted).
// The menu (class="ui-menu", role="menu"): the raised layer, its items
// <button role="menuitem">s, groups split by <hr>, a destructive item
// class="danger" (red). An item fills with the page colour on hover and focus.
// The page places the menu (position); the pattern is its look.
export const PATTERNS_CSS = `/* Patterns (docs/design-system.md: Patterns) */
:is(button, a).ui-choice:not(#\\#) { display: grid; gap: 6px; align-content: start; text-align: left; font: inherit; color: var(--color-text); text-decoration: none; cursor: pointer;
  background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-card); box-shadow: var(--shadow-card), inset 0 1px 0 var(--edge-top); padding: 22px 20px; }
:is(button, a).ui-choice:not(#\\#):is(:hover, :focus-visible) { border-color: var(--color-accent-text); box-shadow: inset 0 0 0 1px var(--color-accent-text); }
:is(button, a).ui-choice:not(#\\#):focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.ui-choice .t { font-family: var(--font-serif); font-weight: 600; font-size: 1.05rem; color: var(--color-accent-text); }
.ui-choice .d { color: var(--color-text-muted); font-size: 0.98rem; }
.ui-menu:not(#\\#) { display: grid; min-width: 13rem; padding: 4px; background: var(--color-raised); border: 1px solid var(--color-divider); border-radius: var(--radius-inner);
  box-shadow: var(--shadow-raised), inset 0 1px 0 var(--edge-top); }
.ui-menu:not(#\\#) > button { font: 400 1rem/1.45 var(--font-sans); text-align: left; background: none; border: 0; border-radius: var(--radius-ctl); padding: 8px 10px; cursor: pointer; color: var(--color-text); }
.ui-menu:not(#\\#) > button:is(:hover, :focus-visible) { background: var(--color-bg); outline: none; }
.ui-menu:not(#\\#) > button.danger { color: var(--color-danger-text); }
.ui-menu:not(#\\#) > hr { border: 0; border-top: 1px solid var(--color-divider); margin: 4px 0; }
`;

export const SURFACES_CSS = `/* Surfaces (docs/design-system.md: Surfaces and depth) */
:is(section, article, aside, div, form, header).ui-card:not(#\\#) {
  background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-card);
  box-shadow: var(--shadow-card), inset 0 1px 0 var(--edge-top); padding: var(--card-pad, 18px);
}
:is(section, article, aside, div, form, header).ui-card.is-featured:not(#\\#) { border-top: 3px solid var(--color-accent2); }
/* A small card among siblings (an ability score, a spell): less padding */
:is(section, article, aside, div, form, header).ui-card.is-compact:not(#\\#) { --card-pad: 12px; }
/* Sides in the initiative order: an opponent's card (an Enemy) has a red
   left edge, an ally's (a player's character) the second accent's */
:is(section, article, aside, div, form, header).ui-card.is-opponent:not(#\\#) { border-left: 3px solid var(--color-danger); }
:is(section, article, aside, div, form, header).ui-card.is-ally:not(#\\#) { border-left: 3px solid var(--color-accent2); }
:is(div, section, span, output, figure, dl).ui-well:not(#\\#) {
  background: var(--color-sunken); border: 0; border-radius: var(--radius-inner); box-shadow: var(--shadow-well);
}
:is(div, article, li, section, label).ui-item:not(#\\#) {
  background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-inner); box-shadow: none;
}
/* A tinted item: a group of controls that holds a well (an Enemy's attack).
   Never an inner shadow: that's what tells it from a well */
:is(div, article, li, section).ui-item.is-tinted:not(#\\#) { background: color-mix(in oklab, var(--color-text) 4%, var(--color-surface)); box-shadow: none; }
:is(div, ul, menu, section).ui-raised:not(#\\#), dialog.ui-overlay:not(#\\#) {
  background: var(--color-raised); color: var(--color-text); border: 1px solid var(--color-divider); border-radius: var(--radius-inner);
  box-shadow: var(--shadow-raised), inset 0 1px 0 var(--edge-top);
}
dialog.ui-overlay:not(#\\#) { border-radius: var(--radius-card); }
dialog.ui-overlay::backdrop { background: var(--scrim); }
`;
