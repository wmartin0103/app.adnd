import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSite, MOVED } from '../scripts/build-site.mjs';
import { CATALOG_TAG } from '../scripts/build-tools.mjs';

test('the website holds only Home, Account, the two tools, the catalog and the tools’ old addresses', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'site-'));
  try {
    buildSite(out);
    const files = readdirSync(out, { recursive: true, withFileTypes: true })
      .filter(f => f.isFile()).map(f => path.relative(out, path.join(f.parentPath ?? f.path, f.name)).replace(/\\/g, '/')).sort();
    assert.deepEqual(files, ['account.html', 'data/spell-catalog.js', 'dm/index.html', 'index.html', 'legacy/character-sheet.html', 'legacy/dm-helper.html', 'sheet/index.html']);
    // The tools find the catalog where it's published
    for (const tool of ['sheet/index.html', 'dm/index.html']) {
      assert.ok(readFileSync(path.join(out, tool), 'utf8').includes(CATALOG_TAG));
    }
    const landing = readFileSync(path.join(out, 'index.html'), 'utf8');
    // Home opens each one's sheet; the DM Helper for the DM
    assert.ok(landing.includes('`sheet/?id=') && landing.includes("'dm/'"));   // the DM's card goes there
    // Old links still arrive, with their ?id=…
    for (const [old, to] of Object.entries(MOVED)) {
      const page = readFileSync(path.join(out, old), 'utf8');
      assert.ok(page.includes(`location.replace(${JSON.stringify(to)} + location.search`));
    }
    // Account sits beside it: the landing page links to it, the tools reach it one folder up
    assert.ok(landing.includes('href="account.html"'));
    assert.ok(readFileSync(path.join(out, 'account.html'), 'utf8').includes('href="index.html"'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
