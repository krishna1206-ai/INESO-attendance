-- =============================================================================
-- INEOS Attendance — overtime
--
-- Punching out after the shift end (Settings → Shift timing) counts as overtime, worked out
-- on the server at the moment of Punch Out and saved, so changing the shift later doesn't
-- rewrite past days. Only Present days count; short extra time below the minimum is ignored.
--
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run. (Safe to run again.)
-- =============================================================================

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
