// Combat, kept simple. A weapon row holds the player's final numbers: its to
// hit and damage already include Strength or Dexterity, magic, proficiency,
// specialization and anything else that always applies. The app works out
// only the base THAC0 from class and level, and adds what the player applies:
// the shared situations and their own adjustments. Abilities that only apply
// sometimes stay as text on the sheet; Combat shows them as reminders.

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

// One attack: a weapon row used one way, plus what the player has applied.
//   allAdjust  — { hit, dmg } applied to every attack (e.g. a stance)
//   adjust     — { hit, dmg } for this attack only (e.g. a called shot)
//   situation  — keys of SITUATIONS
// Off-hand attacks also take the character's off-hand penalty
// (`__offHandPenalty`, e.g. "-2").
export function attackFor({ sheet, weapon, mode, offHand = false, allAdjust = {}, adjust = {}, situation = [] }) {
  const base = baseTHAC0(sheet);
  const lines = [];
  const add = (label, hit, dmg) => { if (hit || dmg) lines.push({ label, hit, dmg }); };
  // The row's total, split into its parts when the sheet has them
  const PART_LABELS = { weapon: 'Weapon', ability: 'Ability score', prof: 'Proficiency', other: 'Other' };
  if (weapon.hitParts || weapon.dmgParts) {
    for (const [k, label] of Object.entries(PART_LABELS)) add(label, num((weapon.hitParts || {})[k]), num((weapon.dmgParts || {})[k]));
  } else add(weapon.name || 'Weapon', num(weapon.hitAdj), num(weapon.dmgAdj));
  if (offHand) add('Off-hand', num(sheet.__offHandPenalty), 0);
  for (const k of situation) if (SITUATIONS[k]) add(SITUATIONS[k].label, SITUATIONS[k].hit || 0, SITUATIONS[k].dmg || 0);
  add('All attacks adjust', num(allAdjust.hit), num(allAdjust.dmg));
  add('This attack adjust', num(adjust.hit), num(adjust.dmg));
  const hit = lines.reduce((t, l) => t + l.hit, 0);
  const dmg = lines.reduce((t, l) => t + l.dmg, 0);
  const unrevealed = !!weapon.unrevealed || weapon.hitAdj === '?' || weapon.dmgAdj === '?';
  const dice = size => {
    const raw = size === 'sm' ? weapon.dmgSM : weapon.dmgL;
    const d = parseDice(raw);
    const text = d ? formatDice(d, d.flat + dmg) : (String(raw || '').trim() || null);
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
