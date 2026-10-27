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
