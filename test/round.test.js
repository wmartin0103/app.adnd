import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scenarioContext } from '../src/rules/scenarios.js';
import { newRound, roundLines, lineNeed, actOn, rollLine, rollDice, lineToHit, roundACPenalty, lineHalfAvailable } from '../src/rules/round.js';
import { createRoundSync } from '../src/round-sync.js';

const load = f => JSON.parse(readFileSync(new URL(`../samples/${f}`, import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('../data/spell-catalog.json', import.meta.url)));
const rifiyr = load('rifiyr_10-12.json');
const jaque = load('jaque_10-09.json');
const ctxR = scenarioContext(rifiyr, catalog);
const orc = { id: 'f1', name: 'Orc 1', ac: 6, size: 'sm' };
const shaman = { id: 'f2', name: 'Shaman', ac: 8, size: 'sm' };
// Dice that always come up the same way
const fixed = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('attack lines come from the rate; later lines follow the one above until set apart', () => {
  const rec = { ...newRound('Rifiyr'), scenarioId: 'sc-1', lines: { a1: { target: orc, flanking: true } } };   // Long bow, flight: 2/1
  let lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual(lines.map(l => [l.label, l.same, l.set.target.name, l.set.flanking]), [['1st', false, 'Orc 1', true], ['2nd', true, 'Orc 1', true]]);
  assert.deepEqual(lines.map(l => lineNeed(ctxR, l)), [8, 8]);   // THAC0 16 − AC 6 − flanking 2
  // The 2nd shot at the shaman, not flanking
  rec.lines.a2 = { same: false, target: shaman, flanking: false };
  lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual(lines.map(l => [l.set.target.name, lineNeed(ctxR, l)]), [['Orc 1', 8], ['Shaman', 8]]);
  // Moving first: no extra attacks
  assert.equal(roundLines(ctxR, { ...rec, you: { ...rec.you, moveFirst: true } }, rifiyr.__scenarios).length, 1);
});

test('half attacks and the off-hand are the player\'s to add', () => {
  const ctxJ = scenarioContext(jaque, catalog);
  const rec = { ...newRound('Jaque'), scenarioId: 'sc-1' };   // Dagger, melee: 3/2
  assert.equal(lineHalfAvailable(jaque.__scenarios, rec), true);
  assert.deepEqual(roundLines(ctxJ, rec, jaque.__scenarios).map(l => l.label), ['1st']);
  assert.deepEqual(roundLines(ctxJ, { ...rec, extra: true, offhand: true }, jaque.__scenarios).map(l => [l.label, l.sc.name]),
    [['1st', 'Dagger, melee'], ['Extra', 'Dagger, melee'], ['Off-hand', 'Off-hand dagger']]);
});

test('conditions: to-hit per line, AC for charging', () => {
  assert.equal(lineToHit({ flanking: true, ground: 'high', charging: true, other: '-1' }), 2 + 1 + 2 - 1);
  assert.equal(lineToHit({ ground: 'low' }), -1);
  assert.equal(roundACPenalty([{ set: { charging: false } }, { set: { charging: true } }]), 1);
});

test('when the character acts: roll + speed + this round\'s adjustments', () => {
  const rec = { ...newRound('Rifiyr'), scenarioId: 'sc-1', init: { roll: 5 }, lines: { a1: { target: orc } } };
  assert.equal(actOn(ctxR, rec, rifiyr.__scenarios), 13);                                   // 5 + long bow 8
  assert.equal(actOn(ctxR, { ...rec, you: { moveFirst: true } }, rifiyr.__scenarios), 16);   // Move 1st +3
  assert.equal(actOn(ctxR, { ...rec, lines: { a1: { target: orc, ground: 'high' } } }, rifiyr.__scenarios), 12);
  assert.equal(actOn(ctxR, { ...rec, scenarioId: 'sc-7' }, rifiyr.__scenarios), 14);         // Spellarrow: bow 8 + Shocking Grasp 1
  assert.equal(actOn(ctxR, { ...rec, init: { roll: null } }, rifiyr.__scenarios), null);
  // Quickness: d20 at or under Dex, −2
  const ctxJ = scenarioContext(jaque, catalog);
  const recJ = { ...newRound('Jaque'), scenarioId: 'sc-1', init: { roll: 4 }, quick: { roll: 11 } };
  assert.equal(actOn(ctxJ, recJ, jaque.__scenarios, { quickness: true, dex: 19 }), 4 + 2 - 2);
});

test('rolling a line: hits, Good Hits and Bad Misses, damage by target size', () => {
  const rec = { ...newRound('Rifiyr'), scenarioId: 'sc-8', lines: { a1: { target: orc } } };   // Long bow, sheaf: 1d8
  const [line] = roundLines(ctxR, rec, rifiyr.__scenarios);
  const hit = rollLine(ctxR, line, fixed(0.5, 0.99));             // d20 11 vs need 10; 1d8 → 8
  assert.deepEqual([hit.d20, hit.need, hit.hit, hit.crit, hit.dmg], [11, 10, true, false, 8]);
  const crit = rollLine(ctxR, line, fixed(0.99, 0.42, 0));        // natural 20: a Good Hit, with d%
  assert.deepEqual([crit.d20, crit.crit, crit.pct, crit.dmg], [20, true, 43, 1]);
  const fumble = rollLine(ctxR, line, fixed(0, 0.1));             // natural 1: a Bad Miss
  assert.deepEqual([fumble.hit, fumble.fumble, fumble.pct], [false, true, 11]);
  // A spell with no attack roll: just damage
  const [mm] = roundLines(ctxR, { ...newRound('Rifiyr'), scenarioId: 'sc-3' }, rifiyr.__scenarios);
  const r = rollLine(ctxR, mm, fixed(0.99));
  assert.deepEqual([r.d20, r.hit, r.dmg], [null, true, 4]);       // Magic Missile 1d4 (−1 per die: 1d4)
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
    sheet.sendRecord({ ...newRound('Rifiyr'), scenarioId: 'sc-1', init: { roll: 7 } });
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
