-- Allow browser anon reads from the dev creature table.
-- Dev builds route to `public.creatures_dev`; without a matching SELECT policy,
-- PostgREST returns an empty array even when service-role reads show rows.

alter table public.creatures_dev enable row level security;

grant select on table public.creatures_dev to anon;
grant select on table public.creatures_dev to authenticated;

drop policy if exists "Allow anon read alive creatures_dev" on public.creatures_dev;
create policy "Allow anon read alive creatures_dev"
  on public.creatures_dev
  for select
  to anon
  using (alive = true);

drop policy if exists "Allow authenticated read alive creatures_dev" on public.creatures_dev;
create policy "Allow authenticated read alive creatures_dev"
  on public.creatures_dev
  for select
  to authenticated
  using (alive = true);
