import { db, errorMessage } from '../lib/supabase';
import { invalidate, useRemote } from './remote';

// Company calendar set by the admin (tables `holidays` and `calendar`, see supabase/calendar.sql):
//  * weekly offs — days of the week the company is closed (0 = Sunday … 6 = Saturday)
//  * holidays    — festival / company holidays on specific dates
// Days that are a holiday or weekly off don't count as "Not filled" in reports, and employees
// don't mark them themselves. Someone who works that day can still punch in.

export const WEEKDAYS = [
  { day: 1, short: 'Mon', label: 'Monday' },
  { day: 2, short: 'Tue', label: 'Tuesday' },
  { day: 3, short: 'Wed', label: 'Wednesday' },
  { day: 4, short: 'Thu', label: 'Thursday' },
  { day: 5, short: 'Fri', label: 'Friday' },
  { day: 6, short: 'Sat', label: 'Saturday' },
  { day: 0, short: 'Sun', label: 'Sunday' },
];

const TABLES = ['holidays', 'calendar'];
export const DEFAULT_SHIFT = { start: '09:00', end: '18:00', grace: 10 };
const EMPTY = { weeklyOffs: [0], holidays: [], shift: DEFAULT_SHIFT };

async function fetchCalendar() {
  const [cal, hol] = await Promise.all([
    db().from('calendar').select('*').eq('id', 'default').maybeSingle(),
    db().from('holidays').select('id, date, name').order('date'),
  ]);
  if (cal.error) throw cal.error;
  if (hol.error) throw hol.error;
  return {
    weeklyOffs: (cal.data?.weekly_offs ?? [0]).map(Number),
    holidays: hol.data.map((h) => ({ id: h.id, date: h.date, name: h.name })),
    // Company shift (supabase/shift_and_leave.sql). Punch In after start + grace is Late.
    shift: {
      start: cal.data?.shift_start ?? DEFAULT_SHIFT.start,
      end: cal.data?.shift_end ?? DEFAULT_SHIFT.end,
      grace: cal.data?.grace_minutes ?? DEFAULT_SHIFT.grace,
    },
  };
}

// Saves the company shift. start / end: 'HH:MM' (24-hour), grace: minutes.
export async function saveShift({ start, end, grace }) {
  const s = parseTime(start);
  const e = parseTime(end);
  const g = Number(String(grace).trim());
  if (!s) return 'Shift start is not valid. Use 24-hour format, e.g. 09:00';
  if (!e) return 'Shift end is not valid. Use 24-hour format, e.g. 18:00';
  if (s === e) return 'Shift start and end cannot be the same.';
  if (!Number.isInteger(g) || g < 0 || g > 180) return 'Grace must be a whole number of minutes between 0 and 180.';
  const { error } = await db().from('calendar').upsert({
    id: 'default',
    shift_start: s,
    shift_end: e,
    grace_minutes: g,
    updated_at: new Date().toISOString(),
  });
  if (error) return errorMessage(error);
  invalidate(...TABLES);
  return null;
}

// Same rules as attendance.parseTime (kept here to avoid a circular import).
function parseTime(text) {
  const m = (text ?? '').trim().match(/^([01]?\d|2[0-3]):?([0-5]\d)$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

// { calendar: { weeklyOffs, holidays }, loading }
export function useCalendar() {
  const { data, loading } = useRemote('calendar', fetchCalendar, TABLES);
  return { calendar: data ?? EMPTY, loading };
}

const weekdayOf = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

// What kind of day this is for the company: { kind: 'holiday', name } | { kind: 'weeklyOff', name }
// | null for a normal working day. A holiday wins over a weekly off.
export function dayInfo(dateKey, calendar) {
  const holiday = calendar?.holidays?.find((h) => h.date === dateKey);
  if (holiday) return { kind: 'holiday', name: holiday.name };
  const wd = weekdayOf(dateKey);
  if (calendar?.weeklyOffs?.includes(wd)) {
    return { kind: 'weeklyOff', name: WEEKDAYS.find((w) => w.day === wd)?.label ?? 'Weekly off' };
  }
  return null;
}

// Accepts 'DD/MM/YYYY', 'DD-MM-YYYY' or 'YYYY-MM-DD'. Returns 'YYYY-MM-DD' or null.
export function parseDateInput(text) {
  const t = (text ?? '').trim();
  let y;
  let m;
  let d;
  let match = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) [, d, m, y] = match.map(Number);
  else if ((match = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = match.map(Number);
  else return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Admin actions. Each returns an error message string, or null on success.

export async function saveWeeklyOffs(days) {
  const unique = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort();
  if (unique.length > 6) return 'At least one working day is needed.';
  const { error } = await db()
    .from('calendar')
    .upsert({ id: 'default', weekly_offs: unique, updated_at: new Date().toISOString() });
  if (error) return errorMessage(error);
  invalidate(...TABLES);
  return null;
}

export async function addHoliday({ date, name }) {
  const key = parseDateInput(date);
  if (!key) return 'Enter the date as DD/MM/YYYY, e.g. 12/11/2026';
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'Please enter the holiday name, e.g. Diwali';
  const { error } = await db().from('holidays').insert({ date: key, name: trimmed });
  if (error) {
    return error.code === '23505' ? 'There is already a holiday on that date.' : errorMessage(error);
  }
  invalidate(...TABLES);
  return null;
}

export async function deleteHoliday(id) {
  const { error } = await db().from('holidays').delete().eq('id', id);
  if (error) return errorMessage(error);
  invalidate(...TABLES);
  return null;
}
