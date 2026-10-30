// Writes prototypes/dashboard.html: the home page as a dashboard for players
// and DMs (static, sample data, for review before site/index.html changes).
// Run: node scripts/prototype-dashboard.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { withHead } from './build-legacy.mjs';

// The home page's own styles, as they are
const home = readFileSync('site/index.html', 'utf8');
const pageCss = home.slice(home.indexOf('  <style>') + '  <style>'.length, home.indexOf('  </style>'));

const card = ({ name, what, meta, kind = '', badge = '', owner = '', view = false, menu = null }) => `
  <article class="card${kind ? ' ' + kind : ''}">
    ${badge}<h3 class="name">${name}</h3>
    ${owner ? `<p class="meta">${owner}</p>` : ''}<p class="what">${what}</p>${meta ? `<p class="meta">${meta}</p>` : ''}
    <div class="actions">${view
      ? `<a class="btn small ui-button is-secondary size-sm" href="#">View sheet</a>`
      : `<a class="btn small ui-button is-primary size-sm" href="#">Open sheet</a>`}${menu ? `<button type="button" class="btn quiet small more ui-button is-secondary is-icon size-sm" aria-label="More for ${name}" aria-expanded="${menu.open ? 'true' : 'false'}">⋯</button>` : ''}</div>
    ${menu && menu.open ? `<div class="menu ui-menu" role="menu">${menu.items}</div>` : ''}
  </article>`;
const section = (title, n, extra, hint, body) => `
  <section>
    <div class="section-head"><h2>${title}${n > 1 ? ` <span class="count">(${n})</span>` : ''}</h2>${extra || ''}</div>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
    ${body}
  </section>`;
const addButtons = `<div class="actions"><button type="button" class="btn quiet small ui-button is-secondary size-sm">New character</button><button type="button" class="btn quiet small ui-button is-secondary size-sm">Import file</button></div>`;

// ── A player ──
const player = `
  ${section('In play', 0, addButtons, '', `<div class="cards">${card({ name: 'Jaque', kind: 'play', badge: '<span class="badge play">In play</span>', what: 'Elf · Blade Bard 5', meta: 'Saved today' })}</div>`)}
  ${section('Backups', 1, '', 'Ready for the next session, if your character in play falls.', `<div class="cards">${card({ name: 'Tig', what: 'Halfling · Thief 4', meta: 'Saved last week', menu: { open: false } })}</div>`)}
  ${section('Shared with you', 1, '', 'Characters others have let you play.', `<div class="cards">${card({ name: 'Hanspeter', badge: '<span class="badge given">Alex’s · you can play</span>', what: 'Human · Fighter 5', meta: 'Saved yesterday' })}</div>`)}
  ${section('Dead', 1, '', '', `<div class="cards">${card({ name: 'Borsun', kind: 'dead', badge: '<span class="badge dead">Dead</span>', what: 'Dwarf · Fighter 4', meta: 'Saved in March', menu: { open: false } })}</div>`)}`;

// ── A DM (or an admin) ──
const assignMenu = `<button type="button" role="menuitem">Assign to player…</button><hr><button type="button" role="menuitem">Make a copy</button><button type="button" role="menuitem">Export file</button><hr><button type="button" role="menuitem" class="danger">Delete…</button>`;
const dm = `
  <div class="choices dm-entry">
    <a class="choice ui-choice" href="#" role="button"><span class="t">DM Helper</span><span class="d">Run the round: initiative, attacks, checks, saves and encounters.</span></a>
  </div>
  ${section('Party', 4, '', 'Each player’s character in play. View only.', `<div class="cards">
    ${card({ name: 'Jaque', owner: 'Sam’s', what: 'Elf · Blade Bard 5', meta: 'Saved today', view: true })}
    ${card({ name: 'Rifiyr', owner: 'Alex’s', what: 'Elf · Ranger 5', meta: 'Saved today', view: true })}
    ${card({ name: 'Goroth', owner: 'Jo’s', what: 'Half-Orc · Cleric 3', meta: 'Saved yesterday', view: true })}
    ${card({ name: 'Atteroak', owner: 'Kim’s', what: 'Dwarf · Cleric 5', meta: 'Saved yesterday', view: true })}
  </div>`)}
  ${section('Backups', 2, addButtons, 'Characters you’ve prepared. Assign one to a player when they need it.', `<div class="cards">
    ${card({ name: 'Nebish', what: 'Gnome · Illusionist 4', meta: 'Saved today', menu: { open: true, items: assignMenu } })}
    ${card({ name: 'Bartholomew', what: 'Not filled in yet', meta: 'Saved today', menu: { open: false } })}
  </div>`)}
  <dialog class="ui-overlay assign" open aria-labelledby="as-t">
    <h3 id="as-t">Assign Nebish to a player?</h3>
    <p>Nebish moves to their Backups, ready for them to bring into play. You won’t see it here any more.</p>
    <fieldset><legend>Player</legend>
      <label><input type="radio" name="p" checked> <span>Alex</span></label>
      <label><input type="radio" name="p"> <span>Jo</span></label>
      <label><input type="radio" name="p"> <span>Kim</span></label>
      <label><input type="radio" name="p"> <span>Sam</span></label>
    </fieldset>
    <div class="row"><button class="btn quiet ui-button is-secondary">Cancel</button><button class="btn ui-button is-primary">Assign</button></div>
  </dialog>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Home dashboard</title>
<style>${pageCss}
  /* Prototype only */
  .proto { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px dashed var(--color-border); border-radius: var(--radius-inner); }
  .proto .lab { font: 600 11px/1.2 var(--font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-muted); }
  .view[hidden] { display: none; }
  .view { display: grid; gap: 24px; }
  /* The DM's way into the DM Helper: a choice card, on its own row */
  .dm-entry { grid-template-columns: minmax(16rem, 24rem); }
  /* The assign dialog, shown open here beside the menu that opens it */
  dialog.assign { position: static; margin: 150px 0 0; }   /* below the open menu that opens it */
  .top .camp { color: var(--color-text-muted); font-size: 0.95rem; }
  .notes { font-size: 14px; color: var(--color-text-muted); }
  .notes ul { margin: 4px 0 0; padding-left: 1.1em; }
</style>
</head>
<body>
  <div class="theme-corner" id="themeSlot"></div>
  <div class="page">
    <header class="top">
      <h1>AD&amp;D Campaign</h1><span class="camp">The Gnoll Hills</span>
      <div class="who"><span>Sam</span><a class="btn quiet small ui-button is-secondary size-sm" href="#">Account</a><button class="btn quiet small ui-button is-secondary size-sm" type="button">Sign out</button></div>
    </header>
    <div class="proto"><span class="lab">Prototype: show</span><div class="ui-tabs size-sm" role="group" id="who"><button type="button" class="is-active" aria-pressed="true" data-v="player">A player</button><button type="button" aria-pressed="false" data-v="dm">The DM</button></div></div>
    <main class="view" data-view="player">${player}</main>
    <main class="view" data-view="dm" hidden>${dm}</main>
    <div class="notes"><b>What changes</b><ul>
      <li>The DM Helper link in the header becomes a choice card at the top, for the DM or an admin.</li>
      <li>DM: a Party section, each player's character in play, opened read-only (View sheet; the sheet's fields and saving are off).</li>
      <li>DM: New character and Import file put characters in their Backups; a backup's menu has "Assign to player…", which moves it to that player's Backups.</li>
      <li>Players: Shared with you is its own section (characters others have let them play).</li>
    </ul></div>
  </div>
<script>
  document.getElementById('who').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#who button').forEach(x => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b); });
    document.querySelectorAll('.view').forEach(v => v.hidden = v.dataset.view !== b.dataset.v); });
  (function(){ const b=document.createElement('button'); b.className='ui-button is-secondary is-icon size-sm'; b.type='button'; b.setAttribute('aria-label','Light or dark');
    const cur=()=>document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    const show=()=>{ b.textContent = cur()==='dark' ? '☀' : '☾'; };
    b.onclick=()=>{ document.documentElement.dataset.theme = cur()==='dark' ? 'light' : 'dark'; show(); }; show();
    document.getElementById('themeSlot').appendChild(b); })();
</script>
</body>
</html>
`;
writeFileSync('prototypes/dashboard.html', withHead(page));
console.log('ok');
