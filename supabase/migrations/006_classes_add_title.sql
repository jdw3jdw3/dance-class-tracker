-- Class name shown in the app (`Class name` field → `title`). Run if `classes` predates this column.

alter table public.classes add column if not exists title text;

update public.classes set title = 'Class' where title is null;

alter table public.classes alter column title set default 'Class';
alter table public.classes alter column title set not null;
