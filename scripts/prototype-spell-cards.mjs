// Writes prototypes/spell-cards.html: the sheet's Spells section with a Simple /
// Detailed toggle, and Add Spell as a search of the catalog. A card's title is
// its wiki link; Detailed cards carry a quick reference from the catalog. It
// works, on the real catalog (for review before tools/character-sheet.html
// changes; nothing is saved).
// Run: node scripts/prototype-spell-cards.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { withHead } from './build-tools.mjs';

// The sheet's own styles, as they are
const sheet = readFileSync('tools/character-sheet.html', 'utf8');
const from = sheet.indexOf('<style>', sheet.indexOf('</style>')) + '<style>'.length;
const sheetCss = sheet.slice(from, sheet.indexOf('</style>', from));
const removeIcon = (sheet.match(/const REMOVE_ICON = '([^']+)'/) || [])[1] || '×';

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

  /* The toggle: the Extra attacks pattern (a label on the left, small tab buttons) */
  .spell-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
  .spell-size { display: flex; align-items: center; gap: 8px; }
  .spell-size > span { font-family: var(--font-display); font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-muted); }
  .spell-section-heading { margin-top: 28px; }
  .spell-bar + .spell-section-heading { margin-top: 0; }

  /* The title is the wiki link */
  .spell-title { font-family: var(--font-display); font-size: .82rem; font-weight: 700; color: var(--color-accent-text); text-decoration: none; padding: .1em 0; overflow-wrap: anywhere; }
  .spell-title:hover { text-decoration: underline; }
  .spell-title:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; border-radius: 2px; }
  .spell-title span { font-weight: 400; font-size: .85em; }

  /* Simple: no quick reference */
  .spell-qr { display: none; }

  /* Detailed: fewer columns, the quick reference shows */
  .is-detailed .spell-card-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .is-detailed .spell-card { gap: .5rem; }
  .is-detailed .spell-card-notes { margin-top: auto; }   /* notes line up along a row of cards */
  .is-detailed .spell-title { font-size: 1.05rem; }
  .is-detailed .spell-qr { display: grid; gap: 8px; }
  .qr-school { margin: 0; font-size: .85rem; color: var(--ink-muted); }
  /* A tinted item (never an inner shadow): what you need to roll, then the rest */
  .qr-block { display: grid; gap: 10px; margin: 0; padding: 10px 12px; border-radius: var(--radius-inner); background: color-mix(in oklab, var(--color-text) 4%, transparent); }
  .qr-keys { display: flex; flex-wrap: wrap; gap: 8px 24px; padding-bottom: 10px; border-bottom: 1px solid var(--color-divider); }
  .qr-rest { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
  .qr-stat { min-width: 0; }
  .qr-stat dt { font-family: var(--font-display); font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 2px; }
  .qr-stat dd { margin: 0; font-size: .9rem; color: var(--ink); overflow-wrap: anywhere; }
  .qr-stat.is-key dd { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; color: var(--color-accent-text); }
  .qr-stat.is-quiet dd { font-size: 1.05rem; color: var(--ink-muted); }

  /* The search */
  dialog.spell-search { width: min(44rem, calc(100vw - 32px)); margin: auto; padding: 20px; color: var(--ink); }
  .ss-form { display: grid; gap: 12px; }
  .ss-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ss-head h3 { margin: 0; font-family: var(--font-display); font-size: 1.1rem; }
  .ss-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
  .ss-filters input { flex: 1 1 14rem; min-width: 0; }
  .ss-count { margin: 0; font-size: .85rem; color: var(--ink-muted); min-height: 1.3em; }
  .ss-list { list-style: none; margin: 0; padding: 0; height: min(24rem, 50vh); overflow-y: auto; display: grid; align-content: start; gap: 4px; }
  .ss-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 10px; background: none; border: 1px solid transparent; border-radius: var(--radius-inner); color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ss-row:hover:not(:disabled), .ss-row:focus-visible { background: color-mix(in oklab, var(--color-text) 6%, transparent); border-color: var(--color-divider); outline: none; }
  .ss-main { flex: 1; min-width: 0; display: grid; gap: 1px; }
  .ss-name { font-family: var(--font-display); font-weight: 700; }
  .ss-sub { font-size: .82rem; color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ss-tags { flex: none; display: flex; align-items: center; gap: 4px; }
  .ss-row:disabled { cursor: default; }
  .ss-row:disabled .ss-name { color: var(--ink-muted); }
  .ss-added { font-size: .82rem; color: var(--color-success-text, var(--ink-muted)); white-space: nowrap; }
  .ss-foot { display: flex; justify-content: flex-end; }
</style>
<script src="../data/spell-catalog.js"></script>
</head>
<body>
<div class="proto" id="spells">
  <p class="proto-note">Prototype, on the real catalog; nothing is saved. Add Spell searches, the toggle works, and each title opens the wiki in a new tab. The sample caster is a level 5 wizard.</p>
  <div class="spell-bar">
    <button type="button" class="ui-button is-primary" id="add">＋ Add Spell</button>
    <div class="spell-size"><span>View</span>
      <div class="ui-tabs size-sm" role="group" aria-label="Spell card view">
        <button type="button" data-v="simple" aria-pressed="true">Simple</button>
        <button type="button" data-v="detailed" aria-pressed="false">Detailed</button>
      </div>
    </div>
  </div>
  <div id="list"></div>
</div>

<dialog class="ui-overlay spell-search" id="search" aria-labelledby="ss-title">
  <div class="ss-form">
    <div class="ss-head">
      <h3 id="ss-title">Add a spell</h3>
      <button type="button" class="ui-button is-primary size-sm" id="ss-done">Done</button>
    </div>
    <div class="ss-filters">
      <input type="search" id="ss-q" placeholder="Search by name" aria-label="Search spells by name" autocomplete="off">
      <div class="ui-tabs" role="group" aria-label="Spell type" id="ss-class">
        <button type="button" data-v="wizard" aria-pressed="true">Wizard</button>
        <button type="button" data-v="priest" aria-pressed="false">Priest</button>
      </div>
      <select id="ss-level" aria-label="Spell level"></select>
    </div>
    <p class="ss-count" id="ss-count" role="status"></p>
    <ul class="ss-list" id="ss-list"></ul>
  </div>
</dialog>

<script>
  const CAT = window.SheetSpellCatalog.spells, LEVEL = 5, MAX = 60;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
  const levelTag = l => '<span class="spell-level-badge tag' + (ORD[l] ? ' tag-l' + l : '') + '">' + (ORD[l] || 'Special') + '</span>';
  const classTag = c => '<span class="spell-type-badge spell-type-' + c + ' tag tag-caps tag-' + c + '">' + (c === 'priest' ? 'Priest' : 'Wizard') + '</span>';
  const isPHB = e => /player's handbook|^phb/i.test(e.source || '');

  // ── The cards ──
  let uid = 0;
  const spell = (name, cls, memorized, charges = 1, notes = '') => {
    const e = CAT.filter(x => x.name === name && x.class === cls).sort((a, b) => isPHB(b) - isPHB(a))[0];
    return { id: ++uid, e, memorized, charges, notes };
  };
  let spells = [
    spell('Fireball', 'wizard', true, 2), spell('Magic Missile', 'wizard', true, 2), spell('Shocking Grasp', 'wizard', true),
    spell('Fireball', 'wizard', false), spell('Magic Missile', 'wizard', false), spell('Shocking Grasp', 'wizard', false),
    spell('Sleep', 'wizard', false, 1, 'Good against the goblins'), spell('Haste', 'wizard', false),
  ];

  // "1d6/level" at the caster's level, up to the spell's cap; anything else as written
  function diceNow(e) {
    const lvl = Math.min(LEVEL, e.diceMaxLevel || LEVEL);
    let m = /^1d(\\d+)\\/level$/.exec(e.dice);
    if (m) return lvl + 'd' + m[1];
    m = /^(\\d+d\\d+)\\+1\\/level$/.exec(e.dice);
    if (m) return m[1] + '+' + lvl;
    return e.dice;
  }
  // A save in plain words: what a successful one does
  const saveSays = v => {
    const t = String(v || 'None').trim();
    if (/^(½|1\\/2)$/.test(t)) return '½ damage';
    if (/^neg(\\.|ates?)?( effects)?$/i.test(t)) return 'Negates';
    return t;
  };
  const stat = (label, value, cls = '') => (value ? '<div class="qr-stat ' + cls + '"><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>' : '');
  const quickRef = e => '<p class="qr-school">' + esc(e.school.split(';')[0].split(' · ')[0]) + '</p><dl class="qr-block"><div class="qr-keys">'
    + stat(e.diceKind === 'heal' ? 'Heals' : 'Damage', e.dice ? diceNow(e) : '', 'is-key')
    + stat('Save', saveSays(e.save), e.save && !/^none$/i.test(e.save.trim()) ? 'is-key' : 'is-quiet')
    + stat('Attack roll', { touch: 'Touch', ranged: 'Ranged' }[e.attack] || '', 'is-key')
    + '</div><div class="qr-rest">' + stat('Cast', e.castTime) + stat('Range', e.range) + stat('Duration', e.duration) + stat('Area', e.area) + '</div></dl>';

  function card(s) {
    const e = s.e;
    const cast = s.memorized && !s.charges;
    return '<div class="spell-card ui-card is-compact' + (cast ? ' spell-card-cast' : '') + '" data-id="' + s.id + '"><div class="spell-card-top">'
      + levelTag(e.level) + classTag(e.class) + '<span style="flex:1"></span>'
      + (s.memorized
        ? '<span class="ui-qty size-xs"><button type="button" data-act="less" aria-label="One fewer">−</button><input type="text" value="' + s.charges + '" aria-label="Memorized" readonly><button type="button" data-act="more" aria-label="One more">+</button></span>'
        : '<label class="spell-mem-wrap" title="Add to Memorized"><input type="checkbox" class="spell-mem-chk" data-act="mem" aria-label="Memorize ' + esc(e.name) + '"' + (spells.some(x => x.memorized && x.e === e) ? ' checked' : '') + '></label>')
      + '<button type="button" class="ui-button is-bare is-remove" data-act="rm" aria-label="Remove ' + esc(e.name) + '">${removeIcon.replace(/'/g, "\\'")}</button></div>'
      + '<a class="spell-title" href="' + esc(e.link) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(e.name) + ' on the wiki (opens in a new tab)">' + esc(e.name) + ' <span aria-hidden="true">↗</span></a>'
      + '<div class="spell-qr">' + quickRef(e) + '</div>'
      + '<input type="text" class="spell-card-notes open-field" value="' + esc(s.notes) + '" placeholder="Notes…" aria-label="Notes on ' + esc(e.name) + '"></div>';
  }
  function render() {
    const part = (title, on) => {
      const rows = spells.filter(s => s.memorized === on).sort((a, b) => a.e.level - b.e.level || a.e.name.localeCompare(b.e.name));
      return rows.length ? '<div class="spell-section-heading">' + title + '</div><div class="spell-card-grid">' + rows.map(card).join('') + '</div>' : '';
    };
    $('list').innerHTML = part('Memorized', true) + part('Spellbook', false);
  }
  $('list').addEventListener('click', ev => {
    const act = ev.target.dataset.act; if (!act) return;
    const s = spells.find(x => x.id === +ev.target.closest('[data-id]').dataset.id);
    if (act === 'less') s.charges = Math.max(0, s.charges - 1);
    if (act === 'more') s.charges += 1;
    if (act === 'rm') spells = spells.filter(x => x !== s);
    if (act === 'mem') {
      if (ev.target.checked) spells.push({ id: ++uid, e: s.e, memorized: true, charges: 1, notes: s.notes });
      else spells = spells.filter(x => !(x.memorized && x.e === s.e));
    }
    render();
  });
  document.querySelectorAll('.spell-size button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.spell-size button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('spells').classList.toggle('is-detailed', b.dataset.v === 'detailed');
  }));

  // ── The search ──
  let cls = 'wizard';
  $('ss-level').innerHTML = '<option value="">Any level</option>' + [1,2,3,4,5,6,7,8,9].map(n => '<option value="' + n + '">Level ' + n + '</option>').join('') + '<option value="other">Special</option>';
  function results() {
    const q = $('ss-q').value.trim().toLowerCase(), lv = $('ss-level').value;
    const named = e => !q || e.name.toLowerCase().includes(q) || (e.aliases || []).some(a => a.toLowerCase().includes(q));
    const inLevel = e => !lv || (lv === 'other' ? !ORD[e.level] : e.level === +lv);
    // The name's start first, then the start of a word, then anywhere
    const starts = e => { const n = e.name.toLowerCase(); return !q || n.startsWith(q) ? 0 : n.includes(' ' + q) ? 1 : 2; };
    return CAT.filter(e => e.class === cls && named(e) && inLevel(e))
      .sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name) || isPHB(b) - isPHB(a));
  }
  function search() {
    const hits = results(), shown = hits.slice(0, MAX);
    $('ss-count').textContent = !hits.length ? 'No spells match.'
      : hits.length > MAX ? 'Showing the first ' + MAX + ' of ' + hits.length + '. Type or pick a level to narrow it down.'
      : hits.length + (hits.length === 1 ? ' spell' : ' spells');
    $('ss-list').innerHTML = shown.map(e => {
      const have = spells.some(s => s.e === e && !s.memorized);
      const sub = e.school.split(';')[0].split(' · ')[0] + ' · ' + String(e.source || '').split(';')[0];
      return '<li><button type="button" class="ss-row" data-id="' + esc(e.id) + '"' + (have ? ' disabled' : '') + '>'
        + '<span class="ss-main"><span class="ss-name">' + esc(e.name) + '</span><span class="ss-sub">' + esc(sub) + '</span></span>'
        + '<span class="ss-tags">' + (have ? '<span class="ss-added">✓ Added</span>' : '') + levelTag(e.level) + '</span></button></li>';
    }).join('');
    $('ss-list').scrollTop = 0;
  }
  $('add').addEventListener('click', () => { $('ss-q').value = ''; search(); $('search').showModal(); $('ss-q').focus(); });
  $('ss-done').addEventListener('click', () => $('search').close());
  $('ss-q').addEventListener('input', search);
  $('ss-level').addEventListener('change', search);
  $('ss-class').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    cls = b.dataset.v;
    $('ss-class').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    search();
  });
  // Picking one adds it to the Spellbook; the search stays open for the next
  $('ss-list').addEventListener('click', ev => {
    const b = ev.target.closest('.ss-row'); if (!b || b.disabled) return;
    const e = CAT.find(x => x.id === b.dataset.id);
    spells.push({ id: ++uid, e, memorized: false, charges: 1, notes: '' });
    render(); search();
    $('ss-count').textContent = e.name + ' added to your Spellbook.';
    $('ss-q').focus(); $('ss-q').select();
  });
  // Arrow keys move between the box and the list
  $('search').addEventListener('keydown', ev => {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const rows = [...$('ss-list').querySelectorAll('.ss-row:not(:disabled)')];
    const i = rows.indexOf(document.activeElement);
    if (ev.target.tagName === 'SELECT') return;
    ev.preventDefault();
    if (ev.key === 'ArrowDown') (rows[i + 1] || rows[i] || $('ss-q')).focus();
    else (i > 0 ? rows[i - 1] : $('ss-q')).focus();
  });
  render();
</script>
</body>
</html>
`;
writeFileSync('prototypes/spell-cards.html', withHead(page));
console.log('ok');
