import { db, errorMessage } from '../lib/supabase';
import { invalidate, useRemote } from './remote';
import { dayInfo } from './calendar';
import { LEAVE_TYPES, leaveOn } from './leave';

// Attendance entries, stored in Supabase (table `attendance`). Each employee fills in their own
// day (the company has no punching machine). One record per employee per day:
//   { id, date: 'YYYY-MM-DD', employeeId, status, inTime: 'HH:MM' | '', outTime: 'HH:MM' | '',
//     inAt, outAt, remark, updatedAt,
//     locations: [{ latitude, longitude, accuracy, mocked, capturedAt, action }] }
// Writes go through database functions (punch_in, punch_out, save_attendance, clear_attendance)
// that only allow today's entry for the signed-in employee and take In/Out times from the
// SERVER clock (India time) — employees can't type or fake them.
// `locations` logs where the device was on every punch/save (captured automatically; required
// for Present / Half Day), so the admin can see whether attendance was filled in at the office.

export const STATUS = {
  present: { label: 'Present', short: 'P', color: '#1E7B4A', bg: '#E3F4EA', needsTime: true, icon: 'check-circle' },
  half_day: { label: 'Half Day', short: 'HD', color: '#2C7A7B', bg: '#E2F5F5', needsTime: true, icon: 'circle-slice-4' },
  absent: { label: 'Absent', short: 'A', color: '#C53030', bg: '#FDECEC', needsTime: false, icon: 'close-circle' },
  leave: { label: 'Leave', short: 'L', color: '#6B46C1', bg: '#F1ECFD', needsTime: false, icon: 'airplane' },
  holiday: { label: 'Holiday', short: 'H', color: '#B7791F', bg: '#FEF5E3', needsTime: false, icon: 'party-popper' },
};
export const STATUS_ORDER = ['present', 'half_day', 'absent', 'leave', 'holiday'];
// What employees can pick themselves. Holidays and weekly offs come from the company calendar
// set by the admin, so employees no longer mark Holiday.
export const EMPLOYEE_STATUS_ORDER = ['present', 'half_day', 'absent', 'leave'];
// How a day without an entry is shown when it's a company holiday / weekly off.
export const DAY_KIND = {
  holiday: { label: 'Holiday', color: '#B7791F', bg: '#FEF5E3', icon: 'party-popper' },
  weeklyOff: { label: 'Weekly off', color: '#4A5568', bg: '#E9ECF1', icon: 'calendar-weekend-outline' },
  // Approved leave request on a day without an attendance entry.
  leave: { label: 'Leave', color: '#6B46C1', bg: '#F1ECFD', icon: 'airplane' },
};

// Late badge colours (punch in after shift start + grace).
export const LATE_STYLE = { color: '#C2410C', bg: '#FFEDD5', icon: 'clock-alert-outline' };
// Overtime badge colours (punch out after shift end + minimum).
export const OVERTIME_STYLE = { color: '#1D4ED8', bg: '#DBEAFE', icon: 'clock-plus-outline' };

// Employees may only fill in or change TODAY's entry: past days are locked and
// future days can't be added.
export const isEditableDate = (date) => date === toDateKey();


// ---------------------------------------------------------------------------
// Dates

// Local calendar date as YYYY-MM-DD (not UTC, so late-evening entries land on the right day).
export function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function shiftDateKey(key, days) {
  const d = fromKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export const formatDateKey = (key, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) =>
  fromKey(key).toLocaleDateString(undefined, opts);

export const formatMonth = (key) =>
  fromKey(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

// Months are keyed 'YYYY-MM'.
export const monthOf = (dateKey) => dateKey.slice(0, 7);

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Every day of a month as date keys, newest first, stopping at today for the current month.
export function daysOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const today = toDateKey();
  const days = [];
  for (let d = 1; d <= last; d++) {
    const key = `${month}-${String(d).padStart(2, '0')}`;
    if (key > today) break;
    days.push(key);
  }
  return days.reverse();
}

// Month summary for one employee from their { [date]: record } map.
// `classify(location)` returns 'office' | 'outside' | ... (see geo.classifyLocation).
// `calendar` (see calendar.js): days without an entry that are a company holiday count as
// Holiday and weekly offs as weeklyOff, not as "Not filled". If someone worked that day,
// their entry counts as usual.
// `leaves`: this employee's approved leave requests (see leave.js); those days count as Leave.
// `late` counts days punched in after shift start + grace; `overtime` totals overtime minutes.
export function summariseMonth(byDate, month, classify, calendar, leaves) {
  const counts = Object.fromEntries(STATUS_ORDER.map((k) => [k, 0]));
  let minutes = 0;
  let notFilled = 0;
  let outside = 0;
  let weeklyOff = 0;
  let late = 0;
  let overtime = 0; // minutes
  for (const date of daysOfMonth(month)) {
    const r = byDate[date];
    if (!r) {
      const day = offDayFor(date, calendar, leaves);
      if (day?.kind === 'holiday') counts.holiday += 1;
      else if (day?.kind === 'weeklyOff') weeklyOff += 1;
      else if (day?.kind === 'leave') counts.leave += 1;
      else notFilled += 1;
      continue;
    }
    if (counts[r.status] != null) counts[r.status] += 1;
    minutes += workedMinutes(r.inTime, r.outTime) ?? 0;
    if (r.lateMinutes > 0) late += 1;
    overtime += r.overtimeMinutes > 0 ? r.overtimeMinutes : 0;
    if (classify && punchedOutsideOffice(r, classify)) outside += 1;
  }
  return { counts, minutes, notFilled, outside, weeklyOff, late, overtime };
}

// Why a day without an attendance entry isn't "Not filled": a company holiday, a weekly off,
// or approved leave (in that order). Returns { kind, name, label?, reason? } or null.
export function offDayFor(dateKey, calendar, leaves) {
  const day = dayInfo(dateKey, calendar);
  if (day) return day;
  const leave = leaveOn(dateKey, leaves);
  if (leave) return { kind: 'leave', name: LEAVE_TYPES[leave.type]?.label ?? 'Leave', reason: leave.reason };
  return null;
}

// "25m" / "1h 5m" for a Late badge.
export const formatLate = (minutes) => (minutes > 0 ? formatDuration(minutes) : '');

// ---------------------------------------------------------------------------
// Times (24-hour "HH:MM")

// Accepts "9:05", "09:05", "0905" or "905". Returns "HH:MM", or null when invalid.
export function parseTime(text) {
  const t = (text ?? '').trim();
  const m = t.match(/^([01]?\d|2[0-3]):?([0-5]\d)$/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Worked minutes between in and out. An out time earlier than the in time is treated as
// the next day (night shift).
export function workedMinutes(inTime, outTime) {
  if (!inTime || !outTime) return null;
  let diff = toMinutes(outTime) - toMinutes(inTime);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export const isOvernight = (inTime, outTime) =>
  Boolean(inTime && outTime && toMinutes(outTime) < toMinutes(inTime));

export function formatDuration(minutes) {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0 && m > 0) return `${m}m`; // "40m", not "0h 40m"
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Actions. Return an error message string, or null on success.
// (employeeId / date are kept in the signatures for the screens; the database always uses
// the signed-in employee and today's date in India time.)

const call = async (fn, params) => {
  const { error } = await db().rpc(fn, params);
  if (error) return errorMessage(error);
  invalidate('attendance');
  return null;
};

// `location` comes from geo.getCurrentLocation(); it is required for Present / Half Day.
export async function saveAttendance(employeeId, date, { status, remark, location }) {
  if (!isEditableDate(date)) return "Only today's attendance can be filled in or changed.";
  if (!STATUS[status]) return 'Please select a status.';
  return call('save_attendance', { p_status: status, p_remark: remark ?? '', p_location: location ?? null });
}

// Punch In: the server records the current time (India) plus the location.
export async function punchIn(employeeId, { status, remark, location }) {
  if (!STATUS[status]?.needsTime) return 'Select Present or Half Day to punch in.';
  if (!location) return 'Your location is needed to punch in. Please allow location and try again.';
  return call('punch_in', { p_status: status, p_remark: remark ?? '', p_location: location });
}

// Punch Out: the server records the current time (India) plus the location.
export async function punchOut(employeeId, { remark, location }) {
  if (!location) return 'Your location is needed to punch out. Please allow location and try again.';
  return call('punch_out', { p_remark: remark ?? null, p_location: location });
}

// "Continue working": removes today's Out time so the employee can punch out again later.
// The location is logged (action 'resume') so the admin can see it happened.
export async function resumeWork(employeeId, { location }) {
  if (!location) return 'Your location is needed. Please allow location and try again.';
  return call('resume_work', { p_location: location });
}

export async function clearAttendance(employeeId, date) {
  if (!isEditableDate(date)) return "Only today's attendance can be changed.";
  return call('clear_attendance', {});
}

// ---------------------------------------------------------------------------
// Locations

// First location recorded for the day (when the employee first filled it in) and the latest.
export function entryLocations(record) {
  const list = record?.locations ?? [];
  return { first: list[0] ?? null, last: list[list.length - 1] ?? null, all: list };
}

// Where the employee was when they punched in and when they punched out.
// in: the 'in' punch (older records: the first save). out: the 'out' punch, only once
// an Out time exists. Remark-only saves ('updated') are ignored.
export function punchLocations(record) {
  const list = record?.locations ?? [];
  const inLoc = list.find((l) => l.action === 'in') ?? list[0] ?? null;
  const outLoc = record?.outTime
    ? [...list].reverse().find((l) => l.action === 'out') ?? null
    : null;
  return { in: inLoc, out: outLoc };
}

// True when the punch in or punch out was away from the office (or from a fake location).
export function punchedOutsideOffice(record, classify) {
  const p = punchLocations(record);
  return [p.in, p.out].some((l) => l && (l.mocked || classify(l) === 'outside'));
}

// ---------------------------------------------------------------------------
// Reading

const COLUMNS =
  'id, employee_id, date, status, in_time, out_time, in_at, out_at, late_minutes, overtime_minutes, remark, locations, updated_at';

function mapRow(r) {
  return {
    id: r.id,
    date: r.date,
    employeeId: r.employee_id,
    status: r.status,
    inTime: r.in_time,
    outTime: r.out_time,
    inAt: r.in_at,
    lateMinutes: r.late_minutes ?? 0,
    overtimeMinutes: r.overtime_minutes ?? 0,
    outAt: r.out_at,
    remark: r.remark,
    locations: Array.isArray(r.locations) ? r.locations : [],
    updatedAt: r.updated_at,
  };
}

async function select(build) {
  const { data, error } = await build(db().from('attendance').select(COLUMNS));
  if (error) throw error;
  return data.map(mapRow);
}

const lastDayOfMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};

// Everyone's entries for one month, grouped per employee:
// { byEmployee: { [employeeId]: { [date]: record } }, loading }. (Admins see all employees;
// an employee only ever sees their own rows.)
export function useAttendanceForMonth(month) {
  const { data, loading } = useRemote(
    `attendance:month:${month}`,
    () => select((q) => q.gte('date', `${month}-01`).lte('date', lastDayOfMonth(month))),
    ['attendance']
  );
  const byEmployee = {};
  for (const r of data ?? []) (byEmployee[r.employeeId] ??= {})[r.date] = r;
  return { byEmployee, loading };
}

// Every employee's entry for one day: { byEmployee: { [employeeId]: record }, loading }.
export function useAttendanceForDate(date) {
  const { data, loading } = useRemote(
    `attendance:date:${date}`,
    () => select((q) => q.eq('date', date)),
    ['attendance']
  );
  const byEmployee = {};
  for (const r of data ?? []) byEmployee[r.employeeId] = r;
  return { byEmployee, loading };
}

// All of one employee's entries: { byDate: { [date]: record }, loading }.
export function useEmployeeAttendance(employeeId) {
  const { data, loading } = useRemote(
    employeeId ? `attendance:employee:${employeeId}` : null,
    () => select((q) => q.eq('employee_id', employeeId).order('date', { ascending: false })),
    ['attendance']
  );
  const byDate = {};
  for (const r of data ?? []) byDate[r.date] = r;
  return { byDate, loading };
}
