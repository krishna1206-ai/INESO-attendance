import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PageBody } from '../../components/Screen';
import { Avatar, EmptyState, PageTitle } from '../../components/admin/ui';
import LocationBadge, { PunchLocations } from '../../components/admin/LocationBadge';
import ConfirmModal from '../../components/ConfirmModal';
import CorrectionModal from '../../components/admin/CorrectionModal';
import EditedBadge from '../../components/admin/EditedBadge';
import { useDepartments } from '../../data/departments';
import { describeEmployee, useEmployees } from '../../data/employees';
import {
  STATUS,
  DAY_KIND,
  adminResumeWork,
  punchedOutsideOffice,
  punchLocations,
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
import { dayInfo, useCalendar } from '../../data/calendar';
import { LEAVE_TYPES, approvedByEmployee, leaveOn, useLeaveRequests } from '../../data/leave';
import LateBadge from '../../components/admin/LateBadge';
import OvertimeBadge from '../../components/admin/OvertimeBadge';
import { COLORS } from '../../theme';

const TABLE_BREAKPOINT = 1000;

// /admin/attendance — everyone's attendance for a day, with where each entry was filled in.
export default function AdminAttendance() {
  const { width } = useWindowDimensions();
  const asTable = width >= TABLE_BREAKPOINT;
  const today = toDateKey();
  const [date, setDate] = useState(today);
  const [onlyOutside, setOnlyOutside] = useState(false);
  // Employee whose Out time the admin is about to remove ("Continue working").
  const [resuming, setResuming] = useState(null);
  // { employee, date, record } while the admin is correcting a day.
  const [correcting, setCorrecting] = useState(null);
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { byEmployee } = useAttendanceForDate(date);
  const { office } = useOffice();
  const { calendar } = useCalendar();
  const offDay = dayInfo(date, calendar);
  const officeTime = `${calendar.shift.start} – ${calendar.shift.end}`;
  const { requests } = useLeaveRequests();
  const approved = approvedByEmployee(requests);

  const rows = [...employees]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const record = byEmployee[e.id] ?? null;
      // "Outside" when the punch in or punch out was made away from the office.
      const outside = Boolean(record) && punchedOutsideOffice(record, (l) => classifyLocation(l, office).kind);
      // No entry but on approved leave that day.
      const onLeave = !record && !offDay ? leaveOn(date, approved[e.id]) : null;
      return { employee: e, record, outside, onLeave };
    });

  const filled = rows.filter((r) => r.record).length;
  const outsideCount = rows.filter((r) => r.outside).length;
  const lateCount = rows.filter((r) => r.record?.lateMinutes > 0).length;
  const leaveCount = rows.filter((r) => r.onLeave).length;
  const overtimeCount = rows.filter((r) => r.record?.overtimeMinutes > 0).length;
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

      {offDay ? (
        <View style={[styles.offBanner, { backgroundColor: DAY_KIND[offDay.kind].bg }]}>
          <MaterialCommunityIcons name={DAY_KIND[offDay.kind].icon} size={18} color={DAY_KIND[offDay.kind].color} />
          <Text style={[styles.offBannerText, { color: DAY_KIND[offDay.kind].color }]}>
            {offDay.kind === 'holiday'
              ? `Company holiday: ${offDay.name}`
              : `Weekly off (${offDay.name})`}
            {' — only people who worked today have an entry.'}
          </Text>
        </View>
      ) : null}

      {/* Summary + filter */}
      <View style={styles.summaryRow}>
        <View style={styles.summary}>
          <Pill value={`${filled}/${employees.length}`} label="Filled in" color={COLORS.text} bg={COLORS.chipBg} />
          <Pill value={outsideCount} label="Outside office" color={COLORS.danger} bg="#FDECEC" />
          <Pill value={lateCount} label="Late" color="#C2410C" bg="#FFEDD5" />
          <Pill value={overtimeCount} label="Overtime" color="#1D4ED8" bg="#DBEAFE" />
          {leaveCount > 0 ? <Pill value={leaveCount} label="On leave" color="#6B46C1" bg="#F1ECFD" /> : null}
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
              <Text style={[styles.th, styles.colOffice]}>OFFICE TIME</Text>
              <Text style={[styles.th, styles.colStatus]}>STATUS</Text>
              <Text style={[styles.th, styles.colPunch]}>PUNCH IN</Text>
              <Text style={[styles.th, styles.colPunch]}>PUNCH OUT</Text>
              <Text style={[styles.th, styles.colHours]}>WORKED</Text>
              <View style={styles.colAction} />
            </View>
          ) : null}
          {visible.map(({ employee: e, record, onLeave }, i) => {
            // No entry on a holiday / weekly off shows the day type instead of "Not filled".
            // No entry: holiday / weekly off for everyone, or this employee's approved leave.
            const s = record ? STATUS[record.status] : offDay ? DAY_KIND[offDay.kind] : onLeave ? DAY_KIND.leave : null;
            const mins = record ? workedMinutes(record.inTime, record.outTime) : null;
            const { departmentName, subDepartmentName } = describeEmployee(e, departments);
            const times = record?.inTime ? `${record.inTime} – ${record.outTime || '…'}` : '—';
            const statusEl = (
              <View style={[styles.badge, { backgroundColor: s?.bg ?? COLORS.chipBg }]}>
                <Text style={[styles.badgeText, { color: s?.color ?? COLORS.body }]}>{s?.label ?? 'Not filled'}</Text>
              </View>
            );
            // Today, after punch out: the admin can reopen the day so they can punch out again.
            const resumeEl =
              date === today && record?.inTime && record?.outTime ? (
                <ActionButton
                  icon="play-circle-outline"
                  label="Continue working"
                  onPress={() => setResuming({ employee: e, outTime: record.outTime })}
                />
              ) : null;
            // Add or fix the day (forgot to punch, phone died...).
            const editEl = (
              <ActionButton
                icon={record ? 'pencil-outline' : 'plus'}
                label={record ? 'Edit' : 'Add'}
                onPress={() => setCorrecting({ employee: e, date, record })}
              />
            );
            const editedEl = <EditedBadge record={record} compact={!asTable} />;
            const locationEl = !record ? (
              <Text style={styles.muted}>—</Text>
            ) : (
              <PunchLocations record={record} office={office} />
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
                <View style={styles.colOffice}>
                  <Text style={styles.officeTime}>{offDay ? '—' : officeTime}</Text>
                </View>
                <View style={[styles.colStatus, { gap: 6 }]}>
                  {statusEl}
                  {editedEl}
                </View>
                {record?.inTime ? (
                  <>
                    {/* Punch in: time + Late, and where it was made */}
                    <View style={[styles.colPunch, styles.punchCell]}>
                      <View style={styles.punchLine}>
                        <Text style={styles.punchTime}>{record.inTime}</Text>
                        <LateBadge minutes={record.lateMinutes} />
                      </View>
                      <LocationBadge location={punchLocations(record).in} office={office} />
                    </View>
                    {/* Punch out: time + overtime (or still working), and where */}
                    <View style={[styles.colPunch, styles.punchCell]}>
                      {record.outTime ? (
                        <>
                          <View style={styles.punchLine}>
                            <Text style={styles.punchTime}>{record.outTime}</Text>
                            <OvertimeBadge minutes={record.overtimeMinutes} />
                          </View>
                          <LocationBadge location={punchLocations(record).out} office={office} />
                        </>
                      ) : (
                        <View style={styles.working}>
                          <View style={styles.workingDot} />
                          <Text style={styles.workingText}>Working</Text>
                        </View>
                      )}
                    </View>
                  </>
                ) : (
                  // No punches (Absent / Leave / not filled): the note across both punch columns.
                  <View style={[styles.colPunchBoth, styles.punchCell]}>
                    <Text style={record?.remark || onLeave ? styles.td : styles.muted} numberOfLines={2}>
                      {onLeave
                        ? `${LEAVE_TYPES[onLeave.type]?.label ?? 'Leave'}: ${onLeave.reason}`
                        : record?.remark || '—'}
                    </Text>
                    {record && entryLocations(record).last ? (
                      <LocationBadge location={entryLocations(record).last} office={office} />
                    ) : null}
                  </View>
                )}
                <Text style={[styles.colHours, styles.hours]}>{mins != null ? formatDuration(mins) : '—'}</Text>
                <View style={[styles.colAction, styles.actions]}>
                  {resumeEl}
                  {editEl}
                </View>
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
                {!offDay ? <Text style={styles.sub}>Office time {officeTime}</Text> : null}
                {record ? (
                  <Text style={styles.td}>
                    {times}
                    {mins != null ? `  ·  ${formatDuration(mins)}` : ''}
                    {record.remark ? `  ·  ${record.remark}` : ''}
                  </Text>
                ) : onLeave ? (
                  <Text style={styles.sub}>{`${LEAVE_TYPES[onLeave.type]?.label ?? 'Leave'}: ${onLeave.reason}`}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <LateBadge minutes={record?.lateMinutes} />
                  <OvertimeBadge minutes={record?.overtimeMinutes} />
                </View>
                {editedEl}
                {locationEl}
                <View style={styles.actionsRow}>
                  {resumeEl}
                  {editEl}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <ConfirmModal
        visible={resuming !== null}
        title="Continue working?"
        message={
          resuming
            ? `${resuming.employee.name} punched out at ${resuming.outTime}. Their Out time (and any overtime) will be removed so they can punch out again when they leave.`
            : ''
        }
        confirmLabel="Continue working"
        tone="primary"
        onCancel={() => setResuming(null)}
        onConfirm={async () => {
          const message = await adminResumeWork(resuming.employee.id);
          if (message) return message;
          setResuming(null);
        }}
      />
      <CorrectionModal target={correcting} onClose={() => setCorrecting(null)} />
    </PageBody>
  );
}

function ActionButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.resume, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={15} color={COLORS.navy} />
      <Text style={styles.resumeText}>{label}</Text>
    </Pressable>
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
  offBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 4, padding: 12, marginBottom: 16 },
  offBannerText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
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
  colName: { flex: 2.2 },
  colOffice: { flex: 1.3 },
  officeTime: { fontSize: 15, fontWeight: '600', color: COLORS.body },
  colStatus: { flex: 1.1 },
  colPunch: { flex: 2 },
  colPunchBoth: { flex: 4 },
  colHours: { flex: 0.9 },
  colAction: { width: 250 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  punchCell: { gap: 6 },
  punchLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  punchTime: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  hours: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  working: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E7B4A' },
  workingText: { fontSize: 14, fontWeight: '600', color: '#1E7B4A' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.body, marginTop: 2 },
  td: { fontSize: 14, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.muted },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  card: { padding: 16, gap: 10 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.navy,
    backgroundColor: COLORS.white,
  },
  resumeText: { color: COLORS.navy, fontSize: 12, fontWeight: '700' },
});
