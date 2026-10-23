import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scenarioContext } from '../src/rules/scenarios.js';
import { newRound, roundLines, lineTHAC0, judgeRoll, actOn, rollLine, rollDice, lineToHit, roundACPenalty, queueAttack, unqueueAttack, roundQueue, rerollDamage, lineSay, lineKind, hasRoll, isHealing } from '../src/rules/round.js';
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
// A roll's entry for its only target
const one = r => r.each[0];
const fixed = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('one line for each attack added, each set on its own', () => {
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-1', 'sc-1'), lines: { q1: { target: orc, flanking: true } } };   // Long bow, flight, twice (2/1)
  let lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  // The 2nd shot doesn't copy the 1st: no target, no conditions until chosen
  assert.deepEqual(lines.map(l => [l.label, l.set.targets.map(t => t.label), l.set.flanking]), [['1st', ['B1'], true], ['2nd', [], false]]);
  assert.deepEqual(lines.map(l => lineTHAC0(ctxR, l)), [14, 16]);   // THAC0 16, flanking +2
  // The 2nd shot at the shaman, from behind: rear attack +2
  rec.lines.q2 = { target: shaman, rear: true };
  lines = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual(lines.map(l => [l.set.targets[0].label, lineTHAC0(ctxR, l)]), [['B1', 14], ['B2', 14]]);
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
  // Taking one out takes its settings with it; the others keep theirs; the next one added gets a new id
  const out = unqueueAttack({ ...rec, lines: { q2: { target: orc }, q3: { target: shaman } } }, 'q2');
  assert.deepEqual([out.queue.map(q => q.qid), roundLines(ctxJ, out, jaque.__scenarios).map(l => l.set.targets[0] || null)], [['q1', 'q3'], [null, shaman]]);
  assert.equal(queueAttack(out, 'sc-1').queue[2].qid, 'q4');
  // A record from before the queue: its one attack
  assert.deepEqual(roundQueue({ scenarioId: 'sc-1' }).map(q => q.scenarioId), ['sc-1']);
});

test('conditions: to-hit per line, AC for charging', () => {
  assert.equal(lineToHit({ flanking: true, ground: 'high', charging: true, other: '-1' }), 2 + 1 + 2 - 1);
  assert.equal(lineToHit({ rear: true }), 2);
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
  const roll = rollLine(ctxR, line, fixed(0.5, 0.99));              // d20 11, 1d8 → 8
  const r = one(roll);
  assert.deepEqual([roll.kind, r.target.id, r.d20, r.thac0, r.hitsAC, r.pct, r.dmg], ['attack', 'B1', 11, 16, 5, null, 8]);
  assert.equal(lineSay({ ...line, roll }), '1st: vs B1, d20 11, hits AC 5 or worse, 8 damage');
  // The DM's page, which knows B1 is AC 6: a hit (needs 10)
  assert.deepEqual(judgeRoll(r, 6), { need: 10, hit: true, crit: false, fumble: false });
  assert.equal(judgeRoll(r, 4).hit, false);
  // A natural 20 also rolls d%; it's a Good Hit only if it would have hit anyway
  const n20 = one(rollLine(ctxR, line, fixed(0.99, 0.42, 0)));
  assert.deepEqual([n20.d20, n20.pct], [20, 43]);
  assert.deepEqual([judgeRoll(n20, 6).crit, judgeRoll(n20, -10).crit, judgeRoll(n20, -10).hit], [true, false, true]);
  // A natural 1: a Bad Miss only if it would have missed anyway
  const n1 = one(rollLine(ctxR, line, fixed(0, 0.1)));
  assert.deepEqual([judgeRoll(n1, 6).fumble, judgeRoll(n1, 20).fumble, judgeRoll(n1, 20).hit], [true, false, false]);
  // A spell with no attack roll: just damage, and it counts
  const [mm] = roundLines(ctxR, withAttacks(newRound('Rifiyr'), 'sc-3'), rifiyr.__scenarios);
  const m = one(rollLine(ctxR, mm, fixed(0.99)));
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
  assert.deepEqual([one(now.roll).d20, one(now.roll).thac0, one(now.roll).hitsAC, one(now.roll).dmg], [11, 14, 3, 8]);
  // Sent to the DM (frozen): it keeps those numbers whatever changes next
  const sent = { ...rec, lines: { q1: { ...rec.lines.q1, flanking: false, roll: { ...now.roll, frozen: true } } } };
  assert.deepEqual([one(roundLines(ctxR, sent, rifiyr.__scenarios)[0].roll).thac0, one(roundLines(ctxR, sent, rifiyr.__scenarios)[0].roll).hitsAC], [14, 3]);
  // A damage bonus taken away after the roll: same dice, less damage
  const plus2 = rifiyr.__scenarios.map(s => (s.id === 'sc-8' ? { ...s, dmgMod: '2' } : s));
  const two = { ...rec, lines: { q1: { ...rec.lines.q1, roll: rollLine(ctxR, roundLines(ctxR, rec, plus2)[0], fixed(0.5, 0.99)) } } };
  assert.equal(one(roundLines(ctxR, two, plus2)[0].roll).dmg, 10);
  assert.equal(one(roundLines(ctxR, two, rifiyr.__scenarios)[0].roll).dmg, 8);
  // A Large target with other dice (dagger 1d4 → 1d3): the damage needs rolling again
  const dagger = rifiyr.__scenarios.find(s => s.name === 'Dagger').id;
  const recD = { ...withAttacks(newRound('Rifiyr'), dagger), lines: { q1: { target: orc } } };
  recD.lines.q1.roll = rollLine(ctxR, roundLines(ctxR, recD, rifiyr.__scenarios)[0], fixed(0.5, 0.99));
  recD.lines.q1.roll.each[0].target = { ...orc, size: 'l' };
  [now] = roundLines(ctxR, recD, rifiyr.__scenarios);
  assert.deepEqual([one(now.roll).d20, now.roll.dmgStale, one(now.roll).dmg], [11, true, null]);
  const again = rerollDamage(ctxR, now, recD.lines.q1.roll, fixed(0.99));
  assert.deepEqual([one(again).d20, again.dmgStale, one(again).dmg], [11, false, 3]);
});

test('several targets: a d20 each, one area roll for all, or damage each', () => {
  // An attack that rolls to hit: its own d20 and damage for each target
  const bow = { ...withAttacks(newRound('Rifiyr'), 'sc-8'), lines: { q1: { targets: [orc, shaman] } } };   // Long bow, sheaf: 1d8
  const [line] = roundLines(ctxR, bow, rifiyr.__scenarios);
  const roll = rollLine(ctxR, line, fixed(0.5, 0.99, 0.1, 0));       // B1: d20 11, 8 · B2: d20 3, 1
  assert.deepEqual(roll.each.map(e => [e.target.id, e.d20, e.hitsAC, e.dmg]), [['B1', 11, 5, 8], ['B2', 3, 13, 1]]);
  assert.equal(lineSay({ ...line, roll }), '1st: vs B1, d20 11, hits AC 5 or worse, 8 damage; vs B2, d20 3, hits AC 13 or worse, 1 damage');
  // The DM judges each against its own AC
  assert.deepEqual(roll.each.map((e, i) => judgeRoll(e, [6, 6][i]).hit), [true, false]);
  // A spell with no attack roll and no save (Magic Missile): damage for each target
  const mm = { ...withAttacks(newRound('Rifiyr'), 'sc-3'), lines: { q1: { targets: [orc, shaman] } } };
  const [mmLine] = roundLines(ctxR, mm, rifiyr.__scenarios);
  assert.equal(lineKind(ctxR, mmLine.sc), 'split');
  const mmRoll = rollLine(ctxR, mmLine, fixed(0.99, 0));
  assert.deepEqual(mmRoll.each.map(e => [e.d20, e.dmg]), [[null, 4], [null, 1]]);
  // An area spell the targets save against: one damage roll for all of them
  const areaScenarios = rifiyr.__scenarios.map(x => (x.id === 'sc-3' ? { ...x, spell: { save: '½' } } : x));
  const [areaLine] = roundLines(ctxR, mm, areaScenarios);
  assert.equal(lineKind(ctxR, areaLine.sc), 'area');
  const area = rollLine(ctxR, areaLine, fixed(0.99, 0));
  assert.deepEqual(area.each.map(e => e.dmg), [4, 4]);
  assert.match(lineSay({ ...areaLine, roll: area }), /target saves/);
});

test('a spell with no dice has nothing to roll; healing dice are healing', () => {
  const spell = spellId => ({ id: 't', attackType: 'spell', spellId, group: 'wizard', levelMode: 'sheet' });
  assert.deepEqual([hasRoll(ctxR, spell('spl-19')), hasRoll(ctxR, spell('spl-35'))], [false, false]);   // Sleep, Grease
  assert.deepEqual([hasRoll(ctxR, spell('spl-11')), isHealing(ctxR, spell('spl-11'))], [true, false]);  // Magic Missile
  assert.equal(hasRoll(ctxR, rifiyr.__scenarios.find(s => s.id === 'sc-8')), true);                     // a bow always rolls
});

test('a roll sent before several targets (old format, frozen) still shows', () => {
  const old = { d20: 15, thac0: 16, hitsAC: 1, dmg: 5, dmgExpr: '1d6', frozen: true };
  const rec = { ...withAttacks(newRound('Rifiyr'), 'sc-1'), lines: { q1: { target: orc, roll: old } } };
  const [line] = roundLines(ctxR, rec, rifiyr.__scenarios);
  assert.deepEqual([line.roll.frozen, line.roll.each.length, one(line.roll).d20, one(line.roll).target.id], [true, 1, 15, 'B1']);
  assert.equal(lineSay(line), '1st: vs B1, d20 15, hits AC 1 or worse, 5 damage');
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
    // Reset: round 1 and no records, even from round 1
    dm.sendDM({ round: 1 });
    sheet.sendRecord({ ...newRound('Rifiyr'), init: { roll: 2 } });
    dm.sendDM({ round: 1, reset: true });
    assert.deepEqual([sheet.state().round, sheet.state().records], [1, {}]);
    // Initiative stays for the encounter; Reset initiative (or Reset) starts a new one
    const enc = sheet.state().encounter;
    dm.sendDM({ round: 2 });
    assert.equal(sheet.state().encounter, enc);
    dm.sendDM({ resetInit: true });
    assert.deepEqual([sheet.state().encounter, sheet.state().round], [enc + 1, 2]);
    dm.close(); sheet.close();
  } finally { delete globalThis.localStorage; }
});
