// Removes the Excel character sheet's group codes and book references from
// proficiency names (they change no numbers): "Intimidation G (DSDPH93)" →
// "Intimidation"; weapon proficiency cards keep their own numbers:
// "Local Fighting Style W 1 (POCT78)" → "Local Fighting Style 1",
// "Clubbing Tight Group 2 (CF59)" → "Clubbing Tight Group 2".
// Used by the convert scripts.
import { skillName } from '../src/rules/character.js';

export const weaponProfName = name => String(name || '').trim()
  .replace(/\s*\([A-Za-z]*\d[^)]*\)\s*$/, '')
  .replace(/\s+[GWRPHB]{1,3}(?=\s+\d|$)/, '')
  .trim();

export function tidyProficiencyNames(save) {
  for (const p of save.__nwps || []) p.name = skillName(p.name);
  for (const c of save.__wpnProfCards || []) c.name = weaponProfName(c.name);
  return save;
}
