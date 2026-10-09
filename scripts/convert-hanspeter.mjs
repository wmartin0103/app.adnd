// Hanspeter's current save: the converted Excel save with corrections agreed since.
//   • 10-09: his spells are druid spells, so Priest (the converter typed them
//     Wizard), and his spell class is Priest. Light is both a druid and a
//     wizard spell; assumed druid until the player confirms (flagged in its notes).
// Weapons are unchanged for now: two rows are unnamed (likely animal forms).
// Output: samples/hanspeter_10-09.json
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('samples/hanspeter.json', 'utf8'));
s.__spellClass = 'priest';
for (const sp of s.__spells) {
  sp.type = 'priest';
  if (sp.name === 'Light') sp.notes = 'To confirm: cast as a druid (Priest) or as a bard (Wizard)? Assumed druid.';
}
writeFileSync('samples/hanspeter_10-09.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/hanspeter_10-09.json');
