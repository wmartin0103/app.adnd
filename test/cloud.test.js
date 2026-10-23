import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloudRoundSync } from '../src/cloud.js';

// A stand-in for the Supabase client: tables in memory, the calls the round
// sync makes, and realtime that reaches every sync on the same "database"
function fakeDB() {
  const tables = { round_state: [], round_records: [], characters: [] };
  const subs = [];
  const keyOf = { round_state: 'campaign_id', round_records: 'character_id', characters: 'id' };
  let n = 0;
  const query = table => {
    const where = [];
    let op = 'select', payload = null, one = false, maybe = false;
    const run = () => {
      const rows = tables[table];
      if (op === 'insert') {
        const row = { id: `c${++n}`, ...payload };
        rows.push(row);
        return { data: one ? row : [row], error: null };
      }
      if (op === 'delete') {
        tables[table] = rows.filter(r => !where.every(([c, v]) => r[c] === v));
        return { data: null, error: null };
      }
      if (op === 'upsert') {
        const k = keyOf[table], at = rows.findIndex(r => r[k] === payload[k]);
        if (at >= 0) rows[at] = { ...rows[at], ...payload }; else rows.push({ ...payload });
        subs.forEach(s => s.table === table && s.fn({ new: { ...payload } }));
        return { data: null, error: null };
      }
      const found = rows.filter(r => where.every(([c, v]) => r[c] === v));
      return { data: maybe ? found[0] || null : one ? found[0] : found, error: null };
    };
    const b = {
      select() { return b; }, eq(c, v) { where.push([c, v]); return b; }, limit() { return b; },
      maybeSingle() { maybe = true; return b; }, single() { one = true; return b; },
      insert(p) { op = 'insert'; payload = p; return b; }, delete() { op = 'delete'; return b; }, upsert(p) { op = 'upsert'; payload = p; return b; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    return b;
  };
  const client = () => ({
    from: query,
    channel() {
      const ch = { on(_e, f, fn) { subs.push({ table: f.table, fn }); return ch; }, subscribe() { return ch; } };
      return ch;
    },
    removeChannel() {},
  });
  return { tables, client };
}
const settle = () => new Promise(r => setTimeout(r, 10));

test('cloud round: the DM runs the round, a sheet sends its record, both hear it', async () => {
  const db = fakeDB();
  const dm = createCloudRoundSync({ client: db.client(), campaignId: 'camp', userId: 'dm' });
  const sheet = createCloudRoundSync({ client: db.client(), campaignId: 'camp', userId: 'dm' });
  dm.sendDM({});                                  // on load: before the first load finishes
  await settle();
  assert.equal(db.tables.round_state[0].round, 1);
  dm.sendDM({ round: 3, foes: [{ id: 'BD1', label: 'BD1', size: 'sm' }] });
  await settle();
  assert.equal(sheet.state().round, 3);
  assert.deepEqual(sheet.state().foes.map(f => f.id), ['BD1']);
  // The sheet's record: its character is made in the campaign, the DM sees the record
  let heard = null;
  dm.onChange(s => { heard = s; });
  sheet.sendRecord({ character: 'Rifiyr', init: { roll: 7 }, view: { pending: true, initRoll: 7 } });
  assert.equal(sheet.state().records.Rifiyr.init.roll, 7);    // at once, here
  await settle();
  assert.equal(db.tables.characters[0].name, 'Rifiyr');
  assert.equal(heard.records.Rifiyr.view.initRoll, 7);
  // A new round: last round's records drop out
  dm.sendDM({ round: 4 });
  await settle();
  assert.deepEqual(sheet.state().records, {});
  // A page opening later sees the round as it is
  const late = createCloudRoundSync({ client: db.client(), campaignId: 'camp', userId: 'dm' });
  late.sendDM({});
  await settle();
  assert.equal(late.state().round, 4);
  // The DM resets: round 1, every record gone, here and on the sheet
  sheet.sendRecord({ character: 'Rifiyr', init: { roll: 3 } });
  await settle();
  dm.sendDM({ round: 1, reset: true });
  await settle();
  assert.deepEqual([db.tables.round_records.length, sheet.state().round, sheet.state().records], [0, 1, {}]);
});
