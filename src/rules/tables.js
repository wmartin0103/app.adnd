// ── REFERENCE TABLES ────────────────────────────────────────────
// Plain data shared by the character sheet and the DM Helper.
// Source: AD&D 2nd Edition Player's Handbook. STR (1–18, 19–25), DEX, and the
// warrior, rogue, and wizard THAC0 rows match the character sheet.

// Strength: hit and damage adjustments. Scores 1–18 and 19–25.
export const STR_TABLE = {
  1:  { hit: -5, dmg: -4 }, 2:  { hit: -3, dmg: -2 }, 3:  { hit: -3, dmg: -1 },
  4:  { hit: -2, dmg: -1 }, 5:  { hit: -2, dmg: -1 }, 6:  { hit: -1, dmg:  0 },
  7:  { hit: -1, dmg:  0 }, 8:  { hit:  0, dmg:  0 }, 9:  { hit:  0, dmg:  0 },
  10: { hit:  0, dmg:  0 }, 11: { hit:  0, dmg:  0 }, 12: { hit:  0, dmg:  0 },
  13: { hit:  0, dmg:  0 }, 14: { hit:  0, dmg:  0 }, 15: { hit:  0, dmg:  0 },
  16: { hit:  0, dmg:  1 }, 17: { hit:  1, dmg:  1 }, 18: { hit:  1, dmg:  2 },
  19: { hit:  3, dmg:  7 }, 20: { hit:  3, dmg:  8 }, 21: { hit:  4, dmg:  9 },
  22: { hit:  4, dmg: 10 }, 23: { hit:  5, dmg: 11 }, 24: { hit:  6, dmg: 12 },
  25: { hit:  7, dmg: 14 },
};

// Exceptional strength (18/01–18/00), warriors only. `upTo` is the top of each
// percentile bracket; 100 stands for 18/00.
// The character sheet doesn't support these yet; the DM Helper does.
export const STR_EXCEPTIONAL = [
  { upTo: 50,  hit: 1, dmg: 3 },
  { upTo: 75,  hit: 2, dmg: 3 },
  { upTo: 90,  hit: 2, dmg: 4 },
  { upTo: 99,  hit: 2, dmg: 5 },
  { upTo: 100, hit: 3, dmg: 6 },
];

// Dexterity: missile attack adjustment and defensive (AC) adjustment.
export const DEX_TABLE = {
  1:  { missile: -6, defense:  5 }, 2:  { missile: -4, defense:  5 },
  3:  { missile: -3, defense:  4 }, 4:  { missile: -2, defense:  3 },
  5:  { missile: -1, defense:  2 }, 6:  { missile:  0, defense:  1 },
  7:  { missile:  0, defense:  0 }, 8:  { missile:  0, defense:  0 },
  9:  { missile:  0, defense:  0 }, 10: { missile:  0, defense:  0 },
  11: { missile:  0, defense:  0 }, 12: { missile:  0, defense:  0 },
  13: { missile:  0, defense:  0 }, 14: { missile:  0, defense:  0 },
  15: { missile:  0, defense: -1 }, 16: { missile:  1, defense: -2 },
  17: { missile:  2, defense: -3 }, 18: { missile:  2, defense: -4 },
  19: { missile:  3, defense: -4 }, 20: { missile:  3, defense: -4 },
  21: { missile:  4, defense: -5 }, 22: { missile:  4, defense: -5 },
  23: { missile:  4, defense: -5 }, 24: { missile:  5, defense: -6 },
  25: { missile:  5, defense: -6 },
};

// THAC0 by class group and level (PHB Table 53), levels 1–20.
// Warrior improves 1 per level, priest 2 per 3 levels, rogue 1 per 2, wizard 1 per 3.
// NOTE: the legacy character sheet's priest row improves every 2 levels
// (L5 = 16). PHB is every 3 (L5 = 18), which matches the DM Helper.
export const THAC0_TABLE = {
  warrior: [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],
  priest:  [20,20,20,18,18,18,16,16,16,14,14,14,12,12,12,10,10,10,8,8],
  rogue:   [20,20,19,19,18,18,17,17,16,16,15,15,14,14,13,13,12,12,11,11],
  wizard:  [20,20,20,19,19,19,18,18,18,17,17,17,16,16,16,15,15,15,14,14],
};

// Racial weapon bonuses, matched by weapon category (see weapons.js) or by
// attack mode, instead of by words in the weapon's name. Trait ids match the
// character sheet's RACE_TRAITS so the sheet's on/off toggles still apply.
export const RACIAL_WEAPON_BONUSES = {
  elf: [
    { traitId: 'el-bow-bonus',   label: 'Elf: bow',   hit: 1,
      categories: ['long-bow', 'short-bow', 'composite-long-bow', 'composite-short-bow'] },
    { traitId: 'el-sword-bonus', label: 'Elf: sword', hit: 1,
      categories: ['long-sword', 'short-sword'] },
  ],
  halfling: [
    { traitId: 'hl-attack-bonus', label: 'Halfling: sling/thrown', hit: 1,
      categories: ['sling'], modes: ['thrown'] },
  ],
};
