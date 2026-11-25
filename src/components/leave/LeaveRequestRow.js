import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LEAVE_STATUS, LEAVE_TYPES, dayCount } from '../../data/leave';
import { formatDateKey } from '../../data/attendance';
import { COLORS } from '../../theme';

const fmt = (key) => formatDateKey(key, { day: 'numeric', month: 'short', year: 'numeric' });

// One leave request: dates, days, type, reason, status, admin note. `who` (optional) shows
// the employee for the admin list; `actions` (optional) adds buttons on the right.
export default function LeaveRequestRow({ request: r, who, actions, first }) {
  const s = LEAVE_STATUS[r.status] ?? LEAVE_STATUS.pending;
  const days = dayCount(r.from, r.to);
  return (
    <View style={[styles.row, !first && styles.border]}>
      <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
        {who}
        <Text style={styles.dates}>
          {fmt(r.from)}
          {r.to !== r.from ? ` – ${fmt(r.to)}` : ''}
          <Text style={styles.days}>{`  ·  ${days} day${days === 1 ? '' : 's'}`}</Text>
        </Text>
        <Text style={styles.reason}>
          <Text style={styles.type}>{LEAVE_TYPES[r.type]?.label ?? r.type}: </Text>
          {r.reason}
        </Text>
        {r.adminNote ? <Text style={styles.note}>Admin note: {r.adminNote}</Text> : null}
      </View>
      <View style={styles.right}>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <MaterialCommunityIcons name={s.icon} size={14} color={s.color} />
          <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
        </View>
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  border: { borderTopWidth: 1, borderTopColor: COLORS.border },
  dates: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  days: { fontSize: 13, fontWeight: '600', color: COLORS.body },
  type: { fontWeight: '700', color: '#6B46C1' },
  reason: { fontSize: 14, color: COLORS.body, lineHeight: 20 },
  note: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },
  right: { alignItems: 'flex-end', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
