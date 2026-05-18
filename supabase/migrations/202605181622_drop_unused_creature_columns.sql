-- Remove prototype/breeding fields that are not part of the current curated-creature model.
-- Current individual variation is represented by explicit columns such as `size`, `description`, and `custom_name`.

alter table public.creatures
  drop column if exists traits,
  drop column if exists color,
  drop column if exists parent_ids,
  drop column if exists generation;
