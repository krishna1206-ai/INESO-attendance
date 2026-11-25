import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LATE_STYLE, formatLate } from '../../data/attendance';

// "Late 25m" pill for an attendance entry punched in after shift start + grace.
export default function LateBadge({ minutes, compact }) {
  if (!(minutes > 0)) return null;
  return (
    <View style={[styles.badge, { backgroundColor: LATE_STYLE.bg }]}>
      <MaterialCommunityIcons name={LATE_STYLE.icon} size={13} color={LATE_STYLE.color} />
      <Text style={[styles.text, { color: LATE_STYLE.color }]}>
        {compact ? formatLate(minutes) : `Late ${formatLate(minutes)}`}
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
