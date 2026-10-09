// Jaque's current save: the 09-23 save with corrections agreed since.
//   • 10-07: thief skill Kit/Misc (Open Locks +20, Find/Remove Traps 0)
//   • 10-09: daggers do 1d3 against Large targets (PHB), not 1d4
// Weapon rows stay as they were (the weapon's own bonus); how character
// bonuses are recorded is still being decided.
// Output: samples/jaque_10-09.json
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('samples/jaque_09-23.json', 'utf8'));
s.__thiefSkillAlloc.kit = { ...s.__thiefSkillAlloc.kit, ol: 20, frt: 0 };
for (const w of s.__weapons) {
  if (/dagger/i.test(w.name)) w.dmgL = String(w.dmgL || '1d4').replace(/^1d4/, '1d3');
}
writeFileSync('samples/jaque_10-09.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/jaque_10-09.json');
