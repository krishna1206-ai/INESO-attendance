import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Avatar } from './ui';
import { DAY_KIND, LATE_STYLE, formatLate, toDateKey, useAttendanceForDate } from '../../data/attendance';
import { dayInfo, useCalendar } from '../../data/calendar';
import { approvedByEmployee, leaveOn, useLeaveRequests } from '../../data/leave';
import { COLORS } from '../../theme';

const LIST_LIMIT = 6;

// Dashboard: live picture of today — who is in, who is late, who hasn't punched in, who is
// on leave. Updates on its own (realtime) as people punch in and out.
export default function TodayOverview({ employees }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const today = toDateKey();
  const { byEmployee } = useAttendanceForDate(today);
  const { calendar } = useCalendar();
  const { requests } = useLeaveRequests();
  const approved = approvedByEmployee(requests);
  const offDay = dayInfo(today, calendar);

  const groups = { inNow: [], done: [], late: [], notIn: [], leave: [], absent: [] };
  for (const e of employees) {
    const r = byEmployee[e.id];
    if (r?.inTime) {
      (r.outTime ? groups.done : groups.inNow).push({ e, r });
      if (r.lateMinutes > 0) groups.late.push({ e, r });
    } else if (r?.status === 'leave' || (!r && leaveOn(today, approved[e.id]))) {
      groups.leave.push({ e, r });
    } else if (r?.status === 'absent') {
      groups.absent.push({ e, r });
    } else if (!r && !offDay) {
      groups.notIn.push({ e });
    }
  }
  groups.late.sort((a, b) => b.r.lateMinutes - a.r.lateMinutes);

  const tiles = [
    { label: 'In office now', value: groups.inNow.length, color: '#1E7B4A', bg: '#E3F4EA', icon: 'account-check-outline' },
    { label: 'Punched out', value: groups.done.length, color: COLORS.navy, bg: '#E6EAF2', icon: 'logout' },
    { label: 'Late', value: groups.late.length, color: LATE_STYLE.color, bg: LATE_STYLE.bg, icon: 'clock-alert-outline' },
    { label: 'Not punched in', value: groups.notIn.length, color: '#9A5B00', bg: '#FFF4E0', icon: 'account-clock-outline' },
    { label: 'On leave', value: groups.leave.length, color: DAY_KIND.leave.color, bg: DAY_KIND.leave.bg, icon: 'airplane' },
    { label: 'Absent', value: groups.absent.length, color: COLORS.danger, bg: '#FDECEC', icon: 'account-cancel-outline' },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.liveDot} />
        <Text style={styles.title}>Today</Text>
        <Text style={styles.shift}>
          Office time {calendar.shift.start} – {calendar.shift.end}
        </Text>
        <Pressable onPress={() => router.navigate('/admin/attendance')} hitSlop={8} style={styles.link} accessibilityRole="link">
          <Text style={styles.linkText}>Open attendance</Text>
          <Feather name="arrow-right" size={14} color={COLORS.blue} />
        </Pressable>
      </View>

      {offDay ? (
        <View style={[styles.offBanner, { backgroundColor: DAY_KIND[offDay.kind].bg }]}>
          <MaterialCommunityIcons name={DAY_KIND[offDay.kind].icon} size={18} color={DAY_KIND[offDay.kind].color} />
          <Text style={[styles.offText, { color: DAY_KIND[offDay.kind].color }]}>
            {offDay.kind === 'holiday' ? `Company holiday: ${offDay.name}` : `Weekly off (${offDay.name})`}
          </Text>
        </View>
      ) : null}

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { backgroundColor: t.bg }]}>
            <MaterialCommunityIcons name={t.icon} size={20} color={t.color} />
            <Text style={[styles.tileValue, { color: t.color }]}>{t.value}</Text>
            <Text style={[styles.tileLabel, { color: t.color }]}>{t.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.lists, wide && { flexDirection: 'row' }]}>
        <PeopleList
          title="Not punched in yet"
          empty={offDay ? 'Nobody is expected today.' : 'Everyone has punched in.'}
          items={groups.notIn}
          right={() => null}
        />
        <PeopleList
          title="Late today"
          empty="Nobody is late today."
          items={groups.late}
          right={({ r }) => (
            <Text style={[styles.rightText, { color: LATE_STYLE.color }]}>
              {r.inTime} · {formatLate(r.lateMinutes)} late
            </Text>
          )}
        />
        <PeopleList
          title="In office now"
          empty="Nobody is in right now."
          items={groups.inNow}
          right={({ r }) => <Text style={styles.rightText}>since {r.inTime}</Text>}
        />
      </View>
    </View>
  );
}

function PeopleList({ title, items, empty, right }) {
  const shown = items.slice(0, LIST_LIMIT);
  return (
    <View style={styles.list}>
      <Text style={styles.listTitle}>
        {title} <Text style={styles.listCount}>({items.length})</Text>
      </Text>
      {shown.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        shown.map((item, i) => (
          <View key={item.e.id} style={[styles.person, i > 0 && styles.personBorder]}>
            <Avatar name={item.e.name} size={30} />
            <Text style={styles.personName} numberOfLines={1}>{item.e.name}</Text>
            {right(item)}
          </View>
        ))
      )}
      {items.length > LIST_LIMIT ? (
        <Pressable onPress={() => router.navigate('/admin/attendance')} style={{ marginTop: 8 }}>
          <Text style={styles.linkText}>+{items.length - LIST_LIMIT} more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const card = {
  backgroundColor: COLORS.white,
  borderRadius: 4,
  elevation: 2,
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  wrap: { ...card, padding: 20, marginBottom: 24, borderTopWidth: 4, borderTopColor: COLORS.navy },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22A35A' },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  shift: { fontSize: 13, color: COLORS.body, flexGrow: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
  offBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 4, padding: 12, marginBottom: 14 },
  offText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: 130, minWidth: 0, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  tileValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  tileLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  lists: { gap: 16, marginTop: 18 },
  list: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 14 },
  listTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  listCount: { color: COLORS.body, fontWeight: '600' },
  empty: { fontSize: 13, color: COLORS.body, paddingVertical: 6 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  personBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  personName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  rightText: { fontSize: 12, fontWeight: '600', color: COLORS.body },
});
