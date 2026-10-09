import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSite } from '../scripts/build-site.mjs';
import { CATALOG_TAG } from '../scripts/build-legacy.mjs';

test('the website holds only the landing page, the two tools and the catalog', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'site-'));
  try {
    buildSite(out);
    const files = readdirSync(out, { recursive: true, withFileTypes: true })
      .filter(f => f.isFile()).map(f => path.relative(out, path.join(f.parentPath ?? f.path, f.name)).replace(/\\/g, '/')).sort();
    assert.deepEqual(files, ['data/spell-catalog.js', 'index.html', 'legacy/character-sheet.html', 'legacy/dm-helper.html']);
    // The tools find the catalog where it's published
    for (const tool of ['legacy/character-sheet.html', 'legacy/dm-helper.html']) {
      assert.ok(readFileSync(path.join(out, tool), 'utf8').includes(CATALOG_TAG));
    }
    const landing = readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.ok(landing.includes('href="legacy/character-sheet.html"') && landing.includes('href="legacy/dm-helper.html"'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
