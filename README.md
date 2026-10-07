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
