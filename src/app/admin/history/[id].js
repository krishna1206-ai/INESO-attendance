import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { PageBody } from '../../../components/Screen';
import { Avatar, Button, EmptyState } from '../../../components/admin/ui';
import { exportEmployeeMonth } from '../../../data/exportCsv';
import MonthPicker from '../../../components/admin/MonthPicker';
import { PunchLocations } from '../../../components/admin/LocationBadge';
import { useDepartments } from '../../../data/departments';
import { describeEmployee, useEmployees } from '../../../data/employees';
import {
  STATUS,
  STATUS_ORDER,
  DAY_KIND,
  offDayFor,
  daysOfMonth,
  formatDateKey,
  formatDuration,
  monthOf,
  summariseMonth,
  toDateKey,
  useEmployeeAttendance,
  workedMinutes,
} from '../../../data/attendance';
import { classifyLocation } from '../../../data/geo';
import { useOffice } from '../../../data/settings';
import { useCalendar } from '../../../data/calendar';
import { useLeaveRequests } from '../../../data/leave';
import LateBadge from '../../../components/admin/LateBadge';
import OvertimeBadge from '../../../components/admin/OvertimeBadge';
import EditedBadge from '../../../components/admin/EditedBadge';
import { COLORS } from '../../../theme';

const TABLE_BREAKPOINT = 1000;

// /admin/history/<employeeId>?month=YYYY-MM — one employee's attendance report for a month:
// summary plus every day (including days that weren't filled in), with location.
export default function EmployeeReport() {
  const { id, month: monthParam } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const asTable = width >= TABLE_BREAKPOINT;
  const current = monthOf(toDateKey());
  const [month, setMonth] = useState(
    typeof monthParam === 'string' && /^\d{4}-\d{2}$/.test(monthParam) && monthParam <= current ? monthParam : current
  );
  const { departments } = useDepartments();
  const { employees, loading } = useEmployees();
  const { byDate } = useEmployeeAttendance(id);
  const { office } = useOffice();
  const { calendar } = useCalendar();
  const { requests } = useLeaveRequests();
  const [exportError, setExportError] = useState(null);

  const employee = employees.find((e) => e.id === id);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/admin/history'));
  const backLink = (
    <Pressable onPress={goBack} style={styles.back} accessibilityRole="link">
      <Feather name="arrow-left" size={16} color={COLORS.blue} />
      <Text style={styles.backText}>All employees</Text>
    </Pressable>
  );

  if (!loading && !employee) {
    return (
      <PageBody>
        {backLink}
        <EmptyState icon="account-off-outline" title="Employee not found" text="They may have been deleted." />
      </PageBody>
    );
  }
  if (!employee) return <PageBody />;

  const { departmentName, subDepartmentName } = describeEmployee(employee, departments);
  const approved = requests.filter((r) => r.status === 'approved' && r.employeeId === id);
  const summary = summariseMonth(byDate, month, (l) => classifyLocation(l, office).kind, calendar, approved);
  const days = daysOfMonth(month);

  return (
    <PageBody>
      {backLink}

      <View style={styles.who}>
        <Avatar name={employee.name} size={56} />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.label}>ATTENDANCE REPORT</Text>
          <Text style={styles.name}>{employee.name}</Text>
          <Text style={styles.sub}>
            {departmentName}
            {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
            {employee.email ? `  ·  ${employee.email}` : ''}
          </Text>
        </View>
      </View>

      <MonthPicker month={month} onChange={setMonth} />

      <View style={styles.exportRow}>
        <Button
          label="Download report (CSV)"
          icon="download"
          variant="outline"
          small
          onPress={() =>
            setExportError(
              exportEmployeeMonth({ month, employee, departments, byDate, leaves: approved, ctx: { office, calendar } })
            )
          }
        />
        {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}
      </View>

      {/* Summary */}
      <View style={styles.tiles}>
        {STATUS_ORDER.map((k) => (
          <Tile key={k} label={STATUS[k].label} value={summary.counts[k]} color={STATUS[k].color} bg={STATUS[k].bg} />
        ))}
        <Tile label="Weekly off" value={summary.weeklyOff} color={DAY_KIND.weeklyOff.color} bg={DAY_KIND.weeklyOff.bg} />
        <Tile label="Late" value={summary.late} color="#C2410C" bg="#FFEDD5" />
        <Tile label="Overtime" value={formatDuration(summary.overtime) || '0h'} color="#1D4ED8" bg="#DBEAFE" />
        <Tile label="Not filled" value={summary.notFilled} color="#9A5B00" bg="#FFF4E0" />
        <Tile label="Outside office" value={summary.outside} color={COLORS.danger} bg="#FDECEC" />
        <Tile label="Worked" value={formatDuration(summary.minutes) || '0h'} color={COLORS.white} bg={COLORS.navy} />
      </View>

      {/* Every day */}
      {days.length === 0 ? (
        <EmptyState icon="calendar-blank-outline" title="No days to show for this month" />
      ) : (
        <View style={styles.table}>
          {asTable ? (
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.colDate]}>DATE</Text>
              <Text style={[styles.th, styles.colStatus]}>STATUS</Text>
              <Text style={[styles.th, styles.colTime]}>IN – OUT</Text>
              <Text style={[styles.th, styles.colHours]}>WORKED</Text>
              <Text style={[styles.th, styles.colLoc]}>LOCATION</Text>
              <Text style={[styles.th, styles.colRemark]}>REMARK</Text>
            </View>
          ) : null}
          {days.map((date, i) => {
            const r = byDate[date];
            // A day without an entry is a company holiday, a weekly off, or "Not filled".
            const off = r ? null : offDayFor(date, calendar, approved);
            const s = r ? STATUS[r.status] : off ? DAY_KIND[off.kind] : null;
            const mins = r ? workedMinutes(r.inTime, r.outTime) : null;
            const times = r?.inTime ? `${r.inTime} – ${r.outTime || '…'}` : '—';
            const statusEl = (
              <View style={[styles.badge, { backgroundColor: s?.bg ?? '#FFF4E0' }]}>
                <Text style={[styles.badgeText, { color: s?.color ?? '#9A5B00' }]}>{s?.label ?? 'Not filled'}</Text>
              </View>
            );
            const remark = r?.remark || (off?.kind === 'holiday' ? off.name : off?.kind === 'leave' ? `${off.name}: ${off.reason}` : '');
            const locationEl = !r ? null : (
              <PunchLocations record={r} office={office} compact={!asTable} />
            );
            const dateEl = (
              <View style={styles.dateCell}>
                <Text style={styles.day}>{formatDateKey(date, { day: 'numeric' })}</Text>
                <Text style={styles.weekday}>{formatDateKey(date, { weekday: 'short' })}</Text>
              </View>
            );
            return asTable ? (
              <View key={date} style={[styles.tr, i > 0 && styles.trBorder, !r && !off && styles.rowMissing]}>
                <View style={styles.colDate}>{dateEl}</View>
                <View style={[styles.colStatus, { gap: 4 }]}>
                  {statusEl}
                  <EditedBadge record={r} compact />
                </View>
                <View style={[styles.colTime, { gap: 4 }]}>
                  <Text style={styles.td}>{times}</Text>
                  <LateBadge minutes={r?.lateMinutes} compact />
                  <OvertimeBadge minutes={r?.overtimeMinutes} compact />
                </View>
                <Text style={[styles.td, styles.colHours]}>{mins != null ? formatDuration(mins) : '—'}</Text>
                <View style={styles.colLoc}>{locationEl ?? <Text style={styles.muted}>—</Text>}</View>
                <Text style={[styles.td, styles.colRemark]} numberOfLines={2}>{remark || '—'}</Text>
              </View>
            ) : (
              <View key={date} style={[styles.card, i > 0 && styles.trBorder, !r && !off && styles.rowMissing]}>
                <View style={styles.cardTop}>
                  {dateEl}
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.cardLine}>
                      {statusEl}
                      {r ? (
                        <Text style={styles.td}>
                          {times}
                          {mins != null ? `  ·  ${formatDuration(mins)}` : ''}
                        </Text>
                      ) : null}
                      <LateBadge minutes={r?.lateMinutes} compact />
                      <OvertimeBadge minutes={r?.overtimeMinutes} compact />
                    </View>
                    {remark ? <Text style={styles.sub}>{remark}</Text> : null}
                    <EditedBadge record={r} />
                    {locationEl}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </PageBody>
  );
}

function Tile({ label, value, color, bg }) {
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  name: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  sub: { fontSize: 13, color: COLORS.body, marginTop: 2 },
  exportRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  exportError: { color: COLORS.danger, fontSize: 14 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tile: { minWidth: 96, flexGrow: 1, flexBasis: 96, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  tileValue: { fontSize: 24, fontWeight: '800' },
  tileLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  table: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  thead: { backgroundColor: COLORS.pageBg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  trBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowMissing: { backgroundColor: '#FFFBF3' },
  th: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  colDate: { width: 56 },
  colStatus: { flex: 1.3 },
  colTime: { flex: 1.5 },
  colHours: { flex: 1 },
  colLoc: { flex: 3 },
  colRemark: { flex: 2 },
  dateCell: { width: 44, alignItems: 'center' },
  day: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  weekday: { fontSize: 11, color: COLORS.body, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  td: { fontSize: 14, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.muted },
  card: { paddingHorizontal: 14, paddingVertical: 12 },
  cardTop: { flexDirection: 'row', gap: 12 },
  cardLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
