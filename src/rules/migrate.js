// ── MIGRATION: SHEET v1 → v2 ────────────────────────────────────
// Converts the old Weapons + Combat Scenarios sections into the v2 format
// (weapons with attacks inside them; see docs/combat-data-spec.md).
//
// Rules of the road:
//   • Never silently drop anything. Text that can't be converted goes into the
//     weapon's notes, and an item is added to `__review`.
//   • Keep every attack's THAC0 the same as the old sheet showed it. The old
//     "hit mod" often included things v2 now adds automatically (like Dex for
//     thrown weapons), so only the leftover is carried over, as a labeled line.
//   • Follow the PHB: damage dice that differ from the PHB weapon are set to
//     the PHB value and flagged so the player can confirm.
//
// `__review` holds the "needs review" items behind the sheet's review summary:
//   { id, target: { kind: 'weapon'|'attack', id }, message }

import { PHB_WEAPONS, resolveWeapon } from './weapons.js';
import { parseDice } from './dice.js';
import { baseTHAC0, effectiveLevel, strengthMods, computeAttack } from './attacks.js';

const TYPE_CODES = { bludgeoning: 'B', piercing: 'P', slashing: 'S' };

// Extra names that point to a PHB weapon. Matched as whole words.
const ALIASES = {
  longsword: 'long-sword', shortsword: 'short-sword', broadsword: 'broad-sword',
  longbow: 'long-bow', shortbow: 'short-bow', crossbow: 'light-crossbow',
  'hand crossbow': 'light-crossbow', 'two-handed sword': 'two-handed-sword',
  greatsword: 'two-handed-sword', staff: 'quarterstaff', mace: 'footmans-mace',
  hammer: 'warhammer', axe: 'battle-axe', 'hand axe': 'hand-axe', 'throwing axe': 'hand-axe',
  lance: 'heavy-lance', stiletto: 'dagger', dirk: 'dagger',
  'comp short bow': 'composite-short-bow', 'comp long bow': 'composite-long-bow',
};

// Best guess at the PHB weapon a name refers to, or null. Longest match wins,
// so "Long Bow (Fine)" picks long bow, not bow.
export function guessCategory(name) {
  const n = ` ${String(name || '').toLowerCase().replace(/[^a-z0-9'-]+/g, ' ')} `;
  const candidates = [];
  for (const [key, w] of Object.entries(PHB_WEAPONS)) {
    if (w.basedOn) continue;
    const label = w.name.toLowerCase().replace(/\s*\(.*\)$/, '');   // "Short bow (flight arrow)" → "short bow"
    candidates.push([label, key], [key.replace(/-/g, ' '), key]);
  }
  for (const [alias, key] of Object.entries(ALIASES)) candidates.push([alias, key]);
  candidates.sort((a, b) => b[0].length - a[0].length);
  for (const [label, key] of candidates) {
    if (n.includes(` ${label} `) || n.includes(` ${label}s `)) return key;
  }
  return null;
}

// "+1" → 1, "" → 0, anything else → null (can't read it).
function cleanNumber(text) {
  const t = String(text ?? '').trim();
  if (t === '') return 0;
  return /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : null;
}

// THAC0 as the old sheet calculated a scenario, minus racial bonuses (v2
// applies those itself), with the corrected priest table, and ignoring
// unreadable hit adjustments like "*+1/2".
function oldScenarioTHAC0(sheet, scenario, oldWeapon) {
  const level = scenario.levelMode === 'custom' ? parseInt(scenario.customLevel, 10) || 1 : effectiveLevel(sheet) || 1;
  const base = baseTHAC0(scenario.group, level);
  if (base === null) return null;
  const str = strengthMods(sheet).hit;
  const wpnHit = oldWeapon ? cleanNumber(oldWeapon.hitAdj) ?? 0 : 0;
  let offHand = 0;
  if (scenario.handedness === 'off' && scenario.offHandPenalty) {
    const m = String(scenario.offHandPenalty).match(/[+-]?\d+/);
    if (m) offHand = parseInt(m[0], 10);
  }
  let hitMod = 0;
  const m = String(scenario.hitMod ?? '').match(/^([+-]?)(\d+)$/);
  if (m) hitMod = (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10);
  return base - str - wpnHit + offHand - hitMod;
}

// Melee, thrown, or missile, guessed from the scenario name and what the weapon can do.
function guessMode(scenario, modes) {
  const name = String(scenario.name || '').toLowerCase();
  if (/\bthr(own|ow)\b/.test(name) && modes.includes('thrown')) return 'thrown';
  if (modes.includes('melee')) return 'melee';
  return modes[0] || 'melee';
}

export function migrateV1toV2(input) {
  const d = structuredClone(input);
  const review = [];
  let reviewCounter = 0;
  const flag = (kind, id, message) => review.push({ id: `rv-${++reviewCounter}`, target: { kind, id }, message });

  const oldWeapons = d.__weapons || [];
  const oldScenarios = d.__scenarios || [];

  // ── Weapon proficiencies, from the sheet's proficiency cards ──
  const profCats = [...new Set((d.__wpnProfCards || []).map(c => guessCategory(c.name)).filter(Boolean))];
  if (profCats.length) {
    d.__weaponProficiencies = profCats;
    flag('character', 'weapon-proficiencies', `Weapon proficiencies set to ${profCats.map(c => PHB_WEAPONS[c].name.replace(/\s*\(.*\)$/, '')).join(', ')} from your proficiency cards. Add any that are missing.`);
  } else {
    flag('character', 'weapon-proficiencies', 'Set which weapons this character is proficient in, so non-proficiency penalties apply.');
  }

  // ── Weapons ──
  const weapons = oldWeapons.map(old => {
    const w = { id: old.id, name: old.name || '' };
    const notes = [];
    if (old.notes) notes.push(old.notes);

    const category = guessCategory(old.name);
    if (category) {
      w.basedOn = category;
      flag('weapon', w.id, `Based on ${PHB_WEAPONS[category].name}? (guessed from the name)`);
    } else {
      w.modes = ['melee'];   // until the player picks a base weapon
      flag('weapon', w.id, `Pick the PHB weapon "${old.name || 'this weapon'}" is based on.`);
    }
    const base = category ? resolveWeapon({ id: '_', basedOn: category }) : {};

    // Speed and damage type: keep only if different from the PHB weapon.
    const speed = cleanNumber(old.speed);
    if (speed !== null && old.speed !== '' && speed !== base.speed) w.speed = speed;
    const type = TYPE_CODES[old.dmgType];
    if (type && !(base.damageTypes || []).includes(type)) w.damageTypes = [type];

    // Hit adjustment
    const hit = cleanNumber(old.hitAdj);
    if (old.hitAdj === '?') {
      w.unknown = true;
      flag('weapon', w.id, 'Hit adjustment was "?" — unidentified. Fill in once known.');
    } else if (hit === null) {
      notes.push(`old hit adj: ${old.hitAdj}`);
      flag('weapon', w.id, `Couldn't read hit adjustment "${old.hitAdj}". If it only applies sometimes, add it as a situational bonus.`);
    } else if (hit) {
      w.hitBonus = hit;
    }

    // Damage: dice must match the PHB; the flat part becomes a damage bonus.
    let dmgBonus = 0;
    const sizeName = { sm: 'S/M', l: 'L' };
    const flats = {};
    for (const [field, size] of [['dmgSM', 'sm'], ['dmgL', 'l']]) {
      if (!old[field]) continue;
      const dice = parseDice(old[field]);
      if (!dice) {
        notes.push(`old damage ${sizeName[size]}: ${old[field]}`);
        flag('weapon', w.id, `Couldn't read damage vs ${sizeName[size]} "${old[field]}".`);
        continue;
      }
      const phb = parseDice(base.damage?.[size]);
      // Anything beyond the PHB's own flat part (e.g. warhammer 1d4+1) is a bonus.
      flats[size] = dice.flat - (phb ? phb.flat : 0);
      if (phb && (phb.count !== dice.count || phb.sides !== dice.sides)) {
        flag('weapon', w.id, `Damage vs ${sizeName[size]} changed from ${old[field]} to the PHB's ${base.damage[size]}. Confirm, or set it back if this weapon is special.`);
      } else if (!phb) {
        w.damage = { ...(w.damage || {}), [size]: `${dice.count}d${dice.sides}` };
      }
    }
    if (flats.sm !== undefined) dmgBonus = flats.sm;
    if (flats.sm !== undefined && flats.l !== undefined && flats.sm !== flats.l) {
      flag('weapon', w.id, `Damage bonus differs vs S/M (${flats.sm}) and L (${flats.l}); kept ${flats.sm}.`);
    }
    const dmgAdj = cleanNumber(old.dmgAdj);
    if (old.dmgAdj === '?') {
      w.unknown = true;
      flag('weapon', w.id, 'Damage adjustment was "?" — unidentified. Fill in once known.');
    } else if (dmgAdj === null) {
      notes.push(`old dmg adj: ${old.dmgAdj}`);
      flag('weapon', w.id, `Couldn't read damage adjustment "${old.dmgAdj}". If it only applies sometimes, add it as a situational bonus.`);
    } else {
      dmgBonus += dmgAdj;
    }
    if (dmgBonus) w.dmgBonus = dmgBonus;

    if (/\+\d/.test(old.name || '')) {
      flag('weapon', w.id, `The name suggests a magic weapon. Set its magic plus so crits count it correctly.`);
    }
    if (notes.length) w.notes = notes.join(' | ');
    return w;
  });

  // ── Scenarios → attacks ──
  const specialAttacks = [];
  for (const sc of oldScenarios) {
    const oldWeapon = oldWeapons.find(w => w.id === sc.weaponId);
    const weapon = weapons.find(w => w.id === sc.weaponId);
    const attack = { id: sc.id, name: sc.name || undefined, thac0Group: sc.group };
    if (sc.levelMode === 'custom') { attack.levelMode = 'custom'; attack.customLevel = sc.customLevel; }
    if (sc.active) attack.active = true;

    if (!weapon) {
      specialAttacks.push({ ...attack, mods: [] });
      flag('attack', sc.id, `"${sc.name || 'Scenario'}" had no weapon. Link it to one, or keep it as a special attack.`);
      continue;
    }

    const modes = resolveWeapon(weapon).modes || ['melee'];
    attack.mode = guessMode(sc, modes);
    if (modes.length > 1) flag('attack', sc.id, `Is "${sc.name || 'this attack'}" ${attack.mode}? (guessed)`);
    attack.mods = [];
    if (sc.handedness === 'off') {
      attack.hand = 'off';
      const m = String(sc.offHandPenalty || '').match(/[+-]?\d+/);
      if (m && parseInt(m[0], 10)) attack.mods.push({ label: 'Off-hand', hit: -parseInt(m[0], 10) });
    }

    // Carry over only what v2 doesn't already add, so THAC0 stays the same.
    (weapon.attacks ||= []).push(attack);
    const oldT = oldScenarioTHAC0(d, sc, oldWeapon);
    const calc = computeAttack({ sheet: { ...d, __weapons: weapons }, weaponId: weapon.id, attackId: attack.id });
    // Racial bonuses and proficiency penalties are v2's own rules, not part of the old hit mod
    const ruled = calc.lines.filter(l => l.kind === 'racial' || l.kind === 'proficiency').reduce((s, l) => s + l.hit, 0);
    const newT = calc.thac0 === null ? null : calc.thac0 + ruled;
    if (oldT !== null && newT !== null && newT !== oldT) {
      attack.mods.push({ label: 'From old sheet', hit: newT - oldT });
      flag('attack', sc.id, `"${sc.name || 'This attack'}" carries ${newT - oldT > 0 ? '+' : ''}${newT - oldT} to hit from the old sheet's hit mod. Replace it with named bonuses (e.g. Signature Weapon), which can add damage too.`);
    }
    if (!attack.mods.length) delete attack.mods;
  }

  d.__weapons = weapons;
  d.__specialAttacks = specialAttacks;
  d.__combatBonuses = d.__combatBonuses || [];
  d.__combatOptions = d.__combatOptions || [];
  d.__review = review;
  delete d.__scenarios;
  delete d.__scenarioCounter;
  d.__version = 2;
  return d;
}
