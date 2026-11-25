import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut, useSession } from '../data/session';
import { COLORS, MAX_CONTENT_WIDTH } from '../theme';

// Navy INEOS header with the orange accent bar. `fullWidth` drops the centred max-width
// (used by the admin dashboard, whose sidebar spans the whole window).
export function AppHeader({ badge, fullWidth, right }) {
  return (
    <View style={styles.header}>
      <StatusBar style="light" />
      <View style={[styles.headerRow, !fullWidth && styles.container]}>
        <View>
          <Text style={styles.logo}>INEOS</Text>
          <Text style={styles.tagline}>Global Chemical Company</Text>
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {right}
      </View>
      <View style={styles.accentRow}>
        <View style={styles.accentOrange} />
        <View style={styles.accentNavy} />
      </View>
    </View>
  );
}

// Scrollable, centred page content with the thin top rule.
export function PageBody({ children, rule = true }) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        {rule ? <View style={styles.topRule} /> : null}
        {children}
      </View>
    </ScrollView>
  );
}

// Full client page: safe area + header (with the signed-in employee and Logout) + body.
export default function Screen({ children }) {
  const { employee } = useSession();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader right={employee ? <UserMenu name={employee.name} /> : null} />
      <PageBody>{children}</PageBody>
    </SafeAreaView>
  );
}

// On phones the name is left out of the header (the page already shows it in large type),
// so the logo and tagline never get crowded.
export function UserMenu({ name }) {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  return (
    <View style={styles.user}>
      {!compact ? (
        <View style={styles.userText}>
          <Text style={styles.userHello}>Signed in as</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {name}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => {
          signOut();
          router.replace('/login');
        }}
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Feather name="log-out" size={15} color={COLORS.white} />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  header: { backgroundColor: COLORS.navy, paddingHorizontal: 20, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: COLORS.white, fontSize: 30, fontWeight: '800', letterSpacing: 2 },
  tagline: { color: '#C9D2E3', fontSize: 13, marginTop: 2, marginBottom: 16 },
  badge: {
    borderWidth: 1,
    borderColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: { color: COLORS.orange, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 1, marginLeft: 12 },
  userText: { alignItems: 'flex-end', flexShrink: 1 },
  userHello: { color: '#8A9BC0', fontSize: 11 },
  userName: { color: COLORS.white, fontSize: 14, fontWeight: '600', maxWidth: 180 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logoutText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  accentRow: { flexDirection: 'row', height: 6, marginHorizontal: -20 },
  accentOrange: { flex: 2, backgroundColor: COLORS.orange },
  accentNavy: { flex: 1, backgroundColor: COLORS.navyLine },

  page: { flex: 1, backgroundColor: COLORS.pageBg },
  pageContent: { padding: 16, paddingBottom: 40 },
  container: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  topRule: { height: 1, backgroundColor: COLORS.border, marginBottom: 24 },
});
