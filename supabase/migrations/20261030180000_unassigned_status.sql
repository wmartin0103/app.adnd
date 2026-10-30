-- A character the DM has made (or imported) and not yet given to a player:
-- status 'unassigned' (decided 2026-10-30). It sits in the DM's Backups on
-- Home, apart from any characters the DM plays; it can't be brought into
-- play, only assigned (which makes it the player's, in their Backups).
alter table public.characters drop constraint if exists characters_status_check;
alter table public.characters add constraint characters_status_check
  check (status in ('play', 'backup', 'dead', 'unassigned'));
