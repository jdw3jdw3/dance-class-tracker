-- Pay amount frozen per class when it is created. Changing a gym’s rate only affects new classes.
-- Run in Supabase → SQL Editor if your `classes` table predates this column.

alter table public.classes
  add column if not exists earn_per_class_cents integer;

update public.classes c
set earn_per_class_cents = g.pay_per_class_cents
from public.gyms g
where c.gym_id = g.id
  and c.earn_per_class_cents is null;

update public.classes set earn_per_class_cents = 0 where earn_per_class_cents is null;

alter table public.classes alter column earn_per_class_cents set default 0;
alter table public.classes alter column earn_per_class_cents set not null;

alter table public.classes
  drop constraint if exists classes_earn_per_class_cents_check;

alter table public.classes
  add constraint classes_earn_per_class_cents_check check (earn_per_class_cents >= 0);
