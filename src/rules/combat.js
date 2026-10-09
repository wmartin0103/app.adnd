// Combat, kept simple. A weapon row holds the player's final numbers: its to
// hit and damage already include Strength or Dexterity, magic, proficiency,
// specialization and anything else that always applies. The app works out
// only the base THAC0 from class and level, and adds what's switched on:
// the character's own modifiers and the shared situations.

import { THAC0_TABLE } from './tables.js';
import { parseDice, formatDice } from './dice.js';
import { PHB_WEAPONS } from './weapons.js';
import { guessCategory } from './migrate.js';

// Shared situational chips (from the DM Helper's MODS). Campaign-wide.
export const SITUATIONS = {
  flanking:      { label: 'Flanking',       hit: 2 },
  charging:      { label: 'Charging',       hit: 2 },
  higherGround:  { label: 'Higher ground',  hit: 1 },
  targetUnaware: { label: 'Target unaware', hit: 0 },
};

// A character's own modifiers (`__combatModifiers` on the sheet):
//   { id, label, hit, dmg, ac, appliesTo, use, weaponId? }
// appliesTo — which attacks it can apply to
export const MOD_APPLIES = {
  all: 'All attacks',
  melee: 'Melee attacks',
  ranged: 'Thrown or missile attacks',
  offhand: 'Off-hand attacks',
  weapon: 'One weapon',
};
// use — how it's switched on
export const MOD_USES = {
  always: 'Always',
  attack: 'Per attack',
  round: 'Whole round',
};

const num = v => {
  const n = parseInt(String(v ?? '').replace('−', '-'), 10);
  return Number.isNaN(n) ? 0 : n;
};

// Best THAC0 across the character's classes at their levels
export function baseTHAC0(sheet) {
  const rows = (sheet.__classes || [])
    .map(c => ({ group: c.group, level: Math.min(Math.max(num(c.level), 1), 20), name: c.name }))
    .filter(c => THAC0_TABLE[c.group])
    .map(c => ({ ...c, thac0: THAC0_TABLE[c.group][c.level - 1] }))
    .sort((a, b) => a.thac0 - b.thac0);
  return rows[0] || { group: 'warrior', level: 1, thac0: 20, name: '' };
}

// The ways a weapon row is used: its own setting, then the row's notes or
// name ("Ranged/Thrown", "Dagger, Thrown"), then the PHB weapon it's based on.
export function weaponModes(w) {
  if (Array.isArray(w.modes) && w.modes.length) return w.modes.slice();
  const base = PHB_WEAPONS[w.basedOn || guessCategory(w.name) || ''];
  const text = `${w.name || ''} ${w.notes || ''}`.toLowerCase();
  if (/\branged\b|\bthrown\b|\bmissile\b|\bsling\b|\bbow\b/.test(text)) {
    return base && base.modes.includes('thrown') ? ['thrown'] : ['missile'];
  }
  if (/\bmelee\b/.test(text)) return ['melee'];
  return base ? base.modes.slice() : ['melee'];
}

// Attacks per round for a row used one way (the row's own setting, else 1 in
// melee and the PHB rate of fire for thrown/missile)
export function attackRate(w, mode) {
  if (w.rates && w.rates[mode]) return w.rates[mode];
  if (mode === 'melee') return '1';
  const base = PHB_WEAPONS[w.basedOn || guessCategory(w.name) || ''];
  return (base && base.rateOfFire) || '1';
}

// Does a modifier apply to this attack?
export function modifierApplies(mod, { weaponId, mode, offHand = false }) {
  switch (mod.appliesTo || 'all') {
    case 'melee': return mode === 'melee';
    case 'ranged': return mode === 'thrown' || mode === 'missile';
    case 'offhand': return offHand;
    case 'weapon': return mod.weaponId === weaponId;
    default: return true;
  }
}

// One attack: a weapon row used one way, plus what's switched on.
//   picked    — ids of per-attack modifiers chosen on this card
//   stances   — ids of whole-round modifiers switched on
//   situation — keys of SITUATIONS; adjust — quick +/- to hit
export function attackFor({ sheet, weapon, mode, offHand = false, picked = [], stances = [], situation = [], adjust = 0 }) {
  const base = baseTHAC0(sheet);
  const lines = [];
  const add = (label, hit, dmg) => { if (hit || dmg) lines.push({ label, hit, dmg }); };
  // The row's total, split into its parts when the sheet has them
  const PART_LABELS = { weapon: 'Weapon', ability: 'Ability score', prof: 'Proficiency', other: 'Other' };
  if (weapon.hitParts || weapon.dmgParts) {
    for (const [k, label] of Object.entries(PART_LABELS)) add(label, num((weapon.hitParts || {})[k]), num((weapon.dmgParts || {})[k]));
  } else add(weapon.name || 'Weapon', num(weapon.hitAdj), num(weapon.dmgAdj));
  const ctx = { weaponId: weapon.id, mode, offHand };
  for (const m of sheet.__combatModifiers || []) {
    if (!modifierApplies(m, ctx)) continue;
    const on = m.use === 'always' || (m.use === 'round' ? stances.includes(m.id) : picked.includes(m.id));
    if (on) add(m.label, num(m.hit), num(m.dmg));
  }
  for (const k of situation) if (SITUATIONS[k]) add(SITUATIONS[k].label, SITUATIONS[k].hit || 0, SITUATIONS[k].dmg || 0);
  if (adjust) add('Quick adjust', adjust, 0);
  const hit = lines.reduce((t, l) => t + l.hit, 0);
  const dmg = lines.reduce((t, l) => t + l.dmg, 0);
  const unrevealed = !!weapon.unrevealed || weapon.hitAdj === '?' || weapon.dmgAdj === '?';
  const dice = size => {
    const d = parseDice(size === 'sm' ? weapon.dmgSM : weapon.dmgL);
    const text = d ? formatDice(d, d.flat + dmg) : (String((size === 'sm' ? weapon.dmgSM : weapon.dmgL) || '').trim() || null);
    return text && unrevealed ? `${text} + ?` : text;
  };
  return {
    name: `${weapon.name || 'Weapon'}${weaponModes(weapon).length > 1 ? `, ${mode}` : ''}`,
    weaponId: weapon.id, mode, offHand,
    base, thac0: base.thac0 - hit, hit, unrevealed,
    damage: { sm: dice('sm'), l: dice('l') },
    rate: offHand ? '1' : attackRate(weapon, mode),
    lines,
  };
}

// AC change from modifiers switched on for the round (and "always" ones);
// a negative number is better
export function acChange(sheet, stances = []) {
  return (sheet.__combatModifiers || [])
    .filter(m => m.use === 'always' || (m.use === 'round' && stances.includes(m.id)))
    .reduce((t, m) => t + num(m.ac), 0);
}

// The per-attack and whole-round modifiers that can apply to an attack
export function choicesFor(sheet, ctx) {
  const mods = (sheet.__combatModifiers || []).filter(m => modifierApplies(m, ctx));
  return { perAttack: mods.filter(m => m.use === 'attack') };
}
