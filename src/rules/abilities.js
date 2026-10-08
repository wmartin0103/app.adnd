// How an ability behaves in a round of combat. Every ability card on the sheet
// carries one of these (`combatRole`), set by the player; the app pre-fills a
// guess from the card's wording and flags it until the player confirms.
//
//   passive — always on; folded into the math (Signature Weapon)
//   stance  — a toggle that sits alongside attacks (Bladesong)
//   attack  — changes a single attack; an option on attack cards (Trick Throw, Backstab)
//   round   — uses your round instead of attacking; listed like spells (Defensive Spin, Turn Undead)
//   none    — not for combat (Thieves' Cant); stays in Quick reference
export const COMBAT_ROLES = {
  passive: 'Always on',
  stance: 'Stance',
  attack: 'Changes an attack',
  round: 'Uses your round',
  none: 'Not for combat',
};

// First match wins, so the order matters: "before battle" beats "full round",
// and "may not attack" beats "on a hit".
const RULES = [
  ['none', /\b(before|outside( of)?) (a |the )?(battle|combat|fight)\b|cannot be used in (battle|combat)|not usable in (battle|combat)/i],
  ['round', /\b(may|can|does) not attack\b|\bmak(e|es|ing) no attacks?\b|instead of attacking|in place of (an |his |her |their )?attack\b|\b(one |a )?full round\b|\btakes? (a|the|one|his|her|their) (full |entire )?round\b|\buses? (his|her|their|the|your) round\b/i],
  ['attack', /called shot|\bbackstab|\bon a (successful )?hit\b|instead of the normal (attack|damage)/i],
  ['stance', /\bstance\b|while (it is |the song is )?active\b/i],
  ['passive', /[+−-]\s?\d+\s*(to[ -])?(hit|dmg|damage|atk|attack)|in place of (the )?(str|dex|strength|dexterity)\b|attacks? per round|\b\d\/\d attacks|\bambidextrous\b|\bpenalt(y|ies)\b/i],
  ['none', /\bsecret\b|communicat|\blore\b|\blanguages?\b|\bidentify\b|\bknowledge\b/i],
];

// The role an ability's wording suggests, or null when it can't tell.
export function guessCombatRole(card) {
  const text = `${card.name || ''}. ${card.desc || ''}`;
  for (const [role, re] of RULES) if (re.test(text)) return role;
  return null;
}

// Loose name match between an ability card and a combat option or bonus:
// case, punctuation and plurals ignored ("Weapons Display" = "Weapon Display").
export function sameAbility(a, b) {
  const key = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(Boolean).map(w => w.replace(/s$/, '')).join(' ');
  return key(a) !== '' && key(a) === key(b);
}
