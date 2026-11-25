import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

// Card for one sub-department: image on top (falls back to the department icon),
// name, website link, optional footer text, and optional Edit / Delete actions for the admin.
// With `onPress` the whole card is clickable.
export default function SubDepartmentCard({
  sub,
  fallbackIcon,
  isWide,
  style,
  onPress,
  footer,
  onEdit,
  onDelete,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = sub.imageUri && !imageFailed;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, style, pressed && onPress && styles.cardPressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open ${sub.name}` : undefined}
    >
      <View style={[styles.media, isWide && styles.mediaWide]}>
        {showImage ? (
          <Image
            source={{ uri: sub.imageUri }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
            accessibilityLabel={`${sub.name} image`}
          />
        ) : (
          <MaterialCommunityIcons name={fallbackIcon} size={isWide ? 96 : 72} color={COLORS.white} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.divider} />
        <Text style={styles.label}>SUB-DEPARTMENT</Text>
        <Text style={styles.title}>{sub.name}</Text>

        <View style={styles.spacer} />

        {footer ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>{footer}</Text>
            <Feather name="arrow-right" size={16} color={COLORS.text} />
          </View>
        ) : null}

        {onEdit || onDelete ? (
          <View style={styles.actions}>
            {onEdit ? (
              <Pressable onPress={onEdit} style={[styles.action, styles.edit]}>
                <Feather name="edit-2" size={14} color={COLORS.text} />
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable onPress={onDelete} style={[styles.action, styles.delete]}>
                <Feather name="trash-2" size={14} color={COLORS.danger} />
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.chipBg,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  footerText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  media: {
    backgroundColor: COLORS.navy,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaWide: { height: 200 },
  image: { width: '100%', height: '100%' },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  spacer: { flexGrow: 1, minHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  edit: { backgroundColor: COLORS.chipBg },
  editText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  delete: { backgroundColor: '#FDECEC' },
  deleteText: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
});
