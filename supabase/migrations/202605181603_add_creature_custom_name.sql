alter table public.creatures
  add column if not exists custom_name text;

comment on column public.creatures.custom_name is
  'Optional display name for an individual creature. Blank/null hides the custom-name tag in the info card.';
