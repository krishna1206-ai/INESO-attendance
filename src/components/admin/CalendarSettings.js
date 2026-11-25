import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from './ui';
import ConfirmModal from '../ConfirmModal';
import MonthCalendar from './MonthCalendar';
import {
  WEEKDAYS,
  addHoliday,
  deleteHoliday,
  saveWeeklyOffs,
  useCalendar,
} from '../../data/calendar';
import { formatDateKey, toDateKey } from '../../data/attendance';
import { COLORS } from '../../theme';

// Admin → Settings: weekly offs and company holidays. These days don't count as "Not filled"
// in reports, and employees don't mark them themselves.
export default function CalendarSettings() {
  const { calendar, loading } = useCalendar();
  if (loading) return <ActivityIndicator color={COLORS.navy} style={{ marginTop: 24 }} />;
  return (
    <>
      <WeeklyOffsCard saved={calendar.weeklyOffs} />
      <HolidaysCard calendar={calendar} />
    </>
  );
}

function CardHead({ icon, title, text }) {
  return (
    <View style={styles.cardHead}>
      <View style={styles.icon}>
        <MaterialCommunityIcons name={icon} size={24} color={COLORS.white} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardText}>{text}</Text>
      </View>
    </View>
  );
}

function WeeklyOffsCard({ saved }) {
  const [days, setDays] = useState(saved);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDays(saved), [saved.join(',')]);

  const dirty = [...days].sort().join(',') !== [...saved].sort().join(',');
  const toggle = (day) => {
    setError(null);
    setDone(false);
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  };
  const save = async () => {
    setBusy(true);
    const message = await saveWeeklyOffs(days);
    setBusy(false);
    if (message) setError(message);
    else setDone(true);
  };

  return (
    <View style={styles.card}>
      <CardHead
        icon="calendar-weekend-outline"
        title="Weekly off"
        text="Days of the week the company is closed. They don't count as “Not filled” in reports."
      />
      <View style={styles.days}>
        {WEEKDAYS.map((w) => {
          const off = days.includes(w.day);
          return (
            <Pressable
              key={w.day}
              onPress={() => toggle(w.day)}
              style={[styles.day, off && styles.dayOff]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: off }}
              accessibilityLabel={`${w.label} weekly off`}
            >
              {off ? <Feather name="check" size={14} color={COLORS.white} /> : null}
              <Text style={[styles.dayText, off && styles.dayTextOff]}>{w.short}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.savedText}>
          {done
            ? '✓ Saved'
            : days.length === 0
              ? 'No weekly off: every day is a working day.'
              : `Off: ${WEEKDAYS.filter((w) => days.includes(w.day)).map((w) => w.label).join(', ')}`}
        </Text>
        <Button label="Save" onPress={save} busy={busy} accessibilityLabel="Save weekly off" />
      </View>
      {!dirty ? null : <Text style={styles.unsaved}>Unsaved change — tap Save.</Text>}
    </View>
  );
}

function HolidaysCard({ calendar }) {
  const { holidays } = calendar;
  const [viewMonth, setViewMonth] = useState(toDateKey().slice(0, 7));
  const [date, setDate] = useState(null); // 'YYYY-MM-DD' picked on the calendar
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [showPast, setShowPast] = useState(false);

  const today = toDateKey();
  const upcoming = holidays.filter((h) => h.date >= today);
  const past = holidays.filter((h) => h.date < today).reverse();
  const selectedHoliday = date ? holidays.find((h) => h.date === date) : null;

  const add = async () => {
    if (!date) return setError('Tap a date on the calendar first.');
    setBusy(true);
    const message = await addHoliday({ date, name });
    setBusy(false);
    if (message) setError(message);
    else {
      setName('');
      setError(null);
    }
  };

  const row = (h, i) => (
    <View key={h.id} style={[styles.holiday, i > 0 && styles.holidayBorder]}>
      <View style={styles.holidayDate}>
        <Text style={styles.holidayDay}>{formatDateKey(h.date, { day: 'numeric' })}</Text>
        <Text style={styles.holidayMonth}>{formatDateKey(h.date, { month: 'short' })}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.holidayName}>{h.name}</Text>
        <Text style={styles.holidayWeekday}>
          {formatDateKey(h.date, { weekday: 'long', year: 'numeric' })}
        </Text>
      </View>
      <Pressable
        onPress={() => setToDelete(h)}
        style={styles.delete}
        hitSlop={6}
        accessibilityLabel={`Delete holiday ${h.name}`}
      >
        <Feather name="trash-2" size={15} color={COLORS.danger} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.card}>
      <CardHead
        icon="party-popper"
        title="Company holidays"
        text="Festival and company holidays. They show as Holiday for everyone and don't count as “Not filled”."
      />

      {/* Pick a date on the calendar */}
      <Text style={styles.label}>1. TAP A DATE</Text>
      <MonthCalendar
        month={viewMonth}
        onMonthChange={setViewMonth}
        selected={date}
        onSelect={(key) => {
          setDate(key);
          setError(null);
        }}
        calendar={calendar}
      />
      <Text style={styles.hint}>
        {calendar.weeklyOffs.length > 0
          ? `Every ${WEEKDAYS.filter((w) => calendar.weeklyOffs.includes(w.day)).map((w) => w.label).join(' and ')} is already off (Weekly off above), so you don't need to add those one by one.`
          : 'No weekly off is set.'}
      </Text>

      {/* Selected date: add a holiday, or delete the one already there */}
      {!date ? null : selectedHoliday ? (
        <View style={styles.selectedBox}>
          <MaterialCommunityIcons name="party-popper" size={20} color="#B7791F" />
          <View style={{ flex: 1 }}>
            <Text style={styles.holidayName}>{selectedHoliday.name}</Text>
            <Text style={styles.holidayWeekday}>{formatDateKey(date)}</Text>
          </View>
          <Button
            label="Delete"
            icon="trash-2"
            variant="ghost"
            small
            onPress={() => setToDelete(selectedHoliday)}
            accessibilityLabel={`Delete holiday ${selectedHoliday.name}`}
          />
        </View>
      ) : (
        <>
          <Text style={[styles.label, { marginTop: 16 }]}>2. HOLIDAY NAME FOR {formatDateKey(date).toUpperCase()}</Text>
          <View style={styles.addRow}>
            <View style={styles.nameField}>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                placeholder="e.g. Diwali"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={add}
                autoFocus
                accessibilityLabel="Holiday name"
              />
            </View>
            <View style={styles.addButton}>
              <Button label="Add holiday" icon="plus" onPress={add} busy={busy} accessibilityLabel="Add holiday" />
            </View>
          </View>
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* List */}
      <Text style={[styles.label, { marginTop: 20 }]}>UPCOMING</Text>
      <View style={styles.list}>
        {upcoming.length === 0 ? (
          <Text style={styles.empty}>No upcoming holidays added.</Text>
        ) : (
          upcoming.map(row)
        )}
      </View>

      {past.length > 0 ? (
        <>
          <Pressable onPress={() => setShowPast((v) => !v)} style={styles.pastToggle} hitSlop={6}>
            <Feather name={showPast ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.blue} />
            <Text style={styles.pastToggleText}>
              {showPast ? 'Hide' : 'Show'} past holidays ({past.length})
            </Text>
          </Pressable>
          {showPast ? <View style={styles.list}>{past.map(row)}</View> : null}
        </>
      ) : null}

      <ConfirmModal
        visible={toDelete !== null}
        title="Delete holiday?"
        message={toDelete ? `“${toDelete.name}” on ${formatDateKey(toDelete.date)} will be removed.` : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const message = await deleteHoliday(toDelete.id);
          if (message) return message;
          setToDelete(null);
          return null;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 24,
    maxWidth: 720,
    marginTop: 20,
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
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 },

  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.pageBg,
  },
  dayOff: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  dayText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  dayTextOff: { color: COLORS.white },
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
  unsaved: { fontSize: 13, color: '#9A5B00', marginTop: 8 },
  error: { color: COLORS.danger, fontSize: 14, marginTop: 10 },
  hint: { fontSize: 13, color: COLORS.body, marginTop: 8, lineHeight: 18 },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF5E3',
    borderRadius: 4,
    padding: 12,
    marginTop: 16,
  },

  addRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  dateField: { flexBasis: 150, flexGrow: 0, minWidth: 0 },
  nameField: { flexBasis: 200, flexGrow: 1, minWidth: 0 },
  addButton: { paddingBottom: 1 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minWidth: 0,
  },
  list: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4 },
  empty: { padding: 14, fontSize: 14, color: COLORS.body },
  holiday: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 10 },
  holidayBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  holidayDate: {
    width: 48,
    alignItems: 'center',
    backgroundColor: '#FEF5E3',
    borderRadius: 4,
    paddingVertical: 4,
  },
  holidayDay: { fontSize: 18, fontWeight: '800', color: '#B7791F' },
  holidayMonth: { fontSize: 11, fontWeight: '700', color: '#B7791F', textTransform: 'uppercase' },
  holidayName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  holidayWeekday: { fontSize: 12, color: COLORS.body, marginTop: 2 },
  delete: { padding: 8, borderRadius: 999, backgroundColor: '#FDECEC' },
  pastToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 8, alignSelf: 'flex-start' },
  pastToggleText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
});
