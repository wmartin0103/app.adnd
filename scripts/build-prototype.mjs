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
    Rules: ['rules/attacks', ['computeAttack', 'listAttacks', 'weaponAttacks', 'planRound', 'attacksThisRound', 'offHandAttacks', 'effectiveLevel', 'SITUATIONS']],
    Weapons: ['rules/weapons', ['resolveWeapon', 'PHB_WEAPONS']],
    Character: ['rules/character', ['armorClass', 'savingThrows', 'proficiencyTargets']],
    Migrate: ['rules/migrate', ['migrateV1toV2', 'sheetWeaponToV2', 'sheetProficiencies']],
  },
});
const v1 = readFileSync('samples/jaque_09-23.json', 'utf8');
const v2 = readFileSync('test/fixtures/jaque-v2.json', 'utf8');

// Jaque's current sheet save: the 09-23 save with the thief skill Kit/Misc
// corrections made on 10-07 (Open Locks +20, Find/Remove Traps 0).
const current = JSON.parse(v1);
current.__thiefSkillAlloc.kit = { ...current.__thiefSkillAlloc.kit, ol: 20, frt: 0 };

// Whole pages embedded as JS strings. "<" is escaped so nothing inside can
// close the surrounding <script> tag.
const asJsString = text => JSON.stringify(text).replace(/</g, '\\u003c');
const sheetHtml = readFileSync('legacy/character-sheet.html', 'utf8');
const dmHtml = readFileSync('legacy/dm-helper.html', 'utf8');

for (const file of readdirSync('prototypes').filter(f => f.endsWith('.template.html'))) {
  const html = readFileSync(`prototypes/${file}`, 'utf8')
    .replace('/*__RULES__*/', () => rules)
    .replace('/*__JAQUE_V1__*/', () => v1.trim())
    .replace('/*__JAQUE_V2__*/', () => v2.trim())
    .replace('/*__JAQUE_SHEET__*/', () => JSON.stringify(current))
    .replace('/*__SHEET_HTML__*/', () => asJsString(sheetHtml))
    .replace('/*__DM_HTML__*/', () => asJsString(dmHtml));
  const out = `prototypes/${file.replace('.template.html', '.html')}`;
  writeFileSync(out, html);
  console.log(`Built ${out}`);
}
