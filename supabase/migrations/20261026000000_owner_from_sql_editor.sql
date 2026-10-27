-- ════════════════════════════════════════════════════════════════════════
-- The SQL editor can give a character to its player (supabase/add-player.sql).
-- A save that changes a character's owner or campaign is for the DM or an
-- admin; the SQL editor has no signed-in user, so it counted as neither.
-- Like guard_profile in the first migration: no signed-in user is the
-- project's own SQL editor, which may.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.on_character_save() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.owner_id is distinct from old.owner_id or new.campaign_id is distinct from old.campaign_id)
     and auth.uid() is not null and not (is_dm(old.campaign_id) or is_admin()) then
    raise exception 'Only the DM or an admin can move a character or change its owner';
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
