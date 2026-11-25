import { db, errorMessage } from '../lib/supabase';
import { invalidate, useRemote } from './remote';

// Leave requests (table `leave_requests`, see supabase/shift_and_leave.sql).
// Employees apply (dates, type, reason) and can cancel while pending; admins approve or
// reject. Approved leave days show as Leave in attendance and reports (unless the day is a
// holiday / weekly off, or the employee punched in and worked).
//
// Shape: { id, employeeId, from, to, type, reason, status, adminNote, decidedAt, createdAt }

export const LEAVE_TYPES = {
  casual: { label: 'Casual leave' },
  sick: { label: 'Sick leave' },
  other: { label: 'Other' },
};

export const LEAVE_STATUS = {
  pending: { label: 'Pending', color: '#9A5B00', bg: '#FFF4E0', icon: 'clock-outline' },
  approved: { label: 'Approved', color: '#1E7B4A', bg: '#E3F4EA', icon: 'check-circle' },
  rejected: { label: 'Rejected', color: '#C53030', bg: '#FDECEC', icon: 'close-circle' },
  cancelled: { label: 'Cancelled', color: '#4A5568', bg: '#E9ECF1', icon: 'cancel' },
};

const COLUMNS = 'id, employee_id, from_date, to_date, leave_type, reason, status, admin_note, decided_at, created_at';

const mapRow = (r) => ({
  id: r.id,
  employeeId: r.employee_id,
  from: r.from_date,
  to: r.to_date,
  type: r.leave_type,
  reason: r.reason,
  status: r.status,
  adminNote: r.admin_note,
  decidedAt: r.decided_at,
  createdAt: r.created_at,
});

async function select(build) {
  const { data, error } = await build(db().from('leave_requests').select(COLUMNS));
  if (error) throw error;
  return data.map(mapRow);
}

// All requests the signed-in user may see (an employee: their own; an admin: everyone's),
// newest first.
export function useLeaveRequests() {
  const { data, loading } = useRemote(
    'leave:all',
    () => select((q) => q.order('created_at', { ascending: false })),
    ['leave_requests']
  );
  return { requests: data ?? [], loading };
}

// Approved leave per employee: { [employeeId]: [{ from, to, type, reason }] }.
export function approvedByEmployee(requests) {
  const out = {};
  for (const r of requests) if (r.status === 'approved') (out[r.employeeId] ??= []).push(r);
  return out;
}

// The approved leave covering this date, if any.
export const leaveOn = (dateKey, approved) =>
  (approved ?? []).find((r) => r.from <= dateKey && dateKey <= r.to) ?? null;

// Number of calendar days in a request (inclusive).
export function dayCount(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1;
}

// ---------------------------------------------------------------------------
// Actions. Each returns an error message string, or null on success.

export async function applyLeave({ from, to, type, reason }) {
  if (!from || !to) return 'Please select the leave dates on the calendar.';
  if (to < from) return 'The end date must be on or after the start date.';
  if (!LEAVE_TYPES[type]) return 'Please select the leave type.';
  if ((reason ?? '').trim().length < 3) return 'Please write the reason for leave.';
  const { error } = await db().rpc('apply_leave', {
    p_from: from,
    p_to: to,
    p_type: type,
    p_reason: reason.trim(),
  });
  if (error) return errorMessage(error);
  invalidate('leave_requests');
  return null;
}

export async function cancelLeave(id) {
  const { error } = await db().rpc('cancel_leave', { p_id: id });
  if (error) return errorMessage(error);
  invalidate('leave_requests');
  return null;
}

export async function decideLeave(id, approve, note) {
  const { error } = await db().rpc('decide_leave', { p_id: id, p_approve: approve, p_note: note ?? '' });
  if (error) return errorMessage(error);
  invalidate('leave_requests');
  return null;
}
