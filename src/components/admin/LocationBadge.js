import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { classifyLocation, mapUrl } from '../../data/geo';
import { entryLocations, punchLocations } from '../../data/attendance';
import { COLORS } from '../../theme';

const KIND = {
  office: { color: '#1E7B4A', bg: '#E3F4EA', icon: 'office-building-marker-outline' },
  outside: { color: '#C53030', bg: '#FDECEC', icon: 'home-alert-outline' },
  unknown: { color: COLORS.text, bg: COLORS.chipBg, icon: 'map-marker-question-outline' },
  none: { color: COLORS.body, bg: COLORS.chipBg, icon: 'map-marker-off-outline' },
};

// Where an attendance entry was filled in: At office / Outside office · 5.2 km / No location,
// plus a "Map" link and a warning when the device reported a fake (mocked) location.
// `hideWhere` drops the At office / Outside badge when something else already shows it
// (e.g. the punch time is coloured by location), leaving the map link and fake warning.
export default function LocationBadge({ location, office, label, compact, hideWhere }) {
  const where = classifyLocation(location, office);
  const k = KIND[where.kind];
  return (
    <View style={styles.row}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {!hideWhere ? (
        <View style={[styles.badge, { backgroundColor: k.bg }]}>
          <MaterialCommunityIcons name={k.icon} size={14} color={k.color} />
          <Text style={[styles.text, { color: k.color }]} numberOfLines={1}>
            {where.label}
          </Text>
        </View>
      ) : null}
      {location?.mocked ? (
        <View style={[styles.badge, { backgroundColor: '#FFF4E0' }]}>
          <Feather name="alert-triangle" size={13} color="#9A5B00" />
          <Text style={[styles.text, { color: '#9A5B00' }]}>Fake location</Text>
        </View>
      ) : null}
      {location ? (
        <Pressable
          onPress={() => Linking.openURL(mapUrl(location))}
          hitSlop={6}
          style={styles.map}
          accessibilityRole="link"
          accessibilityLabel="Open location on map"
        >
          <Feather name="map-pin" size={13} color={COLORS.blue} />
          {!compact ? <Text style={styles.mapText}>Map</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

// IN / OUT location badges for one attendance entry. For days without punches (Absent,
// Leave, Holiday) it shows the single saved location, if any, without a label.
export function PunchLocations({ record, office, compact }) {
  if (!record) return null;
  if (!record.inTime) {
    const { last } = entryLocations(record);
    return <LocationBadge location={last} office={office} compact={compact} />;
  }
  const p = punchLocations(record);
  return (
    <View style={{ gap: 4 }}>
      <LocationBadge location={p.in} office={office} label="IN" compact={compact} />
      {record.outTime ? (
        <LocationBadge location={p.out} office={office} label="OUT" compact={compact} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.body, letterSpacing: 0.3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '100%',
  },
  text: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  map: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mapText: { color: COLORS.blue, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
