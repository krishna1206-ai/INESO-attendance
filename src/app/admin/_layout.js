import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Slot, router, usePathname } from 'expo-router';
import { AppHeader, UserMenu } from '../../components/Screen';
import { useSession } from '../../data/session';
import { setMode } from '../../lib/supabase';
import { COLORS, WIDE_BREAKPOINT } from '../../theme';

// `short` is used on the phone tab bar, where five tabs share the width.
const NAV = [
  { href: '/admin', label: 'Dashboard', short: 'Home', icon: 'view-dashboard-outline', match: (p) => p === '/admin' },
  {
    href: '/admin/attendance',
    label: 'Attendance',
    short: 'Daily',
    icon: 'calendar-check-outline',
    match: (p) => p.startsWith('/admin/attendance'),
  },
  {
    href: '/admin/history',
    label: 'History',
    short: 'History',
    icon: 'history',
    match: (p) => p.startsWith('/admin/history'),
  },
  {
    href: '/admin/departments',
    label: 'Departments',
    short: 'Depts',
    icon: 'office-building-outline',
    match: (p) => p.startsWith('/admin/department'),
  },
  {
    href: '/admin/employees',
    label: 'Employees',
    short: 'Staff',
    icon: 'account-group-outline',
    match: (p) => p.startsWith('/admin/employees'),
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    short: 'Settings',
    icon: 'cog-outline',
    match: (p) => p.startsWith('/admin/settings'),
  },
];

// Admin shell: header + sidebar (wide screens) or tab bar (phones) around every /admin page.
// Only signed-in admins get in; everyone else is sent to /login (employees to their own page).
export default function AdminLayout() {
  setMode('admin'); // native apps: admin pages use the admin sign-in
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const pathname = usePathname();
  const { employee: account, role, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.white} />
      </View>
    );
  }
  if (!account) return <Redirect href="/admin-login" />;
  if (role !== 'admin') return <Redirect href="/admin-login" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader badge="ADMIN" fullWidth={isWide} right={<UserMenu name={account.name} />} />
      <View style={[styles.body, isWide && styles.bodyWide]}>
        {isWide ? (
          <View style={styles.sidebar}>
            <Text style={styles.sidebarHeading}>ADMIN PANEL</Text>
            {NAV.map((item) => (
              <SidebarItem key={item.href} item={item} active={item.match(pathname)} />
            ))}
          </View>
        ) : (
          // Phones: three equal tabs that always fit (icon above label), no sideways scrolling.
          <View style={styles.tabBar}>
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Pressable
                  key={item.href}
                  onPress={() => router.navigate(item.href)}
                  style={[styles.tab, active && styles.tabActive]}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={active ? COLORS.orange : COLORS.body}
                  />
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                    numberOfLines={1}
                  >
                    {item.short}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SidebarItem({ item, active }) {
  return (
    <Pressable
      onPress={() => router.navigate(item.href)}
      style={({ hovered, pressed }) => [
        styles.navItem,
        (hovered || pressed) && !active && styles.navItemHover,
        active && styles.navItemActive,
      ]}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
    >
      {active ? <View style={styles.navMarker} /> : null}
      <MaterialCommunityIcons
        name={item.icon}
        size={20}
        color={active ? COLORS.white : '#C9D2E3'}
      />
      <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
    </Pressable>
  );
}

const SIDEBAR_WIDTH = 248;

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy },
  safe: { flex: 1, backgroundColor: COLORS.navy },
  body: { flex: 1, backgroundColor: COLORS.pageBg },
  bodyWide: { flexDirection: 'row' },
  content: { flex: 1 },

  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.navy,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.navyLine,
  },
  sidebarHeading: {
    color: '#8A9BC0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  navItemHover: { backgroundColor: COLORS.navyLine },
  navItemActive: { backgroundColor: COLORS.navyLine },
  navMarker: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.orange,
  },
  navText: { color: '#C9D2E3', fontSize: 15, fontWeight: '600' },
  navTextActive: { color: COLORS.white },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.orange },
  tabText: { fontSize: 11, fontWeight: '600', color: COLORS.body },
  tabTextActive: { color: COLORS.navy, fontWeight: '700' },
});
