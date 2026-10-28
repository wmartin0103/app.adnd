# Supabase

The database behind sign-in and the live round (and, later, cloud saves).

- **`migrations/`** — the database's structure: tables, permission rules
  (Row Level Security), triggers, realtime. Applied with the Supabase CLI
  from this folder (linked to the project): `npx.cmd supabase db push`
  (`npx.cmd` on Windows PowerShell). Supabase keeps a record of which ones
  have run; `npx.cmd supabase migration list --linked` shows it. The GitHub
  integration is connected but didn't deploy on push (as of 2026-10-23).
- **`setup-first-admin.sql`** — data, not structure: makes the owner an admin
  and DM of the first campaign. Run by hand in the SQL Editor, once.
- **`add-player.sql`** — data: adds a player to the campaign, gives them
  their characters, and marks their password as temporary (they choose their
  own at first sign-in). Also for a forgotten password: set a new one on the
  user in Authentication → Users, then run it again. Steps are in the file.

- **`set-role.sql`** — data: makes someone in the campaign its DM or a
  player. A DM keeps their own characters too, so it's how a tester tries
  both sides; run it again with `player` to undo.

## Settings made in the dashboard (not in the repo)

- **Authentication → Sign In / Providers → Email → "Confirm email": off.**
  Accounts are made by an admin, and the free email sender only reaches the
  project team's own addresses, so a confirmation link would never arrive.
  With it off, a player's email change on the Account page takes effect at
  once (decided 2026-10-26).

## Changing the database

Add a new file; never edit one that has already been deployed (Supabase won't
run it again). Name it with the date and time and a few words:

    migrations/20261024120000_add_hp_to_characters.sql

Write it so a mistake can't destroy data: add columns with defaults, and avoid
`drop` unless the change says so in its name.

`20261023000000_initial.sql` is different: the project was set up by hand
before the integration, so this first file only creates what's missing and
re-creates functions, triggers and rules. It's safe on the existing database
and builds a new one from nothing.

The URL and publishable key in `src/cloud.js` are public by design. The secret
key and the database password never go in the repo.
