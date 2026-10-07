// ── WEAPONS ─────────────────────────────────────────────────────
// Every weapon traces back to a PHB weapon through `basedOn`. That root PHB
// weapon is its **category**, which is what racial bonuses, Signature Weapon,
// and proficiencies match against. Campaign and sheet weapons store only what
// differs from the weapon they're based on.
//
//   PHB "dagger"  ←  campaign "Stone Knife"?  ←  sheet "Superior Dagger"
//   category: dagger (always the root)
//
// Fields (all optional on anything that has `basedOn`):
//   name, size (S/M/L), damageTypes (B/P/S), speed,
//   damage { sm, l } (dice only), modes (melee/thrown/missile),
//   range { s, m, l } in tens of yards, rateOfFire (missile/thrown),
//   hitBonus, dmgBonus (non-magic quality), magicPlus (enchantment +N),
//   conditional [{ label, hit, dmg }] (situational, never auto-applied),
//   unknown (true = unidentified, e.g. "?"), carried (false = hidden in combat)

// PHB Table 44, first pass: common weapons plus everything the current party
// uses. TODO before release: spot-check every row against the book, then add
// the remaining polearms and exotic weapons.
export const PHB_WEAPONS = {
  'battle-axe':        { name: 'Battle axe',        size: 'M', damageTypes: ['S'], speed: 7, damage: { sm: '1d8',   l: '1d8'   }, modes: ['melee'] },
  'club':              { name: 'Club',              size: 'M', damageTypes: ['B'], speed: 4, damage: { sm: '1d6',   l: '1d3'   }, modes: ['melee', 'thrown'], range: { s: 1, m: 2, l: 3 }, rateOfFire: '1' },
  'dagger':            { name: 'Dagger',            size: 'S', damageTypes: ['P'], speed: 2, damage: { sm: '1d4',   l: '1d3'   }, modes: ['melee', 'thrown'], range: { s: 1, m: 2, l: 3 }, rateOfFire: '2/1' },
  'dart':              { name: 'Dart',              size: 'S', damageTypes: ['P'], speed: 2, damage: { sm: '1d3',   l: '1d2'   }, modes: ['thrown'], range: { s: 1, m: 2, l: 4 }, rateOfFire: '3/1' },
  'hand-axe':          { name: 'Hand axe',          size: 'M', damageTypes: ['S'], speed: 4, damage: { sm: '1d6',   l: '1d4'   }, modes: ['melee', 'thrown'], range: { s: 1, m: 2, l: 3 }, rateOfFire: '1' },
  'harpoon':           { name: 'Harpoon',           size: 'L', damageTypes: ['P'], speed: 7, damage: { sm: '2d4',   l: '2d6'   }, modes: ['melee', 'thrown'], range: { s: 1, m: 2, l: 3 }, rateOfFire: '1' },
  'horsemans-mace':    { name: "Horseman's mace",   size: 'M', damageTypes: ['B'], speed: 6, damage: { sm: '1d6',   l: '1d4'   }, modes: ['melee'] },
  'footmans-mace':     { name: "Footman's mace",    size: 'M', damageTypes: ['B'], speed: 7, damage: { sm: '1d6+1', l: '1d6'   }, modes: ['melee'] },
  'javelin':           { name: 'Javelin',           size: 'M', damageTypes: ['P'], speed: 4, damage: { sm: '1d6',   l: '1d6'   }, modes: ['melee', 'thrown'], range: { s: 2, m: 4, l: 6 }, rateOfFire: '1' },
  'knife':             { name: 'Knife',             size: 'S', damageTypes: ['P', 'S'], speed: 2, damage: { sm: '1d3', l: '1d2' }, modes: ['melee', 'thrown'], range: { s: 1, m: 2, l: 3 }, rateOfFire: '2/1' },
  'heavy-lance':       { name: 'Heavy horse lance', size: 'L', damageTypes: ['P'], speed: 8, damage: { sm: '1d8+1', l: '3d6'   }, modes: ['melee'] },
  'lucern-hammer':     { name: 'Lucern hammer',     size: 'L', damageTypes: ['P', 'B'], speed: 9, damage: { sm: '2d4', l: '1d6' }, modes: ['melee'] },
  'halberd':           { name: 'Halberd',           size: 'L', damageTypes: ['P', 'S'], speed: 9, damage: { sm: '1d10', l: '2d6' }, modes: ['melee'] },
  'morning-star':      { name: 'Morning star',      size: 'M', damageTypes: ['B'], speed: 7, damage: { sm: '2d4',   l: '1d6+1' }, modes: ['melee'] },
  'quarterstaff':      { name: 'Quarterstaff',      size: 'L', damageTypes: ['B'], speed: 4, damage: { sm: '1d6',   l: '1d6'   }, modes: ['melee'] },
  'spear':             { name: 'Spear',             size: 'M', damageTypes: ['P'], speed: 6, damage: { sm: '1d6',   l: '1d8'   }, modes: ['melee', 'thrown'], range: { s: 1, m: 2, l: 3 }, rateOfFire: '1' },
  'warhammer':         { name: 'Warhammer',         size: 'M', damageTypes: ['B'], speed: 4, damage: { sm: '1d4+1', l: '1d4'   }, modes: ['melee', 'thrown'], range: { s: 1, m: 2, l: 3 }, rateOfFire: '1' },
  'bastard-sword':     { name: 'Bastard sword',     size: 'M', damageTypes: ['S'], speed: 6, damage: { sm: '1d8',   l: '1d12'  }, modes: ['melee'] },
  'broad-sword':       { name: 'Broad sword',       size: 'M', damageTypes: ['S'], speed: 5, damage: { sm: '2d4',   l: '1d6+1' }, modes: ['melee'] },
  'long-sword':        { name: 'Long sword',        size: 'M', damageTypes: ['S'], speed: 5, damage: { sm: '1d8',   l: '1d12'  }, modes: ['melee'] },
  'scimitar':          { name: 'Scimitar',          size: 'M', damageTypes: ['S'], speed: 5, damage: { sm: '1d8',   l: '1d8'   }, modes: ['melee'] },
  'short-sword':       { name: 'Short sword',       size: 'S', damageTypes: ['P'], speed: 3, damage: { sm: '1d6',   l: '1d8'   }, modes: ['melee'] },
  'two-handed-sword':  { name: 'Two-handed sword',  size: 'L', damageTypes: ['S'], speed: 10, damage: { sm: '1d10', l: '3d6'   }, modes: ['melee'] },
  // Missile weapons: damage shown is for the standard ammunition.
  'short-bow':           { name: 'Short bow (flight arrow)',           size: 'M', damageTypes: ['P'], speed: 7, damage: { sm: '1d6', l: '1d6' }, modes: ['missile'], range: { s: 5, m: 10, l: 15 }, rateOfFire: '2/1' },
  'long-bow':            { name: 'Long bow (flight arrow)',            size: 'L', damageTypes: ['P'], speed: 8, damage: { sm: '1d6', l: '1d6' }, modes: ['missile'], range: { s: 7, m: 14, l: 21 }, rateOfFire: '2/1' },
  'composite-short-bow': { name: 'Composite short bow (flight arrow)', size: 'M', damageTypes: ['P'], speed: 6, damage: { sm: '1d6', l: '1d6' }, modes: ['missile'], range: { s: 5, m: 10, l: 18 }, rateOfFire: '2/1' },
  'composite-long-bow':  { name: 'Composite long bow (flight arrow)',  size: 'L', damageTypes: ['P'], speed: 7, damage: { sm: '1d6', l: '1d6' }, modes: ['missile'], range: { s: 6, m: 12, l: 21 }, rateOfFire: '2/1' },
  'light-crossbow':      { name: 'Light crossbow',                     size: 'M', damageTypes: ['P'], speed: 7, damage: { sm: '1d4', l: '1d4' }, modes: ['missile'], range: { s: 6, m: 12, l: 18 }, rateOfFire: '1' },
  'heavy-crossbow':      { name: 'Heavy crossbow',                     size: 'M', damageTypes: ['P'], speed: 10, damage: { sm: '1d4+1', l: '1d6+1' }, modes: ['missile'], range: { s: 8, m: 16, l: 24 }, rateOfFire: '1/2' },
  'sling':               { name: 'Sling (bullet)',                     size: 'S', damageTypes: ['B'], speed: 6, damage: { sm: '1d4+1', l: '1d6+1' }, modes: ['missile'], range: { s: 5, m: 10, l: 20 }, rateOfFire: '1' },
  // Ammunition variants: same category as their launcher, different damage.
  'sling-stone':         { basedOn: 'sling', name: 'Sling (stone)', damage: { sm: '1d4', l: '1d4' }, range: { s: 4, m: 8, l: 16 } },
  'long-bow-sheaf':      { basedOn: 'long-bow', name: 'Long bow (sheaf arrow)', damage: { sm: '1d8', l: '1d8' } },
  'short-bow-sheaf':     { basedOn: 'short-bow', name: 'Short bow (sheaf arrow)', damage: { sm: '1d8', l: '1d8' } },
};

const MERGED_FIELDS = [
  'name', 'size', 'damageTypes', 'speed', 'modes', 'range', 'rateOfFire',
  'hitBonus', 'dmgBonus', 'magicPlus', 'conditional', 'unknown', 'carried', 'notes', 'material',
];

// Look up a weapon by key in the PHB list, then in the campaign list.
function findBase(key, campaignWeapons) {
  return PHB_WEAPONS[key] || campaignWeapons[key] || null;
}

// Follow the `basedOn` chain and merge fields, nearest weapon winning.
// Returns the full weapon plus:
//   category  — the PHB key at the root of the chain (null if it never reaches one)
//   lineage   — names from root to this weapon, e.g. ['Dagger', 'Superior Dagger']
export function resolveWeapon(weapon, campaignWeapons = {}) {
  const chain = [weapon];
  let category = null;
  let key = weapon.basedOn;
  const seen = new Set();
  while (key && !seen.has(key)) {
    seen.add(key);
    const base = findBase(key, campaignWeapons);
    if (!base) break;
    chain.unshift(base);
    if (PHB_WEAPONS[key] && !PHB_WEAPONS[key].basedOn) category = key;
    key = base.basedOn;
  }

  const out = { hitBonus: 0, dmgBonus: 0, magicPlus: 0, conditional: [], unknown: false, carried: true };
  for (const w of chain) {
    for (const f of MERGED_FIELDS) if (w[f] !== undefined) out[f] = w[f];
    // Damage merges per size, so a sheet can override just one column.
    if (w.damage) out.damage = { ...(out.damage || {}), ...w.damage };
  }
  out.id = weapon.id;
  out.category = category;
  out.lineage = chain.map(w => w.name).filter(Boolean);
  return out;
}
