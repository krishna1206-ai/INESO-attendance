import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import ConfirmModal from './ConfirmModal';
import { changeMyPassword } from '../data/passwords';
import { COLORS } from '../theme';

// "Change password" for whoever is signed in on this side (employee or admin).
export default function ChangePasswordModal({ visible, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(false);
    }
  }, [visible]);

  if (done) {
    return (
      <ConfirmModal
        visible={visible}
        title="Password changed"
        message="Use your new password the next time you sign in."
        confirmLabel="OK"
        tone="primary"
        onConfirm={onClose}
        onCancel={onClose}
      />
    );
  }

  return (
    <ConfirmModal
      visible={visible}
      title="Change password"
      confirmLabel="Change password"
      tone="primary"
      onCancel={onClose}
      onConfirm={async () => {
        const message = await changeMyPassword(current, next, confirm);
        if (message) return message;
        setDone(true);
      }}
    >
      <View style={styles.fields}>
        <Field label="CURRENT PASSWORD" value={current} onChange={setCurrent} autoComplete="current-password" />
        <Field label="NEW PASSWORD" value={next} onChange={setNext} placeholder="At least 6 characters" autoComplete="new-password" />
        <Field label="CONFIRM NEW PASSWORD" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </View>
    </ConfirmModal>
  );
}

function Field({ label, value, onChange, placeholder, autoComplete }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        style={styles.input}
        accessibilityLabel={label.toLowerCase()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12, marginTop: 4 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minWidth: 0,
  },
});
