-- Stored end time per class. Run if your `classes` table predates `end_time`.

alter table public.classes add column if not exists end_time time;

update public.classes
set end_time = (
  case
    when start_time >= time '23:00:00' then time '23:59:59'
    else (start_time + interval '1 hour')::time
  end
)
where end_time is null;

alter table public.classes alter column end_time set not null;

alter table public.classes
  drop constraint if exists classes_end_after_start_check;

alter table public.classes
  add constraint classes_end_after_start_check check (end_time > start_time);
