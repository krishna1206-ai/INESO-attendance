import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import AttendanceEntry from '../../components/attendance/AttendanceEntry';
import { Avatar } from '../../components/admin/ui';
import { useSession } from '../../data/session';
import { useDepartments } from '../../data/departments';
import { describeEmployee } from '../../data/employees';
import {
  STATUS,
  STATUS_ORDER,
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
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const { width } = useWindowDimensions();
  const narrow = width < 480;

  if (!employee) return null;
  const { departmentName, subDepartmentName } = describeEmployee(employee, departments);

  const month = date.slice(0, 7);
  const monthRecords = Object.values(byDate)
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const counts = Object.fromEntries(STATUS_ORDER.map((k) => [k, 0]));
  let totalMinutes = 0;
  for (const r of monthRecords) {
    if (counts[r.status] != null) counts[r.status] += 1;
    totalMinutes += workedMinutes(r.inTime, r.outTime) ?? 0;
  }

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

      {loading ? (
        <ActivityIndicator color={COLORS.navy} style={{ marginVertical: 24 }} />
      ) : (
        <AttendanceEntry employeeId={employee.id} date={date} record={byDate[date]} />
      )}

      {/* Month summary */}
      <Text style={styles.sectionTitle}>{formatMonth(date)}</Text>
      <View style={styles.summary}>
        {STATUS_ORDER.map((k) => (
          <View key={k} style={[styles.pill, { backgroundColor: STATUS[k].bg }]}>
            <Text style={[styles.pillValue, { color: STATUS[k].color }]}>{counts[k]}</Text>
            <Text style={[styles.pillLabel, { color: STATUS[k].color }]}>{STATUS[k].label}</Text>
          </View>
        ))}
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
            const s = STATUS[r.status];
            const mins = workedMinutes(r.inTime, r.outTime);
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
                <Text style={styles.rowTimes}>
                  {r.inTime ? `${r.inTime} – ${r.outTime || '…'}` : r.remark || '—'}
                </Text>
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
  rowTimes: { flex: 1, fontSize: 14, color: COLORS.text },
  rowHours: { fontSize: 13, color: COLORS.body, fontWeight: '600' },
});
