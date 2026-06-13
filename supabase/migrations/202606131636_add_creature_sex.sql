alter table public.creatures
  add column if not exists sex text;

alter table public.creatures_dev
  add column if not exists sex text;

alter table public.creatures
  drop constraint if exists creatures_sex_male_female;

alter table public.creatures
  add constraint creatures_sex_male_female
  check (sex is null or sex in ('male', 'female'));

alter table public.creatures_dev
  drop constraint if exists creatures_dev_sex_male_female;

alter table public.creatures_dev
  add constraint creatures_dev_sex_male_female
  check (sex is null or sex in ('male', 'female'));

comment on column public.creatures.sex is
  'Individual sex marker for all creatures. Values: male or female for active curated rows; null only for unknown/imported rows.';

comment on column public.creatures_dev.sex is
  'Individual sex marker for all creatures. Values: male or female for active curated rows; null only for unknown/imported rows.';

update public.creatures
set sex = case
  when species = 'coryphaena-hippurus' and id in (90, 92) then 'male'
  when species = 'coryphaena-hippurus' and id in (91, 93) then 'female'
  when id % 2 = 0 then 'female'
  else 'male'
end
where alive is distinct from false;

update public.creatures_dev
set sex = case
  when species = 'coryphaena-hippurus' and id in (90, 92) then 'male'
  when species = 'coryphaena-hippurus' and id in (91, 93) then 'female'
  when id % 2 = 0 then 'female'
  else 'male'
end
where alive is distinct from false;
