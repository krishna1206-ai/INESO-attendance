-- =============================================================================
-- INEOS Attendance — Supabase database setup
--
-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Then create your admin account with the line at the very bottom.
--
-- Security model
--  * Every table has Row Level Security. Signed-in employees can read departments,
--    their own profile and their own attendance. Admins can read everything.
--  * Nobody writes attendance or employee accounts directly: they go through the
--    functions below, which check who is calling. Punch times come from the server
--    clock in India time (Asia/Kolkata), so a wrong phone clock can't fake them.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  icon text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists departments_name_key on public.departments (lower(name));

create table if not exists public.sub_departments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  image_uri text not null default '',
  link_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sub_departments_name_key
  on public.sub_departments (department_id, lower(name));

-- One row per sign-in account (admins and employees). Created automatically for
-- every auth user by the trigger further down.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  name text not null default '',
  email text not null,
  -- "restrict": a department that still has employees can't be deleted.
  department_id uuid references public.departments (id) on delete restrict,
  sub_department_id uuid references public.sub_departments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'half_day', 'absent', 'leave', 'holiday')),
  in_time text not null default '',   -- 'HH:MM', India time, from the server clock
  out_time text not null default '',
  in_at timestamptz,
  out_at timestamptz,
  remark text not null default '',
  locations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (employee_id, date)
);
create index if not exists attendance_date_idx on public.attendance (date);

create table if not exists public.settings (
  id text primary key,                -- 'office'
  name text not null default 'Office',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius integer not null check (radius between 25 and 5000),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Profiles for new auth users
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.today_ist()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

create or replace function public.now_hhmm_ist()
returns text language sql stable set search_path = '' as $$
  select to_char(now() at time zone 'Asia/Kolkata', 'HH24:MI');
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.sub_departments enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.settings enable row level security;

drop policy if exists "signed-in users read departments" on public.departments;
create policy "signed-in users read departments" on public.departments
  for select to authenticated using (true);
drop policy if exists "admins write departments" on public.departments;
create policy "admins write departments" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "signed-in users read sub-departments" on public.sub_departments;
create policy "signed-in users read sub-departments" on public.sub_departments
  for select to authenticated using (true);
drop policy if exists "admins write sub-departments" on public.sub_departments;
create policy "admins write sub-departments" on public.sub_departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "signed-in users read settings" on public.settings;
create policy "signed-in users read settings" on public.settings
  for select to authenticated using (true);
drop policy if exists "admins write settings" on public.settings;
create policy "admins write settings" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles and attendance: read-only through the API; changes go through functions.
drop policy if exists "read own profile or admin" on public.profiles;
create policy "read own profile or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "read own attendance or admin" on public.attendance;
create policy "read own attendance or admin" on public.attendance
  for select to authenticated using (employee_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Attendance functions (employees, today only, server time)
-- -----------------------------------------------------------------------------

create or replace function public.require_employee()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in again.'; end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'employee') then
    raise exception 'Only employees can fill in attendance.';
  end if;
  return uid;
end $$;

create or replace function public.punch_in(p_status text, p_remark text, p_location jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  d date := public.today_ist();
  t text := public.now_hhmm_ist();
  r public.attendance;
begin
  if p_status not in ('present', 'half_day') then
    raise exception 'Select Present or Half Day to punch in.';
  end if;
  if p_location is null then
    raise exception 'Your location is needed to punch in. Please allow location and try again.';
  end if;
  select * into r from public.attendance where employee_id = uid and date = d;
  if found and r.in_time <> '' then
    raise exception 'You already punched in at % today.', r.in_time;
  end if;
  insert into public.attendance (employee_id, date, status, in_time, in_at, remark, locations, updated_at)
  values (uid, d, p_status, t, now(), left(trim(coalesce(p_remark, '')), 200),
          jsonb_build_array(p_location || jsonb_build_object('action', 'in')), now())
  on conflict (employee_id, date) do update
    set status = excluded.status, in_time = excluded.in_time, in_at = excluded.in_at,
        remark = excluded.remark, locations = public.attendance.locations || excluded.locations,
        updated_at = now();
  return t;
end $$;

create or replace function public.punch_out(p_remark text, p_location jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  d date := public.today_ist();
  t text := public.now_hhmm_ist();
  r public.attendance;
begin
  if p_location is null then
    raise exception 'Your location is needed to punch out. Please allow location and try again.';
  end if;
  select * into r from public.attendance where employee_id = uid and date = d;
  if not found or r.in_time = '' then raise exception 'Punch in first.'; end if;
  if r.out_time <> '' then raise exception 'You already punched out at % today.', r.out_time; end if;
  update public.attendance
     set out_time = t, out_at = now(),
         remark = case when p_remark is null then remark else left(trim(p_remark), 200) end,
         locations = locations || jsonb_build_array(p_location || jsonb_build_object('action', 'out')),
         updated_at = now()
   where id = r.id;
  return t;
end $$;

-- Save today's status / remark without punching (Absent, Leave, Holiday, or a remark change).
create or replace function public.save_attendance(p_status text, p_remark text, p_location jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  d date := public.today_ist();
  r public.attendance;
  timed boolean := p_status in ('present', 'half_day');
  loc jsonb := case when p_location is null then '[]'::jsonb
                    else jsonb_build_array(p_location || jsonb_build_object('action', 'updated')) end;
begin
  if p_status not in ('present', 'half_day', 'absent', 'leave', 'holiday') then
    raise exception 'Please select a status.';
  end if;
  select * into r from public.attendance where employee_id = uid and date = d;
  if timed then
    if not found or r.in_time = '' then raise exception 'Tap “Punch In” to record your arrival time.'; end if;
    if p_location is null then
      raise exception 'Your location is needed to mark yourself present. Please allow location and try again.';
    end if;
  elsif found and r.in_time <> '' then
    raise exception 'You already punched in at % today, so you can''t change the status to that.', r.in_time;
  end if;
  insert into public.attendance (employee_id, date, status, remark, locations, updated_at)
  values (uid, d, p_status, left(trim(coalesce(p_remark, '')), 200), loc, now())
  on conflict (employee_id, date) do update
    set status = excluded.status, remark = excluded.remark,
        locations = public.attendance.locations || excluded.locations, updated_at = now();
end $$;

create or replace function public.clear_attendance()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  r public.attendance;
begin
  select * into r from public.attendance where employee_id = uid and date = public.today_ist();
  if found and r.in_time <> '' then raise exception 'Punched times can''t be cleared.'; end if;
  delete from public.attendance where employee_id = uid and date = public.today_ist();
end $$;

-- -----------------------------------------------------------------------------
-- Employee accounts (admins only)
-- -----------------------------------------------------------------------------

create or replace function public.check_employee_fields(
  p_name text, p_email text, p_department_id uuid, p_sub_department_id uuid
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Please enter the employee name.'; end if;
  if coalesce(p_email, '') !~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'Please enter a valid email, e.g. name@ineos.com';
  end if;
  if p_department_id is null or not exists (select 1 from public.departments where id = p_department_id) then
    raise exception 'Please select a department.';
  end if;
  if exists (select 1 from public.sub_departments where department_id = p_department_id) then
    if p_sub_department_id is null or not exists (
      select 1 from public.sub_departments where id = p_sub_department_id and department_id = p_department_id
    ) then
      raise exception 'Please select a sub-department.';
    end if;
  end if;
end $$;

-- Creates a sign-in account. Used by admin_create_employee and create_admin.
create or replace function public.create_auth_user(p_email text, p_password text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := gen_random_uuid();
  mail text := lower(trim(p_email));
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;
  if exists (select 1 from auth.users where lower(email) = mail) then
    raise exception '% is already used by another account.', mail;
  end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, email_change_token_current,
    recovery_token, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', trim(p_name)), now(), now(),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
          'email', now(), now(), now());
  return uid;
end $$;

create or replace function public.admin_create_employee(
  p_name text, p_email text, p_password text, p_department_id uuid, p_sub_department_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can add employees.'; end if;
  perform public.check_employee_fields(p_name, p_email, p_department_id, p_sub_department_id);
  uid := public.create_auth_user(p_email, p_password, p_name);
  update public.profiles
     set role = 'employee', name = trim(p_name), email = lower(trim(p_email)),
         department_id = p_department_id,
         sub_department_id = case when exists (select 1 from public.sub_departments where department_id = p_department_id)
                                  then p_sub_department_id end,
         updated_at = now()
   where id = uid;
  return uid;
end $$;

-- p_password: new password, or null / '' to keep the current one.
create or replace function public.admin_update_employee(
  p_id uuid, p_name text, p_email text, p_password text, p_department_id uuid, p_sub_department_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare mail text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Only admins can edit employees.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and role = 'employee') then
    raise exception 'Employee not found.';
  end if;
  perform public.check_employee_fields(p_name, p_email, p_department_id, p_sub_department_id);
  if exists (select 1 from auth.users where lower(email) = mail and id <> p_id) then
    raise exception '% is already used by another account.', mail;
  end if;
  if coalesce(p_password, '') <> '' and length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;
  update auth.users
     set email = mail,
         encrypted_password = case when coalesce(p_password, '') <> ''
                                   then extensions.crypt(p_password, extensions.gen_salt('bf'))
                                   else encrypted_password end,
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', trim(p_name)),
         updated_at = now()
   where id = p_id;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', mail), updated_at = now()
   where user_id = p_id and provider = 'email';
  update public.profiles
     set name = trim(p_name), email = mail, department_id = p_department_id,
         sub_department_id = case when exists (select 1 from public.sub_departments where department_id = p_department_id)
                                  then p_sub_department_id end,
         updated_at = now()
   where id = p_id;
end $$;

create or replace function public.admin_delete_employee(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only admins can delete employees.'; end if;
  if not exists (select 1 from public.profiles where id = p_id and role = 'employee') then
    raise exception 'Employee not found.';
  end if;
  delete from auth.users where id = p_id; -- profile and attendance are removed with it
end $$;

-- Creates an admin account. Run it yourself in the SQL Editor (see the bottom of the file);
-- the app can't call it.
create or replace function public.create_admin(p_email text, p_password text, p_name text default 'Admin')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  uid := public.create_auth_user(p_email, p_password, p_name);
  update public.profiles set role = 'admin', name = trim(p_name) where id = uid;
  return uid;
end $$;

-- -----------------------------------------------------------------------------
-- Who may call which function
-- -----------------------------------------------------------------------------

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.require_employee() from public, anon, authenticated;
revoke all on function public.check_employee_fields(text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_auth_user(text, text, text) from public, anon, authenticated;
revoke all on function public.create_admin(text, text, text) from public, anon, authenticated;

revoke all on function public.punch_in(text, text, jsonb) from public, anon;
revoke all on function public.punch_out(text, jsonb) from public, anon;
revoke all on function public.save_attendance(text, text, jsonb) from public, anon;
revoke all on function public.clear_attendance() from public, anon;
revoke all on function public.admin_create_employee(text, text, text, uuid, uuid) from public, anon;
revoke all on function public.admin_update_employee(uuid, text, text, text, uuid, uuid) from public, anon;
revoke all on function public.admin_delete_employee(uuid) from public, anon;

grant execute on function public.punch_in(text, text, jsonb) to authenticated;
grant execute on function public.punch_out(text, jsonb) to authenticated;
grant execute on function public.save_attendance(text, text, jsonb) to authenticated;
grant execute on function public.clear_attendance() to authenticated;
grant execute on function public.admin_create_employee(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.admin_update_employee(uuid, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.admin_delete_employee(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Table access for signed-in users (newer Supabase projects don't grant this by default).
-- Row Level Security above still decides which rows each person sees or changes;
-- signed-out visitors (anon) get no access at all.
-- -----------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select on public.departments, public.sub_departments, public.settings,
                public.profiles, public.attendance to authenticated;
grant insert, update, delete on public.departments, public.sub_departments, public.settings
  to authenticated;
revoke all on public.departments, public.sub_departments, public.settings,
              public.profiles, public.attendance from anon;

-- -----------------------------------------------------------------------------
-- Live updates (admin screens refresh when employees punch in)
-- -----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['departments', 'sub_departments', 'profiles', 'attendance', 'settings'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Company holidays and weekly offs (same as supabase/calendar.sql)
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- Shift timing / Late marks and leave requests (same as supabase/shift_and_leave.sql)
-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------

alter table public.calendar add column if not exists shift_start text not null default '09:00'
  check (shift_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.calendar add column if not exists shift_end text not null default '18:00'
  check (shift_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.calendar add column if not exists grace_minutes smallint not null default 10
  check (grace_minutes between 0 and 180);

-- Minutes after shift start (beyond the grace period) at punch in; 0 = on time. Saved at the
-- moment of punching, so changing the shift later doesn't rewrite old days.
alter table public.attendance add column if not exists late_minutes integer;

create or replace function public.minutes_of(hhmm text)
returns integer language sql immutable set search_path = '' as $$
  select split_part(hhmm, ':', 1)::int * 60 + split_part(hhmm, ':', 2)::int;
$$;

-- Punch In (replaces the earlier version): also records how late the employee is.
create or replace function public.punch_in(p_status text, p_remark text, p_location jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  d date := public.today_ist();
  t text := public.now_hhmm_ist();
  r public.attendance;
  cal public.calendar;
  late integer := 0;
begin
  if p_status not in ('present', 'half_day') then
    raise exception 'Select Present or Half Day to punch in.';
  end if;
  if p_location is null then
    raise exception 'Your location is needed to punch in. Please allow location and try again.';
  end if;
  select * into r from public.attendance where employee_id = uid and date = d;
  if found and r.in_time <> '' then
    raise exception 'You already punched in at % today.', r.in_time;
  end if;

  -- Late only counts for a full day (a half day may start later on purpose).
  select * into cal from public.calendar where id = 'default';
  if found and p_status = 'present' then
    late := greatest(0, public.minutes_of(t) - public.minutes_of(cal.shift_start));
    if late <= cal.grace_minutes then late := 0; end if;
  end if;

  insert into public.attendance (employee_id, date, status, in_time, in_at, late_minutes, remark, locations, updated_at)
  values (uid, d, p_status, t, now(), late, left(trim(coalesce(p_remark, '')), 200),
          jsonb_build_array(p_location || jsonb_build_object('action', 'in')), now())
  on conflict (employee_id, date) do update
    set status = excluded.status, in_time = excluded.in_time, in_at = excluded.in_at,
        late_minutes = excluded.late_minutes, remark = excluded.remark,
        locations = public.attendance.locations || excluded.locations, updated_at = now();
  return t;
end $$;

revoke all on function public.minutes_of(text) from public, anon;
revoke all on function public.punch_in(text, text, jsonb) from public, anon;
grant execute on function public.punch_in(text, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Leave requests
-- -----------------------------------------------------------------------------

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  leave_type text not null default 'casual' check (leave_type in ('casual', 'sick', 'other')),
  reason text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note text not null default '',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists leave_requests_employee_idx on public.leave_requests (employee_id);
create index if not exists leave_requests_dates_idx on public.leave_requests (from_date, to_date);

alter table public.leave_requests enable row level security;
drop policy if exists "read own leave or admin" on public.leave_requests;
create policy "read own leave or admin" on public.leave_requests
  for select to authenticated using (employee_id = auth.uid() or public.is_admin());

grant select on public.leave_requests to authenticated;
revoke all on public.leave_requests from anon;

-- Employee applies for leave (today or later, up to 60 days, no overlap with another
-- pending or approved request).
create or replace function public.apply_leave(p_from date, p_to date, p_type text, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  new_id uuid;
begin
  if p_from is null or p_to is null then raise exception 'Please select the leave dates.'; end if;
  if p_to < p_from then raise exception 'The end date must be on or after the start date.'; end if;
  if p_from < public.today_ist() then raise exception 'Leave can only be requested from today onwards.'; end if;
  if p_to - p_from > 60 then raise exception 'A single leave request can be at most 60 days.'; end if;
  if p_type not in ('casual', 'sick', 'other') then raise exception 'Please select the leave type.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Please write the reason for leave.'; end if;
  if exists (
    select 1 from public.leave_requests
     where employee_id = uid and status in ('pending', 'approved')
       and daterange(from_date, to_date, '[]') && daterange(p_from, p_to, '[]')
  ) then
    raise exception 'You already have a leave request for some of these dates.';
  end if;
  insert into public.leave_requests (employee_id, from_date, to_date, leave_type, reason)
  values (uid, p_from, p_to, p_type, left(trim(p_reason), 300))
  returning id into new_id;
  return new_id;
end $$;

-- Employee cancels their own request while it is still pending.
create or replace function public.cancel_leave(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_employee();
begin
  update public.leave_requests set status = 'cancelled'
   where id = p_id and employee_id = uid and status = 'pending';
  if not found then raise exception 'Only pending requests can be cancelled.'; end if;
end $$;

-- Admin approves or rejects a request, and can change the decision later
-- (Rejected → Approved or Approved → Rejected). Cancelled requests stay cancelled.
create or replace function public.decide_leave(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.leave_requests;
  new_status text := case when p_approve then 'approved' else 'rejected' end;
begin
  if not public.is_admin() then raise exception 'Only admins can approve or reject leave.'; end if;
  select * into r from public.leave_requests where id = p_id;
  if not found then raise exception 'Leave request not found.'; end if;
  if r.status = 'cancelled' then raise exception 'The employee cancelled this request.'; end if;
  if r.status = new_status then
    raise exception 'This request is already %.', new_status;
  end if;
  -- Approving: the employee mustn't already have other leave for these dates.
  if p_approve and exists (
    select 1 from public.leave_requests
     where employee_id = r.employee_id and id <> r.id and status in ('pending', 'approved')
       and daterange(from_date, to_date, '[]') && daterange(r.from_date, r.to_date, '[]')
  ) then
    raise exception 'This employee already has another leave request for some of these dates.';
  end if;
  update public.leave_requests
     set status = new_status,
         admin_note = left(trim(coalesce(p_note, '')), 300),
         decided_by = auth.uid(), decided_at = now()
   where id = p_id;
end $$;

revoke all on function public.apply_leave(date, date, text, text) from public, anon;
revoke all on function public.cancel_leave(uuid) from public, anon;
revoke all on function public.decide_leave(uuid, boolean, text) from public, anon;
grant execute on function public.apply_leave(date, date, text, text) to authenticated;
grant execute on function public.cancel_leave(uuid) to authenticated;
grant execute on function public.decide_leave(uuid, boolean, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leave_requests'
  ) then
    alter publication supabase_realtime add table public.leave_requests;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Continue working after punching out (same as supabase/updates_leave_resume.sql)
-- -----------------------------------------------------------------------------

-- 2. Continue working: clears today's Out time (today only, location required).
create or replace function public.resume_work(p_location jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  r public.attendance;
begin
  if p_location is null then
    raise exception 'Your location is needed. Please allow location and try again.';
  end if;
  select * into r from public.attendance where employee_id = uid and date = public.today_ist();
  if not found or r.in_time = '' then raise exception 'Punch in first.'; end if;
  if r.out_time = '' then raise exception 'You have not punched out yet.'; end if;
  update public.attendance
     set out_time = '', out_at = null,
         locations = locations || jsonb_build_array(p_location || jsonb_build_object(
           'action', 'resume', 'previousOut', r.out_time)),
         updated_at = now()
   where id = r.id;
end $$;

revoke all on function public.resume_work(jsonb) from public, anon;
grant execute on function public.resume_work(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Overtime (same as supabase/overtime.sql)
-- -----------------------------------------------------------------------------

-- Minimum extra minutes before anything counts as overtime (e.g. 30 → 18:20 is not overtime).
alter table public.calendar add column if not exists overtime_min_minutes smallint not null default 30
  check (overtime_min_minutes between 0 and 240);

-- Minutes worked after shift end at punch out (0 = none).
alter table public.attendance add column if not exists overtime_minutes integer;

-- Punch Out (replaces the earlier version): also records overtime.
create or replace function public.punch_out(p_remark text, p_location jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  d date := public.today_ist();
  t text := public.now_hhmm_ist();
  r public.attendance;
  cal public.calendar;
  ot integer := 0;
begin
  if p_location is null then
    raise exception 'Your location is needed to punch out. Please allow location and try again.';
  end if;
  select * into r from public.attendance where employee_id = uid and date = d;
  if not found or r.in_time = '' then raise exception 'Punch in first.'; end if;
  if r.out_time <> '' then raise exception 'You already punched out at % today.', r.out_time; end if;

  -- Overtime only for a full (Present) day.
  select * into cal from public.calendar where id = 'default';
  if found and r.status = 'present' then
    ot := greatest(0, public.minutes_of(t) - public.minutes_of(cal.shift_end));
    if ot < greatest(cal.overtime_min_minutes, 1) then ot := 0; end if;
  end if;

  update public.attendance
     set out_time = t, out_at = now(), overtime_minutes = ot,
         remark = case when p_remark is null then remark else left(trim(p_remark), 200) end,
         locations = locations || jsonb_build_array(p_location || jsonb_build_object('action', 'out')),
         updated_at = now()
   where id = r.id;
  return t;
end $$;

-- Continue working (replaces the earlier version): also clears the overtime, which is worked
-- out again at the next Punch Out.
create or replace function public.resume_work(p_location jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_employee();
  r public.attendance;
begin
  if p_location is null then
    raise exception 'Your location is needed. Please allow location and try again.';
  end if;
  select * into r from public.attendance where employee_id = uid and date = public.today_ist();
  if not found or r.in_time = '' then raise exception 'Punch in first.'; end if;
  if r.out_time = '' then raise exception 'You have not punched out yet.'; end if;
  update public.attendance
     set out_time = '', out_at = null, overtime_minutes = null,
         locations = locations || jsonb_build_array(p_location || jsonb_build_object(
           'action', 'resume', 'previousOut', r.out_time)),
         updated_at = now()
   where id = r.id;
end $$;

revoke all on function public.punch_out(text, jsonb) from public, anon;
revoke all on function public.resume_work(jsonb) from public, anon;
grant execute on function public.punch_out(text, jsonb) to authenticated;
grant execute on function public.resume_work(jsonb) to authenticated;
