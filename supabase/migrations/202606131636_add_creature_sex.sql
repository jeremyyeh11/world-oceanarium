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
  'Optional individual sex marker used for sexually dimorphic species/model variants. Values: male, female, or null when not applicable/unknown.';

comment on column public.creatures_dev.sex is
  'Optional individual sex marker used for sexually dimorphic species/model variants. Values: male, female, or null when not applicable/unknown.';

update public.creatures
set sex = case id
  when 90 then 'male'
  when 91 then 'female'
  when 92 then 'male'
  when 93 then 'female'
  else sex
end
where species = 'coryphaena-hippurus'
  and id in (90, 91, 92, 93);

update public.creatures_dev
set sex = case id
  when 90 then 'male'
  when 91 then 'female'
  when 92 then 'male'
  when 93 then 'female'
  else sex
end
where species = 'coryphaena-hippurus'
  and id in (90, 91, 92, 93);
