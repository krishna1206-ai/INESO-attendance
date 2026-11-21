import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { DEPARTMENT_ICONS } from '../data/departments';

// Form to create or edit a department: pick an icon, type a name, save.
// `initial` is the department being edited, or omitted to add a new one.
// onSave({ name, icon }) resolves to an error string, or null on success.
export default function AddDepartmentModal({ visible, initial, onClose, onSave }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fill from the department being edited (or start clean) every time it opens.
  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setIcon(initial?.icon ?? null);
      setError(null);
      setSaving(false);
    }
  }, [visible, initial]);

  const handleSave = async () => {
    setSaving(true);
    const message = await onSave({ name, icon });
    setSaving(false);
    if (message) {
      setError(message);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>{initial ? 'Edit Department' : 'Add Department'}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={COLORS.text} />
            </Pressable>
          </View>
          <View style={styles.accent} />

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>SELECT ICON</Text>
            <View style={styles.iconGrid}>
              {DEPARTMENT_ICONS.map((iconName) => {
                const selected = iconName === icon;
                return (
                  <Pressable
                    key={iconName}
                    onPress={() => {
                      setIcon(iconName);
                      setError(null);
                    }}
                    style={[styles.iconOption, selected && styles.iconOptionSelected]}
                    accessibilityLabel={iconName}
                    accessibilityState={{ selected }}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={28}
                      color={selected ? COLORS.white : COLORS.navy}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 24 }]}>DEPARTMENT NAME</Text>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError(null);
              }}
              placeholder="e.g. Production"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={[styles.button, styles.buttonSecondary]}>
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.button,
                styles.buttonPrimary,
                (pressed || saving) && { opacity: 0.85 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonPrimaryText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 26, 60, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: COLORS.white,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  accent: { height: 4, backgroundColor: COLORS.orange, width: '66%' },
  content: { padding: 24 },
  fieldLabel: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconOption: {
    width: 56,
    height: 56,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  error: { color: COLORS.danger, fontSize: 14, marginTop: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    minWidth: 110,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: COLORS.orange },
  buttonPrimaryText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  buttonSecondary: { backgroundColor: COLORS.chipBg },
  buttonSecondaryText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
});
