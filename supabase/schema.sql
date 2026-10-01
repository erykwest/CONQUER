create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  world_cell_x integer not null default 0,
  world_cell_y integer not null default 0,
  terrain_seed integer not null,
  biome text not null default 'plains',
  neighbor_biomes jsonb not null default '{}'::jsonb,
  resources jsonb not null default '{"gold":1000,"population":100,"food":500,"wood":300,"stone":500,"metal":100,"equipment":50}'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  structures jsonb not null default '[]'::jsonb,
  camera jsonb not null default '{"scale":1,"x":0,"y":0}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_user_cell_unique unique (user_id, world_cell_x, world_cell_y),
  constraint settlements_structures_array check (jsonb_typeof(structures) = 'array'),
  constraint settlements_neighbors_object check (jsonb_typeof(neighbor_biomes) = 'object'),
  constraint settlements_resources_object check (jsonb_typeof(resources) = 'object'),
  constraint settlements_policies_object check (jsonb_typeof(policies) = 'object')
);

create index if not exists settlements_user_id_idx on public.settlements(user_id);

alter table public.settlements enable row level security;

revoke all on table public.settlements from anon;
grant select, insert, update, delete on table public.settlements to authenticated;

drop policy if exists settlements_select_own on public.settlements;
create policy settlements_select_own on public.settlements
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists settlements_insert_own on public.settlements;
create policy settlements_insert_own on public.settlements
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists settlements_update_own on public.settlements;
create policy settlements_update_own on public.settlements
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists settlements_delete_own on public.settlements;
create policy settlements_delete_own on public.settlements
for delete to authenticated using ((select auth.uid()) = user_id);
