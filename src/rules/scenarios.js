// ── COMBAT SCENARIOS ────────────────────────────────────────────
// A character's ways of attacking, as the sheet's Combat section saves them
// (`__scenarios`), worked out into THAC0, damage and attacks per round. The
// sheet and the DM Helper both use this, so they always show the same numbers.
//
// Everything works from a "context": the parts of a character the math needs.
// `scenarioContext(save)` builds it from a sheet save; the sheet builds its own
// from what's on screen.

import { STR_TABLE, STR_EXCEPTIONAL, DEX_TABLE, THAC0_TABLE } from './tables.js';
import { findSpell } from './spells.js';

// "+2", "-1", "−3", "2" → number; anything else → 0
export const modNum = v => {
  const m = String(v ?? '').replace('−', '-').match(/^\s*([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
export const signed = n => (n > 0 ? `+${n}` : `${n}`);
const num = v => parseInt(v, 10) || 0;

// Melee: Str to hit and damage · Thrown: Dex to hit, Str damage · Missile: Dex to hit
// Spell: a memorized spell (an attack roll only for touch or ranged spells)
export const ATTACK_TYPES = { melee: 'Melee', thrown: 'Thrown', missile: 'Missile', spell: 'Spell' };
export const RATE_OPTIONS = ['1/1', '3/2', '2/1', '5/2', '3/1', '7/2', '4/1', '5/1'];
const GROUP_LABELS = { warrior: 'Warrior', priest: 'Priest', rogue: 'Rogue', wizard: 'Wizard' };

// The sheet's racial weapon bonuses (by words in the weapon's name), with the
// trait ids the sheet uses to switch them on and off
const RACIAL_WEAPON_TRAITS = {
  halfling: [{ id: 'hl-attack-bonus', hit: 1, weapons: ['sling', 'thrown'] }],
  elf: [
    { id: 'el-bow-bonus', hit: 1, weapons: ['long bow', 'short bow'] },
    { id: 'el-sword-bonus', hit: 1, weapons: ['long sword', 'short sword'] },
  ],
};
export function racialWeaponBonus(raceGroup, traitState, weaponName) {
  const name = String(weaponName || '').toLowerCase().trim();
  return (RACIAL_WEAPON_TRAITS[raceGroup] || [])
    .filter(t => (traitState || {})[t.id]?.active !== false)
    .filter(t => t.weapons.some(w => w !== 'thrown' && name.includes(w)))
    .reduce((total, t) => total + t.hit, 0);
}

// Strength to-hit and damage, including 18/xx
export function strengthRow(str, pct) {
  const score = num(str);
  const raw = String(pct ?? '').trim();
  const p = raw === '00' ? 100 : Math.min(num(raw), 100);
  if (score === 18 && p > 0) return STR_EXCEPTIONAL.find(r => p <= r.upTo) || STR_EXCEPTIONAL.at(-1);
  return STR_TABLE[score] || { hit: 0, dmg: 0 };
}

// Built from a sheet save. `catalog` is the campaign spell catalog, for spells.
export function scenarioContext(save, catalog = null) {
  const levels = (save.__classes || []).map(c => num(c.level)).filter(l => l > 0);
  const str = strengthRow(save.str, save['str-pct']);
  const raceGroup = save['race-group'] || 'human';
  return {
    level: levels.length ? Math.max(...levels) : 0,
    str: { hit: str.hit, dmg: str.dmg },
    dexMissile: (DEX_TABLE[num(save.dex)] || { missile: 0 }).missile,
    racialHit: name => racialWeaponBonus(raceGroup, save.__traitState, name),
    weapons: save.__weapons || [],
    spells: save.__spells || [],
    effects: normalizeEffects(save.__stances),
    catalog,
  };
}

// Older saves wrote whole numbers ("3"); the PHB writes 3/1
export const scenarioRate = sc => { const r = String(sc.rate || '1').trim(); return r.includes('/') ? r : `${r}/1`; };
export const rateValue = rate => { const [a, b] = String(rate).split('/').map(Number); return b ? a / b : (a || 1); };

// Older scenarios have no attack type; read it from the name
export function scenarioType(sc) {
  if (sc.attackType) return sc.attackType;
  const n = (sc.name || '').toLowerCase();
  return /thrown|throw/.test(n) ? 'thrown' : /bow|sling|missile|crossbow/.test(n) ? 'missile' : 'melee';
}

// ── Effects (stances and temporary effects) ──
// Each is a card with one or more options; `choice` is the option in use.
// Older saves had one flat entry per option, grouped by `group`.
const blankOption = () => ({ label: '', hit: '', dmg: '', ac: '', note: '' });
export function normalizeEffects(list) {
  const out = [];
  (list || []).forEach(st => {
    if (Array.isArray(st.options)) { out.push(st); return; }
    const opt = { ...blankOption(), label: st.group ? String(st.name || '').replace(new RegExp(`^${st.group}:?\\s*`), '') : '',
                  hit: st.hit ?? '', dmg: st.dmg ?? '', ac: st.ac ?? '', note: st.note ?? '' };
    const same = st.group && out.find(o => o.group === st.group);
    if (same) {
      same.options.push(opt);
      if (st.on) { same.on = true; same.choice = same.options.length - 1; }
    } else {
      out.push({ id: st.id, name: st.group || st.name, group: st.group, on: !!st.on, choice: 0, options: [opt],
                 target: st.target || 'all', temporary: !!st.temporary, from: st.from || '', rounds: st.rounds || '' });
    }
  });
  out.forEach(st => delete st.group);
  return out;
}
// The chosen option's numbers
export function effectOption(st) {
  const o = st.options[Math.min(st.choice || 0, st.options.length - 1)] || blankOption();
  return { name: st.options.length > 1 ? `${st.name}: ${o.label || 'option'}` : st.name, hit: o.hit, dmg: o.dmg, ac: o.ac, note: o.note };
}
// Effects that are on and apply to this scenario's weapon
export function activeEffectsFor(ctx, sc) {
  return ctx.effects.filter(st => st.on && (st.target === 'all' || !st.target || st.target === sc.weaponId)).map(effectOption);
}
// How much the effects that are on improve AC
export function effectsACBonus(ctx) {
  return ctx.effects.filter(st => st.on).reduce((t, st) => t + modNum(effectOption(st).ac), 0);
}

// ── Spells ──
// A Spell attack reads the spell's casting details from the catalog;
// anything different is kept on the scenario.
export function scenarioSpell(ctx, sc) {
  const sp = ctx.spells.find(x => x.id === sc.spellId);
  if (!sp) return null;
  const source = sp.sourceId ? ctx.spells.find(x => x.id === sp.sourceId) : null;
  const catalogId = sp.catalogId || (source && source.catalogId);
  const cat = !ctx.catalog ? null
    : (catalogId && ctx.catalog.spells.find(e => e.id === catalogId)) || findSpell(ctx.catalog, sp, sp.type);
  const own = sc.spell || {};
  const pick = k => (own[k] !== undefined && own[k] !== '' ? own[k] : (cat && cat[k]) || '');
  return {
    sheet: sp, catalog: cat,
    name: sp.name, castTime: pick('castTime'), range: pick('range'), save: pick('save'), dice: pick('dice'),
    attack: pick('attack') || 'none', heal: (cat && cat.diceKind === 'heal') || /cure|heal/i.test(sp.name),
    link: (cat && cat.link) || sp.url || '',
  };
}

// The ability score part: Str for melee; Dex missile adj. to hit for thrown and
// missile; Str damage for melee and thrown only
export function scenarioAbility(ctx, sc) {
  const type = scenarioType(sc);
  if (type === 'melee') return { hitLabel: 'STR Adj.', hit: ctx.str.hit, dmg: ctx.str.dmg };
  if (type === 'spell') {
    const att = (scenarioSpell(ctx, sc) || {}).attack;
    if (att === 'touch') return { hitLabel: 'STR Adj.', hit: ctx.str.hit, dmg: 0 };
    if (att === 'ranged') return { hitLabel: 'DEX Missile', hit: ctx.dexMissile, dmg: 0 };
    return { hitLabel: '', hit: 0, dmg: 0 };
  }
  return { hitLabel: 'DEX Missile', hit: ctx.dexMissile, dmg: type === 'thrown' ? ctx.str.dmg : 0 };
}

export const scenarioWeapon = (ctx, sc) =>
  scenarioType(sc) !== 'spell' && sc.weaponId ? ctx.weapons.find(w => w.id === sc.weaponId) || null : null;

// A weapon's magic bonus ("+1 weapon": +1 to hit and damage), kept apart from
// its other adjustments (e.g. a superior weapon's +1) so a critical can treat
// it differently. "?" is a bonus the DM hasn't revealed.
export const weaponMagic = wpn => modNum(wpn && wpn.magic);
const unrevealed = wpn => ({ hit: wpn.hitAdj === '?' || wpn.magic === '?', dmg: wpn.dmgAdj === '?' || wpn.magic === '?' });

// Damage vs S/M and L: weapon dice, adjustment and magic, ability, Dmg Mod, effects
export function scenarioDamage(ctx, sc) {
  if (scenarioType(sc) === 'spell') {
    const sp = scenarioSpell(ctx, sc);
    return sp && sp.dice ? { sm: sp.dice, l: sp.dice, heal: sp.heal } : null;
  }
  const wpn = scenarioWeapon(ctx, sc);
  if (!wpn) return null;
  const extra = modNum(wpn.dmgAdj) + weaponMagic(wpn) + scenarioAbility(ctx, sc).dmg + modNum(sc.dmgMod)
    + activeEffectsFor(ctx, sc).reduce((t, st) => t + modNum(st.dmg), 0);
  const dice = raw => {
    const m = String(raw || '').trim().match(/^(\d*d\d+)\s*(?:([+-])\s*(\d+))?$/i);
    if (!m) return raw ? String(raw) : '—';
    const flat = (m[2] === '-' ? -1 : 1) * (parseInt(m[3] || '0', 10)) + extra;
    const text = flat ? `${m[1]}${flat > 0 ? '+' : ''}${flat}` : m[1];
    return unrevealed(wpn).dmg ? `${text} + ?` : text;
  };
  return { sm: dice(wpn.dmgSM), l: dice(wpn.dmgL) };
}

// Where a scenario's numbers come from: the base THAC0, then one line per
// source with its to-hit and damage. THAC0 is worked out from these lines, so
// the "How it adds up" table and the result always agree. Null when there's no
// attack roll (a spell the target saves against, or an unknown class group).
export function scenarioBreakdown(ctx, sc) {
  const level = sc.levelMode === 'custom' ? (num(sc.customLevel) || 1) : (ctx.level || 1);
  const table = THAC0_TABLE[sc.group];
  if (!table) return null;
  const base = { label: `Base THAC0 · ${GROUP_LABELS[sc.group]}, level ${level}`, thac0: table[Math.min(Math.max(level, 1), 20) - 1] };
  const lines = [];
  const add = (label, hit, dmg, kind) => { if (hit || dmg) lines.push({ label, hit, dmg, kind }); };
  const isSpell = scenarioType(sc) === 'spell';
  if (isSpell) {
    const sp = scenarioSpell(ctx, sc);
    if (!sp || sp.attack === 'none') return null;
    base.label += ` · ${sp.attack} spell attack`;
  }
  const wpn = scenarioWeapon(ctx, sc);
  if (wpn) {
    const m = String(wpn.hitAdj || '').match(/^[+-]?\d+$/);
    add(wpn.name || 'Weapon', m ? parseInt(m[0], 10) : 0, modNum(wpn.dmgAdj), 'weapon');
    add(`${wpn.name || 'Weapon'}: magic`, weaponMagic(wpn), weaponMagic(wpn), 'magic');
    const unk = unrevealed(wpn);
    if (unk.hit || unk.dmg) lines.push({ label: `${wpn.name || 'Weapon'}: not revealed yet`, hit: unk.hit ? '?' : 0, dmg: unk.dmg ? '?' : 0, kind: 'unknown' });
  }
  const abil = scenarioAbility(ctx, sc);
  const abilName = abil.hitLabel === 'STR Adj.' ? 'Strength' : scenarioType(sc) === 'thrown' ? 'Dexterity (missile), Strength damage' : 'Dexterity (missile)';
  add(abilName, abil.hit, abil.dmg, 'ability');
  if (wpn && wpn.name) add('Racial bonus', ctx.racialHit(wpn.name), 0, 'racial');
  if (!isSpell && sc.handedness === 'off' && sc.offHandPenalty) {
    const m = sc.offHandPenalty.toString().match(/[+-]?\d+/);
    if (m) add('Off-hand', -parseInt(m[0], 10), 0, 'offhand');
  }
  let hitMod = 0;
  const hm = String(sc.hitMod || '').match(/^([+-]?)(\d+)$/);
  if (hm) hitMod = (hm[1] === '-' ? -1 : 1) * parseInt(hm[2], 10);
  add(isSpell ? 'Your bonus (Hit Mod)' : 'Your bonus (Hit Mod, Dmg Mod)', hitMod, isSpell ? 0 : modNum(sc.dmgMod), 'mods');
  activeEffectsFor(ctx, sc).forEach(st => add(st.name || 'Effect', modNum(st.hit), modNum(st.dmg), 'effect'));
  const hit = lines.reduce((t, l) => t + (typeof l.hit === 'number' ? l.hit : 0), 0);
  return { base, lines, wpn, thac0: base.thac0 - hit, hit, unknownHit: !!(wpn && unrevealed(wpn).hit) };
}

export function scenarioTHAC0(ctx, sc) {
  const bd = scenarioBreakdown(ctx, sc);
  return bd ? bd.thac0 : null;
}
