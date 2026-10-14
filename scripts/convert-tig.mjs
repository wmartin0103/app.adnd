// Tig's current save: the converted Excel save, rebuilt on PHB values.
//   • 10-09: Tig isn't being played, so where the Excel rows were unclear or
//     inconsistent the PHB decides (dice, speeds, penalties). His written
//     class and kit benefits stay: Gallant "Skilled" +1 to hit with swords and
//     lances, Weapon Expertise 3/2 with the bastard sword.
//   • Weapon rows hold the weapon only (the bastard sword's +1); Strength
//     (16: +1 dmg) comes from the attack type, the rest is the scenario's Hit Mod.
// THAC0 18 from Bard 5. Non-proficient −2 (warrior, his best) with dagger,
// knife and sling. Heavy Lance is on his proficiency list (the Excel
// "Not proficient" note was inverted). Code of Gallant (+2, choose) is an Effect.
// Output: samples/tig_10-09.json
import { readFileSync, writeFileSync } from 'node:fs';
import { tidyProficiencyNames } from './tidy-names.mjs';

const s = JSON.parse(readFileSync('samples/tig.json', 'utf8'));
// 10-13: proficiency names without the Excel sheet's group codes and book references
tidyProficiencyNames(s);
const phb = {
  'wpn-1': { name: 'Bastard Sword +1, two-handed', hitAdj: '+1', dmgAdj: '+1', dmgSM: '2d4', dmgL: '2d8', speed: '8' },
  'wpn-2': { name: 'Bastard Sword +1, one-handed', hitAdj: '+1', dmgAdj: '+1', dmgSM: '1d8', dmgL: '1d12', speed: '6' },
  'wpn-3': { hitAdj: '', dmgSM: '1d4', dmgL: '1d3' },
  'wpn-5': { hitAdj: '', dmgSM: '1d3', dmgL: '1d2', dmgType: 'piercing' },
  'wpn-6': { hitAdj: '', dmgSM: '1d4+1', dmgL: '1d6+1' },
  'wpn-7': { name: 'Heavy Horse Lance', hitAdj: '', dmgSM: '1d8+1', dmgL: '3d6' },
  'wpn-8': { dmgSM: '1d2', dmgL: '1d2' },
};
// "Dagger, Thrown" is the same dagger: one row, thrown is a scenario
s.__weapons = s.__weapons.filter(w => w.id !== 'wpn-4').map(w => ({
  ...w, ...phb[w.id], notes: w.notes.replace(/^(Expert\/Specialized|Not proficient|Proficient);\s*/, ''),
}));
const sc = (o) => ({ group: 'rogue', levelMode: 'sheet', customLevel: 1, active: false, collapsed: false, handedness: 'main', offHandPenalty: '', spellId: null, spell: {}, hitMod: '', dmgMod: '', rate: '1/1', attackType: 'melee', ...o });
s.__scenarios = [
  sc({ id: 'sc-1', name: 'Bastard sword, two-handed', active: true, weaponId: 'wpn-1', hitMod: '1', rate: '3/2' }),
  sc({ id: 'sc-2', name: 'Bastard sword, one-handed', weaponId: 'wpn-2', hitMod: '1', rate: '3/2' }),
  sc({ id: 'sc-3', name: 'Heavy lance', weaponId: 'wpn-7', hitMod: '1' }),
  sc({ id: 'sc-4', name: 'Dagger', weaponId: 'wpn-3', hitMod: '-2' }),
  sc({ id: 'sc-5', name: 'Dagger, thrown', weaponId: 'wpn-3', attackType: 'thrown', hitMod: '-2' }),
  sc({ id: 'sc-6', name: 'Knife', weaponId: 'wpn-5', hitMod: '-2' }),
  sc({ id: 'sc-7', name: 'Sling', weaponId: 'wpn-6', attackType: 'missile', hitMod: '-2' }),
  sc({ id: 'sc-8', name: 'Punch', weaponId: 'wpn-8' }),
];
s.__scenarioCounter = 8;
const opt = (o) => ({ label: '', hit: '', dmg: '', ac: '', note: '', ...o });
s.__stances = [
  { id: 'st-1', name: 'Code of Gallant', on: false, choice: 0, target: 'all', temporary: false, from: '', rounds: '', options: [
    opt({ label: '+2 hit', hit: '2' }), opt({ label: '+2 dmg', dmg: '2' }), opt({ label: '+2 AC', ac: '2' }),
  ] },
];
s.__stanceCounter = 1;
// Proficiency abilities and adjustments from the books (checked on the 2e
// wiki, 10-13; the Excel conversion had none, and six had no ability at all):
// PHB unless noted. Poetry: Complete Bard's; Jousting: Complete Paladin's;
// Storytelling: Dragon #245; Enamour, Style Analysis: Complete Ninja's;
// Persuasion: Player's Option; Tactics: Dark Sun.
const BOOK = {
  Persuasion: ['cha', '-2'], 'Style Analysis': ['int', '-1'], Tactics: ['int', '-1'], 'Local History': ['cha', '0'],
  Enamour: ['cha', '-2'], Dancing: ['dex', '0'], 'Languages, Ancient': ['int', '0'], Poetry: ['int', '-2'],
  Riding: ['wis', '+3'], Jousting: ['dex', '+2'], Storytelling: ['cha', '0'],
};
for (const p of s.__nwps) {
  if (p.name === 'Riding Horse Spec.') p.name = 'Riding, Land-based';   // the PHB proficiency
  const k = Object.keys(BOOK).find(n => p.name.startsWith(n));
  if (k) [p.ability, p.adj] = BOOK[k];
}
// Bard proficiencies the DM Helper had hand-typed but the sheet didn't
for (const [name, ability, adj] of [['Musical Instrument', 'dex', '-1'], ['Singing', 'cha', '0']]) {
  s.__nwps.push({ id: `nwp-${++s.__nwpCounter}`, name, desc: 'Source: Bard', url: '', ability, adj, slots: 'Bard' });
}
writeFileSync('samples/tig_10-09.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/tig_10-09.json');
