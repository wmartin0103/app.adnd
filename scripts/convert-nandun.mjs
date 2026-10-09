// Nandun's current save: the converted Excel save with corrections agreed since.
//   • 10-09: Str 18/00 (Brute kit "Ripped"), entered as exceptional Strength
//   • 10-09: weapon rows hold the weapon only. The Excel rows had Str 18/00
//     (+3 hit, +6 dmg) and proficiency built in; Strength now comes from the
//     scenario's attack type and the rest is the scenario's Hit Mod.
// Proficiency, from the Excel totals (its "Proficient" notes were inverted):
// Club proficient (Clubbing tight group), Maul expertise, Harpoon proficient,
// Dagger and Spear not proficient (warrior −2). Unarmed is Wild Brawl, 1d6.
// The Maul's other +2 to hit has no stated source; kept as Hit Mod.
// Output: samples/nandun_10-09.json
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('samples/nandun.json', 'utf8'));
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
writeFileSync('samples/nandun_10-09.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/nandun_10-09.json');
