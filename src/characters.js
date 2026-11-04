// ── CHARACTERS IN THE CLOUD ─────────────────────────────────────
// A player's characters, saved to their account: the list on the landing page
// ("Your characters": In play, Backups, Dead) and the sheet's own load and
// save. A character's data is exactly what the sheet saves and exports. Each
// call takes the Supabase client; the database's rules decide what's allowed.

// unassigned: made by the DM, not given to a player yet (the DM's Backups)
export const STATUSES = ['play', 'backup', 'dead', 'unassigned'];
export const STATUS_LABEL = { play: 'In play', backup: 'Backups', dead: 'Dead', unassigned: 'Backups' };

const RACES = { human: 'Human', dwarf: 'Dwarf', gnome: 'Gnome', halfling: 'Halfling', 'half-elf': 'Half-Elf', elf: 'Elf', 'half-orc': 'Half-Orc' };
// "Elf · Blade Bard 5", from a sheet's data ('' when there's nothing yet)
export function summary(data) {
  if (!data) return '';
  const race = RACES[data['race-group']] || '';
  const classes = (Array.isArray(data.__classes) ? data.__classes : [])
    .filter(c => c && c.name).map(c => `${c.name}${c.level ? ` ${c.level}` : ''}`).join(' / ');
  return [isBlank(data) ? '' : race, classes].filter(Boolean).join(' · ');
}
// A row made before its sheet was saved (by add-player.sql, or a round sent
// from a sheet that wasn't saved yet): only a name
export const isBlank = data => !data || Object.keys(data).every(k => k === 'name');

// The minimum before a sheet can go into play (decided 2026-11-04): a name, a
// class with a level, and all six ability scores. What's still missing, in words
// ([] when it's ready). Saving is never held up by this, only going into play.
const SCORES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export function missingForPlay(data) {
  const d = data || {}, out = [];
  if (!String(d.name || '').trim()) out.push('a name');
  const classes = Array.isArray(d.__classes) ? d.__classes : [];
  if (!classes.some(c => c && String(c.name || '').trim() && parseInt(c.level, 10) >= 1)) out.push('a class with a level');
  Object.keys(SCORES).forEach(k => { if (!(parseInt(d[k], 10) > 0)) out.push(SCORES[k]); });
  return out;
}
// "Strength, Wisdom and a class with a level"; all six scores read as one
export function missingText(items) {
  const scores = Object.values(SCORES), all = scores.every(s => items.includes(s));
  const parts = all ? [...items.filter(i => !scores.includes(i)), 'all six ability scores'] : items;
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// The file name the sheet exports: "jaque_10-26.json"
export function fileName(data, now = new Date()) {
  const name = String((data && data.name) || 'character').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'character';
  return `${name}_${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;
}

const COLS = 'id, name, owner_id, status, data, updated_at';
const card = (r, owners = {}) => ({
  id: r.id, name: r.name, ownerId: r.owner_id, ownerName: owners[r.owner_id] || '', status: r.status || 'backup',
  summary: summary(r.data), blank: isBlank(r.data), data: r.data, updatedAt: r.updated_at,
});
// Yours (newest save first), and the ones others have given you
export async function listCharacters(client, session) {
  if (!session || !session.campaignId) return { mine: [], given: [] };
  const me = session.user.id;
  const [own, eds] = await Promise.all([
    client.from('characters').select(COLS).eq('campaign_id', session.campaignId).eq('owner_id', me),
    client.from('character_editors').select('character_id').eq('user_id', me),
  ]);
  if (own.error) throw own.error;
  if (eds.error) throw eds.error;
  const ids = (eds.data || []).map(e => e.character_id);
  let given = [];
  if (ids.length) {
    const g = await client.from('characters').select(COLS).in('id', ids).eq('campaign_id', session.campaignId);
    if (g.error) throw g.error;
    const others = (g.data || []).filter(r => r.owner_id !== me);
    const owners = {};
    if (others.length) {
      const p = await client.from('profiles').select('id, display_name').in('id', [...new Set(others.map(r => r.owner_id))]);
      (p.data || []).forEach(x => { owners[x.id] = x.display_name; });
    }
    given = others.map(r => card(r, owners)).sort((a, b) => a.name.localeCompare(b.name));
  }
  const byNewest = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  return { mine: (own.data || []).map(r => card(r)).sort(byNewest), given };
}

// A new character in the campaign, yours; In play if you have none, else a backup
export async function createCharacter(client, session, data, { mine = [], status } = {}) {
  // Your first goes into play, once it has the minimum; until then, to Backups
  const st = status || (mine.some(c => c.status === 'play') || missingForPlay(data).length ? 'backup' : 'play');
  const name = String((data && data.name) || '').trim() || 'New character';
  const { data: row, error } = await client.from('characters')
    .insert({ campaign_id: session.campaignId, owner_id: session.user.id, name, data: data || { name: '' }, status: st })
    .select('id').single();
  if (error) throw error;
  return { id: row.id, status: st };
}

// A file the sheet exported: a name and its classes
export const isSheetSave = data => !!data && typeof data === 'object' && !!String(data.name || '').trim() && Array.isArray(data.__classes);

// The DM Helper's party: each player's character in play (the database keeps
// one per player), by name
export async function listParty(client, campaignId) {
  if (!campaignId) return [];
  const { data, error } = await client.from('characters').select('id, name, owner_id, data, updated_at')
    .eq('campaign_id', campaignId).eq('status', 'play');
  if (error) throw error;
  return (data || []).map(r => ({ id: r.id, name: r.name, ownerId: r.owner_id, data: r.data, updatedAt: r.updated_at }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Who's in the campaign, by name: for the DM giving a player a character
export async function listMembers(client, campaignId) {
  if (!campaignId) return [];
  const m = await client.from('campaign_members').select('user_id, role').eq('campaign_id', campaignId);
  if (m.error) throw m.error;
  const ids = (m.data || []).map(r => r.user_id);
  if (!ids.length) return [];
  const p = await client.from('profiles').select('id, display_name').in('id', ids);
  if (p.error) throw p.error;
  const names = {};
  (p.data || []).forEach(x => { names[x.id] = x.display_name; });
  return (m.data || []).map(r => ({ id: r.user_id, name: names[r.user_id] || 'Someone', role: r.role, plays: r.role === 'player' || r.role === 'both' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// The DM (or an admin) puts a sheet in a player's Backups; the database's
// rules allow it only for the campaign's DM or an admin
export async function createCharacterFor(client, session, ownerId, data) {
  const name = String((data && data.name) || '').trim() || 'New character';
  const { data: row, error } = await client.from('characters')
    .insert({ campaign_id: session.campaignId, owner_id: ownerId, name, data, status: 'backup' })
    .select('id').single();
  if (error) throw error;
  return { id: row.id, status: 'backup' };
}

// The DM gives one of their characters to a player: it becomes theirs, in
// their Backups (so it never clashes with the one they have in play)
export async function assignCharacter(client, id, ownerId) {
  const { data, error } = await client.from('characters').update({ owner_id: ownerId, status: 'backup' }).eq('id', id).select('id');
  if (error) throw error;
  if (!data || !data.length) throw new Error('That character couldn’t be assigned.');
  // Theirs now: they decide who else plays it
  const r = await client.from('character_editors').delete().eq('character_id', id);
  if (r.error) throw r.error;
}

// Who else can play each character: { characterId: [userId, …] }
export async function listShares(client, ids) {
  if (!ids.length) return {};
  const { data, error } = await client.from('character_editors').select('character_id, user_id').in('character_id', ids);
  if (error) throw error;
  const shares = {};
  (data || []).forEach(r => { (shares[r.character_id] = shares[r.character_id] || []).push(r.user_id); });
  return shares;
}
// Who else can play a character, from `before` to `after` (lists of user ids).
// The database's rules allow it for the owner, the DM or an admin; a removal
// they refuse removes nothing, so ask for the rows back to know it went.
export async function setShares(client, session, id, before, after) {
  const added = after.filter(u => !before.includes(u)), gone = before.filter(u => !after.includes(u));
  if (added.length) {
    const { error } = await client.from('character_editors').insert(added.map(u => ({ character_id: id, user_id: u, granted_by: session.user.id })));
    if (error) throw error;
  }
  if (gone.length) {
    const { data, error } = await client.from('character_editors').delete().eq('character_id', id).in('user_id', gone).select('user_id');
    if (error) throw error;
    if (!data || data.length !== gone.length) throw new Error('That access couldn’t be taken back.');
  }
}

// Moves a character; into play, the one in play now goes to `others` (dead
// or backup) first, as only one may be in play
export async function setStatus(client, mine, id, status, others = 'backup') {
  const row = status === 'play' ? mine.find(c => c.id === id) : null;
  const short = row && 'data' in row ? missingForPlay(row.data) : [];
  if (short.length) throw new Error(`To bring ${row.name || 'this character'} into play, add ${missingText(short)}.`);
  const cur = status === 'play' ? mine.find(c => c.status === 'play' && c.id !== id) : null;
  if (cur) {
    const r = await client.from('characters').update({ status: others }).eq('id', cur.id);
    if (r.error) throw r.error;
  }
  const { error } = await client.from('characters').update({ status }).eq('id', id);
  if (error) {
    // Refused (its name is taken, say): the one in play goes back, so nobody's left out
    if (cur) await client.from('characters').update({ status: 'play' }).eq('id', cur.id);
    throw error;
  }
}

// Deletes one of yours from Backups or Dead, for good (versions and all).
// The database's rules decide; a delete they refuse removes nothing, so ask
// for the row back to know it went.
export async function deleteCharacter(client, id) {
  const { data, error } = await client.from('characters').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || !data.length) throw new Error('That character couldn’t be deleted.');
}

// The sheet: one character's saved data, and saving it
export async function loadCharacter(client, id) {
  const { data, error } = await client.from('characters').select('id, campaign_id, name, owner_id, status, data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
// A save the database's rules refuse changes nothing and says nothing, so ask for
// the row back to know it went
export async function saveSheet(client, id, data) {
  const { data: rows, error } = await client.from('characters').update({ data }).eq('id', id).select('id');
  if (error) throw error;
  if (!rows || !rows.length) throw new Error('That character couldn’t be saved.');
}
// The database refused because another character in play has this name
// (supabase/migrations/20261104120000_one_name_in_play.sql)
export const isNameTaken = e => !!e && /characters_name_in_play/.test(`${e.message || ''} ${e.details || ''}`);
// The campaign's characters, for spotting a name already in use
export async function campaignNames(client, campaignId) {
  if (!campaignId) return [];
  const { data, error } = await client.from('characters').select('id, name').eq('campaign_id', campaignId);
  if (error) throw error;
  return data || [];
}
