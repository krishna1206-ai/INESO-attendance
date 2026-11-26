import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PageBody } from '../../../components/Screen';
import { Avatar, Button, EmptyState, PageTitle } from '../../../components/admin/ui';
import { exportMonthDetail, exportMonthSummary } from '../../../data/exportCsv';
import MonthPicker from '../../../components/admin/MonthPicker';
import { useDepartments } from '../../../data/departments';
import { describeEmployee, useEmployees } from '../../../data/employees';
import { formatDuration, monthOf, summariseMonth, toDateKey, useAttendanceForMonth } from '../../../data/attendance';
import { classifyLocation } from '../../../data/geo';
import { useOffice } from '../../../data/settings';
import { useCalendar } from '../../../data/calendar';
import { approvedByEmployee, useLeaveRequests } from '../../../data/leave';
import { COLORS } from '../../../theme';

const TABLE_BREAKPOINT = 900;

// /admin/history — pick an employee to open their attendance report.
// Each row shows a quick summary for the chosen month.
export default function AdminHistory() {
  const { width } = useWindowDimensions();
  const asTable = width >= TABLE_BREAKPOINT;
  const [month, setMonth] = useState(monthOf(toDateKey()));
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [exportError, setExportError] = useState(null);
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { byEmployee } = useAttendanceForMonth(month);
  const { office } = useOffice();
  const { calendar } = useCalendar();
  const { requests } = useLeaveRequests();
  const approved = approvedByEmployee(requests);
  const classify = (l) => classifyLocation(l, office).kind;

  const q = query.trim().toLowerCase();
  const rows = employees
    .filter((e) => deptFilter === 'all' || e.departmentId === deptFilter)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.email ?? '').includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ employee: e, summary: summariseMonth(byEmployee[e.id] ?? {}, month, classify, calendar, approved[e.id]) }));

  // CSV of the month for the employees shown (search + department filter apply).
  const runExport = (fn) =>
    setExportError(
      fn({
        month,
        employees: rows.map((r) => r.employee),
        departments,
        byEmployee,
        approved,
        ctx: { office, calendar },
      })
    );

  const open = (e) => router.push(`/admin/history/${e.id}?month=${month}`);

  return (
    <PageBody>
      <PageTitle label="REPORTS" title="Attendance History" subtitle="Select an employee to see their full report.">
        <Button label="Download summary" icon="download" onPress={() => runExport(exportMonthSummary)} accessibilityLabel="Download month summary (CSV)" />
        <Button label="Daily detail" icon="download" variant="outline" onPress={() => runExport(exportMonthDetail)} accessibilityLabel="Download daily detail (CSV)" />
      </PageTitle>
      {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}

      <MonthPicker month={month} onChange={setMonth} />

      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Feather name="search" size={16} color={COLORS.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
            accessibilityLabel="Search employees"
          />
        </View>
        <View style={styles.filters}>
          {[{ id: 'all', name: 'All departments' }, ...departments].map((d) => {
            const active = deptFilter === d.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDeptFilter(d.id)}
                style={[styles.filter, active && styles.filterActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{d.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {employees.length === 0 ? (
        <EmptyState icon="account-group-outline" title="No employees yet" />
      ) : rows.length === 0 ? (
        <EmptyState icon="account-search-outline" title="No matching employees" />
      ) : (
        <View style={styles.table}>
          {asTable ? (
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.colName]}>EMPLOYEE</Text>
              <Text style={[styles.th, styles.colNum]}>PRESENT</Text>
              <Text style={[styles.th, styles.colNum]}>ABSENT</Text>
              <Text style={[styles.th, styles.colNum]}>LEAVE</Text>
              <Text style={[styles.th, styles.colNum]}>NOT FILLED</Text>
              <Text style={[styles.th, styles.colNum]}>OUTSIDE</Text>
              <Text style={[styles.th, styles.colNum]}>LATE</Text>
              <Text style={[styles.th, styles.colNum]}>OVERTIME</Text>
              <Text style={[styles.th, styles.colNum]}>WORKED</Text>
              <View style={styles.colGo} />
            </View>
          ) : null}
          {rows.map(({ employee: e, summary: s }, i) => {
            const { departmentName, subDepartmentName } = describeEmployee(e, departments);
            const present = s.counts.present + s.counts.half_day;
            const who = (
              <View style={styles.person}>
                <Avatar name={e.name} size={asTable ? 34 : 40} />
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.name}>{e.name}</Text>
                  <Text style={styles.sub}>
                    {departmentName}
                    {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
                  </Text>
                </View>
              </View>
            );
            return (
              <Pressable
                key={e.id}
                onPress={() => open(e)}
                style={({ hovered, pressed }) => [
                  asTable ? styles.tr : styles.card,
                  i > 0 && styles.trBorder,
                  (hovered || pressed) && styles.rowHover,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open report for ${e.name}`}
              >
                {asTable ? (
                  <>
                    <View style={styles.colName}>{who}</View>
                    <Text style={[styles.num, styles.colNum, { color: '#1E7B4A' }]}>{present}</Text>
                    <Text style={[styles.num, styles.colNum, { color: COLORS.danger }]}>{s.counts.absent}</Text>
                    <Text style={[styles.num, styles.colNum, { color: '#6B46C1' }]}>{s.counts.leave}</Text>
                    <Text style={[styles.num, styles.colNum]}>{s.notFilled}</Text>
                    <Text style={[styles.num, styles.colNum, s.outside > 0 && { color: COLORS.danger }]}>{s.outside}</Text>
                    <Text style={[styles.num, styles.colNum, s.late > 0 && { color: '#C2410C' }]}>{s.late}</Text>
                    <Text style={[styles.num, styles.colNum, s.overtime > 0 && { color: '#1D4ED8' }]}>{formatDuration(s.overtime) || '0h'}</Text>
                    <Text style={[styles.num, styles.colNum]}>{formatDuration(s.minutes) || '0h'}</Text>
                    <View style={styles.colGo}>
                      <Feather name="chevron-right" size={18} color={COLORS.muted} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.cardTop}>
                      {who}
                      <Feather name="chevron-right" size={18} color={COLORS.muted} />
                    </View>
                    <View style={styles.chips}>
                      <Chip label="Present" value={present} color="#1E7B4A" bg="#E3F4EA" />
                      <Chip label="Absent" value={s.counts.absent} color={COLORS.danger} bg="#FDECEC" />
                      <Chip label="Leave" value={s.counts.leave} color="#6B46C1" bg="#F1ECFD" />
                      <Chip label="Not filled" value={s.notFilled} color={COLORS.text} bg={COLORS.chipBg} />
                      {s.outside > 0 ? <Chip label="Outside" value={s.outside} color={COLORS.danger} bg="#FDECEC" /> : null}
                      {s.late > 0 ? <Chip label="Late" value={s.late} color="#C2410C" bg="#FFEDD5" /> : null}
                      {s.overtime > 0 ? <Chip label="Overtime" value={formatDuration(s.overtime)} color="#1D4ED8" bg="#DBEAFE" /> : null}
                    </View>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </PageBody>
  );
}

function Chip({ label, value, color, bg }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: 12, marginBottom: 16 },
  exportError: { color: COLORS.danger, fontSize: 14, marginBottom: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    maxWidth: 420,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 15, color: COLORS.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: COLORS.chipBg },
  filterActive: { backgroundColor: COLORS.navy },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  filterTextActive: { color: COLORS.white },
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
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  trBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowHover: { backgroundColor: '#F0F4FF' },
  th: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  colName: { flex: 3.2 },
  colNum: { flex: 1, textAlign: 'center' },
  colGo: { width: 24, alignItems: 'flex-end' },
  num: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.body, marginTop: 2 },
  card: { padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'baseline', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipValue: { fontSize: 14, fontWeight: '800' },
  chipLabel: { fontSize: 12, fontWeight: '600' },
});
