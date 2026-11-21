import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  STATUS,
  STATUS_ORDER,
  clearAttendance,
  entryLocations,
  formatDuration,
  isEditableDate,
  isOvernight,
  parseTime,
  saveAttendance,
  workedMinutes,
} from '../../data/attendance';
import { getCurrentLocation } from '../../data/geo';
import { COLORS } from '../../theme';

// The employee's entry for one day: status, In/Out time (typed, 24-hour), remark, Save.
export default function AttendanceEntry({ employeeId, date, record }) {
  const [status, setStatus] = useState('');
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [locating, setLocating] = useState(false);

  // Load the saved entry whenever the day (or the saved entry) changes.
  useEffect(() => {
    setStatus(record?.status ?? '');
    setInTime(record?.inTime ?? '');
    setOutTime(record?.outTime ?? '');
    setRemark(record?.remark ?? '');
    setError(null);
  }, [date, record?.updatedAt]);

  // "✓ Saved" belongs to the day it was saved on. (Not reset on updatedAt changes, or our
  // own save would immediately clear it.)
  useEffect(() => {
    setJustSaved(false);
  }, [date]);

  // Past days are read-only (future days can't be reached from the day picker).
  if (!isEditableDate(date)) return <LockedDay record={record} />;

  const info = STATUS[status];
  const lastLocation = entryLocations(record).last;
  const parsedIn = parseTime(inTime);
  const parsedOut = parseTime(outTime);
  const minutes = info?.needsTime && parsedIn && parsedOut && parsedIn !== parsedOut
    ? workedMinutes(parsedIn, parsedOut)
    : null;

  const dirty =
    status !== (record?.status ?? '') ||
    (info?.needsTime && (inTime !== (record?.inTime ?? '') || outTime !== (record?.outTime ?? ''))) ||
    remark !== (record?.remark ?? '');

  const touch = () => {
    setError(null);
    setJustSaved(false);
  };

  // Location is captured automatically on every save. It is required for Present / Half Day;
  // for Absent / Leave / Holiday it is recorded when available but never blocks the save.
  const handleSave = async () => {
    setError(null);
    setSaving(true);
    setLocating(true);
    const { location, error: locationError } = await getCurrentLocation();
    setLocating(false);
    if (!location && info?.needsTime) {
      setSaving(false);
      setError(locationError);
      return;
    }
    const message = await saveAttendance(employeeId, date, { status, inTime, outTime, remark, location });
    setSaving(false);
    if (message) setError(message);
    else setJustSaved(true);
  };

  const handleClear = async () => {
    setSaving(true);
    const message = await clearAttendance(employeeId, date);
    setSaving(false);
    if (message) setError(message);
  };

  // Tidy "905" into "09:05" when the field loses focus.
  const tidy = (value, set) => {
    const p = parseTime(value);
    if (p) set(p);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>STATUS</Text>
      <View style={styles.statuses}>
        {STATUS_ORDER.map((key) => {
          const s = STATUS[key];
          const active = status === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setStatus(key);
                touch();
              }}
              style={[
                styles.status,
                { borderColor: active ? s.color : COLORS.border, backgroundColor: active ? s.color : s.bg },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Status ${s.label}`}
            >
              <MaterialCommunityIcons name={s.icon} size={18} color={active ? COLORS.white : s.color} />
              <Text style={[styles.statusText, { color: active ? COLORS.white : s.color }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {info?.needsTime ? (
        <>
          <View style={styles.times}>
            <TimeField
              label="IN TIME"
              icon="clock-in"
              value={inTime}
              onChange={(t) => {
                setInTime(t);
                touch();
              }}
              onBlur={() => tidy(inTime, setInTime)}
              placeholder="09:00"
            />
            <TimeField
              label="OUT TIME"
              icon="clock-out"
              value={outTime}
              onChange={(t) => {
                setOutTime(t);
                touch();
              }}
              onBlur={() => tidy(outTime, setOutTime)}
              placeholder="18:00"
            />
          </View>
          <Text style={styles.hint}>
            24-hour format, e.g. 09:00 and 18:30. Save your In time on arrival and add the Out time
            before you leave today.
            {minutes != null ? (
              <Text style={styles.hours}>
                {'  '}Worked: {formatDuration(minutes)}
                {isOvernight(parsedIn, parsedOut) ? ' (out next day)' : ''}
              </Text>
            ) : null}
          </Text>
        </>
      ) : null}

      {status ? (
        <>
          <Text style={[styles.label, { marginTop: 20 }]}>
            REMARK {status === 'leave' ? '(reason for leave)' : '(optional)'}
          </Text>
          <TextInput
            value={remark}
            onChangeText={(t) => {
              setRemark(t);
              touch();
            }}
            placeholder={status === 'leave' ? 'e.g. Sick leave' : 'Anything to note for this day'}
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            maxLength={200}
            accessibilityLabel="Remark"
          />
        </>
      ) : (
        <Text style={styles.hint}>Select your status for this day.</Text>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={16} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {info?.needsTime ? (
        <View style={styles.locationNote}>
          <MaterialCommunityIcons name="map-marker-outline" size={16} color={COLORS.body} />
          <Text style={styles.locationNoteText}>
            Your location is recorded automatically when you save.
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.savedText}>
            {locating
              ? 'Getting your location…'
              : justSaved
                ? '✓ Saved'
                : record
                  ? `Last saved ${new Date(record.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Not filled yet'}
          </Text>
          {!locating && lastLocation ? (
            <Text style={styles.locationSaved}>
              📍 Location recorded
              {lastLocation.accuracy != null ? ` (±${lastLocation.accuracy} m)` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.buttons}>
          {record ? (
            <Pressable onPress={handleClear} disabled={saving} style={[styles.button, styles.clear]}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleSave}
            disabled={saving || !status || !dirty}
            style={[styles.button, styles.save, (!status || !dirty) && styles.saveDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Save attendance"
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveText}>{record ? 'Update' : 'Save'}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Read-only view of a past day.
function LockedDay({ record }) {
  const s = record ? STATUS[record.status] : null;
  const mins = record ? workedMinutes(record.inTime, record.outTime) : null;
  return (
    <View style={styles.card}>
      <View style={styles.lockNote}>
        <Feather name="lock" size={14} color={COLORS.body} />
        <Text style={styles.lockText}>Past days are locked and can't be changed.</Text>
      </View>

      {!record ? (
        <Text style={styles.lockedEmpty}>No attendance was filled in for this day.</Text>
      ) : (
        <>
          <View style={[styles.lockedStatus, { backgroundColor: s?.bg ?? COLORS.chipBg }]}>
            {s ? <MaterialCommunityIcons name={s.icon} size={18} color={s.color} /> : null}
            <Text style={[styles.statusText, { color: s?.color ?? COLORS.text }]}>{s?.label ?? record.status}</Text>
          </View>

          {record.inTime ? (
            <View style={styles.lockedTimes}>
              <LockedValue label="IN TIME" value={record.inTime} />
              <LockedValue label="OUT TIME" value={record.outTime || 'Not entered'} />
              {mins != null ? (
                <LockedValue
                  label="WORKED"
                  value={`${formatDuration(mins)}${isOvernight(record.inTime, record.outTime) ? ' (next day)' : ''}`}
                />
              ) : null}
            </View>
          ) : null}

          {record.remark ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>REMARK</Text>
              <Text style={styles.lockedRemark}>{record.remark}</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function LockedValue({ label, value }) {
  return (
    <View style={styles.lockedValue}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.lockedValueText}>{value}</Text>
    </View>
  );
}

function TimeField({ label, icon, value, onChange, onBlur, placeholder }) {
  return (
    <View style={styles.timeField}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeInputRow}>
        <MaterialCommunityIcons name={icon} size={20} color={COLORS.navy} style={{ marginLeft: 12 }} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          style={styles.timeInput}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          accessibilityLabel={label === 'IN TIME' ? 'In time' : 'Out time'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 10 },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.pageBg,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  lockText: { fontSize: 13, color: COLORS.body },
  lockedEmpty: { fontSize: 15, color: COLORS.body },
  lockedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  lockedTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginTop: 20 },
  lockedValue: { minWidth: 90 },
  lockedValueText: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: -4 },
  lockedRemark: { fontSize: 15, color: COLORS.text, marginTop: -4 },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 44,
  },
  statusText: { fontSize: 14, fontWeight: '700' },

  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 20 },
  // minWidth 0 lets the fields shrink below a web <input>'s default width on narrow phones.
  timeField: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 1,
  },
  hint: { fontSize: 13, color: COLORS.body, marginTop: 10 },
  hours: { color: COLORS.text, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 4,
    padding: 12,
    marginTop: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 14, flexShrink: 1 },
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
  savedText: { fontSize: 13, color: COLORS.body },
  locationSaved: { fontSize: 12, color: COLORS.body, marginTop: 2 },
  locationNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  locationNoteText: { fontSize: 13, color: COLORS.body, flexShrink: 1 },
  buttons: { flexDirection: 'row', gap: 10 },
  button: {
    minWidth: 100,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  save: { backgroundColor: COLORS.orange },
  saveDisabled: { opacity: 0.45 },
  saveText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  clear: { backgroundColor: COLORS.chipBg },
  clearText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
});
