import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { baseTHAC0, weaponModes, attackFor, attackRate } from '../src/rules/combat.js';

const load = f => JSON.parse(readFileSync(new URL(`../samples/${f}`, import.meta.url)));
const row = (s, name) => s.__weapons.find(w => w.name === name);

test('base THAC0 is the best of the classes', () => {
  assert.equal(baseTHAC0(load('nandun.json')).thac0, 18);      // barbarian 3 / ranger 3
  assert.equal(baseTHAC0(load('atteroak.json')).thac0, 18);    // cleric 4
  assert.equal(baseTHAC0(load('tig.json')).thac0, 18);         // bard 5 (18) beats paladin 2 (19)
});

test('converted saves: the row is the total, nothing added twice', () => {
  const n = load('nandun.json');
  const club = attackFor({ sheet: n, weapon: row(n, 'Club'), mode: 'melee' });
  assert.deepEqual([club.thac0, club.damage.sm, club.damage.l], [15, '1d6+6', '1d3+6']);
  const a = load('atteroak.json');
  const dagger = attackFor({ sheet: a, weapon: row(a, 'Dagger'), mode: 'melee' });
  assert.equal(dagger.thac0, 21);   // 18, row says −3 (not proficient)
});

test('modes come from the row\'s notes or name when it has no setting', () => {
  const a = load('atteroak.json');
  assert.deepEqual(weaponModes(row(a, 'Dagger')), ['melee']);
  assert.deepEqual(weaponModes(row(a, 'Dagger, Thrown')), ['thrown']);
  assert.deepEqual(weaponModes(row(a, 'Sling, Bullets')), ['missile']);
  assert.deepEqual(weaponModes({ name: 'Superior Dagger', basedOn: 'dagger' }), ['melee', 'thrown']);
});

test('adjustments: for all attacks, for one attack, and the off-hand penalty', () => {
  const sheet = { __classes: [{ group: 'rogue', level: '5' }], __offHandPenalty: '-2' };
  const w1 = { id: 'w1', name: 'Superior Dagger', basedOn: 'dagger', hitAdj: '+5', dmgAdj: '+3', dmgSM: '1d4', dmgL: '1d4', rates: { melee: '3/2', thrown: '3/1' } };
  const w2 = { id: 'w2', name: 'Wave Dagger', basedOn: 'dagger', hitAdj: '+4', dmgAdj: '+2', dmgSM: '1d4', dmgL: '1d4' };
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'thrown' }).thac0, 13);
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'thrown', allAdjust: { hit: 1 } }).thac0, 12);              // Bladesong +1 hit
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'thrown', adjust: { hit: -2 } }).thac0, 15);                // Trick Throw
  const wave = attackFor({ sheet, weapon: w2, mode: 'melee', adjust: { hit: 2, dmg: 2 }, situation: ['flanking'] });
  assert.deepEqual([wave.thac0, wave.damage.sm], [10, '1d4+4']);                                               // vs small, flanked
  const off = attackFor({ sheet, weapon: w1, mode: 'melee', offHand: true });
  assert.deepEqual([off.thac0, off.rate], [15, '1']);
  assert.equal(attackRate(w1, 'melee'), '3/2');
  assert.equal(attackRate(w2, 'thrown'), '2/1');   // PHB dagger rate of fire
});

test('a bonus not revealed yet shows as "+ ?"', () => {
  const sheet = { __classes: [{ group: 'rogue', level: '5' }] };
  const w = { id: 'w', name: 'Leprechaun Dagger', hitAdj: '+5', dmgAdj: '+2', dmgSM: '1d4', dmgL: '1d4', unrevealed: true };
  assert.equal(attackFor({ sheet, weapon: w, mode: 'melee' }).damage.sm, '1d4+2 + ?');
});

