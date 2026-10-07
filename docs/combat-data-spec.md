# Combat Data Spec — Weapons, Attacks, and Declarations

**Status:** Draft for review
**Goal:** Restructure the character sheet's Weapons and Combat Scenarios
sections so the app can calculate every attack. That lets a player declare a
combat action on their own device, and the DM's tracker updates in real time.

This document covers the **data**, meaning what each field is and why it's
needed. The **UI** (layout, interaction, how much is visible at once) is open
for your design. Section 6 lists the UX questions it raises.

---

## 1. Why the current data isn't enough

The DM Helper needs, for every attack a PC can make:

| Need | Used for |
|---|---|
| THAC0 | Hit or miss vs. the target's AC |
| Weapon speed | Initiative order |
| Damage dice vs. S/M and vs. L, plus flat bonus | Damage roll |
| Damage type (B / P / S) | Crit table |
| Magic plus | Crit damage (DM Helper excludes the magic plus from the multiplier) |
| Mode (melee / thrown / missile) | Which ability adjustment applies, and that thrown and melee are separate options |
| Attacks per round | Secondary attacks |

What the sheet has today:

**Weapons** (`__weapons`): name, size, one damage type, speed (text), hit adj
(text), damage adj (text), damage S/M and L (text), notes.

**Scenarios** (`__scenarios`): THAC0 group, level, linked weapon, main/off hand,
off-hand penalty, and one "hit mod" number.

### The problems, with real examples from Jaque's save

1. **One unlabeled "hit mod" hides the reasoning.** Both of Jaque's scenarios
   use `hitMod: "4"`. For the melee attack, that 4 must contain Duelist's
   Precision (Dex +3) plus Signature Weapon (+1). The sheet gets melee THAC0
   **13**. The DM Helper has the same attack at **16**, apparently without Duelist's
   Precision. The tools disagree by 3, and neither one can show why.

2. **Mode isn't recorded.** Nothing says whether an attack is melee or thrown, so
   the app can't know to use the Dex missile adjustment. The player has to fold
   it into "hit mod" by hand.

3. **Free-text adjustments get misread.** The Wave Dagger's hit adj is `"*+1/2"`,
   with a note that the bonus applies only vs. Tiny/Small. The current calculation
   pulls `+1` out of that text and applies it **to every attack**. The Leprechaun
   Dagger's damage adj is `"?"`, which can't be calculated.

4. **Damage isn't calculated at all.** Scenarios only produce THAC0. Strength
   damage, specialization damage (Signature Weapon +2), and magic bonuses aren't
   added anywhere. The DM Helper has them hand-typed as `"1d4+3"`.

5. **Attacks per round aren't recorded.** "3/2 melee, 3/1 thrown" lives only in
   the text of an ability card.

6. **Racial weapon bonuses match on the weapon's name.** The elf bonus applies
   only if the name contains "long sword" (etc.). A weapon named "Moonblade"
   would silently lose it.

7. **Damage type allows only one value.** A Lucern Hammer is B/P/S.

---

## 2. Design principle: every modifier is a labeled line

Instead of one "hit mod" number, each attack carries a **list of named
modifiers**, each with its own to-hit and damage values. Some come in
automatically from the sheet, and the player adds the rest.

> **Dagger, melee (main hand)** — THAC0 **13**, damage 1d4+3
> | Source | Hit | Dmg | |
> |---|---|---|---|
> | Rogue level 5 | THAC0 18 | | auto |
> | Superior Dagger | +1 | +1 | auto, from weapon |
> | Duelist's Precision (Dex missile adj.) | +3 | | ability swap, from attack setting |
> | Signature Weapon | +1 | +2 | player-added, linked to ability card |
> | Strength 13 | 0 | 0 | auto, replaced by Duelist's Precision |

This is the single biggest improvement. It's also a better experience: the DM
can audit any number at the table, and the player sees exactly where their
numbers come from.

---

## 3. Proposed data shape

Written as plain JSON with each field explained. The example values are Jaque's.

### 3a. Weapon: the physical item

```jsonc
{
  "id": "wpn-1",
  "name": "Superior Dagger",
  "category": "dagger",          // NEW. From a list (dagger, long sword, short bow…).
                                 //      Drives racial bonuses and proficiency matching
                                 //      instead of the free-text name.
  "size": "sm",
  "damageTypes": ["P"],          // CHANGED. Was a single dmgType; now 1+ of B/P/S.
  "speed": 2,                    // CHANGED. Number, not text.
  "damage": { "sm": "1d4", "l": "1d4" },  // CHANGED. Dice only; bonuses live below.
  "hitBonus": 1,                 // CHANGED. Was hitAdj text. Number.
  "dmgBonus": 1,                 // CHANGED. Was dmgAdj text. Number.
  "magicPlus": 0,                // NEW. Enchantment "+N" (0 if mundane). Superior
                                 //      quality is hit/dmg bonus, not magic.
  "modes": ["melee", "thrown"],  // NEW. What this weapon can do.
  "range": { "s": 1, "m": 2, "l": 3 },   // NEW, thrown/missile only (tens of yards).
  "conditional": [               // NEW. Situational bonuses that must NOT apply
    // { "label": "vs Tiny/Small", "hit": 0.5, "dmg": 0.5 }   e.g. Wave Dagger
  ],
  "unknown": false,              // NEW. True for unidentified items ("?") → the DM
                                 //      Helper shows "check sheet" instead of a number.
  "notes": ""
}
```

### 3b. Attack: what the character does with a weapon (replaces "Scenario")

```jsonc
{
  "id": "atk-1",
  "name": "Dagger, melee",
  "weaponId": "wpn-1",
  "mode": "melee",               // NEW. melee | thrown | missile.
  "hand": "main",                // was handedness. main | off.
  "thac0Group": "rogue",         // was group
  "levelMode": "sheet",          // unchanged (+ customLevel)
  "hitAbility": "dex-missile",   // NEW. Defaults from mode (melee → str, thrown/missile
                                 //      → dex-missile). Overridable, e.g. Duelist's Precision.
  "dmgAbility": "str",           // NEW. Defaults to str for melee and thrown, none for
                                 //      missile (bows). Overridable.
  "attacksPerRound": "3/2",      // NEW. "1", "3/2", "2", "5/2"…
  "modifiers": [                 // NEW. Replaces the single hitMod number.
    { "label": "Signature Weapon", "hit": 1, "dmg": 2, "sourceId": "abc-15" }
                                 // sourceId optionally links to an ability card
  ],
  "pairedWith": "atk-3",         // NEW, optional. Two-weapon fighting: the off-hand
                                 //      attack made in the same round.
  "active": true,                // unchanged: the sheet's "current" attack
  "collapsed": false             // unchanged: UI state
}
```

### 3c. Combat options: per-round choices (new section)

Several abilities are **choices made each round**, not fixed bonuses. Today they
live as text cards on the sheet and as special cases hard-coded in the DM Helper
(`parry`, `armorSpell`, `virtue`, `quickness`). They become structured options a
player toggles while declaring:

```jsonc
{
  "id": "opt-1",
  "name": "Bladesong",
  "choice": [                    // pick one per round
    { "label": "+1 AC",  "ac": 1 },
    { "label": "+1 to hit", "hit": 1 },
    { "label": "Attack and parry", "note": "DM adjudicates" }
  ],
  "sourceId": "wpc-3"
}
// Others: Defensive Spin (no attack; AC +ceil(level/2)), Parry, Armor spell (+AC),
// Virtue (+2 to one of AC/hit/dmg/saves), Quickness (−2 initiative if attacking).
```

Anything too complex to model becomes an option with a `note` that the DM
adjudicates. That's better than nothing, and the DM still sees it was declared.

---

## 4. The declaration (what a player sends each round)

This mirrors what the DM Helper's per-character tab already collects, so the
DM's tracker logic carries over:

```jsonc
{
  "encounterId": "enc-12",
  "round": 3,
  "characterId": "char-jaque",
  "action": { "type": "attack", "attackId": "atk-1" },   // or "cast" (spell + casting time),
                                                         // or "other" (speed), or "move"
  "target": "Baddy 2",
  "options": { "opt-1": "+1 to hit" },                   // per-round choices
  "situation": { "flanking": true, "charging": false, "moving": "none", "ground": 0 },
  "initRoll": 4,                                         // player's d10 (or "roll for me")
  "attackRolls": [17, 9],                                // d20s, one per attack this round
  "damageRolls": [5],
  "status": "declared"                                   // declared → locked (by DM) → resolved
}
```

**Real-time sync:** each declaration is its own small record. The player edits
only their own, and the DM's screen updates within about a second. The DM can
**lock** the round (initiative revealed, no more changes), which matches how the
DM Helper's initiative lock works today.

### HP and conditions

Since you're open to syncing HP: damage and healing are stored as **events**
("−6, Baddy 2's axe, round 3") rather than overwriting the HP number. If the DM
applies damage at the same moment the player drinks a potion, both changes
count. With a plain "set HP to X" field, one of them would be lost. Current HP is
max HP plus the sum of events, and the event list doubles as a combat log.

---

## 5. Migrating existing saves (sheet version 1 → 2)

This uses the sheet's existing `migrateData()` mechanism, run automatically on
load. Old JSON files keep importing.

| Old field | New field | Automatic? |
|---|---|---|
| `speed: "2"` | `speed: 2` | Yes |
| `dmgType: "piercing"` | `damageTypes: ["P"]` | Yes |
| `dmgSM` / `dmgL: "1d4+1"` | dice `"1d4"` + `dmgBonus: 1` | Yes, when it's clean dice ± number |
| `hitAdj: "+1"` | `hitBonus: 1` | Yes, when it's a clean number |
| `hitAdj: "*+1/2"`, `dmgAdj: "?"` | left at 0, original text kept in `notes`, flagged | **No.** Flagged "please review" on the sheet |
| — | `category` | Guessed from name ("Dagger x6" → dagger), confirmed by player |
| — | `modes` | Guessed from category (dagger → melee + thrown), confirmed by player |
| Scenario `hitMod: "4"` | one modifier `{label: "Hit mod (from old sheet)", hit: 4}` | Yes, but flagged so the player can split it into named lines |
| Scenario `handedness`, `offHandPenalty` | `hand` + modifier `{label: "Off-hand", hit: -2}` | Yes |

Flagged items show a "needs review" marker on the sheet until the player
confirms them. Nothing is silently dropped.

---

## 6. UX questions for you

1. **Weapon vs. attack.** Keep them as two sections (the item, then how it's used),
   or show attacks nested under each weapon? The data supports either.
2. **Modifier list density.** The labeled-line breakdown (section 2) is the core
   idea. Is it always visible, or a "show math" disclosure?
3. **Category list.** Pick from a fixed weapon list (PHB weapons + "Other"), or a
   type-ahead with free entry?
4. **Linking modifiers to ability cards.** Is it worth an explicit link (so
   "Signature Weapon" on the attack points to the ability card), or is a
   label enough?
5. **Declaration on a phone.** What's the minimum? (Pick attack → pick target →
   roll.) What's tucked away? (Situation modifiers, per-round options.)
6. **Who rolls?** Physical dice with the player typing the result, in-app
   rolls, or player's choice per roll?
7. **"Needs review" flags after migration.** Inline markers on each field, or a
   checklist at the top of the sheet?

---

## 7. Build order

1. **Rules functions** for weapons and attacks (THAC0, damage, speed) as plain
   functions with tests. Jaque's save is the first test case; the expected
   numbers get confirmed with you and the DM.
2. **Sheet v2 data + migration**, with the current UI adapted minimally so nothing
   breaks.
3. **Sheet UI redesign** for weapons, attacks, and combat options, from your designs.
4. **Adapter → DM Helper**: generated `CHARACTERS` / `DAMAGE` / `CRIT_TYPES` entries.
5. **Declarations + realtime** (needs the Phase 3 backend).

Steps 1–4 don't need a backend, and the DM gets accurate, explainable numbers
even before live play exists.
