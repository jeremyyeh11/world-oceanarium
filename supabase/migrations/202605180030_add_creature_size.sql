-- Add normalized per-individual size control.
-- size is intentionally unitless:
--   0 -> species sizeRange min
--   1 -> species sizeRange max
-- NULL keeps the app's deterministic per-id fallback size.

alter table public.creatures
  add column if not exists size numeric;

alter table public.creatures
  drop constraint if exists creatures_size_unit_interval;

alter table public.creatures
  add constraint creatures_size_unit_interval
  check (size is null or (size >= 0 and size <= 1));

comment on column public.creatures.size is
  'Normalized individual size parameter. 0 maps to species min sizeRange; 1 maps to species max sizeRange; null uses deterministic fallback.';

-- Current test data defaults after the column exists.
update public.creatures
set size = 0.5
where species = 'Sardine'
  and alive = true
  and size is null;

update public.creatures
set size = 1.0
where id = 'large_temp_1';
