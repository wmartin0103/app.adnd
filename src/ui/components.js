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
//   --field-h / --field-fs / --field-px (or the class size-sm, size-lg);
// - the open field (class="open-field"): text that's editable where it sits,
//   names, notes and stat numbers in cards and headers. An underline at rest,
//   brass on hover (it's interactive), the focus colour while editing. Its
//   type comes from what it shows, so it has no set height.
const BOXED = ':is(input:not([type]), input[type=text], input[type=number], input[type=email], input[type=password], input[type=search], input[type=url], input[type=tel], select, textarea):not(.ui-native):not(.open-field)';
export const FIELDS_CSS = `/* Fields (docs/design-system.md: Sizes, States) */
:root { --field-h: var(--ctl-md); --field-fs: var(--ctl-fs-md); --field-px: var(--ctl-pad-md); }
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
