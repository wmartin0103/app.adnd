-- No two characters in play in a campaign share a name (decided 2026-11-04). The
-- DM Helper follows each round by character name, so two with one name would
-- collide. Backups and the dead aren't limited, so a copy or a blank new character
-- can't get in the way. Stop if this fails: a campaign has two in play with one
-- name, and one of them needs renaming first.
create unique index if not exists characters_name_in_play
  on public.characters (campaign_id, lower(btrim(name))) where status = 'play';
