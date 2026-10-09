import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { armorClass, savingThrows, stoutSaveBonus, thiefSkills, proficiencyTargets } from '../src/rules/character.js';
import { toDMHelper, formatDMHelperConfig, castSpeed, diceAtLevel } from '../src/adapters/dm-helper.js';

const jaque = JSON.parse(readFileSync(new URL('./fixtures/jaque-v2.json', import.meta.url)));
const jaqueV1 = JSON.parse(readFileSync(new URL('../samples/jaque_09-23.json', import.meta.url)));

// ── Character rules ──
test('AC: Dex applies normally, not when surprised', () => {
  assert.deepEqual(armorClass(jaque), { ac: 4, surprised: 8, base: 8, dexAdj: -4 });
  assert.equal(armorClass({ ac: '10', dex: '5' }).surprised, 12);   // a Dex penalty still applies
});

test('Jaque\'s saves match the rogue table at 5th level', () => {
  assert.deepEqual(savingThrows(jaque), {
    base: { PPD: 12, RSW: 12, PP: 11, BW: 15, Spell: 13 }, mods: {},
    notes: ['Elf: 90% resistance to sleep and charm'],
  });
});

test('dwarf Con save bonus follows the PHB (+1 per 3½ Con)', () => {
  assert.deepEqual([3, 4, 7, 11, 14, 16, 18].map(stoutSaveBonus), [0, 1, 2, 3, 4, 4, 5]);
});

test('a dwarf priest like Atteroak: +4 vs poison, wands, spells; +8 vs mind control', () => {
  const s = savingThrows({ 'race-group': 'dwarf', con: '16', wis: '18', __classes: [{ group: 'priest', level: '4' }] });
  assert.deepEqual(s.base, { PPD: 9, RSW: 13, PP: 12, BW: 15, Spell: 14 });
  assert.deepEqual(s.mods, { Poison: 4, 'Rod, Staff, or Wand': 4, Spell: 4, 'Mind Control Spell': 8 });
});

test('the player\'s own save modifiers carry over with the DM Helper\'s sign', () => {
  const s = savingThrows({ ...jaque, __saveMods: { paralysis: 0, rod: 0, petrification: 0, breath: -2, spell: 0 } });
  assert.equal(s.mods['Breath Weapon'], 2);
});

test('Jaque\'s thief skills: Blade skills plus Open Locks from Locksmithing', () => {
  const t = Object.fromEntries(thiefSkills(jaque).map(s => [s.name, s.value]));
  assert.deepEqual(t, { 'Open Locks': 55, 'Move Silently': 50, 'Hide in Shadows': 60, 'Detect Noise': 25, 'Climb Walls': 55 });
});

test('without Locksmithing, a Blade has no Open Locks', () => {
  const noLocks = { ...jaque, __nwps: jaque.__nwps.filter(n => n.name !== 'Locksmithing') };
  assert.ok(!thiefSkills(noLocks).some(s => s.id === 'ol'));
});

test('rangers get only Move Silently and Hide in Shadows, from their level', () => {
  const t = thiefSkills({ __thiefSubclass: 'ranger', __classes: [{ group: 'warrior', level: '3' }], dex: '12' });
  assert.deepEqual(t.map(s => [s.id, s.value]), [['ms', 22], ['hs', 20]]);   // Dex 12: Move Silently −5
});

test('non-rogues have no thief skills', () => {
  assert.deepEqual(thiefSkills({ __classes: [{ group: 'wizard', level: '4' }] }), []);
});

test('proficiency targets: ability + adjustment; non-checks skipped; "*" flagged', () => {
  const p = Object.fromEntries(proficiencyTargets(jaque).map(x => [x.name, x]));
  assert.equal(p.Disguise.target, 14);
  assert.equal(p.Juggling.target, 18);
  assert.equal(p.Juggling.source, 'Kit');
  assert.equal(p['Blind FIghting'], undefined);
  assert.match(p.Intimidation.needsReview, /isn't a number/);
});

// ── Adapter ──
// Jaque's current save: scenarios, PHB rates, a spell, and effects (Bladesong
// +1 hit and Bless +1 hit are on)
const current = JSON.parse(readFileSync(new URL('../samples/jaque_10-09.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/spell-catalog.json', import.meta.url)));
const effectsOff = save => ({ ...save, __stances: save.__stances.map(st => ({ ...st, on: false })) });

test('Jaque\'s scenarios become the DM Helper\'s attacks, with the sheet\'s numbers', () => {
  const r = toDMHelper(effectsOff(current), {}, { catalog });
  const c = r.character;
  assert.equal(r.name, 'Jaque');
  assert.deepEqual(c.armor, { ac: 4, shieldless: 4, surprised: 8 });
  assert.equal(c.baseTHAC0, 18);
  assert.deepEqual(c.weapons, {
    'Dagger, melee': { thac0: 13, speed: 2 },    // 18 − Superior +1 − Hit Mod 4
    'Dagger, thrown': { thac0: 14, speed: 2 },   // 18 − Dex missile +2 − Hit Mod 1 − weapon +1
  });
  // Attacks past the first are rows of their own: 3/2 → one on alternate rounds, 3/1 → two
  assert.deepEqual(c.secondary, [
    { name: 'Dagger, melee (2nd, alt. rounds)', thac0: 13 },
    { name: 'Dagger, thrown (2nd)', thac0: 14 },
    { name: 'Dagger, thrown (3rd)', thac0: 14 },
    { name: 'Off-hand dagger', thac0: 15 },      // off-hand −2
  ]);
  // Charm Person: cast time 1, no attack roll
  assert.deepEqual(c.actions, [{ name: 'Charm Person', thac0: null, speedMin: 0, speedMax: 10, speedDefault: 1 }]);
  assert.deepEqual(r.damage['Jaque|Dagger, melee'], { sm: '1d4+3', l: '1d3+3' });
  assert.deepEqual(r.damage['Jaque|Dagger, thrown (3rd)'], { sm: '1d4+2', l: '1d3+2' });
  assert.equal(r.critTypes['Dagger, melee'], 'P');
  assert.deepEqual(r.material['Dagger, thrown'], { m: 'metal' });
  assert.equal(c.effects, undefined);
  assert.equal(r.thief['Open Locks'], 55);
});

// Nandun's current save: Str 18/00, weapon rows without Strength. The melee
// numbers match the Excel sheet he was converted from.
test('Nandun\'s melee scenarios match his Excel sheet', () => {
  const r = toDMHelper(JSON.parse(readFileSync(new URL('../samples/nandun_10-09.json', import.meta.url))));
  const thac0 = Object.fromEntries(Object.entries(r.character.weapons).map(([k, v]) => [k, v.thac0]));
  assert.deepEqual([thac0.Maul, thac0.Club, thac0.Dagger, thac0.Punch, thac0.Wrestling], [13, 15, 17, 15, 15]);
  assert.deepEqual(r.character.secondary, [{ name: 'Maul (2nd, alt. rounds)', thac0: 13 }]);
  assert.deepEqual(r.damage['Nandun Goroth|Maul'], { sm: '2d4+6', l: '1d10+6' });
  assert.deepEqual(r.damage['Nandun Goroth|Dagger'], { sm: '1d4+6', l: '1d3+6' });
});

test('effects that are on count, as on the sheet, and are listed for the DM', () => {
  const c = toDMHelper(current, {}, { catalog }).character;
  assert.equal(c.weapons['Dagger, thrown'].thac0, 12);   // Bladesong +1, Bless +1
  assert.deepEqual(c.effects, ['Bladesong: +1 hit', 'Bless (+1 hit) · from Atteroak, 6 rounds left']);
  // Defensive Spin: +3 AC
  const spin = { ...effectsOff(current), __stances: current.__stances.map(st => ({ ...st, on: st.name === 'Defensive Spin' })) };
  assert.deepEqual(toDMHelper(spin).character.armor, { ac: 1, shieldless: 1, surprised: 8 });
  // An effect for one weapon only (Wave Dagger) leaves the others alone
  const wave = { ...effectsOff(current), __stances: current.__stances.map(st => ({ ...st, on: st.name === 'Wave Dagger' })) };
  assert.equal(toDMHelper(wave).character.weapons['Dagger, melee'].thac0, 13);
});

test('spell scenarios: attack rolls, cast time and damage at the caster\'s level', () => {
  const save = effectsOff(current);
  save.__spells = [...save.__spells, { id: 'spl-77', name: 'Shocking Grasp', level: 1, type: 'wizard', isMemorized: true }];
  save.__scenarios = [{ id: 'sc-9', name: 'Shocking Grasp', group: 'rogue', levelMode: 'sheet', attackType: 'spell', spellId: 'spl-77', spell: {}, rate: '1/1' }];
  const r = toDMHelper(save, {}, { catalog });
  assert.deepEqual(r.character.actions, [{ name: 'Shocking Grasp', thac0: 18, speedMin: 0, speedMax: 10, speedDefault: 1 }]);   // touch: Str (13) adds nothing
  assert.deepEqual(r.damage['Jaque|Shocking Grasp'], { sm: '1d8+5', l: '1d8+5' });
});

test('cast times and per-level dice', () => {
  assert.deepEqual(['1', '3', '1 round', '1 turn', '', '½ segment'].map(castSpeed), [1, 3, 10, 10, null, null]);
  assert.deepEqual([diceAtLevel('1d6/level', 5), diceAtLevel('1d8+1/level', 5), diceAtLevel('2d4', 5), diceAtLevel('1d4+1 per missile', 5)],
    ['5d6', '1d8+5', '2d4', null]);
});

test('DM settings that aren\'t on the sheet are passed through; the DM\'s actions follow the spells', () => {
  const r = toDMHelper(current, { parry: 2, legacy: true, actions: [{ name: 'Bow + spell', baseSpeed: 7 }] }, { catalog });
  assert.equal(r.character.parry, 2);
  assert.equal(r.character.legacy, true);
  assert.deepEqual(r.character.actions.map(a => a.name), ['Charm Person', 'Bow + spell']);
});

test('a weapon with an unrevealed bonus is flagged, and its damage leaves the "?" out', () => {
  const save = effectsOff(current);
  save.__scenarios = [{ ...save.__scenarios[0], weaponId: 'wpn-3', name: 'Leprechaun' }];
  const r = toDMHelper(save, {}, { catalog });
  assert.deepEqual(r.damage['Jaque|Leprechaun'], { sm: '1d4+2', l: '1d3+2' });
  assert.ok(r.review.some(m => /Leprechaun.*isn't revealed/.test(m)));
});

test('the paste block runs and fills the DM Helper\'s tables', () => {
  const text = formatDMHelperConfig([toDMHelper(current, {}, { catalog })]);
  const tables = { CHARACTERS: {}, SKILLS: {}, THIEF: {}, SAVES: {}, DAMAGE: {}, CRIT_TYPES: {}, WEAPON_MATERIAL: {} };
  new Function(...Object.keys(tables), text)(...Object.values(tables));
  assert.equal(tables.CHARACTERS.Jaque.level, 5);
  assert.equal(tables.SAVES.Jaque.base.PPD, 12);
  assert.ok(tables.DAMAGE['Jaque|Dagger, thrown']);
});

test('no separate magic bonus: a critical multiplies the whole damage', () => {
  const save = effectsOff(current);
  save.__weapons = save.__weapons.map(w => (w.id === 'wpn-1' ? { ...w, dmgSM: '1d4', dmgL: '1d3', dmgAdj: '+1' } : w));
  const r = toDMHelper(save, {}, { catalog });
  assert.deepEqual(r.damage['Jaque|Dagger, melee'], { sm: '1d4+3', l: '1d3+3' });
  assert.deepEqual(r.material['Dagger, melee'], { m: 'metal' });
});
