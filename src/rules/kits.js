// ── House-rule kits ─────────────────────────────────────────────
// Kits the campaign wrote its own rules for, which the tools work out. Any
// other kit (standard or from a handbook) needs nothing here: its abilities
// are announced at the table. A class chooses one in its settings (`kit`).
//   docs/house-rules/blade-revised.md, docs/house-rules/bowcaster.md

export const HOUSE_KITS = {
  blade: { name: 'Blade', for: 'Bard', adds: 'Casts spells as a bard two levels lower' },
  bowcaster: { name: 'Bowcaster', for: 'Wizard', adds: 'Spellarrow attacks; casting without an arrow takes 3 longer and does 1 less damage per die' },
};

// The class's house-rule kit, or ''. Saves from before the setting existed
// (no `kit` at all) go by the class name, so "Blade Bard" and "Wizard
// (Bowcaster)" keep their rules; once a kit is chosen, even None, the name
// no longer matters.
export function classKit(c) {
  if (c && typeof c.kit === 'string') return HOUSE_KITS[c.kit] ? c.kit : '';
  const name = String((c && c.name) || '').toLowerCase();
  return Object.keys(HOUSE_KITS).find(k => name.includes(k)) || '';
}
