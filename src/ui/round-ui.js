// ── ROUND UI ────────────────────────────────────────────────────
// The pieces of a combat round's screen that the character sheet and the DM
// Helper share, with their styles: a select whose list holds checkboxes (with a
// note per option), a read-only value under a label, and the roll result panel
// (the d20 on a die, the AC it hits, the damage and each die). Styles go into
// the page once (ensureStyles), under --ui-* tokens: the sheet's palette.

import { lineSay } from '../rules/round.js';

const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const STYLES = "/* Shared tokens: the character sheet's palette and type, under names of their\n   own (each tool keeps its own token names for the rest of its page) */\n:root { --ui-ink: #1a1714; --ui-muted: #5a534e; --ui-faint: #9a9390; --ui-rule: #d8d0c8; --ui-accent: #8b2e12; --ui-accent-dark: #6e2410;\n  --ui-surface: #ffffff; --ui-page: #f5f5f5; --ui-gold: #b8873a; --ui-radius: 4px; --ui-ctl-h: 2.1rem;\n  --ui-display: 'Cinzel', Georgia, serif; --ui-body: 'Crimson Pro', Georgia, serif; }\n/* A label over a control, the control, a button */\n.ui-field { display: inline-flex; flex-direction: column; gap: 0.15rem; }\n.ui-label { font-family: var(--ui-display); font-size: 0.65rem; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ui-muted); }\n.ui-control { box-sizing: border-box; height: var(--ui-ctl-h); padding: 0 0.5rem; font: 0.95rem var(--ui-body); color: var(--ui-ink);\n  background: var(--ui-page); border: 1px solid var(--ui-rule); border-radius: var(--ui-radius); cursor: pointer; }\n.ui-control:focus { outline: none; border-color: var(--ui-accent); }\n.ui-btn { box-sizing: border-box; height: var(--ui-ctl-h); display: inline-flex; align-items: center; gap: 0.4rem; padding: 0 0.8rem;\n  font-family: var(--ui-display); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;\n  background: var(--ui-accent); color: var(--ui-surface); border: 1px solid var(--ui-accent); border-radius: var(--ui-radius); cursor: pointer; }\n.ui-btn:hover, .ui-btn:focus-visible { background: var(--ui-accent-dark); }\n/* A select with checkboxes in its list */\n.round-multi { position: relative; }\n.round-multi .round-multi-btn { width: auto; min-width: 9.5rem; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; text-align: left; padding-right: 1.9rem; position: relative; white-space: nowrap; }\n.round-multi-btn::after { content: ''; position: absolute; right: 0.65rem; top: 50%; width: 0.4rem; height: 0.4rem; margin-top: -0.3rem;\n  border-right: 1.5px solid var(--ui-muted); border-bottom: 1.5px solid var(--ui-muted); transform: rotate(45deg); }\n.round-multi.is-open .round-multi-btn { border-color: var(--ui-accent); }\n.round-multi.is-open .round-multi-btn::after { transform: rotate(-135deg); margin-top: -0.1rem; }\n.round-multi-list { position: absolute; top: 100%; left: 0; z-index: 30; margin-top: 0.25rem; min-width: 100%; width: max-content; max-width: 18rem;\n  background: var(--ui-surface); border: 1px solid var(--ui-rule); border-radius: var(--ui-radius); box-shadow: 0 6px 18px rgba(26,23,20,0.12); padding: 0.3rem; }\n.round-multi-opt { display: flex; align-items: flex-start; gap: 0.55rem; padding: 0.45rem 0.55rem; border-radius: var(--ui-radius); cursor: pointer; font-size: 0.95rem; }\n.round-multi-opt:hover, .round-multi-opt:focus-within { background: var(--ui-page); }\n.round-multi-opt input { accent-color: var(--ui-accent); margin-top: 0.2rem; }\n.round-multi-opt small { display: block; font-size: 0.8rem; color: var(--ui-muted); }\n/* A read-only value in a line, the height of the controls beside it */\n.round-read-value { display: inline-flex; align-items: center; height: var(--ui-ctl-h); font-size: 0.95rem; color: var(--ui-ink); white-space: nowrap; }\n.round-read.is-key .round-read-value { font-family: var(--ui-display); font-weight: 700; font-size: 1.05rem; color: var(--ui-accent); }\n/* A rolled line: one strip, same type throughout, pieces split by dividers */\n.round-summary { display: flex; flex-wrap: wrap; align-items: center; min-height: var(--ui-ctl-h); font-size: 0.95rem; color: var(--ui-ink); }\n.round-summary > span { padding: 0 0.75rem; border-left: 1px solid var(--ui-rule); line-height: 1.3; }\n.round-summary > span:first-child { padding-left: 0; border-left: 0; }\n.round-summary > .is-key { font-family: var(--ui-display); font-weight: 700; color: var(--ui-accent); }\n/* The hit roll: the round's big moment */\n.roll-hit-btn { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.4rem 0.85rem 0.4rem 0.6rem; box-shadow: 0 2px 0 #5a1d0b; }\n.roll-hit-btn svg { width: 1.15rem; height: 1.15rem; }\n.roll-hit-btn:active { transform: translateY(1px); box-shadow: 0 1px 0 #5a1d0b; }\n.hit-rolls { flex-basis: 100%; display: grid; gap: 0.45rem; justify-items: start; }\n.hit-rolls > .hit-roll { width: 100%; box-sizing: border-box; }\n.hit-who { font-family: var(--ui-display); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ui-muted); min-width: 4.5rem; }\n.hit-roll { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.5rem; padding: 0.55rem 0.9rem; border-radius: var(--ui-radius);\n  background: linear-gradient(100deg, #fbf3ee, var(--ui-surface) 70%); border: 1px solid #e9cfc2; }\n.hit-die { position: relative; width: 3.4rem; height: 3.4rem; flex: none; color: var(--ui-accent); }\n.hit-die svg { position: absolute; inset: 0; width: 100%; height: 100%; }\n.hit-die-num { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding-top: 0.15rem;\n  font-family: var(--ui-display); font-weight: 700; font-size: 1.35rem; color: var(--ui-ink); }\n.hit-stat { display: flex; flex-direction: column; line-height: 1; }\n.hit-stat-label { font-family: var(--ui-display); font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ui-muted); margin-bottom: 0.25rem; }\n.hit-stat-value { font-family: var(--ui-display); font-weight: 700; font-size: 2rem; color: var(--ui-accent); }\n.hit-stat-sub { font-size: 0.8rem; color: var(--ui-muted); margin-top: 0.15rem; }\n.hit-stat.is-dmg .hit-stat-value { color: var(--ui-ink); font-size: 1.6rem; }\n.hit-stat.is-miss .hit-stat-value { color: var(--ui-muted); }\n.hit-stat.is-updated .hit-stat-value { border-radius: var(--ui-radius); }\n@media (prefers-reduced-motion: no-preference) {\n  .hit-stat.is-updated .hit-stat-value { animation: hit-update 1.2s ease-out; }\n}\n@keyframes hit-update { 0% { background: rgba(184,135,58,0.45); } 100% { background: transparent; } }\n.hit-nat { font-family: var(--ui-display); font-weight: 700; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 0.25rem 0.55rem; border-radius: 999px; }\n.hit-roll.is-crit { background: linear-gradient(100deg, #fbf1dc, var(--ui-surface) 75%); border-color: var(--ui-gold); box-shadow: 0 0 0 2px rgba(184,135,58,0.25); }\n.hit-roll.is-crit .hit-die { color: var(--ui-gold); }\n.hit-roll.is-crit .hit-nat { background: var(--ui-gold); color: var(--ui-surface); }\n.hit-roll.is-fumble { background: linear-gradient(100deg, #eee9e6, var(--ui-surface) 75%); border-color: #9a9390; }\n.hit-roll.is-fumble .hit-die, .hit-roll.is-fumble .hit-stat-value { color: var(--ui-muted); }\n.hit-roll.is-fumble .hit-stat.is-miss .hit-stat-value { color: #3b3431; }\n.hit-roll.is-fumble .hit-nat { background: #3b3431; color: var(--ui-surface); }\n@media (prefers-reduced-motion: no-preference) {\n  .hit-roll.is-fresh .hit-die svg { animation: hit-tumble 0.55s cubic-bezier(.2,.8,.3,1); }\n  .hit-roll.is-fresh .hit-die-num, .hit-roll.is-fresh .hit-stat-value { animation: hit-pop 0.45s 0.3s cubic-bezier(.2,1.4,.4,1) both; }\n  .hit-roll.is-fresh.is-crit { animation: hit-glow 1.2s 0.5s ease-out; }\n}\n@keyframes hit-tumble { from { transform: rotate(-200deg) scale(0.6); } to { transform: none; } }\n@keyframes hit-pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }\n@keyframes hit-glow { 0% { box-shadow: 0 0 0 2px rgba(184,135,58,0.25); } 30% { box-shadow: 0 0 0 8px rgba(184,135,58,0.35); } 100% { box-shadow: 0 0 0 2px rgba(184,135,58,0.25); } }";
export function ensureStyles(doc = document) {
  if (doc.getElementById('round-ui-styles')) return;
  const st = doc.createElement('style'); st.id = 'round-ui-styles'; st.textContent = STYLES;
  doc.head.appendChild(st);
}

// ── A select with checkboxes ──
// Situational on/off choices: a select-like button whose list holds
// checkboxes. It stays open while you tick (the page redraws, so which one is
// open is remembered) and closes on Escape, on a second click or on a click
// elsewhere.
let openMulti = null;
let listening = false;
function closeMulti(refocus) {
  const btn = openMulti && document.getElementById(openMulti.id);
  openMulti = null;
  if (!btn) return;
  btn.setAttribute('aria-expanded', 'false'); btn.closest('.round-multi')?.classList.remove('is-open');
  document.getElementById(`${btn.id}-list`).hidden = true;
  if (refocus) btn.focus();
}
function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('click', e => {
    if (!openMulti || e.target.closest(`#${openMulti.id}, #${openMulti.id}-list`)) return;
    closeMulti(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openMulti) closeMulti(true); });
}
export function multi(id, label, options, onToggle) {
  listen();
  const wrap = document.createElement('div'); wrap.className = 'round-pick ui-field round-multi';
  const t = document.createElement('span'); t.className = 'scenario-field-label ui-label'; t.id = `${id}-label`; t.textContent = label;
  const on = options.filter(o => o.on);
  const btn = document.createElement('button'); btn.type = 'button'; btn.id = id; btn.className = 'scenario-select ui-control round-multi-btn';
  // What's ticked: the names while they fit, else the first and "+ N more";
  // the tooltip and the screen-reader name always have the whole list
  const all = on.map(o => o.label).join(', ');
  btn.textContent = !on.length ? 'None' : all.length <= 24 ? all : `${on[0].label} + ${on.length - 1} more`;
  btn.title = on.length ? all : '';
  btn.setAttribute('aria-label', `${label}: ${on.length ? all : 'none'}`);
  btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-controls', `${id}-list`);
  const list = document.createElement('div'); list.className = 'round-multi-list'; list.id = `${id}-list`;
  list.setAttribute('role', 'group'); list.setAttribute('aria-labelledby', `${id}-label`);
  options.forEach(o => {
    const row = document.createElement('label'); row.className = 'round-multi-opt';
    const box = document.createElement('input'); box.type = 'checkbox'; box.id = `${id}-${o.key}`; box.checked = !!o.on;
    box.addEventListener('change', () => { openMulti = { id, focus: box.id }; onToggle(o.key, box.checked); });
    const text = document.createElement('span'); text.innerHTML = `${esc(o.label)}${o.note ? `<small>${esc(o.note)}</small>` : ''}`;
    row.append(box, text); list.appendChild(row);
  });
  const setOpen = open => {
    list.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); wrap.classList.toggle('is-open', open);
    const kept = openMulti && openMulti.id === id ? openMulti.focus : null;
    openMulti = open ? { id, focus: kept } : (openMulti && openMulti.id === id ? null : openMulti);
  };
  btn.addEventListener('click', () => { setOpen(list.hidden); if (!list.hidden) list.querySelector('input')?.focus(); });
  wrap.addEventListener('keydown', e => { if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); setOpen(false); btn.focus(); } });
  // Which box has focus, so a redraw (this page or a save echoed back) puts it back
  list.addEventListener('focusin', e => { if (openMulti && openMulti.id === id) openMulti.focus = e.target.id; });
  wrap.append(t, btn, list);
  // Open again after a redraw, focus back where it was (unless it has moved on)
  const reopen = openMulti && openMulti.id === id;
  const focusId = reopen && openMulti.focus;
  setOpen(reopen);
  if (focusId) setTimeout(() => {
    const a = document.activeElement;
    if (!a || a === document.body || !a.isConnected) document.getElementById(focusId)?.focus();
  }, 0);
  return wrap;
}

// ── A read-only value under a small label, lined up with the controls beside it ──
export function readField(label, value, cls = '') {
  const f = document.createElement('div'); f.className = `round-pick ui-field round-read ${cls}`.trim();
  const l = document.createElement('span'); l.className = 'scenario-field-label ui-label'; l.textContent = label;
  const v = document.createElement('span'); v.className = 'round-read-value'; v.textContent = value;
  f.append(l, v); return f;
}

// ── The roll result panel ──
// The d20 on a die, the AC it hits, the damage and each die; one panel per
// target (one for an area spell). The rolled dice stay; the numbers follow the
// sheet, and the panel flashes what changed since it was last shown.
// judge(r, i), on the DM's page, which knows each target's AC: { hit, need, ac,
// crit } for that target, and the panel says Hit or Miss.
export const D20_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M24 3 43 14v20L24 45 5 34V14Z" fill="currentColor" fill-opacity="0.08"/><path d="M24 3 14 19h20Z M14 19 5 14 M34 19l9-5 M14 19l10 18 10-18 M24 37v8 M14 19 5 34l19 3 19-3-9-15" stroke-opacity="0.55" stroke-width="1.4"/></svg>';
const shownRolls = {};
export function hitRoll(line, fresh, onReroll, judge) {
  const roll = line.roll;
  const wrap = document.createElement('div'); wrap.className = 'hit-rolls';
  wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-label', lineSay(line));
  const stat = (cls, label, value, sub) => `<span class="hit-stat ${cls}"><span class="hit-stat-label">${label}</span><span class="hit-stat-value">${esc(value)}</span>${sub ? `<span class="hit-stat-sub">${sub}</span>` : ''}</span>`;
  const acT = n => (n < 0 ? `−${-n}` : String(n));
  const who = t => (t ? `${t.label}${t.size === 'l' && !/\(L\)/.test(t.label) ? ' (L)' : ''}` : 'No target');
  const many = roll.each.length > 1;
  const panel = (r, i, whoText) => {
    const nat = r.d20 === 20 ? 'crit' : r.d20 === 1 ? 'fumble' : '';
    const key = `${line.key}:${i}`, was = shownRolls[key], now = { ac: r.hitsAC, dmg: r.dmg };
    shownRolls[key] = now;
    const moved = k => !fresh && was && was[k] !== now[k];
    const el = document.createElement('div');
    el.className = 'hit-roll' + (nat ? ` is-${nat}` : '') + (fresh ? ' is-fresh' : '');
    const dmg = r.dmgStale ? '—' : `${r.dmg ?? '—'}`;
    // Each die as rolled, then the bonus: "1d8+2: 5 + 2", "2d4: 3 + 4"
    const facesText = (faces, flat) => !faces || !faces.length ? ''
      : faces.map((v, n) => (n ? (v < 0 ? `− ${-v}` : `+ ${v}`) : String(v))).join(' ') + (flat ? ` ${flat > 0 ? '+' : '−'} ${Math.abs(flat)}` : '');
    const dmgDice = facesText(r.dmgFaces, r.dmgFlat), spellDice = facesText(r.spellFaces, r.spellFlat);
    const dmgSub = r.dmgStale ? 'the damage dice changed'
      : esc([r.dmgExpr ? `${r.dmgExpr}${dmgDice ? `: ${dmgDice}` : ''}` : '', r.spell != null ? `+ spell ${r.spell}${spellDice ? ` (${spellDice})` : ''}` : ''].filter(Boolean).join(' '));
    const dmgCls = 'is-dmg' + (moved('dmg') ? ' is-updated' : '');
    const tag = whoText ? `<span class="hit-who">${esc(whoText)}</span>` : '';
    if (r.d20 == null) {
      const saves = roll.heal ? '' : roll.kind === 'area' ? 'each target saves' : 'no save';
      el.innerHTML = tag + stat(dmgCls, roll.heal ? 'Healing' : 'Damage', dmg, [dmgSub, saves].filter(Boolean).join(' · '));
    } else if (r.d20 === 1) {
      // A natural 1 always misses: no AC, no damage; the DM has the Bad Misses table
      el.innerHTML = tag + `<span class="hit-die">${D20_SVG}<span class="hit-die-num">1</span></span>`
        + stat('is-miss', 'Result', 'Miss', 'no damage')
        + '<span class="hit-nat">Natural 1 · Critical Miss</span>';
    } else if (judge && judge(r, i)) {
      // The DM's page: Hit or Miss against this target's AC
      const j = judge(r, i);
      el.innerHTML = tag + `<span class="hit-die">${D20_SVG}<span class="hit-die-num">${r.d20}</span></span>`
        + stat(`is-${j.hit ? 'hit' : 'miss'}`, 'Result', j.hit ? 'Hit' : 'Miss', `AC ${acT(j.ac)} · needs ${j.need}`)
        + stat(dmgCls, 'Damage', j.hit ? dmg : '—', j.hit ? dmgSub : 'no damage')
        + (nat === 'crit' ? `<span class="hit-nat">Natural 20${j.crit ? ' · Critical hit' : ''}</span>` : '');
    } else {
      el.innerHTML = tag + `<span class="hit-die">${D20_SVG}<span class="hit-die-num">${r.d20}</span></span>`
        + stat(moved('ac') ? 'is-updated' : '', 'Hits AC', acT(r.hitsAC), 'or worse')
        + stat(dmgCls, 'Damage', dmg, dmgSub + (r.dmgStale ? '' : nat === 'crit' ? ' · critical if it hits' : r.d20 !== 1 ? ' · if it hits' : ''))
        + (nat === 'crit' ? '<span class="hit-nat">Natural 20 · Critical?</span>' : nat === 'fumble' ? '<span class="hit-nat">Natural 1</span>' : '');
    }
    return el;
  };
  if (roll.kind === 'area') {
    // An area spell: one damage roll for everyone in it
    wrap.appendChild(panel(roll.each[0], 0, many ? `vs ${roll.each.map(e => who(e.target)).join(', ')}` : ''));
  } else {
    roll.each.forEach((r, i) => wrap.appendChild(panel(r, i, many ? `vs ${who(r.target)}` : '')));
  }
  if (roll.dmgStale && onReroll) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'round-btn ui-btn'; b.textContent = 'Roll damage';
    b.addEventListener('click', onReroll);
    wrap.appendChild(b);
  }
  return wrap;
}
