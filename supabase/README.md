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
