// Builds the website into dist/: Home, Account, the two tools and the shared
// spell catalog. Each tool is its own folder's page, for short addresses
// (sheet/?id=…, dm/), one folder down so it still finds ../data/ and
// ../index.html. Nothing else from the repo is published, so character saves,
// docs and scripts stay off the web.
//
//   node scripts/build-site.mjs      (GitHub Pages: .github/workflows/pages.yml)

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SITE_FILES = {
  'index.html': 'site/index.html',
  'account.html': 'site/account.html',
  'sheet/index.html': 'tools/character-sheet.html',
  'dm/index.html': 'tools/dm-helper.html',
  'data/spell-catalog.js': 'data/spell-catalog.js',
};

// The tools' old addresses (before 2026-10-30): a page that sends links and
// bookmarks on to the new one, keeping ?id=… and the rest
export const MOVED = {
  'legacy/character-sheet.html': '../sheet/',
  'legacy/dm-helper.html': '../dm/',
};
export const movedPage = to => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Moved</title>
<script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=${to}">
</head><body><p>This page has moved: <a href="${to}">open it here</a>.</p></body></html>
`;

export function buildSite(out = 'dist') {
  rmSync(out, { recursive: true, force: true });
  const dirOf = p => `${out}/${p}`.replace(/\/[^/]+$/, '');
  for (const [to, from] of Object.entries(SITE_FILES)) {
    mkdirSync(dirOf(to), { recursive: true });
    cpSync(from, `${out}/${to}`);
  }
  for (const [from, to] of Object.entries(MOVED)) {
    mkdirSync(dirOf(from), { recursive: true });
    writeFileSync(`${out}/${from}`, movedPage(to));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSite();
  console.log(`Built dist/: ${[...Object.keys(SITE_FILES), ...Object.keys(MOVED)].join(', ')}`);
}
