import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatMonth, shiftMonth, toDateKey } from '../../data/attendance';
import { dayInfo } from '../../data/calendar';
import { COLORS } from '../../theme';

const HEAD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A month grid for picking a date. Weekly offs (e.g. every Sunday) are shown in red as "Off"
// and company holidays in amber, using the company calendar.
//   month: 'YYYY-MM', onMonthChange(month), selected: 'YYYY-MM-DD' | null, onSelect(dateKey)
export default function MonthCalendar({ month, onMonthChange, selected, onSelect, calendar }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = toDateKey();

  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Pressable onPress={() => onMonthChange(shiftMonth(month, -1))} style={styles.navBtn} accessibilityLabel="Previous month">
          <Feather name="chevron-left" size={18} color={COLORS.navy} />
        </Pressable>
        <Text style={styles.navTitle}>{formatMonth(`${month}-01`)}</Text>
        <Pressable onPress={() => onMonthChange(shiftMonth(month, 1))} style={styles.navBtn} accessibilityLabel="Next month">
          <Feather name="chevron-right" size={18} color={COLORS.navy} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {HEAD.map((h, i) => (
          <Text key={h} style={[styles.head, calendar.weeklyOffs.includes(i) && styles.headOff]}>
            {h}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((key, di) => {
            if (!key) return <View key={`e${di}`} style={styles.cell} />;
            const info = dayInfo(key, calendar);
            const isSelected = key === selected;
            const isToday = key === today;
            return (
              <Pressable
                key={key}
                onPress={() => onSelect(key)}
                style={[
                  styles.cell,
                  info?.kind === 'weeklyOff' && styles.cellOff,
                  info?.kind === 'holiday' && styles.cellHoliday,
                  isToday && styles.cellToday,
                  isSelected && styles.cellSelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${key}${info ? ` ${info.kind === 'holiday' ? info.name : 'weekly off'}` : ''}`}
              >
                <Text
                  style={[
                    styles.dayNum,
                    info?.kind === 'weeklyOff' && styles.numOff,
                    info?.kind === 'holiday' && styles.numHoliday,
                    isSelected && styles.numSelected,
                  ]}
                >
                  {Number(key.slice(8))}
                </Text>
                {info ? (
                  <Text
                    style={[
                      styles.tag,
                      info.kind === 'weeklyOff' ? styles.numOff : styles.numHoliday,
                      isSelected && styles.numSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {info.kind === 'weeklyOff' ? 'Off' : info.name}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <Legend color="#FDECEC" border="#F5C2C2" label="Weekly off" />
        <Legend color="#FEF5E3" border="#F3D9A6" label="Company holiday" />
        <Legend color={COLORS.navy} border={COLORS.navy} label="Selected" />
      </View>
    </View>
  );
}

function Legend({ color, border, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: border }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 10, width: '100%', maxWidth: 520 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chipBg,
  },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  row: { flexDirection: 'row' },
  head: { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.body, paddingVertical: 6 },
  headOff: { color: COLORS.danger },
  cell: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    margin: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden', // long holiday names must not widen the cell
  },
  cellOff: { backgroundColor: '#FDECEC' },
  cellHoliday: { backgroundColor: '#FEF5E3', borderColor: '#F3D9A6' },
  cellToday: { borderColor: COLORS.blue },
  cellSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  dayNum: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  numOff: { color: COLORS.danger },
  numHoliday: { color: '#B7791F' },
  numSelected: { color: COLORS.white },
  tag: { fontSize: 9, fontWeight: '700', marginTop: 1, alignSelf: 'stretch', textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  legendText: { fontSize: 12, color: COLORS.body },
});
