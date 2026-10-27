// Builds the website into dist/: the landing page, the two tools and the
// shared spell catalog, laid out as the tools expect (they load
// ../data/spell-catalog.js). Nothing else from the repo is published, so
// character saves, docs and scripts stay off the web.
//
//   node scripts/build-site.mjs      (Cloudflare Pages: build command "npm run build", output "dist")

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SITE_FILES = {
  'index.html': 'site/index.html',
  'account.html': 'site/account.html',
  'legacy/character-sheet.html': 'legacy/character-sheet.html',
  'legacy/dm-helper.html': 'legacy/dm-helper.html',
  'data/spell-catalog.js': 'data/spell-catalog.js',
};

export function buildSite(out = 'dist') {
  rmSync(out, { recursive: true, force: true });
  for (const [to, from] of Object.entries(SITE_FILES)) {
    mkdirSync(`${out}/${to}`.replace(/\/[^/]+$/, ''), { recursive: true });
    cpSync(from, `${out}/${to}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSite();
  console.log(`Built dist/: ${Object.keys(SITE_FILES).join(', ')}`);
}
