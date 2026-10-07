# Combat Data Spec — Weapons, Attacks, and Declarations

**Status:** Draft for review
**Goal:** Restructure the character sheet's Weapons and Combat Scenarios
sections so the app can calculate every attack. That lets a player declare a
combat action on their own device, and the DM's tracker updates in real time.

This document covers the **data**, meaning what each field is and why it's
needed. The **UI** (layout, interaction, how much is visible at once) is open
for your design. Section 8 lists the open UX questions.

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

## 2. Decisions so far

| Topic | Decision |
|---|---|
| Weapons vs. attacks | **Combine them.** A weapon holds its own attacks. Custom attacks stay easy, and weapons are quick to add or remove. (Section 3) |
| Modifiers | **As simple as possible, but fast to change every round.** Split into layers by how often they change. (Section 4) |
| Dice | **Built-in shared roller, with manual entry always available.** (Section 6) |
| HP | Synced in real time between DM and player, stored as events. (Section 5) |
| Declarations | Players declare their own actions. (Section 5) |

---

## 3. Weapons and attacks, combined

### The model

A **weapon is a card, and its attacks live inside it.** Adding a weapon creates
its standard attacks automatically, and removing a weapon removes its attacks.

```
┌ Superior Dagger ─────────────────────── P · spd 2 · 1d4 / 1d4 · +1/+1 ┐
│  ▸ Melee           THAC0 13   1d4+3   3/2 per round                   │
│  ▸ Thrown          THAC0 13   1d4+3   3/1 per round   range 1/2/3     │
│  ▸ Off-hand melee  THAC0 15   1d4+3                    (custom)       │
│  + Add attack                                                         │
└───────────────────────────────────────────────────────────────────────┘
┌ Natural / special attacks ────────────────────────────────────────────┐
│  ▸ Bowcast (spell on an arrow)     uses Long Bow · speed 8 + cast     │
│  + Add attack                                                         │
└───────────────────────────────────────────────────────────────────────┘
+ Add weapon   [ pick from list ▾ ]  or  [ custom ]
```

- **Quick add:** pick from a weapon list (PHB weapons plus your campaign's
  additions). That fills in dice, speed, damage type, category, and which modes
  it supports (dagger → melee + thrown, bow → missile). The player only edits
  what differs, like a name ("Superior Dagger") or a bonus.
- **Default attacks:** one per mode, generated automatically. They inherit
  everything from the weapon, so there's nothing to fill in.
- **Custom attacks:** "+ Add attack" inside a weapon creates a variation that
  **only stores what differs**: an off-hand penalty, Trick Throw −2, "Lucern
  Hammer as piercing". Change the weapon later and every attack updates.
- **Attacks with no weapon** (natural attacks, unarmed, wrestling, Bowcast) live
  in a separate "Natural / special" group. They can still borrow a weapon's
  numbers ("uses Long Bow").
- **Hide without deleting:** a weapon can be marked "not carried" so it drops
  out of combat lists but keeps its setup, which is handy for gear swaps.

### Data shape

```jsonc
"__weapons": [
  {
    "id": "wpn-1",
    "name": "Superior Dagger",
    "basedOn": "dagger",               // PHB or campaign weapon it inherits from; the PHB
                                       // weapon at the root of the chain is its category
    "damageTypes": ["P"],
    "speed": 2,
    "damage": { "sm": "1d4", "l": "1d4" },
    "hitBonus": 1, "dmgBonus": 1,      // non-magic quality bonuses
    "magicPlus": 0,                    // enchantment +N (crits treat it separately)
    "range": { "s": 1, "m": 2, "l": 3 },
    "carried": true,
    "unknown": false,                  // "?" items: DM sees "check sheet"
    "notes": "",
    "attacks": [
      { "id": "atk-1", "mode": "melee",  "attacksPerRound": "3/2" },
      { "id": "atk-2", "mode": "thrown", "attacksPerRound": "3/1" },
      { "id": "atk-3", "mode": "melee",  "name": "Off-hand melee", "hand": "off",
        "mods": [{ "label": "Off-hand", "hit": -2 }] }
    ]
  }
],
"__specialAttacks": [
  { "id": "atk-9", "name": "Bowcast", "usesWeapon": "wpn-7", "speedFromCast": true }
]
```

### Weapon list: PHB + campaign, everything maps to a PHB category (decided)

- **PHB list:** the standard weapons, with stats.
- **Campaign list:** weapons your table invents or borrows. Each one is **based
  on** a PHB weapon (Maul → warhammer, Folding bow → short bow) and stores only
  what's different.
- **Sheet weapons** are based on either list and also store only what's different
  ("Superior Dagger" = dagger, +1/+1).
- The PHB weapon at the root of that chain is the weapon's **category**. Racial
  bonuses, Signature Weapon, and proficiencies match on category, so a weapon can
  have any name ("Moonstring" based on long bow still gets the elf bow bonus).
  Creativity is unlimited and the math stays simple.

Fixed bonuses that apply to **all** attacks with this weapon (Signature Weapon,
specialization) are set once at the character level and matched by weapon
category. See section 4.

---

## 4. Modifiers: four layers

The modifiers that matter differ in **how often they change**. Each layer gets a
different control, so the common case is one tap and the rare case is still possible.

| Layer | Changes | Examples (Jaque) | Who sets it | Control |
|---|---|---|---|---|
| **1. Built-in** | Almost never | Level THAC0, Str/Dex, weapon +1, Signature Weapon, Duelist's Precision | Sheet setup | Calculated. Shown as one number; tap for the breakdown. |
| **2. Stances & abilities** | Some rounds | Bladesong (+1 AC *or* +1 hit), Defensive Spin, Parry, Virtue | The player | **One-tap toggles** defined on the sheet |
| **3. Situation** | Most rounds | Flanking, charging, rear attack, higher ground, target invisible | Player or DM | **Shared chips**: the same list for everyone, already in the DM Helper |
| **4. Quick adjust** | Whenever | "DM says −2 for the rope bridge" | Either | **± stepper** with an optional label |

**Final number = built-in + active toggles + situation chips + quick adjust.**

### How it looks in the moment

```
Dagger, melee            to-hit  THAC0 10   ← big, the only number you need
[Bladesong: +1 hit ✓] [Flanking +2 ✓] [± 0]  ← active chips; tap to toggle
```

Tap the THAC0 to see every line that produced it. That keeps the simple view
honest and settles "why is it 10?" at the table.

### Round to round

Each toggle or chip has a **"sticks" setting**:
- **Resets each round:** charging, flanking, quick adjust, Defensive Spin.
- **Stays until turned off:** Bladesong stance, Armor spell, Inspiration (with a
  round counter, since it lasts 1 round per level).

When a new round starts, the resetting ones clear automatically and the sticky
ones carry over. That's the "dynamic but simple" balance: you only touch what
actually changed.

### Data shape

```jsonc
// Layer 1 — character-level, applies by weapon category or to everything
"__combatBonuses": [
  { "label": "Signature Weapon", "appliesTo": { "category": "dagger" }, "hit": 1, "dmg": 2, "sourceId": "abc-15" },
  { "label": "Duelist's Precision", "appliesTo": { "mode": "melee" }, "hitAbility": "dex-missile", "sourceId": "abc-16" }
],
// Layer 2 — toggles
"__combatOptions": [
  { "id": "opt-1", "name": "Bladesong", "sticks": true,
    "choice": [ { "label": "+1 AC", "ac": 1 }, { "label": "+1 hit", "hit": 1 }, { "label": "Attack and parry", "note": "DM adjudicates" } ] },
  { "id": "opt-2", "name": "Defensive Spin", "sticks": false, "noAttack": true, "ac": "ceil(level/2)" }
]
// Layer 3 is a shared campaign-wide list (from the DM Helper's MODS) — not per character.
// Layer 4 lives on the round's declaration — not saved to the sheet.
```

---

### Bonus options added for the revised Blade

Real house rules needed a few more ways to say when a bonus applies. Jaque's
full setup is in [`docs/house-rules/blade-revised.md`](house-rules/blade-revised.md).

| Field | Meaning | Example |
|---|---|---|
| `appliesTo.hand` | Main or off hand only | Signature Weapon: main hand only |
| `appliesTo.anyOf` | Any one of several filters | Duelist's damage: melee *or* crossbow |
| `when` | Only while a situation chip is on | Duelist's damage needs "Target flanked or unaware" |
| `preferBetter` | Swap the ability only if it gives more | Duelist's Precision falls back to Strength |
| `dmgAbility: "int-as-str"` | Intelligence read on Strength's damage column, max +2 | Duelist's damage |
| `attacksPerRound` on a bonus, by mode and level | `{ "melee": { "1": "3/2", "7": "2/1", "13": "5/2" } }` | Signature Weapon: every main-hand dagger gets it |
| toggle `ac: "halfLevel"` | AC better by half the level, rounded up | Defensive Spin |
| `__combatRules.offHandAttack` | One extra off-hand attack per round (always 1 attack) | Multi-weapon fighting |

A new situation chip, **Target flanked or unaware**, adds nothing by itself; it
exists so abilities like Duelist's Precision can react to it.

### A round of attacks

A player declares **one primary attack** (its attacks per round all use that
attack, so melee and ranged primary attacks can't be mixed) and, if the
character fights with two weapons, **one off-hand attack** of any mode. Example:
3/2 Dagger (melee) + 1 off-hand dagger (thrown) = 2.5 attacks per round.

## 5. Declaring an action: the proposed flow

**Context:** sessions run over a video call. Each player has the app open in a
browser window beside the call (tablet or desktop; phone supported). So:
- **Design for a half-width window first** (about 600–900px), then tablet, then phone.
- **Attention is on the call.** "Your turn" needs a cue beyond the page itself:
  a highlighted banner plus a flashing browser tab title.
- **No one sees anyone else's dice.** The shared dice log is the record, with
  "rolled" vs "entered" visible to all.
- **The DM may screen-share.** The players' initiative view is safe to share:
  no ACs, no hidden foes.

**What "declaration flow" means:** in 2e, each round everyone says what they
intend to do *before* initiative is rolled. Then actions resolve in initiative
order. The flow is the sequence of steps a player clicks through in their app
window for that, and what they see while waiting and resolving.

A proposed default, for you to react to:

```
 DM starts round 3
        │
 ① CHOOSE        Player's window: "Round 3 — what are you doing?"
                 Big buttons: your attacks (most-used first) · Cast · Move · Other
        │
 ② TARGET        List of foes the DM has revealed ("Orc 1", "Orc 2", "the big one")
        │
 ③ ADJUST        Active chips shown (sticky ones already on). Tap to change.
   (optional)    Collapsed by default: most rounds, skip straight to Ready.
        │
 ④ READY ✓       DM's tracker shows each PC as ✓ declared / … thinking
        │
 DM locks round → initiative rolled (player rolls or types it) → order shown to all
        │
 ⑤ ACT           On your turn: "Roll attack" (or type your die). Result goes to the DM.
                 DM's screen shows hit/miss vs. the real AC.
        │
 ⑥ DAMAGE        On a hit: "Roll damage". DM applies it to the target.
```

A Ready player can change their mind until the DM locks the round.

### Visibility rules (decided)

- **Hit/miss: the DM announces it.** The player's window shows "You rolled 17 —
  waiting on the DM" and never shows the target's AC or the hit/miss result. The
  suspense stays at the table. The DM's screen shows hit/miss as it does today.
  The DM can optionally tap **Reveal** to post the outcome to the log afterward.
- **Initiative order is visible to everyone**, with DM control over foes:
  - **Hidden foe:** not shown to players at all (an unseen ambusher).
    The DM taps **Reveal** when it's spotted.
  - **Hidden initiative:** the foe is visible, but its slot in the order shows
    as "?" until it acts.
  - Each is a per-baddy toggle in the DM tracker, defaulting to visible.
- **The DM can declare for a player** who's away from the app.

### Data shape

```jsonc
{
  "encounterId": "enc-12", "round": 3, "characterId": "char-jaque",
  "action": { "type": "attack", "attackId": "atk-1" },   // or cast / move / other
  "target": "orc-2",
  "toggles": { "opt-1": "+1 hit" },
  "situation": ["flanking"],
  "adjust": { "hit": 0, "label": "" },
  "status": "ready",                                     // choosing → ready → locked → resolved
  "rolls": ["roll-88", "roll-89"]                        // links into the dice log
}
```

### HP and conditions

Damage and healing are stored as **events** ("−6, Orc 2's axe, round 3"), not by
overwriting the HP number. If the DM applies damage while the player drinks a
potion, both changes count. The event list doubles as a combat log.

---

## 6. Built-in dice roller

Since most of the group already uses a shared digital roller, building one in
removes a second app at the table, and it can tie rolls directly to actions.

- **One shared roll log** for the campaign, visible to everyone in real time,
  like the roller you use now.
- **Roll buttons in context.** "Roll attack" already knows it's a d20 for Jaque's
  dagger vs. Orc 2, and "Roll damage" knows it's 1d4+3. No typing formulas.
- **Free-form roller** for anything else (`3d6`, `d100`).
- **Manual entry is always available.** Every roll button has a "type your die"
  option for players who prefer physical dice. The log marks these as
  **✋ entered**, and app rolls as **🎲 rolled**, so it's transparent without
  being a big deal.
- **DM private rolls:** the DM can roll hidden (monster saves, secret checks), and
  the log shows only "DM rolled".
- **Per-player default:** each player picks "app rolls" or "I'll type my dice"
  once, and the buttons follow that preference.

```jsonc
{ "id": "roll-88", "by": "char-jaque", "expr": "1d20", "result": 17,
  "source": "app",              // app | manual
  "purpose": { "type": "attack", "attackId": "atk-1", "round": 3 },
  "visibility": "all",          // all | dm
  "at": "2026-10-07T20:14:03Z" }
```

### What the group uses today: Roll Dice With Friends ("Roll Deep" room)

From a screenshot of the room:
- A free-text **name** field (people type their character name).
- **Dice palette**: d4, d6, d8, d10, d12, d20, percentile. Click dice into a
  tray to build a pool (e.g. 3d6), then **Roll It!**
- One **shared feed, newest first**: name, **Total**, and each die's result
  ("d6: 3, 1, 2").
- A dice-style dropdown.

It has no modifiers, no record of what a roll was for, no private rolls, and
no manual entry.

**Plan: keep the familiar part, add context.**
- The **free-form roller** copies Roll Deep's pattern: click dice into a tray,
  Roll, shared feed newest first with each die's result. No learning curve.
- **Name comes from the login**, not a text field: the character's name, or
  the player's name when no character is picked. Anyone without either
  (e.g. a guest before they set up) rolls as **Jim Darkmagic**.
- **No dice-style option.** Nobody uses Roll Deep's style dropdown.
- **In-context roll buttons** post richer entries to the same feed:
  `Jaque · Attack, Dagger → Orc 1 · d20: 16 · rolled`. Modifiers are shown with
  the dice, e.g. `Damage · 1d4+3 · d4: 2 → 5`.
- **Entered** rolls (physical dice) are tagged as such.
- **DM private rolls** appear to players only as "DM rolled".

---

## 7. Migrating existing saves (sheet version 1 → 2)

This uses the sheet's existing `migrateData()` step, run automatically on load.
Old JSON files keep importing.

| Old | New | Automatic? |
|---|---|---|
| `speed: "2"` | `speed: 2` | Yes |
| `dmgType: "piercing"` | `damageTypes: ["P"]` | Yes |
| `dmgSM: "1d4+1"` | dice `"1d4"` + `dmgBonus: 1` | Yes, when clean dice ± a number |
| `hitAdj: "+1"` | `hitBonus: 1` | Yes, when a clean number |
| `hitAdj: "*+1/2"`, `dmgAdj: "?"` | 0, original text kept in notes | **No.** Flagged "needs review" |
| — | `category`, attack modes | Guessed from the name ("Dagger x6" → dagger, melee + thrown); player confirms |
| Each scenario | An attack under its linked weapon | Yes |
| Scenario `hitMod: "4"` | A quick adjust of +4 labeled "from old sheet" | Yes, flagged so the player can turn it into named bonuses |
| Off-hand scenario | Custom attack with `{label: "Off-hand", hit: -N}` | Yes |
| Ability cards (Signature Weapon, Bladesong…) | Unchanged; player can link them to bonuses/toggles | Manual, guided |

---

## 8. Open UX questions

1. ~~Hit/miss visibility~~ **Decided:** the DM announces it (section 5).
2. ~~Initiative order visibility~~ **Decided:** visible, with per-foe hiding (section 5).
3. ~~**Weapon list scope**~~ **Decided:** PHB + campaign list, every weapon based on a PHB category (section 3).
4. ~~**"Needs review" after migration**~~ **Decided:** option D. A summary at the top
   of the sheet lists every item as a link to its field, and each field shows a
   text "Needs review" marker with Confirm/edit. Items are grouped by weapon, with
   "Confirm all" per weapon, because one character can have 15+ (Jaque does).
   The DM sees "unverified" on attacks with open items. Nothing blocks use.
5. ~~**Dice roller features**~~ **Decided:** match Roll Deep's tray-and-feed pattern, add context (section 6).

---

## 9. Build order

1. ✅ **Rules functions** (`src/rules/`, run tests with `npm test`) for weapons, attacks, and the four modifier layers, as
   plain functions with tests. Jaque is the first test case, with expected
   numbers confirmed with you and the DM.
2. **Sheet v2 data + migration**, with the current UI adapted minimally so nothing breaks.
   ✅ Migration logic done (`src/rules/migrate.js`): converts v1 saves, keeps every
   attack's THAC0, follows PHB damage, and writes the `__review` list.
3. **Sheet UI** for combined weapons/attacks, bonuses, and toggles, from your designs.
4. **Adapter → DM Helper:** generated config from sheet saves ("Import party").
5. **Backend + realtime:** declarations, HP events, shared dice log.

Steps 1–4 need no backend.
