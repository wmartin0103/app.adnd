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
import { classKit } from './kits.js';

// "+2", "-1", "−3", "2" → number; anything else → 0
export const modNum = v => {
  const m = String(v ?? '').replace('−', '-').match(/^\s*([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
export const signed = n => (n > 0 ? `+${n}` : `${n}`);
const num = v => parseInt(v, 10) || 0;

// Melee: Str to hit and damage · Thrown: Dex to hit, Str damage · Missile: Dex to hit
// Spell: a memorized spell (an attack roll only for touch or ranged spells)
// Spellarrow (Bowcaster kit): a bow shot that carries a spell
export const ATTACK_TYPES = { melee: 'Melee', thrown: 'Thrown', missile: 'Missile', spell: 'Spell', spellarrow: 'Spellarrow' };
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
    classes: save.__classes || [],
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
export const scenarioRate = sc => {
  if (sc.attackType === 'spellarrow') return '1/1';   // a Spellarrow is the round's only shot
  const r = String(sc.rate || '1').trim();
  return r.includes('/') ? r : `${r}/1`;
};
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
// Caster level is the level in the class that casts that kind of spell (PHB),
// not the character's highest level: a Bard 2 / Druid 5 casts druid spells
// at 5th level and wizard spells at 2nd. Paladins cast priest spells as
// level − 8 (from 9th), rangers as level − 7 (from 8th). House rule: a Blade
// casts as a bard two levels lower (Delayed Spellcasting).
const CASTS = {
  wizard: c => c.group === 'wizard' || /bard/i.test(c.name || ''),
  priest: c => c.group === 'priest' || /paladin|ranger/i.test(c.name || ''),
};
const classCasterLevel = c => {
  const name = c.name || '';
  const level = num(c.level);
  if (/paladin/i.test(name)) return level - 8;
  if (/ranger/i.test(name)) return level - 7;
  if (classKit(c) === 'blade') return level - 2;
  return level;
};
export function casterLevel(ctx, sc, spellType) {
  const levels = (ctx.classes || []).filter(c => (CASTS[spellType] || (() => false))(c)).map(classCasterLevel).filter(l => l > 0);
  return levels.length ? Math.max(...levels) : (ctx.level || 1);
}

// Spell dice at a caster level: "1d6/level" → "5d6", "1d8+1/level" → "1d8+5",
// "1d8 per 2 levels" → "3d8" at 6th. `maxLevel` is where the spell stops
// growing (Fireball: 10, so 10d6 at most). Null when it isn't dice we can work out.
export function diceAtLevel(dice, level, maxLevel = 0) {
  if (num(maxLevel) > 0) level = Math.min(level, num(maxLevel));
  const d = String(dice || '').replace(/\s+/g, '');
  let m = d.match(/^(\d*)d(\d+)\/level$/i);
  if (m) return `${(num(m[1]) || 1) * level}d${m[2]}`;
  m = d.match(/^(\d*d\d+)\+(\d+)\/level$/i);
  if (m) return `${m[1]}+${num(m[2]) * level}`;
  m = d.match(/^(\d*)d(\d+)per(\d+)levels?$/i);
  if (m) return `${Math.max((num(m[1]) || 1) * Math.floor(level / num(m[3])), 1)}d${m[2]}`;
  return /^\d*d\d+([+-]\d+)?$/i.test(d) ? d : null;
}

// House rule (Bowcaster kit): a spell not sent through an arrow takes 3
// longer to cast and does 1 less damage per die (at least 1 per die).
// "1d8+4" → "1d8+3", "5d6" → "5d6-5". A Spell scenario is an ordinary cast.
export const isBowcaster = ctx => (ctx.classes || []).some(c => classKit(c) === 'bowcaster');
export function lessPerDie(dice) {
  const m = String(dice || '').replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return dice;
  const flat = num(m[3]) - (num(m[1]) || 1);
  return `${m[1]}d${m[2]}${flat ? (flat > 0 ? `+${flat}` : flat) : ''}`;
}
const slowerCast = t => (/^\s*\d+\s*$/.test(String(t)) ? String(num(t) + 3) : t);

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
  const level = casterLevel(ctx, sc, sp.type || (cat && cat.class) || '');
  const dice = pick('dice');
  const rolled = dice ? diceAtLevel(dice, level, pick('diceMaxLevel')) : '';
  // The penalty is for casting the ordinary way; a Spellarrow doesn't take it
  const bowcaster = isBowcaster(ctx) && scenarioType(sc) === 'spell';
  return {
    sheet: sp, catalog: cat,
    name: sp.name, castTime: pick('castTime'), range: pick('range'), save: pick('save'), dice, diceMaxLevel: pick('diceMaxLevel'),
    // As written above; as cast below: the dice at this caster's level (or as
    // written when they can't be worked out) and the casting time, after any
    // house-rule penalty
    casterLevel: level, rolled: bowcaster && rolled ? lessPerDie(rolled) : rolled,
    castTimeNow: bowcaster ? slowerCast(pick('castTime')) : pick('castTime'),
    penalty: bowcaster ? 'Cast without an arrow: casting time +3, −1 damage per die' : '',
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

// A spell's casting time as an initiative speed: segments as written; a round
// or longer goes last (10). Null when it isn't written as either.
export function castSpeed(castTime) {
  const t = String(castTime || '').toLowerCase();
  if (/round|\brds?\b|turn|hour|day/.test(t)) return 10;
  const m = t.match(/\d+/);
  return m ? Math.min(parseInt(m[0], 10), 10) : null;
}

// ── Spellarrows (Bowcaster kit, docs/house-rules/bowcaster.md) ──
// Any memorized spell can go on the arrow: which spells qualify (touch,
// point-of-origin, self-origin by level) is left to the player and the DM.
// The spell on a Spellarrow, cast at full strength, and the shot's speed: the
// bow's plus the casting time. (A pre-fletched Spellfletching arrow is fired as
// an ordinary bow attack; the table handles its spell.)
export function spellArrow(ctx, sc) {
  if (scenarioType(sc) !== 'spellarrow') return null;
  const sp = scenarioSpell(ctx, sc);
  const wpn = scenarioWeapon(ctx, sc);
  const bow = wpn ? num(wpn.speed) : 0;
  const cast = sp ? (castSpeed(sp.castTime) ?? 0) : 0;
  return { spell: sp, bowSpeed: bow, castSpeed: cast, speed: bow + cast };
}

// ── Arrows ──
// A bow's damage depends on the arrow (PHB): flight arrows 1d6 / 1d6, sheaf
// arrows 1d8 / 1d8. A bow scenario can say which it shoots (`ammo`); without
// one, the weapon row's own dice are used, as before.
export const ARROWS = { flight: { name: 'Flight arrows', sm: '1d6', l: '1d6' }, sheaf: { name: 'Sheaf arrows', sm: '1d8', l: '1d8' } };
export const isBow = wpn => !!wpn && /bow/i.test(wpn.name || '') && !/crossbow/i.test(wpn.name || '');
// The weapon's base dice for this scenario: the arrow's, or the row's
export function scenarioDice(ctx, sc) {
  const wpn = scenarioWeapon(ctx, sc);
  if (!wpn) return null;
  const arrow = isBow(wpn) && ARROWS[sc.ammo];
  return arrow ? { sm: arrow.sm, l: arrow.l, ammo: arrow.name } : { sm: wpn.dmgSM, l: wpn.dmgL, ammo: '' };
}

export const scenarioWeapon = (ctx, sc) =>
  scenarioType(sc) !== 'spell' && sc.weaponId ? ctx.weapons.find(w => w.id === sc.weaponId) || null : null;

// Damage vs S/M and L: weapon dice and adjustment, ability, Dmg Mod, effects
export function scenarioDamage(ctx, sc) {
  if (scenarioType(sc) === 'spell') {
    const sp = scenarioSpell(ctx, sc);
    const dice = sp && (sp.rolled || sp.dice);
    return dice ? { sm: dice, l: dice, heal: sp.heal, casterLevel: sp.casterLevel } : null;
  }
  const wpn = scenarioWeapon(ctx, sc);
  if (!wpn) return null;
  const extra = modNum(wpn.dmgAdj) + scenarioAbility(ctx, sc).dmg + modNum(sc.dmgMod)
    + activeEffectsFor(ctx, sc).reduce((t, st) => t + modNum(st.dmg), 0);
  const dice = raw => {
    const m = String(raw || '').trim().match(/^(\d*d\d+)\s*(?:([+-])\s*(\d+))?$/i);
    if (!m) return raw ? String(raw) : '—';
    const flat = (m[2] === '-' ? -1 : 1) * (parseInt(m[3] || '0', 10)) + extra;
    const text = flat ? `${m[1]}${flat > 0 ? '+' : ''}${flat}` : m[1];
    return wpn.dmgAdj === '?' ? `${text} + ?` : text;
  };
  const base = scenarioDice(ctx, sc);
  const out = { sm: dice(base.sm), l: dice(base.l) };
  // A Spellarrow: the arrow's damage, and the spell's on contact
  const arrow = spellArrow(ctx, sc);
  if (arrow && arrow.spell) Object.assign(out, { spell: arrow.spell.rolled || arrow.spell.dice || '', spellHeals: arrow.spell.heal, casterLevel: arrow.spell.casterLevel });
  return out;
}

// Where a scenario's numbers come from: the base THAC0, then one line per
// source with its to-hit and damage. THAC0 is worked out from these lines, so
// the "How it adds up" table and the result always agree. Null when there's no
// attack roll (a spell the target saves against, or an unknown class group).
export function scenarioBreakdown(ctx, sc) {
  const level = ctx.level || 1;
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
    if (wpn.hitAdj === '?' || wpn.dmgAdj === '?') lines.push({ label: `${wpn.name || 'Weapon'}: not revealed yet`, hit: wpn.hitAdj === '?' ? '?' : 0, dmg: wpn.dmgAdj === '?' ? '?' : 0, kind: 'unknown' });
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
  return { base, lines, wpn, dice: scenarioDice(ctx, sc), thac0: base.thac0 - hit, hit, unknownHit: !!(wpn && wpn.hitAdj === '?') };
}

export function scenarioTHAC0(ctx, sc) {
  const bd = scenarioBreakdown(ctx, sc);
  return bd ? bd.thac0 : null;
}
