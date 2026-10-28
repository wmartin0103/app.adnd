-- ════════════════════════════════════════════════════════════════════════
-- Change someone's role in a campaign: 'dm' or 'player'. Run in the Supabase
-- SQL editor. Safe to run again.
--
-- A DM gets the DM Helper and can run the round, see and edit every character
-- in the campaign, and give edit access; they keep their own characters on
-- "Your characters" too, so they can try both sides (DM and player). A player
-- sees the party, edits only their own characters (and any they're given).
--
-- For QA (2026-10-28): set the tester to 'dm'; when you're done, run this
-- again with 'player' to put them back. Two DMs share the same live round:
-- either one's Next round or Reset encounter reaches every sheet.
--
-- The person must already be in the campaign (supabase/add-player.sql).
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email    text := 'PERSON_EMAIL';
  v_role     text := 'dm';              -- 'dm' or 'player'
  v_campaign text := 'CAMPAIGN_NAME';
  v_user uuid;
  v_camp uuid;
begin
  if v_role not in ('dm', 'player') then raise exception 'The role is dm or player, not %', v_role; end if;
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then raise exception 'No account with the email %', v_email; end if;
  select id into v_camp from public.campaigns where name = v_campaign order by created_at limit 1;
  if v_camp is null then raise exception 'No campaign named %. The names: select name from campaigns;', v_campaign; end if;
  update public.campaign_members set role = v_role where campaign_id = v_camp and user_id = v_user;
  if not found then raise exception '% is not in % yet: add them first (supabase/add-player.sql)', v_email, v_campaign; end if;
end $$;

-- Check: everyone in the campaign and their role
select p.display_name, m.role, c.name as campaign
from public.campaign_members m
join public.profiles p on p.id = m.user_id
join public.campaigns c on c.id = m.campaign_id
order by c.name, m.role, p.display_name;
