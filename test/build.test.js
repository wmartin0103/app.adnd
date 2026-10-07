import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundle, RULES_FILES } from '../scripts/bundle.mjs';

test('the DM Helper carries the current converter (run scripts/build-legacy.mjs if this fails)', () => {
  const html = readFileSync('legacy/dm-helper.html', 'utf8');
  const expected = bundle(RULES_FILES, { expose: { SheetConverter: ['adapters/dm-helper', ['toDMHelper']] } });
  assert.ok(html.includes(expected), 'legacy/dm-helper.html is out of date');
});
