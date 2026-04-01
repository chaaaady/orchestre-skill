-- Orchestre V15 — RLS Templates Réutilisables

-- Pattern 1 : Table owned by user (standard)
-- Remplacer {TABLE} par le nom de la table
/*
alter table public.{TABLE} enable row level security;

create policy "{TABLE}_select_own" on public.{TABLE}
  for select using (auth.uid() = user_id);

create policy "{TABLE}_insert_own" on public.{TABLE}
  for insert with check (auth.uid() = user_id);

create policy "{TABLE}_update_own" on public.{TABLE}
  for update using (auth.uid() = user_id);

create policy "{TABLE}_delete_own" on public.{TABLE}
  for delete using (auth.uid() = user_id);
*/

-- Pattern 2 : Table publique en lecture, owner en écriture
/*
alter table public.{TABLE} enable row level security;

create policy "{TABLE}_select_all" on public.{TABLE}
  for select using (true);

create policy "{TABLE}_write_own" on public.{TABLE}
  for all using (auth.uid() = user_id);
*/

-- Pattern 3 : Service role bypass (pour les edge functions)
/*
create policy "{TABLE}_service_role" on public.{TABLE}
  using (auth.role() = 'service_role');
*/
