import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { COLORS } from '../theme';

// INEOS-website style card: navy icon block on top, label/title/description/tags below.
// `style` lets the parent control width (e.g. 3 per row on wide screens).
// Optional onEdit / onDelete show Edit and Delete buttons at the bottom of the card;
// pressing them does not trigger the card's own onPress.
export default function FeatureCard({ card, onPress, isWide, style, onEdit, onDelete }) {
  const tags = card.tags ?? [];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && onPress && styles.cardPressed]}
    >
      <View style={[styles.iconArea, isWide && styles.iconAreaWide]}>
        <MaterialCommunityIcons name={card.icon} size={isWide ? 96 : 72} color={COLORS.white} />
      </View>

      <View style={styles.body}>
        <View style={styles.divider} />
        {card.label ? <Text style={styles.label}>{card.label}</Text> : null}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{card.title}</Text>
          {onPress ? (
            <Feather name="arrow-right" size={18} color={COLORS.text} style={{ marginLeft: 6 }} />
          ) : null}
        </View>
        {/* flexGrow pushes the chips to the bottom so they line up across cards */}
        {card.description ? <Text style={styles.description}>{card.description}</Text> : null}

        {tags.length > 0 ? (
          <View style={styles.chips}>
            {tags.map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {onEdit || onDelete ? (
          <View style={styles.actions}>
            {onEdit ? (
              <CardAction
                label="Edit"
                icon="edit-2"
                color={COLORS.text}
                bg={COLORS.chipBg}
                onPress={onEdit}
                accessibilityLabel={`Edit ${card.title}`}
              />
            ) : null}
            {onDelete ? (
              <CardAction
                label="Delete"
                icon="trash-2"
                color={COLORS.danger}
                bg="#FDECEC"
                onPress={onDelete}
                accessibilityLabel={`Delete ${card.title}`}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function CardAction({ label, icon, color, bg, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={(e) => {
        // Keep the click from also opening the card (web bubbles clicks to the parent).
        e?.stopPropagation?.();
        onPress();
      }}
      style={({ pressed }) => [styles.action, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={icon} size={14} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionText: { fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  iconArea: {
    backgroundColor: COLORS.navy,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAreaWide: { height: 200 },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },
  label: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  description: { flexGrow: 1, fontSize: 15, lineHeight: 24, color: COLORS.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 24 },
  chip: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 10,
    marginBottom: 10,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
});
