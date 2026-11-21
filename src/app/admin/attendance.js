import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PageBody } from '../../components/Screen';
import { Avatar, EmptyState, PageTitle } from '../../components/admin/ui';
import LocationBadge from '../../components/admin/LocationBadge';
import { useDepartments } from '../../data/departments';
import { describeEmployee, useEmployees } from '../../data/employees';
import {
  STATUS,
  entryLocations,
  formatDateKey,
  formatDuration,
  shiftDateKey,
  toDateKey,
  useAttendanceForDate,
  workedMinutes,
} from '../../data/attendance';
import { classifyLocation } from '../../data/geo';
import { useOffice } from '../../data/settings';
import { COLORS } from '../../theme';

const TABLE_BREAKPOINT = 1000;

// /admin/attendance — everyone's attendance for a day, with where each entry was filled in.
export default function AdminAttendance() {
  const { width } = useWindowDimensions();
  const asTable = width >= TABLE_BREAKPOINT;
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const [onlyOutside, setOnlyOutside] = useState(false);
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { byEmployee } = useAttendanceForDate(date);
  const { office } = useOffice();

  const rows = [...employees]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const record = byEmployee[e.id] ?? null;
      const { first, last } = entryLocations(record);
      // An entry counts as "outside" if any save that day was made away from the office.
      const outside = [first, last].some(
        (l) => l && (classifyLocation(l, office).kind === 'outside' || l.mocked)
      );
      return { employee: e, record, first, last, outside };
    });

  const filled = rows.filter((r) => r.record).length;
  const outsideCount = rows.filter((r) => r.outside).length;
  const visible = onlyOutside ? rows.filter((r) => r.outside) : rows;

  return (
    <PageBody>
      <PageTitle label="REPORTS" title="Attendance" subtitle="Who filled in attendance, and from where." />

      {!office ? (
        <Pressable onPress={() => router.navigate('/admin/settings')} style={styles.warn}>
          <Feather name="alert-triangle" size={16} color="#9A5B00" />
          <Text style={styles.warnText}>
            Office location is not set, so entries can't be checked as “At office”. Set it in Settings →
          </Text>
        </Pressable>
      ) : null}

      {/* Day picker */}
      <View style={styles.dateBar}>
        <Pressable onPress={() => setDate(shiftDateKey(date, -1))} style={styles.dateArrow} accessibilityLabel="Previous day">
          <Feather name="chevron-left" size={20} color={COLORS.navy} />
        </Pressable>
        <View style={styles.dateCenter}>
          <Text style={styles.dateLabel}>{date === today ? 'TODAY' : 'PAST DAY'}</Text>
          <Text style={styles.dateText}>{formatDateKey(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
        <Pressable
          onPress={() => setDate(shiftDateKey(date, 1))}
          disabled={date >= today}
          style={[styles.dateArrow, date >= today && { opacity: 0.45 }]}
          accessibilityLabel="Next day"
        >
          <Feather name="chevron-right" size={20} color={date >= today ? COLORS.muted : COLORS.navy} />
        </Pressable>
      </View>

      {/* Summary + filter */}
      <View style={styles.summaryRow}>
        <View style={styles.summary}>
          <Pill value={`${filled}/${employees.length}`} label="Filled in" color={COLORS.text} bg={COLORS.chipBg} />
          <Pill value={outsideCount} label="Outside office" color={COLORS.danger} bg="#FDECEC" />
        </View>
        <Pressable
          onPress={() => setOnlyOutside((v) => !v)}
          style={[styles.filter, onlyOutside && styles.filterActive]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: onlyOutside }}
        >
          <Feather name={onlyOutside ? 'check-square' : 'square'} size={15} color={onlyOutside ? COLORS.white : COLORS.text} />
          <Text style={[styles.filterText, onlyOutside && { color: COLORS.white }]}>Only outside office</Text>
        </Pressable>
      </View>

      {employees.length === 0 ? (
        <EmptyState icon="account-group-outline" title="No employees yet" />
      ) : visible.length === 0 ? (
        <EmptyState icon="office-building-marker-outline" title="Nobody filled in attendance outside the office" />
      ) : (
        <View style={styles.table}>
          {asTable ? (
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.colName]}>EMPLOYEE</Text>
              <Text style={[styles.th, styles.colStatus]}>STATUS</Text>
              <Text style={[styles.th, styles.colTime]}>IN – OUT</Text>
              <Text style={[styles.th, styles.colLoc]}>LOCATION</Text>
            </View>
          ) : null}
          {visible.map(({ employee: e, record, first, last }, i) => {
            const s = record ? STATUS[record.status] : null;
            const mins = record ? workedMinutes(record.inTime, record.outTime) : null;
            const { departmentName, subDepartmentName } = describeEmployee(e, departments);
            const times = record?.inTime ? `${record.inTime} – ${record.outTime || '…'}` : '—';
            const sameSpot = first && last && first === last;
            const statusEl = (
              <View style={[styles.badge, { backgroundColor: s?.bg ?? COLORS.chipBg }]}>
                <Text style={[styles.badgeText, { color: s?.color ?? COLORS.body }]}>{s?.label ?? 'Not filled'}</Text>
              </View>
            );
            const locationEl = !record ? (
              <Text style={styles.muted}>—</Text>
            ) : (
              <View style={{ gap: 4 }}>
                <LocationBadge location={first} office={office} label={sameSpot || !last ? null : 'IN'} />
                {!sameSpot && last ? <LocationBadge location={last} office={office} label="LATEST" /> : null}
              </View>
            );
            return asTable ? (
              <View key={e.id} style={[styles.tr, i > 0 && styles.trBorder]}>
                <View style={[styles.colName, styles.person]}>
                  <Avatar name={e.name} size={34} />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.name}>{e.name}</Text>
                    <Text style={styles.sub}>
                      {departmentName}
                      {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.colStatus}>{statusEl}</View>
                <View style={styles.colTime}>
                  <Text style={styles.td}>{times}</Text>
                  {mins != null ? <Text style={styles.sub}>{formatDuration(mins)}</Text> : null}
                </View>
                <View style={styles.colLoc}>{locationEl}</View>
              </View>
            ) : (
              <View key={e.id} style={[styles.card, i > 0 && styles.trBorder]}>
                <View style={styles.person}>
                  <Avatar name={e.name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{e.name}</Text>
                    <Text style={styles.sub}>
                      {departmentName}
                      {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
                    </Text>
                  </View>
                  {statusEl}
                </View>
                {record ? (
                  <Text style={styles.td}>
                    {times}
                    {mins != null ? `  ·  ${formatDuration(mins)}` : ''}
                    {record.remark ? `  ·  ${record.remark}` : ''}
                  </Text>
                ) : null}
                {locationEl}
              </View>
            );
          })}
        </View>
      )}
    </PageBody>
  );
}

function Pill({ value, label, color, bg }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4E0',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  warnText: { color: '#9A5B00', fontSize: 14, fontWeight: '600', flexShrink: 1 },
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
  dateCenter: { flex: 1, alignItems: 'center' },
  dateLabel: { color: COLORS.blue, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dateText: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillValue: { fontSize: 16, fontWeight: '800' },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
  },
  filterActive: { backgroundColor: COLORS.danger },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
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
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  trBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  th: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  colName: { flex: 3 },
  colStatus: { flex: 1.4 },
  colTime: { flex: 1.6 },
  colLoc: { flex: 3.2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.body, marginTop: 2 },
  td: { fontSize: 14, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.muted },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  card: { padding: 16, gap: 10 },
});
