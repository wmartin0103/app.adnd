import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseDice, formatDice } from '../src/rules/dice.js';
import { resolveWeapon } from '../src/rules/weapons.js';
import { baseTHAC0, strengthMods, computeAttack, listAttacks, planRound, attacksThisRound, attacksInRound, hasBonusRounds, formatRate, offHandAttacks } from '../src/rules/attacks.js';

const jaque = JSON.parse(readFileSync(new URL('./fixtures/jaque-v2.json', import.meta.url)));

// ── Dice ──
test('parses clean dice and rejects anything else', () => {
  assert.deepEqual(parseDice('1d4+1'), { count: 1, sides: 4, flat: 1 });
  assert.deepEqual(parseDice('2d4'), { count: 2, sides: 4, flat: 0 });
  assert.deepEqual(parseDice('d6-1'), { count: 1, sides: 6, flat: -1 });
  assert.equal(parseDice('?'), null);
  assert.equal(parseDice('*+1/2'), null);
  assert.equal(formatDice({ count: 1, sides: 4 }, 3), '1d4+3');
  assert.equal(formatDice({ count: 1, sides: 4 }, -1), '1d4-1');
});

// ── Weapons: "based on" and categories ──
test('a sheet weapon inherits from its PHB weapon and keeps its category', () => {
  const w = resolveWeapon({ id: 'w', name: 'Superior Dagger', basedOn: 'dagger', hitBonus: 1 });
  assert.equal(w.category, 'dagger');
  assert.equal(w.speed, 2);
  assert.deepEqual(w.damage, { sm: '1d4', l: '1d3' });
  assert.deepEqual(w.modes, ['melee', 'thrown']);
  assert.deepEqual(w.lineage, ['Dagger', 'Superior Dagger']);
});

test('a campaign weapon maps to a PHB category, and sheet weapons can build on it', () => {
  const campaign = { 'folding-bow': { name: 'Folding bow', basedOn: 'short-bow', hitBonus: -1, speed: 7 } };
  const w = resolveWeapon({ id: 'w', name: "Rifiyr's folding bow", basedOn: 'folding-bow' }, campaign);
  assert.equal(w.category, 'short-bow');
  assert.equal(w.hitBonus, -1);
  assert.deepEqual(w.lineage, ['Short bow (flight arrow)', 'Folding bow', "Rifiyr's folding bow"]);
});

test('ammunition variants share their launcher category', () => {
  assert.equal(resolveWeapon({ id: 'w', basedOn: 'sling-stone' }).category, 'sling');
});

test('a basedOn loop does not hang', () => {
  const campaign = { a: { basedOn: 'b' }, b: { basedOn: 'a' } };
  assert.equal(resolveWeapon({ id: 'w', basedOn: 'a' }, campaign).category, null);
});

// ── Tables ──
test('THAC0 progressions follow the PHB', () => {
  assert.equal(baseTHAC0('rogue', 5), 18);
  assert.equal(baseTHAC0('warrior', 4), 17);
  assert.equal(baseTHAC0('wizard', 4), 19);
  assert.equal(baseTHAC0('priest', 3), 20);   // legacy sheet says 18
  assert.equal(baseTHAC0('priest', 5), 18);   // legacy sheet says 16; DM Helper says 18
});

test('exceptional strength', () => {
  assert.deepEqual(strengthMods({ str: '18', 'str-pct': '00' }), { hit: 3, dmg: 6, label: 'Strength 18/00' });
  assert.deepEqual(strengthMods({ str: '18', 'str-pct': '100' }), { hit: 3, dmg: 6, label: 'Strength 18/00' });
  assert.deepEqual(strengthMods({ str: '18', 'str-pct': '67' }), { hit: 2, dmg: 3, label: 'Strength 18/67' });
  assert.deepEqual(strengthMods({ str: '13' }), { hit: 0, dmg: 0, label: 'Strength 13' });
});

// ── Jaque ──
test('Jaque, Superior Dagger melee: THAC0 13, 1d4+3 / 1d3+3 (PHB damage vs L)', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1' });
  assert.equal(a.thac0, 13);
  assert.deepEqual(a.damage, { sm: '1d4+3', l: '1d3+3' });
  assert.equal(a.speed, 2);
  assert.deepEqual(a.damageTypes, ['P']);
  assert.equal(a.attacksPerRound, '3/2');
  assert.deepEqual(a.lines.map(l => [l.label, l.hit, l.dmg]), [
    ["Duelist's Precision: Dexterity 19 (missile adj.)", 3, 0],
    ['Superior Dagger', 1, 1],
    ['Signature Weapon', 1, 2],
  ]);
  // The DM Helper has this attack at THAC0 16: it doesn't include Duelist's
  // Precision. To be settled at the table; the breakdown makes the gap visible.
});

test('Jaque, thrown Dagger x6: THAC0 14, 1d4+2 / 1d3+2', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-5', attackId: 'atk-5' });
  assert.equal(a.thac0, 14);
  assert.deepEqual(a.damage, { sm: '1d4+2', l: '1d3+2' });
  assert.equal(a.attacksPerRound, '3/1');
  assert.deepEqual(a.range, { s: 1, m: 2, l: 3 });
});

test('Jaque, thrown Superior Dagger uses Dex, not Duelist (melee only)', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-2' });
  assert.equal(a.thac0, 13);
  assert.equal(a.lines[0].label, 'Dexterity 19 (missile adj.)');
});

test('situational bonuses on the Wave Dagger are listed, never applied', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-4', attackId: 'wpn-4:melee' });
  assert.equal(a.thac0, 14);   // 18 − Dex 3 − Signature 1; no +½
  assert.equal(a.conditional[0].label, 'vs Tiny/Small');
});

test('unidentified weapons are flagged for review', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-3', attackId: 'wpn-3:melee' });
  assert.ok(a.needsReview.includes('Weapon has unidentified properties'));
});

test('weapons without an attack list get one attack per mode', () => {
  const ids = listAttacks({ sheet: jaque }).map(a => a.attackId);
  assert.deepEqual(ids, ['atk-1', 'atk-2', 'wpn-3:melee', 'wpn-3:thrown', 'wpn-4:melee', 'wpn-4:thrown', 'atk-5', 'atk-8']);
});

// ── Round layers ──
test('Bladesong +1 hit and flanking stack on top of the built-in number', () => {
  const a = computeAttack({
    sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1',
    round: { toggles: { 'opt-1': '+1 hit' }, situation: ['flanking'] },
  });
  assert.equal(a.thac0, 10);
  assert.deepEqual(a.lines.filter(l => l.layer !== 'built-in').map(l => l.label), ['Bladesong: +1 hit', 'Flanking']);
});

test('quick adjust applies once and is labeled', () => {
  const a = computeAttack({
    sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1',
    round: { adjust: { hit: -2, label: 'Rope bridge' } },
  });
  assert.equal(a.thac0, 15);
  assert.equal(a.lines.at(-1).label, 'Rope bridge');
});

test('Defensive Spin marks the round as no attack', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1', round: { toggles: { 'opt-2': true } } });
  assert.equal(a.noAttack, true);
});

// ── Racial bonuses match on category, not name ──
test('elf bow bonus applies to a bow whose name never says "bow"', () => {
  const sheet = {
    str: '10', dex: '10', 'race-group': 'elf', __classes: [{ group: 'warrior', level: '1' }],
    __weapons: [{ id: 'w', name: 'Moonstring', basedOn: 'long-bow' }],
  };
  const a = computeAttack({ sheet, weaponId: 'w', attackId: 'w:missile' });
  assert.equal(a.thac0, 19);
  assert.equal(a.lines[0].label, 'Elf: bow');
});

test('a racial trait switched off on the sheet is not applied', () => {
  const sheet = {
    str: '10', dex: '10', 'race-group': 'elf', __classes: [{ group: 'warrior', level: '1' }],
    __traitState: { 'el-bow-bonus': { active: false } },
    __weapons: [{ id: 'w', basedOn: 'long-bow' }],
  };
  assert.equal(computeAttack({ sheet, weaponId: 'w', attackId: 'w:missile' }).thac0, 20);
});

// ── Blade (revised) ──
test('Duelist\'s Precision uses Strength instead when Strength is better', () => {
  const strong = { ...jaque, str: '17', dex: '13' };   // Str +1 hit, Dex missile 0
  const a = computeAttack({ sheet: strong, weaponId: 'wpn-1', attackId: 'atk-1' });
  assert.equal(a.lines[0].label, 'Strength 17');
  assert.equal(a.thac0, 18 - 1 - 1 - 1);   // Str, Superior, Signature
});

test('vs an unaware target, Jaque adds Int to damage (1d4+4)', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1', round: { situation: ['targetUnaware'] } });
  assert.deepEqual(a.damage, { sm: '1d4+4', l: '1d3+4' });
  assert.ok(a.lines.some(l => l.label === "Duelist's Precision: Intelligence 16" && l.dmg === 1));
  assert.equal(a.thac0, 13);   // the condition chip itself adds nothing to hit
});

test('Flanking counts as a flanked target: +2 to hit and Int to damage', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1', round: { situation: ['flanking'] } });
  assert.equal(a.thac0, 11);
  assert.deepEqual(a.damage, { sm: '1d4+4', l: '1d3+4' });
});

test('Int damage swap does not apply to thrown daggers', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-2', round: { situation: ['targetUnaware'] } });
  assert.deepEqual(a.damage, { sm: '1d4+3', l: '1d3+3' });
});

test('Int damage caps at +2 and never uses exceptional strength', () => {
  const genius = { ...jaque, int: '19' };
  const a = computeAttack({ sheet: genius, weaponId: 'wpn-1', attackId: 'atk-1', round: { situation: ['targetUnaware'] } });
  assert.ok(a.lines.some(l => l.label === "Duelist's Precision: Intelligence 19" && l.dmg === 2));
});

test('off-hand dagger: −2, still gets Signature Weapon and Duelist\'s Precision', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-5', attackId: 'off-melee' });
  assert.equal(a.thac0, 16);   // 18 − Dex 3 − Signature 1 + off-hand 2
  assert.deepEqual(a.damage, { sm: '1d4+2', l: '1d3+2' });
  assert.equal(a.attacksPerRound, '1');   // the Signature rate never applies to the extra attack
});

test('every main-hand dagger gets the Signature rate; the off-hand gets one attack', () => {
  const apr = id => listAttacks({ sheet: jaque }).find(a => a.attackId === id).attacksPerRound;
  assert.deepEqual(['wpn-3:melee', 'wpn-4:thrown'].map(apr), ['3/2', '3/1']);
  const off = computeAttack({ sheet: jaque, weaponId: 'wpn-4', attackId: 'off-thrown' });
  assert.equal(off.attacksPerRound, '1');
});

test('signature attacks per round improve at 7th and 13th level', () => {
  const at = lvl => computeAttack({ sheet: { ...jaque, __classes: [{ group: 'rogue', level: String(lvl) }] }, weaponId: 'wpn-1', attackId: 'atk-1' }).attacksPerRound;
  assert.deepEqual([at(5), at(7), at(13)], ['3/2', '2/1', '5/2']);
});

test('a round is one primary attack type plus one off-hand attack', () => {
  const melee = planRound({ sheet: jaque, primary: { weaponId: 'wpn-1', attackId: 'atk-1' }, offHand: { weaponId: 'wpn-5', attackId: 'off-melee' } });
  assert.deepEqual(melee.errors, []);
  assert.equal(melee.perRound, 2.5);
  assert.equal(melee.summary, '1 × Dagger Attack (Specialized) + 1 × Off-hand Dagger x6');   // round 1
  // Melee primary with a thrown off-hand dagger is allowed.
  const mixed = planRound({ sheet: jaque, primary: { weaponId: 'wpn-1', attackId: 'atk-1' }, offHand: { weaponId: 'wpn-5', attackId: 'off-thrown' } });
  assert.deepEqual(mixed.errors, []);
  assert.equal(mixed.perRound, 2.5);
});

test('any dagger can go in the off hand, including the one in the main hand', () => {
  const ids = listAttacks({ sheet: jaque, offHand: true }).filter(a => a.hand === 'off').map(a => `${a.weaponId}:${a.attackId}`);
  assert.deepEqual(ids, ['wpn-1:off-melee', 'wpn-1:off-thrown', 'wpn-3:off-melee', 'wpn-3:off-thrown', 'wpn-4:off-melee', 'wpn-4:off-thrown', 'wpn-5:off-melee', 'wpn-5:off-thrown']);
  const both = planRound({ sheet: jaque, primary: { weaponId: 'wpn-5', attackId: 'atk-5' }, offHand: { weaponId: 'wpn-5', attackId: 'off-thrown' } });
  assert.deepEqual(both.errors, []);
  const superior = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'off-melee' });
  assert.equal(superior.thac0, 15);   // its own +1 still counts
});

test('no off-hand attack unless the main hand holds a dagger (Handle Weapons)', () => {
  const sheet = { ...jaque, __weapons: [...jaque.__weapons, { id: 'w-sword', name: 'Short sword', basedOn: 'short-sword' }] };
  const r = planRound({ sheet, primary: { weaponId: 'w-sword', attackId: 'w-sword:melee' }, offHand: { weaponId: 'wpn-5', attackId: 'off-melee' } });
  assert.ok(r.errors.includes('An off-hand attack needs a dagger in the main hand.'));
});

test('any weapon can go in the off hand, with the non-proficiency penalty', () => {
  const sheet = { ...jaque, __weapons: [...jaque.__weapons, { id: 'w-sword', name: 'Short sword', basedOn: 'short-sword' }, { id: 'w-bow', name: 'Short bow', basedOn: 'short-bow' }] };
  const off = computeAttack({ sheet, weaponId: 'w-sword', attackId: 'off-melee' });
  assert.equal(off.thac0, 19);   // 18 − Dex (Duelist) 3 + not proficient 3 − elf sword 1 + off-hand 2
  assert.ok(off.lines.some(l => l.label === 'Not proficient' && l.hit === -3));
  const r = planRound({ sheet, primary: { weaponId: 'wpn-1', attackId: 'atk-1' }, offHand: { weaponId: 'w-sword', attackId: 'off-melee' } });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(offHandAttacks(sheet, sheet.__weapons.at(-1)), []);   // bows can't be used off-hand
});

test('non-proficiency penalty follows the class (most favorable of a multi-class)', () => {
  const base = { str: '10', dex: '10', __weaponProficiencies: ['dagger'], __weapons: [{ id: 'w', basedOn: 'long-sword' }] };
  const t = classes => computeAttack({ sheet: { ...base, __classes: classes }, weaponId: 'w', attackId: 'w:melee' }).thac0;
  assert.equal(t([{ group: 'wizard', level: '1' }]), 25);
  assert.equal(t([{ group: 'warrior', level: '1' }]), 22);
  assert.equal(t([{ group: 'wizard', level: '1' }, { group: 'warrior', level: '1' }]), 22);
  assert.equal(computeAttack({ sheet: { ...base, __weaponProficiencies: undefined, __classes: [{ group: 'wizard', level: '1' }] }, weaponId: 'w', attackId: 'w:melee' }).thac0, 20);   // no list yet: no penalty
});

test('a round rejects a main-hand attack in the off-hand slot', () => {
  const bad = planRound({ sheet: jaque, primary: { weaponId: 'wpn-1', attackId: 'atk-1' }, offHand: { weaponId: 'wpn-5', attackId: 'atk-5' } });
  assert.ok(bad.errors.includes('The off-hand attack must be an off-hand attack.'));
});

test('Defensive Spin: no attack, AC better by half his level rounded up', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-1', attackId: 'atk-1', round: { toggles: { 'opt-2': true } } });
  assert.equal(a.noAttack, true);
  assert.equal(a.acImprovement, 3);   // level 5 → 3
  const plan = planRound({ sheet: jaque, primary: { weaponId: 'wpn-1', attackId: 'atk-1' }, round: { toggles: { 'opt-2': true } } });
  assert.equal(plan.summary, 'No attack this round');
});

test('Trick Throw is a custom attack at −2', () => {
  const a = computeAttack({ sheet: jaque, weaponId: 'wpn-5', attackId: 'atk-8' });
  assert.equal(a.thac0, 16);   // 18 − Dex 3 − Signature 1 + Trick Throw 2
});

test('fractional attack rates alternate by round', () => {
  assert.deepEqual([1, 2, 3, 4].map(r => attacksThisRound('3/2', r)), [1, 2, 1, 2]);
  assert.deepEqual([1, 2, 3].map(r => attacksThisRound('5/2', r)), [2, 3, 2]);
  assert.deepEqual([1, 2].map(r => attacksThisRound('3/1', r)), [3, 3]);
});

test('each attack in a round is its own slot', () => {
  const thrown = planRound({ sheet: jaque, primary: { weaponId: 'wpn-1', attackId: 'atk-2' }, offHand: { weaponId: 'wpn-5', attackId: 'off-thrown' }, roundNumber: 3 });
  assert.deepEqual(thrown.slots.map(s => [s.n, s.attackId, s.hand]), [[1, 'atk-2', 'main'], [2, 'atk-2', 'main'], [3, 'atk-2', 'main'], [4, 'off-thrown', 'off']]);
  assert.equal(thrown.summary, '3 × Superior Dagger, thrown + 1 × Off-hand Dagger x6, thrown');
  const meleeEven = planRound({ sheet: jaque, primary: { weaponId: 'wpn-1', attackId: 'atk-1' }, roundNumber: 2 });
  assert.equal(meleeEven.slots.length, 2);
});

test('HP at or below 0: unconscious, dying, dead at -10', async () => {
  const { hpState } = await import('../src/rules/character.js');
  assert.deepEqual([5, 0, -1, -9, -10, -12, ''].map(hpState), [null, 'Unconscious', 'Dying', 'Dying', 'Dead', 'Dead', 'Unconscious']);
});

test('half attacks: standard or bonus round, chosen by the player', () => {
  assert.equal(hasBonusRounds('3/2'), true);
  assert.equal(hasBonusRounds('3/1'), false);
  assert.deepEqual([attacksInRound('3/2'), attacksInRound('3/2', { bonus: true })], [1, 2]);
  assert.deepEqual([attacksInRound('5/2'), attacksInRound('5/2', { bonus: true })], [2, 3]);
  assert.deepEqual([attacksInRound('3/1'), attacksInRound('3/1', { bonus: true })], [3, 3]);
  assert.deepEqual(['3/2', '3/1', '1'].map(formatRate), ['3 per 2 rounds', '3 per round', '1 per round']);
});

test('unarmed: PHB Table 57 lookup and THAC0 from Strength and situation', async () => {
  const { unarmedResult, unarmedAttack } = await import('../src/rules/unarmed.js');
  assert.deepEqual(unarmedResult(15), { punch: { name: 'Jab', damage: 2, knockout: 6 }, wrestle: { name: 'Arm lock', hold: true } });
  assert.equal(unarmedResult(24).punch.name, 'Haymaker');
  assert.equal(unarmedResult(-2).punch.knockout, 25);
  const a = unarmedAttack({ sheet: { str: '17', __classes: [{ group: 'rogue', level: '5' }] }, round: { situation: ['flanking'] } });
  assert.deepEqual([a.base.thac0, a.thac0, a.strDamage], [18, 15, 1]);   // rogue 5: 18; Str 17 +1 hit; flanking +2
});

test('ability cards: combat role guessed from the wording', async () => {
  const { guessCombatRole, sameAbility } = await import('../src/rules/abilities.js');
  const sheet = JSON.parse(readFileSync(new URL('../samples/jaque_09-23.json', import.meta.url)));
  const roles = Object.fromEntries(sheet.__abilitiesCards.map(a => [a.name, guessCombatRole(a)]));
  assert.deepEqual(roles, {
    'Weapons Display': 'round', 'Handle Weapon': 'passive', 'Trick Throw': 'attack',
    'Defensive Spin': 'round', 'Offensive Spin': 'round', "Thieves' Cant": 'none',
    'Influence Reactions': 'none', 'Inspiration': 'none', 'Signature Weapon (Dagger)': 'passive',
    "Duelist's Precision": 'passive', 'Limited Legend Lore': 'none',
  });
  assert.equal(guessCombatRole({ name: 'Turn Undead', desc: 'Takes the round. Roll on the turning table.' }), 'round');
  assert.equal(guessCombatRole({ name: 'Mystery', desc: 'Something happens.' }), null);
  assert.ok(sameAbility('Weapons Display', 'Weapon Display'));
  assert.ok(sameAbility('Signature Weapon (Dagger)', 'Signature Weapon'));
  assert.ok(!sameAbility('Defensive Spin', 'Offensive Spin'));
});

test('spell catalog: every spell in the saves has an entry, matched by name or alias', async () => {
  const { findSpell, missingFields } = await import('../src/rules/spells.js');
  const catalog = JSON.parse(readFileSync(new URL('../data/spell-catalog.json', import.meta.url)));
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(new URL('../samples/', import.meta.url)).filter(f => f.endsWith('.json'))) {
    const s = JSON.parse(readFileSync(new URL(`../samples/${f}`, import.meta.url)));
    for (const sp of s.__spells || []) assert.ok(findSpell(catalog, sp), `${f}: ${sp.name}`);
  }
  assert.equal(findSpell(catalog, { name: 'Cure L Wounds', level: 1 }).id, 'cure-light-wounds');
  assert.equal(findSpell(catalog, { name: 'Light', level: 1 }, 'priest').castTime, '4');
  assert.equal(findSpell(catalog, { name: 'Light', level: 1, type: 'wizard' }).castTime, '1');
  assert.deepEqual(missingFields(findSpell(catalog, { name: 'Run' })), []);                 // placeholder filled from "Run (Lvl 1)"
  assert.ok(findSpell(catalog, { name: 'Bless', level: 1 }, 'priest'));
  assert.deepEqual(missingFields(findSpell(catalog, { name: 'Charm Person' })), []);
  const ids = catalog.spells.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('spell catalog: wiki import has PHB stat blocks with guessed dice and attack rolls', async () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/spell-catalog.json', import.meta.url)));
  const get = (name, cls) => catalog.spells.find(e => e.name === name && e.class === cls);
  assert.ok(catalog.spells.length > 4000);
  assert.deepEqual(['castTime', 'range', 'save', 'dice', 'attack'].map(k => get('Magic Missile', 'wizard')[k]), ['1', '60 yds.+ 10 yds./level', 'None', '1d4+1', 'none']);
  assert.equal(get('Fireball', 'wizard').dice, '1d6/level');
  assert.deepEqual([get('Shocking Grasp', 'wizard').attack, get('Shocking Grasp', 'wizard').dice], ['touch', '1d8+1/level']);
  assert.equal(get('Sleep', 'wizard').dice || '', '');           // 2d4 Hit Dice is not damage
  assert.equal(get('Charm Person', 'wizard').status, 'check');   // hand-entered entry kept
  const ids = catalog.spells.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
