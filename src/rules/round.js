// ── ONE ROUND OF COMBAT ─────────────────────────────────────────
// A character's round as the sheet's Combat section declares it and the DM's
// initiative page shows it. Both work from the same record (the "round
// record"), so they always agree; it's also what the sync sends.
//
//   {
//     character: 'Rifiyr', round: 3,
//     scenarioId: 'sc-1',                 // this round's attack (a Combat scenario)
//     init: { roll: 7 },                  // the d10, rolled once a round
//     quick: { roll: 12 },                // Quickness d20 (characters who have it)
//     you: { moveFirst, moveMult: '1', setVsCharge },
//     extra: false,                       // the half attack of a 3/2 or 5/2 rate, this round
//     offhand: false,                     // also the off-hand attack
//     lines: { a1: {...}, a2: {...}, extra: {...}, off: {...} },
//   }
//
// Each attack line: { same, target: { id, label, size }, flanking, ground,
// charging, other, roll }. A target is a foe as players know it: the DM's
// fixed ID for it and its size, never its AC or the DM's name for it. "same" (the default on every line after the
// first) follows the line above, target and conditions included.
// The DM decides where extra attacks go in the order; the record only says
// which attacks there are.

import { scenarioType, scenarioRate, rateValue, scenarioSpell, scenarioWeapon, spellArrow, castSpeed, scenarioBreakdown, scenarioDamage, modNum } from './scenarios.js';

// Situational modifiers (the DM Helper's table rules)
export const ROUND_MODS = {
  flankingToHit: 2, chargingToHit: 2, chargingAC: 1,
  groundToHit: 1, groundInit: 1, moveFirstInit: 3, setVsChargeInit: 2,
  quicknessInit: -2,
};
export const MOVE_MULTS = ['1', '1.5', '2', '3', '4'];
const blankLine = () => ({ same: true, target: null, flanking: false, ground: '', charging: false, other: 0, roll: null });

export const newRound = (character, round = 1) => ({
  character, round, scenarioId: null, init: { roll: null }, quick: { roll: null },
  you: { moveFirst: false, moveMult: '1', setVsCharge: false }, extra: false, offhand: false, lines: {},
});

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

// The off-hand scenario that goes with a main-hand attack, if the character has one
export const offhandScenario = (scenarios, sc) =>
  sc && sc.handedness !== 'off' && scenarioType(sc) !== 'spell' ? (scenarios || []).find(s => s.handedness === 'off' && s.weaponId) || null : null;

// This round's attack lines, with "same as above" worked out. `scenarios` is
// the character's list; lines beyond the first go when you move first.
export function roundLines(ctx, rec, scenarios) {
  const sc = (scenarios || []).find(s => s.id === rec.scenarioId);
  if (!sc) return [];
  const type = scenarioType(sc);
  const rate = type === 'spell' ? 1 : rateValue(scenarioRate(sc));
  const full = Math.max(1, Math.floor(rate));
  const keys = Array.from({ length: full }, (_, i) => ({ key: `a${i + 1}`, label: ORD[i], sc }));
  const half = rate - Math.floor(rate) > 0;
  if (half && rec.extra) keys.push({ key: 'extra', label: 'Extra', sc });
  const off = offhandScenario(scenarios, sc);
  if (off && rec.offhand) keys.push({ key: 'off', label: 'Off-hand', sc: off });
  const allowed = rec.you && rec.you.moveFirst ? keys.slice(0, 1) : keys;
  let prev = null;
  return allowed.map((k, i) => {
    const own = { ...blankLine(), ...(rec.lines || {})[k.key] };
    if (i === 0) own.same = false;
    const set = own.same && prev ? { ...prev.set } : { target: own.target, flanking: !!own.flanking, ground: own.ground || '', charging: !!own.charging, other: modNum(own.other) };
    const line = { key: k.key, label: k.label, sc: k.sc, same: !!own.same && i > 0, set, roll: own.roll || null };
    prev = line;
    return line;
  });
}
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
export const lineHalfAvailable = (scenarios, rec) => {
  const sc = (scenarios || []).find(s => s.id === rec.scenarioId);
  return !!sc && scenarioType(sc) !== 'spell' && rateValue(scenarioRate(sc)) % 1 > 0;
};

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
// round's adjustments (Move 1st +3, set vs charge −2, higher ground −1 from
// the first attack's target, Quickness −2 on a success). Lowest goes first.
export function actOn(ctx, rec, scenarios, who = {}) {
  if (!rec.init || rec.init.roll == null) return null;
  const sc = (scenarios || []).find(s => s.id === rec.scenarioId);
  const lines = roundLines(ctx, rec, scenarios);
  let n = rec.init.roll + attackSpeed(ctx, sc) + (who.initBonus || 0);
  if (rec.you.moveFirst) n += ROUND_MODS.moveFirstInit;
  if (rec.you.setVsCharge) n -= ROUND_MODS.setVsChargeInit;
  if (lines[0] && lines[0].set.ground === 'high') n -= ROUND_MODS.groundInit;
  if (quicknessWorks(rec, who)) n += ROUND_MODS.quicknessInit;
  return n;
}
// Quickness (a proficiency): d20 at or under Dex
export const quicknessWorks = (rec, who) => !!who.quickness && rec.quick && rec.quick.roll != null && rec.quick.roll <= (who.dex || 0);

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

// Rolls one line on the sheet: the d20, d% too on a natural 20 or 1 (for the
// DM's Good Hits / Bad Misses tables, if it turns out to be one), and damage
// by the target's size, which the DM counts only on a hit. A spell with no
// attack roll (the target saves) just rolls its damage.
export function rollLine(ctx, line, rand = Math.random) {
  const dmg = scenarioDamage(ctx, line.sc);
  const big = line.set.target && line.set.target.size === 'l';
  const expr = dmg ? (big ? dmg.l : dmg.sm) : '';
  if (noAttackRoll(ctx, line.sc)) return { d20: null, thac0: null, hitsAC: null, pct: null, dmg: expr ? rollDice(expr, rand) : null, dmgExpr: expr, spell: null };
  const thac0 = lineTHAC0(ctx, line);
  const d20 = 1 + Math.floor(rand() * 20);
  return {
    d20, thac0, hitsAC: thac0 - d20,
    pct: d20 === 20 || d20 === 1 ? 1 + Math.floor(rand() * 100) : null,
    dmg: expr ? rollDice(expr, rand) : null, dmgExpr: expr,
    spell: dmg && dmg.spell ? rollDice(dmg.spell, rand) : null,
  };
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
