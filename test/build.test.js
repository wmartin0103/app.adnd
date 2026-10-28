import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TARGETS, bundleFor, catalogScript, CATALOG_JS, CATALOG_TAG, PAGES, bundleForPage, headBlock } from '../scripts/build-legacy.mjs';

for (const file of [...Object.keys(TARGETS), ...Object.keys(PAGES)]) {
  test(`${file} carries the current design tokens (run scripts/build-legacy.mjs if this fails)`, () => {
    const lf = t => t.replace(/\r\n/g, '\n');
    const html = lf(readFileSync(file, 'utf8'));
    assert.ok(html.includes(lf(headBlock())), `${file}'s tokens are out of date`);
    assert.ok(html.indexOf(headBlock()) < html.indexOf('</head>'), `${file}: tokens belong in <head>`);
  });
}

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

// Every name a page or tool hands out must exist in the bundle (an
// `export async function` once went missing and the Account page broke)
test('every exposed name is exported by its module', () => {
  const pages = [...Object.keys(TARGETS).map(f => [f, TARGETS[f], bundleFor(f)]), ...Object.keys(PAGES).map(f => [f, PAGES[f], bundleForPage(f)])];
  for (const [file, expose, code] of pages) {
    for (const [mod, names] of Object.values(expose)) {
      const block = code.split(`__m[${JSON.stringify(mod)}] = (() => {`)[1] || '';
      const ret = (block.match(/\nreturn \{ ([^}]*) \};\n\}\)\(\);/) || [])[1] || '';
      const have = ret.split(',').map(s => s.trim());
      for (const n of names) assert.ok(have.includes(n), `${file}: ${mod}.${n} isn't exported in the bundle`);
    }
  }
});
