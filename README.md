# app.adnd

Web app for our homegrown AD&D 2e campaign: a shared character sheet and the
DM's combat helper, with sign-in and saves on Supabase. It's live at
https://wmartin0103.github.io/app.adnd/.

**Working on it, as a person or an agent? Start with [`AGENTS.md`](AGENTS.md).**

- **The plan:** [`PLAN.md`](PLAN.md)
- **Combat data design:** [`docs/combat-data-spec.md`](docs/combat-data-spec.md)
- **House rules:** [`docs/house-rules/`](docs/house-rules/)

## What's here

| Folder | Contents |
|---|---|
| `tools/` | The character sheet and DM Helper (published at `sheet/` and `dm/`) |
| `site/` | Home and Account |
| `data/` | The spell catalog |
| `supabase/` | Database migrations and admin queries |
| `docs/` | The design system, house rules and how the site is deployed |
| `src/rules/` | Game math as plain functions: attacks, saves, thief skills, proficiencies, old-save conversion |
| `src/adapters/` | Converters between tools (sheet → DM Helper) |
| `scripts/` | Command-line helpers |
| `test/fixtures/characters/` | Snapshots of real characters, for the tests (the live saves are in Supabase) |
| `test/` | Automated tests (`npm test`) |
| `generated/` | Ready-to-paste DM Helper blocks |

## Run the tests

Needs Node.js 20 or newer. No install step.

```
npm test
```

## Update the DM Helper from character sheets

Signed in, the DM Helper's party comes from the campaign: each player's character
in play, read from their saved sheet. A sheet's changes reach it from there, so
there's nothing to import.

The **Config** tab's **Import character** puts a sheet file into a player's
Backups, for a character the DM has prepared.

**For the hand-typed characters in the DM Helper's code, as a paste-in block:**

```
node scripts/dm-helper-config.mjs path/to/save.json [more saves…]
```

This prints one block of JavaScript. In the DM Helper file, paste it just above
the line `const STORE_KEY='adnd-init-tracker';`. It replaces those characters'
hand-typed stats (weapons, damage, saves, skills, thief skills, AC) and leaves
everyone else alone. Re-run and re-paste whenever a sheet changes. Anything the
converter couldn't work out is listed at the end under **NEEDS REVIEW**.

`generated/dm-helper-jaque.js` is Jaque's block, made from his sheet updated to
the revised Blade.

## Design prototypes

`prototypes/*.template.html` are clickable design drafts that run the real
rules on Jaque's data. Build them with `node scripts/build-prototype.mjs`; the
output (`prototypes/*.html`) opens straight in a browser.

## After changing anything in `src/`

The pages carry their own copies of that code. Refresh them with:

```
node scripts/build-tools.mjs
```

`npm test` fails if you forget.

## Contributing

`main` is the live site. Every change goes through a pull request: see
[AGENTS.md](AGENTS.md).
