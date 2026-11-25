import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { OVERTIME_STYLE, formatDuration } from '../../data/attendance';

// "OT 1h 20m" pill for an attendance entry punched out after shift end.
export default function OvertimeBadge({ minutes, compact }) {
  if (!(minutes > 0)) return null;
  return (
    <View style={[styles.badge, { backgroundColor: OVERTIME_STYLE.bg }]}>
      <MaterialCommunityIcons name={OVERTIME_STYLE.icon} size={13} color={OVERTIME_STYLE.color} />
      <Text style={[styles.text, { color: OVERTIME_STYLE.color }]}>
        {compact ? `OT ${formatDuration(minutes)}` : `Overtime ${formatDuration(minutes)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
