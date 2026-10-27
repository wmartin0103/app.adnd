-- ════════════════════════════════════════════════════════════════════════
-- A player can delete their own character from Backups or Dead (decided
-- 2026-10-27), never the one in play. The DM and admins can delete any.
-- Deleting takes its versions, round record and given access with it.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists "DM or admin deletes" on public.characters;
drop policy if exists "delete characters" on public.characters;
create policy "delete characters" on public.characters for delete to authenticated
  using (is_dm(campaign_id) or is_admin() or (owner_id = auth.uid() and status <> 'play'));
