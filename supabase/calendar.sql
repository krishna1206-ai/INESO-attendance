-- =============================================================================
-- INEOS Attendance — company holidays and weekly offs
--
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run.
-- (Safe to run again; it is also included in schema.sql for new projects.)
-- =============================================================================

-- Festival / company holidays, one row per date.
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Weekly offs: days of the week the company is closed (0 = Sunday … 6 = Saturday).
create table if not exists public.calendar (
  id text primary key default 'default',
  weekly_offs smallint[] not null default '{0}',
  updated_at timestamptz not null default now()
);
insert into public.calendar (id) values ('default') on conflict (id) do nothing;

alter table public.holidays enable row level security;
alter table public.calendar enable row level security;

drop policy if exists "signed-in users read holidays" on public.holidays;
create policy "signed-in users read holidays" on public.holidays
  for select to authenticated using (true);
drop policy if exists "admins write holidays" on public.holidays;
create policy "admins write holidays" on public.holidays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "signed-in users read calendar" on public.calendar;
create policy "signed-in users read calendar" on public.calendar
  for select to authenticated using (true);
drop policy if exists "admins write calendar" on public.calendar;
create policy "admins write calendar" on public.calendar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.holidays, public.calendar to authenticated;
revoke all on public.holidays, public.calendar from anon;

do $$
declare t text;
begin
  foreach t in array array['holidays', 'calendar'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
