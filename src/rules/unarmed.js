// Unarmed combat: PHB punching and wrestling (Chapter 9, Table 57).
// Values entered from the PHB table; spot-check against the book before
// relying on them, like the PHB weapon list.
//
// Make a normal attack roll (THAC0 vs AC, with Strength and situational
// modifiers). If it hits, look up the modified roll on the table:
//   • Punch: the listed damage plus Strength damage. 75% of punching damage
//     is temporary (it wears off after the fight); the KO % is the chance the
//     target is knocked out for 1d10 rounds.
//   • Wrestle: the listed move. Moves marked hold (*) can be kept up in later
//     rounds without a new roll.

import { strengthMods, baseTHAC0, SITUATIONS } from './attacks.js';

// [roll, punch, punch damage, knockout %, wrestle, wrestle is a hold]
const TABLE_57 = [
  [20, 'Haymaker', 2, 10, 'Bear hug', true],
  [19, 'Wild swing', 0, 1, 'Arm twist', false],
  [18, 'Rabbit punch', 1, 3, 'Kick', false],
  [17, 'Kidney punch', 1, 5, 'Trip', false],
  [16, 'Glancing blow', 1, 2, 'Elbow smash', false],
  [15, 'Jab', 2, 6, 'Arm lock', true],
  [14, 'Uppercut', 1, 8, 'Leg twist', false],
  [13, 'Hook', 2, 9, 'Leg lock', false],
  [12, 'Kidney punch', 1, 5, 'Throw', false],
  [11, 'Hook', 2, 10, 'Gouge', false],
  [10, 'Glancing blow', 1, 3, 'Elbow smash', false],
  [9, 'Combination', 1, 10, 'Leg lock', true],
  [8, 'Uppercut', 1, 9, 'Headlock', true],
  [7, 'Combination', 2, 10, 'Throw', false],
  [6, 'Jab', 2, 8, 'Gouge', false],
  [5, 'Glancing blow', 1, 3, 'Kick', false],
  [4, 'Rabbit punch', 2, 5, 'Arm lock', true],
  [3, 'Hook', 2, 12, 'Gouge', false],
  [2, 'Uppercut', 2, 15, 'Headlock', true],
  [1, 'Wild swing', 0, 2, 'Leg twist', false],
  [0, 'Haymaker', 2, 25, 'Bear hug', true],   // less than 1
];

export function unarmedResult(modifiedRoll) {
  const r = Math.max(0, Math.min(20, modifiedRoll));
  const [, punch, damage, knockout, wrestle, hold] = TABLE_57.find(row => row[0] === r);
  return { punch: { name: punch, damage, knockout }, wrestle: { name: wrestle, hold } };
}

// THAC0 for a punch or wrestle: the character's best base THAC0, Strength to
// hit, situation and any quick adjustment. Weapon bonuses don't apply.
export function unarmedAttack({ sheet, round = {} }) {
  const bases = (sheet.__classes || [])
    .map(c => ({ group: c.group, level: parseInt(c.level, 10) || 1 }))
    .map(c => ({ ...c, thac0: baseTHAC0(c.group, c.level) }))
    .filter(c => c.thac0 != null)
    .sort((a, b) => a.thac0 - b.thac0);
  const base = bases[0] || { group: 'warrior', level: 1, thac0: 20 };
  const str = strengthMods(sheet);
  const lines = [];
  if (str.hit || str.dmg) lines.push({ label: str.label, hit: str.hit, dmg: str.dmg });
  for (const key of round.situation || []) {
    const s = SITUATIONS[key];
    if (s && s.hit) lines.push({ label: s.label, hit: s.hit, dmg: 0 });
  }
  if (round.adjust && round.adjust.hit) lines.push({ label: round.adjust.label || 'Adjustment', hit: round.adjust.hit, dmg: 0 });
  const hit = lines.reduce((t, l) => t + l.hit, 0);
  return { base, thac0: base.thac0 - hit, hitBonus: hit, strDamage: str.dmg, lines };
}
