import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, setPassword, setEmail, setDisplayName, characterAccess, grantAccess, revokeAccess } from '../src/account.js';
import { needsNewPassword } from '../src/cloud.js';

// A stand-in for the Supabase client: the tables and calls the Account page uses
function fakeClient(tables, { confirmEmail = false } = {}) {
  const calls = [];
  const query = table => {
    const where = [];
    let op = 'select', payload = null;
    const run = () => {
      calls.push({ table, op, payload, where: where.slice() });
      const rows = tables[table] || (tables[table] = []);
      const hit = r => where.every(([c, v]) => r[c] === v);
      if (op === 'insert') { rows.push({ ...payload }); return { data: null, error: null }; }
      if (op === 'delete') { tables[table] = rows.filter(r => !hit(r)); return { data: null, error: null }; }
      if (op === 'update') { rows.filter(hit).forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
      // campaign_members embeds the member's profile
      const found = rows.filter(hit).map(r => (table === 'campaign_members'
        ? { ...r, profiles: (tables.profiles.find(p => p.id === r.user_id) || null) } : r));
      return { data: found, error: null };
    };
    const b = {
      select() { return b; }, eq(c, v) { where.push([c, v]); return b; },
      insert(p) { op = 'insert'; payload = p; return b; }, delete() { op = 'delete'; return b; }, update(p) { op = 'update'; payload = p; return b; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    return b;
  };
  const user = { id: 'u-me', email: 'me@example.com', user_metadata: { temp_password: true } };
  return {
    calls, user,
    from: query,
    auth: {
      async updateUser(p) {
        calls.push({ auth: p });
        if (p.data) user.user_metadata = { ...user.user_metadata, ...p.data };
        if (p.email && !confirmEmail) user.email = p.email.toLowerCase();
        return { data: { user: { ...user } }, error: null };
      },
    },
  };
}

test('account: a temporary password asks for a new one, which ends it', async () => {
  const c = fakeClient({});
  assert.equal(needsNewPassword(c.user), true);
  assert.equal(needsNewPassword({ user_metadata: {} }), false);
  assert.equal(needsNewPassword(null), false);
  assert.match(passwordProblem('short', 'short'), /at least 8/);
  assert.match(passwordProblem('long enough', 'long enougg'), /match/);
  assert.equal(passwordProblem('long enough', 'long enough'), '');
  await setPassword(c, 'long enough');
  assert.deepEqual(c.calls[0].auth, { password: 'long enough', data: { temp_password: false } });
  assert.equal(needsNewPassword(c.user), false);
});

test('account: email and name', async () => {
  const c = fakeClient({ profiles: [{ id: 'u-me', display_name: 'me' }] });
  assert.deepEqual(await setEmail(c, 'New@Example.com'), { changed: true });
  const waiting = fakeClient({}, { confirmEmail: true });
  assert.deepEqual(await setEmail(waiting, 'new@example.com'), { changed: false });   // the project asks for a confirmation link
  await setDisplayName(c, 'u-me', 'Bob');
  assert.equal(c.calls.find(x => x.op === 'update').payload.display_name, 'Bob');
});

const campaign = () => ({
  profiles: [{ id: 'u-me', display_name: 'Bob' }, { id: 'u-ann', display_name: 'Ann' }, { id: 'u-dm', display_name: 'Will' }],
  campaign_members: [{ campaign_id: 'k', user_id: 'u-me', role: 'player' }, { campaign_id: 'k', user_id: 'u-ann', role: 'player' }, { campaign_id: 'k', user_id: 'u-dm', role: 'dm' }],
  characters: [{ id: 'c-gor', campaign_id: 'k', name: 'Goroth', owner_id: 'u-me' }, { id: 'c-jaq', campaign_id: 'k', name: 'Jaque', owner_id: 'u-ann' }],
  character_editors: [{ character_id: 'c-jaq', user_id: 'u-me' }],
});

test('account: a player manages their own characters and sees what they were given', async () => {
  const t = campaign(), c = fakeClient(t);
  const me = { user: { id: 'u-me' }, campaignId: 'k', role: 'player', isAdmin: false };
  let a = await characterAccess(c, me);
  assert.deepEqual(a.characters.map(x => x.name), ['Goroth']);             // only their own
  assert.deepEqual(a.grantedToMe, [{ id: 'c-jaq', name: 'Jaque', ownerName: 'Ann' }]);
  assert.deepEqual(a.members.map(m => m.name), ['Ann', 'Bob', 'Will']);
  await grantAccess(c, me, 'c-gor', 'u-ann');
  assert.deepEqual(t.character_editors.at(-1), { character_id: 'c-gor', user_id: 'u-ann', granted_by: 'u-me' });
  a = await characterAccess(c, me);
  assert.deepEqual(a.characters[0].editors, [{ userId: 'u-ann', name: 'Ann' }]);
  await revokeAccess(c, 'c-gor', 'u-ann');
  a = await characterAccess(c, me);
  assert.deepEqual(a.characters[0].editors, []);
  assert.equal(c.calls.filter(x => x.table === 'character_editors' && x.op === 'delete').length, 1);
});

test('account: the DM manages every character in the campaign, theirs first', async () => {
  const t = campaign();
  t.characters.push({ id: 'c-dm', campaign_id: 'k', name: 'Tig', owner_id: 'u-dm' });
  const dm = { user: { id: 'u-dm' }, campaignId: 'k', role: 'dm', isDM: true, isAdmin: false };
  const a = await characterAccess(fakeClient(t), dm);
  assert.deepEqual(a.characters.map(x => [x.name, x.ownerName, x.mine]), [['Tig', 'Will', true], ['Goroth', 'Bob', false], ['Jaque', 'Ann', false]]);
  assert.deepEqual(await characterAccess(fakeClient(t), { user: { id: 'x' }, campaignId: null }), { members: [], characters: [], grantedToMe: [] });
});
