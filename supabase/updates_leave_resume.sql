-- =============================================================================
-- INEOS Attendance — two updates (run ONCE in Supabase: SQL Editor → New query → paste → Run)
--
-- 1. The admin can change a leave decision (Rejected → Approved, or Approved → Rejected).
--    Cancelled requests stay cancelled.
-- 2. "Continue working": an employee who punched out by mistake (or is still working) can
--    remove today's Out time and punch out again later. Logged in the location history.
-- =============================================================================

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

-- 1. Leave decisions can be changed.

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

revoke all on function public.decide_leave(uuid, boolean, text) from public, anon;
grant execute on function public.decide_leave(uuid, boolean, text) to authenticated;
