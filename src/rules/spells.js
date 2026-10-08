// The campaign's shared spell catalog (data/spell-catalog.json): one short
// stat block per spell, used by every character. Sheets keep their own spell
// entries (name, level, memorized, notes); this finds the matching stat block.

const key = s => String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// The catalog entry for a sheet spell: by name or alias, preferring the
// spell's class (wizard/priest) when the name is used by both (Light).
export function findSpell(catalog, sheetSpell, spellClass) {
  const k = key(sheetSpell.name);
  const matches = (catalog.spells || catalog).filter(e => key(e.name) === k || (e.aliases || []).some(a => key(a) === k));
  if (matches.length <= 1) return matches[0] || null;
  const cls = spellClass || sheetSpell.type;
  return matches.find(e => e.class === cls) || matches.find(e => e.level === Number(sheetSpell.level)) || matches[0];
}

// Fields a catalog entry needs before Combat can use it fully
export const SPELL_FIELDS = [
  ['castTime', 'Casting time', 'Segments (or "1 rd"); adds to your initiative', 'e.g. 1'],
  ['range', 'Range', 'As written in the book', 'e.g. 60 yds'],
  ['duration', 'Duration', 'How long it lasts', 'e.g. 1 rd/level'],
  ['area', 'Area or targets', 'Who or what it affects', 'e.g. 1 creature'],
  ['save', 'Save', 'What a save does: Negates, ½, None', 'e.g. Negates'],
  ['attack', 'Attack roll', 'Whether the caster rolls to hit', 'none, touch or ranged'],
  ['dice', 'Damage or healing dice', 'Leave blank if none', 'e.g. 1d8'],
  ['summary', 'Summary', 'One line, in your own words (not the book\'s text)', ''],
  ['link', 'Link', 'Where to read the full spell', 'https://…'],
];

export function missingFields(entry) {
  return ['castTime', 'range', 'duration', 'save'].filter(f => !entry || !String(entry[f] || '').trim());
}
