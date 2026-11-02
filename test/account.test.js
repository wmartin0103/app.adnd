import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, setPassword, setEmail, setDisplayName } from '../src/account.js';
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
