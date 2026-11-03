import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findSpell } from '../src/rules/spells.js';

const catalog = JSON.parse(readFileSync(new URL('../data/spell-catalog.json', import.meta.url)));

test('spell catalog: a label after a name takes one form, and the old form still finds the spell', () => {
  assert.deepEqual(catalog.spells.filter(s => /[–—]/.test(s.name) || /\S- /.test(s.name)).map(s => s.name), []);
  assert.equal(findSpell(catalog, { name: 'Alter Instrument — Bard', type: 'wizard' }, 'wizard').name, 'Alter Instrument - Bard');
  assert.equal(findSpell(catalog, { name: "Talon's Waterproof- Bard", type: 'wizard' }, 'wizard').name, "Talon's Waterproof - Bard");
  assert.equal(new Set(catalog.spells.map(s => s.id)).size, catalog.spells.length);
});
