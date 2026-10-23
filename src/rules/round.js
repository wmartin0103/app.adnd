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
// Each attack line: { targets: [{ id, label, size }], flanking, rear, ground,
// charging, other, roll }. A target is a foe as players know it: the DM's
// fixed ID for it and its size, never its AC or the DM's name for it. Every
// line is set on its own: targets and conditions are deliberate choices.
//
// Several targets, the 2e way: an attack that rolls to hit rolls a d20 (and
// damage) for each target, as every attack is its own roll; an area spell the
// targets save against (Fireball) rolls its damage once for all of them; a
// spell with neither (Magic Missile: missiles split among targets) rolls
// damage for each target.
// The DM decides where extra attacks go in the order; the record only says
// which attacks there are.

import { scenarioType, scenarioSpell, scenarioWeapon, spellArrow, castSpeed, scenarioBreakdown, scenarioDamage, modNum } from './scenarios.js';

// Situational modifiers (the DM Helper's table rules)
export const ROUND_MODS = {
  flankingToHit: 2, rearToHit: 2, chargingToHit: 2, chargingAC: 1,
  groundToHit: 1, groundInit: 1, moveFirstInit: 3, setVsChargeInit: 2,
};
export const MOVE_MULTS = ['1', '1.5', '2', '3', '4'];
const blankLine = () => ({ targets: [], flanking: false, rear: false, ground: '', charging: false, other: 0, roll: null });
// A line's targets (a line from before there could be several had one: target)
const ownTargets = own => (own.targets && own.targets.length ? own.targets : own.target ? [own.target] : []);

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

// This round's attack lines, one for each attack added, each with its own
// target and conditions. Only the first is left when you move first.
export function roundLines(ctx, rec, scenarios) {
  const keys = [];
  roundQueue(rec).forEach(q => {
    const sc = (scenarios || []).find(s => s.id === q.scenarioId);
    if (sc) keys.push({ key: q.qid, qid: q.qid, label: ORD[keys.length] || `#${keys.length + 1}`, sc, extra: !!q.extra });
  });
  const allowed = rec.you && rec.you.moveFirst ? keys.slice(0, 1) : keys;
  return allowed.map(k => {
    const own = { ...blankLine(), ...(rec.lines || {})[k.key] };
    const set = { targets: ownTargets(own), flanking: !!own.flanking, rear: !!own.rear, ground: own.ground || '', charging: !!own.charging, other: modNum(own.other) };
    return { key: k.key, qid: k.qid, label: k.label, sc: k.sc, extra: k.extra, set, roll: own.roll ? scoreRoll(ctx, { sc: k.sc, set }, own.roll) : null };
  });
}
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

// To-hit modifier for one line's conditions
export function lineToHit(set) {
  let n = 0;
  if (set.flanking) n += ROUND_MODS.flankingToHit;
  if (set.rear) n += ROUND_MODS.rearToHit;
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
// The damage dice against one target (its size picks S/M or L)
const lineDamage = (ctx, sc, target) => {
  const dmg = scenarioDamage(ctx, sc);
  const big = target && target.size === 'l';
  return { expr: dmg ? (big ? dmg.l : dmg.sm) : '', spell: dmg && dmg.spell ? dmg.spell : '' };
};
const rollSig = (sig, rand) => (sig ? rollDice(sig, rand) : null);
// How a line with several targets resolves: 'attack' (a d20 each), 'area'
// (one damage roll, each target saves) or 'split' (damage for each target)
export function lineKind(ctx, sc) {
  if (!noAttackRoll(ctx, sc)) return 'attack';
  const sp = scenarioSpell(ctx, sc);
  const save = String((sp && sp.save) || '').trim();
  return save && !/^(none|n\/a|-|—)$/i.test(save) ? 'area' : 'split';
}
const targetsOf = line => (line.set.targets && line.set.targets.length ? line.set.targets : [null]);
const damageDice = (ctx, sc, target, rand) => {
  const d = lineDamage(ctx, sc, target);
  const dmgSig = splitDice(d.expr).sig, spellSig = splitDice(d.spell).sig;
  return { dmgSig, dmgDice: rollSig(dmgSig, rand), spellSig, spellDice: rollSig(spellSig, rand) };
};

// Rolls one line on the sheet: for each target, the d20, d% too on a natural
// 20 or 1 (for the DM's Good Hits / Bad Misses tables, if it turns out to be
// one), and the damage dice by that target's size, which the DM counts only on
// a hit. A spell with no attack roll just rolls its damage (once for an area
// spell). Only the dice are kept: scoreRoll adds the sheet's numbers as they are now.
export function rollLine(ctx, line, rand = Math.random) {
  const kind = lineKind(ctx, line.sc);
  const shared = kind === 'area' ? damageDice(ctx, line.sc, targetsOf(line)[0], rand) : null;
  const each = targetsOf(line).map(target => {
    const raw = { target, d20: null, pct: null };
    if (kind === 'attack') {
      raw.d20 = 1 + Math.floor(rand() * 20);
      raw.pct = raw.d20 === 20 || raw.d20 === 1 ? 1 + Math.floor(rand() * 100) : null;
    }
    return Object.assign(raw, shared || damageDice(ctx, line.sc, target, rand));
  });
  return scoreRoll(ctx, line, { kind, each });
}
// A roll with the sheet's current numbers: change an effect (Bless off) or the
// conditions after rolling and the THAC0, AC hit and damage follow, until it's
// sent to the DM (frozen). If the damage dice themselves changed (another
// size of target), dmgStale: roll them again.
export function scoreRoll(ctx, line, raw) {
  if (!raw) return null;
  // A roll from before several targets: one entry, against the line's first target
  const asEach = r => (r.each ? r : { kind: lineKind(ctx, line.sc), each: [{ ...r, target: targetsOf(line)[0] }], dmgStale: !!r.dmgStale, frozen: r.frozen });
  if (raw.frozen) return asEach(raw);   // sent to the DM: the numbers it was sent with
  const each = asEach(raw).each;
  const thac0 = noAttackRoll(ctx, line.sc) ? null : lineTHAC0(ctx, line);
  const scored = each.map(e => {
    if (!('dmgSig' in e)) {   // from before the dice were kept: its damage stays, the AC hit follows
      return e.d20 == null || thac0 == null ? e : { ...e, thac0, hitsAC: thac0 - e.d20 };
    }
    const d = lineDamage(ctx, line.sc, e.target);
    const dmg = splitDice(d.expr), spell = splitDice(d.spell);
    const total = (sig, dice, part) => (!sig ? null : sig === part.sig ? Math.max(dice + part.flat, 0) : undefined);
    const dmgNow = total(e.dmgSig, e.dmgDice, dmg), spellNow = total(e.spellSig, e.spellDice, spell);
    return {
      ...e, dmgExpr: d.expr,
      dmg: dmgNow === undefined ? null : dmgNow ?? (dmg.sig ? null : dmg.flat || null),
      spell: spellNow === undefined ? null : spellNow,
      dmgStale: dmgNow === undefined || (!e.dmgSig && !!dmg.sig) || spellNow === undefined || (!e.spellSig && !!spell.sig),
      thac0: e.d20 != null ? thac0 : null, hitsAC: e.d20 != null && thac0 != null ? thac0 - e.d20 : null,
    };
  });
  return { kind: raw.kind || lineKind(ctx, line.sc), each: scored, dmgStale: scored.some(e => e.dmgStale) };
}
// Rolls the damage dice again where they changed, keeping the d20s (after dmgStale)
export function rerollDamage(ctx, line, raw, rand = Math.random) {
  const cur = scoreRoll(ctx, line, raw);
  const shared = cur.kind === 'area' ? damageDice(ctx, line.sc, cur.each[0] && cur.each[0].target, rand) : null;
  const each = cur.each.map(e => (e.dmgStale ? { ...e, ...(shared || damageDice(ctx, line.sc, e.target, rand)) } : e));
  return scoreRoll(ctx, line, { kind: cur.kind, each });
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

// What to say at the table, for one line (each target in turn)
const acText = n => (n < 0 ? `−${-n}` : String(n));
const whoText = t => (t ? t.label || t.name || 'target' : 'no target');
export function lineSay(line) {
  const targets = line.set.targets && line.set.targets.length ? line.set.targets : [null];
  if (!line.roll) return `${line.label}: vs ${targets.map(whoText).join(', ')}`;
  const parts = line.roll.each.map(r => {
    const t = whoText(r.target);
    if (r.d20 == null) return `vs ${t}, ${r.dmg ?? '—'} damage (${line.roll.kind === 'area' ? 'target saves' : 'no save'})`;
    const nat = r.d20 === 20 ? ' (natural 20)' : r.d20 === 1 ? ' (natural 1)' : '';
    return `vs ${t}, d20 ${r.d20}${nat}, hits AC ${acText(r.hitsAC)} or worse, ${r.dmg ?? '—'} damage${r.spell != null ? ` + spell ${r.spell}` : ''}`;
  });
  return `${line.label}: ${parts.join('; ')}`;
}
