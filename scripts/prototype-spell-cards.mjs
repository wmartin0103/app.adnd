// Writes prototypes/spell-cards.html: the sheet's Spells section with a Simple /
// Detailed toggle, Detailed cards carrying a quick reference from the spell
// catalog (real entries; for review before tools/character-sheet.html changes).
// Run: node scripts/prototype-spell-cards.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { withHead } from './build-tools.mjs';

// The sheet's own styles, as they are
const sheet = readFileSync('tools/character-sheet.html', 'utf8');
const from = sheet.indexOf('<style>', sheet.indexOf('</style>')) + '<style>'.length;
const sheetCss = sheet.slice(from, sheet.indexOf('</style>', from));
const removeIcon = (sheet.match(/const REMOVE_ICON = '([^']+)'/) || [])[1] || '×';

const catalog = JSON.parse(readFileSync('data/spell-catalog.json', 'utf8')).spells;
const entry = (name, cls) => catalog.find(s => s.name === name && s.class === cls);
const LEVEL = 5;   // the sample caster
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

// "1d6/level" at the caster's level, up to the spell's cap; anything else as written
function diceNow(e) {
  const lvl = Math.min(LEVEL, e.diceMaxLevel || LEVEL);
  let m = /^1d(\d+)\/level$/.exec(e.dice);
  if (m) return `${lvl}d${m[1]}`;
  m = /^(\d+d\d+)\+1\/level$/.exec(e.dice);
  if (m) return `${m[1]}+${lvl}`;
  return e.dice;
}
// A save in plain words: what a successful one does
const saveSays = v => {
  const t = String(v || 'None').trim();
  if (/^(½|1\/2)$/.test(t)) return '½ damage';
  if (/^neg(\.|ates?)?( effects)?$/i.test(t)) return 'Negates';
  return t;
};
const stat = (label, value, cls = '') => (value ? `<div class="qr-stat${cls ? ' ' + cls : ''}"><dt>${label}</dt><dd title="${esc(value)}">${esc(value)}</dd></div>` : '');
const quickRef = e => {
  if (!e) return '<p class="qr-none">Not in the catalog: nothing to show here. Your notes and link still work.</p>';
  const dice = e.dice ? `${diceNow(e)}` : '';
  const kind = e.diceKind === 'heal' ? 'Heals' : 'Damage';
  return `<p class="qr-school">${esc(e.school.split(';')[0].split(' · ')[0])}</p>
    <dl class="qr-block">
      <div class="qr-keys">
        ${stat(kind, dice, 'is-key')}
        ${stat('Save', saveSays(e.save), e.save && !/^none$/i.test(e.save.trim()) ? 'is-key' : 'is-quiet')}
        ${stat('Attack roll', { touch: 'Touch', ranged: 'Ranged' }[e.attack] || '', 'is-key')}
      </div>
      <div class="qr-rest">
      ${stat('Cast', e.castTime)}
      ${stat('Range', e.range)}
      ${stat('Duration', e.duration)}
      ${stat('Area', e.area)}
      </div>
    </dl>`;
};

const card = (name, cls, { level, charges = 1, notes = '', section = 'memorized' } = {}) => {
  const e = entry(name, cls);
  const lvl = e ? e.level : level;
  const typeLabel = cls === 'wizard' ? 'Wizard' : 'Priest';
  return `<div class="spell-card ui-card is-compact">
    <div class="spell-card-top">
      <span class="spell-level-badge tag tag-l${lvl}">${ORD[lvl]}</span>
      <span class="spell-type-badge spell-type-${cls} tag tag-caps tag-${cls}">${typeLabel}</span>
      <span style="flex:1"></span>
      ${section === 'memorized'
        ? `<span class="ui-qty size-xs"><button type="button" aria-label="One fewer">−</button><input type="text" value="${charges}" aria-label="Memorized"><button type="button" aria-label="One more">+</button></span>`
        : `<label class="spell-mem-wrap" title="Add to Memorized"><input type="checkbox" class="spell-mem-chk" aria-label="Memorize spell"></label>`}
      <button type="button" class="ui-button is-bare is-remove" aria-label="Remove spell">${removeIcon}</button>
    </div>
    <input type="text" class="spell-card-name open-field" value="${esc(name)}" aria-label="Spell name">
    <div class="spell-qr">${quickRef(e)}</div>
    <input type="text" class="spell-card-notes open-field" value="${esc(notes)}" placeholder="Notes…" aria-label="Spell notes">
    ${e ? '' : `<div class="spell-card-url-row"><input type="url" class="spell-card-url-inp open-field" placeholder="Reference URL…" aria-label="Spell reference URL"></div>`}
    <div class="spell-card-bottom">
      <select class="spell-card-select" aria-label="Spell level"><option>Lvl ${lvl}</option></select>
      <select class="spell-card-select" aria-label="Spell type"><option>${typeLabel}</option></select>
      ${e ? `<a class="spell-details-link spell-info" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)} on the wiki (opens in a new tab)">Info ↗</a>` : ''}
    </div>
  </div>`;
};

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spell Cards</title>
<style>${sheetCss}</style>
<style>
  body { padding: 24px var(--page-gutter) 64px; }
  .proto { max-width: var(--page-max); margin: 0 auto; }
  .proto-note { color: var(--ink-muted); margin: 0 0 20px; max-width: 46rem; }
  .proto-bar { display: flex; justify-content: flex-end; margin-bottom: 12px; }

  /* The toggle: the Extra attacks pattern (a label on the left, small tab buttons) */
  .spell-size { display: flex; align-items: center; gap: 8px; }
  .spell-size > span { font-family: var(--font-display); font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-muted); }
  .spell-sec-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .spell-sec-head .spell-section-heading { flex: 1; }

  .spell-card-bottom { align-items: center; }
  .spell-info { margin-left: auto; white-space: nowrap; }

  /* Simple: the cards as they are today, no quick reference */
  .spell-qr { display: none; }

  /* Detailed: fewer columns, the quick reference shows */
  .is-detailed .spell-card-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .is-detailed .spell-card { gap: .5rem; }
  .is-detailed .spell-card-notes { margin-top: auto; }   /* notes and link line up along a row of cards */
  .is-detailed .spell-card-name { font-size: 1.05rem; }
  .is-detailed .spell-qr { display: grid; gap: 8px; }
  .qr-school { margin: 0; font-size: .85rem; color: var(--ink-muted); }
  .qr-none { margin: 0; font-size: .9rem; font-style: italic; color: var(--ink-muted); }
  /* A tinted item (never an inner shadow): what you need to roll, then the rest */
  .qr-block { display: grid; gap: 10px; margin: 0; padding: 10px 12px; border-radius: var(--radius-inner); background: color-mix(in oklab, var(--color-text) 4%, transparent); }
  .qr-keys { display: flex; flex-wrap: wrap; gap: 8px 24px; padding-bottom: 10px; border-bottom: 1px solid var(--color-divider); }
  .qr-rest { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
  .qr-stat { min-width: 0; }
  .qr-stat dt { font-family: var(--font-display); font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 2px; }
  .qr-stat dd { margin: 0; font-size: .9rem; color: var(--ink); overflow-wrap: anywhere; }
  .qr-stat.is-key dd { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; color: var(--color-accent-text); }
  .qr-stat.is-quiet dd { font-size: 1.05rem; color: var(--ink-muted); }
</style>
</head>
<body>
<div class="proto" id="spells">
  <p class="proto-note">Prototype, with real catalog entries. The sample caster is level 5, so Fireball's "1d6/level" reads 5d6. The Simple / Detailed toggle works.</p>
  <div class="spell-sec-head">
    <div class="spell-section-heading">Memorized</div>
    <div class="spell-size"><span>View</span>
      <div class="ui-tabs size-sm" role="group" aria-label="Spell card view">
        <button type="button" data-v="simple" aria-pressed="true">Simple</button>
        <button type="button" data-v="detailed" aria-pressed="false">Detailed</button>
      </div>
    </div>
  </div>
  <div class="spell-card-grid">
    ${card('Fireball', 'wizard', { charges: 2 })}
    ${card('Magic Missile', 'wizard', { charges: 2 })}
    ${card('Shocking Grasp', 'wizard')}
    ${card('Sleep', 'wizard', { notes: 'Good against the goblins' })}
    ${card('Haste', 'wizard')}
    ${card('Hold Person', 'priest')}
    ${card('Cure Light Wounds', 'priest', { charges: 3 })}
    ${card('Mordrin’s Quiet Word', 'wizard', { level: 2, notes: 'Homebrew, from the DM' })}
  </div>
</div>
<script>
  const root = document.getElementById('spells');
  document.querySelectorAll('.spell-size button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.spell-size button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    root.classList.toggle('is-detailed', b.dataset.v === 'detailed');
  }));
</script>
</body>
</html>
`;
writeFileSync('prototypes/spell-cards.html', withHead(page));
console.log('ok');
