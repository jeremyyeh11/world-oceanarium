-- Canonicalize creature species values to scientific-name slugs.
-- App code still keeps legacy aliases for older snapshots/exports, but Supabase rows should use these going forward.

update public.creatures_dev
set species = 'mola-alexandrini'
where species in ('mola-mola', 'Giant Sunfish', 'Mola alexandrini');

update public.creatures_dev
set species = 'amblygaster-sirm'
where species in ('sardine', 'Spotted Sardinella', 'Amblygaster sirm');

update public.creatures
set species = 'mola-alexandrini'
where species in ('mola-mola', 'Giant Sunfish', 'Mola alexandrini');

update public.creatures
set species = 'amblygaster-sirm'
where species in ('sardine', 'Spotted Sardinella', 'Amblygaster sirm');
