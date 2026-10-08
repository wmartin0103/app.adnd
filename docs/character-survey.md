# Character survey: what five saves say about the rules

Saves: `samples/jaque_09-23.json` (rebuilt by hand in the sheet) and four
converted from the Advanced D&D (Rev.) Excel sheet: `atteroak.json`,
`hanspeter.json`, `nandun.json`, `tig.json`.

## The big finding: weapon rows hold final numbers

In the four converted saves, each weapon row's Hit adj and damage already
include everything: Strength, magic, proficiency or non-proficiency,
specialization/expertise, kit bonuses.

| Character | Row | Row says | Where it comes from |
|---|---|---|---|
| Nandun (Str 18, effectively 18/00 via Ripped) | Club | +3 hit, 1d6+6 | Str 18/00 +3/+6; proficient (Clubbing tight group) |
| Nandun | Dagger | +1 hit, 1d4+6 | Str +3, warrior non-proficiency −2 |
| Atteroak (cleric 4) | Horseman's Mace +1 | +1 hit | magic +1, proficient |
| Atteroak | Dagger | −3 hit | priest non-proficiency −3 |
| Tig (Str 16) | Dagger | −2 hit, 1d4+1 | warrior non-proficiency −2, Str +1 dmg |
| Tig | Heavy Horse Lance | +1 hit | Gallant kit: Skilled +1 with lances and swords |

Jaque's rebuilt sheet is the opposite: the row holds only the weapon's own
bonus and the app adds Strength, proficiency and named bonuses.

Run through the current rules code, every converted character comes out
wrong: Strength counted twice (Nandun's club 1d6+8 instead of 1d6+6) and
non-proficiency counted twice (Atteroak's dagger THAC0 24 instead of 21).
The sheet's own THAC0 has the same problem for these characters.

## Other patterns

- **One row per way of using a weapon.** "Dagger" and "Dagger, Thrown";
  "Sling, Bullets" and "Sling, Stones"; Tig's Bastard Sword one- and
  two-handed as two rows. Players already treat a row as an attack option.
- **Unarmed is a weapon row.** "Punch*, Bare-handed", "Wrestling*", with
  house-ruled damage (Nandun's Brute kit: unarmed 1d6). Nobody uses the PHB
  punching table.
- **Ability cards are lumped.** "Special Abilities", "Racial Abilities",
  "Code / Personality", each a bulleted list mixing combat actions (Turn
  Undead, Lay on Hands), situational bonuses (+1 vs orcs), saves and
  roleplay. Classifying a whole card can't work; it has to be per bullet,
  or the cards split.
- **Proficiency cards are lumped too.** "Weapon Proficiencies: Horseman's
  Mace, Warhammer, Throwing Hammer" in the description.
- **Half attacks are common.** Tig "Weapon Expertise: 3/2"; Nandun "bonus
  attack every other round". The Standard / Bonus round toggle is general.
- **Situational modifiers are the real variety:** +1 to hit orcs and goblins
  (dwarf), +1 with lances and swords (Gallant), Code of Gallant +2 to
  attack, damage, AC or a save "decided any time", evil creatures −1 to hit
  you (aura), negate flanking (Have my back), +1 to flankers on the right
  rear (war wound), allies' Inspiration +1 to attack.
- **"Uses your round" abilities:** Turn Undead, Lay on Hands, Detect Evil,
  holy weapon dispel, shapechange, bard songs (Animal Charm takes 1d10
  rounds), Counter Song. Uses per day or week are common.
- **Sources go well past the PHB:** Complete Fighter's/Priest's/Barbarian's
  handbooks, Player's Option: Combat & Tactics (expertise, fighting styles),
  kits. The app can't encode them all.

## Data problems to fix on import

- The converter's "Proficient / Not proficient" weapon notes are inverted:
  rows marked Proficient carry the non-proficiency penalty, and vice versa.
- Nandun is Str 18 with no exceptional percentage, but his numbers are 18/00.
- Hanspeter's spells are typed wizard and his spell class is "rogue" (he's a
  druid); two weapon rows are unnamed "Other (Custom)", likely animal forms.
- Hanspeter is Wis 18, so magical defense +4. The DM Helper's hand-typed +3
  is the error.
