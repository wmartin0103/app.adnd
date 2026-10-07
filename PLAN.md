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

- Login uses **email magic links**: you type your email and click the link that
  arrives. No passwords to manage.
- **Sign-ups are disabled.** The DM (or you) invites each player's email from the
  Supabase dashboard, so only your group can get in.
- Permissions are enforced **in the database**, not just hidden in the UI
  (Supabase calls this *Row Level Security*). Even if someone fiddles with the
  page, the database itself refuses:
  - A player can read and edit **their own** characters.
  - A player can **read** fellow party members' sheets (configurable; some groups prefer secrecy).
  - The DM can read every character in the campaign and edit **combat state**.
  - Only the DM can see encounters, monster stats, and DM notes.

---

## 4. Data model

Think of these as the "nouns" of the app. Each one is a table.

```
campaigns          one row per campaign (name, house-rule settings)
campaign_members   who's in which campaign, and their role: "dm" or "player"
characters         owner, campaign, data (← your existing character JSON), schema_version
encounters         campaign, name, status, data (← your existing encounter JSON)
combat_state       per-character live combat values: current HP, conditions,
                   initiative, spell slots used this fight
```

### Why split out `combat_state`?

This is the main design decision, and it's worth your attention as the UX owner.

If the DM's tool and a player's sheet both edit the same character record at
the same time, one of them overwrites the other ("last write wins"). Example:
the DM applies 6 damage while the player updates their inventory, and the
damage silently disappears.

The fix is to give each piece of data **one clear owner**:

- **Character sheet (`characters`)**: owned by the player. Stats, gear, spells known, notes.
- **Combat state (`combat_state`)**: shared during a fight. The DM writes damage
  and conditions. The player can also write their own HP and slot usage (house-rule
  dependent). Edits are small field-level updates, not whole-sheet saves, so they
  don't clobber each other.

The character sheet then *displays* combat state ("HP 14 / 22") without owning it.

### Encounters reference characters instead of copying them

Today the encounter tool probably holds its own copy of each PC's numbers. In the
app, an encounter stores **character IDs**. When the DM opens it, the tool loads
the current AC, THAC0, saves, and HP from the live sheets. If a player swaps
armor before the fight, the DM sees the change. Monsters and NPCs still live
inside the encounter's own data.

### Versioning the JSON

Each save gets a `schema_version` number. When the shape of the character data
changes (new house rule, new field), a small upgrade function converts old saves
on load. This also keeps old exported files importable for good.

---

## 5. Shared rules module

Both tools almost certainly calculate the same things, such as THAC0, saving
throws, AC adjustments, ability modifiers, and your house rules. Today that logic
is probably duplicated in each page.

We'll move it into one shared file (`src/rules/`) that both tools import. Change
a house rule once and both tools pick it up. It's also the easiest place to add
automated tests, so a math change can't quietly break a sheet.

---

## 6. Phased roadmap

Every phase ships something usable. Nothing forces a big-bang switchover, and
JSON import/export keeps working the whole time as a backup.

### Phase 0 — Gather and organize (one sitting)
- Commit both existing HTML pages to this repo, unchanged, under `legacy/`.
- Commit **sample JSON saves**: at least one character and one encounter.
- Write down the house rules that affect any calculation.
- Set up Vite so the pages run locally with `npm run dev`.

**Result:** one home for all the work, with version history.

### Phase 1 — Put it online (no logins yet)
- Connect the repo to Netlify/Cloudflare Pages.
- Both tools reachable at one URL with a simple landing page/nav.
- Import/export works exactly as today.

**Result:** nobody has to pass HTML files around. Updates ship by pushing to GitHub.
(If you want it hidden right away, Cloudflare Access can put an email gate in
front of the site for free until Phase 2's logins land.)

### Phase 2 — Accounts and cloud saves
- Create the Supabase project, tables, and permission rules.
- Add magic-link login and invite the group.
- Character sheet gets a **"My characters"** list, plus Save / Load from the cloud
  alongside the existing import/export.
- **Migration path:** each player logs in once and imports their current JSON
  save. It becomes their cloud character. Done.

**Result:** sheets live in one place and are reachable from any device.

### Phase 3 — Shared rules + data cleanup
- Extract calculation logic into `src/rules/`, used by both tools.
- Add `schema_version` and the upgrade function.
- Add basic automated tests for the rules math.

**Result:** one source of truth for game math. Lower risk for every later phase.

### Phase 4 — DM tool reads the party
- Encounter tool lists the campaign's characters. "Add party to encounter" pulls
  in live PCs.
- Encounters are saved to the cloud (DM-only).
- Introduce `combat_state`: the DM applies damage and conditions there.

**Result:** the DM stops re-typing PC stats. The main efficiency win.

### Phase 5 — Live sync at the table
- Turn on realtime: when the DM applies damage, the player's sheet updates on
  their phone within a second, and the reverse when a player spends a spell slot.
- Optional **player-facing combat view**: initiative order, whose turn it is, and
  visible conditions. Read-only, with no monster HP or DM secrets.

**Result:** the collaborative session experience.

### Phase 6 — Nice-to-haves (pick as wanted)
- Edit history / undo (keep previous versions of each sheet).
- Shared dice log.
- Installable on phones (PWA) with basic offline viewing.
- Campaign notes, loot tracking, XP awards from encounters straight to sheets.

---

## 7. Decisions for you (UX/product)

These change how things get built, so they're worth settling before Phase 2–4:

1. **Party visibility.** Can players see each other's full sheets, a summary, or nothing?
2. **Who edits HP in combat?** DM only, player only, or both? (Both is doable with `combat_state`.)
3. **Player combat view.** Do players get a live initiative screen, or does only the DM see it?
4. **Devices at the table.** Phones, laptops, or a shared TV? This drives layout priorities.
5. **Multiple campaigns/characters.** Will anyone run more than one? (The model supports it; the UI needs to show it.)
6. **DM override.** Should the DM be able to edit anything on a player's sheet?

---

## 8. Risks and safeguards

| Risk | Safeguard |
|---|---|
| Lost data | Daily DB backups (Supabase), plus JSON export stays a permanent feature |
| Permission mistakes expose DM secrets | Rules enforced in the database, with a test checklist per role before each release |
| Edit collisions mid-combat | `combat_state` split plus field-level updates (section 4) |
| Old saves stop loading after changes | `schema_version` plus upgrade functions |
| Free tier pauses | Weekly play keeps it active; restore is one click |

---

## 9. What's needed to start

- [ ] The current character sheet HTML file
- [ ] The current encounter tool HTML file
- [ ] One or more sample character JSON saves
- [ ] One or more sample encounter JSON saves (if the tool exports them)
- [ ] House rules that affect calculations (a list is fine)
- [ ] Answers to section 7 when convenient (not blocking Phases 0–1)
- [ ] Accounts: GitHub (have it), Netlify or Cloudflare, Supabase (all free; you own them, and I'll walk you through setup)
