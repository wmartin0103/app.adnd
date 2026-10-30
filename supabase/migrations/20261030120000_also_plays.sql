-- A member's roles add up (decided 2026-10-30): the DM role gets the DM
-- Helper; the player role gets characters; someone can have both. A member
-- keeps one row and one role ('dm' or 'player'); also_plays marks a DM who
-- also plays (has characters of their own). Set it with supabase/set-role.sql
-- (v_role 'both').
alter table public.campaign_members
  add column if not exists also_plays boolean not null default false;
