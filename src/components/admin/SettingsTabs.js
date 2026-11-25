import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { COLORS } from '../../theme';

// The two Settings pages. Used by the sidebar's Settings drop-down and by the tabs shown at
// the top of the Settings pages (phones have no hover menu).
export const SETTINGS_PAGES = [
  { href: '/admin/settings', label: 'Office location', icon: 'map-marker-radius-outline' },
  { href: '/admin/settings/holidays', label: 'Holidays', icon: 'party-popper' },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <View style={styles.tabs}>
      {SETTINGS_PAGES.map((p) => {
        const active = pathname === p.href;
        return (
          <Pressable
            key={p.href}
            onPress={() => router.navigate(p.href)}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="link"
            accessibilityState={{ selected: active }}
          >
            <MaterialCommunityIcons name={p.icon} size={16} color={active ? COLORS.white : COLORS.navy} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
  },
  tabActive: { backgroundColor: COLORS.navy },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.navy },
  tabTextActive: { color: COLORS.white },
});
