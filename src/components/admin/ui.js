import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme';

// Small building blocks shared by the admin dashboard pages.

export function PageTitle({ label, title, subtitle, children }) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flexShrink: 1 }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children ? <View style={styles.titleActions}>{children}</View> : null}
    </View>
  );
}

// variant: 'primary' (orange) | 'outline' | 'ghost'
export function Button({ label, icon, onPress, variant = 'primary', small, busy, accessibilityLabel }) {
  const isPrimary = variant === 'primary';
  const color = isPrimary ? COLORS.white : COLORS.navy;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        styles[variant],
        pressed && { opacity: 0.85 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={small ? 14 : 17} color={color} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={44} color={COLORS.muted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {children ? <View style={{ marginTop: 16 }}>{children}</View> : null}
    </View>
  );
}

// White panel with a heading, used on the dashboard.
export function Panel({ title, action, children, style }) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function Avatar({ name, size = 38 }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  // maxWidth keeps the buttons inside narrow screens; they wrap onto a new line instead.
  titleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, maxWidth: '100%' },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 15, color: COLORS.body, marginTop: 4 },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    minHeight: 44,
  },
  buttonSmall: { paddingHorizontal: 12, paddingVertical: 7, minHeight: 32, gap: 6 },
  primary: { backgroundColor: COLORS.orange },
  outline: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.navy },
  ghost: { backgroundColor: COLORS.chipBg },
  buttonText: { fontSize: 15, fontWeight: '700' },
  buttonTextSmall: { fontSize: 13, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: COLORS.white,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptyText: { fontSize: 15, color: COLORS.body, marginTop: 6, textAlign: 'center' },

  panel: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  avatar: { backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontWeight: '700' },
});
