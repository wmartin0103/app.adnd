# app.adnd

Web app for our homegrown AD&D 2e campaign: a shared character sheet and the
DM's combat helper, moving from two standalone HTML pages to one private site.

- **The plan:** [`PLAN.md`](PLAN.md)
- **Combat data design:** [`docs/combat-data-spec.md`](docs/combat-data-spec.md)
- **House rules:** [`docs/house-rules/`](docs/house-rules/)

## What's here

| Folder | Contents |
|---|---|
| `legacy/` | The current character sheet and DM Helper (still the tools in use) |
| `src/rules/` | Game math as plain functions: attacks, saves, thief skills, proficiencies, old-save conversion |
| `src/adapters/` | Converters between tools (sheet → DM Helper) |
| `scripts/` | Command-line helpers |
| `samples/` | Real character saves |
| `test/` | Automated tests (`npm test`) |
| `generated/` | Ready-to-paste DM Helper blocks |

## Run the tests

Needs Node.js 20 or newer. No install step.

```
npm test
```

## Update the DM Helper from character sheets

**Easiest:** in the DM Helper, open the **Config** tab and use **Import sheets…**
to pick players' exported `.json` saves. Their stats replace the hand-typed
ones and stay in that browser until removed (re-import a newer save to update).
The DM's own settings (parry, armor spell, virtue, hidden by default, init
bonus, turning) are kept. Each sheet lists anything worth checking.

**Or as a paste-in block:**

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

## After changing anything in `src/`

The DM Helper carries its own copy of the converter so it still opens straight
from disk. Refresh it with:

```
node scripts/build-legacy.mjs
```

`npm test` fails if you forget.
