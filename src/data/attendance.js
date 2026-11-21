import { createPersistentList } from './store';

// Attendance entries, stored on this device only (see store.js). Each employee fills in
// their own day (the company has no punching machine). One record per employee per day:
//   { id: '<date>_<employeeId>', date: 'YYYY-MM-DD', employeeId, status,
//     inTime: 'HH:MM' | '', outTime: 'HH:MM' | '', remark, updatedAt,
//     locations: [{ latitude, longitude, accuracy, mocked, capturedAt, action }] }
// In/Out times come only from the Punch In / Punch Out buttons (the device clock at the moment
// of the tap, also kept as inAt / outAt timestamps) — employees can't type or change them.
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

// Employees may only fill in or change TODAY's entry: past days are locked and
// future days can't be added.
export const isEditableDate = (date) => date === toDateKey();

const store = createPersistentList('ineos.attendance.v1');
const recordId = (date, employeeId) => `${date}_${employeeId}`;

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
export function summariseMonth(byDate, month, classify) {
  const counts = Object.fromEntries(STATUS_ORDER.map((k) => [k, 0]));
  let minutes = 0;
  let notFilled = 0;
  let outside = 0;
  for (const date of daysOfMonth(month)) {
    const r = byDate[date];
    if (!r) {
      notFilled += 1;
      continue;
    }
    if (counts[r.status] != null) counts[r.status] += 1;
    minutes += workedMinutes(r.inTime, r.outTime) ?? 0;
    const { first, last } = entryLocations(r);
    if (classify && [first, last].some((l) => l && (l.mocked || classify(l) === 'outside'))) outside += 1;
  }
  return { counts, minutes, notFilled, outside };
}

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
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Actions. Return an error message string, or null on success.

// `location` comes from geo.getCurrentLocation(); it is required for Present / Half Day.
export async function saveAttendance(employeeId, date, { status, remark, location }) {
  if (!isEditableDate(date)) return "Only today's attendance can be filled in or changed.";
  const info = STATUS[status];
  if (!info) return 'Please select a status.';

  const list = await store.get();
  const id = recordId(date, employeeId);
  const previous = list.find((r) => r.id === id);

  // In/Out times are never typed: they only come from Punch In / Punch Out (the clock at the
  // moment of the tap). Saving Present / Half Day here just keeps the punched times.
  let inT = '';
  let outT = '';
  if (info.needsTime) {
    if (!previous?.inTime) return 'Tap “Punch In” to record your arrival time.';
    inT = previous.inTime;
    outT = previous.outTime ?? '';
    if (!location) {
      return 'Your location is needed to mark yourself present. Please allow location and try again.';
    }
  } else if (previous?.inTime) {
    return `You already punched in at ${previous.inTime} today, so you can't change to ${info.label}.`;
  }
  // What this save did, so the admin can see where In and Out were each recorded.
  const action = !previous
    ? 'created'
    : outT && !previous.outTime
      ? 'out'
      : 'updated';
  const locations = [
    ...(previous?.locations ?? []),
    ...(location ? [{ ...location, action }] : []),
  ].slice(-MAX_LOCATIONS);

  const record = {
    ...previous, // keeps inAt / outAt punch timestamps
    id,
    date,
    employeeId,
    status,
    inTime: inT,
    outTime: outT,
    remark: (remark ?? '').trim().slice(0, 200),
    locations,
    updatedAt: new Date().toISOString(),
  };
  return store.save([...list.filter((r) => r.id !== id), record]);
}

const MAX_LOCATIONS = 20;

// Current time as 'HH:MM' (24-hour, device clock).
const nowHHMM = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Punch In: records the arrival time from the clock (not typed) plus location, for today.
// status must be Present or Half Day. Returns an error message, or null on success.
export async function punchIn(employeeId, { status, remark, location }) {
  const date = toDateKey();
  const info = STATUS[status];
  if (!info?.needsTime) return 'Select Present or Half Day to punch in.';
  if (!location) {
    return 'Your location is needed to punch in. Please allow location and try again.';
  }
  const list = await store.get();
  const id = recordId(date, employeeId);
  const previous = list.find((r) => r.id === id);
  if (previous?.inTime) return `You already punched in at ${previous.inTime} today.`;

  const now = new Date();
  const record = {
    id,
    date,
    employeeId,
    status,
    inTime: nowHHMM(now),
    inAt: now.toISOString(),
    outTime: '',
    remark: (remark ?? '').trim().slice(0, 200),
    locations: [...(previous?.locations ?? []), { ...location, action: 'in' }].slice(-MAX_LOCATIONS),
    updatedAt: now.toISOString(),
  };
  return store.save([...list.filter((r) => r.id !== id), record]);
}

// Punch Out: records the leaving time from the clock plus location, for today.
export async function punchOut(employeeId, { remark, location }) {
  const date = toDateKey();
  if (!location) {
    return 'Your location is needed to punch out. Please allow location and try again.';
  }
  const list = await store.get();
  const id = recordId(date, employeeId);
  const previous = list.find((r) => r.id === id);
  if (!previous?.inTime) return 'Punch in first.';
  if (previous.outTime) return `You already punched out at ${previous.outTime} today.`;

  const now = new Date();
  const record = {
    ...previous,
    outTime: nowHHMM(now),
    outAt: now.toISOString(),
    remark: remark == null ? previous.remark : remark.trim().slice(0, 200),
    locations: [...(previous.locations ?? []), { ...location, action: 'out' }].slice(-MAX_LOCATIONS),
    updatedAt: now.toISOString(),
  };
  return store.save([...list.filter((r) => r.id !== id), record]);
}

// First location recorded for the day (when the employee first filled it in) and the latest.
export function entryLocations(record) {
  const list = record?.locations ?? [];
  return { first: list[0] ?? null, last: list[list.length - 1] ?? null, all: list };
}

export async function clearAttendance(employeeId, date) {
  if (!isEditableDate(date)) return "Only today's attendance can be changed.";
  const list = await store.get();
  const id = recordId(date, employeeId);
  // Punch times are a record of when the employee arrived; they can't be wiped and re-done.
  if (list.find((r) => r.id === id)?.inTime) return "Punched times can't be cleared.";
  return store.save(list.filter((r) => r.id !== id));
}

// ---------------------------------------------------------------------------
// Hooks

// Every entry, grouped per employee: { byEmployee: { [employeeId]: { [date]: record } }, loading }.
export function useAllAttendance() {
  const { items, loading } = store.useList();
  const byEmployee = {};
  for (const r of items) (byEmployee[r.employeeId] ??= {})[r.date] = r;
  return { byEmployee, loading };
}

// Every employee's entry for one day: { byEmployee: { [employeeId]: record }, loading }.
export function useAttendanceForDate(date) {
  const { items, loading } = store.useList();
  const byEmployee = {};
  for (const r of items) if (r.date === date) byEmployee[r.employeeId] = r;
  return { byEmployee, loading };
}

// All of one employee's entries: { byDate: { [date]: record }, loading }.
export function useEmployeeAttendance(employeeId) {
  const { items, loading } = store.useList();
  const byDate = {};
  for (const r of items) if (r.employeeId === employeeId) byDate[r.date] = r;
  return { byDate, loading };
}
