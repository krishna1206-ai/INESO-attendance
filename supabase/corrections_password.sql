-- Admin attendance correction + change password.
-- Run once in the Supabase SQL Editor.

-- -----------------------------------------------------------------------------
-- Attendance correction by the admin
-- -----------------------------------------------------------------------------

-- Who corrected the day, when, and why. Shown as "Edited by admin" everywhere.
alter table public.attendance add column if not exists edited_by uuid references auth.users (id) on delete set null;
alter table public.attendance add column if not exists edited_at timestamptz;
alter table public.attendance add column if not exists edited_reason text;

-- The admin adds or fixes one employee's day (today or a past day).
-- Present / Half Day need an In time; the Out time may be left empty (still working).
-- Late and overtime are worked out from the current shift. The previous values are kept
-- in the day's log (locations, action 'admin_edit').
create or replace function public.admin_save_attendance(
  p_employee_id uuid, p_date date, p_status text, p_in_time text, p_out_time text, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.attendance;
  cal public.calendar;
  in_t text := trim(coalesce(p_in_time, ''));
  out_t text := trim(coalesce(p_out_time, ''));
  reason text := left(trim(coalesce(p_reason, '')), 200);
  late integer := 0;
  ot integer := 0;
  timed boolean := p_status in ('present', 'half_day');
begin
  if not public.is_admin() then raise exception 'Only an admin can correct attendance.'; end if;
  if not exists (select 1 from public.profiles where id = p_employee_id and role = 'employee') then
    raise exception 'Employee not found.';
  end if;
  if p_date is null or p_date > public.today_ist() then
    raise exception 'You can only correct today or a past day.';
  end if;
  if p_status not in ('present', 'half_day', 'absent', 'leave', 'holiday') then
    raise exception 'Select a status.';
  end if;
  if length(reason) < 3 then raise exception 'Please write the reason for the correction.'; end if;

  if timed then
    if in_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Enter the In time as HH:MM, for example 09:05.';
    end if;
    if out_t <> '' and out_t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Enter the Out time as HH:MM, for example 18:30, or leave it empty.';
    end if;
    if out_t = in_t then raise exception 'Out time must be different from the In time.'; end if;
    select * into cal from public.calendar where id = 'default';
    if found and p_status = 'present' then
      late := greatest(0, public.minutes_of(in_t) - public.minutes_of(cal.shift_start));
      if late <= cal.grace_minutes then late := 0; end if;
      if out_t <> '' then
        ot := greatest(0, public.minutes_of(out_t) - public.minutes_of(cal.shift_end));
        if ot < greatest(cal.overtime_min_minutes, 1) then ot := 0; end if;
      end if;
    end if;
  else
    in_t := '';
    out_t := '';
  end if;

  select * into r from public.attendance where employee_id = p_employee_id and date = p_date;
  if found then
    update public.attendance
       set status = p_status,
           in_time = in_t,
           out_time = out_t,
           in_at = case when in_t = r.in_time then r.in_at end,
           out_at = case when out_t = r.out_time then r.out_at end,
           late_minutes = late,
           overtime_minutes = case when out_t = '' then null else ot end,
           edited_by = auth.uid(), edited_at = now(), edited_reason = reason,
           locations = r.locations || jsonb_build_array(jsonb_build_object(
             'action', 'admin_edit', 'reason', reason,
             'capturedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'previous', jsonb_build_object('status', r.status, 'in', r.in_time, 'out', r.out_time))),
           updated_at = now()
     where id = r.id;
  else
    insert into public.attendance (employee_id, date, status, in_time, out_time, late_minutes,
                                   overtime_minutes, remark, locations,
                                   edited_by, edited_at, edited_reason, updated_at)
    values (p_employee_id, p_date, p_status, in_t, out_t, late,
            case when out_t = '' then null else ot end, '',
            jsonb_build_array(jsonb_build_object(
              'action', 'admin_edit', 'reason', reason,
              'capturedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'previous', null)),
            auth.uid(), now(), reason, now());
  end if;
end $$;

revoke all on function public.admin_save_attendance(uuid, date, text, text, text, text) from public, anon;
grant execute on function public.admin_save_attendance(uuid, date, text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Change my own password (employee or admin). Checks the current password first.
-- -----------------------------------------------------------------------------

create or replace function public.change_my_password(p_current text, p_new text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hash text;
begin
  if uid is null then raise exception 'Please sign in again.'; end if;
  if length(coalesce(p_new, '')) < 6 then raise exception 'New password must be at least 6 characters.'; end if;
  if p_new = p_current then raise exception 'New password must be different from the current one.'; end if;
  select encrypted_password into hash from auth.users where id = uid;
  if hash is null or hash <> extensions.crypt(coalesce(p_current, ''), hash) then
    raise exception 'Current password is wrong.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_new, extensions.gen_salt('bf')), updated_at = now()
   where id = uid;
end $$;

revoke all on function public.change_my_password(text, text) from public, anon;
grant execute on function public.change_my_password(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- A day the admin corrected can't be changed or cleared by the employee
-- (they can still punch in / punch out on it).
-- -----------------------------------------------------------------------------

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
  if found and r.edited_by is not null and r.status <> p_status then
    raise exception 'The admin set today''s attendance, so you can''t change the status.';
  end if;
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
  if found and r.edited_by is not null then
    raise exception 'The admin set today''s attendance, so it can''t be cleared.';
  end if;
  delete from public.attendance where employee_id = uid and date = public.today_ist();
end $$;
