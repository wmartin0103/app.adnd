# AD&D Campaign App — Migration Plan

Goal: turn two standalone HTML tools (character sheet tracker and DM encounter
tool) into one private web app. Players manage their own sheets. The DM's tool
reads those sheets live, so combat runs faster and everyone sees the same state.

---

## 1. The big picture (what changes and what doesn't)

Today each page is self-contained. Data lives in the browser until someone
exports a JSON file, and the files get passed around by hand.

The new app adds two things your pages don't have yet:

| Need | Today | Tomorrow |
|---|---|---|
| **Where the page lives** | A file on someone's computer | A URL everyone opens (static hosting) |
| **Where the data lives** | Exported JSON files | A shared database in the cloud |
| **Who can see it** | Whoever has the file | Only invited people who are logged in |
| **Keeping in sync** | Re-import the file | Changes push to everyone's screen automatically |

The key point: **your JSON save format becomes the database record.** We don't
throw it away. A character "save" turns into one row in a `characters` table,
with your existing JSON stored in a single column. That's why this migration
can happen in small steps instead of a rewrite.

---

## 2. Recommended stack

The aim is the fewest moving parts that still get you logins, shared data,
and live updates. Everything below has a free tier that comfortably covers a
gaming group.

| Layer | Choice | Why |
|---|---|---|
| Front end | **Plain HTML/CSS + JavaScript modules**, built with **Vite** | Your pages stay recognizable HTML. Vite is a small dev tool that bundles files and gives a live-reloading preview. No React/framework to learn, and semantic markup stays fully in your hands. |
| Backend (database, logins, live sync) | **Supabase** | A hosted Postgres database with built-in email login, per-row permission rules, and "realtime" (pushes changes to open browsers). It stores JSON natively, so your saves drop straight in. You don't write or run a server. |
| Hosting | **Netlify** or **Cloudflare Pages** (free) | Connects to this GitHub repo. Every push to `main` redeploys the site automatically. |
| Domain (optional) | Any registrar, roughly $10–15/yr | A free `*.netlify.app` / `*.pages.dev` address works fine too. |

**Expected cost: $0/month** (plus an optional domain).

Free-tier caveat: Supabase pauses a free project after about a week with no
activity. A weekly game keeps it awake. If it does pause, you press "restore" in
the dashboard and nothing is lost. Check their current terms when you sign up.

### Why not a framework (React, etc.)?

Two tools, a handful of users, and an owner who works in HTML/CSS. A framework
would add a build pipeline and a component model that hides the markup, and
neither pays off at this scale. We can revisit if the app grows a lot. Plain
modules also keep accessibility and semantics easy to review: what you see in
the `.html` file is what ships.

---

## 3. How "private access" works

- **An admin creates every account; there's no public sign-up.** The admin
  page creates a user with a **temporary password**, the admin sends it to the
  player however the group talks (Discord, text), and the player must choose
  their own password at first login. Password resets work the same way: the
  admin issues a new temporary password.
- **Why passwords instead of email links:** the free plan's built-in email
  sender is limited to a handful of emails per hour and only reaches the
  project's own team addresses. Admin-issued temporary passwords don't depend on
  email at all. (Email links can be added later with a free email-sending
  service if wanted.)
- Creating users needs a secret key that must never reach a browser, so it runs
  in a small server-side function (Supabase Edge Function) that first checks the
  caller is an admin.
- **Roles:** *admin* (manages accounts; probably you), *DM*, *player*. Per
  character: the *owner* edits it; the DM can edit any sheet; a *stand-in*
  chosen by the DM or owner can play a character for a session (declare,
  roll, track HP) without changing its stats or gear.
- **The cloud copy is the single source of truth.** The DM Helper reads sheets
  directly; JSON export stays as a backup and import is for moving in.
- **Version history per character** (the last 20–30 saves, restorable), so a
  bad edit or bug can be undone. Every change records who made it.
- Permissions are enforced **in the database**, not just hidden in the UI
  (Supabase calls this *Row Level Security*). Even if someone fiddles with the
  page, the database itself refuses:
  - A player can read and edit **their own** characters.
  - A player can **read** fellow party members' sheets (configurable; some groups prefer secrecy).
  - The DM can read every character in the campaign and edit **combat state**.
  - Only the DM can see encounters, monster stats, and DM notes.

- The **source code repository should be private too.** This GitHub repo is
  currently public, so anything committed here (character saves, the DM's
  encounter tables) is readable by anyone. Netlify and Cloudflare Pages both
  deploy from private repos on their free plans, so making it private costs
  nothing.

---

## 4. What the existing tools tell us

Findings from reviewing `Character Sheet 2e Beta` (index.html, ~7,000 lines),
`DM Helper` (~3,200 lines), and Jaque's save file. These change the plan's
priorities.

### 4a. The character sheet is well set up for the move

- **Save/load is already isolated.** Two functions do the work: `gatherData()`
  collects the whole sheet into one JSON object, and `applyData()` puts one back.
  Right now they talk to the browser's local storage and to import/export files.
  For cloud saves, we add a third destination (the database) behind the same two
  functions. The rest of the sheet doesn't need to change.
- **Versioning already exists.** The file stamps `__version` and has a
  `migrateData()` step that upgrades old saves. That's the mechanism section 6
  needed, so we keep it.
- **The sheet calculates most of what combat needs**: THAC0 per attack scenario,
  effective AC (base + Dex), saving throws (class + level + race + Con), thief
  skills, proficiency targets, and XP.

### 4b. …but its calculations are tangled into the page

Each calculation reads its inputs **straight from form fields on the screen**,
for example "get the value of the `ability-str` input". In UX terms, the logic
and the UI are welded together, so the math only works when the sheet page is
open. The DM tool can't reuse it as written.

The fix is to pull each calculation out into a plain function that takes
character data in and hands numbers back, with no page involved. The sheet then
calls those functions, and so can the DM tool. This is the **shared rules
module**, and it's now the most important engineering step in the plan.

### 4c. The DM Helper doesn't read character sheets at all

Every PC is typed in by hand in a config block at the top of the file:

| DM Helper block | What it holds | Can the sheet supply it? |
|---|---|---|
| `CHARACTERS` | Level, AC (normal / shieldless / surprised), base THAC0, ability scores, THAC0 + speed per weapon and mode, extra attacks | Mostly yes. Ability scores, level, base AC, Dex adjustment, weapons, speed, and THAC0 scenarios are all on the sheet. |
| `SKILLS` | Proficiency check targets per character | Yes, from the sheet's proficiencies (ability score + adjustment) |
| `THIEF` | Thief skill percentages | Yes, the sheet calculates these |
| `SAVES` | Save targets, plus modifiers like dwarf +4 vs poison | Yes, the sheet calculates these |
| `CRIT_TYPES` | Damage type per weapon | Yes, the sheet stores damage type per weapon |
| `SETUP_ORDER`, `LIGHT_SPEED`, `legacy` flags | Table order, default speed, retired PCs | No. These are DM settings, not character data. |
| `parry`, `armorSpell`, `virtue`, `quickness` | Kit/class combat abilities that change AC, to-hit, or initiative | Not as numbers. The sheet has them only as text ability cards. |

The hand-copied data has **already drifted** from the sheet:

- Jaque's weapons are "Magic Dagger +1" and "Dagger" in the DM Helper, but
  "Superior Dagger", "Leprechaun Dagger", "Wave Dagger", and "Dagger x6" on the sheet.
- Jaque's Intimidation proficiency is on the sheet but missing from the DM Helper's
  skills list.
- One entry has the comment "THAC0 19 assumed (JSON has none)". The DM was
  reading JSON saves by eye and filling gaps by hand.

That's exactly the work the app should remove.

### 4d. The DM Helper already has a "player view"

Its top tabs show **DM** plus **one tab per character**. A character's tab shows
just that PC's combat card: initiative roll, chosen action, moving, charging,
and so on. The per-round state the DM Helper saves (initiative, selected action,
movement, situational modifiers) is effectively the `combat_state` this plan
proposed.

That's a strong signal for Phase 5. With live sync, **each player's tab moves
onto their own screen.** Players declare their own action and roll their own
initiative, and the DM's tracker fills in automatically, instead of the device
being passed around or the DM entering everything.

### 4e. The DM Helper does not track HP

The sheet tracks current and max HP. The DM Helper has nothing for HP, damage
taken, or conditions on PCs. So "DM applies damage → player's sheet updates" is a
new feature, not a migration. Worth confirming you want it (section 8).

### 4f. Data-quality notes

- Numbers are stored as text (`"str": "13"`, `"level": "5"`). That's harmless
  but needs careful handling when converting.
- Some fields are free-form on purpose: `hitAdj: "*+1/2"`, `dmgAdj: "?"`, and
  proficiency slots of `"1"`, `"kit"`, `"Kit"`, `"Class"`. The DM tool needs a clear
  "can't calculate this, check the sheet" display rather than guessing.
- Reference tables (Str/Dex/Con tables, THAC0 progressions, save tables) exist in
  both files. They should live once in the shared rules module.

---

## 5. Data model

Think of these as the "nouns" of the app. Each one is a table.

```
campaigns          one row per campaign (name, house-rule settings)
campaign_members   who's in which campaign, and their role: "dm" or "player"
characters         owner, campaign, data (← the sheet's JSON, unchanged), version
character_dm_notes DM-owned settings per PC: table order, retired/hidden flag,
                   default speed, crit overrides (DM Helper's non-sheet config)
encounters         campaign, name, status, baddies, round number
combat_state       per-combatant per-encounter: initiative roll, chosen action,
                   movement, situational mods, (new) current HP and conditions
```

### Three kinds of data, three owners

The most important design decision. Each piece of data gets **one owner**, so
two people never overwrite each other:

1. **Character sheet**: owned by the **player**. Everything the sheet saves today.
2. **DM settings per PC**: owned by the **DM**. The DM Helper config items the
   sheet can't supply (table order, retired flag, crit overrides). The DM doesn't
   edit the player's sheet to set these.
3. **Combat state**: **shared during a fight**. Small, separate records for each
   combatant, updated field by field. A player sets their own action and
   initiative, and the DM sets baddies and applies damage.

**Kit combat abilities** (Parry, Armor spell, Virtue, Quickness) are the open
question. They're character abilities, so in the long run they belong on the
sheet as structured "combat toggles" (e.g., "+2 AC when active"). The sheet only
has them as text cards today. Short term, they live in the DM settings, as they
do now. Moving them to the sheet is a Phase 6 sheet feature.

### Encounters reference characters instead of copying them

An encounter stores **character IDs**. When the DM opens it, the tool calculates
AC, THAC0, saves, and skill targets from the current sheets. If a player swaps
weapons before the fight, the DM sees it. Baddies still live inside the
encounter, as they do now.

---

## 6. Shared rules module

A folder of plain JavaScript functions (`src/rules/`) that take character data
in and return numbers, with no page or form fields involved:

```
abilityMods(sheet)         → Str/Dex/Con/… adjustments
effectiveAC(sheet)         → normal / shieldless / surprised
attackProfiles(sheet)      → one THAC0 + speed + damage type per weapon/scenario
savingThrows(sheet)        → five save targets, with racial bonuses
proficiencyTargets(sheet)  → check target per proficiency
thiefSkills(sheet)         → percentages
```

Then a single "adapter" turns a sheet into exactly the shape the DM Helper's
config block uses today:

```
toDMHelperCharacter(sheet, dmSettings) → { CHARACTERS entry, SKILLS, SAVES, THIEF, CRIT_TYPES }
```

That adapter is the trick that keeps the migration safe. **The DM Helper's 3,000
lines of combat logic don't need rewriting.** We swap its hand-typed config for
generated config, and everything downstream keeps working.

We'll add automated tests that check the generated numbers against the
DM Helper's current hand-entered values (e.g., Jaque's rogue THAC0 18 at level 5,
AC 4 from leather + Dex 19). Where they disagree, either the sheet or the DM
Helper has a bug, and the DM decides which is right.

---

## 7. Phased roadmap (revised)

Every phase ships something usable, and JSON import/export keeps working the
whole time as a backup.

### Phase 0 — Gather and organize
- Make this repo **private** (Settings → General → Danger Zone → Change visibility).
- Commit both tools unchanged under `legacy/`, plus sample saves under `samples/`.
- Collect a JSON save from **every active player**, not just Jaque. The adapter
  needs real data to test against.
- Set up Vite so the pages run locally.

### Phase 1 — Put it online (no logins yet)
- Connect the repo to Netlify or Cloudflare Pages.
- A landing page linking to both tools at one address.
- To keep it hidden before logins exist: Cloudflare Access (free) puts an email
  gate in front of the whole site.

### Phase 2 — Shared rules module + "Import party" in the DM Helper
*(Moved earlier. This gives the biggest win without needing a database.)*
- Extract the sheet's calculations into `src/rules/` and point the sheet at them,
  with no visible change to the sheet.
- **Restructure the sheet's Weapons and Combat Scenarios data** (sheet v2) so
  every attack is calculable: mode, attacks per round, labeled modifiers, and
  per-round combat options. See [`docs/combat-data-spec.md`](docs/combat-data-spec.md).
  Includes an automatic migration for existing saves.
- ✅ Write the sheet → DM Helper converter (`src/adapters/dm-helper.js`), with tests.
  It produces one paste-in block per party (`scripts/dm-helper-config.mjs`),
  checked by loading the DM Helper with Jaque's generated block.
- ✅ **"Import sheets"** on the DM Helper's Config tab: the DM picks players'
  exported JSON files, and their stats are generated from them (kept in that
  browser; DM-only settings preserved). Hand-typed config stays for everyone
  else, including players who don't have a digital sheet yet.
- Players without a digital sheet create one in the character sheet tool from
  scratch (it already supports a blank sheet). A guided "new character" setup
  is a candidate for the sheet redesign.

**Result:** the DM stops re-typing character data. It works with today's
file-passing workflow, before any backend exists.

### Phase 3 — Accounts and cloud saves
- Supabase project, tables, permission rules, password login.
- Admin page: create users with temporary passwords, reset passwords, assign
  roles; forced password change at first login.
- Version history for characters; stand-in access for absent players.
- The sheet gets a "My characters" list. `gatherData()`/`applyData()` save to the
  cloud as well as locally.
- Players import their current JSON once to move over.
- The DM Helper's "Import party" reads from the database instead of files.

**Result:** sheets live in one place. The DM always has current data.

### Phase 4 — Encounters in the cloud + DM settings
- Encounters and baddies save to the database (DM-only).
- DM settings per PC move out of the config block into `character_dm_notes`.
- The DM can run the same encounter from any device and resume after a refresh.

### Phase 5 — Live table play
- `combat_state` with realtime sync.
- The DM Helper's per-character tab becomes **the player's own combat view on
  their own screen**: declare action, roll initiative, see if they hit.
- The DM's tracker updates as players declare.
- HP and conditions sync between the DM tracker and sheets, stored as damage and
  healing events so simultaneous edits never overwrite each other.

### Phase 6 — Reference library
A shared, searchable library of game reference data that the sheet and DM
Helper pick from (see section 9).

### Phase 7 — Nice-to-haves
- Edit history / undo, shared dice log, installable on phones, XP awards from
  encounters straight to sheets.

---

## 8. Decisions for you (UX/product)

1. ~~**Repo visibility.**~~ **Decided:** private.
2. **Do all players use the sheet tool?** The DM Helper lists 8 PCs, 3 marked
   legacy. The adapter only helps for characters that have a sheet save.
3. **Source of truth when they disagree.** When generated numbers differ from
   the DM's hand-entered ones, who decides? (Suggest: the DM, then fix the
   sheet's rule.)
4. ~~**HP in the DM tool.**~~ **Decided:** yes, synced in real time between the DM and the player.
5. ~~**Player combat view.**~~ **Decided:** players declare their own actions.
   This requires the sheet v2 weapon/attack data (Phase 2).
6. **Party visibility.** Can players see each other's full sheets, a summary, or nothing?
7. ~~**Devices.**~~ **Decided:** sessions are remote over video call. Players mostly use a
   tablet or a desktop browser window beside the call; phones must still work.
   Design target: a half-width desktop window (about 600–900px), then tablet, then phone.
8. ~~**Blade thief skills.**~~ **Decided:** only the four Blade skills; race and
   Dex don't add skills he lacks; Locksmithing grants full Open Locks.

9. **App structure (decided, 10-08):** three tabs sharing one character.
   **Sheet** = the existing character sheet, kept in its current form (its
   weapons/scenarios sections gain the fields the rules need; its THAC0 math
   switches to the shared rules). **Combat** = a new view for mid-fight:
   encounter and initiative, party and foes, your attacks and rolls. **DM** =
   the DM Helper, shown only to DM users. Supersedes the prototype's redesigned
   Sheet tab. Prototype: `prototypes/app-shell.template.html`.
10. **Declaring actions in the app (open).** Spoken declarations are part of
    the session's community; the app shouldn't replace them. No declare/lock
    step for now; revisit once the Combat tab takes shape.
11. ~~**Party visibility in Combat.**~~ **Decided:** players see each other's
    exact HP and conditions.
12. **Combat is a quick-reference helper (decided):** combat material and actions
    at a glance (attacks, party, foes, saves, abilities, ready spells, checks,
    rolls), supporting the spoken game rather than replacing it.
13. **Foes in Combat (decided):** the list comes from the DM's encounter and
    updates live. Players' notes on foes are private. A foe that goes down
    stays listed (greyed, last, notes kept) and leaves the initiative order;
    the DM can remove a foe for good, and clearing the encounter removes all.
14. **Players change their own HP (decided):** current HP is editable in the Combat
    tab and writes to the character record and the shared log, so the DM doesn't
    have to track party HP and encounters stay spoken. HP can go below 0
    (PHB optional rule): 0 unconscious, −1 to −9 dying, −10 dead.
15. **Attacks per round (decided):** Combat shows how many attacks you have,
    and doesn't count them off. Half attacks (3/2, 5/2): the player switches
    Standard / Bonus round. A bonus round has the extra attack; if it goes
    unused the next round is still a bonus round (it can't be banked for two),
    and after it's used the next round is standard. The app never flips it.
16. **Combat layout (mock-up, for review):** a "Your round" block for
    round-wide choices (Fight / Cast / Something else; main hand incl.
    unarmed, melee or thrown, off-hand; Standard / Bonus; stances; what adds
    to initiative), then one card per attack with its own target, situation,
    adjustment, roll and damage. Unarmed follows PHB punching and wrestling
    (Table 57, to spot-check). Cast picks from memorized spells; the sheet's
    spellbook entries need cast time, range, save and attack-roll fields.
17. **Abilities in combat (decided):** each ability card on the sheet has an
    "In combat" setting: Always on, Stance, Changes an attack, Uses your
    round, Not for combat. The app pre-fills it from the card's wording
    (`src/rules/abilities.js`) and marks it guessed until confirmed. Combat's
    round choice is Fight / Cast / Ability; Ability lists "Uses your round"
    abilities (with Uses and Save); "Changes an attack" abilities (with a
    To hit value) are options on each attack card. Magic items may get their
    own round choice later.
18. **Weapon rows hold final numbers (decided):** to-hit and damage as the
    player writes them (Strength, proficiency, magic, kit included), as the
    converted saves already do. The app adds only base THAC0 and what's
    toggled this round. Inputs must be clearly labelled for players.
19. **Shared spell catalog (decided):** one short stat block per spell for
    the whole campaign (`data/spell-catalog.json`), never the book's text;
    anyone in the group can add or edit. PHB stats pre-filled for the spells
    in the current saves (marked "check" until compared with the book).
20. **Combat is a reference, not a game table (decided):** selections tell
    the player their options and what to roll (THAC0, roll needed by AC,
    damage dice, spell stats). No target picking, no in-app dice rolling, no
    shared dice log, no initiative strip. Players roll their own dice and
    speak results. A private mob tracker (the sheet's old Enemy Tracker:
    name, AC, damage dealt, notes, down) replaces DM-fed foes. The DM keeps
    the existing, simpler DM Helper; no live encounter features are planned
    for it. Supersedes the foe-list parts of decision 13.

---

## 9. Reference library (PHB and supplements)

**What it is:** one shared library of weapons, armor, spells, proficiencies,
kits, magic items, and monsters. The sheet picks from it (choose "Charm Person"
and its level, range, duration, and casting time fill in). The DM Helper uses it
for spell casting times in initiative and for monster stats when adding foes.

**Books (decided):** the **Player's Handbook** and the **Monstrous Manual**
(the 2e monster book). Rules the group uses from elsewhere (e.g. Quickness,
Bladesong, kits) go in the campaign layer as house rules. The DMG tables the DM
Helper already uses (reactions, crits, item saves) stay as they are.

**Structure:** the same pattern as the weapon list. A *core* layer (PHB), a
layer per *supplement* the group uses, and a *campaign* layer for house rules
and homebrew that can be based on a core entry and override only what differs.
Every entry records its source and page ("PHB p. 132") so anyone can check the
book.

**Copyright, practically:** game mechanics (numbers, tables, levels, ranges) are
generally fine to store. The books' descriptive text is copyrighted and isn't
under an open license, so the library shouldn't copy it in bulk, even in a
private app. Instead, each entry carries the mechanics, a short summary in the
group's own words, the book and page, and an optional link (as the sheet's
wiki links do today). Not legal advice; this is the cautious, common approach.

**Effort:** the data entry is the real cost (the PHB alone has hundreds of
spells). Build it in order of what the tools calculate with: weapons (started)
→ armor → proficiencies → spells (casting time matters for initiative) →
monsters (the DM's foe list) → magic items. Monsters can move earlier if the DM
wants the foe list sooner; a monster entry is small (AC, HD, THAC0, attacks,
damage, size, movement, morale, XP) and the DM can add the ones the campaign
actually meets first. Group-editable, DM-approved, so it
can grow over time.

## 10. Risks and safeguards

| Risk | Safeguard |
|---|---|
| Lost data | Version history per character; a nightly backup we run ourselves (the free plan has no daily backups), saved to a private location; JSON export stays a permanent feature |
| Free-plan email limits | Admin-issued temporary passwords; no email needed |
| Someone edits a sheet while it's open elsewhere | "Changed since you opened it" check before saving, and an indicator showing who else has it open |
| One user's text breaks another's page | User text is always displayed as text, never as HTML; checked before launch |
| Permission mistakes expose DM secrets | Rules enforced in the database, with a test checklist per role before each release |
| Edit collisions mid-combat | Three-owner data split (section 5) plus field-level updates |
| Rules extraction changes the sheet's numbers | Tests compare before/after for every sample save before shipping |
| Old saves stop loading after changes | Existing `__version` + `migrateData()` mechanism |
| Free tier pauses | Weekly play keeps it active; restore is one click |

---

## 11. Status

- [x] Character sheet received and reviewed
- [x] DM Helper received and reviewed
- [x] One character save received (Jaque)
- [x] Repo made private, then files committed to `legacy/` and `samples/`
- [x] Combat data spec drafted (`docs/combat-data-spec.md`)
- [x] Combat data spec: first round of UX answers folded in
- [x] Sheet: weapon settings gear (based on, melee/thrown, magic +); Combat Scenarios and Enemy Tracker removed (data kept in saves); THAC0 card shows base from class and level
- [x] Combat tab: weapon list read only from the sheet's Weapons; roll-needed-by-AC table; your own notes on each target
- [ ] Combat effects on ability cards (so bonuses and stances come from the sheet, not the v2 fixture)
- [ ] Combat data spec: remaining questions in its section 8
- [ ] Saves from the other active players
- [ ] Answers to section 8
- [ ] Accounts: Netlify or Cloudflare, Supabase (free; owned by you)
