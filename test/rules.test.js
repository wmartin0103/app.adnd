import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseDice, formatDice } from '../src/rules/dice.js';
import { resolveWeapon } from '../src/rules/weapons.js';
import { baseTHAC0, strengthMods, computeAttack, listAttacks } from '../src/rules/attacks.js';

const jaque = JSON.parse(readFileSync(new URL('./fixtures/jaque-v2.json', import.meta.url)));

// ── Dice ──
test('parses clean dice and rejects anything else', () => {
  assert.deepEqual(parseDice('1d4+1'), { count: 1, sides: 4, flat: 1 });
  assert.deepEqual(parseDice('2d4'), { count: 2, sides: 4, flat: 0 });
  assert.deepEqual(parseDice('d6-1'), { count: 1, sides: 6, flat: -1 });
  assert.equal(parseDice('?'), null);
  assert.equal(parseDice('*+1/2'), null);
  assert.equal(formatDice({ count: 1, sides: 4 }, 3), '1d4+3');
  assert.equal(formatDice({ count: 1, sides: 4 }, -1), '1d4-1');
});

// ── Weapons: "based on" and categories ──
test('a sheet weapon inherits from its PHB weapon and keeps its category', () => {
  const w = resolveWeapon({ id: 'w', name: 'Superior Dagger', basedOn: 'dagger', hitBonus: 1 });
  assert.equal(w.category, 'dagger');
  assert.equal(w.speed, 2);
  assert.deepEqual(w.damage, { sm: '1d4', l: '1d3' });
  assert.deepEqual(w.modes, ['melee', 'thrown']);
  assert.deepEqual(w.lineage, ['Dagger', 'Superior Dagger']);
});

test('a campaign weapon maps to a PHB category, and sheet weapons can build on it', () => {
  const campaign = { 'folding-bow': { name: 'Folding bow', basedOn: 'short-bow', hitBonus: -1, speed: 7 } };
  const w = resolveWeapon({ id: 'w', name: "Rifiyr's folding bow", basedOn: 'folding-bow' }, campaign);
  assert.equal(w.category, 'short-bow');
  assert.equal(w.hitBonus, -1);
  assert.deepEqual(w.lineage, ['Short bow (flight arrow)', 'Folding bow', "Rifiyr's folding bow"]);
});

test('ammunition variants share their launcher category', () => {
  assert.equal(resolveWeapon({ id: 'w', basedOn: 'sling-stone' }).category, 'sling');
});

test('a basedOn loop does not hang', () => {
  const campaign = { a: { basedOn: 'b' }, b: { basedOn: 'a' } };
  assert.equal(resolveWeapon({ id: 'w', basedOn: 'a' }, campaign).category, null);
});

// ── Tables ──
test('THAC0 progressions follow the PHB', () => {
  assert.equal(baseTHAC0('rogue', 5), 18);
  assert.equal(baseTHAC0('warrior', 4), 17);
  assert.equal(baseTHAC0('wizard', 4), 19);
  assert.equal(baseTHAC0('priest', 3), 20);   // legacy sheet says 18
  assert.equal(baseTHAC0('priest', 5), 18);   // legacy sheet says 16; DM Helper says 18
});

test('exceptional strength', () => {
  assert.deepEqual(strengthMods({ str: '18', 'str-pct': '00' }), { hit: 3, dmg: 6, label: 'Strength 18/00' });
  assert.deepEqual(strengthMods({ str: '18', 'str-pct': '100' }), { hit: 3, dmg: 6, label: 'Strength 18/00' });
  assert.deepEqual(strengthMods({ str: '18', 'str-pct': '67' }), { hit: 2, dmg: 3, label: 'Strength 18/67' });
  assert.deepEqual(strengthMods({ str: '13' }), { hit: 0, dmg: 0, label: 'Strength 13' });
});

// ── Jaque ──
test('Jaque, Superior Dagger melee: THAC0 13, 1d4+3 / 1d3+3 (PHB damage vs L)', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1' });
  assert.equal(a.thac0, 13);
  assert.deepEqual(a.damage, { sm: '1d4+3', l: '1d3+3' });
  assert.equal(a.speed, 2);
  assert.deepEqual(a.damageTypes, ['P']);
  assert.equal(a.attacksPerRound, '3/2');
  assert.deepEqual(a.lines.map(l => [l.label, l.hit, l.dmg]), [
    ["Duelist's Precision: Dexterity 19 (missile adj.)", 3, 0],
    ['Superior Dagger', 1, 1],
    ['Signature Weapon', 1, 2],
  ]);
  // The DM Helper has this attack at THAC0 16: it doesn't include Duelist's
  // Precision. To be settled at the table; the breakdown makes the gap visible.
});

test('Jaque, thrown Dagger x6: THAC0 14, 1d4+2 / 1d3+2', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-5', attackId: 'atk-5' });
  assert.equal(a.thac0, 14);
  assert.deepEqual(a.damage, { sm: '1d4+2', l: '1d3+2' });
  assert.equal(a.attacksPerRound, '3/1');
  assert.deepEqual(a.range, { s: 1, m: 2, l: 3 });
});

test('Jaque, thrown Superior Dagger uses Dex, not Duelist (melee only)', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-2' });
  assert.equal(a.thac0, 13);
  assert.equal(a.lines[0].label, 'Dexterity 19 (missile adj.)');
});

test('situational bonuses on the Wave Dagger are listed, never applied', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-4', attackId: 'wpn-4:melee' });
  assert.equal(a.thac0, 14);   // 18 − Dex 3 − Signature 1; no +½
  assert.equal(a.conditional[0].label, 'vs Tiny/Small');
});

test('unidentified weapons are flagged for review', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-3', attackId: 'wpn-3:melee' });
  assert.ok(a.needsReview.includes('Weapon has unidentified properties'));
});

test('weapons without an attack list get one attack per mode', () => {
  const ids = listAttacks({ sheet: jaque }).map(a => a.attackId);
  assert.deepEqual(ids, ['atk-1', 'atk-2', 'wpn-3:melee', 'wpn-3:thrown', 'wpn-4:melee', 'wpn-4:thrown', 'atk-5']);
});

// ── Round layers ──
test('Bladesong +1 hit and flanking stack on top of the built-in number', () => {
  const a = computeAttack({
    sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1',
    round: { toggles: { 'opt-1': '+1 hit' }, situation: ['flanking'] },
  });
  assert.equal(a.thac0, 10);
  assert.deepEqual(a.lines.filter(l => l.layer !== 'built-in').map(l => l.label), ['Bladesong: +1 hit', 'Flanking']);
});

test('quick adjust applies once and is labeled', () => {
  const a = computeAttack({
    sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1',
    round: { adjust: { hit: -2, label: 'Rope bridge' } },
  });
  assert.equal(a.thac0, 15);
  assert.equal(a.lines.at(-1).label, 'Rope bridge');
});

test('Defensive Spin marks the round as no attack', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1', round: { toggles: { 'opt-2': true } } });
  assert.equal(a.noAttack, true);
});

// ── Racial bonuses match on category, not name ──
test('elf bow bonus applies to a bow whose name never says "bow"', () => {
  const sheet = {
    str: '10', dex: '10', 'race-group': 'elf', __classes: [{ group: 'warrior', level: '1' }],
    __weapons: [{ id: 'w', name: 'Moonstring', basedOn: 'long-bow' }],
  };
  const a = computeAttack({ sheet, weaponId: 'w', attackId: 'w:missile' });
  assert.equal(a.thac0, 19);
  assert.equal(a.lines[0].label, 'Elf: bow');
});

test('a racial trait switched off on the sheet is not applied', () => {
  const sheet = {
    str: '10', dex: '10', 'race-group': 'elf', __classes: [{ group: 'warrior', level: '1' }],
    __traitState: { 'el-bow-bonus': { active: false } },
    __weapons: [{ id: 'w', basedOn: 'long-bow' }],
  };
  assert.equal(computeAttack({ sheet, weaponId: 'w', attackId: 'w:missile' }).thac0, 20);
});
