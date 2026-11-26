import { Platform } from 'react-native';
import {
  DAY_KIND,
  STATUS,
  daysOfMonth,
  formatDateKey,
  offDayFor,
  punchLocations,
  summariseMonth,
  workedMinutes,
} from './attendance';
import { describeEmployee } from './employees';
import { classifyLocation } from './geo';

// Attendance reports as CSV files (open directly in Excel / Google Sheets).

// Minutes -> hours with 2 decimals, e.g. 90 -> 1.5 (easy to add up in Excel).
const hours = (minutes) => (minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0);

function cell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The BOM makes Excel read the file as UTF-8 (names, "–" etc. stay correct).
export function toCsv(rows) {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

// Saves the file in the browser. Returns an error message, or null.
export function downloadCsv(filename, rows) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return 'Download is available on the website (open the admin panel in a browser).';
  }
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

const monthLabel = (month) => formatDateKey(`${month}-01`, { month: 'long', year: 'numeric' });

// One employee's month: totals used by the summary sheet.
function totalsFor(byDate, month, ctx, leaves) {
  const classify = (l) => classifyLocation(l, ctx.office).kind;
  const s = summariseMonth(byDate, month, classify, ctx.calendar, leaves);
  let lateMinutes = 0;
  for (const date of daysOfMonth(month)) {
    const r = byDate[date];
    lateMinutes += r?.lateMinutes > 0 ? r.lateMinutes : 0;
  }
  return { ...s, lateMinutes };
}

const SUMMARY_HEADER = [
  'Employee', 'Email', 'Department', 'Sub-department',
  'Present', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Weekly off', 'Not filled',
  'Late (days)', 'Late (hours)', 'Overtime (hours)', 'Worked (hours)', 'Outside office (days)',
];

function summaryRow(e, t, departments) {
  const { departmentName, subDepartmentName } = describeEmployee(e, departments);
  return [
    e.name, e.email ?? '', departmentName, subDepartmentName === '—' ? '' : subDepartmentName,
    t.counts.present, t.counts.half_day, t.counts.absent, t.counts.leave, t.counts.holiday, t.weeklyOff, t.notFilled,
    t.late, hours(t.lateMinutes), hours(t.overtime), hours(t.minutes), t.outside,
  ];
}

// Every day of one employee's month (oldest first).
function dayRows(e, byDate, month, ctx, leaves, departments, withEmployee) {
  const { departmentName } = describeEmployee(e, departments);
  return [...daysOfMonth(month)].reverse().map((date) => {
    const r = byDate[date];
    const off = r ? null : offDayFor(date, ctx.calendar, leaves);
    const status = r ? STATUS[r.status]?.label ?? r.status : off ? DAY_KIND[off.kind].label : 'Not filled';
    const p = r ? punchLocations(r) : {};
    const where = (l) => (l ? classifyLocation(l, ctx.office).label : '');
    const note = r?.remark || (off?.kind === 'holiday' ? off.name : off?.kind === 'leave' ? `${off.name}: ${off.reason}` : '');
    const row = [
      date,
      formatDateKey(date, { weekday: 'short' }),
      status,
      r?.inTime ?? '',
      r?.outTime ?? '',
      hours(r ? workedMinutes(r.inTime, r.outTime) ?? 0 : 0),
      r?.lateMinutes > 0 ? r.lateMinutes : 0,
      r?.overtimeMinutes > 0 ? r.overtimeMinutes : 0,
      r?.inTime ? where(p.in) : '',
      r?.outTime ? where(p.out) : '',
      note,
      r?.editedAt ? `Edited by admin: ${r.editedReason}` : '',
    ];
    return withEmployee ? [e.name, departmentName, ...row] : row;
  });
}

const DAY_HEADER = [
  'Date', 'Day', 'Status', 'In', 'Out', 'Worked (hours)', 'Late (min)', 'Overtime (min)',
  'In location', 'Out location', 'Remark', 'Admin correction',
];

// ctx = { office, calendar }. approved = { employeeId: [approved leave requests] }.

// All employees, one row each with the month's totals.
export function exportMonthSummary({ month, employees, departments, byEmployee, approved, ctx }) {
  const rows = [
    [`INEOS attendance summary — ${monthLabel(month)}`],
    [],
    SUMMARY_HEADER,
    ...employees.map((e) => summaryRow(e, totalsFor(byEmployee[e.id] ?? {}, month, ctx, approved[e.id]), departments)),
  ];
  return downloadCsv(`INEOS-attendance-${month}-summary.csv`, rows);
}

// All employees, one row per employee per day.
export function exportMonthDetail({ month, employees, departments, byEmployee, approved, ctx }) {
  const rows = [
    [`INEOS daily attendance — ${monthLabel(month)}`],
    [],
    ['Employee', 'Department', ...DAY_HEADER],
    ...employees.flatMap((e) => dayRows(e, byEmployee[e.id] ?? {}, month, ctx, approved[e.id], departments, true)),
  ];
  return downloadCsv(`INEOS-attendance-${month}-daily.csv`, rows);
}

// One employee: every day, then the totals.
export function exportEmployeeMonth({ month, employee, departments, byDate, leaves, ctx }) {
  const t = totalsFor(byDate, month, ctx, leaves);
  const { departmentName, subDepartmentName } = describeEmployee(employee, departments);
  const rows = [
    [`INEOS attendance report — ${employee.name} — ${monthLabel(month)}`],
    [`${departmentName}${subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}`, employee.email ?? ''],
    [],
    DAY_HEADER,
    ...dayRows(employee, byDate, month, ctx, leaves, departments, false),
    [],
    ['TOTALS'],
    SUMMARY_HEADER.slice(4),
    summaryRow(employee, t, departments).slice(4),
  ];
  const safeName = employee.name.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'employee';
  return downloadCsv(`INEOS-attendance-${month}-${safeName}.csv`, rows);
}
