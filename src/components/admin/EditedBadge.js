import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// "Edited by admin: <reason>" for a day the admin corrected.
// `inline` is a plain one-line note (no pill) for tight table cells.
export default function EditedBadge({ record, compact, inline }) {
  if (!record?.editedAt) return null;
  if (inline) {
    return (
      <View style={styles.inline}>
        <MaterialCommunityIcons name="pencil-outline" size={12} color="#8A6500" />
        <Text style={styles.inlineText} numberOfLines={1}>
          Edited{record.editedReason ? `: ${record.editedReason}` : ''}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons name="pencil-outline" size={13} color="#6B4E00" />
      <Text style={styles.text} numberOfLines={compact ? 1 : 3}>
        Edited by admin{record.editedReason ? `: ${record.editedReason}` : ''}
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
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFF4CC',
  },
  text: { fontSize: 12, fontWeight: '700', color: '#6B4E00', flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  inlineText: { fontSize: 12, fontStyle: 'italic', color: '#8A6500', flexShrink: 1 },
});
