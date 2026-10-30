-- Easier to manage in the Table Editor (decided 2026-10-30):
-- 1. A member's role is one choice from a list, so the editor shows a
--    dropdown: player, dm or both (a DM who also plays). It replaces role
--    plus also_plays (20261030120000_also_plays.sql).
-- 2. campaign_members has the person's name beside their id, copied from
--    profiles and kept in step with it (edit the name in profiles, or the
--    person changes it on Account).

-- ── 1. The role: a list ─────────────────────────────────────────────────
do $$ begin
  create type public.member_role as enum ('player', 'dm', 'both');
exception when duplicate_object then null;
end $$;

alter table public.campaign_members drop constraint if exists campaign_members_role_check;
alter table public.campaign_members
  alter column role type public.member_role
  using (case when role::text = 'dm' and coalesce(also_plays, false) then 'both' else role::text end)::public.member_role;
alter table public.campaign_members drop column if exists also_plays;

-- The DM's powers go with dm and both
create or replace function public.is_dm(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members where campaign_id = c and user_id = auth.uid() and role in ('dm', 'both'));
$$;

-- ── 2. The name, beside the id ──────────────────────────────────────────
alter table public.campaign_members add column if not exists name text;
update public.campaign_members m set name = p.display_name from public.profiles p where p.id = m.user_id;

-- A member's row always shows their profile's name
create or replace function public.member_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.name := (select display_name from profiles where id = new.user_id);
  return new;
end $$;
drop trigger if exists member_name on public.campaign_members;
create trigger member_name before insert or update on public.campaign_members
  for each row execute function public.member_name();

-- A renamed profile renames its member rows
create or replace function public.profile_name_to_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.display_name is distinct from old.display_name then
    update campaign_members set name = new.display_name where user_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists profile_name_to_members on public.profiles;
create trigger profile_name_to_members after update on public.profiles
  for each row execute function public.profile_name_to_members();
