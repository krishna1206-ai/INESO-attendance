import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ConfirmModal from '../ConfirmModal';
import { STATUS, STATUS_ORDER, adminSaveAttendance, formatDateKey } from '../../data/attendance';
import { COLORS } from '../../theme';

// Admin: add or fix one employee's attendance for a day (forgot to punch, phone died...).
// `target` = { employee, date, record } or null when closed. The day is then marked
// "Edited by admin" with the reason.
export default function CorrectionModal({ target, onClose }) {
  const [status, setStatus] = useState('present');
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!target) return;
    const r = target.record;
    setStatus(r?.status ?? 'present');
    setInTime(r?.inTime ?? '');
    setOutTime(r?.outTime ?? '');
    setReason('');
  }, [target]);

  const timed = STATUS[status]?.needsTime;
  const day = target ? formatDateKey(target.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <ConfirmModal
      visible={target !== null}
      title={target?.record ? 'Correct attendance' : 'Add attendance'}
      message={target ? `${target.employee.name} · ${day}` : ''}
      confirmLabel="Save correction"
      tone="primary"
      onCancel={onClose}
      onConfirm={async () => {
        const message = await adminSaveAttendance(target.employee.id, target.date, { status, inTime, outTime, reason });
        if (message) return message;
        onClose();
      }}
    >
      <View style={styles.body}>
        <Text style={styles.label}>STATUS</Text>
        <View style={styles.chips}>
          {STATUS_ORDER.map((k) => {
            const active = status === k;
            return (
              <Pressable
                key={k}
                onPress={() => setStatus(k)}
                style={[styles.chip, active && { backgroundColor: STATUS[k].color, borderColor: STATUS[k].color }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.chipText, active && { color: COLORS.white }]}>{STATUS[k].label}</Text>
              </Pressable>
            );
          })}
        </View>

        {timed ? (
          <View style={styles.times}>
            <View style={styles.timeField}>
              <Text style={styles.label}>IN TIME</Text>
              <TextInput
                value={inTime}
                onChangeText={setInTime}
                placeholder="09:00"
                placeholderTextColor={COLORS.muted}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                accessibilityLabel="In time"
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>OUT TIME</Text>
              <TextInput
                value={outTime}
                onChangeText={setOutTime}
                placeholder="Empty = still working"
                placeholderTextColor={COLORS.muted}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                accessibilityLabel="Out time"
              />
            </View>
          </View>
        ) : null}
        {timed ? (
          <Text style={styles.hint}>24-hour format, e.g. 09:05 and 18:30. Late and overtime are worked out from the shift.</Text>
        ) : null}

        <Text style={[styles.label, { marginTop: 14 }]}>REASON (SHOWN WITH THE DAY)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Forgot to punch out, phone battery died"
          placeholderTextColor={COLORS.muted}
          maxLength={200}
          multiline
          style={[styles.input, styles.reason]}
          accessibilityLabel="Reason for correction"
        />
      </View>
    </ConfirmModal>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 4 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  times: { flexDirection: 'row', gap: 12, marginTop: 14 },
  timeField: { flex: 1, minWidth: 0 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minWidth: 0,
  },
  reason: { minHeight: 64, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: COLORS.body, marginTop: 6 },
});
