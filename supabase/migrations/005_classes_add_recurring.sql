-- Recurring flag on each class. Run if your `classes` table predates this column.

alter table public.classes
  add column if not exists recurring boolean not null default false;
