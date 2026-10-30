import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summary, isBlank, fileName, listCharacters, createCharacter, setStatus, loadCharacter, saveSheet, deleteCharacter, isSheetSave, listParty, listMembers, createCharacterFor, assignCharacter } from '../src/characters.js';

// A stand-in for the Supabase client: the tables and calls used here, with
// the database's one-in-play rule
function fakeClient(tables) {
  const calls = [];
  let n = 0;
  const query = table => {
    const where = [];
    let op = 'select', payload = null, one = false;
    const run = () => {
      calls.push({ table, op, payload, where: where.slice() });
      const rows = tables[table] || (tables[table] = []);
      const hit = r => where.every(([c, v, inList]) => (inList ? v.includes(r[c]) : r[c] === v));
      const onePlay = () => {
        const play = (tables.characters || []).filter(r => r.status === 'play');
        return play.some((r, i) => play.findIndex(x => x.owner_id === r.owner_id && x.campaign_id === r.campaign_id) !== i);
      };
      if (op === 'insert') {
        const row = { id: `c${++n}`, updated_at: '2026-10-27', ...payload };
        rows.push(row);
        if (onePlay()) { rows.pop(); return { data: null, error: { message: 'one in play' } }; }
        return { data: one ? { id: row.id } : [row], error: null };
      }
      if (op === 'update') {
        const before = rows.map(r => ({ ...r }));
        const changed = rows.filter(hit); changed.forEach(r => Object.assign(r, payload));
        if (onePlay()) { tables[table] = before; return { data: null, error: { message: 'one in play' } }; }
        return { data: changed.map(r => ({ id: r.id })), error: null };
      }
      if (op === 'delete') {
        // the database's rule: never the one in play
        const gone = rows.filter(r => hit(r) && r.status !== 'play');
        tables[table] = rows.filter(r => !gone.includes(r));
        return { data: gone.map(r => ({ id: r.id })), error: null };
      }
      const found = rows.filter(hit);
      return { data: one ? found[0] || null : found, error: null };
    };
    const b = {
      select() { return b; }, eq(c, v) { where.push([c, v]); return b; }, in(c, v) { where.push([c, v, true]); return b; },
      single() { one = true; return b; }, maybeSingle() { one = true; return b; },
      insert(p) { op = 'insert'; payload = p; return b; }, update(p) { op = 'update'; payload = p; return b; }, delete() { op = 'delete'; return b; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    return b;
  };
  return { calls, from: query };
}
const me = { user: { id: 'u-me' }, campaignId: 'k' };
const sheet = (name, extra = {}) => ({ name, 'race-group': 'elf', __classes: [{ name: 'Blade Bard', level: '5' }], ...extra });

test('characters: what a card says about a sheet', () => {
  assert.equal(summary(sheet('Jaque')), 'Elf · Blade Bard 5');
  assert.equal(summary({ name: 'X', 'race-group': 'human', __classes: [{ name: 'Fighter', level: '3' }, { name: 'Thief', level: '4' }] }), 'Human · Fighter 3 / Thief 4');
  assert.equal(summary({ name: 'Stub' }), '');
  assert.equal(isBlank({ name: 'Stub' }), true);
  assert.equal(isBlank(sheet('Jaque')), false);
  assert.equal(fileName({ name: 'Old Corvin' }, new Date(2026, 9, 7)), 'old-corvin_10-07.json');
});

test('characters: yours, newest first, and the ones given to you', async () => {
  const t = {
    characters: [
      { id: 'a', campaign_id: 'k', owner_id: 'u-me', name: 'Old', status: 'dead', data: sheet('Old'), updated_at: '2026-01-01' },
      { id: 'b', campaign_id: 'k', owner_id: 'u-me', name: 'New', status: 'play', data: sheet('New'), updated_at: '2026-10-01' },
      { id: 'c', campaign_id: 'k', owner_id: 'u-ann', name: 'Edda', status: 'play', data: sheet('Edda'), updated_at: '2026-10-02' },
      { id: 'd', campaign_id: 'k', owner_id: 'u-ann', name: 'Hidden', status: 'backup', data: sheet('Hidden'), updated_at: '2026-10-03' },
    ],
    character_editors: [{ character_id: 'c', user_id: 'u-me' }],
    profiles: [{ id: 'u-ann', display_name: 'Ann' }],
  };
  const l = await listCharacters(fakeClient(t), me);
  assert.deepEqual(l.mine.map(c => [c.name, c.status]), [['New', 'play'], ['Old', 'dead']]);
  assert.deepEqual(l.given.map(c => [c.name, c.ownerName]), [['Edda', 'Ann']]);
  assert.deepEqual(await listCharacters(fakeClient(t), { user: { id: 'x' }, campaignId: null }), { mine: [], given: [] });
});

test('characters: a new one is in play if you have none, else a backup', async () => {
  const t = { characters: [] }, c = fakeClient(t);
  const first = await createCharacter(c, me, sheet('Brannoc'), { mine: [] });
  assert.equal(first.status, 'play');
  assert.equal(t.characters[0].name, 'Brannoc');
  const second = await createCharacter(c, me, null, { mine: [{ status: 'play' }] });
  assert.equal(second.status, 'backup');
  assert.equal(t.characters[1].name, 'New character');
});

test('characters: into play, the one in play moves first (one each)', async () => {
  const t = { characters: [
    { id: 'a', campaign_id: 'k', owner_id: 'u-me', status: 'play' },
    { id: 'b', campaign_id: 'k', owner_id: 'u-me', status: 'backup' },
  ] };
  const c = fakeClient(t), mine = t.characters.map(r => ({ ...r }));
  await setStatus(c, mine, 'b', 'play', 'dead');
  assert.deepEqual(t.characters.map(r => r.status), ['dead', 'play']);
  await setStatus(c, t.characters.map(r => ({ ...r })), 'b', 'backup');
  assert.deepEqual(t.characters.map(r => r.status), ['dead', 'backup']);
});

test('characters: the sheet loads and saves one character', async () => {
  const t = { characters: [{ id: 'a', campaign_id: 'k', owner_id: 'u-me', name: 'Jaque', status: 'play', data: sheet('Jaque') }] };
  const c = fakeClient(t);
  assert.equal((await loadCharacter(c, 'a')).data.name, 'Jaque');
  await saveSheet(c, 'a', sheet('Jaque', { 'hp-current': '12' }));
  assert.equal(t.characters[0].data['hp-current'], '12');
  assert.equal(await loadCharacter(c, 'zzz'), null);
});

test('characters: delete a backup or a dead one; the one in play stays', async () => {
  const t = { characters: [
    { id: 'a', campaign_id: 'k', owner_id: 'u-me', status: 'play' },
    { id: 'b', campaign_id: 'k', owner_id: 'u-me', status: 'dead' },
  ] };
  const c = fakeClient(t);
  await deleteCharacter(c, 'b');
  assert.deepEqual(t.characters.map(r => r.id), ['a']);
  await assert.rejects(deleteCharacter(c, 'a'), /couldn.t be deleted/);
  assert.deepEqual(t.characters.map(r => r.id), ['a']);
});

test("characters: the DM Helper's party is each player's one in play", async () => {
  const t = { characters: [
    { id: 'a', campaign_id: 'k', owner_id: 'u1', name: 'Rifiyr', status: 'play', data: sheet('Rifiyr') },
    { id: 'b', campaign_id: 'k', owner_id: 'u2', name: 'Jaque', status: 'play', data: sheet('Jaque') },
    { id: 'c', campaign_id: 'k', owner_id: 'u2', name: 'Tig', status: 'backup', data: sheet('Tig') },
    { id: 'd', campaign_id: 'other', owner_id: 'u3', name: 'Nebish', status: 'play', data: sheet('Nebish') },
  ] };
  assert.deepEqual((await listParty(fakeClient(t), 'k')).map(p => p.name), ['Jaque', 'Rifiyr']);
  assert.deepEqual(await listParty(fakeClient(t), null), []);
});

test("characters: the campaign's members by name, and the DM giving one a backup", async () => {
  const t = {
    campaign_members: [{ campaign_id: 'k', user_id: 'u2', role: 'player' }, { campaign_id: 'k', user_id: 'u1', role: 'dm' }],
    profiles: [{ id: 'u1', display_name: 'Will' }, { id: 'u2', display_name: 'Alex' }],
    characters: [{ id: 'a', campaign_id: 'k', owner_id: 'u2', name: 'Jaque', status: 'play' }],
  };
  const c = fakeClient(t);
  assert.deepEqual(await listMembers(c, 'k'), [{ id: 'u2', name: 'Alex', role: 'player', plays: true }, { id: 'u1', name: 'Will', role: 'dm', plays: false }]);
  const r = await createCharacterFor(c, { campaignId: 'k', user: { id: 'u1' } }, 'u2', sheet('Tig'));
  assert.equal(r.status, 'backup');
  const row = t.characters.find(x => x.id === r.id);
  assert.deepEqual([row.owner_id, row.name, row.status], ['u2', 'Tig', 'backup']);
  assert.equal(t.characters.find(x => x.id === 'a').status, 'play');   // their one in play stays
});

test('characters: a sheet save has a name and its classes', () => {
  assert.equal(isSheetSave(sheet('Jaque')), true);
  assert.equal(isSheetSave({ name: 'Jaque' }), false);
  assert.equal(isSheetSave({ __classes: [] }), false);
  assert.equal(isSheetSave(null), false);
});

test('characters: the DM assigns a backup to a player (it lands in their Backups)', async () => {
  const t = { characters: [
    { id: 'n', campaign_id: 'k', owner_id: 'u-dm', name: 'Nebish', status: 'backup' },
    { id: 'j', campaign_id: 'k', owner_id: 'u2', name: 'Jaque', status: 'play' },
  ] };
  const c = fakeClient(t);
  await assignCharacter(c, 'n', 'u2');
  assert.deepEqual([t.characters[0].owner_id, t.characters[0].status], ['u2', 'backup']);
  assert.equal(t.characters[1].status, 'play');   // their one in play stays
  await assert.rejects(assignCharacter(c, 'nope', 'u2'), /couldn.t be assigned/);
});
