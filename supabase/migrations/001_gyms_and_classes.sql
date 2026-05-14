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
  recurring boolean not null default false,
  taught boolean not null default false,
  paid boolean not null default false,
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
