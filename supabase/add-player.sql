-- ════════════════════════════════════════════════════════════════════════
-- ADD SOMEONE TO THE CAMPAIGN (or give them a new temporary password)
-- Run in the Supabase SQL editor. Safe to run again.
--
-- First, make their login: Authentication → Users → Add user → Create new
-- user. Their email, a temporary password, and tick "Auto Confirm User".
-- (A forgotten password: open their user there, set a new one, then run
-- this again with the role they already have.)
--
-- ┌─ FILL IN ──────────────────────────────────────────────────────────────┐
-- │ 1. v_email: their email, the same one as their login.                  │
-- │ 2. v_name: their name, as the party will see it. They can change it.   │
-- │ 3. v_role: one of                                                      │
-- │      'player'  has characters (Home: In play, Backups, Dead)           │
-- │      'dm'      runs the game (Home: DM Helper, Party, DM Backups)      │
-- │      'both'    a DM who also plays (Home: Player and DM tabs)          │
-- │ 4. v_characters: optional. Their characters' names, separated by       │
-- │    commas: 'Goroth, Tig'. The first goes in play. Leave it '' and they │
-- │    can start or import their own on Home.                              │
-- │ 5. Press Run.                                                          │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Then send them the site's address, their email and the temporary
-- password, however the group talks. At first sign-in they choose their own.
--
-- What it does: names them, puts them in the campaign with that role, marks
-- the password as temporary, and makes them the owner of the characters
-- named (the campaign's character with that name if there is one, else a
-- new, empty one). A name must match the name on its sheet exactly; the
-- table at the end shows everyone and their characters.
-- v_campaign: leave it empty for your campaign (the first one made). Only
-- for another one (a test campaign, say) put its name there.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email      text := 'PERSON_EMAIL';
  v_name       text := 'PERSON_NAME';
  v_role       text := 'player';          -- 'player', 'dm' or 'both'
  v_characters text := '';                -- optional: 'Goroth, Tig'
  v_campaign   text := '';                -- empty: your campaign (the first one made)
  v_user uuid;
  v_camp uuid;
  v_names text[];
  ch text;
begin
  v_role := lower(trim(v_role));
  if v_role not in ('dm', 'player', 'both') then
    raise exception 'The role is player, dm or both, not "%"', v_role;
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(v_email));
  if v_user is null then
    raise exception 'No login with the email %. Make it first: Authentication → Users → Add user.', v_email;
  end if;
  if trim(v_name) = '' or v_name = 'PERSON_NAME' then
    raise exception 'Put their name on the v_name line.';
  end if;
  if trim(v_campaign) = '' then
    select id into v_camp from public.campaigns order by created_at limit 1;   -- the first: the real campaign
    if v_camp is null then raise exception 'There are no campaigns yet (supabase/setup-first-admin.sql makes the first).'; end if;
  else
    select id into v_camp from public.campaigns where name = v_campaign order by created_at limit 1;
    if v_camp is null then raise exception 'No campaign named %. The names: select name from campaigns;', v_campaign; end if;
  end if;

  insert into public.profiles (id, display_name) values (v_user, trim(v_name))
    on conflict (id) do update set display_name = excluded.display_name;
  -- They choose their own password at first sign-in (src/cloud.js, needsNewPassword)
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"temp_password": true}'::jsonb
    where id = v_user;
  -- In the campaign with that role
  insert into public.campaign_members (campaign_id, user_id, role) values (v_camp, v_user, v_role::public.member_role)
    on conflict (campaign_id, user_id) do update set role = excluded.role;

  -- Their characters, if any were named
  select coalesce(array_agg(trim(x)), '{}') into v_names
    from unnest(string_to_array(v_characters, ',')) as x where trim(x) <> '';
  foreach ch in array v_names loop
    if exists (select 1 from public.characters where campaign_id = v_camp and name = ch) then
      update public.characters set owner_id = v_user where campaign_id = v_camp and name = ch;
    else
      insert into public.characters (campaign_id, owner_id, name, data, status)
        values (v_camp, v_user, ch, jsonb_build_object('name', ch), 'backup');
    end if;
  end loop;
  -- One character in play each: the first named, unless they already have one
  if array_length(v_names, 1) > 0
     and not exists (select 1 from public.characters where campaign_id = v_camp and owner_id = v_user and status = 'play') then
    update public.characters set status = 'play' where campaign_id = v_camp and owner_id = v_user and name = v_names[1];
  end if;
end $$;

-- Everyone after the change: name, email, role, admin, and their characters
select p.display_name as name, u.email,
       m.role,
       p.is_admin as admin,
       (select string_agg(ch.name || ' (' || ch.status || ')', ', ' order by ch.name) from public.characters ch
          where ch.campaign_id = c.id and ch.owner_id = p.id) as characters
from public.campaign_members m
join public.profiles p on p.id = m.user_id
join auth.users u on u.id = m.user_id
join public.campaigns c on c.id = m.campaign_id
order by c.name, role, p.display_name;
