-- ════════════════════════════════════════════════════════════════════════
-- Add a player (or give one a new temporary password). Run in the Supabase
-- SQL editor, after the migrations. Safe to run again.
--
-- 1. Make their account: Authentication → Users → Add user → Create new user.
--    Their email, a temporary password, and tick "Auto Confirm User".
--    (For a forgotten password: open the user there and set a new one.)
-- 2. Replace the four values below and run the whole file.
-- 3. Send them the site's address, their email and the temporary password
--    however the group talks. At first sign-in they choose their own.
--
-- What it does: names them, adds them to the campaign as a player, makes them
-- the owner of their characters (the character's row if the campaign has one
-- by that name, else a new one), puts the first one in play if they have
-- none in play (the rest are backups), and marks the password as temporary.
-- A character's name must match the name on its sheet exactly; the list of
-- names already in the campaign is at the bottom of this file.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email      text   := 'PLAYER_EMAIL';
  v_name       text   := 'PLAYER_NAME';           -- what the party sees; they can change it
  v_characters text[] := array['CHARACTER_NAME'];  -- one or more: array['Goroth', 'Tig']
  v_campaign   text   := 'CAMPAIGN_NAME';
  v_user uuid;
  v_camp uuid;
  ch text;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No account with the email %. Make it first: Authentication → Users → Add user.', v_email;
  end if;
  select id into v_camp from public.campaigns where name = v_campaign order by created_at limit 1;
  if v_camp is null then
    raise exception 'No campaign named %. The names: select name from campaigns;', v_campaign;
  end if;

  insert into public.profiles (id, display_name) values (v_user, v_name)
    on conflict (id) do update set display_name = excluded.display_name;
  -- They choose their own password at first sign-in (src/cloud.js, needsNewPassword)
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"temp_password": true}'::jsonb
    where id = v_user;
  -- A player in the campaign (someone already in it keeps their role)
  insert into public.campaign_members (campaign_id, user_id, role) values (v_camp, v_user, 'player')
    on conflict (campaign_id, user_id) do nothing;

  foreach ch in array v_characters loop
    if exists (select 1 from public.characters where campaign_id = v_camp and name = ch) then
      update public.characters set owner_id = v_user where campaign_id = v_camp and name = ch;
    else
      insert into public.characters (campaign_id, owner_id, name, data)
        values (v_camp, v_user, ch, jsonb_build_object('name', ch));
    end if;
  end loop;
  -- One character in play each: the first, unless they already have one
  if not exists (select 1 from public.characters where campaign_id = v_camp and owner_id = v_user and status = 'play') then
    update public.characters set status = 'play' where campaign_id = v_camp and owner_id = v_user and name = v_characters[1];
  end if;
end $$;

-- Check: everyone in the campaign, and whose each character is
select p.display_name, m.role, c.name as campaign,
       (select string_agg(ch.name || ' (' || ch.status || ')', ', ' order by ch.name) from public.characters ch
          where ch.campaign_id = c.id and ch.owner_id = p.id) as characters
from public.campaign_members m
join public.profiles p on p.id = m.user_id
join public.campaigns c on c.id = m.campaign_id
order by c.name, m.role, p.display_name;
