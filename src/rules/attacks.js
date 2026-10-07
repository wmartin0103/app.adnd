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
export const SITUATIONS = {
  flanking:     { label: 'Flanking',      hit: 2 },
  charging:     { label: 'Charging',      hit: 2 },
  higherGround: { label: 'Higher ground', hit: 1 },
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
  const pct = num(sheet['str-pct']);
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
  return null;
}

// Does a bonus's `appliesTo` match this weapon + attack?
function applies(appliesTo, weapon, attack) {
  if (!appliesTo) return true;
  const cats = appliesTo.categories || (appliesTo.category ? [appliesTo.category] : null);
  const modes = appliesTo.modes || (appliesTo.mode ? [appliesTo.mode] : null);
  if (cats && !cats.includes(weapon.category)) return false;
  if (modes && !modes.includes(attack.mode)) return false;
  return true;
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
  const add = (layer, label, hit = 0, dmg = 0) => {
    if (hit || dmg) lines.push({ layer, label, hit, dmg });
  };

  // ── Layer 1: built-in ──
  const bonuses = (sheet.__combatBonuses || []).filter(b => applies(b.appliesTo, weapon, attack));

  // Which ability adds to hit and damage. Defaults by mode; an attack or a
  // combat bonus (e.g. Duelist's Precision) can swap it.
  let hitAbility = attack.hitAbility || (attack.mode === 'melee' ? 'str' : 'dex-missile');
  let hitAbilitySource = null;
  let dmgAbility = attack.dmgAbility || (attack.mode === 'missile' ? 'none' : 'str');
  for (const b of bonuses) {
    if (b.hitAbility) { hitAbility = b.hitAbility; hitAbilitySource = b.label; }
    if (b.dmgAbility) dmgAbility = b.dmgAbility;
  }
  const ah = abilityHit(sheet, hitAbility);
  if (ah) add('built-in', hitAbilitySource ? `${hitAbilitySource}: ${ah.label}` : ah.label, ah.hit, 0);
  const ad = abilityDmg(sheet, dmgAbility);
  if (ad) add('built-in', ad.label, 0, ad.dmg);

  add('built-in', weapon.name || 'Weapon', weapon.hitBonus, weapon.dmgBonus);
  if (weapon.magicPlus) add('built-in', `Magic +${weapon.magicPlus}`, weapon.magicPlus, weapon.magicPlus);

  for (const r of RACIAL_WEAPON_BONUSES[sheet['race-group']] || []) {
    const matches = (r.categories || []).includes(weapon.category) || (r.modes || []).includes(attack.mode);
    if (matches && traitActive(sheet, r.traitId)) add('built-in', r.label, r.hit, 0);
  }

  for (const b of bonuses) add('built-in', b.label, b.hit || 0, b.dmg || 0);
  for (const m of attack.mods || []) add('built-in', m.label, m.hit || 0, m.dmg || 0);

  // ── Layer 2: toggles ──
  let noAttack = false;
  for (const opt of sheet.__combatOptions || []) {
    const picked = (round.toggles || {})[opt.id];
    if (!picked) continue;
    const effect = opt.choice ? opt.choice.find(c => c.label === picked) : opt;
    if (!effect) continue;
    if (effect.noAttack || opt.noAttack) noAttack = true;
    const label = opt.choice ? `${opt.name}: ${effect.label}` : opt.name;
    add('toggle', label, effect.hit || 0, effect.dmg || 0);
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
    attacksPerRound: attack.attacksPerRound || (attack.mode === 'melee' ? '1' : weapon.rateOfFire || '1'),
    range: attack.mode === 'melee' ? null : weapon.range || null,
    noAttack,
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
