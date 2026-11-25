-- =============================================================================
-- INEOS Attendance — shift timing / Late marks, and leave requests with approval
--
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run.
-- (Safe to run again. Needs schema.sql and calendar.sql to have been run first.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shift timing (company-wide) and Late minutes
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
