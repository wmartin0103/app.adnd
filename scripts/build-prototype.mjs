// Builds the clickable design prototypes in prototypes/ by filling each
// template with the current rules code and Jaque's saves.
//
//   node scripts/build-prototype.mjs
//
// Output: prototypes/<name>.html (one self-contained page each).

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { bundle, RULES_FILES } from './bundle.mjs';

const rules = bundle(RULES_FILES, {
  expose: {
    Rules: ['rules/attacks', ['computeAttack', 'listAttacks', 'weaponAttacks', 'planRound', 'effectiveLevel', 'SITUATIONS']],
    Weapons: ['rules/weapons', ['resolveWeapon', 'PHB_WEAPONS']],
    Character: ['rules/character', ['armorClass']],
    Migrate: ['rules/migrate', ['migrateV1toV2']],
  },
});
const v1 = readFileSync('samples/jaque_09-23.json', 'utf8');
const v2 = readFileSync('test/fixtures/jaque-v2.json', 'utf8');

for (const file of readdirSync('prototypes').filter(f => f.endsWith('.template.html'))) {
  const html = readFileSync(`prototypes/${file}`, 'utf8')
    .replace('/*__RULES__*/', () => rules)
    .replace('/*__JAQUE_V1__*/', () => v1.trim())
    .replace('/*__JAQUE_V2__*/', () => v2.trim());
  const out = `prototypes/${file.replace('.template.html', '.html')}`;
  writeFileSync(out, html);
  console.log(`Built ${out}`);
}
