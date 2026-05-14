-- The app uses `title` for “Class name”. Older schemas used `class_name`.
-- Run this if inserts fail with: null value in column "class_name" … not-null constraint
-- (PostgREST was sending `title`, so `class_name` stayed null).

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
