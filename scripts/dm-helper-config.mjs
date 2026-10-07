// Usage: node scripts/dm-helper-config.mjs <save.json> [more saves…]
// Prints DM Helper config blocks generated from character sheet saves.
import { readFileSync } from 'node:fs';
import { toDMHelper, formatDMHelperConfig } from '../src/adapters/dm-helper.js';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/dm-helper-config.mjs <save.json> [more saves…]');
  process.exit(1);
}
const list = files.map(f => toDMHelper(JSON.parse(readFileSync(f, 'utf8'))));
process.stdout.write(formatDMHelperConfig(list));
