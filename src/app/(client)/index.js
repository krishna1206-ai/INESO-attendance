import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import { dayInfo, useCalendar } from '../../data/calendar';
import AttendanceEntry from '../../components/attendance/AttendanceEntry';
import { Avatar } from '../../components/admin/ui';
import LateBadge from '../../components/admin/LateBadge';
import OvertimeBadge from '../../components/admin/OvertimeBadge';
import EditedBadge from '../../components/admin/EditedBadge';
import MyLeaves from '../../components/leave/MyLeaves';
import { useLeaveRequests } from '../../data/leave';
import { useSession } from '../../data/session';
import { useDepartments } from '../../data/departments';
import { describeEmployee } from '../../data/employees';
import {
  STATUS,
  STATUS_ORDER,
  DAY_KIND,
  LATE_STYLE,
  OVERTIME_STYLE,
  daysOfMonth,
  offDayFor,
  summariseMonth,
  formatDateKey,
  formatDuration,
  formatMonth,
  shiftDateKey,
  toDateKey,
  useEmployeeAttendance,
  workedMinutes,
} from '../../data/attendance';
import { COLORS } from '../../theme';

// Employee home: fill in your own attendance (status + In/Out time) for any day,
// and see this month's summary and history.
export default function MyAttendance() {
  const { employee } = useSession(); // (client)/_layout guarantees a signed-in employee
  const { departments } = useDepartments();
  const { byDate, loading } = useEmployeeAttendance(employee?.id);
  const { calendar } = useCalendar();
  const { requests: leaveRequests } = useLeaveRequests(); // only this employee's own
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const { width } = useWindowDimensions();
  const narrow = width < 480;

  if (!employee) return null;
  const { departmentName, subDepartmentName } = describeEmployee(employee, departments);

  const month = date.slice(0, 7);
  const approved = leaveRequests.filter((r) => r.status === 'approved');
  // History: this month's entries plus days (so far) without an entry that were a company
  // holiday or approved leave.
  const offRows = daysOfMonth(month)
    .filter((d) => !byDate[d])
    .map((d) => ({ date: d, off: offDayFor(d, calendar, approved) }))
    .filter((x) => x.off && x.off.kind !== 'weeklyOff')
    .map((x) => ({ id: `off-${x.date}`, date: x.date, off: x.off }));
  const monthRecords = [
    ...Object.values(byDate).filter((r) => r.date.startsWith(month)),
    ...offRows,
  ].sort((a, b) => b.date.localeCompare(a.date));
  // Summary counts company holidays as Holiday and approved leave as Leave.
  const { counts, minutes: totalMinutes, late: lateDays, overtime: overtimeMinutes } = summariseMonth(byDate, month, null, calendar, approved);
  const offDay = byDate[date] ? dayInfo(date, calendar) : offDayFor(date, calendar, approved);

  return (
    <Screen>
      {/* Who */}
      <View style={styles.who}>
        <Avatar name={employee.name} size={narrow ? 44 : 52} />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.label}>MY ATTENDANCE</Text>
          <Text style={[styles.name, narrow && styles.nameNarrow]}>{employee.name}</Text>
          <Text style={styles.dept}>
            {departmentName}
            {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
          </Text>
        </View>
      </View>

      {/* Day picker */}
      <View style={styles.dateBar}>
        <Pressable onPress={() => setDate(shiftDateKey(date, -1))} style={styles.dateArrow} accessibilityLabel="Previous day">
          <Feather name="chevron-left" size={20} color={COLORS.navy} />
        </Pressable>
        <View style={styles.dateCenter}>
          <Text style={styles.dateLabel}>{date === today ? 'TODAY' : 'PAST DAY · VIEW ONLY'}</Text>
          <Text style={styles.dateText}>
            {narrow
              ? formatDateKey(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              : formatDateKey(date)}
          </Text>
          {date !== today ? (
            <Pressable onPress={() => setDate(today)} hitSlop={6}>
              <Text style={styles.todayLink}>Back to today</Text>
            </Pressable>
          ) : null}
        </View>
        {/* No future days: the next arrow stops at today. */}
        <Pressable
          onPress={() => setDate(shiftDateKey(date, 1))}
          disabled={date >= today}
          style={[styles.dateArrow, date >= today && styles.dateArrowDisabled]}
          accessibilityLabel="Next day"
        >
          <Feather name="chevron-right" size={20} color={date >= today ? COLORS.muted : COLORS.navy} />
        </Pressable>
      </View>

      {offDay ? (
        <View style={[styles.offBanner, { backgroundColor: DAY_KIND[offDay.kind].bg }]}>
          <MaterialCommunityIcons name={DAY_KIND[offDay.kind].icon} size={20} color={DAY_KIND[offDay.kind].color} />
          <Text style={[styles.offBannerText, { color: DAY_KIND[offDay.kind].color }]}>
            {offDay.kind === 'holiday'
              ? `${date === today ? 'Today is' : 'This was'} a company holiday: ${offDay.name}`
              : offDay.kind === 'leave'
                ? `${date === today ? 'You are' : 'You were'} on approved leave (${offDay.name})`
                : `${date === today ? 'Today is' : 'This was'} a weekly off (${offDay.name})`}
            {date === today ? '. No need to fill in attendance unless you are working today.' : '.'}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={COLORS.navy} style={{ marginVertical: 24 }} />
      ) : (
        <AttendanceEntry employeeId={employee.id} date={date} record={byDate[date]} />
      )}

      {/* Leave requests */}
      <MyLeaves requests={leaveRequests} calendar={calendar} />

      {/* Month summary */}
      <Text style={styles.sectionTitle}>{formatMonth(date)}</Text>
      <View style={styles.summary}>
        {STATUS_ORDER.map((k) => (
          <View key={k} style={[styles.pill, { backgroundColor: STATUS[k].bg }]}>
            <Text style={[styles.pillValue, { color: STATUS[k].color }]}>{counts[k]}</Text>
            <Text style={[styles.pillLabel, { color: STATUS[k].color }]}>{STATUS[k].label}</Text>
          </View>
        ))}
        <View style={[styles.pill, { backgroundColor: LATE_STYLE.bg }]}>
          <Text style={[styles.pillValue, { color: LATE_STYLE.color }]}>{lateDays}</Text>
          <Text style={[styles.pillLabel, { color: LATE_STYLE.color }]}>Late</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: OVERTIME_STYLE.bg }]}>
          <Text style={[styles.pillValue, { color: OVERTIME_STYLE.color }]}>{formatDuration(overtimeMinutes) || '0h'}</Text>
          <Text style={[styles.pillLabel, { color: OVERTIME_STYLE.color }]}>Overtime</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: COLORS.chipBg }]}>
          <Text style={[styles.pillValue, { color: COLORS.text }]}>{formatDuration(totalMinutes) || '0h'}</Text>
          <Text style={[styles.pillLabel, { color: COLORS.text }]}>Worked</Text>
        </View>
      </View>

      {/* History */}
      <View style={styles.history}>
        {monthRecords.length === 0 ? (
          <Text style={styles.empty}>No entries in {formatMonth(date)} yet.</Text>
        ) : (
          monthRecords.map((r, i) => {
            const s = r.off ? DAY_KIND[r.off.kind] : STATUS[r.status];
            const mins = r.off ? null : workedMinutes(r.inTime, r.outTime);
            const selected = r.date === date;
            return (
              <Pressable
                key={r.id}
                onPress={() => setDate(r.date)}
                style={[styles.row, i > 0 && styles.rowBorder, selected && styles.rowSelected]}
                accessibilityLabel={`Open ${formatDateKey(r.date)}`}
              >
                <View style={styles.rowDate}>
                  <Text style={styles.rowDay}>{formatDateKey(r.date, { day: 'numeric' })}</Text>
                  <Text style={styles.rowWeekday}>{formatDateKey(r.date, { weekday: 'short' })}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: s?.bg ?? COLORS.chipBg }]}>
                  <Text style={[styles.badgeText, { color: s?.color ?? COLORS.text }]}>{s?.label ?? r.status}</Text>
                </View>
                <View style={styles.rowMiddle}>
                  <Text style={styles.rowTimes}>
                    {r.off ? r.off.name : r.inTime ? `${r.inTime} – ${r.outTime || '…'}` : r.remark || '—'}
                  </Text>
                  {!r.off && (r.lateMinutes > 0 || r.overtimeMinutes > 0) ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <LateBadge minutes={r.lateMinutes} compact />
                      <OvertimeBadge minutes={r.overtimeMinutes} compact />
                    </View>
                  ) : null}
                  {!r.off ? <EditedBadge record={r} compact /> : null}
                </View>
                <Text style={styles.rowHours}>{mins != null ? formatDuration(mins) : ''}</Text>
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  offBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 4, padding: 14, marginBottom: 16 },
  offBannerText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  name: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  nameNarrow: { fontSize: 21 },
  dept: { fontSize: 14, color: COLORS.body, marginTop: 2 },

  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.orange,
  },
  dateArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chipBg,
  },
  dateArrowDisabled: { opacity: 0.45 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateLabel: { color: COLORS.blue, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dateText: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  todayLink: { color: COLORS.blue, fontSize: 13, fontWeight: '600', marginTop: 4, textDecorationLine: 'underline' },

  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillValue: { fontSize: 16, fontWeight: '800' },
  pillLabel: { fontSize: 13, fontWeight: '600' },

  history: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  empty: { padding: 20, fontSize: 14, color: COLORS.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowSelected: { backgroundColor: '#F0F4FF' },
  rowDate: { width: 40, alignItems: 'center' },
  rowDay: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  rowWeekday: { fontSize: 11, color: COLORS.body, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, minWidth: 76, alignItems: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  rowMiddle: { flex: 1, minWidth: 0, gap: 4 },
  rowTimes: { fontSize: 14, color: COLORS.text },
  rowHours: { fontSize: 13, color: COLORS.body, fontWeight: '600' },
});
