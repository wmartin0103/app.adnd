// Atteroak's current save: the converted Excel save with corrections agreed so far.
//   • 10-13: proficiency adjustments the Excel conversion dropped, where the
//     book (2e wiki) and the DM's hand-typed number agree: Healing Wis −2 (16),
//     Weaponsmithing −3 (15, renamed to the PHB title), on Wis under his god's
//     "Experienced" rule (better of Wis or Int for craft skills). The others
//     are with the owner to review.
// Weapons are unchanged for now: three questions are open (handoff).
// Output: samples/atteroak_10-13.json
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('samples/atteroak.json', 'utf8'));
for (const p of s.__nwps) {
  if (p.name.startsWith('Healing')) p.adj = '-2';
  // PHB title is Weaponsmithing (the Excel sheet had "Weaponsmith W (87,CF10)")
  if (p.name.startsWith('Weaponsmith')) { p.name = 'Weaponsmithing'; p.adj = '-3'; }
}
writeFileSync('samples/atteroak_10-13.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/atteroak_10-13.json');
