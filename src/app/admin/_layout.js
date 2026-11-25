import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Slot, router, usePathname } from 'expo-router';
import { AppHeader, UserMenu } from '../../components/Screen';
import { useSession } from '../../data/session';
import { useLeaveRequests } from '../../data/leave';
import { setMode } from '../../lib/supabase';
import { COLORS, WIDE_BREAKPOINT } from '../../theme';
import { SETTINGS_PAGES } from '../../components/admin/SettingsTabs';

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
    href: '/admin/leave',
    label: 'Leave',
    short: 'Leave',
    icon: 'airplane-takeoff',
    match: (p) => p.startsWith('/admin/leave'),
    badge: 'pendingLeave', // shows how many requests are waiting
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
    // Sidebar: a drop-down that opens on hover (or tap) with these pages.
    children: SETTINGS_PAGES,
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
  // Pending leave requests, shown as a badge on the Leave menu item.
  const { requests: leaveRequests } = useLeaveRequests();
  const badges = { pendingLeave: leaveRequests.filter((r) => r.status === 'pending').length };

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
            {NAV.map((item) =>
              item.children ? (
                <SidebarGroup key={item.href} item={item} pathname={pathname} />
              ) : (
                <SidebarItem key={item.href} item={item} active={item.match(pathname)} badge={badges[item.badge]} />
              )
            )}
          </View>
        ) : (
          // Phones: equal tabs that always fit (icon above label), no sideways scrolling.
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
                  {badges[item.badge] > 0 ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{badges[item.badge]}</Text>
                    </View>
                  ) : null}
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

// A sidebar entry with sub-pages (Settings → Office location, Holidays). The list opens while
// the mouse is over it, when tapped, and stays open while one of its pages is showing.
function SidebarGroup({ item, pathname }) {
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const active = item.match(pathname);
  const open = hovered || tapped || active;
  return (
    <View onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <SidebarItem
        item={item}
        active={active}
        onPress={() => setTapped((v) => !v)}
        right={
          <MaterialCommunityIcons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={active ? COLORS.white : '#C9D2E3'}
          />
        }
        expanded={open}
      />
      {open ? (
        <View style={styles.subList}>
          {item.children.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Pressable
                key={child.href}
                onPress={() => router.navigate(child.href)}
                style={({ hovered: h }) => [
                  styles.subItem,
                  h && !childActive && styles.navItemHover,
                  childActive && styles.subItemActive,
                ]}
                accessibilityRole="link"
                accessibilityState={{ selected: childActive }}
              >
                <MaterialCommunityIcons
                  name={child.icon}
                  size={17}
                  color={childActive ? COLORS.orange : '#C9D2E3'}
                />
                <Text style={[styles.subText, childActive && styles.navTextActive]}>{child.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function SidebarItem({ item, active, onPress, right, expanded, badge }) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.navigate(item.href))}
      accessibilityState={{ selected: active, expanded }}
      style={({ hovered, pressed }) => [
        styles.navItem,
        (hovered || pressed) && !active && styles.navItemHover,
        active && styles.navItemActive,
      ]}
      accessibilityRole="link"
    >
      {active ? <View style={styles.navMarker} /> : null}
      <MaterialCommunityIcons
        name={item.icon}
        size={20}
        color={active ? COLORS.white : '#C9D2E3'}
      />
      <Text style={[styles.navText, active && styles.navTextActive, { flex: 1 }]}>{item.label}</Text>
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {right}
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
  // Settings drop-down
  subList: { marginLeft: 22, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: COLORS.navyLine, marginBottom: 6 },
  subItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 4, marginBottom: 2 },
  subItemActive: { backgroundColor: COLORS.navyLine },
  subText: { color: '#C9D2E3', fontSize: 14, fontWeight: '600' },

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
  tabText: { fontSize: 10, fontWeight: '600', color: COLORS.body },
  badge: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: COLORS.orange, alignItems: 'center' },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  tabBadge: { position: 'absolute', top: 2, right: '22%', minWidth: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: COLORS.orange, alignItems: 'center' },
  tabBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  tabTextActive: { color: COLORS.navy, fontWeight: '700' },
});
