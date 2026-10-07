import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { armorClass, savingThrows, stoutSaveBonus, thiefSkills, proficiencyTargets } from '../src/rules/character.js';
import { toDMHelper, formatDMHelperConfig } from '../src/adapters/dm-helper.js';

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
test('Jaque becomes a DM Helper character', () => {
  const r = toDMHelper(jaque);
  assert.equal(r.name, 'Jaque');
  const c = r.character;
  assert.deepEqual(c.armor, { ac: 4, shieldless: 4, surprised: 8 });
  assert.equal(c.baseTHAC0, 18);
  assert.deepEqual(c.quickness, { bonus: -2 });
  assert.deepEqual(c.weapons['Superior Dagger'], { modes: { melee: { thac0: 13, speed: 2 }, thrown: { thac0: 13, speed: 2 } } });
  assert.deepEqual(c.weapons['Dagger x6, thrown'], { thac0: 14, speed: 2 });
  assert.deepEqual(c.weapons['Trick Throw'], { thac0: 16, speed: 2 });
  assert.deepEqual(c.secondary.map(s => s.name), [
    'Off-hand Dagger x6',
    'Superior Dagger (2nd; melee alt. rounds)',
    'Superior Dagger (3rd; thrown)',
  ]);
  assert.deepEqual(r.damage['Jaque|Superior Dagger'], { sm: '1d4+3', l: '1d3+3' });
  assert.equal(r.critTypes['Superior Dagger'], 'P');
  assert.deepEqual(r.material['Superior Dagger'], { m: 'metal' });
  assert.equal(r.thief['Open Locks'], 55);
  assert.equal(r.skills.Disguise.t, 14);
});

test('DM settings that aren\'t on the sheet are passed through', () => {
  const r = toDMHelper(jaque, { parry: 2, legacy: true });
  assert.equal(r.character.parry, 2);
  assert.equal(r.character.legacy, true);
});

test('a v1 save is migrated first and its review items come along', () => {
  const r = toDMHelper(jaqueV1);
  // The carried-over hit mod makes it a custom attack, so it keeps its sheet name
  assert.deepEqual(r.character.weapons['Dagger Attack (Specialized'], { thac0: 13, speed: 2 });
  assert.ok(r.review.some(m => m.includes('Based on Dagger?')));
});

test('the paste block runs and fills the DM Helper\'s tables', () => {
  const text = formatDMHelperConfig([toDMHelper(jaque)]);
  const tables = { CHARACTERS: {}, SKILLS: {}, THIEF: {}, SAVES: {}, DAMAGE: {}, CRIT_TYPES: {}, WEAPON_MATERIAL: {} };
  new Function(...Object.keys(tables), text)(...Object.values(tables));
  assert.equal(tables.CHARACTERS.Jaque.level, 5);
  assert.equal(tables.SAVES.Jaque.base.PPD, 12);
  assert.ok(tables.DAMAGE['Jaque|Trick Throw']);
  assert.match(text, /NEEDS REVIEW[\s\S]*Leprechaun Dagger/);
});
