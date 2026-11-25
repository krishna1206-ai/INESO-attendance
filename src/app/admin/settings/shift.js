import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PageBody } from '../../../components/Screen';
import { Button, PageTitle } from '../../../components/admin/ui';
import SettingsTabs from '../../../components/admin/SettingsTabs';
import { saveShift, useCalendar } from '../../../data/calendar';
import { COLORS } from '../../../theme';

// /admin/settings/shift — company shift timing. Employees who punch in (as Present) after
// shift start + grace are marked Late by the server, with the minutes they were late.
export default function ShiftSettings() {
  const { calendar, loading } = useCalendar();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [grace, setGrace] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const { shift } = calendar;
  useEffect(() => {
    setStart(shift.start);
    setEnd(shift.end);
    setGrace(String(shift.grace));
  }, [shift.start, shift.end, shift.grace]);

  const touch = () => {
    setError(null);
    setSaved(false);
  };
  const save = async () => {
    setBusy(true);
    const message = await saveShift({ start, end, grace });
    setBusy(false);
    if (message) setError(message);
    else setSaved(true);
  };

  // "Late after 09:10" preview.
  const lateAfter = (() => {
    const m = start.match(/^(\d{1,2}):(\d{2})$/);
    const g = Number(grace);
    if (!m || !Number.isFinite(g)) return null;
    const total = Number(m[1]) * 60 + Number(m[2]) + g;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  })();

  return (
    <PageBody>
      <PageTitle label="SETTINGS" title="Shift timing" subtitle="When the working day starts, and when someone counts as Late." />
      <SettingsTabs />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name="clock-time-nine-outline" size={24} color={COLORS.white} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.cardTitle}>Company shift</Text>
            <Text style={styles.cardText}>
              An employee who punches in as Present after the shift start plus the grace minutes is marked
              Late, with how many minutes late. It is worked out at the moment they punch in, so changing the
              shift later doesn't change past days. Half Day isn't marked Late.
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.navy} />
        ) : (
          <>
            <View style={styles.fields}>
              <Field label="SHIFT START">
                <TextInput
                  value={start}
                  onChangeText={(t) => { setStart(t); touch(); }}
                  placeholder="09:00"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Shift start"
                />
              </Field>
              <Field label="SHIFT END">
                <TextInput
                  value={end}
                  onChangeText={(t) => { setEnd(t); touch(); }}
                  placeholder="18:00"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Shift end"
                />
              </Field>
              <Field label="GRACE (MINUTES)">
                <TextInput
                  value={grace}
                  onChangeText={(t) => { setGrace(t); touch(); }}
                  placeholder="10"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  maxLength={3}
                  keyboardType="number-pad"
                  accessibilityLabel="Grace minutes"
                />
              </Field>
            </View>
            <Text style={styles.hint}>
              24-hour format, e.g. 09:00 and 18:00.
              {lateAfter ? ` Punching in after ${lateAfter} will be marked Late.` : ''}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.footer}>
              <Text style={styles.savedText}>{saved ? '✓ Saved' : `Current: ${shift.start} – ${shift.end}, ${shift.grace} min grace`}</Text>
              <Button label="Save" onPress={save} busy={busy} accessibilityLabel="Save shift timing" />
            </View>
          </>
        )}
      </View>
    </PageBody>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 24,
    maxWidth: 720,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHead: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  cardText: { fontSize: 14, color: COLORS.body, marginTop: 4, lineHeight: 20 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { flexGrow: 1, flexBasis: 140, minWidth: 0 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minWidth: 0,
  },
  hint: { fontSize: 13, color: COLORS.body, marginTop: 10 },
  error: { color: COLORS.danger, fontSize: 14, marginTop: 10 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  savedText: { fontSize: 13, color: COLORS.body, flexShrink: 1 },
});
