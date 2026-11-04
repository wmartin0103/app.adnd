// Writes prototypes/play-minimum.html: Home when a sheet must have the minimum
// (a name, a class with a level, six ability scores) before it can go into play.
// For review before the real page changes; sample data, nothing is saved.
// Run: node scripts/prototype-play-minimum.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const home = readFileSync('site/index.html', 'utf8');
const head = home.slice(home.indexOf('<head>') + 6, home.indexOf('</head>')).replace(/<script src=[^>]*><\/script>/g, '').replace(/<title>.*?<\/title>/, '<title>Play Minimum</title>');

const client = String.raw`
  const NEEDS = [['cls', 'a class with a level'], ['str', 'Strength'], ['dex', 'Dexterity'], ['con', 'Constitution'], ['int', 'Intelligence'], ['wis', 'Wisdom'], ['cha', 'Charisma']];
  const $ = id => document.getElementById(id);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let filled, status, said;
  function start() { filled = {}; status = 'backup'; said = 'Kess is saved to your account, in Backups.'; draw(); }
  const missing = () => NEEDS.filter(([k]) => !filled[k]).map(([, t]) => t);
  // "Strength, Wisdom and a class with a level"; all six scores read as one
  function list(items) {
    const scores = NEEDS.slice(1).map(([, t]) => t), all = scores.every(s => items.includes(s));
    const parts = all ? [...items.filter(i => !scores.includes(i)), 'all six ability scores'] : items;
    return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }
  function card() {
    const k = el('article', 'card' + (status === 'play' ? ' play' : status === 'dead' ? ' dead' : ''));
    if (status === 'play') k.appendChild(el('span', 'badge play', 'In play'));
    if (status === 'dead') k.appendChild(el('span', 'badge dead', 'Dead'));
    k.appendChild(el('h3', 'name', 'Kess'));
    k.appendChild(el('p', 'what', filled.cls ? 'Elf · Bard 3' : 'Elf'));
    k.appendChild(el('p', 'meta', 'Saved just now'));
    const a = el('div', 'actions');
    const open = el('button', 'btn small ui-button is-primary size-sm', 'Open sheet'); open.type = 'button'; a.appendChild(open);
    const short = missing();
    if (status !== 'play') {
      const b = el('button', 'btn quiet small ui-button is-secondary size-sm', status === 'dead' ? 'Return to play' : 'Bring into play'); b.type = 'button';
      b.disabled = !!short.length;
      if (short.length) b.setAttribute('aria-describedby', 'kess-needs');
      b.addEventListener('click', () => { status = 'play'; said = 'Kess is in play.'; draw(); });
      a.appendChild(b);
    }
    const m = el('button', 'btn quiet small more ui-button is-secondary is-icon size-sm', '⋯'); m.type = 'button'; m.setAttribute('aria-label', 'More for Kess'); a.appendChild(m);
    k.appendChild(a);
    if (status !== 'play' && short.length) { const n = el('p', 'pm-needs', 'To bring Kess into play, add ' + list(short) + '.'); n.id = 'kess-needs'; k.appendChild(n); }
    return k;
  }
  function draw() {
    const page = $('home'); page.textContent = '';
    page.appendChild(el('p', 'pm-said', said));
    const sec = (title, hint, body) => { const s = el('section'), h = el('div', 'section-head'); h.appendChild(el('h2', '', title)); s.appendChild(h); if (hint) s.appendChild(el('p', 'hint', hint)); if (body) { const c = el('div', 'cards'); c.appendChild(body); s.appendChild(c); } page.appendChild(s); };
    sec('In play', status === 'play' ? '' : 'No character in play yet, so you’re not in the party. Your DM can’t see you until you bring one in.', status === 'play' ? card() : null);
    if (status !== 'play') sec(status === 'dead' ? 'Dead' : 'Backups', '', card());
    const pick = $('picks'); pick.textContent = '';
    NEEDS.forEach(([k, t]) => { const l = el('label', 'pm-pick'), c = el('input'); c.type = 'checkbox'; c.className = 'ui-native'; c.checked = !!filled[k]; c.addEventListener('change', () => { filled[k] = c.checked; if (!said.includes('saved')) said = 'Kess is saved to your account.'; draw(); }); l.append(c, ' ' + t[0].toUpperCase() + t.slice(1)); pick.appendChild(l); });
  }
  $('all').addEventListener('click', () => { NEEDS.forEach(([k]) => { filled[k] = true; }); draw(); });
  $('reset').addEventListener('click', start);
  $('dead').addEventListener('click', () => { status = 'dead'; NEEDS.slice(1, 3).forEach(([k]) => { filled[k] = false; }); said = 'A dead character returning to play follows the same rule.'; draw(); });
  $('theme').addEventListener('click', () => { const d = document.documentElement; const dark = d.getAttribute('data-theme') === 'dark' || (!d.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches); d.setAttribute('data-theme', dark ? 'light' : 'dark'); });
  start();
`;

const page = `<!doctype html>
<html lang="en">
<head>${head}
<style>
  body { padding: 24px 16px 48px; }
  .pm { max-width: 56rem; margin: 0 auto; display: grid; gap: 24px; }
  .pm-try { display: grid; gap: 10px; padding: 14px 16px; border: 1px dashed var(--color-divider); border-radius: var(--radius-card); }
  .pm-try h1 { margin: 0; font-family: var(--font-display); font-size: 1.1rem; }
  .pm-try p { margin: 0; color: var(--color-text-muted); }
  .pm-picks { display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .pm-pick { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; font: inherit; letter-spacing: 0; text-transform: none; color: inherit; }
  .pm-btns { display: flex; flex-wrap: wrap; gap: 8px; }
  #home { display: grid; gap: 26px; }
  .pm-said { margin: 0; color: var(--color-text-muted); }
  .pm-needs { margin: 2px 0 0; font-size: 0.95rem; color: var(--color-text-muted); }
</style>
</head>
<body>
<div class="pm">
  <div class="pm-try">
    <h1>Prototype: the minimum before play</h1>
    <p>Sample data; nothing is saved. Kess is a new player's first character. Tick what the player has filled in on the sheet, and watch Home change.</p>
    <div class="pm-picks" id="picks"></div>
    <div class="pm-btns">
      <button type="button" class="ui-button is-secondary size-sm" id="all">Fill in everything</button>
      <button type="button" class="ui-button is-secondary size-sm" id="dead">Show as dead, missing two scores</button>
      <button type="button" class="ui-button is-link size-sm" id="reset">Start over</button>
      <button type="button" class="ui-button is-link size-sm" id="theme">Switch theme</button>
    </div>
  </div>
  <div id="home"></div>
</div>
<script>${client}</script>
</body>
</html>
`;
writeFileSync('prototypes/play-minimum.html', page);
console.log('ok');
