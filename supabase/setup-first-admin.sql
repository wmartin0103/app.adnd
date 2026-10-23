-- ════════════════════════════════════════════════════════════════════════
-- Run after schema.sql, in the Supabase SQL editor. Safe to run again.
-- First create your own account: Authentication → Users → Add user.
-- Then replace the three values below and run the whole file.
-- ════════════════════════════════════════════════════════════════════════

-- Accounts made before schema.sql ran have no profile yet: add them
insert into public.profiles (id, display_name)
  select id, split_part(email, '@', 1) from auth.users
  where id not in (select id from public.profiles);

-- Your account's email, the name the app shows for you, the campaign's name
with v as (select 'YOUR_EMAIL' as email, 'YOUR_DISPLAY_NAME' as display_name, 'CAMPAIGN_NAME' as campaign)

-- You: admin, with your display name
, me as (
  update public.profiles p set is_admin = true, display_name = v.display_name
  from v, auth.users u
  where lower(u.email) = lower(v.email) and p.id = u.id
  returning p.id
)
-- The campaign (the one already there under this name, or a new one)
, found as (select c.id from public.campaigns c, v where c.name = v.campaign order by c.created_at limit 1)
, made as (
  insert into public.campaigns (name) select campaign from v where not exists (select 1 from found) returning id
)
, camp as (select id from found union all select id from made)
-- You as its DM
insert into public.campaign_members (campaign_id, user_id, role)
  select camp.id, me.id, 'dm' from camp, me
  on conflict (campaign_id, user_id) do update set role = 'dm';

-- Check: should list your name, admin true, the campaign and role dm.
-- Nothing here? The email above doesn't match the account's email exactly.
select p.display_name, p.is_admin, c.name as campaign, m.role
from public.profiles p
join public.campaign_members m on m.user_id = p.id
join public.campaigns c on c.id = m.campaign_id;
