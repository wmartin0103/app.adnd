import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TARGETS, bundleFor, catalogScript, CATALOG_JS, CATALOG_TAG, PAGES, bundleForPage } from '../scripts/build-legacy.mjs';

for (const file of Object.keys(PAGES)) {
  test(`${file} carries the current sign-in code (run scripts/build-legacy.mjs if this fails)`, () => {
    const lf = t => t.replace(/\r\n/g, '\n');
    assert.ok(lf(readFileSync(file, 'utf8')).includes(lf(bundleForPage(file))), `${file} is out of date`);
  });
}

for (const file of Object.keys(TARGETS)) {
  test(`${file} carries the current rules code (run scripts/build-legacy.mjs if this fails)`, () => {
    // Line endings aside: an editor on Windows may save the page with CRLF
    const lf = t => t.replace(/\r\n/g, '\n');
    assert.ok(lf(readFileSync(file, 'utf8')).includes(lf(bundleFor(file))), `${file} is out of date`);
  });
}

test('the shared spell catalog file is current, and both tools load it', () => {
  assert.equal(readFileSync(CATALOG_JS, 'utf8'), catalogScript(), `${CATALOG_JS} is out of date`);
  for (const file of Object.keys(TARGETS)) {
    const html = readFileSync(file, 'utf8');
    assert.ok(html.includes(CATALOG_TAG), `${file} doesn't load the catalog`);
    assert.ok(!html.includes('window.SheetSpellCatalog = {'), `${file} still has its own copy of the catalog`);
  }
});
