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
import { Feather } from '@expo/vector-icons';
import MonthCalendar from '../admin/MonthCalendar';
import { LEAVE_TYPES, applyLeave, dayCount } from '../../data/leave';
import { formatDateKey, toDateKey } from '../../data/attendance';
import { COLORS } from '../../theme';

// Employee: apply for leave. Tap the first day, then the last day on the calendar (one tap
// = a single day), pick the type and write the reason. The admin approves or rejects it.
export default function LeaveRequestModal({ visible, onClose, calendar }) {
  const today = toDateKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [type, setType] = useState('casual');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMonth(today.slice(0, 7));
    setFrom(null);
    setTo(null);
    setType('casual');
    setReason('');
    setError(null);
    setBusy(false);
  }, [visible]);

  // First tap = start; second tap on/after it = end; tapping again starts over.
  const pick = (key) => {
    setError(null);
    if (!from || (from && to) || key < from) {
      setFrom(key);
      setTo(null);
    } else {
      setTo(key);
    }
  };

  const end = to ?? from;
  const submit = async () => {
    setBusy(true);
    const message = await applyLeave({ from, to: end, type, reason });
    setBusy(false);
    if (message) setError(message);
    else onClose(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Apply for leave</Text>
            <Pressable onPress={() => onClose(false)} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={COLORS.text} />
            </Pressable>
          </View>
          <View style={styles.accent} />

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>1. TAP THE FIRST DAY, THEN THE LAST DAY</Text>
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              selected={null}
              rangeFrom={from}
              rangeTo={end}
              minDate={today}
              onSelect={pick}
              calendar={calendar}
            />
            <Text style={styles.summary}>
              {!from
                ? 'No dates selected yet.'
                : `${formatDateKey(from, { day: 'numeric', month: 'short', year: 'numeric' })}${
                    end !== from ? ` – ${formatDateKey(end, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
                  }  ·  ${dayCount(from, end)} day${dayCount(from, end) === 1 ? '' : 's'}`}
            </Text>

            <Text style={[styles.label, { marginTop: 20 }]}>2. LEAVE TYPE</Text>
            <View style={styles.types}>
              {Object.entries(LEAVE_TYPES).map(([key, t]) => {
                const active = type === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setType(key)}
                    style={[styles.type, active && styles.typeActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.typeText, active && styles.typeTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>3. REASON</Text>
            <TextInput
              value={reason}
              onChangeText={(t) => {
                setReason(t);
                setError(null);
              }}
              placeholder="e.g. Family function, fever…"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, { minHeight: 70 }]}
              multiline
              maxLength={300}
              accessibilityLabel="Leave reason"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={() => onClose(false)} style={[styles.button, styles.cancel]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={busy}
              style={[styles.button, styles.submit]}
              accessibilityRole="button"
              accessibilityLabel="Send leave request"
            >
              {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Send request</Text>}
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
  sheet: { width: '100%', maxWidth: 560, maxHeight: '94%', backgroundColor: COLORS.white, borderRadius: 4, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  accent: { height: 4, backgroundColor: COLORS.orange, width: '66%' },
  content: { padding: 20 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 10 },
  summary: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 10 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.pageBg,
  },
  typeActive: { backgroundColor: '#6B46C1', borderColor: '#6B46C1' },
  typeText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  typeTextActive: { color: COLORS.white },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    textAlignVertical: 'top',
    minWidth: 0,
  },
  error: { color: COLORS.danger, fontSize: 14, marginTop: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: { minWidth: 110, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: COLORS.chipBg },
  cancelText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  submit: { backgroundColor: COLORS.orange },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
