alter table public.creatures
  add column if not exists life_stage text not null default 'adult';

alter table public.creatures_dev
  add column if not exists life_stage text not null default 'adult';

alter table public.creatures
  drop constraint if exists creatures_life_stage_known;

alter table public.creatures
  add constraint creatures_life_stage_known
  check (life_stage in ('juvenile', 'adult'));

alter table public.creatures_dev
  drop constraint if exists creatures_dev_life_stage_known;

alter table public.creatures_dev
  add constraint creatures_dev_life_stage_known
  check (life_stage in ('juvenile', 'adult'));

comment on column public.creatures.life_stage is
  'Individual life stage, entered by hand. Values: juvenile or adult. Not yet derived from born_at; widen the check constraint to add stages.';

comment on column public.creatures_dev.life_stage is
  'Individual life stage, entered by hand. Values: juvenile or adult. Not yet derived from born_at; widen the check constraint to add stages.';
