-- ════════════════════════════════════════════════════════════════════════
-- SET SOMEONE'S ROLE
-- Run in the Supabase SQL editor. Safe to run again.
--
-- ┌─ FILL IN ──────────────────────────────────────────────────────────────┐
-- │ 1. Their email, between the quotes on the v_email line below.          │
-- │ 2. Their role, between the quotes on the v_role line. One of:          │
-- │      'player'  has characters (Home: In play, Backups, Dead)           │
-- │      'dm'      runs the game (Home: DM Helper, Party, DM Backups)      │
-- │      'both'    a DM who also plays (Home: Player and DM tabs)          │
-- │ 3. Leave the rest as it is, then press Run.                            │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Other things you can change, only if you mean to:
-- - v_admin: null leaves admin as it is (the usual). true makes them an
--   admin; false takes it away. An admin can change anyone's access,
--   including yours, so keep it to people you'd trust with the database.
-- - v_campaign: leave it empty for your campaign (the first one made).
--   Only for another one (a test campaign, say) put its name here.
--
-- The person must already be in the campaign: add them with
-- supabase/add-player.sql first. The table at the end shows everyone after
-- the change.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email    text    := 'PERSON_EMAIL';
  v_role     text    := 'player';         -- 'player', 'dm' or 'both'
  v_admin    boolean := null;             -- null (leave it), true or false
  v_campaign text    := '';               -- empty: your campaign (the first one made)
  v_user uuid;
  v_camp uuid;
begin
  v_role := lower(trim(v_role));
  if v_role not in ('dm', 'player', 'both') then
    raise exception 'The role is player, dm or both, not "%"', v_role;
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(v_email));
  if v_user is null then raise exception 'No account with the email %', v_email; end if;
  if trim(v_campaign) = '' then
    select id into v_camp from public.campaigns order by created_at limit 1;   -- the first: the real campaign
    if v_camp is null then raise exception 'There are no campaigns yet (supabase/setup-first-admin.sql makes the first).'; end if;
  else
    select id into v_camp from public.campaigns where name = v_campaign order by created_at limit 1;
    if v_camp is null then raise exception 'No campaign named %. The names: select name from campaigns;', v_campaign; end if;
  end if;
  update public.campaign_members set role = v_role::public.member_role
    where campaign_id = v_camp and user_id = v_user;
  if not found then raise exception '% is not in the campaign yet: add them first (supabase/add-player.sql)', v_email; end if;
  if v_admin is not null then
    update public.profiles set is_admin = v_admin where id = v_user;
  end if;
end $$;

-- Everyone after the change: name, email, role (both = dm + also plays), admin
select p.display_name as name, u.email,
       m.role,
       p.is_admin as admin, c.name as campaign
from public.campaign_members m
join public.profiles p on p.id = m.user_id
join auth.users u on u.id = m.user_id
join public.campaigns c on c.id = m.campaign_id
order by c.name, role, p.display_name;
