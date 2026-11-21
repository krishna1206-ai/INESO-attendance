import { StyleSheet, View } from 'react-native';
import { CARD_GAP } from '../theme';

const COLUMNS = 3;

// Lays cards out 3 per row on wide screens, one per row on phones.
// renderItem(item, style) must apply `style` to the card so it fills its column.
export default function CardGrid({ isWide, items, renderItem }) {
  if (!isWide) {
    return <View>{items.map((item) => renderItem(item, null))}</View>;
  }

  const rows = [];
  for (let i = 0; i < items.length; i += COLUMNS) {
    rows.push(items.slice(i, i + COLUMNS));
  }

  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item) => renderItem(item, styles.cell))}
          {/* Empty slots keep the last row's cards the same width as the others. */}
          {Array.from({ length: COLUMNS - row.length }, (_, i) => (
            <View key={`spacer-${i}`} style={styles.spacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: CARD_GAP, marginBottom: CARD_GAP },
  cell: { flex: 1, marginBottom: 0 },
  spacer: { flex: 1 },
});
