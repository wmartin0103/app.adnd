// ── ACCOUNT ─────────────────────────────────────────────────────
// A player's own account (name, email, password). Each call takes the Supabase
// client; the database's rules (supabase/migrations/) decide what's allowed,
// these only ask.

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
