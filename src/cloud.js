// ── CLOUD (Supabase) ────────────────────────────────────────────
// Signing in, and the live round across devices. The database and its
// permission rules are in supabase/migrations/. The URL and publishable key
// below are public by design: the rules in the database decide what anyone
// can see or change. (The secret key never goes in the app.)
//
// The Supabase library comes from its CDN as window.supabase. Without it, or
// signed out, the tools work as before: the round syncs within one browser.

export const CLOUD_URL = 'https://fslhlebezckjzpycrava.supabase.co';
export const CLOUD_KEY = 'sb_publishable_qDPlezMIAsuQYfFuNDMcwg_f9iMsXA0';

let clientCache = null;
export function cloudClient() {
  if (clientCache) return clientCache;
  try {
    const lib = globalThis.supabase;
    if (lib && lib.createClient) clientCache = lib.createClient(CLOUD_URL, CLOUD_KEY);
  } catch (e) { clientCache = null; }
  return clientCache;
}

// Who's signed in, and their campaign (the first one they're in, for now).
// Null when signed out or the cloud can't be reached.
export const cloudSession = async (client = cloudClient()) => {
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    const user = data && data.session && data.session.user;
    if (!user) return null;
    const [{ data: prof }, { data: rows }] = await Promise.all([
      client.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
      client.from('campaign_members').select('campaign_id, role, campaigns(name)').eq('user_id', user.id),
    ]);
    const m = (rows || [])[0] || null;
    return {
      user, name: (prof && prof.display_name) || user.email,
      campaignId: m ? m.campaign_id : null, campaignName: m && m.campaigns ? m.campaigns.name : '', role: m ? m.role : null,
    };
  } catch (e) { return null; }
};

// ── The live round through the database ──
// The same calls as createRoundSync (round-sync.js), so the sheet and the DM
// Helper don't care which one they have. The DM's side is one row per
// campaign (round_state); each character's round record is one row
// (round_records). A record from an earlier round is left out of the state.
// Changes show here at once and go to the database behind the scenes;
// everyone else hears about them through realtime.
export function createCloudRoundSync({ client, campaignId, userId }) {
  const listeners = [];
  let base = { round: 1, encounter: 1, foes: [], timing: 'end', dmAt: 0, at: 0 };
  let hasEncounter = false;   // the database has round_state.encounter (a migration)
  const rows = {};          // character name → { round, record }
  const ids = {};           // character name → character id
  const local = new Set();  // records written here before the first load
  const writes = {};        // character name → this page's saves, in order
  const state = () => {
    const records = {};
    Object.entries(rows).forEach(([name, r]) => { if (r.round === base.round) records[name] = { ...r.record, round: r.round }; });
    return { ...base, records };
  };
  const tell = () => { const s = state(); listeners.forEach(fn => { try { fn(s); } catch (e) { /* a listener's problem */ } }); };
  // Every round change reads the records again (a reset deletes them)
  const reload = () => client.from('round_records').select('*').eq('campaign_id', campaignId)
    .then(({ data }) => { Object.keys(rows).forEach(k => delete rows[k]); (data || []).forEach(fromRecord); tell(); }, () => {});
  const fromState = r => {
    if ('encounter' in r) hasEncounter = true;
    base = { round: r.round, encounter: r.encounter || 1, foes: r.foes || [], timing: r.timing || 'end', dmAt: Date.parse(r.updated_at) || Date.now(), at: Date.now() };
  };
  const fromRecord = r => {
    const name = r.record && r.record.character;
    if (!name) return;
    rows[name] = { round: r.round, record: r.record };
    ids[name] = r.character_id;
  };

  let dmChanges = null;     // the DM's changes made before the first load
  const ready = (async () => {
    const [{ data: st }, { data: recs }] = await Promise.all([
      client.from('round_state').select('*').eq('campaign_id', campaignId).maybeSingle(),
      client.from('round_records').select('*').eq('campaign_id', campaignId),
    ]);
    if (st) fromState(st);
    (recs || []).forEach(r => { if (!local.has(r.record && r.record.character)) fromRecord(r); });
    if (dmChanges) { applyDM(dmChanges); if (dmChanges.dm !== false) writeDM(); }
    tell();
  })().catch(() => {});

  const channel = client.channel(`round-${campaignId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'round_state', filter: `campaign_id=eq.${campaignId}` },
      p => { if (p.new && p.new.campaign_id) { const was = base.round; fromState(p.new); tell(); if (p.new.round !== was || p.new.round === 1) reload(); } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'round_records', filter: `campaign_id=eq.${campaignId}` },
      p => {
        if (!p.new || !p.new.record) return;
        // An echo older than this page's last save of that character: stale
        const w = writes[p.new.record.character];
        if (w && w.sentAt && p.new.updated_at && Date.parse(p.new.updated_at) < Date.parse(w.sentAt)) return;
        fromRecord(p.new); tell();
      })
    .subscribe();

  // The character's row in the campaign, found by name (made if it's new)
  async function characterId(name) {
    if (ids[name]) return ids[name];
    const { data } = await client.from('characters').select('id').eq('campaign_id', campaignId).eq('name', name).limit(1);
    if (data && data[0]) return (ids[name] = data[0].id);
    const { data: made, error } = await client.from('characters')
      .insert({ campaign_id: campaignId, owner_id: userId, name, data: { name } }).select('id').single();
    if (error) throw error;
    return (ids[name] = made.id);
  }
  function applyDM({ round, foes, timing, dm = true, reset = false, resetInit = false }) {
    if (reset || resetInit) base.encounter = (base.encounter || 1) + 1;
    if (reset) { base.round = round ?? 1; Object.keys(rows).forEach(k => delete rows[k]); }
    else if (round != null) base.round = round;
    if (foes) base.foes = foes;
    if (timing) base.timing = timing;
    if (dm) base.dmAt = Date.now();
  }
  const writeDM = () => client.from('round_state').upsert({
    campaign_id: campaignId, round: base.round, foes: base.foes, timing: base.timing, updated_at: new Date().toISOString(),
    ...(hasEncounter ? { encounter: base.encounter } : {}),
  }).then(() => {}, () => {});

  let loaded = false;
  ready.then(() => { loaded = true; });
  return {
    live: true,
    cloud: true,
    state,
    sendRecord(rec) {
      const round = base.round;
      rows[rec.character] = { round, record: { ...rec, round } };
      if (!loaded) local.add(rec.character);
      // One save at a time per character, always the latest: quick changes
      // can't land out of order and undo each other
      const name = rec.character;
      const w = writes[name] || (writes[name] = { chain: Promise.resolve(), next: null });
      w.next = { round, record: rows[name].record, at: new Date().toISOString() };
      w.sentAt = w.next.at;
      w.chain = w.chain.then(() => {
        const job = w.next;
        if (!job) return null;
        w.next = null;
        return ready.then(() => characterId(name))
          .then(id => client.from('round_records').upsert({ character_id: id, campaign_id: campaignId, round: job.round, record: job.record, updated_at: job.at }));
      }).then(() => {}, () => {});
      return state();
    },
    sendDM(change) {
      // Before the first load, the database's round wins and these apply on top
      if (!loaded) { dmChanges = { ...(dmChanges || {}), ...change }; applyDM(change); return state(); }
      applyDM(change);
      // A reset deletes the campaign's records first, so pages that reload them find none
      if (change.reset) client.from('round_records').delete().eq('campaign_id', campaignId).then(writeDM, writeDM);
      else if (change.dm !== false) writeDM();
      return state();
    },
    onChange(fn) { listeners.push(fn); },
    close() { try { client.removeChannel(channel); } catch (e) { /* already gone */ } },
  };
}

// ── Sign in ──
// A small control for a tool's header: "Sign in" when signed out (opens a
// dialog: email and password; accounts are made by an admin), the name and
// campaign with "Sign out" when signed in. onChange gets the session (or null)
// on load and whenever it changes.
export function mountCloud(el, onChange) {
  const client = cloudClient();
  if (!el || !client) { if (onChange) onChange(null); return; }
  const doc = el.ownerDocument;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dialog = doc.createElement('dialog');
  dialog.className = 'cloud-dialog';
  dialog.innerHTML = `<form method="dialog" class="cloud-form">
      <h2 class="cloud-title">Sign in</h2>
      <label class="cloud-field">Email<input type="email" name="email" autocomplete="username" required></label>
      <label class="cloud-field">Password<input type="password" name="password" autocomplete="current-password" required></label>
      <p class="cloud-error" role="alert"></p>
      <div class="cloud-actions"><button type="button" class="cloud-cancel">Cancel</button><button type="submit" class="cloud-submit">Sign in</button></div>
    </form>`;
  doc.body.appendChild(dialog);
  const form = dialog.querySelector('form'), err = dialog.querySelector('.cloud-error');
  dialog.querySelector('.cloud-cancel').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const btn = form.querySelector('.cloud-submit'); btn.disabled = true;
    const { error } = await client.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
    btn.disabled = false;
    if (error) { err.textContent = error.message || 'Could not sign in.'; return; }
    form.password.value = '';
    dialog.close();
  });

  let last = null;
  const paint = async () => {
    const s = await cloudSession(client);
    const key = s ? `${s.user.id}|${s.campaignId}|${s.name}` : '';
    if (s) {
      el.innerHTML = `<span class="cloud-who">${esc(s.name)}${s.campaignName ? ` · ${esc(s.campaignName)}` : ' · no campaign yet'}</span> <button type="button" class="cloud-btn">Sign out</button>`;
      el.querySelector('button').addEventListener('click', () => client.auth.signOut());
    } else {
      el.innerHTML = '<button type="button" class="cloud-btn">Sign in</button>';
      el.querySelector('button').addEventListener('click', () => { err.textContent = ''; dialog.showModal(); form.email.focus(); });
    }
    if (key !== last) { last = key; if (onChange) onChange(s); }
  };
  client.auth.onAuthStateChange(() => { setTimeout(paint, 0); });
  paint();
}
