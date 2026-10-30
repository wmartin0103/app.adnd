// ── CHARACTERS IN THE CLOUD ─────────────────────────────────────
// A player's characters, saved to their account: the list on the landing page
// ("Your characters": In play, Backups, Dead) and the sheet's own load and
// save. A character's data is exactly what the sheet saves and exports. Each
// call takes the Supabase client; the database's rules decide what's allowed.

export const STATUSES = ['play', 'backup', 'dead'];
export const STATUS_LABEL = { play: 'In play', backup: 'Backups', dead: 'Dead' };

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
    const g = await client.from('characters').select(COLS).in('id', ids);
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
  const st = status || (mine.some(c => c.status === 'play') ? 'backup' : 'play');
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
  return (m.data || []).map(r => ({ id: r.user_id, name: names[r.user_id] || 'Someone', role: r.role }))
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
}

// Moves a character; into play, the one in play now goes to `others` (dead
// or backup) first, as only one may be in play
export async function setStatus(client, mine, id, status, others = 'backup') {
  if (status === 'play') {
    const cur = mine.find(c => c.status === 'play' && c.id !== id);
    if (cur) {
      const r = await client.from('characters').update({ status: others }).eq('id', cur.id);
      if (r.error) throw r.error;
    }
  }
  const { error } = await client.from('characters').update({ status }).eq('id', id);
  if (error) throw error;
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
  const { data, error } = await client.from('characters').select('id, name, owner_id, status, data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveSheet(client, id, data) {
  const { error } = await client.from('characters').update({ data }).eq('id', id);
  if (error) throw error;
}
