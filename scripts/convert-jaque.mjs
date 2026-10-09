// One-off: Jaque's 09-23 save moved to the "totals" model (weapon rows hold
// final numbers, entered as parts; sometimes-bonuses stay as text on his
// cards, shown in Combat as reminders). Totals confirmed
// with his player on 10-09. Output: samples/jaque_10-09.json
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('samples/jaque_09-23.json', 'utf8'));
// Thief skill Kit/Misc corrections from 10-07 (Open Locks +20, Find/Remove Traps 0)
s.__thiefSkillAlloc.kit = { ...s.__thiefSkillAlloc.kit, ol: 20, frt: 0 };

// Rows: weapon + Signature Weapon (+1/+2) + Dex 19 (+3 hit; Duelist's
// Precision uses it in melee too)
// Parts: weapon's own bonus · ability score (Dex 19 +3) · proficiency
// (Signature Weapon, a specialization: +1 hit, +2 dmg)
const parts = (wHit, wDmg) => ({
  hitParts: { weapon: wHit, ability: '+3', prof: '+1', other: '' },
  dmgParts: { weapon: wDmg, ability: '', prof: '+2', other: '' },
});
const totals = {
  'Superior Dagger':   { hitAdj: '+5', dmgAdj: '+3', ...parts('+1', '+1') },
  'Leprechaun Dagger': { hitAdj: '+5', dmgAdj: '+2', ...parts('+1', ''), unrevealed: true },
  'Wave Dagger':       { hitAdj: '+4', dmgAdj: '+2', ...parts('', '') },
  'Dagger x6':         { hitAdj: '+4', dmgAdj: '+2', ...parts('', '') },
};
for (const w of s.__weapons) {
  Object.assign(w, totals[w.name], {
    dmgSM: '1d4', dmgL: '1d4', basedOn: 'dagger', modes: ['melee', 'thrown'],
    rates: { melee: '3/2', thrown: '3/1' }, fieldsV: 2,
  });
  if (!w.unrevealed) w.unrevealed = false;
  if (w.name === 'Wave Dagger') w.notes = '';
}
// Sometimes-bonuses stay as text; these cards show in Combat as reminders
s.__offHandPenalty = '-2';   // Handle Weapons
s.__weapons.find(w => w.name === 'Wave Dagger').notes = '+1 hit/dmg vs tiny, +2 hit/dmg vs small';
const show = ['Weapons Display', 'Trick Throw', 'Defensive Spin', 'Offensive Spin', "Duelist's Precision", 'Handle Weapon'];
for (const a of s.__abilitiesCards) a.showInCombat = show.includes(a.name);
for (const c of s.__wpnProfCards) c.showInCombat = /bladesong/i.test(c.name);
writeFileSync('samples/jaque_10-09.json', JSON.stringify(s, null, 2) + '\n');
console.log('Wrote samples/jaque_10-09.json');
