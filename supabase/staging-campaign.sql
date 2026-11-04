-- ═══════════════════════════════════════
-- THE TEST CAMPAIGN FOR THE STAGING SITE
-- Run in the Supabase SQL editor. Safe to run again.
--
-- ┌─ FILL IN ──────────────────────────────────
-- │ 1. v_email: the login of who should be in it (run again for others).   │
-- │ 2. v_role: 'both' (Player and DM tabs), 'player' or 'dm'.              │
-- │ 3. Press Run.                                                          │
-- └──────────────────────────────────────
--
-- What it does: makes the campaign named 'Staging test' if it isn't there yet,
-- and puts that person in it. Their real campaign and characters aren't touched.
-- The live site never shows this campaign, and staging shows only this one.
-- The name must stay exactly as it is: src/cloud.js looks for it.
-- ═══════════════════════════════════════
do $$
declare
  v_email text := 'someone@example.com';
  v_role  text := 'both';
  v_user  uuid;
  v_camp  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then raise exception 'No login with the email %. Check it, or make one under Authentication → Users.', v_email; end if;

  select id into v_camp from public.campaigns where name = 'Staging test' order by created_at limit 1;
  if v_camp is null then
    insert into public.campaigns (name) values ('Staging test') returning id into v_camp;
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
    values (v_camp, v_user, v_role::public.member_role)
    on conflict (campaign_id, user_id) do update set role = excluded.role;
end $$;

-- Who's in it now
select u.email, m.role
from public.campaign_members m
join public.campaigns c on c.id = m.campaign_id
join auth.users u on u.id = m.user_id
where c.name = 'Staging test';
