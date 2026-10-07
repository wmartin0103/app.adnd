// ── DICE EXPRESSIONS ────────────────────────────────────────────
// Damage is stored as dice only ("1d4"), and flat bonuses are added up
// separately so every bonus can be labeled. These helpers move between the
// two forms.

const DICE_RE = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

// "1d4+1" → { count: 1, sides: 4, flat: 1 }. Returns null for anything that
// isn't clean dice ± a number (e.g. "?", "1d4 vs giants").
export function parseDice(expr) {
  if (typeof expr !== 'string') return null;
  const m = expr.match(DICE_RE);
  if (!m) return null;
  const flat = m[3] ? (m[3] === '-' ? -1 : 1) * parseInt(m[4], 10) : 0;
  return { count: m[1] ? parseInt(m[1], 10) : 1, sides: parseInt(m[2], 10), flat };
}

// { count: 1, sides: 4 } + 3 → "1d4+3"
export function formatDice(dice, flat = 0) {
  if (!dice) return null;
  const base = `${dice.count}d${dice.sides}`;
  if (!flat) return base;
  return flat > 0 ? `${base}+${flat}` : `${base}${flat}`;
}
