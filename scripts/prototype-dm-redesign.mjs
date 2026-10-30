// Writes prototypes/dm-redesign.html: the DM Helper redesigned on the design system (static, sample
// data, for review before the real tool is rebuilt). Run: node scripts/prototype-dm-redesign.mjs
import { writeFileSync } from 'node:fs';
import { withHead } from './build-legacy.mjs';

const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const DIE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 2v20M3 7l9 5 9-5"/></svg>';
const sel = (opts, cur, w = '') => `<select${w ? ` style="width:${w}"` : ''}>${opts.map(o => `<option${o === cur ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
const tabs = (opts, cur, label) => `<div class="ui-tabs size-sm" role="group" aria-label="${label}">${opts.map(o => `<button type="button" class="${o === cur ? 'is-active' : ''}" aria-pressed="${o === cur}">${o}</button>`).join('')}</div>`;
const field = (label, ctl) => `<label class="f"><span class="lab">${label}</span>${ctl}</label>`;

// ── Initiative ──
const party = [
  { name: 'Jaque', act: 9, speed: 2, init: 7, from: 'Dagger, melee · 3/2 attacks · rolled 10 to hit: hits AC 1 · 5 damage', tag: '5th' },
  { name: 'Rifiyr', act: 11, speed: 5, init: 6, from: 'Long bow · 2 arrows · waiting for the roll', tag: '5th' },
  { name: 'Goroth', act: 13, speed: 4, init: 9, from: 'Cast: Cure Light Wounds (5) on Atteroak', tag: '3rd' },
  { name: 'Hanspeter', act: 15, speed: 7, init: 8, from: 'Not sent yet', tag: '5th', none: true },
];
const enemies = [
  { id: 'E1', name: 'Gnoll 1', act: 8, speed: 3, init: 5, ac: 5, thac0: 19, open: true },
  { id: 'E2', name: 'Gnoll 2', act: 12, speed: 3, init: 9, ac: 5, thac0: 19 },
];
const rows = [...party.map(p => ({ ...p, pc: true })), ...enemies].sort((a, b) => a.act - b.act);
const attack = (n, extra = '') => `<div class="ui-item is-tinted atk">
  <div class="atk-head"><b>Attack ${n}</b><button type="button" class="ui-button is-secondary size-sm">Duplicate</button>${n > 1 ? `<button type="button" class="ui-button is-bare is-icon is-danger is-remove size-sm" aria-label="Remove attack ${n}">${X}</button>` : ''}</div>
  <div class="line">${field('Dice', sel(['d4', 'd6', 'd8', '2d4'], n === 1 ? '2d4' : 'd6', '5rem'))}${field('Bonus', sel(['0', '+1', '+2'], '0', '4.5rem'))}${field('Targets', sel(['Jaque', 'Rifiyr', 'Goroth', 'Hanspeter', 'None'], n === 1 ? 'Jaque' : 'None', '9rem'))}${field('Ground', sel(['Level', 'Higher', 'Lower'], 'Level', '6rem'))}${field('Conditions', sel(['None', 'Flanking', 'Charging'], 'None', '8rem'))}${field('Other', sel(['0', '+1', '+2', '−1'], '0', '4.5rem'))}
    <div class="readout"><span class="lab">THAC0</span><span class="num">19</span></div>
    <button type="button" class="ui-button is-primary size-sm roll">${DIE} Roll to hit</button></div>${extra}
</div>`;
const orderRow = r => r.pc ? `
  <div class="orow ui-card is-compact is-ally">
    <div class="who"><span class="nm">${r.name}</span><span class="meta">${r.tag}</span></div>
    ${field('Speed', sel(['—', '1', '2', '3', '4', '5', '6', '7'], String(r.speed), '4.5rem'))}${field('Init', sel(['—', ...Array.from({ length: 10 }, (_, i) => String(i + 1))], String(r.init), '4.5rem'))}
    <span class="act">${r.act}</span>
    <div class="detail ui-well${r.none ? ' is-none' : ''}"><span class="lab">From the sheet</span> ${r.from}</div>
  </div>` : `
  <div class="orow ui-card is-compact is-opponent is-enemy">
    <div class="who"><input type="checkbox" checked aria-label="${r.name} in the round"><span class="tag">${r.id}</span><input class="open-field nm-in" value="${r.name}" aria-label="Enemy name">
      <span class="mini">${field('AC', sel(['3', '4', '5', '6'], String(r.ac), '4rem'))}${field('THAC0', sel(['17', '18', '19', '20'], String(r.thac0), '4.5rem'))}</span>
      <button type="button" class="ui-button is-bare is-icon size-sm" aria-label="Duplicate ${r.name}">${COPY}</button><button type="button" class="ui-button is-bare is-icon is-danger is-remove size-sm" aria-label="Remove ${r.name}">${X}</button></div>
    ${field('Speed', sel(['1', '2', '3', '4', '5'], String(r.speed), '4.5rem'))}${field('Init', sel(['—', ...Array.from({ length: 10 }, (_, i) => String(i + 1))], String(r.init), '4.5rem'))}
    <span class="act">${r.act}</span>
    <div class="detail"><button type="button" class="ui-disclosure" aria-expanded="${!!r.open}"><span class="ui-disclosure-chev" aria-hidden="true"></span>${r.open ? 'Attacks' : 'Attacks · 1 · 2d4, THAC0 19'}</button>
      <div class="atks"${r.open ? '' : ' hidden'}>${attack(1, `<div class="ui-well hit"><span class="die"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z"/></svg><b>14</b></span><div><span class="lab">Hits AC</span><span class="big">5</span></div><div><span class="lab">vs Jaque, AC 4</span><span class="big miss">Miss</span></div></div>`)}<button type="button" class="ui-button is-link size-sm">+ Add attack</button></div></div>
  </div>`;

const surprise = `
    <section class="ui-card size-sm">
      <div class="card-head"><button type="button" class="ui-disclosure" aria-expanded="true"><span class="ui-disclosure-chev" aria-hidden="true"></span><h3>Surprise</h3></button><span class="hint">d10 each, 1–3 surprised</span></div>
      <div class="line">${field('Party', sel(['Casual 0', 'Suspicious +1'], 'Casual 0', '8rem'))}${field('Light', sel(['Normal', 'Poor −1', 'Darkness −4'], 'Normal', '7rem'))}${field('Weather', sel(['Clear 0', 'Rainy −1'], 'Clear 0', '7rem'))}${field('Foe', sel(['—', 'Quiet −1', 'Silent −2'], 'Silent −2', '7rem'))}${field('Mod', sel(['0', '+1', '−1'], '0', '4rem'))}
        <button type="button" class="ui-button is-primary size-sm">Surprise!</button><button type="button" class="ui-button is-link size-sm">Clear</button></div>
      <div class="ui-well results">
        ${[['Jaque', 'd10 1, Dex +3 = 4', false], ['Rifiyr', 'd10 3, Dex +1, Alertness +1 = 5', false], ['Goroth', 'd10 2 · Danger Sense d20 9 vs 13: senses it', false], ['Hanspeter', 'd10 2 = 2', true]].map(([n, d, x]) => `<div class="res"><span class="nm">${n}</span><span class="meta">${d}</span><span class="verdict${x ? ' bad' : ''}">${x ? 'Surprised' : 'Not surprised'}</span></div>`).join('')}
      </div>
    </section>`;
const initiative = `
  <div class="try"><span class="lab">Try</span><div class="f"><span class="lab">Party edge</span><div class="ui-tabs size-sm" data-try="ally"><button type="button" class="is-active" aria-pressed="true" data-v="blue">Blue (second accent)</button><button type="button" aria-pressed="false" data-v="bronze">Bronze (brass)</button></div></div></div>

  ${surprise}

  <section class="ui-card is-featured">
    <div class="roundbar">
      <div class="rb-main"><span class="round"><span class="lab">Round</span><span class="rn">3</span></span>
      <button type="button" class="ui-button is-primary">⚄ Roll initiative for Enemies</button>
      <label class="sw"><button type="button" class="ui-switch" role="switch" aria-checked="true" aria-label="Lock initiative"></button> Lock initiative</label>
      <button type="button" class="ui-button is-secondary">Reset initiative</button>
      <div class="f"><span class="lab">Extra attacks</span>${tabs(['End of the order', 'At their turn'], 'End of the order', 'Extra attacks')}</div>
      <button type="button" class="ui-button is-primary">Next round ▸</button></div>
      <div class="apart"><button type="button" class="ui-button is-secondary is-danger">↺ Reset encounter</button></div>
    </div>
  </section>

  <section class="order size-sm">
    <div class="sec-head"><h2 class="sec">Initiative order</h2><span class="hint">Lower acts first: roll + speed + bonuses</span></div>
    <div class="ohead"><span>Character</span><span>Speed</span><span>Init</span><span class="c">Act on</span></div>
    <div class="olist">${rows.map(orderRow).join('')}</div>
    <div class="card-foot"><button type="button" class="ui-button is-primary">+ Add Enemy</button></div>
  </section>

  <div class="two">
    <section class="ui-card size-sm">
      <div class="card-head"><h3>Crits &amp; fumbles</h3></div>
      <div class="line"><div class="f"><span class="lab">Weapon</span>${tabs(['Blunt', 'Piercing', 'Slashing', 'Animal'], 'Blunt', 'Weapon type')}</div></div>
      <div class="actions"><button type="button" class="ui-button is-primary size-sm">Crit</button><button type="button" class="ui-button is-secondary size-sm">Fumble</button><button type="button" class="ui-button is-link size-sm">Clear</button></div>
      <div class="ui-well results"><div class="kicker">Critical hit · Blunt · d% 61</div><div class="big-line">Triple (×3) damage</div></div>
    </section>
  </div>
  <p class="foot">An Enemy's attack rolls only when you press Roll to hit; it hits on a d20 of THAC0 − AC or more. Next round clears the rolls and keeps targets and conditions; Reset encounter starts over at round 1.</p>`;

// ── Proficiencies ──
const skills = [['Animal Handling', 'Int', 16, 3], ['Armorer', 'Int + Cleric', 15, 13], ['Bargain', 'Lvl 3', 15, 2], ['Endurance', 'Kit', 14, 6], ['Healing', 'Cleric', 16, 8], ['Religion', 'Kit', 17, 6], ['Weaponsmithing', 'Kit', 15, 18]];
const cell = m => `<td class="m${m >= 15 ? ' crit' : m >= 0 ? ' ok' : m <= -15 ? ' cfail' : ''}">${m > 0 ? '+' : m < 0 ? '−' : ''}${Math.abs(m)}</td>`;
const profs = `
  <section class="open">
    <div class="toolbar">${field('Group check', sel(['— pick a proficiency —', 'Observation', 'Tracking'], 'Observation', '14rem'))}<button type="button" class="ui-button is-primary">⟳ Roll all proficiencies</button><button type="button" class="ui-button is-link">Clear</button></div>
  </section>
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Observation</h3><span class="hint">d20 at or under the target</span></div>
    <table class="t"><thead><tr><th class="l">Character</th><th>Target</th><th>d20</th><th class="l">Result</th></tr></thead><tbody>
      ${[['Atteroak', 3, 5, 'np'], ['Goroth', 2, 14, 'np'], ['Hanspeter', 5, 9, 'np'], ['Jaque', 16, 14], ['Rifiyr', 15, 7]].map(([n, t, d, np]) => `<tr><td class="l nm">${n}${np ? ' <span class="tag">Untrained</span>' : ''}</td><td>${t}</td><td>${d}</td><td class="l ${d <= t ? 'ok' : ''}">${d <= t ? `Succeeds by ${t - d}` : `Fails by ${d - t}`}</td></tr>`).join('')}
    </tbody></table>
  </section>
  <h2 class="sec">Party</h2>
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Atteroak</h3><span class="meta">5th</span><span class="hint">Str 14 · Dex 13 · Con 16 · Int 11 · Wis 18 · Cha 11</span><button type="button" class="ui-button is-bare is-icon size-sm push" aria-label="Re-roll Atteroak's d20s">⟳</button></div>
    <table class="t"><thead><tr><th class="l">Proficiency</th><th>Target</th><th>d20</th><th>Easy +5</th><th>Moderate 0</th><th>Hard −5</th><th>Very hard −10</th><th>Impossible −15</th></tr></thead><tbody>
      ${skills.map(([n, src, t, d]) => `<tr><td class="l nm">${n} <span class="tag">${src}</span></td><td>${t}</td><td>${d}</td>${[5, 0, -5, -10, -15].map(k => cell(t + k - d)).join('')}</tr>`).join('')}
    </tbody></table>
  </section>
  <section class="ui-card size-sm collapsed"><div class="card-head"><button type="button" class="ui-disclosure" aria-expanded="false"><span class="ui-disclosure-chev" aria-hidden="true"></span><h3>Goroth</h3></button><span class="meta">3rd</span></div></section>
  <p class="foot">Roll d20 at or under the target. Cells show the margin (target − roll): green succeeds; +15 or better is a critical success (filled green), −15 or worse a critical failure (red).</p>`;

// ── Saves ──
const saves = `
  <section class="open">
    <div class="toolbar">${field('Group save', sel(['— pick a save —', 'Poison', 'Spell'], 'Poison', '12rem'))}<button type="button" class="ui-button is-primary">⟳ Roll all saves</button><button type="button" class="ui-button is-link">Clear</button></div>
  </section>
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Poison</h3><span class="hint">d20 at or above the target</span></div>
    <table class="t"><thead><tr><th class="l">Character</th><th>Target</th><th>d20</th><th class="l">Result</th></tr></thead><tbody>
      ${[['Atteroak', 6, 10, '+4'], ['Goroth', 13, 1], ['Hanspeter', 10, 1], ['Jaque', 12, 2], ['Rifiyr', 14, 4]].map(([n, t, d, m]) => `<tr><td class="l nm">${n}${m ? ` <span class="tag">${m}</span>` : ''}</td><td>${t}</td><td>${d}</td><td class="l ${d >= t ? 'ok' : ''}">${d >= t ? 'Saves' : 'Fails'}</td></tr>`).join('')}
    </tbody></table>
  </section>
  <h2 class="sec">Party</h2>
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Atteroak</h3><span class="meta">5th</span><span class="hint">Dwarf: +4 vs poison, rod/staff/wand, spell; +8 vs charm, fear, suggestion</span><button type="button" class="ui-button is-bare is-icon size-sm push" aria-label="Re-roll Atteroak's saves">⟳</button></div>
    <table class="t"><thead><tr><th class="l">Save vs</th><th>Base</th><th>Mod</th><th>Target</th><th>d20</th></tr></thead><tbody>
      ${[['Paralysis', 10, '—', 10, 7], ['Poison', 10, '+4', 6, 12], ['Death Magic', 10, '—', 10, 16], ['Rod, Staff, or Wand', 14, '+4', 10, 10], ['Petrification or Polymorph', 13, '—', 13, 19], ['Breath Weapon', 16, '—', 16, 13], ['Spell', 15, '+4', 11, 17]].map(([n, b, m, t, d]) => `<tr><td class="l nm">${n}</td><td>${b}</td><td>${m}</td><td>${t}</td><td class="${d >= t ? 'ok' : ''}">${d}</td></tr>`).join('')}
    </tbody></table>
  </section>
  <p class="foot">Roll d20 at or above the target. Modifiers are applied to the target (a +2 bonus lowers it by 2).</p>`;

// ── Reaction ──
const reaction = `
  <div class="two">
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Reaction</h3><span class="hint">2d10, lower is friendlier</span></div>
    <div class="line"><div class="f"><span class="lab">Party is acting</span>${tabs(['Friendly', 'Indifferent', 'Threatening', 'Hostile'], 'Indifferent', 'Party is acting')}</div>${field('Reputation', sel(['0', '+1', '−1'], '0', '4.5rem'))}</div>
    <div class="line">${field('NPC race', sel(['Human', 'Elf', 'Dwarf'], 'Human', '7rem'))}${field('Occupation', sel(['Commoners', 'Nobles', 'Soldiers & guards'], 'Commoners', '9rem'))}<div class="f"><span class="lab">Culture</span>${tabs(['Own', 'Foreign'], 'Own', 'Culture')}</div></div>
    <div class="actions"><button type="button" class="ui-button is-primary size-sm">⟳ Roll for all</button><button type="button" class="ui-button is-link size-sm">Clear</button></div>
    <div class="kicker">Human commoners, own culture · 2d10 = 6</div>
    <table class="t"><thead><tr><th class="l">Character</th><th>Cha</th><th>Mod</th><th>Result</th><th class="l">Reaction</th></tr></thead><tbody>
      ${[['Atteroak', '—', '—', 6, 'Friendly'], ['Goroth', '−2', '−4', 12, 'Cautious'], ['Hanspeter', '+3', '+1', 2, 'Friendly'], ['Jaque', '+3', '—', 3, 'Friendly'], ['Rifiyr', '—', '—', 6, 'Friendly']].map(([n, c, m, r, x]) => `<tr><td class="l nm">${n}</td><td>${c}</td><td>${m}</td><td>${r}</td><td class="l rx">${x}</td></tr>`).join('')}
      <tr class="sum"><td class="l nm">Party</td><td>+0.8</td><td>−0.6</td><td>5.8</td><td class="l rx">Friendly</td></tr>
    </tbody></table>
  </section>
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Encounter</h3><span class="hint">DMG Table 59</span></div>
    <div class="line">${field('Setting', sel(['Road / Farm', 'Forest', 'City'], 'Road / Farm', '9rem'))}<div class="f"><span class="lab">Time</span>${tabs(['Day', 'Night'], 'Day', 'Time')}</div>${field('Chance', sel(['1 in 6', '2 in 6'], '2 in 6', '6rem'))}
      <label class="sw"><button type="button" class="ui-switch" role="switch" aria-checked="true" aria-label="Creatures"></button> Creatures</label></div>
    <div class="actions"><button type="button" class="ui-button is-primary size-sm">Check for encounter</button><button type="button" class="ui-button is-secondary size-sm">Roll encounter</button><button type="button" class="ui-button is-link size-sm">Clear</button></div>
    <div class="ui-well results"><div class="kicker">Road / Farm · Day · d20 18 · d% 91: no creature</div><div class="big-line">A wandering minstrel or storyteller</div><p class="desc">He trades a rumor for a meal. The rumor may be true, and he is careless about who overhears.</p></div>
  </section>
  </div>`;

// ── Config ──
const config = `
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Give a player a character</h3><span class="hint">A sheet save (.json) into their Backups</span></div>
    <div class="actions">${field('Player', sel(['Choose a player…', 'Alex', 'Sam (DM)'], 'Alex', '12rem'))}<button type="button" class="ui-button is-secondary size-sm">Upload sheet…</button></div>
    <p class="ok-line">Tig is in Alex's Backups.</p>
  </section>
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Character summary</h3>${sel(['Choose a character…', 'Jaque', 'Rifiyr'], 'Jaque', '12rem')}<span class="hint">From their saved sheet</span></div>
    <table class="t"><tbody>
      <tr><td class="l nm">Stats</td><td class="l">Str 13 · Dex 19 · Con 15 · Int 16 · Wis 13 · Cha 15 (reaction +3)</td></tr>
      <tr><td class="l nm">Armor Class</td><td class="l">AC 4 · surprised 8</td></tr>
      <tr><td class="l nm">Saves</td><td class="l">PPD 12 · RSW 12 · Pet/Poly 11 · Breath 15 · Spell 13</td></tr>
    </tbody></table>
  </section>
  <section class="ui-card size-sm">
    <div class="card-head"><h3>Start over</h3><span class="hint">Clears this browser's DM Helper: the encounter, rolls and settings. Characters and the campaign aren't touched.</span></div>
    <div class="actions"><button type="button" class="ui-button is-secondary is-danger size-sm">↺ Reset everything</button></div>
  </section>`;

const notes = `
  <details class="notes ui-card size-sm">
    <summary><b>Design notes</b>: what stays, goes and changes</summary>
    <div class="cols">
      <div><h4>Changes</h4><ul>
        <li>Tabs: Initiative first (the default), Reaction moves after Saves.</li>
        <li>Round controls are an open section; the order is the featured card.</li>
        <li>Act on is the first column, in brass: the order reads top-down.</li>
        <li>Lock initiative is a switch; Extra attacks, the party's stance, Culture, Time and the crit's weapon are tab buttons; Creatures is a switch.</li>
        <li>The order is a section; each combatant a card. An Enemy's card has a red left edge (is-opponent); its attacks fold away, and open each is a tinted item holding its controls and the roll's well.</li>
        <li>A player's action from their sheet is a well under their row.</li>
        <li>Surprise and Crits &amp; fumbles are cards beside each other.</li>
        <li>Proficiencies and Saves: the group check first, then a card per character (folding).</li>
      </ul></div>
      <div><h4>Goes</h4><ul>
        <li>Reset in the header: it moves to Config, as Start over.</li>
        <li>The hidden leftovers of the player tabs.</li>
      </ul><h4>New</h4><ul>
        <li>Untrained shown as a tag in group checks (was "np").</li>
      </ul></div>
    </div>
  </details>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DM Helper redesign</title>
<style>
  body { margin: 0; background: var(--color-bg); color: var(--color-text); font: 400 15px/1.45 var(--font-sans); }
  .page { max-width: 68rem; margin: 0 auto; padding: 18px 16px 64px; display: grid; gap: 16px; }
  .top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; padding-bottom: 12px; border-bottom: 2px solid var(--color-accent); }
  .top h1 { font: 700 28px/1.2 var(--font-serif); margin: 0; }
  .top .camp { color: var(--color-text-muted); font-size: 14px; }
  .top .who { margin-left: auto; display: flex; align-items: center; gap: 8px; color: var(--color-text-muted); font-size: 14px; }
  .panel[hidden] { display: none; }
  .panel { display: grid; gap: 16px; }
  .lab { display: block; font: 600 11px/1.2 var(--font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px; }
  label.f, div.f { display: inline-flex; flex-direction: column; }
  .line, .actions, .toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 14px; }
  .actions { align-items: center; }
  .card-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; margin-bottom: 12px; }
  .card-head h3 { margin: 0; font: 600 18px/1.25 var(--font-serif); }
  .card-head .ui-disclosure h3 { display: inline; }
  .card-head .push { margin-left: auto; align-self: center; }
  .hint, .meta { color: var(--color-text-muted); font-size: 13px; }
  .ui-card { display: grid; gap: 12px; align-content: start; }
  .ui-card > .card-head { margin-bottom: 0; }
  .ui-card.collapsed { padding-block: 12px; }
  h2.sec { margin: 6px 0 -4px; font: 600 14px/1.3 var(--font-serif); letter-spacing: .12em; text-transform: uppercase; color: var(--color-accent-text); }
  .foot { margin: 0; color: var(--color-text-muted); font-size: 13px; }
  .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr)); gap: 16px; align-items: start; }
  .tag { font: 600 11px/1 var(--font-sans); padding: 3px 7px; border-radius: 999px; background: var(--color-sunken); color: var(--color-text-muted); box-shadow: inset 0 0 0 1px var(--color-divider); white-space: nowrap; }
  .tag.now { background: var(--color-accent2); color: var(--color-on-accent2); box-shadow: none; }
  .kicker { font: 600 11px/1.3 var(--font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-muted); }
  .big-line { font: 600 18px/1.3 var(--font-serif); color: var(--color-accent-text); }
  .desc { margin: 4px 0 0; }
  .results { padding: 10px 14px; display: grid; gap: 6px; }
  .res { display: grid; grid-template-columns: 7rem 1fr auto; gap: 10px; align-items: baseline; }
  .res .nm { font: 600 15px/1.2 var(--font-serif); }
  .verdict { color: var(--color-text-muted); font-size: 13px; }
  .verdict.bad { color: var(--color-accent-text); font-weight: 700; }
  .ok-line { margin: 0; color: var(--color-success-text); font-size: 14px; }
  .sw { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }

  /* The round */
  .roundbar { display: flex; align-items: stretch; gap: 16px; }
  .rb-main { flex: 1; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; }
  .round { display: inline-flex; flex-direction: column; margin-right: 6px; }
  .roundbar .sw { height: var(--field-h); }
  .roundbar .apart { display: flex; align-items: flex-end; padding-left: 16px; border-left: 1px solid var(--color-divider); }
  @media (max-width: 640px) { .roundbar { flex-direction: column; } .roundbar .apart { padding: 12px 0 0; border-left: 0; border-top: 1px solid var(--color-divider); } }
  .round .rn { font: 700 32px/1 var(--font-serif); color: var(--color-accent-text); font-variant-numeric: lining-nums; }

  /* The order */
  .ohead, .orow { display: grid; grid-template-columns: minmax(12rem, 1fr) 5rem 5rem 4rem; column-gap: 12px; align-items: center; }
  .order { display: grid; gap: 8px; }
  .sec-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
  .sec-head h2.sec { margin: 0; }
  .olist { display: grid; gap: 8px; }
  .ohead { font: 600 11px/1.2 var(--font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-muted); padding: 0 13px; }
  .orow { row-gap: 10px; }
  .orow .lab { display: none; }
  .orow .act { font: 700 22px/1 var(--font-serif); color: var(--color-accent-text); font-variant-numeric: lining-nums; text-align: center; }
  .orow .who { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
  .orow .nm { font: 600 18px/1.2 var(--font-serif); }
  .orow .nm-in { font: 600 18px/1.2 var(--font-serif); width: 9rem; }
  .orow .mini { display: inline-flex; gap: 8px; align-items: center; }
  .orow .mini .lab { display: inline; margin: 0 4px 0 0; }
  .orow .mini label.f { flex-direction: row; align-items: center; }
  .orow .detail { grid-column: 1 / -1; }
  .ohead .c { text-align: center; }
  .orow .detail.ui-well { padding: 8px 12px; font-size: 14px; }
  .orow .detail .lab { display: inline; margin-right: 6px; }
  .orow .detail.is-none { color: var(--color-text-muted); }
  .atks { display: grid; gap: 10px; margin-top: 10px; justify-items: start; }
  .atks[hidden] { display: none; }
  .atks > .ui-item { justify-self: stretch; }
  .atk { padding: 10px 12px; display: grid; gap: 10px; }
  .atk .lab { display: block; }
  .atk-head { display: flex; align-items: center; gap: 10px; }
  .atk-head b { font: 600 15px/1.2 var(--font-serif); margin-right: auto; }
  .readout .num { display: block; font: 700 22px/1 var(--font-serif); color: var(--color-accent-text); height: var(--field-h); line-height: var(--field-h); }
  .roll svg { width: 1.1em; height: 1.1em; }
  .hit { display: flex; align-items: center; gap: 22px; padding: 10px 14px; }
  .hit .die { position: relative; width: 46px; height: 46px; display: grid; place-items: center; color: var(--color-accent2-text); }
  .hit .die svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hit .die b { position: relative; font: 700 17px/1 var(--font-serif); color: var(--color-text); }
  .hit .big { font: 700 26px/1 var(--font-serif); color: var(--color-accent-text); }
  .hit .big.miss { color: var(--color-text-muted); }
  .card-foot { padding-top: 6px; }
  .try { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 18px; padding: 8px 12px; border: 1px dashed var(--color-border); border-radius: var(--radius-inner); }
  .try > .lab { align-self: center; margin: 0; }
  body { --ally-edge: var(--color-accent2); }
  body[data-ally="bronze"] { --ally-edge: var(--color-accent); }
  div.orow.ui-card.is-ally:not(#\\#) { border-left: 3px solid var(--ally-edge); }

  /* Tables */
  table.t { border-collapse: collapse; width: 100%; font-size: 14px; }
  .t th { font: 600 11px/1.2 var(--font-sans); letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-muted); text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--color-divider); white-space: nowrap; }
  .t td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--color-divider); font-variant-numeric: tabular-nums; }
  .t tr:last-child td { border-bottom: 0; }
  .t .l { text-align: left; }
  .t .nm { font: 600 15px/1.2 var(--font-serif); }
  .t .ok { color: var(--color-success-text); font-weight: 600; }
  .t td.m.crit { background: var(--color-highlight); color: var(--color-on-highlight); font-weight: 700; border-radius: 4px; }
  .t td.m.cfail { background: color-mix(in oklab, var(--color-danger) 16%, var(--color-surface)); color: var(--color-danger-text); font-weight: 700; border-radius: 4px; }
  .t .rx { color: var(--color-accent-text); font-weight: 600; }
  .t tr.sum td { border-top: 1px solid var(--color-text-muted); font-weight: 700; }

  .notes summary { cursor: pointer; }
  .notes .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 0 24px; font-size: 14px; }
  .notes h4 { margin: 10px 0 4px; font: 600 14px/1.3 var(--font-serif); }
  .notes ul { margin: 0; padding-left: 1.1em; }
  @media (max-width: 640px) {
    .ohead { display: none; }
    .orow { grid-template-columns: 1fr 1fr 3rem; }
    .orow .who { grid-column: 1 / 3; grid-row: 1; }
    .orow .act { grid-column: 3; grid-row: 1; }
    .orow .lab { display: block; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="top"><h1>DM Helper</h1><span class="camp">The Gnoll Hills · Round 3</span>
    <span class="who">Sam <a class="ui-button is-secondary size-sm" href="../site/index.html">Your characters</a><span id="themeSlot"></span><button type="button" class="ui-button is-secondary size-sm">Sign out</button></span></header>
  ${notes}
  <nav class="ui-pagetabs" id="ptabs">${['Initiative', 'Proficiencies', 'Saves', 'Reaction', 'Config'].map((t, i) => `<button type="button" data-p="${t}" class="${i ? '' : 'active'}">${t}</button>`).join('')}</nav>
  <div class="panel" data-panel="Initiative">${initiative}</div>
  <div class="panel" data-panel="Proficiencies" hidden>${profs}</div>
  <div class="panel" data-panel="Saves" hidden>${saves}</div>
  <div class="panel" data-panel="Reaction" hidden>${reaction}</div>
  <div class="panel" data-panel="Config" hidden>${config}</div>
</div>
<script>
  document.getElementById('ptabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#ptabs button').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach(p => p.hidden = p.dataset.panel !== b.dataset.p); });
  document.addEventListener('click', e => {
    const d = e.target.closest('.ui-disclosure'); if (d) { const open = d.getAttribute('aria-expanded') !== 'true'; d.setAttribute('aria-expanded', open); const body = d.closest('.detail')?.querySelector('.atks'); if (body) body.hidden = !open; }
    const s = e.target.closest('.ui-switch'); if (s) s.setAttribute('aria-checked', s.getAttribute('aria-checked') !== 'true');
    const t = e.target.closest('.ui-tabs > button'); if (t) { t.parentNode.querySelectorAll('button').forEach(x => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-pressed', x === t); }); if (t.parentNode.dataset.try) document.body.dataset[t.parentNode.dataset.try] = t.dataset.v; }
  });
  (function(){ const b=document.createElement('button'); b.className='ui-button is-secondary is-icon size-sm'; b.type='button'; b.setAttribute('aria-label','Light or dark');
    const cur=()=>document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    const show=()=>{ b.textContent = cur()==='dark' ? '☀' : '☾'; };
    b.onclick=()=>{ document.documentElement.dataset.theme = cur()==='dark' ? 'light' : 'dark'; show(); }; show();
    document.getElementById('themeSlot').appendChild(b); })();
</script>
</body>
</html>
`;
writeFileSync('prototypes/dm-redesign.html', withHead(page));
console.log('ok');
