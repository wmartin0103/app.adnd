import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scenarioContext } from '../src/rules/scenarios.js';
import { newRound, roundLines, lineTHAC0, judgeRoll, actOn, rollLine, rollDice, lineToHit, roundACPenalty, queueAttack, unqueueAttack, roundQueue, lineSay } from '../src/rules/round.js';
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

test('attack lines come from the rate; later lines follow the one above until set apart', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-1'), lines: { 'q1-a1': { target: orc, flanking: true } } };   // Long bow, flight: 2/1
  let lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual(lines.map(l => [l.label, l.same, l.set.target.label, l.set.flanking]), [['1st', false, 'B1', true], ['2nd', true, 'B1', true]]);
  assert.deepEqual(lines.map(l => lineTHAC0(ctxR, l)), [14, 14]);   // THAC0 16, flanking +2
  // The 2nd shot at the shaman, not flanking
  rec.lines['q1-a2'] = { same: false, target: shaman, flanking: false };
  lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual(lines.map(l => [l.set.target.label, lineTHAC0(ctxR, l)]), [['B1', 14], ['B2', 16]]);
  // Moving first: no extra attacks
  assert.equal(roundLines(ctxR, { ...rec, you: { ...rec.you, moveFirst: true } }, rifiyr.__scenarios).length, 1);
});

test('the round is the attacks the player adds: half attacks and the off-hand too', () => {
  const ctxJ = scenarioContext(jaque, catalog);
  let rec = withAttacks(newRound('Jaque'), 'sc-1');   // Dagger, melee: 3/2
  assert.deepEqual(roundLines(ctxJ, rec, jaque.__scenarios).map(l => l.label), ['1st']);
  const off = jaque.__scenarios.find(x => x.name === 'Off-hand dagger').id;
  rec = queueAttack({ ...rec, queue: [{ ...rec.queue[0], extra: true }] }, off);
  assert.deepEqual(roundLines(ctxJ, rec, jaque.__scenarios).map(l => [l.key, l.label, l.sc.name]),
    [['q1-a1', '1st', 'Dagger, melee'], ['q1-extra', 'Extra', 'Dagger, melee'], ['q2-a1', '1st', 'Off-hand dagger']]);
  // Each attack once; taking one out takes its lines' settings with it
  assert.equal(queueAttack(rec, off).queue.length, 2);
  const out = unqueueAttack({ ...rec, lines: { 'q2-a1': { target: orc } } }, 'q2');
  assert.deepEqual([out.queue.map(q => q.qid), out.lines], [['q1'], {}]);
  // A record from before the queue: its one attack
  assert.deepEqual(roundQueue({ scenarioId: 'sc-1' }).map(q => q.scenarioId), ['sc-1']);
});

test('conditions: to-hit per line, AC for charging', () => {
  assert.equal(lineToHit({ flanking: true, ground: 'high', charging: true, other: '-1' }), 2 + 1 + 2 - 1);
  assert.equal(lineToHit({ ground: 'low' }), -1);
  assert.equal(roundACPenalty([{ set: { charging: false } }, { set: { charging: true } }]), 1);
});

test('when the character acts: roll + speed + this round\'s adjustments', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-1'), init: { roll: 5 }, lines: { 'q1-a1': { target: orc } } };
  assert.equal(actOn(ctxR, rec, rifiyr.__scenarios), 13);                                   // 5 + long bow 8
  assert.equal(actOn(ctxR, { ...rec, you: { moveFirst: true } }, rifiyr.__scenarios), 16);   // Move 1st +3
  assert.equal(actOn(ctxR, { ...rec, lines: { 'q1-a1': { target: orc, ground: 'high' } } }, rifiyr.__scenarios), 12);
  assert.equal(actOn(ctxR, { ...rec, queue: [{ qid: 'q1', scenarioId: 'sc-7' }] }, rifiyr.__scenarios), 14);         // Spellarrow: bow 8 + Shocking Grasp 1
  assert.equal(actOn(ctxR, { ...rec, init: { roll: null } }, rifiyr.__scenarios), null);
  // The roll alone doesn't say when: the first attack's speed does
  assert.equal(actOn(ctxR, { ...rec, queue: [] }, rifiyr.__scenarios), null);
  assert.equal(actOn(ctxR, withAttacks(rec, 'sc-8'), rifiyr.__scenarios), 13);
  // Quickness: d20 at or under Dex, −2
  const ctxJ = scenarioContext(jaque, catalog);
  const recJ = { ...withAttacks(newRound('Jaque'), 'sc-1'), init: { roll: 4 }, quick: { roll: 11 } };
  assert.equal(actOn(ctxJ, recJ, jaque.__scenarios, { quickness: true, dex: 19 }), 4 + 2 - 2);
});

test('rolling a line on the sheet, and the DM judging it against the AC', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-8'), lines: { 'q1-a1': { target: orc } } };   // Long bow, sheaf: 1d8, THAC0 16
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
