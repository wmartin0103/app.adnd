// ── ATTACKS ─────────────────────────────────────────────────────
// Turns a character sheet save (v2 weapons format) into calculated attacks:
// THAC0, damage, speed, and a labeled breakdown of every modifier.
//
// Modifiers come in four layers (see docs/combat-data-spec.md, section 4):
//   1. Built-in   — level, ability scores, weapon, racial, __combatBonuses
//   2. Toggles    — __combatOptions the player switches on this round
//   3. Situation  — shared chips like flanking (SITUATIONS below)
//   4. Adjust     — a one-off ± from the round
// Layers 2–4 come in through `round`; with no `round`, you get the
// built-in numbers only.
//
// Nothing here touches the page. Everything is data in, numbers out.

import { STR_TABLE, STR_EXCEPTIONAL, DEX_TABLE, THAC0_TABLE, RACIAL_WEAPON_BONUSES } from './tables.js';
import { resolveWeapon } from './weapons.js';
import { parseDice, formatDice } from './dice.js';

// Shared situational chips, from the DM Helper's MODS. Campaign-wide, not per character.
// A chip with no bonus of its own (targetExposed) is a condition that
// character abilities can react to, via `when` on a combat bonus.
export const SITUATIONS = {
  flanking:      { label: 'Flanking',                  hit: 2 },
  charging:      { label: 'Charging',                  hit: 2 },
  higherGround:  { label: 'Higher ground',             hit: 1 },
  targetExposed: { label: 'Target flanked or unaware', hit: 0 },
};

const num = v => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

// Highest level across all classes, matching the sheet's getEffectiveLevel().
export function effectiveLevel(sheet) {
  const levels = (sheet.__classes || []).map(c => num(c.level)).filter(l => l > 0);
  return levels.length ? Math.max(...levels) : 0;
}

export function baseTHAC0(group, level) {
  const row = THAC0_TABLE[group];
  if (!row) return null;
  return row[Math.min(Math.max(level, 1), 20) - 1];
}

// Strength hit/dmg, including exceptional strength (18/xx) when the sheet has it.
export function strengthMods(sheet) {
  const str = num(sheet.str);
  // "00" (or 100) is 18/00, matching the sheet's exceptional strength field.
  const rawPct = String(sheet['str-pct'] ?? '').trim();
  const pct = rawPct === '00' ? 100 : Math.min(num(rawPct), 100);
  if (str === 18 && pct > 0) {
    const row = STR_EXCEPTIONAL.find(r => pct <= r.upTo) || STR_EXCEPTIONAL.at(-1);
    return { hit: row.hit, dmg: row.dmg, label: `Strength 18/${pct === 100 ? '00' : String(pct).padStart(2, '0')}` };
  }
  const row = STR_TABLE[str] || { hit: 0, dmg: 0 };
  return { hit: row.hit, dmg: row.dmg, label: `Strength ${str}` };
}

function abilityHit(sheet, ability) {
  if (ability === 'str') {
    const s = strengthMods(sheet);
    return { label: s.label, hit: s.hit };
  }
  if (ability === 'dex-missile') {
    const dex = num(sheet.dex);
    return { label: `Dexterity ${dex} (missile adj.)`, hit: (DEX_TABLE[dex] || { missile: 0 }).missile };
  }
  return null;
}

function abilityDmg(sheet, ability) {
  if (ability === 'str') {
    const s = strengthMods(sheet);
    return { label: s.label, dmg: s.dmg };
  }
  // Intelligence read on the Strength damage column: no exceptional strength,
  // so it caps at +2 for Int 18 (Blade's Duelist's Precision).
  if (ability === 'int-as-str') {
    const int = Math.min(num(sheet.int), 18);
    return { label: `Intelligence ${num(sheet.int)}`, dmg: (STR_TABLE[int] || { dmg: 0 }).dmg };
  }
  return null;
}

// Does a bonus's `appliesTo` match this weapon + attack? All listed fields
// must match; `anyOf` matches if any one of its entries does.
function matches(appliesTo, weapon, attack) {
  const cats = appliesTo.categories || (appliesTo.category ? [appliesTo.category] : null);
  const modes = appliesTo.modes || (appliesTo.mode ? [appliesTo.mode] : null);
  if (cats && !cats.includes(weapon.category)) return false;
  if (modes && !modes.includes(attack.mode)) return false;
  if (appliesTo.hand && appliesTo.hand !== (attack.hand || 'main')) return false;
  if (appliesTo.anyOf && !appliesTo.anyOf.some(a => matches(a, weapon, attack))) return false;
  return true;
}

// A bonus applies when its weapon/attack filter matches and, if it has a
// `when` condition, that situation chip is on this round.
function applies(bonus, weapon, attack, round) {
  if (bonus.when && !(round.situation || []).includes(bonus.when)) return false;
  return !bonus.appliesTo || matches(bonus.appliesTo, weapon, attack);
}

// Attacks per round, either fixed ("3/2") or by level ({ 1: '3/2', 7: '2/1' }).
function attacksAtLevel(apr, level) {
  if (!apr || typeof apr !== 'object') return apr;
  const keys = Object.keys(apr).map(Number).filter(k => k <= level).sort((a, b) => b - a);
  return apr[keys[0]] ?? Object.values(apr)[0];
}

// Attacks per round, first match wins:
//   1. an off-hand attack is always the one extra attack
//   2. set on the attack itself
//   3. set by a combat bonus for this mode (e.g. Signature Weapon specialization)
//   4. melee 1; thrown and missile use the weapon's rate of fire
function attacksPerRoundFor(attack, weapon, bonuses, level) {
  if (attack.hand === 'off') return '1';
  if (attack.attacksPerRound) return attacksAtLevel(attack.attacksPerRound, level);
  for (const b of bonuses) {
    const byMode = b.attacksPerRound?.[attack.mode];
    if (byMode) return attacksAtLevel(byMode, level);
  }
  return attack.mode === 'melee' ? '1' : weapon.rateOfFire || '1';
}

// "3/2" → 1.5
function aprValue(apr) {
  const [a, b] = String(apr).split('/').map(Number);
  return b ? a / b : a;
}

function traitActive(sheet, traitId) {
  const t = (sheet.__traitState || {})[traitId];
  return t ? t.active !== false : true; // the sheet defaults traits to on
}

// The attacks a weapon offers: its own list, or one per mode if it has none.
export function weaponAttacks(weapon) {
  if (Array.isArray(weapon.attacks) && weapon.attacks.length) return weapon.attacks;
  return (weapon.modes || []).map(mode => ({ id: `${weapon.id}:${mode}`, mode }));
}

// Calculate one attack.
//   sheet           — character save (v2)
//   weaponId        — which weapon on the sheet
//   attackId        — which of that weapon's attacks
//   campaignWeapons — campaign list, keyed by id
//   round           — { toggles: { optId: choiceLabel|true }, situation: ['flanking'], adjust: { hit, dmg, label } }
export function computeAttack({ sheet, weaponId, attackId, campaignWeapons = {}, round = {} }) {
  const raw = (sheet.__weapons || []).find(w => w.id === weaponId);
  if (!raw) throw new Error(`No weapon ${weaponId} on sheet`);
  const weapon = resolveWeapon(raw, campaignWeapons);
  const attack = weaponAttacks({ ...raw, modes: weapon.modes }).find(a => a.id === attackId);
  if (!attack) throw new Error(`No attack ${attackId} on weapon ${weaponId}`);

  const group = attack.thac0Group || (sheet.__classes || [])[0]?.group || 'warrior';
  const level = attack.levelMode === 'custom' ? num(attack.customLevel) || 1 : effectiveLevel(sheet) || 1;
  const base = baseTHAC0(group, level);

  // Every line that adds to hit or damage, in display order.
  const lines = [];
  const add = (layer, label, hit = 0, dmg = 0, kind) => {
    if (hit || dmg) lines.push({ layer, label, hit, dmg, ...(kind && { kind }) });
  };

  // ── Layer 1: built-in ──
  const bonuses = (sheet.__combatBonuses || []).filter(b => applies(b, weapon, attack, round));

  // Which ability adds to hit and damage. Defaults by mode; an attack or a
  // combat bonus (e.g. Duelist's Precision) can swap it. With `preferBetter`,
  // the swap only happens when it gives a bigger bonus.
  const pickAbility = (defaultKey, field, read) => {
    let chosen = { key: defaultKey, source: null, value: read(defaultKey) };
    for (const b of bonuses) {
      if (!b[field]) continue;
      const value = read(b[field]);
      const better = (value?.hit ?? value?.dmg ?? 0) > (chosen.value?.hit ?? chosen.value?.dmg ?? 0);
      if (!b.preferBetter || better) chosen = { key: b[field], source: b.label, value };
    }
    return chosen;
  };
  const hitPick = pickAbility(attack.hitAbility || (attack.mode === 'melee' ? 'str' : 'dex-missile'), 'hitAbility', k => abilityHit(sheet, k));
  if (hitPick.value) add('built-in', hitPick.source ? `${hitPick.source}: ${hitPick.value.label}` : hitPick.value.label, hitPick.value.hit, 0);
  const dmgPick = pickAbility(attack.dmgAbility || (attack.mode === 'missile' ? 'none' : 'str'), 'dmgAbility', k => abilityDmg(sheet, k));
  if (dmgPick.value) add('built-in', dmgPick.source ? `${dmgPick.source}: ${dmgPick.value.label}` : dmgPick.value.label, 0, dmgPick.value.dmg);

  add('built-in', weapon.name || 'Weapon', weapon.hitBonus, weapon.dmgBonus);
  if (weapon.magicPlus) add('built-in', `Magic +${weapon.magicPlus}`, weapon.magicPlus, weapon.magicPlus);

  for (const r of RACIAL_WEAPON_BONUSES[sheet['race-group']] || []) {
    const matches = (r.categories || []).includes(weapon.category) || (r.modes || []).includes(attack.mode);
    if (matches && traitActive(sheet, r.traitId)) add('built-in', r.label, r.hit, 0, 'racial');
  }

  for (const b of bonuses) add('built-in', b.label, b.hit || 0, b.dmg || 0);
  for (const m of attack.mods || []) add('built-in', m.label, m.hit || 0, m.dmg || 0);

  // ── Layer 2: toggles ──
  let noAttack = false;
  const acLines = [];
  for (const opt of sheet.__combatOptions || []) {
    const picked = (round.toggles || {})[opt.id];
    if (!picked) continue;
    const effect = opt.choice ? opt.choice.find(c => c.label === picked) : opt;
    if (!effect) continue;
    if (effect.noAttack || opt.noAttack) noAttack = true;
    const label = opt.choice ? `${opt.name}: ${effect.label}` : opt.name;
    add('toggle', label, effect.hit || 0, effect.dmg || 0);
    // AC improvement: a number, or "halfLevel" (half the character's level, rounded up)
    const ac = effect.ac === 'halfLevel' ? Math.ceil((effectiveLevel(sheet) || 1) / 2) : effect.ac || 0;
    if (ac) acLines.push({ label, ac });
  }

  // ── Layer 3: situation ──
  for (const key of round.situation || []) {
    const s = SITUATIONS[key];
    if (s) add('situation', s.label, s.hit || 0, s.dmg || 0);
  }

  // ── Layer 4: quick adjust ──
  if (round.adjust) add('adjust', round.adjust.label || 'Adjustment', round.adjust.hit || 0, round.adjust.dmg || 0);

  // ── Totals ──
  const hitTotal = lines.reduce((s, l) => s + l.hit, 0);
  const dmgTotal = lines.reduce((s, l) => s + l.dmg, 0);

  const needsReview = [];
  if (weapon.unknown) needsReview.push('Weapon has unidentified properties');
  const damage = {};
  for (const size of ['sm', 'l']) {
    const dice = parseDice(weapon.damage?.[size]);
    if (!dice) { damage[size] = null; needsReview.push(`Damage vs ${size === 'sm' ? 'S/M' : 'L'} isn't clean dice`); continue; }
    damage[size] = formatDice(dice, dice.flat + dmgTotal);
  }

  return {
    weaponId,
    attackId,
    name: attack.name || `${weapon.name}, ${attack.mode}`,
    mode: attack.mode,
    hand: attack.hand || 'main',
    category: weapon.category,
    thac0: base === null ? null : base - hitTotal,
    base: { group, level, thac0: base },
    damage,
    damageTypes: weapon.damageTypes || [],
    speed: weapon.speed ?? null,
    magicPlus: weapon.magicPlus,
    attacksPerRound: attacksPerRoundFor(attack, weapon, bonuses, effectiveLevel(sheet) || 1),
    range: attack.mode === 'melee' ? null : weapon.range || null,
    noAttack,
    acImprovement: acLines.reduce((s, l) => s + l.ac, 0),
    acLines,
    lines,
    conditional: weapon.conditional,
    needsReview,
  };
}

// Every attack on the sheet, calculated. Skips weapons marked not carried.
export function listAttacks({ sheet, campaignWeapons = {}, round = {} }) {
  const out = [];
  for (const raw of sheet.__weapons || []) {
    const weapon = resolveWeapon(raw, campaignWeapons);
    if (weapon.carried === false) continue;
    for (const a of weaponAttacks({ ...raw, modes: weapon.modes })) {
      out.push(computeAttack({ sheet, weaponId: raw.id, attackId: a.id, campaignWeapons, round }));
    }
  }
  return out;
}

// Plan one round of attacks: a primary attack plus, for characters who fight
// with two weapons, one off-hand attack.
//   • The primary attack's attacks-per-round all use that one attack, so
//     melee and ranged primary attacks can't be mixed in a round.
//   • The off-hand attack is one extra attack, any mode, outside that rule.
// Returns { attacks, perRound, summary, errors }.
export function planRound({ sheet, primary, offHand, campaignWeapons = {}, round = {} }) {
  const errors = [];
  const attacks = [];
  const main = computeAttack({ sheet, ...primary, campaignWeapons, round });
  if (main.hand === 'off') errors.push('The primary attack must be a main-hand attack.');
  attacks.push(main);
  let perRound = aprValue(main.attacksPerRound);
  let summary = `${main.attacksPerRound} ${main.name}`;
  if (offHand) {
    const off = computeAttack({ sheet, ...offHand, campaignWeapons, round });
    if (!(sheet.__combatRules || {}).offHandAttack) errors.push('This character has no extra off-hand attack.');
    if (off.hand !== 'off') errors.push('The off-hand attack must be an off-hand attack.');
    if (offHand.weaponId === primary.weaponId) errors.push('The off-hand attack needs a second weapon.');
    attacks.push(off);
    perRound += 1;
    summary += ` + 1 ${off.name}`;
  }
  if (main.noAttack) return { attacks: [], perRound: 0, summary: 'No attack this round', errors };
  return { attacks, perRound, summary, errors };
}
