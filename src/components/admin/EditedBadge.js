import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// "Edited by admin: <reason>" for a day the admin corrected.
export default function EditedBadge({ record, compact }) {
  if (!record?.editedAt) return null;
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
});
