import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { AppHeader } from './Screen';
import { signIn, useSession } from '../data/session';
import { COLORS } from '../theme';

// Sign-in form used by /login (employees) and /admin-login (admins). The two sides keep
// separate sign-ins, so an admin and an employee can be signed in at once in different tabs.
// An admin who signs in on /login is sent to the admin panel.
export default function LoginScreen({ mode }) {
  const isAdmin = mode === 'admin';
  const home = isAdmin ? '/admin' : '/';
  const { employee: account, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && account) return <Redirect href={home} />;

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    const result = await signIn(email, password, mode);
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace(result.role === 'admin' ? '/admin' : '/');
    }
  };

  const clearError = () => setError(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader badge={isAdmin ? 'ADMIN' : null} />
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.cardTop} />
            <View style={styles.cardBody}>
              <Text style={styles.label}>{isAdmin ? 'ADMIN PANEL' : 'INEOS ATTENDANCE'}</Text>
              <Text style={styles.title}>{isAdmin ? 'Admin sign in' : 'Sign in'}</Text>
              <Text style={styles.subtitle}>
                {isAdmin
                  ? 'Sign in with your admin email and password.'
                  : 'Use the email and password given to you by your admin.'}
              </Text>

              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Feather name="mail" size={18} color={COLORS.muted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    clearError();
                  }}
                  placeholder="name@ineos.com"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="next"
                  accessibilityLabel="Email"
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Feather name="lock" size={18} color={COLORS.muted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    clearError();
                  }}
                  placeholder="Your password"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eye}
                  hitSlop={6}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.body} />
                </Pressable>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={16} color={COLORS.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={busy}
                style={({ pressed }) => [styles.submit, (pressed || busy) && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.submitText}>Sign in</Text>
                    <Feather name="arrow-right" size={18} color={COLORS.white} />
                  </>
                )}
              </Pressable>

              <Text style={styles.help}>
                {isAdmin
                  ? 'Forgot your password? Reset it in the Supabase SQL Editor.'
                  : 'Forgot your password? Ask your admin to reset it.'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  page: { flex: 1, backgroundColor: COLORS.pageBg },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, paddingVertical: 40 },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.white,
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTop: { height: 6, backgroundColor: COLORS.orange, width: '66%' },
  cardBody: { padding: 28 },
  label: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  title: { fontSize: 30, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  subtitle: { fontSize: 15, color: COLORS.body, marginTop: 6, marginBottom: 24, lineHeight: 22 },
  fieldLabel: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 13, fontSize: 16, color: COLORS.text },
  eye: { paddingHorizontal: 14, paddingVertical: 12 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 4,
    padding: 12,
    marginTop: 18,
  },
  errorText: { color: COLORS.danger, fontSize: 14, flexShrink: 1 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 24,
    minHeight: 50,
  },
  submitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  help: { fontSize: 13, color: COLORS.body, textAlign: 'center', marginTop: 18 },
});
