import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scenarioContext } from '../src/rules/scenarios.js';
import { newRound, roundLines, lineTHAC0, judgeRoll, actOn, rollLine, rollDice, lineToHit, roundACPenalty, queueAttack, unqueueAttack, roundQueue, rerollDamage, lineSay } from '../src/rules/round.js';
import { createRoundSync } from '../src/round-sync.js';

const load = f => JSON.parse(readFileSync(new URL(`../samples/${f}`, import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/spell-catalog.json', import.meta.url)));
const rifiyr = load('rifiyr_10-12.json');
const jaque = load('jaque_10-09.json');
const ctxR = scenarioContext(rifiyr, catalog);
// Foes as players know them: the DM's fixed ID and size, never AC
const orc = { id: 'B1', label: 'B1', size: 'sm' };
const shaman = { id: 'B2', label: 'B2', size: 'sm' };
// Dice that always come up the same way
const withAttacks = (rec, ...ids) => ids.reduce(queueAttack, rec);
const fixed = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('one line for each attack added; later lines follow the one above until set apart', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-1', 'sc-1'), lines: { q1: { target: orc, flanking: true } } };   // Long bow, flight, twice (2/1)
  let lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual(lines.map(l => [l.label, l.same, l.set.target.label, l.set.flanking]), [['1st', false, 'B1', true], ['2nd', true, 'B1', true]]);
  assert.deepEqual(lines.map(l => lineTHAC0(ctxR, l)), [14, 14]);   // THAC0 16, flanking +2
  // The 2nd shot at the shaman, not flanking
  rec.lines.q2 = { same: false, target: shaman, flanking: false };
  lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual(lines.map(l => [l.set.target.label, lineTHAC0(ctxR, l)]), [['B1', 14], ['B2', 16]]);
  // Moving first: no extra attacks
  assert.equal(roundLines(ctxR, { ...rec, you: { ...rec.you, moveFirst: true } }, rifiyr.__scenarios).length, 1);
});

test('the round is the attacks the player adds, each marked extra or not', () => {
  const ctxJ = scenarioContext(jaque, catalog);
  const off = jaque.__scenarios.find(x => x.name === 'Off-hand dagger').id;
  let rec = withAttacks(newRound('Jaque'), 'sc-1', 'sc-1', off);   // Dagger, melee (3/2): the half attack this round, and the off-hand
  rec = { ...rec, queue: rec.queue.map((q, i) => ({ ...q, extra: i > 0 })) };
  assert.deepEqual(roundLines(ctxJ, rec, jaque.__scenarios).map(l => [l.key, l.label, l.sc.name, l.extra]),
    [['q1', '1st', 'Dagger, melee', false], ['q2', '2nd', 'Dagger, melee', true], ['q3', '3rd', 'Off-hand dagger', true]]);
  // Taking one out: the next one, if "same as above", keeps its target; the next one added gets a new id
  const out = unqueueAttack({ ...rec, lines: { q2: { same: false, target: orc } } }, 'q2');
  assert.deepEqual([out.queue.map(q => q.qid), roundLines(ctxJ, out, jaque.__scenarios).map(l => l.set.target)], [['q1', 'q3'], [null, orc]]);
  const first = unqueueAttack({ ...rec, lines: { q1: { target: orc } } }, 'q1');
  assert.deepEqual(roundLines(ctxJ, first, jaque.__scenarios).map(l => l.set.target), [orc, orc]);
  assert.equal(queueAttack(out, 'sc-1').queue[2].qid, 'q4');
  // A record from before the queue: its one attack
  assert.deepEqual(roundQueue({ scenarioId: 'sc-1' }).map(q => q.scenarioId), ['sc-1']);
});

test('conditions: to-hit per line, AC for charging', () => {
  assert.equal(lineToHit({ flanking: true, ground: 'high', charging: true, other: '-1' }), 2 + 1 + 2 - 1);
  assert.equal(lineToHit({ ground: 'low' }), -1);
  assert.equal(roundACPenalty([{ set: { charging: false } }, { set: { charging: true } }]), 1);
});

test('when the character acts: roll + speed + this round\'s adjustments', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-1'), init: { roll: 5 }, lines: { q1: { target: orc } } };
  assert.equal(actOn(ctxR, rec, rifiyr.__scenarios), 13);                                   // 5 + long bow 8
  assert.equal(actOn(ctxR, { ...rec, you: { moveFirst: true } }, rifiyr.__scenarios), 16);   // Move 1st +3
  assert.equal(actOn(ctxR, { ...rec, lines: { q1: { target: orc, ground: 'high' } } }, rifiyr.__scenarios), 12);
  assert.equal(actOn(ctxR, { ...rec, queue: [{ qid: 'q1', scenarioId: 'sc-7' }] }, rifiyr.__scenarios), 14);         // Spellarrow: bow 8 + Shocking Grasp 1
  assert.equal(actOn(ctxR, { ...rec, init: { roll: null } }, rifiyr.__scenarios), null);
  // The roll alone doesn't say when: the first attack's speed does
  assert.equal(actOn(ctxR, { ...rec, queue: [] }, rifiyr.__scenarios), null);
  assert.equal(actOn(ctxR, withAttacks(rec, 'sc-8'), rifiyr.__scenarios), 13);
  // The player's own adjustment (Quickness made at the table: −2)
  const ctxJ = scenarioContext(jaque, catalog);
  const recJ = { ...withAttacks(newRound('Jaque'), 'sc-1'), init: { roll: 4, adj: -2 } };
  assert.equal(actOn(ctxJ, recJ, jaque.__scenarios), 4 + 2 - 2);
});

test('rolling a line on the sheet, and the DM judging it against the AC', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-8'), lines: { q1: { target: orc } } };   // Long bow, sheaf: 1d8, THAC0 16
  const [line] = roundLines(ctxR, rec, rifiyr.__scenarios);
  const r = rollLine(ctxR, line, fixed(0.5, 0.99));                 // d20 11, 1d8 → 8
  assert.deepEqual([r.d20, r.thac0, r.hitsAC, r.pct, r.dmg], [11, 16, 5, null, 8]);
  assert.equal(lineSay({ ...line, roll: r }), '1st: vs B1, d20 11, hits AC 5 or worse, 8 damage');
  // The DM's page, which knows B1 is AC 6: a hit (needs 10)
  assert.deepEqual(judgeRoll(r, 6), { need: 10, hit: true, crit: false, fumble: false });
  assert.equal(judgeRoll(r, 4).hit, false);
  // A natural 20 also rolls d%; it's a Good Hit only if it would have hit anyway
  const n20 = rollLine(ctxR, line, fixed(0.99, 0.42, 0));
  assert.deepEqual([n20.d20, n20.pct], [20, 43]);
  assert.deepEqual([judgeRoll(n20, 6).crit, judgeRoll(n20, -10).crit, judgeRoll(n20, -10).hit], [true, false, true]);
  // A natural 1: a Bad Miss only if it would have missed anyway
  const n1 = rollLine(ctxR, line, fixed(0, 0.1));
  assert.deepEqual([judgeRoll(n1, 6).fumble, judgeRoll(n1, 20).fumble, judgeRoll(n1, 20).hit], [true, false, false]);
  // A spell with no attack roll: just damage, and it counts
  const [mm] = roundLines(ctxR, withAttacks(newRound('Rifiyr'), 'sc-3'), rifiyr.__scenarios);
  const m = rollLine(ctxR, mm, fixed(0.99));
  assert.deepEqual([m.d20, m.dmg, judgeRoll(m, 6).hit], [null, 4, true]);
  assert.equal(rollDice('2d4+1', fixed(0.99)), 9);
});

test('after rolling, the numbers follow the sheet; the dice stay', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-8'), lines: { q1: { target: orc } } };   // Long bow, sheaf: 1d8, THAC0 16
  const [line] = roundLines(ctxR, rec, rifiyr.__scenarios);
  rec.lines.q1.roll = rollLine(ctxR, line, fixed(0.5, 0.99));      // d20 11, 1d8 → 8
  // Flanking after the roll: THAC0 14, so it hits AC 3 or worse; same d20
  rec.lines.q1.flanking = true;
  let [now] = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual([now.roll.d20, now.roll.thac0, now.roll.hitsAC, now.roll.dmg], [11, 14, 3, 8]);
  // Sent to the DM (frozen): it keeps those numbers whatever changes next
  const sent = { ...rec, lines: { q1: { ...rec.lines.q1, flanking: false, roll: { ...now.roll, frozen: true } } } };
  assert.deepEqual([roundLines(ctxR, sent, rifiyr.__scenarios)[0].roll.thac0, roundLines(ctxR, sent, rifiyr.__scenarios)[0].roll.hitsAC], [14, 3]);
  // A damage bonus taken away after the roll: same dice, less damage
  const plus2 = rifiyr.__scenarios.map(s => (s.id === 'sc-8' ? { ...s, dmgMod: '2' } : s));
  const two = { ...rec, lines: { q1: { ...rec.lines.q1, roll: rollLine(ctxR, roundLines(ctxR, rec, plus2)[0], fixed(0.5, 0.99)) } } };
  assert.equal(roundLines(ctxR, two, plus2)[0].roll.dmg, 10);
  assert.equal(roundLines(ctxR, two, rifiyr.__scenarios)[0].roll.dmg, 8);
  // A Large target with other dice (dagger 1d4 → 1d3): the damage needs rolling again
  const dagger = rifiyr.__scenarios.find(s => s.name === 'Dagger').id;
  const recD = { ...withAttacks(newRound('Rifiyr'), dagger), lines: { q1: { target: orc } } };
  recD.lines.q1.roll = rollLine(ctxR, roundLines(ctxR, recD, rifiyr.__scenarios)[0], fixed(0.5, 0.99));
  recD.lines.q1.target = { ...orc, size: 'l' };
  [now] = roundLines(ctxR, recD, rifiyr.__scenarios);
  assert.deepEqual([now.roll.d20, now.roll.dmgStale, now.roll.dmg], [11, true, null]);
  const again = rerollDamage(ctxR, now, recD.lines.q1.roll, fixed(0.99));
  assert.deepEqual([again.d20, again.dmgStale, again.dmg], [11, false, 3]);
});

test('round sync: the DM\'s round and a sheet\'s record reach the other page', async () => {
  const store = {};
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  try {
    const dm = createRoundSync();
    const sheet = createRoundSync();
    const heard = new Promise(res => dm.onChange(res));
    dm.sendDM({ round: 3, foes: [orc], timing: 'end' });
    sheet.sendRecord({ ...withAttacks(newRound('Rifiyr'), 'sc-1'), init: { roll: 7 } });
    const s = await heard;
    assert.equal(s.records.Rifiyr.init.roll, 7);
    assert.equal(sheet.state().round, 3);
    assert.deepEqual(sheet.state().foes, [orc]);
    // A new round clears last round's records
    dm.sendDM({ round: 4 });
    assert.deepEqual(sheet.state().records, {});
    dm.close(); sheet.close();
  } finally { delete globalThis.localStorage; }
});
