// ── ROUND SYNC ──────────────────────────────────────────────────
// Keeps one combat round shared between the players' sheets and the DM's
// initiative page. The state:
//   { round, encounter, foes: [{ id, label, size }], timing: 'end' | 'turn',
//     records: { [character]: round record (rules/round.js) }, at }
// encounter: goes up when the DM resets initiative (each sheet keeps its
// initiative roll from round to round within one encounter).
// The DM sends the round, foes and timing (and clears the records on a new
// round); each sheet sends its own record.
//
// This first connection works within one browser: the preview's Sheet and DM
// tabs, or two tabs side by side. It keeps the state in browser storage, so a
// page that opens later still sees the round, and tells the other pages the
// moment it changes. A cross-device connection (Supabase) will offer the same
// calls. With no connection, the sheet still works on its own.

const CHANNEL = 'adnd-round';
const STORE = 'adnd-round-state';
const empty = () => ({ round: 1, encounter: 1, foes: [], timing: 'end', records: {}, at: 0 });

export function createRoundSync() {
  const listeners = [];
  let channel = null;
  try { channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null; } catch (e) { channel = null; }
  const read = () => { try { return { ...empty(), ...JSON.parse(localStorage.getItem(STORE) || 'null') }; } catch (e) { return empty(); } };
  let ok = true;
  const write = s => { try { localStorage.setItem(STORE, JSON.stringify(s)); ok = true; } catch (e) { ok = false; } };
  const tell = s => { listeners.forEach(fn => { try { fn(s); } catch (e) { /* a listener's problem */ } }); };
  const announce = s => { try { channel && channel.postMessage(s); } catch (e) { ok = false; } };
  if (channel) channel.onmessage = e => tell(e.data);
  try { window.addEventListener('storage', e => { if (e.key === STORE) tell(read()); }); } catch (e) { /* no window */ }

  const change = fn => { const s = read(); fn(s); s.at = Date.now(); write(s); announce(s); return s; };
  return {
    // Connected to a shared round? (false: the sheet works alone)
    get live() { return ok && !!channel; },
    state: read,
    // A sheet's own round
    sendRecord: rec => change(s => { s.records[rec.character] = { ...rec, round: s.round }; }),
    // The DM: round number, foes, timing. A new round number clears the records.
    // (A sheet on its own starts its next round with dm: false; `dmAt` says
    // when the DM's page last spoke, which is how a sheet knows it's live.)
    // reset: start over (round 1 unless given), every record cleared, a new
    // encounter. resetInit: a new encounter (everyone rolls initiative again).
    sendDM: ({ round, foes, timing, dm = true, reset = false, resetInit = false }) => change(s => {
      if (reset || resetInit) s.encounter = (s.encounter || 1) + 1;
      if (reset) { s.round = round ?? 1; s.records = {}; }
      else if (round != null && round !== s.round) { s.round = round; s.records = {}; }
      if (foes) s.foes = foes;
      if (timing) s.timing = timing;
      if (dm) s.dmAt = Date.now();
    }),
    // Called with the whole state whenever another page changes it
    onChange: fn => { listeners.push(fn); },
    close: () => { try { channel && channel.close(); } catch (e) { /* already closed */ } },
  };
}
