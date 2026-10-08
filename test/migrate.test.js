import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { migrateV1toV2, guessCategory, sheetWeaponToV2, sheetProficiencies } from '../src/rules/migrate.js';
import { computeAttack, listAttacks } from '../src/rules/attacks.js';

const jaqueV1 = JSON.parse(readFileSync(new URL('../samples/jaque_09-23.json', import.meta.url)));

test('guesses PHB categories from the party\'s real weapon names', () => {
  const cases = {
    'Superior Dagger': 'dagger', 'Magic Dagger +1': 'dagger', 'Dagger x6': 'dagger',
    'Long Bow (Fine)': 'long-bow', 'Comp. Short Bow': 'composite-short-bow',
    'Lucern Hammer': 'lucern-hammer', 'Bastard sword +1 (1H)': 'bastard-sword',
    "Horseman's Mace +1": 'horsemans-mace', 'Sling, Bullets': 'sling',
    'Silver Short Sword': 'short-sword', 'Stone Knife': 'knife', 'Heavy lance': 'heavy-lance',
    'Warhammer': 'warhammer', 'Club': 'club', 'Harpoon': 'harpoon',
    'Maul': null, 'Folding bow': null, 'Natural attack': null,
  };
  for (const [name, key] of Object.entries(cases)) assert.equal(guessCategory(name), key, name);
});

test('Jaque migrates with every attack keeping its old THAC0', () => {
  const v2 = migrateV1toV2(jaqueV1);
  assert.equal(v2.__version, 2);
  assert.equal(v2.__scenarios, undefined);
  const melee = computeAttack({ sheet: v2, weaponId: 'wpn-1', attackId: 'sc-3' });
  const thrown = computeAttack({ sheet: v2, weaponId: 'wpn-5', attackId: 'sc-5' });
  assert.equal(melee.thac0, 13);
  assert.equal(melee.mode, 'melee');
  assert.equal(thrown.thac0, 14);
  assert.equal(thrown.mode, 'thrown');
  // The old +4 hit mod included Dex +3 for the thrown attack; v2 adds Dex
  // itself, so only +1 carries over.
  assert.deepEqual(thrown.lines.find(l => l.label === 'From old sheet'), { layer: 'built-in', label: 'From old sheet', hit: 1, dmg: 0 });
});

test('Jaque\'s weapons convert, and nothing unreadable is dropped', () => {
  const v2 = migrateV1toV2(jaqueV1);
  const byId = Object.fromEntries(v2.__weapons.map(w => [w.id, w]));
  assert.equal(byId['wpn-1'].basedOn, 'dagger');
  assert.equal(byId['wpn-1'].hitBonus, 1);
  assert.equal(byId['wpn-1'].dmgBonus, 1);                // "1d4+1" → dagger + 1
  assert.equal(byId['wpn-3'].unknown, true);              // dmg adj "?"
  assert.match(byId['wpn-4'].notes, /old hit adj: \*\+1\/2/);
  assert.equal(byId['wpn-4'].hitBonus, undefined);        // "*+1/2" is never applied
});

test('Jaque\'s review list covers every guess and every unreadable value', () => {
  const v2 = migrateV1toV2(jaqueV1);
  const msgs = v2.__review.map(r => `${r.target.id}: ${r.message}`);
  assert.ok(msgs.some(m => m.startsWith('wpn-1: Based on Dagger?')));
  assert.ok(msgs.some(m => m.startsWith('wpn-1: Damage vs L changed from 1d4+1 to the PHB\'s 1d3')));
  assert.ok(msgs.some(m => m.startsWith('wpn-3: Damage adjustment was "?"')));
  assert.ok(msgs.some(m => m.startsWith('wpn-4: Couldn\'t read hit adjustment "*+1/2"')));
  assert.ok(msgs.some(m => m.startsWith('sc-3: "Dagger Attack (Specialized" carries +4 to hit')));
  assert.ok(msgs.some(m => m.startsWith('sc-5: Is "Thrown Dagger Attack" thrown?')));
  assert.equal(new Set(v2.__review.map(r => r.id)).size, v2.__review.length);
});

const sheet = (weapons, scenarios, extra = {}) => ({
  str: '13', dex: '10', 'race-group': 'human', __classes: [{ group: 'warrior', level: '3' }],
  __weapons: weapons, __scenarios: scenarios, ...extra,
});

test('a PHB flat damage bonus is not counted twice', () => {
  const v2 = migrateV1toV2(sheet([{ id: 'w', name: 'Warhammer', dmgSM: '1d4+1', dmgL: '1d4', speed: '4', hitAdj: '', dmgAdj: '' }], []));
  assert.equal(v2.__weapons[0].dmgBonus, undefined);
  assert.deepEqual(listAttacks({ sheet: v2 })[0].damage, { sm: '1d4+1', l: '1d4' });
});

test('off-hand penalty becomes a labeled line and THAC0 is unchanged', () => {
  const v2 = migrateV1toV2(sheet(
    [{ id: 'w', name: 'Short Sword', dmgSM: '1d6', dmgL: '1d8', speed: '3', hitAdj: '', dmgAdj: '' }],
    [{ id: 'sc-1', name: 'Off hand', group: 'warrior', levelMode: 'sheet', weaponId: 'w', handedness: 'off', offHandPenalty: '2', hitMod: '' }],
  ));
  const a = computeAttack({ sheet: v2, weaponId: 'w', attackId: 'sc-1' });
  assert.equal(a.thac0, 20);                                    // warrior 3 = 18, off-hand +2
  assert.deepEqual(a.lines, [{ layer: 'built-in', label: 'Off-hand', hit: -2, dmg: 0 }]);
});

test('racial bonuses are applied by v2, not swallowed by the carried-over hit mod', () => {
  const v2 = migrateV1toV2(sheet(
    [{ id: 'w', name: 'Long Sword', dmgSM: '1d8', dmgL: '1d12', speed: '5', hitAdj: '', dmgAdj: '' }],
    [{ id: 'sc-1', name: 'Sword', group: 'warrior', levelMode: 'sheet', weaponId: 'w', handedness: 'main', hitMod: '' }],
    { 'race-group': 'elf' },
  ));
  const a = computeAttack({ sheet: v2, weaponId: 'w', attackId: 'sc-1' });
  assert.equal(a.thac0, 17);
  assert.deepEqual(a.lines.map(l => l.label), ['Elf: sword']);
});

test('a scenario with no weapon becomes a special attack, flagged', () => {
  const v2 = migrateV1toV2(sheet([], [{ id: 'sc-1', name: 'Bite', group: 'warrior', levelMode: 'sheet', weaponId: null, hitMod: '' }]));
  assert.equal(v2.__specialAttacks[0].id, 'sc-1');
  assert.ok(v2.__review.some(r => r.target.id === 'sc-1'));
});

test('a weapon with no recognizable name asks for its base weapon', () => {
  const v2 = migrateV1toV2(sheet([{ id: 'w', name: 'Maul', dmgSM: '2d4', dmgL: '1d10', speed: '6', hitAdj: '', dmgAdj: '' }], []));
  assert.equal(v2.__weapons[0].basedOn, undefined);
  assert.deepEqual(v2.__weapons[0].damage, { sm: '2d4', l: '1d10' });
  assert.equal(v2.__weapons[0].speed, 6);
  assert.deepEqual(listAttacks({ sheet: v2 }).map(x => x.mode), ['melee']);
  assert.ok(v2.__review.some(r => /Pick the PHB weapon "Maul"/.test(r.message)));
});

test('weapon proficiencies come from the old proficiency cards, flagged to confirm', () => {
  const v2 = migrateV1toV2(jaqueV1);
  assert.deepEqual(v2.__weaponProficiencies, ['dagger']);
  assert.ok(v2.__review.some(r => r.target.id === 'weapon-proficiencies' && /Dagger/.test(r.message)));
});

test('fields set on the sheet are used instead of guesses', () => {
  const save = JSON.parse(JSON.stringify(jaqueV1));
  save.__weapons[0].basedOn = 'dagger'; save.__weapons[0].basedOnGuessed = false;
  save.__weapons[0].modes = ['melee']; save.__weapons[0].magicPlus = 1;
  save.__wpnProfCards.forEach(c => { c.weaponType = /Dagger/.test(c.name) ? 'dagger' : ''; c.weaponTypeGuessed = false; });
  const v2 = migrateV1toV2(save);
  const w = v2.__weapons.find(x => x.id === 'wpn-1');
  assert.deepEqual([w.basedOn, w.modes, w.magicPlus], ['dagger', ['melee'], 1]);
  assert.ok(!v2.__review.some(r => r.target.id === 'wpn-1' && /guessed/.test(r.message)));
  assert.deepEqual(v2.__weaponProficiencies, ['dagger']);
  assert.ok(!v2.__review.some(r => r.target.id === 'weapon-proficiencies'));
});

test('the sheet\'s weapons are read as they are, one attack per mode', () => {
  const sheet = { str: '13', dex: '19', 'race-group': 'elf', __classes: [{ group: 'rogue', level: '5' }],
    __weaponProficiencies: ['dagger'],
    __weapons: [sheetWeaponToV2({ id: 'w1', name: 'Superior Dagger', basedOn: 'dagger', modes: ['melee', 'thrown'], speed: '2', dmgType: 'piercing', hitAdj: '+1', dmgAdj: '+1', dmgSM: '1d4', dmgL: '1d4', magicPlus: 0 })] };
  const w = sheet.__weapons[0];
  assert.deepEqual(w.damage, { sm: '1d4', l: '1d4' });   // the sheet's dice, even where the PHB differs
  assert.equal(w.hitBonus, 1);
  const attacks = listAttacks({ sheet });
  assert.deepEqual(attacks.map(a => [a.attackId, a.thac0, a.damage.l]), [['w1:melee', 17, '1d4+1'], ['w1:thrown', 14, '1d4+1']]);
});

test('proficiencies come from the cards\' weapon type, or a guess from the name', () => {
  assert.deepEqual(sheetProficiencies({ __wpnProfCards: [{ name: 'Daggers (Signature Weapon)' }, { name: 'Bladesong Fighting Style' }] }), ['dagger']);
  assert.deepEqual(sheetProficiencies({ __wpnProfCards: [{ name: 'Daggers', weaponType: 'knife' }] }), ['knife']);
});
