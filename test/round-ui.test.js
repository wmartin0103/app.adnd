import { test } from 'node:test';
import assert from 'node:assert/strict';

// The round's shared look (src/ui/round-ui.js) loads, and its styles and icons are there
test('round-ui: the module loads with its styles and icons', async () => {
  const m = await import('../src/ui/round-ui.js');
  assert.equal(typeof m.STYLES, 'string');
  assert.ok(m.STYLES.includes('.hit-roll'));
  for (const k of ['D20_SVG', 'ROLL_ICON', 'DUPLICATE_ICON']) assert.match(m[k], /^<svg /);
});
