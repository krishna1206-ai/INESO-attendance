import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

// Add / edit an employee: 1) department, 2) sub-department of that department, 3) name.
// `initial` is the employee being edited, or null to add. `presetDepartmentId` pre-selects a
// department when adding. onSave(values) resolves to an error string, or null on success.
export default function EmployeeModal({
  visible,
  initial,
  presetDepartmentId,
  departments,
  onClose,
  onSave,
}) {
  const [departmentId, setDepartmentId] = useState('');
  const [subDepartmentId, setSubDepartmentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDepartmentId(initial?.departmentId ?? presetDepartmentId ?? '');
    setSubDepartmentId(initial?.subDepartmentId ?? '');
    setName(initial?.name ?? '');
    setEmail(initial?.email ?? '');
    setPassword(''); // stored passwords are hashed, so editing always starts blank
    setShowPassword(false);
    setError(null);
    setSaving(false);
  }, [visible, initial, presetDepartmentId]);

  const dept = departments.find((d) => d.id === departmentId);
  const subs = dept?.subDepartments ?? [];

  const chooseDepartment = (id) => {
    if (id !== departmentId) setSubDepartmentId(''); // sub-departments belong to one department
    setDepartmentId(id);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const message = await onSave({ name, email, departmentId, subDepartmentId, password });
    setSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>{initial ? 'Edit Employee' : 'Add Employee'}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={COLORS.text} />
            </Pressable>
          </View>
          <View style={styles.accent} />

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {departments.length === 0 ? (
              <Text style={styles.hint}>
                There are no departments yet. Add a department first, then add employees to it.
              </Text>
            ) : (
              <>
                {/* Step 1: department */}
                <StepLabel n={1} text="SELECT DEPARTMENT" />
                <View style={styles.options}>
                  {departments.map((d) => {
                    const selected = d.id === departmentId;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => chooseDepartment(d.id)}
                        style={[styles.deptOption, selected && styles.optionSelected]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Department ${d.name}`}
                      >
                        <MaterialCommunityIcons
                          name={d.icon}
                          size={20}
                          color={selected ? COLORS.white : COLORS.navy}
                        />
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {d.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Step 2: sub-department of the chosen department */}
                <StepLabel n={2} text="SELECT SUB-DEPARTMENT" style={styles.stepGap} />
                {!dept ? (
                  <Text style={styles.hint}>Select a department first.</Text>
                ) : subs.length === 0 ? (
                  <Text style={styles.hint}>
                    {dept.name} has no sub-departments, so this step is skipped.
                  </Text>
                ) : (
                  <View style={styles.options}>
                    {subs.map((s) => {
                      const selected = s.id === subDepartmentId;
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            setSubDepartmentId(s.id);
                            setError(null);
                          }}
                          style={[styles.subOption, selected && styles.optionSelected]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Sub-department ${s.name}`}
                        >
                          {selected ? <Feather name="check" size={14} color={COLORS.white} /> : null}
                          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                            {s.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Step 3: name */}
                <StepLabel n={3} text="EMPLOYEE NAME" style={styles.stepGap} />
                <TextInput
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    setError(null);
                  }}
                  placeholder="e.g. Priya Patel"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  maxLength={80}
                  autoCapitalize="words"
                  returnKeyType="next"
                  accessibilityLabel="Employee name"
                />

                {/* Step 4: email (used to sign in) */}
                <StepLabel n={4} text="EMAIL" style={styles.stepGap} />
                <TextInput
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setError(null);
                  }}
                  placeholder="e.g. priya.patel@ineos.com"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={120}
                  returnKeyType="next"
                  accessibilityLabel="Email"
                />

                {/* Step 5: password */}
                <StepLabel n={5} text="PASSWORD" style={styles.stepGap} />
                <View style={styles.passwordRow}>
                  <TextInput
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      setError(null);
                    }}
                    placeholder={initial ? 'Leave blank to keep the current password' : 'At least 6 characters'}
                    placeholderTextColor={COLORS.muted}
                    style={styles.passwordInput}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    maxLength={64}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
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
                <Text style={styles.fieldHint}>
                  {initial
                    ? 'Type a new password only if you want to change it.'
                    : 'The employee will use this password to sign in.'}
                </Text>
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={[styles.button, styles.buttonSecondary]}>
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            {departments.length > 0 ? (
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonPrimary,
                  (pressed || saving) && { opacity: 0.85 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Save</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StepLabel({ n, text, style }) {
  return (
    <View style={[styles.stepRow, style]}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 26, 60, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: COLORS.white,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  accent: { height: 4, backgroundColor: COLORS.orange, width: '66%' },
  content: { padding: 24 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stepGap: { marginTop: 24 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  stepText: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  deptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.pageBg,
  },
  subOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.pageBg,
  },
  optionSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  optionText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  optionTextSelected: { color: COLORS.white },
  hint: { fontSize: 14, color: COLORS.body, lineHeight: 20 },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  passwordInput: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  eye: { paddingHorizontal: 14, paddingVertical: 12 },
  fieldHint: { fontSize: 13, color: COLORS.body, marginTop: 6 },
  error: { color: COLORS.danger, fontSize: 14, marginTop: 14 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    minWidth: 110,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: COLORS.orange },
  buttonPrimaryText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  buttonSecondary: { backgroundColor: COLORS.chipBg },
  buttonSecondaryText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
});
