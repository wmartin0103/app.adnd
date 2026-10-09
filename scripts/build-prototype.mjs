// Builds the clickable design prototypes in prototypes/ by filling each
// template with the current rules code and Jaque's saves.
//
//   node scripts/build-prototype.mjs
//
// Output: prototypes/<name>.html (one self-contained page each).

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { bundle, RULES_FILES } from './bundle.mjs';
import { CATALOG_TAG } from './build-legacy.mjs';

const rules = bundle(RULES_FILES, {
  expose: {
    Rules: ['rules/attacks', ['computeAttack', 'listAttacks', 'weaponAttacks', 'planRound', 'attacksThisRound', 'attacksInRound', 'hasBonusRounds', 'formatRate', 'offHandAttacks', 'effectiveLevel', 'SITUATIONS']],
    Weapons: ['rules/weapons', ['resolveWeapon', 'PHB_WEAPONS']],
    Combat: ['rules/combat', ['SITUATIONS', 'baseTHAC0', 'weaponModes', 'attackRate', 'attackFor']],
    Spells: ['rules/spells', ['findSpell', 'SPELL_FIELDS', 'missingFields']],
    Abilities: ['rules/abilities', ['COMBAT_ROLES', 'guessCombatRole', 'sameAbility']],
    Unarmed: ['rules/unarmed', ['unarmedAttack', 'unarmedResult']],
    Character: ['rules/character', ['armorClass', 'savingThrows', 'proficiencyTargets', 'hpState', 'HP_FLOOR']],
    Migrate: ['rules/migrate', ['migrateV1toV2', 'sheetWeaponToV2', 'sheetProficiencies']],
  },
});
const v1 = readFileSync('samples/jaque_09-23.json', 'utf8');
const v2 = readFileSync('test/fixtures/jaque-v2.json', 'utf8');
const spellCatalog = readFileSync('data/spell-catalog.json', 'utf8');

// Jaque's current sheet save: weapon rows as totals, with combat modifiers
// (scripts/convert-jaque.mjs)
const current = JSON.parse(readFileSync('samples/jaque_10-09.json', 'utf8'));
// …and Sound Bubble memorized, to show a spell whose catalog entry needs details
const bubble = current.__spells.find(sp => sp.name === 'Sound Bubble' && !sp.isMemorized);
if (bubble) current.__spells.push({ ...bubble, id: 'spl-90', isMemorized: true, sourceId: bubble.id });

// Whole pages embedded as JS strings. "<" is escaped so nothing inside can
// close the surrounding <script> tag.
const asJsString = text => JSON.stringify(text).replace(/</g, '\\u003c');
// The embedded tools borrow the page's spell catalog (data/spell-catalog.js,
// published next to the page), so their own script tag for it comes out
const sheetHtml = readFileSync('legacy/character-sheet.html', 'utf8').replace(CATALOG_TAG, '');
const dmHtml = readFileSync('legacy/dm-helper.html', 'utf8').replace(CATALOG_TAG, '');

for (const file of readdirSync('prototypes').filter(f => f.endsWith('.template.html'))) {
  const html = readFileSync(`prototypes/${file}`, 'utf8')
    .replace('/*__RULES__*/', () => rules)
    .replace('/*__JAQUE_V1__*/', () => v1.trim())
    .replace('/*__JAQUE_V2__*/', () => v2.trim())
    .replace('/*__SPELL_CATALOG__*/', () => spellCatalog.trim())
    .replace('/*__JAQUE_SHEET__*/', () => JSON.stringify(current))
    .replace('/*__SHEET_HTML__*/', () => asJsString(sheetHtml))
    .replace('/*__DM_HTML__*/', () => asJsString(dmHtml));
  const out = `prototypes/${file.replace('.template.html', '.html')}`;
  writeFileSync(out, html);
  console.log(`Built ${out}`);
}
