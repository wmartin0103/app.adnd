// ── CHARACTER: saves, thief skills, proficiencies, AC ───────────
// Everything about a character other than attacks, calculated from the
// sheet save. Same rules as the character sheet, except where noted
// (PHB corrections are called out).

import { DEX_TABLE } from './tables.js';
import { effectiveLevel } from './attacks.js';

const num = v => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

// ── Armor class ──
// Normal AC is the sheet's base AC plus the Dex defensive adjustment.
// Surprised loses the Dex bonus (a Dex penalty still applies).
export function armorClass(sheet) {
  const base = num(sheet.ac) || 10;
  const dex = (DEX_TABLE[num(sheet.dex)] || { defense: 0 }).defense;
  return { ac: base + dex, surprised: base + Math.max(0, dex), base, dexAdj: dex };
}

// ── Saving throws (PHB Table 60) ──
// Each row: [minLevel, PPD, RSW, PP, BW, Spell]
//   PPD   = paralyzation, poison, or death magic
//   RSW   = rod, staff, or wand
//   PP    = petrification or polymorph
//   BW    = breath weapon
const SAVE_ROWS = {
  warrior: [[1, 14, 16, 15, 17, 17], [3, 13, 15, 14, 16, 16], [5, 11, 13, 12, 13, 14], [7, 10, 12, 11, 12, 13], [9, 8, 10, 9, 9, 11], [11, 7, 9, 8, 8, 10], [13, 5, 7, 6, 5, 8], [15, 4, 6, 5, 4, 7], [17, 3, 5, 4, 4, 6], [19, 2, 4, 3, 3, 5]],
  priest:  [[1, 10, 14, 13, 16, 15], [4, 9, 13, 12, 15, 14], [7, 7, 11, 10, 13, 12], [10, 6, 10, 9, 12, 11], [13, 5, 9, 8, 11, 10], [16, 4, 8, 7, 10, 9], [19, 2, 6, 5, 8, 7]],
  rogue:   [[1, 13, 14, 12, 16, 15], [5, 12, 12, 11, 15, 13], [9, 11, 10, 10, 14, 11], [13, 10, 8, 9, 13, 9], [17, 9, 6, 8, 12, 7], [20, 8, 4, 7, 11, 5]],
  wizard:  [[1, 14, 11, 13, 15, 12], [6, 13, 9, 11, 13, 10], [11, 11, 7, 9, 11, 8], [16, 10, 5, 7, 9, 6], [21, 8, 3, 5, 7, 4]],
};
const SAVE_KEYS = ['PPD', 'RSW', 'PP', 'BW', 'Spell'];

// Wisdom magical defense adjustment (applies to mind-affecting spells)
const WIS_MAGIC_DEFENSE = { 1: -6, 2: -4, 3: -3, 4: -2, 5: -1, 6: -1, 15: 1, 16: 2, 17: 3, 18: 4, 19: 4, 20: 4, 21: 4, 22: 4, 23: 4, 24: 4, 25: 4 };
// Constitution poison adjustment
const CON_POISON = { 1: -2, 2: -1, 19: 1, 20: 1, 21: 2, 22: 2, 23: 3, 24: 3, 25: 4 };

// Dwarf, gnome, and halfling Constitution save bonus: +1 per 3½ points of Con
// (PHB). Matches the character sheet.
export function stoutSaveBonus(con) {
  return Math.floor(num(con) / 3.5);
}

const RACIAL_SAVE_NOTES = {
  elf: 'Elf: 90% resistance to sleep and charm',
  'half-elf': 'Half-elf: 30% resistance to sleep and charm',
};

// Returns the DM Helper's save shape: { base, mods, notes }.
//   base — best class row across all classes
//   mods — bonuses by save category name; positive = better
export function savingThrows(sheet) {
  const rows = (sheet.__classes || [])
    .map(c => {
      const level = num(c.level);
      const table = SAVE_ROWS[c.group];
      if (!table || level < 1) return null;
      return table.filter(r => level >= r[0]).at(-1);
    })
    .filter(Boolean);
  if (!rows.length) return null;
  const base = Object.fromEntries(SAVE_KEYS.map((k, i) => [k, Math.min(...rows.map(r => r[i + 1]))]));

  const mods = {};
  const addMod = (cat, n) => { if (n) mods[cat] = (mods[cat] || 0) + n; };
  const race = sheet['race-group'];
  const con = num(sheet.con);
  const stout = stoutSaveBonus(con);
  if (race === 'dwarf' || race === 'halfling') {
    addMod('Poison', stout); addMod('Rod, Staff, or Wand', stout); addMod('Spell', stout);
  }
  if (race === 'gnome') {
    addMod('Rod, Staff, or Wand', stout); addMod('Spell', stout);
  }
  addMod('Poison', CON_POISON[con] || 0);

  // The player's own save modifiers on the sheet raise the target number
  // (positive = worse), so they flip sign here.
  const own = sheet.__saveMods || {};
  const ownCats = {
    paralysis: ['Paralysis', 'Poison', 'Death Magic'], rod: ['Rod, Staff, or Wand'],
    petrification: ['Petrification', 'Polymorph'], breath: ['Breath Weapon'], spell: ['Spell'],
  };
  for (const [key, cats] of Object.entries(ownCats)) for (const c of cats) addMod(c, -num(own[key]));

  // Mind-control spells: everything that applies to spells, plus Wisdom.
  // (The DM Helper reads this category instead of Spell when it's set.)
  const mind = (mods.Spell || 0) + (WIS_MAGIC_DEFENSE[num(sheet.wis)] || 0);
  if (mind) mods['Mind Control Spell'] = mind;

  const notes = [RACIAL_SAVE_NOTES[race]].filter(Boolean);
  return { base, mods, notes };
}

// ── Thief skills (PHB Tables 26–28) ──
export const THIEF_SKILLS = [
  { id: 'pp', name: 'Pick Pockets' }, { id: 'ol', name: 'Open Locks' },
  { id: 'frt', name: 'Find/Remove Traps' }, { id: 'ms', name: 'Move Silently' },
  { id: 'hs', name: 'Hide in Shadows' }, { id: 'dn', name: 'Detect Noise' },
  { id: 'cw', name: 'Climb Walls' }, { id: 'rl', name: 'Read Languages' },
];
const THIEF_BASE = {
  thief: { pp: 15, ol: 10, frt: 5, ms: 10, hs: 5, dn: 15, cw: 60, rl: 0 },
  bard:  { pp: 10, ol: 0, frt: 0, ms: 0, hs: 0, dn: 20, cw: 50, rl: 5 },
  blade: { pp: 0, ol: 0, frt: 0, ms: 10, hs: 5, dn: 20, cw: 50, rl: 0 },
};
// Skills a subclass actually has (missing = all). Blades (revised kit) have
// Climb Walls, Detect Noise, Hide in Shadows, Move Silently. A proficiency can
// grant another: Locksmithing gives full Open Locks. Race and Dex only adjust
// skills the character has. Matches the character sheet.
const SUBCLASS_SKILLS = { blade: ['ms', 'hs', 'dn', 'cw'] };
const NWP_GRANTS = { locksmithing: ['ol'] };
const RANGER_TABLE = { 1: [10, 15], 2: [15, 21], 3: [20, 27], 4: [25, 33], 5: [31, 40], 6: [37, 47], 7: [43, 55], 8: [49, 62], 9: [56, 70], 10: [63, 78], 11: [70, 86], 12: [77, 94], 13: [85, 99], 14: [93, 99], 15: [99, 99] };   // [hs, ms]
const THIEF_RACIAL = {
  dwarf:      { ol: 10, frt: 15, cw: -10, rl: -5 },
  elf:        { pp: 5, ol: -5, ms: 5, hs: 10, dn: 5, cw: -5 },
  gnome:      { ol: 5, frt: 10, dn: 10, cw: -15 },
  halfling:   { pp: 5, ol: 5, frt: 5, ms: 10, hs: 15, dn: 5, cw: -15 },
  'half-elf': { rl: -5 },
  'half-orc': { pp: -5, cw: 5, rl: -10 },
};
const THIEF_DEX = {
  9: { pp: -15, ol: -10, frt: -10, ms: -20, hs: -10 }, 10: { pp: -10, ol: -5, frt: -10, ms: -15, hs: -5 },
  11: { pp: -5, frt: -5, ms: -10 }, 12: { ms: -5 },
  17: { pp: 5, ol: 10, ms: 5, hs: 5 }, 18: { pp: 10, ol: 15, frt: 5, ms: 10, hs: 10 },
  19: { pp: 15, ol: 20, frt: 10, ms: 15, hs: 15 },
};

// Final percentages, or [] for characters with no thief skills.
// Matches the sheet: base + points + kit/misc + armor + race + Dex, 0–95%.
export function thiefSkills(sheet) {
  const sub = sheet.__thiefSubclass || 'thief';
  const isRanger = sub === 'ranger';
  const hasRogue = (sheet.__classes || []).some(c => c.group === 'rogue');
  if (!hasRogue && !isRanger) return [];
  const level = Math.min(Math.max(effectiveLevel(sheet) || 1, 1), 20);
  const alloc = sheet.__thiefSkillAlloc || {};
  const race = THIEF_RACIAL[sheet['race-group']] || {};
  const dex = THIEF_DEX[num(sheet.dex)] || {};
  const own = SUBCLASS_SKILLS[sub];
  const available = own && [...own, ...(sheet.__nwps || []).flatMap(n => NWP_GRANTS[(n.name || '').trim().toLowerCase()] || [])];
  const out = [];
  for (const skill of THIEF_SKILLS) {
    if (available && !available.includes(skill.id)) continue;
    if (isRanger && !['ms', 'hs'].includes(skill.id)) continue;
    let base;
    if (isRanger) base = (RANGER_TABLE[Math.min(level, 15)] || [0, 0])[skill.id === 'hs' ? 0 : 1];
    else if (THIEF_BASE[sub]) base = THIEF_BASE[sub][skill.id] || 0;
    else base = Math.max(THIEF_BASE.thief[skill.id] || 0, THIEF_BASE.bard[skill.id] || 0);   // hybrid
    const extra = isRanger ? 0 : ['points', 'kit', 'armor'].reduce((s, k) => s + num(alloc[k]?.[skill.id]), 0);
    const value = Math.min(95, Math.max(0, base + extra + (race[skill.id] || 0) + (dex[skill.id] || 0)));
    out.push({ id: skill.id, name: skill.name, value });
  }
  return out;
}

// ── Nonweapon proficiencies ──
// Check target = ability score + adjustment (roll at or under). Proficiencies
// with no ability (e.g. Blind-fighting) aren't checks and are skipped.
export function proficiencyTargets(sheet) {
  const out = [];
  for (const p of sheet.__nwps || []) {
    if (!p.ability || p.ability === 'none') continue;
    const adjText = String(p.adj ?? '').trim();
    const readable = adjText === '' || /^[+-]?\d+$/.test(adjText);
    const slots = String(p.slots ?? '').trim();
    out.push({
      name: (p.name || '').trim(),
      target: num(sheet[p.ability]) + (readable ? num(adjText) : 0),
      source: /^\d*$/.test(slots) ? '' : slots[0].toUpperCase() + slots.slice(1),
      ...(readable ? {} : { needsReview: `Adjustment "${adjText}" isn't a number; target uses the bare ability score` }),
    });
  }
  return out;
}
