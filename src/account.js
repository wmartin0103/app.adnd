// ── ACCOUNT ─────────────────────────────────────────────────────
// A player's own account (name, email, password) and who else may play their
// characters. Each call takes the Supabase client; the database's rules
// (supabase/migrations/) decide what's allowed, these only ask.

export const MIN_PASSWORD = 8;
// What's wrong with a new password, or '' when it will do
export function passwordProblem(pw, again) {
  if (!pw || pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw !== again) return 'The two passwords don’t match.';
  return '';
}
// The new password, which also ends a temporary one (supabase/add-player.sql)
export async function setPassword(client, pw) {
  const { error } = await client.auth.updateUser({ password: pw, data: { temp_password: false } });
  if (error) throw error;
}
// With "Confirm email" off in the project, the change is immediate; with it
// on, it waits for the confirmation link (changed: false)
export async function setEmail(client, email) {
  const { data, error } = await client.auth.updateUser({ email });
  if (error) throw error;
  const now = data && data.user && data.user.email;
  return { changed: !!now && now.toLowerCase() === email.toLowerCase() };
}
export async function setDisplayName(client, userId, name) {
  const { error } = await client.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) throw error;
}

// The campaign's characters and who may play them, for the session's person:
//   { members: [{ userId, name, role }],
//     characters: [{ id, name, ownerId, ownerName, mine, canManage, editors: [{ userId, name }] }],
//     grantedToMe: [{ id, name, ownerName }] }
// canManage: the owner, the DM or an admin, who grant and take away access.
export async function characterAccess(client, session) {
  if (!session || !session.campaignId) return { members: [], characters: [], grantedToMe: [] };
  const me = session.user.id;
  const [chars, mems, eds] = await Promise.all([
    client.from('characters').select('id, name, owner_id').eq('campaign_id', session.campaignId),
    client.from('campaign_members').select('user_id, role, profiles(display_name)').eq('campaign_id', session.campaignId),
    client.from('character_editors').select('character_id, user_id'),
  ]);
  const failed = [chars, mems, eds].find(r => r.error);
  if (failed) throw failed.error;
  const members = (mems.data || []).map(m => ({ userId: m.user_id, role: m.role, name: (m.profiles && m.profiles.display_name) || 'Someone' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const nameOf = id => (members.find(m => m.userId === id) || {}).name || 'Someone';
  const manager = session.role === 'dm' || session.isAdmin;
  const all = (chars.data || []).map(c => ({
    id: c.id, name: c.name, ownerId: c.owner_id, ownerName: nameOf(c.owner_id), mine: c.owner_id === me,
    canManage: c.owner_id === me || manager,
    editors: (eds.data || []).filter(e => e.character_id === c.id).map(e => ({ userId: e.user_id, name: nameOf(e.user_id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).sort((a, b) => (b.mine - a.mine) || a.name.localeCompare(b.name));
  return {
    members,
    characters: all.filter(c => c.canManage),
    grantedToMe: all.filter(c => !c.mine && c.editors.some(e => e.userId === me)).map(c => ({ id: c.id, name: c.name, ownerName: c.ownerName })),
  };
}
// Lets someone in the campaign play (and later edit) a character, until taken away
export async function grantAccess(client, session, characterId, userId) {
  const { error } = await client.from('character_editors').insert({ character_id: characterId, user_id: userId, granted_by: session.user.id });
  if (error) throw error;
}
export async function revokeAccess(client, characterId, userId) {
  const { error } = await client.from('character_editors').delete().eq('character_id', characterId).eq('user_id', userId);
  if (error) throw error;
}
