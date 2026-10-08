import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TARGETS, bundleFor } from '../scripts/build-legacy.mjs';

for (const file of Object.keys(TARGETS)) {
  test(`${file} carries the current rules code (run scripts/build-legacy.mjs if this fails)`, () => {
    assert.ok(readFileSync(file, 'utf8').includes(bundleFor(file)), `${file} is out of date`);
  });
}
