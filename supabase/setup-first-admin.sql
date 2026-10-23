-- ════════════════════════════════════════════════════════════════════════
-- Run once, after schema.sql, in the Supabase SQL editor.
-- First create your own account: Authentication → Users → Add user.
-- Then replace the three values below and run the whole file.
-- ════════════════════════════════════════════════════════════════════════

-- Your account's email, the name the app shows for you, the campaign's name
with v as (select 'YOUR_EMAIL' as email, 'YOUR_DISPLAY_NAME' as display_name, 'CAMPAIGN_NAME' as campaign)

-- You: admin, with your display name
, me as (
  update public.profiles p set is_admin = true, display_name = v.display_name
  from v, auth.users u
  where u.email = v.email and p.id = u.id
  returning p.id
)
-- The campaign
, camp as (
  insert into public.campaigns (name) select campaign from v returning id
)
-- You as its DM
insert into public.campaign_members (campaign_id, user_id, role)
  select camp.id, me.id, 'dm' from camp, me;

-- Check: should list your name, admin true, the campaign and role dm
select p.display_name, p.is_admin, c.name as campaign, m.role
from public.profiles p
join public.campaign_members m on m.user_id = p.id
join public.campaigns c on c.id = m.campaign_id;
