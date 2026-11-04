// Writes prototypes/physical-dice.html: the Dice setting on Account, and the
// rolls on the sheet and the DM Helper with the app rolling or physical dice
// (for review before the real pages change; sample numbers, nothing is saved).
// Run: node scripts/prototype-physical-dice.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { withHead } from './build-tools.mjs';
import { STYLES, ROLL_ICON, D20_SVG } from '../src/ui/round-ui.js';

const client = String.raw`
  const ROLL = __ROLL__, D20 = __D20__;
  const $ = id => document.getElementById(id);
  let dice = 'app';
  const state = {};   // what's been rolled or typed, by key
  const rnd = n => 1 + Math.floor(Math.random() * n);

  // A roll: a button when the app rolls; "Roll 1d8" and a field for physical dice
  function roll(key, label, sides, what) {
    const has = state[key] != null;
    if (dice === 'app') {
      return '<button type="button" class="ui-button ' + (has ? 'is-secondary' : 'is-primary') + ' size-sm" data-roll="' + key + '" data-sides="' + (sides || '') + '" data-what="' + (what || '') + '">' + ROLL + '<span>' + (has ? 'Re-roll' : 'Roll') + ' ' + label + '</span></button>';
    }
    return '<label class="pd-field"><span class="pd-label">Roll <b>' + what + '</b>' + (label ? ' · ' + label : '') + '</span>'
      + '<input class="size-sm" type="text" inputmode="numeric" data-key="' + key + '" data-sides="' + (sides || '') + '" value="' + (has ? state[key] : '') + '" aria-label="' + what + ' ' + label + '"></label>';
  }
  const res = (label, value, cls) => '<span class="hit-stat ' + (cls || '') + '"><span class="hit-stat-label">' + label + '</span><span class="hit-stat-value">' + value + '</span></span>';

  function sheet() {
    const toHit = state.h, dmg = state.d, fb = state.f;
    const nat = toHit === 20 ? 'Natural 20 · Critical?' : toHit === 1 ? 'Natural 1' : '';
    return '<h2 class="pd-h">On the sheet: This round</h2><section class="ui-card is-featured pd-stack">'
      + '<div class="pd-row"><b>Initiative</b>' + roll('i', 'initiative', 10, '1d10') + (state.i != null ? res('Act on', state.i + 3) : '') + '</div>'
      + '<div class="pd-line"><div class="pd-title">Long Sword (Opener) <span>vs E1 · THAC0 15</span></div><div class="pd-row">' + roll('h', 'to hit', 20, '1d20')
      + (toHit != null ? res('Hits AC', toHit === 1 ? '—' : 15 - toHit) : '') + (nat ? '<span class="pd-nat">' + nat + '</span>' : '') + '</div>'
      + (toHit != null && toHit !== 1 ? '<div class="pd-row">' + roll('d', 'damage', 0, '1d8+2') + (dmg != null ? res('Damage', dmg + 2) : '') + '</div>' : '') + '</div>'
      + '<div class="pd-line"><div class="pd-title">Fireball (Spell slot) <span>vs E1, E2 · Save for ½ damage</span></div><div class="pd-row">' + roll('f', 'damage, once for all targets', 0, '5d6') + (fb != null ? res('Damage', fb) : '') + '</div></div>'
      + '<div class="pd-line"><div class="pd-title">Magic Missile <span>vs E1, E2 · No save</span></div><div class="pd-row">' + roll('m1', 'vs E1', 0, '1d4+1') + (state.m1 != null ? res('Damage', state.m1 + 1) : '') + '</div><div class="pd-row">' + roll('m2', 'vs E2', 0, '1d4+1') + (state.m2 != null ? res('Damage', state.m2 + 1) : '') + '</div></div>'
      + '</section>';
  }
  function dm() {
    const t = (n, k) => '<div class="pd-row pd-who"><span>' + n + '</span>' + roll(k, '', 20, '1d20') + '</div>';
    return '<h2 class="pd-h">In the DM Helper</h2><div class="pd-grid">'
      + '<section class="ui-card is-compact is-opponent pd-stack"><div class="pd-title">Enemy 1 <span>E1</span></div><div class="pd-row">' + roll('ei', 'init', 10, '1d10') + (state.ei != null ? res('Act on', state.ei + 3) : '') + '</div><div class="pd-row">' + roll('ea', 'to hit', 20, '1d20') + (state.ea != null ? res('Result', state.ea >= 15 ? 'Hit' : 'Miss', state.ea >= 15 ? 'is-hit' : 'is-miss') : '') + '</div>' + (state.ea >= 15 ? '<div class="pd-row">' + roll('ed', 'damage', 0, '1d6+1') + (state.ed != null ? res('Damage', state.ed + 1) : '') + '</div>' : '') + '</section>'
      + '<section class="ui-card is-compact is-ally pd-stack"><div class="pd-title">Jaque <span>Charm Person vs Enemy 1, Enemy 2 · Save negates</span></div>' + (dice === 'app' ? '<div class="pd-row">' + roll('sa', 'for save', 20, '1d20') + (state.sa != null ? '<span>Enemy 1 ' + D20 + ' <b>' + state.sa + '</b></span><span>Enemy 2 ' + D20 + ' <b>' + state.sb + '</b></span>' : '') + '</div>' : t('Enemy 1 save', 'sa') + t('Enemy 2 save', 'sb')) + '</section>'
      + '<section class="ui-card is-compact pd-stack"><div class="pd-title">Proficiencies <span>Group check: Tracking</span></div>' + (dice === 'app' ? '<div class="pd-row">' + roll('g1', 'all', 20, '1d20') + (state.g1 != null ? '<span>Jaque <b>' + state.g1 + '</b></span><span>Rifiyr <b>' + state.g2 + '</b></span>' : '') + '</div>' : t('Jaque', 'g1') + t('Rifiyr', 'g2')) + '</section>'
      + '<section class="ui-card is-compact pd-stack"><div class="pd-title">Tables</div><div class="pd-row">' + roll('c', 'critical hit', 100, '1d100') + (state.c != null ? '<span>Table result for <b>' + state.c + '</b></span>' : '') + '</div><div class="pd-row">' + roll('s', 'surprise', 10, '1d10') + (state.s != null ? '<span>' + (state.s <= 3 ? 'Surprised' : 'Not surprised') + '</span>' : '') + '</div><div class="pd-row">' + roll('r', 'reaction', 0, '2d10') + (state.r != null ? '<span>Reaction for <b>' + state.r + '</b></span>' : '') + '</div></section>'
      + '</div>';
  }
  function account() {
    const opt = (v, t, d) => '<label class="pd-opt"><input type="radio" name="dice" value="' + v + '"' + (dice === v ? ' checked' : '') + '><span><b>' + t + '</b><small>' + d + '</small></span></label>';
    return '<h2 class="pd-h">On Account</h2><section class="ui-card pd-account"><h3>Dice</h3>' + opt('app', 'Roll for me', 'Roll buttons on your sheet and the DM Helper.') + opt('own', 'I’ll roll my own', 'The app says what to roll, and you type the result. It adds your bonuses.') + '</section>';
  }
  function render() {
    const f = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.key;
    $('page').innerHTML = account() + sheet() + dm();
    if (f) { const el = document.querySelector('[data-key="' + f + '"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  }
  const diceRoll = what => { const m = /^(\d+)d(\d+)/.exec(what); let t = 0; for (let i = 0; i < +m[1]; i++) t += rnd(+m[2]); return t; };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-roll]'); if (!b) return;
    const k = b.dataset.roll; state[k] = diceRoll(b.dataset.what);
    if (k === 'sa') state.sb = rnd(20);
    if (k === 'g1') state.g2 = rnd(20);
    render();
  });
  document.addEventListener('change', e => {
    if (e.target.name === 'dice') { dice = e.target.value; Object.keys(state).forEach(k => delete state[k]); render(); return; }
    const k = e.target.dataset.key; if (!k) return;
    const n = parseInt(e.target.value, 10), sides = +e.target.dataset.sides;
    const bad = !(n >= (sides ? 1 : 0)) || (sides && n > sides);
    e.target.setCustomValidity(e.target.value && bad ? 'Out of range' : '');
    if (!e.target.value || bad) { delete state[k]; e.target.classList.toggle('is-bad', !!e.target.value); if (!e.target.value) render(); return; }
    state[k] = n; render();
  });
  render();
`.replace('__ROLL__', () => JSON.stringify(ROLL_ICON)).replace('__D20__', () => JSON.stringify(D20_SVG));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Physical Dice</title>
<style>${STYLES}</style>
<style>
  body { margin: 0; padding: 24px var(--page-gutter) 64px; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans, Barlow, sans-serif); }
  .proto { max-width: 900px; margin: 0 auto; }
  .proto > p { color: var(--color-text-muted); margin: 0 0 8px; }
  .pd-h { font-family: var(--font-display, Spectral, serif); font-size: .8rem; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; margin: 28px 0 12px; color: var(--color-accent-text); }
  .pd-stack { display: grid; gap: 14px; }
  .pd-line { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--color-divider); }
  .pd-title { font-family: var(--font-display, Spectral, serif); font-weight: 700; }
  .pd-title span { font-family: var(--font-sans, Barlow, sans-serif); font-weight: 400; font-size: .85rem; color: var(--color-text-muted); margin-left: 6px; }
  .pd-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 20px; }
  .pd-row svg { width: 1.1em; height: 1.1em; vertical-align: -2px; color: var(--color-accent-text); }
  .pd-field { display: inline-flex; align-items: center; gap: 8px; }
  .pd-label { font-size: .9rem; color: var(--color-text-muted); }
  .pd-label b { color: var(--color-accent-text); font-weight: 700; }
  .pd-field input { width: 4rem; }
  .pd-field input.is-bad { border-color: var(--color-danger); }
  .pd-nat { font-size: .8rem; font-weight: 700; color: var(--color-success-text, inherit); align-self: center; }
  .pd-who { align-items: center; }
  .pd-who > span { min-width: 7rem; }
  .pd-num { font-weight: 700; }
  .pd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap: 16px; }
  .pd-account { display: grid; gap: 10px; max-width: 34rem; }
  .pd-account h3 { margin: 0; font-family: var(--font-display, Spectral, serif); }
  .pd-opt { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
  .pd-opt b { display: block; }
  .pd-opt small { display: block; font-size: .85rem; color: var(--color-text-muted); }
  .hit-stat-value { font-size: 1.4rem; height: auto; }
</style>
</head>
<body>
<div class="proto">
  <p>Prototype, with sample numbers; nothing is saved. Switch <b>Dice</b> on Account below, and everything under it changes.</p>
  <div id="page"></div>
</div>
<script>${client}</script>
</body>
</html>
`;
writeFileSync('prototypes/physical-dice.html', withHead(page));
console.log('ok');
