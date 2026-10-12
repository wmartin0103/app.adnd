// Rifiyr's current save: his own save (Wizard 4, Bowcaster kit) set up for
// the Combat section. Kit rules: docs/house-rules/bowcaster.md
//   • 10-12: scenarios for his bows and fallback weapons, and his memorized
//     spells cast the ordinary way (the casting penalty is worked out by the
//     rules code). Bow scenarios: wizard THAC0, Mystic Aim (Wis 15 magical
//     defense +1) as Hit Mod, two shots a round. Non-bow scenarios: the kit's
//     −2 plus the wizard's −5 non-proficiency as Hit Mod.
//   • The Dagger row's −2 was the kit penalty; it belongs to Rifiyr, not the
//     dagger, so it moves to the scenario.
//   • "Magic Missle" spelled as the catalog has it.
//   • Ability cards for his Mystic Archery talents so far and Spellarrows, to
//     announce at the table.
//   • A Spellarrow: Shocking Grasp on the long bow.
//   • Flight and sheaf arrows as separate scenarios for each bow. (His rows'
//     "1d8 / 1d6" were sheaf / flight, not S-M / L.)
// Output: samples/rifiyr_10-12.json
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('samples/rifiyr.json', 'utf8'));
for (const sp of s.__spells) if (sp.name === 'Magic Missle') sp.name = 'Magic Missile';
// "1D8" → "1d8", as every other save writes dice
for (const w of s.__weapons) { w.dmgSM = w.dmgSM.toLowerCase(); w.dmgL = w.dmgL.toLowerCase(); }
const dagger = s.__weapons.find(w => w.id === 'wpn-3');
dagger.hitAdj = '';
const sc = (o) => ({ group: 'wizard', levelMode: 'sheet', customLevel: 1, active: false, collapsed: false, handedness: 'main', offHandPenalty: '', spellId: null, spell: {}, hitMod: '', dmgMod: '', rate: '1/1', ...o });
s.__scenarios = [
  // He shoots flight and sheaf arrows: one scenario each (PHB 1d6 / 1d8)
  sc({ id: 'sc-1', name: 'Long bow, flight', active: true, weaponId: 'wpn-2', attackType: 'missile', ammo: 'flight', hitMod: '1', rate: '2/1' }),
  sc({ id: 'sc-8', name: 'Long bow, sheaf', weaponId: 'wpn-2', attackType: 'missile', ammo: 'sheaf', hitMod: '1', rate: '2/1' }),
  sc({ id: 'sc-2', name: 'Folding bow, flight', weaponId: 'wpn-4', attackType: 'missile', ammo: 'flight', hitMod: '1', rate: '2/1' }),
  sc({ id: 'sc-9', name: 'Folding bow, sheaf', weaponId: 'wpn-4', attackType: 'missile', ammo: 'sheaf', hitMod: '1', rate: '2/1' }),
  // Spellarrow: Shocking Grasp (touch) on the long bow, at full strength
  sc({ id: 'sc-7', name: 'Shocking Grasp arrow', weaponId: 'wpn-2', attackType: 'spellarrow', spellId: 'spl-32', ammo: 'flight', hitMod: '1' }),
  sc({ id: 'sc-3', name: 'Magic Missile', attackType: 'spell', spellId: 'spl-30' }),
  sc({ id: 'sc-4', name: 'Shocking Grasp', attackType: 'spell', spellId: 'spl-32' }),
  sc({ id: 'sc-5', name: 'Dagger', weaponId: 'wpn-3', attackType: 'melee', hitMod: '-7' }),
  sc({ id: 'sc-6', name: 'Silver short sword', weaponId: 'wpn-1', attackType: 'melee', hitMod: '-7' }),
];
s.__scenarioCounter = 9;
const card = (n, name, desc) => ({ id: `abc-${n}`, name, desc, url: '' });
s.__abilitiesCards = [
  card(1, 'Mystic Aim', 'Always on: Wisdom magical defense adjustment (+1) added to hit with a bow, on top of Dex. Counted in the bow scenarios.'),
  card(2, 'Unfriendly Fire', 'Firing into a melee: take any penalty to hit and add the same number to the intended target\'s weight when rolling who is struck.'),
  card(3, 'Direction Arrow (1/day)', 'Concentrate a full round, loose an arrow straight up: it points toward a person, place or object seen or touched before, within 1 mile per level, for 1 turn per level. Direction only.'),
  card(4, 'Anticipate Blow (1/round)', 'When an attack targets him: Wisdom check; on a success, AC better by half his caster level (2 at 4th) against that one attack.'),
  card(5, 'Spellarrows (touch spells)', 'Cast a touch spell onto an arrow and fire it as his only shot that round. Initiative: bow speed + casting time. The spell lands if the roll beats the target\'s AC without armor or shield; the arrow wounds if it also beats the true AC. No casting penalty. A missed touch-arrow loses the spell; a natural 1 is a misfire.'),
  card(6, 'Casting without an arrow', 'Casting time +3 and −1 damage per die (at least 1 per die). Counted in the spell scenarios.'),
];
s.__abilitiesCardsCounter = 6;
writeFileSync('samples/rifiyr_10-12.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/rifiyr_10-12.json');
