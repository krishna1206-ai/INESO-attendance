import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  STATUS,
  EMPLOYEE_STATUS_ORDER,
  clearAttendance,
  entryLocations,
  formatDuration,
  isEditableDate,
  isOvernight,
  punchIn,
  punchOut,
  saveAttendance,
  workedMinutes,
} from '../../data/attendance';
import { getCurrentLocation } from '../../data/geo';
import { COLORS } from '../../theme';
import LateBadge from '../admin/LateBadge';
import OvertimeBadge from '../admin/OvertimeBadge';

const clock = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// The employee's entry for today: status, Punch In / Punch Out (time taken from the clock,
// never typed), remark. Absent / Leave / Holiday are saved with the Save button instead.
export default function AttendanceEntry({ employeeId, date, record }) {
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // null | 'locating' | 'saving'
  const [justSaved, setJustSaved] = useState(null); // message shown after a successful action
  const [now, setNow] = useState(new Date());

  // Load the saved entry whenever the day (or the saved entry) changes.
  useEffect(() => {
    setStatus(record?.status ?? '');
    setRemark(record?.remark ?? '');
    setError(null);
  }, [date, record?.updatedAt]);

  // "✓ Saved" belongs to the day it was saved on.
  useEffect(() => {
    setJustSaved(null);
  }, [date]);

  // Live clock shown on the punch button.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Past days are read-only (future days can't be reached from the day picker).
  if (!isEditableDate(date)) return <LockedDay record={record} />;

  const info = STATUS[status];
  const punchedIn = Boolean(record?.inTime);
  const punchedOut = Boolean(record?.outTime);
  const lastLocation = entryLocations(record).last;
  const minutes = punchedIn && punchedOut ? workedMinutes(record.inTime, record.outTime) : null;

  const dirty = status !== (record?.status ?? '') || remark !== (record?.remark ?? '');
  // The Save button is for Absent / Leave / Holiday, and for changing the remark or switching
  // between Present / Half Day after punching in.
  const showSave = status && (!info?.needsTime || punchedIn);

  const touch = () => {
    setError(null);
    setJustSaved(null);
  };

  // Every action reads the location first. It is required for Present / Half Day punches;
  // for Absent / Leave / Holiday it is recorded when available but never blocks the save.
  const run = async (action, successText, locationRequired) => {
    touch();
    setBusy('locating');
    const { location, error: locationError } = await getCurrentLocation();
    if (!location && locationRequired) {
      setBusy(null);
      setError(locationError);
      return;
    }
    setBusy('saving');
    const message = await action(location);
    setBusy(null);
    if (message) setError(message);
    else setJustSaved(successText);
  };

  const handlePunchIn = () =>
    run((location) => punchIn(employeeId, { status, remark, location }), 'Punched in', true);
  const handlePunchOut = () =>
    run((location) => punchOut(employeeId, { remark, location }), 'Punched out', true);
  const handleSave = () =>
    run(
      (location) => saveAttendance(employeeId, date, { status, remark, location }),
      'Saved',
      Boolean(info?.needsTime)
    );

  const handleClear = async () => {
    setBusy('saving');
    const message = await clearAttendance(employeeId, date);
    setBusy(null);
    if (message) setError(message);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>STATUS</Text>
      <View style={styles.statuses}>
        {EMPLOYEE_STATUS_ORDER.map((key) => {
          const s = STATUS[key];
          const active = status === key;
          // Once punched in, the day can only be Present or Half Day.
          const locked = punchedIn && !s.needsTime;
          return (
            <Pressable
              key={key}
              disabled={locked}
              onPress={() => {
                setStatus(key);
                touch();
              }}
              style={[
                styles.status,
                { borderColor: active ? s.color : COLORS.border, backgroundColor: active ? s.color : s.bg },
                locked && styles.statusLocked,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: locked }}
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
          {/* Punched times (read-only) */}
          <View style={styles.times}>
            <TimeBox label="IN TIME" icon="clock-in" value={record?.inTime} />
            <TimeBox label="OUT TIME" icon="clock-out" value={record?.outTime} />
          </View>
          {record?.lateMinutes > 0 || record?.overtimeMinutes > 0 ? (
            <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <LateBadge minutes={record.lateMinutes} />
              <OvertimeBadge minutes={record.overtimeMinutes} />
            </View>
          ) : null}

          {!punchedIn ? (
            <PunchButton
              label="Punch In"
              icon="login"
              color="#1E7B4A"
              now={now}
              busy={busy}
              onPress={handlePunchIn}
            />
          ) : !punchedOut ? (
            <PunchButton
              label="Punch Out"
              icon="logout"
              color={COLORS.orange}
              now={now}
              busy={busy}
              onPress={handlePunchOut}
            />
          ) : (
            <>
              <View style={styles.doneBox}>
                <MaterialCommunityIcons name="check-decagram" size={20} color="#1E7B4A" />
                <Text style={styles.doneText}>
                  Day complete · Worked {formatDuration(minutes)}
                  {isOvernight(record.inTime, record.outTime) ? ' (out next day)' : ''}
                </Text>
              </View>
            </>
          )}

          <View style={styles.locationNote}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={COLORS.body} />
            <Text style={styles.locationNoteText}>
              The time is taken from the clock when you tap, and your location is recorded. Times
              can't be typed or changed.
            </Text>
          </View>
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

      <View style={styles.footer}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.savedText}>
            {busy === 'locating'
              ? 'Getting your location…'
              : justSaved
                ? `✓ ${justSaved}`
                : record
                  ? `Last saved ${new Date(record.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Not filled yet'}
          </Text>
          {busy !== 'locating' && lastLocation ? (
            <Text style={styles.locationSaved}>
              📍 Location recorded
              {lastLocation.accuracy != null ? ` (±${lastLocation.accuracy} m)` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.buttons}>
          {record && !punchedIn ? (
            <Pressable onPress={handleClear} disabled={Boolean(busy)} style={[styles.button, styles.clear]}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
          {showSave ? (
            <Pressable
              onPress={handleSave}
              disabled={Boolean(busy) || !dirty}
              style={[styles.button, styles.save, !dirty && styles.saveDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Save attendance"
            >
              {busy && !info?.needsTime ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveText}>{record ? 'Update' : 'Save'}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function TimeBox({ label, icon, value }) {
  return (
    <View style={styles.timeField}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.timeBox, value && styles.timeBoxFilled]}>
        <MaterialCommunityIcons name={icon} size={20} color={value ? COLORS.navy : COLORS.muted} />
        <Text style={[styles.timeValue, !value && styles.timeEmpty]}>{value || '--:--'}</Text>
      </View>
    </View>
  );
}

function PunchButton({ label, icon, color, now, busy, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={Boolean(busy)}
      style={({ pressed }) => [
        styles.punch,
        { backgroundColor: color },
        (pressed || busy) && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <>
          <ActivityIndicator color={COLORS.white} />
          <Text style={styles.punchText}>{busy === 'locating' ? 'Getting location…' : 'Saving…'}</Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons name={icon} size={24} color={COLORS.white} />
          <Text style={styles.punchText}>{label}</Text>
          <View style={styles.punchClock}>
            <Text style={styles.punchClockText}>{clock(now)}</Text>
          </View>
        </>
      )}
    </Pressable>
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
          {record.lateMinutes > 0 || record.overtimeMinutes > 0 ? (
            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <LateBadge minutes={record.lateMinutes} />
              <OvertimeBadge minutes={record.overtimeMinutes} />
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

  statusLocked: { opacity: 0.35 },

  times: { flexDirection: 'row', gap: 12, marginTop: 20 },
  timeField: { flex: 1, minWidth: 0 },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 4,
    backgroundColor: COLORS.pageBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeBoxFilled: { borderStyle: 'solid', backgroundColor: COLORS.white },
  timeValue: { fontSize: 22, fontWeight: '700', color: COLORS.text, letterSpacing: 1 },
  timeEmpty: { color: COLORS.muted },

  punch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
    minHeight: 60,
  },
  punchText: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  punchClock: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  punchClockText: { color: COLORS.white, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3F4EA',
    borderRadius: 4,
    padding: 14,
    marginTop: 16,
  },
  doneText: { color: '#1E7B4A', fontSize: 15, fontWeight: '700', flexShrink: 1 },

  hint: { fontSize: 13, color: COLORS.body, marginTop: 10 },
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
