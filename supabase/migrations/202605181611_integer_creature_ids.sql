-- Convert creature ids from text labels like `fish_0001` / `'1'` to integer ids.
-- Run after backing up `public.creatures`.

alter table public.creatures
  alter column id drop default;

alter table public.creatures
  alter column id type integer
  using case
    when id ~ '^\d+$' then id::integer
    when id ~ '^fish_[0-9]+$' then substring(id from 'fish_0*([0-9]+)')::integer
    else null
  end;

create sequence if not exists public.creatures_id_seq;

select setval(
  'public.creatures_id_seq',
  coalesce((select max(id) from public.creatures), 0) + 1,
  false
);

alter sequence public.creatures_id_seq owned by public.creatures.id;

alter table public.creatures
  alter column id set default nextval('public.creatures_id_seq');

comment on column public.creatures.id is
  'Running integer sequence for every creature ever added to the Oceanarium.';
