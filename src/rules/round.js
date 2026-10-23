// ── ONE ROUND OF COMBAT ─────────────────────────────────────────
// A character's round as the sheet's Combat section declares it and the DM's
// initiative page shows it. Both work from the same record (the "round
// record"), so they always agree; it's also what the sync sends.
//
//   {
//     character: 'Rifiyr', round: 3,
//     init: { roll: 7, adj: -2 },          // the d10, rolled once a round; adj: anything else that moves it (Quickness rolled at the table)
//     you: { moveFirst, moveMult: '1', setVsCharge },
//     queue: [{ qid: 'q1', scenarioId: 'sc-1', extra: false }, ...],   // the attacks added this round, in order
//     lines: { q1: {...}, q2: {...} },     // one attack line for each
//   }
//
// Each Add to round adds one attack (a Combat scenario), as often as the
// player likes: a 2/1 bow is added twice. The first one sets when the
// character acts. "extra": the player marks it as an extra attack, which the
// DM's page places by its extra-attack setting.
//
// Each attack line: { same, target: { id, label, size }, flanking, ground,
// charging, other, roll }. A target is a foe as players know it: the DM's
// fixed ID for it and its size, never its AC or the DM's name for it. "same" (the default on every line after the
// first) follows the line above, target and conditions included.
// The DM decides where extra attacks go in the order; the record only says
// which attacks there are.

import { scenarioType, scenarioSpell, scenarioWeapon, spellArrow, castSpeed, scenarioBreakdown, scenarioDamage, modNum } from './scenarios.js';

// Situational modifiers (the DM Helper's table rules)
export const ROUND_MODS = {
  flankingToHit: 2, chargingToHit: 2, chargingAC: 1,
  groundToHit: 1, groundInit: 1, moveFirstInit: 3, setVsChargeInit: 2,
};
export const MOVE_MULTS = ['1', '1.5', '2', '3', '4'];
const blankLine = () => ({ same: true, target: null, flanking: false, ground: '', charging: false, other: 0, roll: null });

export const newRound = (character, round = 1) => ({
  character, round, init: { roll: null, adj: 0 },
  you: { moveFirst: false, moveMult: '1', setVsCharge: false }, queue: [], lines: {},
});
// The queue (a record from before the queue had one attack, `scenarioId`)
export const roundQueue = rec => (Array.isArray(rec.queue) ? rec.queue : rec.scenarioId ? [{ qid: 'q1', scenarioId: rec.scenarioId, extra: !!rec.extra }] : []);
// Add to round: one more attack
export function queueAttack(rec, scenarioId) {
  const queue = roundQueue(rec);
  const n = queue.reduce((m, q) => Math.max(m, parseInt(String(q.qid).slice(1), 10) || 0), 0) + 1;
  return { ...rec, queue: [...queue, { qid: `q${n}`, scenarioId, extra: false }] };
}
export function unqueueAttack(rec, qid) {
  const lines = { ...(rec.lines || {}) };
  // The next attack, if it was "same as above", keeps this one's target and conditions
  const queue = roundQueue(rec), i = queue.findIndex(q => q.qid === qid), next = queue[i + 1];
  const gone = lines[qid];
  if (gone && next && (!lines[next.qid] || lines[next.qid].same !== false)) lines[next.qid] = { ...gone, same: i > 0 && !!gone.same, roll: (lines[next.qid] || {}).roll || null };
  delete lines[qid];
  return { ...rec, queue: roundQueue(rec).filter(q => q.qid !== qid), lines };
}

// The attack's speed in the order: the weapon's, a spell's casting time, or a
// Spellarrow's bow + casting time
export function attackSpeed(ctx, sc) {
  if (!sc) return 0;
  const type = scenarioType(sc);
  if (type === 'spellarrow') return (spellArrow(ctx, sc) || {}).speed || 0;
  if (type === 'spell') { const sp = scenarioSpell(ctx, sc); return (sp && castSpeed(sp.castTimeNow)) ?? 1; }
  const w = scenarioWeapon(ctx, sc);
  return w ? parseInt(w.speed, 10) || 0 : 0;
}

// This round's attack lines, one for each attack added, with "same as
// above" worked out. Only the first is left when you move first.
export function roundLines(ctx, rec, scenarios) {
  const keys = [];
  roundQueue(rec).forEach(q => {
    const sc = (scenarios || []).find(s => s.id === q.scenarioId);
    if (sc) keys.push({ key: q.qid, qid: q.qid, label: ORD[keys.length] || `#${keys.length + 1}`, sc, extra: !!q.extra });
  });
  const allowed = rec.you && rec.you.moveFirst ? keys.slice(0, 1) : keys;
  let prev = null;
  return allowed.map((k, i) => {
    const own = { ...blankLine(), ...(rec.lines || {})[k.key] };
    if (i === 0) own.same = false;
    const set = own.same && prev ? { ...prev.set } : { target: own.target, flanking: !!own.flanking, ground: own.ground || '', charging: !!own.charging, other: modNum(own.other) };
    const line = { key: k.key, qid: k.qid, label: k.label, sc: k.sc, extra: k.extra, same: !!own.same && i > 0, set, roll: own.roll ? scoreRoll(ctx, { sc: k.sc, set }, own.roll) : null };
    prev = line;
    return line;
  });
}
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

// To-hit modifier for one line's conditions
export function lineToHit(set) {
  let n = 0;
  if (set.flanking) n += ROUND_MODS.flankingToHit;
  if (set.ground === 'high') n += ROUND_MODS.groundToHit;
  else if (set.ground === 'low') n -= ROUND_MODS.groundToHit;
  if (set.charging) n += ROUND_MODS.chargingToHit;
  return n + modNum(set.other);
}
// Any line charging makes your AC worse this round
export const roundACPenalty = (lines) => (lines.some(l => l.set.charging) ? ROUND_MODS.chargingAC : 0);

// When the character acts: initiative roll + the attack's speed + this
// round's adjustments (the player's own adjustment, Move 1st +3, set vs
// charge −2, higher ground −1 from the first attack's target). Lowest goes first.
export function actOn(ctx, rec, scenarios, who = {}) {
  if (!rec.init || rec.init.roll == null) return null;
  const sc = roundQueue(rec).map(q => (scenarios || []).find(s => s.id === q.scenarioId)).find(Boolean);
  if (!sc) return null;   // no action yet: the roll alone doesn't say when
  const lines = roundLines(ctx, rec, scenarios);
  let n = rec.init.roll + attackSpeed(ctx, sc) + (who.initBonus || 0);
  if (rec.you.moveFirst) n += ROUND_MODS.moveFirstInit;
  if (rec.you.setVsCharge) n -= ROUND_MODS.setVsChargeInit;
  if (lines[0] && lines[0].set.ground === 'high') n -= ROUND_MODS.groundInit;
  n += modNum(rec.init.adj);
  return n;
}

// ── Dice ──
export function rollDice(expr, rand = Math.random) {
  const terms = String(expr || '').toLowerCase().replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
  let total = 0, seen = false;
  for (const t of terms) {
    const m = t.match(/^(-?)(\d*)d(\d+)$/);
    if (m) { seen = true; const n = parseInt(m[2] || '1', 10); let s = 0; for (let i = 0; i < n; i++) s += 1 + Math.floor(rand() * parseInt(m[3], 10)); total += m[1] ? -s : s; }
    else if (/^-?\d+$/.test(t)) { seen = true; total += parseInt(t, 10); }
  }
  return seen ? Math.max(total, 0) : null;
}

// Players never see a foe's AC, so the sheet can't say "hit" or "miss". It
// knows the line's THAC0 with its conditions and the d20, which give the
// best AC the roll hits ("hits AC 2 or worse", as players announce it); the
// DM's page, which has the AC, decides. Null: no attack roll.
export function lineTHAC0(ctx, line) {
  const bd = scenarioBreakdown(ctx, line.sc);
  return bd ? bd.thac0 - lineToHit(line.set) : null;
}
const noAttackRoll = (ctx, sc) => scenarioType(sc) === 'spell' && !scenarioBreakdown(ctx, sc);

// A damage expression's dice and its flat part: '1d8+2' → { sig: '1d8', flat: 2 }
export function splitDice(expr) {
  const dice = [];
  let flat = 0;
  String(expr || '').toLowerCase().replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean).forEach(t => {
    if (/^-?\d*d\d+$/.test(t)) dice.push(t.replace(/^(-?)d/, '$11d'));
    else if (/^-?\d+$/.test(t)) flat += parseInt(t, 10);
  });
  return { sig: dice.join('+'), flat };
}
const lineDamage = (ctx, line) => {
  const dmg = scenarioDamage(ctx, line.sc);
  const big = line.set.target && line.set.target.size === 'l';
  return { expr: dmg ? (big ? dmg.l : dmg.sm) : '', spell: dmg && dmg.spell ? dmg.spell : '' };
};
const rollSig = (sig, rand) => (sig ? rollDice(sig, rand) : null);

// Rolls one line on the sheet: the d20, d% too on a natural 20 or 1 (for the
// DM's Good Hits / Bad Misses tables, if it turns out to be one), and the
// damage dice by the target's size, which the DM counts only on a hit. A
// spell with no attack roll (the target saves) just rolls its damage. Only
// the dice are kept: scoreRoll adds the sheet's numbers as they are now.
export function rollLine(ctx, line, rand = Math.random) {
  const d = lineDamage(ctx, line);
  const dmgSig = splitDice(d.expr).sig, spellSig = splitDice(d.spell).sig;
  const raw = { d20: null, pct: null };
  if (!noAttackRoll(ctx, line.sc)) {
    raw.d20 = 1 + Math.floor(rand() * 20);
    raw.pct = raw.d20 === 20 || raw.d20 === 1 ? 1 + Math.floor(rand() * 100) : null;
  }
  Object.assign(raw, { dmgSig, dmgDice: rollSig(dmgSig, rand), spellSig, spellDice: rollSig(spellSig, rand) });
  return scoreRoll(ctx, line, raw);
}
// A roll with the sheet's current numbers: change an effect (Bless off) or the
// target after rolling and the THAC0, AC hit and damage follow, until it's
// sent to the DM (frozen). If the damage dice themselves changed (another
// size of target), dmgStale: roll them again.
export function scoreRoll(ctx, line, raw) {
  if (!raw) return null;
  if (raw.frozen) return raw;   // sent to the DM: the numbers it was sent with
  if (!('dmgSig' in raw)) {   // a roll from before the dice were kept: its damage stays, the AC hit follows
    if (raw.d20 == null || noAttackRoll(ctx, line.sc)) return raw;
    const thac0 = lineTHAC0(ctx, line);
    return { ...raw, thac0, hitsAC: thac0 - raw.d20 };
  }
  const d = lineDamage(ctx, line);
  const dmg = splitDice(d.expr), spell = splitDice(d.spell);
  const total = (sig, dice, part) => (!sig ? null : sig === part.sig ? Math.max(dice + part.flat, 0) : undefined);
  const dmgNow = total(raw.dmgSig, raw.dmgDice, dmg), spellNow = total(raw.spellSig, raw.spellDice, spell);
  const out = {
    ...raw, dmgExpr: d.expr,
    dmg: dmgNow === undefined ? null : dmgNow ?? (dmg.sig ? null : dmg.flat || null),
    spell: spellNow === undefined ? null : spellNow,
    dmgStale: dmgNow === undefined || (!raw.dmgSig && !!dmg.sig) || spellNow === undefined || (!raw.spellSig && !!spell.sig),
    thac0: null, hitsAC: null,
  };
  if (raw.d20 != null && !noAttackRoll(ctx, line.sc)) { out.thac0 = lineTHAC0(ctx, line); out.hitsAC = out.thac0 - raw.d20; }
  return out;
}
// Rolls the damage dice again, keeping the d20 (after dmgStale)
export function rerollDamage(ctx, line, raw, rand = Math.random) {
  const d = lineDamage(ctx, line);
  const dmgSig = splitDice(d.expr).sig, spellSig = splitDice(d.spell).sig;
  return scoreRoll(ctx, line, { ...raw, dmgSig, dmgDice: rollSig(dmgSig, rand), spellSig, spellDice: rollSig(spellSig, rand) });
}

// The DM's side: did it hit this AC? Good Hits and Bad Misses: a natural 20
// always hits, and is a critical only if it would have hit anyway; a natural 1
// always misses, and is a fumble only if it would have missed anyway.
export function judgeRoll(roll, ac) {
  if (!roll) return null;
  if (roll.d20 == null) return { hit: true, crit: false, fumble: false, need: null };   // no attack roll
  const need = roll.thac0 - ac;
  return {
    need,
    hit: roll.d20 === 20 ? true : roll.d20 === 1 ? false : roll.d20 >= need,
    crit: roll.d20 === 20 && need <= 20,
    fumble: roll.d20 === 1 && need > 1,
  };
}

// What to say at the table, for one line
const acText = n => (n < 0 ? `−${-n}` : String(n));
export function lineSay(line) {
  const r = line.roll;
  const t = line.set.target ? line.set.target.label || line.set.target.name || 'target' : 'no target';
  if (!r) return `${line.label}: vs ${t}`;
  if (r.d20 == null) return `${line.label}: vs ${t}, ${r.dmg ?? '—'} damage (target saves)`;
  const nat = r.d20 === 20 ? ' (natural 20)' : r.d20 === 1 ? ' (natural 1)' : '';
  return `${line.label}: vs ${t}, d20 ${r.d20}${nat}, hits AC ${acText(r.hitsAC)} or worse, ${r.dmg ?? '—'} damage${r.spell != null ? ` + spell ${r.spell}` : ''}`;
}
