-- ════════════════════════════════════════════════════════════════════════
-- A character's status, for "Your characters" (decided 2026-10-26):
--   play     the one character a player has in the party (one each)
--   backup   ready for the next session, if the one in play falls
--   dead     kept, and still editable: they could come back
-- Only the owner, the DM or an admin moves a character between them (a player
-- given edit access can play it, not retire it).
-- ════════════════════════════════════════════════════════════════════════

alter table public.characters add column if not exists status text not null default 'backup';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'characters_status_check') then
    alter table public.characters add constraint characters_status_check check (status in ('play', 'backup', 'dead'));
  end if;
end $$;

-- One character in play per player, per campaign
create unique index if not exists characters_one_in_play
  on public.characters (campaign_id, owner_id) where status = 'play';

create or replace function public.on_character_save() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.owner_id is distinct from old.owner_id or new.campaign_id is distinct from old.campaign_id)
     and auth.uid() is not null and not (is_dm(old.campaign_id) or is_admin()) then
    raise exception 'Only the DM or an admin can move a character or change its owner';
  end if;
  if new.status is distinct from old.status and auth.uid() is not null and not can_manage_character(old.id) then
    raise exception 'Only the owner, the DM or an admin can change a character''s status';
  end if;
  if new.data is distinct from old.data then
    insert into character_versions (character_id, version, data, saved_at, saved_by)
      values (old.id, old.version, old.data, old.updated_at, old.updated_by);
    delete from character_versions
      where character_id = old.id
        and id not in (select id from character_versions where character_id = old.id order by version desc limit 30);
  end if;
  new.version    := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.name       := coalesce(nullif(new.data ->> 'name', ''), new.name);
  return new;
end $$;
