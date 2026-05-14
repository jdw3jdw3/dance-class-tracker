-- Run once in Supabase → SQL Editor if you see:
-- "Could not find the 'pay_per_class_cents' column of 'gyms' in the schema cache"
--
-- This happens when `gyms` was created earlier without that column; `CREATE TABLE IF NOT EXISTS`
-- does not add new columns to an existing table.

alter table public.gyms
  add column if not exists pay_per_class_cents integer not null default 0;
