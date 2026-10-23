-- ════════════════════════════════════════════════════════════════════════
-- AD&D campaign app: database draft for Phase 3 (Supabase / Postgres)
-- Run once in the Supabase SQL editor (whole file), then setup-first-admin.sql.
-- ════════════════════════════════════════════════════════════════════════
--
-- In plain words (PLAN.md section 3 and decisions 3 and 6):
--
--   People      Everyone has an account (issued by an admin). Admins manage
--               accounts and campaigns.
--   Campaigns   A campaign has members; each member is its DM or a player.
--   Characters  Each character belongs to one campaign and has one owner.
--               The whole sheet is one JSON document, exactly what the
--               character sheet saves today. The sheet is the source of truth.
--
--   Who can see a character      Everyone in its campaign (and admins).
--   Who can edit a character     Its owner, the campaign's DM, admins, and
--                                any player they have granted edit access.
--   Who can grant or revoke      The owner, the DM, admins.
--   Who can delete a character   The DM and admins (an owner can't delete by
--                                accident; ask the DM).
--
--   Every save keeps the previous version (the last 30 per character), with
--   who saved it, so a mistake can be undone. Saves carry a version number,
--   so the app can say "changed since you opened it" instead of overwriting.
--
-- Not here yet (later phases): encounters, monsters and DM notes (DM only),
-- the spell catalog as a table, the party view.
--
-- How the rules are enforced: Postgres "Row Level Security". Each table has
-- policies; the database refuses anything they don't allow, whatever the page
-- sends. The small functions below answer "is this person the DM here?" etc.,
-- so the policies stay readable.

-- ── People ──────────────────────────────────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Every new account gets a profile (named from its email until renamed)
create function public.on_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_new_user after insert on auth.users
  for each row execute function public.on_new_user();

-- ── Campaigns and who's in them ─────────────────────────────────────────

create table public.campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('dm', 'player')),
  primary key (campaign_id, user_id)
);

-- ── Characters ──────────────────────────────────────────────────────────

create table public.characters (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  owner_id    uuid not null references public.profiles (id) on delete restrict,
  name        text not null,                 -- copied from data.name for lists
  data        jsonb not null,                -- the sheet's save, as exported today
  version     integer not null default 1,    -- goes up by one on every save
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);
create index characters_campaign_idx on public.characters (campaign_id);

-- Players granted edit access to a character they don't own, for a session.
-- Removing the row revokes it.
create table public.character_editors (
  character_id uuid not null references public.characters (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  granted_by   uuid not null references public.profiles (id),
  granted_at   timestamptz not null default now(),
  primary key (character_id, user_id)
);

-- Earlier versions of each sheet (written by a trigger, never by the app)
create table public.character_versions (
  id           bigint generated always as identity primary key,
  character_id uuid not null references public.characters (id) on delete cascade,
  version      integer not null,
  data         jsonb not null,
  saved_at     timestamptz not null,
  saved_by     uuid references public.profiles (id)
);
create index character_versions_idx on public.character_versions (character_id, version desc);

-- ── Questions the policies ask ──────────────────────────────────────────
-- "security definer" lets them read the membership tables without tripping
-- over those tables' own policies.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members where campaign_id = c and user_id = auth.uid());
$$;

create function public.is_dm(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members where campaign_id = c and user_id = auth.uid() and role = 'dm');
$$;

-- Owner, the campaign's DM, or an admin
create function public.can_manage_character(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from characters
    where id = ch and (owner_id = auth.uid() or is_dm(campaign_id) or is_admin())
  );
$$;

-- Anyone who can manage it, plus players granted edit access
create function public.can_edit_character(ch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_character(ch)
      or exists (select 1 from character_editors where character_id = ch and user_id = auth.uid());
$$;

-- ── Policies ────────────────────────────────────────────────────────────

alter table public.profiles           enable row level security;
alter table public.campaigns          enable row level security;
alter table public.campaign_members   enable row level security;
alter table public.characters         enable row level security;
alter table public.character_editors  enable row level security;
alter table public.character_versions enable row level security;

-- Profiles: everyone signed in sees names; you rename yourself; admins manage
create policy "see profiles"    on public.profiles for select to authenticated using (true);
create policy "rename yourself" on public.profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- Campaigns and membership: members see them; admins manage them
create policy "see own campaigns" on public.campaigns for select to authenticated
  using (is_member(id) or is_admin());
create policy "admins manage campaigns" on public.campaigns for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "see fellow members" on public.campaign_members for select to authenticated
  using (is_member(campaign_id) or is_admin());
create policy "admins manage members" on public.campaign_members for all to authenticated
  using (is_admin()) with check (is_admin());

-- Characters
create policy "campaign sees characters" on public.characters for select to authenticated
  using (is_member(campaign_id) or is_admin());
-- A player creates their own; the DM or an admin can create one for anyone in the campaign
create policy "create characters" on public.characters for insert to authenticated
  with check (
    (owner_id = auth.uid() and is_member(campaign_id))
    or ((is_dm(campaign_id) or is_admin()) and exists (
      select 1 from campaign_members m where m.campaign_id = characters.campaign_id and m.user_id = owner_id))
  );
create policy "edit characters" on public.characters for update to authenticated
  using (can_edit_character(id)) with check (can_edit_character(id));
create policy "DM or admin deletes" on public.characters for delete to authenticated
  using (is_dm(campaign_id) or is_admin());

-- Granted editors: the campaign sees who has access; owner, DM or admin grant
-- and revoke, and only to someone in the same campaign
create policy "campaign sees grants" on public.character_editors for select to authenticated
  using (exists (select 1 from characters c where c.id = character_id and (is_member(c.campaign_id) or is_admin())));
create policy "grant edit access" on public.character_editors for insert to authenticated
  with check (
    can_manage_character(character_id) and granted_by = auth.uid()
    and exists (select 1 from characters c join campaign_members m on m.campaign_id = c.campaign_id
                where c.id = character_id and m.user_id = character_editors.user_id)
  );
create policy "revoke edit access" on public.character_editors for delete to authenticated
  using (can_manage_character(character_id));

-- Versions: the campaign can read them (to restore, the app saves an old
-- version as the new one, through the normal edit rules)
create policy "campaign sees versions" on public.character_versions for select to authenticated
  using (exists (select 1 from characters c where c.id = character_id and (is_member(c.campaign_id) or is_admin())));

-- ── Guards that policies can't express ──────────────────────────────────

-- Only admins change who is an admin (the SQL editor, with no signed-in
-- user, can: that's how the first admin is made)
create function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null and not is_admin() then
    raise exception 'Only an admin can change admin rights';
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- On every save: a granted editor can change the sheet but not who owns it or
-- which campaign it's in; keep the old version; bump the version number
create function public.on_character_save() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.owner_id is distinct from old.owner_id or new.campaign_id is distinct from old.campaign_id)
     and not (is_dm(old.campaign_id) or is_admin()) then
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
create trigger on_character_save before update on public.characters
  for each row execute function public.on_character_save();

-- ── The live round (This round on the sheet ↔ the DM's initiative page) ──
-- What round-sync.js keeps in the browser today, per campaign: the DM's side
-- (round number, the foes by ID and size, where extra attacks go) and each
-- character's round record. A record from an earlier round is simply ignored.

create table public.round_state (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  round       integer not null default 1,
  foes        jsonb not null default '[]',   -- [{ id, label, size }]: never AC or the DM's names
  timing      text not null default 'end' check (timing in ('end', 'turn')),
  updated_at  timestamptz not null default now()
);

create table public.round_records (
  character_id uuid primary key references public.characters (id) on delete cascade,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  round        integer not null,
  record       jsonb not null,               -- the round record, with the view the DM sees
  updated_at   timestamptz not null default now()
);
create index round_records_campaign_idx on public.round_records (campaign_id);

alter table public.round_state   enable row level security;
alter table public.round_records enable row level security;

-- The campaign sees the round; the DM (or an admin) runs it
create policy "campaign sees the round" on public.round_state for select to authenticated
  using (is_member(campaign_id) or is_admin());
create policy "DM runs the round" on public.round_state for all to authenticated
  using (is_dm(campaign_id) or is_admin()) with check (is_dm(campaign_id) or is_admin());

-- The campaign sees everyone's round; whoever can edit a character plays it
create policy "campaign sees rounds" on public.round_records for select to authenticated
  using (is_member(campaign_id) or is_admin());
create policy "play your character's round" on public.round_records for all to authenticated
  using (can_edit_character(character_id))
  with check (can_edit_character(character_id)
    and exists (select 1 from characters c where c.id = character_id and c.campaign_id = round_records.campaign_id));

-- ── Live updates ────────────────────────────────────────────────────────
-- Open sheets and the DM Helper hear about saves as they happen (HP sync, the
-- live round). Realtime respects the select policies above.
alter publication supabase_realtime add table public.characters, public.character_editors,
  public.round_state, public.round_records;

-- ── Saving from the app (for later) ─────────────────────────────────────
-- Save only if nobody saved since this copy was opened:
--   update characters set data = $1 where id = $2 and version = $3 returning version;
-- No row back means someone else saved first: show "changed since you opened it".
