// Jaque's current save: the 09-23 save with corrections agreed since.
//   • 10-07: thief skill Kit/Misc (Open Locks +20, Find/Remove Traps 0)
//   • 10-09: daggers do 1d3 against Large targets (PHB), not 1d4
//   • 10-09: weapon rows hold the weapon only; Jaque's own bonuses live in
//     three scenarios (melee, thrown, off-hand); Bladesong and Defensive
//     Spin are stances; a Bless from Atteroak shows a temporary effect
// Signature Weapon (dagger): +1 hit, +2 dmg. Duelist's Precision: Dex instead
// of Str to hit in melee (Dex 19 missile adj. +3, entered as Hit Mod there).
// Output: samples/jaque_10-09.json
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('samples/jaque_09-23.json', 'utf8'));
s.__thiefSkillAlloc.kit = { ...s.__thiefSkillAlloc.kit, ol: 20, frt: 0 };
for (const w of s.__weapons) {
  if (/dagger/i.test(w.name)) w.dmgL = String(w.dmgL || '1d4').replace(/^1d4/, '1d3');
}
const sup = s.__weapons.find(w => w.name === 'Superior Dagger').id;
const six = s.__weapons.find(w => w.name === 'Dagger x6').id;
const sc = (o) => ({ group: 'rogue', levelMode: 'sheet', customLevel: 1, active: false, collapsed: false, handedness: 'main', offHandPenalty: '', onlyIn: '', ...o });
s.__scenarios = [
  sc({ id: 'sc-1', name: 'Dagger, melee', active: true, weaponId: sup, attackType: 'melee', hitMod: '4', dmgMod: '2', rate: '3/2' }),
  sc({ id: 'sc-2', name: 'Dagger, thrown', weaponId: six, attackType: 'thrown', hitMod: '1', dmgMod: '2', rate: '3' }),
  sc({ id: 'sc-3', name: 'Off-hand dagger', weaponId: sup, attackType: 'melee', handedness: 'off', offHandPenalty: '2', hitMod: '4', dmgMod: '2', rate: '1' }),
];
s.__scenarioCounter = 3;
const opt = (o) => ({ label: '', hit: '', dmg: '', ac: '', note: '', ...o });
const st = (o) => ({ on: false, choice: 0, target: 'all', form: false, temporary: false, from: '', rounds: '', ...o });
s.__stances = [
  st({ id: 'st-1', name: 'Bladesong', on: true, choice: 0, options: [
    opt({ label: '+1 hit', hit: '1' }), opt({ label: '+1 AC', ac: '1' }), opt({ label: 'Attack and parry', note: 'DM adjudicates' }),
  ] }),
  st({ id: 'st-2', name: 'Defensive Spin', options: [opt({ ac: '3', note: 'no attacks; ends if hit' })] }),
  st({ id: 'st-3', name: 'Bless', on: true, temporary: true, from: 'Atteroak', rounds: '6', options: [opt({ hit: '1' })] }),
];
s.__stanceCounter = 3;
writeFileSync('samples/jaque_10-09.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/jaque_10-09.json');
