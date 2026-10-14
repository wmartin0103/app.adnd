// Goroth's current save: the converted Excel save (samples/nandun.json) with
// corrections agreed since.
//   • 10-13: his name is Goroth (the Excel sheet had "Nandun Goroth"), so the
//     DM Helper's import replaces its hand-typed Goroth
//   • 10-13: Danger Sense (Wis +1, for the DM Helper's surprise check) and the
//     Home Terrain skills Animal Lore, Hiding, Survival and Tracking: the DM
//     Helper had them hand-typed, the sheet didn't
//   • 10-09: Str 18/00 (Brute kit "Ripped"), entered as exceptional Strength
//   • 10-09: weapon rows hold the weapon only. The Excel rows had Str 18/00
//     (+3 hit, +6 dmg) and proficiency built in; Strength now comes from the
//     scenario's attack type and the rest is the scenario's Hit Mod.
// Proficiency, from the Excel totals (its "Proficient" notes were inverted):
// Club proficient (Clubbing tight group), Maul expertise, Harpoon proficient,
// Dagger and Spear not proficient (warrior −2). Unarmed is Wild Brawl, 1d6.
// The Maul's other +2 to hit has no stated source; kept as Hit Mod.
// Output: samples/goroth_10-09.json
import { readFileSync, writeFileSync } from 'node:fs';
import { tidyProficiencyNames } from './tidy-names.mjs';

const s = JSON.parse(readFileSync('samples/nandun.json', 'utf8'));
// 10-13: proficiency names without the Excel sheet's group codes and book references
tidyProficiencyNames(s);
s.name = 'Goroth';
// Adjustments the Excel conversion dropped: Running is Con −6 (PHB), Dirty
// Tricks Wis −2 (Complete Gladiator's Handbook); checked on the 2e wiki
for (const p of s.__nwps) {
  if (/^Running\b/.test(p.name)) { p.ability = 'con'; p.adj = '-6'; }
  if (/^Dirty Tricks\b/.test(p.name)) { p.ability = 'wis'; p.adj = '-2'; }
}
// Free proficiencies from his hand-typed DM Helper entry: Danger Sense, and
// Barbarian Home Terrain (Forest): Animal Lore, Hiding, Survival, Tracking.
// Abilities and adjustments as the books have them (checked on the 2e wiki):
// Animal Lore Int +0, Survival Int +0, Tracking Wis +0 (PHB); Hiding Int −1,
// Danger Sense Wis +1 (Complete Barbarian's Handbook).
const free = (name, ability, adj, desc) => ({ id: `nwp-${s.__nwpCounter++}`, name, desc, url: '', ability, adj, slots: 'Free' });
s.__nwps = [...s.__nwps,
  free('Danger Sense', 'wis', '+1', 'Source: Free'),
  free('Animal Lore', 'int', '0', 'Source: Barbarian Home Terrain (Forest)'),
  free('Hiding', 'int', '-1', 'Source: Barbarian Home Terrain (Forest)'),
  free('Survival', 'int', '0', 'Source: Barbarian Home Terrain (Forest)'),
  free('Tracking', 'wis', '0', 'Source: Barbarian Home Terrain (Forest)'),
];
s['str-pct'] = '00';
// "1d6+6" → "1d6": the +6 is Strength
const noStr = d => String(d).replace(/\+6$/, '');
for (const w of s.__weapons) {
  w.hitAdj = '';
  w.dmgSM = noStr(w.dmgSM);
  w.dmgL = noStr(w.dmgL);
  w.notes = w.notes.replace(/^(Not proficient|Proficient);\s*/, '');
}
const byName = n => s.__weapons.find(w => w.name === n);
byName('Spear, Thrown').name = 'Spear';
const sc = (o) => ({ group: 'warrior', levelMode: 'sheet', customLevel: 1, active: false, collapsed: false, handedness: 'main', offHandPenalty: '', spellId: null, spell: {}, hitMod: '', dmgMod: '', rate: '1/1', ...o });
s.__scenarios = [
  // Barbarian Weapon Expertise (Maul): a bonus attack every other round
  sc({ id: 'sc-1', name: 'Maul', active: true, weaponId: byName('Maul').id, attackType: 'melee', hitMod: '2', rate: '3/2' }),
  sc({ id: 'sc-2', name: 'Club', weaponId: byName('Club').id, attackType: 'melee' }),
  sc({ id: 'sc-3', name: 'Dagger', weaponId: byName('Dagger').id, attackType: 'melee', hitMod: '-2' }),
  sc({ id: 'sc-4', name: 'Spear, thrown', weaponId: byName('Spear').id, attackType: 'thrown', hitMod: '-2' }),
  sc({ id: 'sc-5', name: 'Harpoon, thrown', weaponId: byName('Harpoon').id, attackType: 'thrown' }),
  sc({ id: 'sc-6', name: 'Punch', weaponId: byName('Punch*, Bare-handed').id, attackType: 'melee' }),
  sc({ id: 'sc-7', name: 'Wrestling', weaponId: byName('Wrestling*').id, attackType: 'melee' }),
];
s.__scenarioCounter = 7;
writeFileSync('samples/goroth_10-09.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/goroth_10-09.json');
