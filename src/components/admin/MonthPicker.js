import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatMonth, monthOf, shiftMonth, toDateKey } from '../../data/attendance';
import { COLORS } from '../../theme';

// ‹ November 2026 › — can't go past the current month.
export default function MonthPicker({ month, onChange }) {
  const current = monthOf(toDateKey());
  const atCurrent = month >= current;
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => onChange(shiftMonth(month, -1))}
        style={styles.arrow}
        accessibilityLabel="Previous month"
      >
        <Feather name="chevron-left" size={20} color={COLORS.navy} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.label}>{atCurrent ? 'THIS MONTH' : 'MONTH'}</Text>
        <Text style={styles.text}>{formatMonth(`${month}-01`)}</Text>
      </View>
      <Pressable
        onPress={() => onChange(shiftMonth(month, 1))}
        disabled={atCurrent}
        style={[styles.arrow, atCurrent && { opacity: 0.45 }]}
        accessibilityLabel="Next month"
      >
        <Feather name="chevron-right" size={20} color={atCurrent ? COLORS.muted : COLORS.navy} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.orange,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chipBg,
  },
  center: { flex: 1, alignItems: 'center' },
  label: { color: COLORS.blue, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  text: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
});
