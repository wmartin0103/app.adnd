// ── SHEET → DM HELPER ───────────────────────────────────────────
// Builds a character's entries for the DM Helper's config block
// (CHARACTERS, SKILLS, THIEF, SAVES, DAMAGE, CRIT_TYPES, WEAPON_MATERIAL) from
// a character sheet save, so the DM never hand-types PC stats again.
//
// Attacks come from the sheet's Combat section, worked out by the same code
// the sheet uses (rules/scenarios.js), so the DM sees the sheet's numbers:
//   - each weapon scenario is an attack (its weapon's speed for initiative)
//   - attacks per round past the first are extra-attack rows (3/2 → one row
//     on alternate rounds; 3/1 → two rows)
//   - off-hand scenarios are extra-attack rows
//   - spell scenarios are cast actions (cast time as speed; a THAC0 when the
//     spell needs an attack roll)
//   - effects that are on (stances, Bless …) count, as they do on the sheet,
//     and their AC bonus lowers the DM's AC for the character
//
// `dmSettings` carries the DM's own per-character choices that aren't on the
// sheet: { legacy, initBonus, parry, parryTargeted, armorSpell, virtue, turn,
// shield, actions }. They're copied onto the CHARACTERS entry as-is (the DM's
// own actions come after the sheet's spells).
// `options.catalog` is the campaign spell catalog, for spell scenarios.

import { migrateV1toV2, guessCategory } from '../rules/migrate.js';
import { baseTHAC0 } from '../rules/attacks.js';
import { armorClass, savingThrows, thiefSkills, proficiencyTargets } from '../rules/character.js';
import {
  scenarioContext, scenarioType, scenarioRate, rateValue, scenarioWeapon, scenarioSpell,
  scenarioBreakdown, scenarioDamage, effectsACBonus, effectOption, modNum, signed,
} from '../rules/scenarios.js';

const num = v => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

// What a weapon breaks as, for the DM Helper's item saves (crits and fumbles),
// following the DM's existing convention: blades are metal, hafted weapons
// thick wood, bows thin wood, slings leather.
const MATERIAL_BY_CATEGORY = {
  dagger: 'metal', knife: 'metal', dart: 'metal', 'short-sword': 'metal', 'long-sword': 'metal',
  'broad-sword': 'metal', 'bastard-sword': 'metal', scimitar: 'metal', 'two-handed-sword': 'metal',
  'battle-axe': 'woodThick', 'hand-axe': 'woodThick', club: 'woodThick', 'footmans-mace': 'woodThick',
  'horsemans-mace': 'woodThick', 'morning-star': 'woodThick', warhammer: 'woodThick', spear: 'woodThick',
  javelin: 'woodThick', harpoon: 'woodThick', 'lucern-hammer': 'woodThick', halberd: 'woodThick',
  'heavy-lance': 'woodThick', quarterstaff: 'woodThick',
  'short-bow': 'woodThin', 'long-bow': 'woodThin', 'composite-short-bow': 'woodThin',
  'composite-long-bow': 'woodThin', 'light-crossbow': 'woodThin', 'heavy-crossbow': 'woodThin',
  sling: 'leather',
};
// The sheet's damage type → the DM Helper's crit tables (P, S, B)
function critType(dmgType) {
  const t = String(dmgType || '').toLowerCase();
  const types = [/pierc|^p$/.test(t) && 'P', /slash|^s$/.test(t) && 'S', /blunt|bludg|crush|^b$/.test(t) && 'B'].filter(Boolean);
  if (!types.length) return 'B';
  return types.length > 1 ? types : types[0];
}
// A spell's cast time as an initiative speed: segments as written; a round or
// longer goes last (10)
export function castSpeed(castTime) {
  const t = String(castTime || '').toLowerCase();
  if (/round|turn|hour|day/.test(t)) return 10;
  const m = t.match(/\d+/);
  return m ? Math.min(parseInt(m[0], 10), 10) : null;
}

export function toDMHelper(save, dmSettings = {}, { catalog = null } = {}) {
  // Saves, skills and thief skills read the migrated sheet; attacks read the
  // save exactly as the sheet wrote it
  const sheet = (save.__version || 0) >= 2 ? save : migrateV1toV2(save);
  const name = (save.name || sheet.name || 'Unnamed').trim();
  const review = [];
  const ctx = scenarioContext(save, catalog);
  const level = ctx.level || 1;

  const weapons = {};
  const secondary = [];
  const actions = [];
  const damage = {};
  const critTypes = {};
  const material = {};
  const used = new Set();
  const unique = label => { let l = label, n = 2; while (used.has(l)) l = `${label} (${n++})`; used.add(l); return l; };

  // Damage for one row: the sheet's total, all of which a critical multiplies
  const recordWeapon = (label, sc, wpn) => {
    const dmg = scenarioDamage(ctx, sc);
    const clean = v => String(v).replace(/\s*\+\s*\?$/, '');
    if (dmg && dmg.sm !== '—') damage[`${name}|${label}`] = { sm: clean(dmg.sm), l: clean(dmg.l) };
    if (wpn.dmgAdj === '?' || wpn.hitAdj === '?') review.push(`${label}: ${wpn.name}'s bonus isn't revealed yet; left out`);
    critTypes[label] = critType(wpn.dmgType);
    const m = MATERIAL_BY_CATEGORY[guessCategory(wpn.name || '')];
    if (m) material[label] = { m };
  };

  for (const sc of save.__scenarios || []) {
    const type = scenarioType(sc);
    const bd = scenarioBreakdown(ctx, sc);

    if (type === 'spell') {
      const sp = scenarioSpell(ctx, sc);
      if (!sp) { review.push(`${sc.name || 'Spell scenario'}: no memorized spell chosen; left out`); continue; }
      const label = unique(sc.name || sp.name);
      const speed = castSpeed(sp.castTimeNow);
      if (speed === null) review.push(`${label}: no cast time; initiative speed defaults to 1`);
      actions.push({ name: label, thac0: bd ? bd.thac0 : null, speedMin: 0, speedMax: 10, speedDefault: speed ?? 1 });
      if (sp.dice) {
        if (sp.rolled) damage[`${name}|${label}`] = { sm: sp.rolled, l: sp.rolled };
        else review.push(`${label}: damage "${sp.dice}" isn't plain dice; roll it by hand`);
      }
      continue;
    }

    const wpn = scenarioWeapon(ctx, sc);
    if (!wpn || !bd) { review.push(`${sc.name || 'A scenario'}: no weapon chosen; left out`); continue; }
    const label = unique(sc.name || wpn.name);
    if (sc.handedness === 'off') {
      secondary.push({ name: label, thac0: bd.thac0 });
      recordWeapon(label, sc, wpn);
      continue;
    }
    weapons[label] = { thac0: bd.thac0, speed: num(wpn.speed) };
    recordWeapon(label, sc, wpn);

    // Attacks past the first: one row each; a half attack only on alternate rounds
    const extra = rateValue(scenarioRate(sc)) - 1;
    for (let k = 1; k <= Math.ceil(extra); k++) {
      const row = unique(`${label} (${ORDINAL[k]}${extra < k ? ', alt. rounds' : ''})`);
      secondary.push({ name: row, thac0: bd.thac0 });
      recordWeapon(row, sc, wpn);
    }
  }

  // ── The character entry ──
  const ac = armorClass(save);
  const acBonus = effectsACBonus(ctx);
  const effects = ctx.effects.filter(st => st.on).map(st => {
    const o = effectOption(st);
    const nums = [modNum(o.hit) && `${signed(modNum(o.hit))} hit`, modNum(o.dmg) && `${signed(modNum(o.dmg))} dmg`, modNum(o.ac) && `${signed(modNum(o.ac))} AC`].filter(Boolean);
    const from = [st.from && `from ${st.from}`, st.temporary && st.rounds && `${st.rounds} rounds left`].filter(Boolean);
    const said = nums.join(', ') === String(st.options.length > 1 ? (st.options[st.choice || 0] || {}).label : '').trim();
    return `${o.name || 'Effect'}${nums.length && !said ? ` (${nums.join(', ')})` : ''}${from.length ? ` · ${from.join(', ')}` : ''}${o.note ? ` · ${o.note}` : ''}`;
  });
  const groups = (save.__classes || []).map(c => [c.group, num(c.level)]);
  const thac0s = groups.map(([g, l]) => baseTHAC0(g, l)).filter(t => t !== null);
  const stats = Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => [k, num(save[k])]));
  const pct = String(save['str-pct'] ?? '').trim();
  const caster = (save.__spells || []).length > 0 || groups.some(([g]) => g === 'wizard' || g === 'priest');
  const quickness = (save.__nwps || []).some(p => /^quickness$/i.test((p.name || '').trim()));
  const { actions: dmActions, ...dmRest } = dmSettings;

  const character = {
    level,
    armor: { ac: ac.ac - acBonus, shieldless: ac.ac - acBonus, surprised: ac.surprised },
    baseTHAC0: thac0s.length ? Math.min(...thac0s) : 20,
    initBonus: 0,
    stats,
    ...(stats.str === 18 && pct ? { strPct: pct === '00' ? 100 : num(pct) } : {}),
    ...(caster ? {} : { caster: false }),
    ...(quickness ? { quickness: { bonus: -2 } } : {}),
    weapons,
    ...(secondary.length ? { secondary } : {}),
    ...(actions.length || dmActions ? { actions: [...actions, ...(dmActions || [])] } : {}),
    ...(effects.length ? { effects } : {}),
    ...dmRest,
  };

  const skills = Object.fromEntries(proficiencyTargets(sheet).map(p => {
    if (p.needsReview) review.push(`${p.name}: ${p.needsReview}`);
    return [p.name, { t: p.target, src: p.source }];
  }));
  const thief = Object.fromEntries(thiefSkills(sheet).filter(s => s.value > 0).map(s => [s.name, s.value]));
  const saves = savingThrows(sheet);

  return {
    name,
    character,
    skills,
    thief,
    saves: saves && { base: saves.base, mods: saves.mods, ...(saves.notes.length ? { note: saves.notes.join('; ') } : {}) },
    damage,
    critTypes,
    material,
    review,
  };
}

export function formatDMHelperConfig(list) {
  const js = v => JSON.stringify(v, null, 2).replace(/\n/g, '\n  ');
  const assign = (table, entries) => entries.length ? `Object.assign(${table}, {\n${entries.join(',\n')}\n});` : '';
  const entries = pick => list.flatMap(c => pick(c));
  const lines = [
    `/* ── Generated from character sheet saves: ${list.map(c => c.name).join(', ')} ──`,
    '   Paste just above:  const STORE_KEY=\'adnd-init-tracker\';',
    '   Replaces these characters\' hand-typed entries; other characters are untouched. */',
    assign('CHARACTERS', entries(c => [`  ${JSON.stringify(c.name)}: ${js(c.character)}`])),
    assign('SKILLS', entries(c => [`  ${JSON.stringify(c.name)}: ${js(c.skills)}`])),
    assign('THIEF', entries(c => Object.keys(c.thief).length ? [`  ${JSON.stringify(c.name)}: ${js(c.thief)}`] : [])),
    assign('SAVES', entries(c => c.saves ? [`  ${JSON.stringify(c.name)}: ${js(c.saves)}`] : [])),
    assign('DAMAGE', entries(c => Object.entries(c.damage).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`))),
    assign('CRIT_TYPES', entries(c => Object.entries(c.critTypes).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`))),
    assign('WEAPON_MATERIAL', entries(c => Object.entries(c.material).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`))),
  ].filter(Boolean);
  const reviews = list.filter(c => c.review.length);
  if (reviews.length) {
    lines.push('/* NEEDS REVIEW\n' + reviews.map(c => `   ${c.name}:\n` + c.review.map(r => `     - ${r}`).join('\n')).join('\n') + '\n*/');
  }
  return lines.join('\n') + '\n';
}
