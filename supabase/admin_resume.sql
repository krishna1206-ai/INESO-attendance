-- "Continue working" moves to the admin side.
-- The admin removes an employee's Out time for today, so the employee can punch out again.
-- Employees can no longer do this themselves.

create or replace function public.admin_resume_work(p_employee_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.attendance;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do this.';
  end if;
  select * into r from public.attendance
   where employee_id = p_employee_id and date = public.today_ist();
  if not found or r.in_time = '' then raise exception 'This employee has not punched in today.'; end if;
  if r.out_time = '' then raise exception 'This employee has not punched out yet.'; end if;
  update public.attendance
     set out_time = '', out_at = null, overtime_minutes = null,
         locations = locations || jsonb_build_array(jsonb_build_object(
           'action', 'resume', 'by', 'admin', 'previousOut', r.out_time,
           'capturedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
         updated_at = now()
   where id = r.id;
end $$;

revoke all on function public.admin_resume_work(uuid) from public, anon;
grant execute on function public.admin_resume_work(uuid) to authenticated;

-- Employees can't remove their own Out time any more.
revoke execute on function public.resume_work(jsonb) from authenticated;
