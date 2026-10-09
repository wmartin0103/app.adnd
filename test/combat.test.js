import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { baseTHAC0, weaponModes, attackFor, attackRate, acChange } from '../src/rules/combat.js';

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

test('modifiers: always, per attack, whole round, scoped', () => {
  const sheet = {
    __classes: [{ group: 'rogue', level: '5' }],
    __combatModifiers: [
      { id: 'm1', label: 'Bladesong: +1 hit', hit: '1', appliesTo: 'all', use: 'round' },
      { id: 'm2', label: 'Trick Throw (called shot)', hit: '-2', appliesTo: 'ranged', use: 'attack' },
      { id: 'm3', label: 'Off-hand (Handle Weapons)', hit: '-2', appliesTo: 'offhand', use: 'always' },
      { id: 'm4', label: 'vs small', hit: '2', dmg: '2', appliesTo: 'weapon', weaponId: 'w2', use: 'attack' },
      { id: 'm5', label: 'Defensive Spin', ac: '-3', appliesTo: 'all', use: 'round' },
    ],
  };
  const w1 = { id: 'w1', name: 'Superior Dagger', basedOn: 'dagger', hitAdj: '+5', dmgAdj: '+3', dmgSM: '1d4', dmgL: '1d4', rates: { melee: '3/2', thrown: '3/1' } };
  const w2 = { id: 'w2', name: 'Wave Dagger', basedOn: 'dagger', hitAdj: '+4', dmgAdj: '+2', dmgSM: '1d4', dmgL: '1d4' };
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'thrown' }).thac0, 13);
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'thrown', stances: ['m1'] }).thac0, 12);
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'thrown', picked: ['m2'] }).thac0, 15);
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'melee', picked: ['m2'] }).thac0, 13);   // Trick Throw is ranged only
  const off = attackFor({ sheet, weapon: w1, mode: 'melee', offHand: true });
  assert.deepEqual([off.thac0, off.rate], [15, '1']);
  const wave = attackFor({ sheet, weapon: w2, mode: 'melee', picked: ['m4'] });
  assert.deepEqual([wave.thac0, wave.damage.sm], [12, '1d4+4']);
  assert.equal(attackFor({ sheet, weapon: w1, mode: 'melee', picked: ['m4'] }).thac0, 13);    // only on Wave Dagger
  assert.equal(attackRate(w1, 'melee'), '3/2');
  assert.equal(attackRate(w2, 'thrown'), '2/1');   // PHB dagger rate of fire
  assert.equal(acChange(sheet, ['m5']), -3);
});

test('a bonus not revealed yet shows as "+ ?"', () => {
  const sheet = { __classes: [{ group: 'rogue', level: '5' }] };
  const w = { id: 'w', name: 'Leprechaun Dagger', hitAdj: '+5', dmgAdj: '+2', dmgSM: '1d4', dmgL: '1d4', unrevealed: true };
  assert.equal(attackFor({ sheet, weapon: w, mode: 'melee' }).damage.sm, '1d4+2 + ?');
});

test('Jaque on the totals model matches the numbers confirmed with his player', () => {
  const j = load('jaque_10-09.json');
  const at = (name, mode, opts = {}) => attackFor({ sheet: j, weapon: row(j, name), mode, ...opts });
  assert.deepEqual([at('Superior Dagger', 'thrown').thac0, at('Superior Dagger', 'thrown').damage.sm, at('Superior Dagger', 'thrown').rate], [13, '1d4+3', '3/1']);
  assert.deepEqual([at('Superior Dagger', 'melee').thac0, at('Superior Dagger', 'melee').rate], [13, '3/2']);
  assert.equal(at('Leprechaun Dagger', 'melee').damage.sm, '1d4+2 + ?');
  assert.deepEqual([at('Wave Dagger', 'melee').thac0, at('Dagger x6', 'thrown').damage.sm], [14, '1d4+2']);
  assert.equal(at('Wave Dagger', 'melee', { picked: ['mod-7'] }).thac0, 12);
  assert.equal(at('Superior Dagger', 'melee', { offHand: true }).thac0, 15);
  assert.equal(at('Superior Dagger', 'thrown', { stances: ['mod-1'] }).thac0, 12);
  assert.equal(at('Superior Dagger', 'melee', { picked: ['mod-4'] }).damage.sm, '1d4+4');
  assert.equal(acChange(j, ['mod-8', 'mod-2']), -4);
  // The parts are listed and add up to the row's total
  const sup = at('Superior Dagger', 'thrown');
  assert.deepEqual(sup.lines.map(l => [l.label, l.hit, l.dmg]), [['Weapon', 1, 1], ['Ability score', 3, 0], ['Proficiency', 1, 2]]);
  for (const w of j.__weapons) {
    const sum = o => Object.values(o).reduce((t, v) => t + (parseInt(v, 10) || 0), 0);
    assert.equal(sum(w.hitParts), parseInt(w.hitAdj, 10), w.name);
    assert.equal(sum(w.dmgParts), parseInt(w.dmgAdj, 10), w.name);
  }
});
