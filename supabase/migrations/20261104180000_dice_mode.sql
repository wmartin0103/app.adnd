-- How someone rolls (decided 2026-11-04): 'assisted' (the app rolls) or 'own'
-- (they roll real dice and type the result). Set on the Account page, under the
-- existing rule that people edit their own profile. Everyone starts on assisted,
-- so nothing changes until they choose.
alter table public.profiles
  add column if not exists dice_mode text not null default 'assisted'
  check (dice_mode in ('assisted', 'own'));
