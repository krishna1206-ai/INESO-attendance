import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { PageBody } from '../../../components/Screen';
import { Button, PageTitle } from '../../../components/admin/ui';
import SettingsTabs from '../../../components/admin/SettingsTabs';
import { DEFAULT_RADIUS, saveOffice, useOffice } from '../../../data/settings';
import { getCurrentLocation, mapUrl } from '../../../data/geo';
import { COLORS } from '../../../theme';

// /admin/settings — the office location used to check where attendance was filled in.
export default function AdminSettings() {
  const { office, loading } = useOffice();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS));
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!office) return;
    setName(office.name);
    setLatitude(String(office.latitude));
    setLongitude(String(office.longitude));
    setRadius(String(office.radius));
  }, [office?.updatedAt]);

  const touch = () => {
    setError(null);
    setSaved(false);
  };

  const useCurrent = async () => {
    touch();
    setLocating(true);
    const { location, error: e } = await getCurrentLocation();
    setLocating(false);
    if (e) return setError(e);
    setLatitude(location.latitude.toFixed(6));
    setLongitude(location.longitude.toFixed(6));
  };

  const handleSave = async () => {
    setSaving(true);
    const message = await saveOffice({ name, latitude, longitude, radius });
    setSaving(false);
    if (message) setError(message);
    else setSaved(true);
  };

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = latitude !== '' && longitude !== '' && Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <PageBody>
      <PageTitle label="SETTINGS" title="Office location" />
      <SettingsTabs />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color={COLORS.white} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.cardTitle}>Office location</Text>
            <Text style={styles.cardText}>
              Attendance filled in within this distance of the office shows as “At office”. Anything
              farther shows as “Outside office” on the Attendance page.
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.navy} />
        ) : (
          <>
            <Field label="OFFICE NAME">
              <TextInput
                value={name}
                onChangeText={(t) => { setName(t); touch(); }}
                placeholder="e.g. Dahej Plant"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                accessibilityLabel="Office name"
              />
            </Field>

            <View style={styles.useRow}>
              <Button
                label={locating ? 'Getting location…' : 'Use my current location'}
                icon="crosshair"
                variant="outline"
                busy={locating}
                onPress={useCurrent}
              />
              <Text style={styles.hint}>Stand inside the office and tap this, or type the coordinates.</Text>
            </View>

            <View style={styles.twoCols}>
              <Field label="LATITUDE" style={styles.col}>
                <TextInput
                  value={latitude}
                  onChangeText={(t) => { setLatitude(t); touch(); }}
                  placeholder="21.7051"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Latitude"
                />
              </Field>
              <Field label="LONGITUDE" style={styles.col}>
                <TextInput
                  value={longitude}
                  onChangeText={(t) => { setLongitude(t); touch(); }}
                  placeholder="72.5814"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Longitude"
                />
              </Field>
            </View>

            <Field label="ALLOWED DISTANCE (METRES)">
              <TextInput
                value={radius}
                onChangeText={(t) => { setRadius(t); touch(); }}
                placeholder={String(DEFAULT_RADIUS)}
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { maxWidth: 200 }]}
                keyboardType="number-pad"
                accessibilityLabel="Allowed distance in metres"
              />
              <Text style={styles.hint}>Cover the whole site. Large plants may need 500 m or more.</Text>
            </Field>

            {hasCoords ? (
              <Pressable
                onPress={() => Linking.openURL(mapUrl({ latitude: lat, longitude: lng }))}
                style={styles.mapLink}
                accessibilityRole="link"
              >
                <Feather name="map-pin" size={14} color={COLORS.blue} />
                <Text style={styles.mapText}>Check this point on the map</Text>
              </Pressable>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.savedText}>
                {saved
                  ? '✓ Saved'
                  : office
                    ? `Last saved ${new Date(office.updatedAt).toLocaleString()}`
                    : 'Not set yet'}
              </Text>
              <Button label="Save" onPress={handleSave} busy={saving} accessibilityLabel="Save office location" />
            </View>
          </>
        )}
      </View>

    </PageBody>
  );
}

function Field({ label, children, style }) {
  return (
    <View style={[styles.field, style]}>
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
  field: { marginBottom: 18 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minWidth: 0,
  },
  useRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  hint: { fontSize: 13, color: COLORS.body, marginTop: 6, flexShrink: 1 },
  twoCols: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  col: { flexGrow: 1, flexBasis: 160, minWidth: 0 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, alignSelf: 'flex-start' },
  mapText: { color: COLORS.blue, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 14, flexShrink: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  savedText: { fontSize: 13, color: COLORS.body },
});
