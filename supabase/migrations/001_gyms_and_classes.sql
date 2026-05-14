-- Run this in Supabase → SQL Editor (or use Supabase CLI migrations).
-- Gyms and classes for each authenticated user, with row level security.

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  colour text not null,
  pay_per_class_cents integer not null default 0 check (pay_per_class_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists gyms_user_id_idx on public.gyms (user_id);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  title text not null,
  class_date date not null,
  start_time time not null,
  end_time time not null,
  recurring boolean not null default false,
  taught boolean not null default false,
  paid boolean not null default false,
  earn_per_class_cents integer not null default 0 check (earn_per_class_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists classes_user_date_idx on public.classes (user_id, class_date);
create index if not exists classes_gym_id_idx on public.classes (gym_id);

alter table public.gyms enable row level security;
alter table public.classes enable row level security;

drop policy if exists "gyms_select_own" on public.gyms;
drop policy if exists "gyms_insert_own" on public.gyms;
drop policy if exists "gyms_update_own" on public.gyms;
drop policy if exists "gyms_delete_own" on public.gyms;

create policy "gyms_select_own" on public.gyms for select using (auth.uid() = user_id);
create policy "gyms_insert_own" on public.gyms for insert with check (auth.uid() = user_id);
create policy "gyms_update_own" on public.gyms for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gyms_delete_own" on public.gyms for delete using (auth.uid() = user_id);

drop policy if exists "classes_select_own" on public.classes;
drop policy if exists "classes_insert_own" on public.classes;
drop policy if exists "classes_update_own" on public.classes;
drop policy if exists "classes_delete_own" on public.classes;

create policy "classes_select_own" on public.classes for select using (auth.uid() = user_id);
create policy "classes_insert_own" on public.classes for insert with check (auth.uid() = user_id);
create policy "classes_update_own" on public.classes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "classes_delete_own" on public.classes for delete using (auth.uid() = user_id);

-- If `gyms` already existed from an older run, `CREATE TABLE IF NOT EXISTS` skipped this column.
alter table public.gyms
  add column if not exists pay_per_class_cents integer not null default 0;

-- If `classes` existed without recurring flag.
alter table public.classes
  add column if not exists recurring boolean not null default false;

-- Legacy `class_name` → app column `title` (see 007 for standalone script).
do $mig$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'classes'
      and column_name = 'class_name'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'classes'
        and column_name = 'title'
    ) then
      update public.classes
      set title = coalesce(nullif(trim(title), ''), class_name, 'Class');
      alter table public.classes drop column class_name;
    else
      alter table public.classes rename column class_name to title;
    end if;
  end if;
end
$mig$;

-- If `classes` existed without title (class name in the app).
alter table public.classes add column if not exists title text;

update public.classes set title = 'Class' where title is null;

alter table public.classes alter column title set default 'Class';
alter table public.classes alter column title set not null;

-- If `classes` existed without earn snapshot, add and backfill from the gym’s current rate.
alter table public.classes add column if not exists earn_per_class_cents integer;

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

-- End time (existing rows: start + 1 hour, late starts capped so end > start).
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
