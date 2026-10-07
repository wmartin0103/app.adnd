// ── SHEET → DM HELPER ───────────────────────────────────────────
// Builds a character's entries for the DM Helper's config block
// (CHARACTERS, SKILLS, THIEF, SAVES, DAMAGE, CRIT_TYPES) from a character
// sheet save, so the DM never hand-types PC stats again.
//
// Accepts a v1 save (runs the migration first) or a v2 save.
// `dmSettings` carries the DM's own per-character choices that aren't on the
// sheet: { legacy, initBonus, parry, parryTargeted, armorSpell, virtue, turn,
// shield, actions }. They're copied onto the CHARACTERS entry as-is.

import { migrateV1toV2 } from '../rules/migrate.js';
import { resolveWeapon } from '../rules/weapons.js';
import { computeAttack, weaponAttacks, effectiveLevel, baseTHAC0 } from '../rules/attacks.js';
import { armorClass, savingThrows, thiefSkills, proficiencyTargets } from '../rules/character.js';

const num = v => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th'];

// What a weapon breaks as, for the DM Helper's item saves (crits and fumbles),
// following the DM's existing convention: blades are metal, hafted weapons
// thick wood, bows thin wood, slings leather. A weapon's own `material`
// overrides it (e.g. a stone knife).
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
const aprValue = apr => { const [a, b] = String(apr).split('/').map(Number); return b ? a / b : a; };

export function toDMHelper(save, dmSettings = {}) {
  const sheet = (save.__version || 0) >= 2 ? save : migrateV1toV2(save);
  const name = (sheet.name || 'Unnamed').trim();
  const review = (sheet.__review || []).map(r => r.message);
  const level = effectiveLevel(sheet) || 1;

  // ── Attacks, grouped by weapon ──
  // Main-hand attacks with no extra modifiers of their own share one entry
  // per weapon (with melee/thrown modes when it has both). Attacks with their
  // own modifiers (e.g. Trick Throw) get their own entry. Off-hand attacks
  // become secondary attacks.
  const weapons = {};
  const secondary = [];
  const damage = {};
  const critTypes = {};
  const material = {};
  const entryFor = a => ({ thac0: a.thac0, speed: a.speed });
  const record = (label, a) => {
    damage[`${name}|${label}`] = { sm: a.damage.sm, l: a.damage.l, ...(a.magicPlus ? { plus: a.magicPlus } : {}) };
    const types = a.damageTypes.length ? a.damageTypes : ['B'];
    critTypes[label] = types.length > 1 ? types : types[0];
    const m = a.material || MATERIAL_BY_CATEGORY[a.category];
    if (m) material[label] = { m, ...(a.magicPlus ? { plus: a.magicPlus } : {}) };
    for (const r of a.needsReview) review.push(`${label}: ${r}`);
  };

  let primaryWeapon = null;
  for (const raw of sheet.__weapons || []) {
    const w = resolveWeapon(raw);
    if (w.carried === false) continue;
    const attacks = weaponAttacks({ ...raw, modes: w.modes }).map(a => ({
      def: a, calc: computeAttack({ sheet, weaponId: raw.id, attackId: a.id }),
    }));
    if (attacks.some(x => x.def.active)) primaryWeapon = { raw, w, attacks };

    const grouped = attacks.filter(x => x.calc.hand === 'main' && !(x.def.mods || []).length);
    const custom = attacks.filter(x => x.calc.hand === 'main' && (x.def.mods || []).length);
    const off = attacks.filter(x => x.calc.hand === 'off');

    if (grouped.length) {
      const byMode = {};
      for (const x of grouped) if (!byMode[x.calc.mode]) byMode[x.calc.mode] = x.calc;
      const modes = Object.keys(byMode);
      // A weapon used only thrown says so in its name ("Dagger x6, thrown")
      const label = modes.length === 1 && modes[0] === 'thrown' ? `${w.name}, thrown` : w.name;
      weapons[label] = modes.length > 1
        ? { modes: Object.fromEntries(modes.map(m => [m === 'missile' ? 'thrown' : m, entryFor(byMode[m])])) }
        : entryFor(byMode[modes[0]]);
      record(label, byMode[modes[0]]);
    }
    for (const x of custom) {
      weapons[x.calc.name] = entryFor(x.calc);
      record(x.calc.name, x.calc);
    }
    if (off.length) {
      const label = `Off-hand ${w.name}`;
      const byMode = {};
      for (const x of off) if (!byMode[x.calc.mode]) byMode[x.calc.mode] = x.calc;
      const modes = Object.keys(byMode);
      secondary.push(modes.length > 1
        ? { name: label, modes: Object.fromEntries(modes.map(m => [m, { thac0: byMode[m].thac0 }])) }
        : { name: label, thac0: byMode[modes[0]].thac0 });
      record(label, byMode[modes[0]]);
    }
  }

  // Extra attacks from attacks per round (e.g. 3/2 melee, 3/1 thrown), for the
  // sheet's current ("active") attack's weapon. Each extra attack is one row;
  // a mode with a half attack only gets it on alternate rounds.
  if (primaryWeapon) {
    const { w, attacks } = primaryWeapon;
    const byMode = {};
    for (const x of attacks) if (x.calc.hand === 'main' && !(x.def.mods || []).length && !byMode[x.calc.mode]) byMode[x.calc.mode] = x.calc;
    const extras = Object.fromEntries(Object.entries(byMode).map(([m, a]) => [m, aprValue(a.attacksPerRound) - 1]));
    const rows = Math.ceil(Math.max(0, ...Object.values(extras)));
    for (let k = 1; k <= rows; k++) {
      const modes = Object.keys(extras).filter(m => extras[m] > k - 1);
      const alt = modes.filter(m => extras[m] < k);
      const note = modes.length === 1
        ? `${modes[0]}${alt.length ? ', alt. rounds' : ''}`
        : alt.map(m => `${m} alt. rounds`).join(', ');
      const label = `${w.name} (${ORDINAL[k]}${note ? `; ${note}` : ''})`;
      secondary.push(modes.length > 1
        ? { name: label, modes: Object.fromEntries(modes.map(m => [m, { thac0: byMode[m].thac0 }])) }
        : { name: label, thac0: byMode[modes[0]].thac0 });
      record(label, byMode[modes[0]]);
    }
  }

  // ── The character entry ──
  const ac = armorClass(sheet);
  const groups = (sheet.__classes || []).map(c => [c.group, num(c.level)]);
  const thac0s = groups.map(([g, l]) => baseTHAC0(g, l)).filter(t => t !== null);
  const stats = Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => [k, num(sheet[k])]));
  const pct = String(sheet['str-pct'] ?? '').trim();
  const caster = (sheet.__spells || []).length > 0 || groups.some(([g]) => g === 'wizard' || g === 'priest');
  const quickness = (sheet.__nwps || []).some(p => /^quickness$/i.test((p.name || '').trim()));

  const character = {
    level,
    armor: { ac: ac.ac, shieldless: ac.ac, surprised: ac.surprised },
    baseTHAC0: thac0s.length ? Math.min(...thac0s) : 20,
    initBonus: 0,
    stats,
    ...(stats.str === 18 && pct ? { strPct: pct === '00' ? 100 : num(pct) } : {}),
    ...(caster ? {} : { caster: false }),
    ...(quickness ? { quickness: { bonus: -2 } } : {}),
    weapons,
    ...(secondary.length ? { secondary } : {}),
    ...dmSettings,
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

// Format converted characters as one block of JavaScript for the DM Helper.
// Paste it into dm-helper.html just above the line
//   const STORE_KEY='adnd-init-tracker';
// It replaces those characters' hand-typed entries and leaves everyone
// else's alone. Re-generate and re-paste whenever a sheet changes.
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
