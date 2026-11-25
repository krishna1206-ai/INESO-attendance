import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

// Simple confirm dialog. (Alert.alert has no buttons on web, so we use our own.)
// onConfirm may return a promise; the dialog shows a spinner until it resolves.
// `children` (optional) render under the message, e.g. a note field. `tone`: 'danger' (red,
// default) or 'primary' (green) for the confirm button.
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  children,
  tone = 'danger',
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  // If onConfirm resolves to a string, it's an error: show it and keep the dialog open.
  const handleConfirm = async () => {
    setBusy(true);
    try {
      const result = await onConfirm();
      if (typeof result === 'string') setError(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footer}>
            <Pressable onPress={onCancel} style={[styles.button, styles.cancel]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={busy}
              style={[styles.button, styles.danger, tone === 'primary' && { backgroundColor: '#1E7B4A' }]}
            >
              {busy ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.dangerText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
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
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  message: { fontSize: 15, lineHeight: 22, color: COLORS.body, marginTop: 10 },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.danger,
    backgroundColor: '#FDECEC',
    borderRadius: 4,
    padding: 10,
    marginTop: 12,
  },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  button: {
    minWidth: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: COLORS.chipBg },
  cancelText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  danger: { backgroundColor: COLORS.danger },
  dangerText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
