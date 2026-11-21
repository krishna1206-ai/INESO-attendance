import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { normaliseUrl } from '../data/departments';
import { pickAndCompressImage } from '../data/pickImage';

const EMPTY = { name: '', imageUri: '', linkUrl: '' };

// Add / edit form for a sub-department: image (upload or image URL), website link, name.
// `initial` is the sub-department being edited, or null to add a new one.
// onSave(values) resolves to an error string, or null on success.
export default function SubDepartmentModal({ visible, initial, departmentName, onClose, onSave }) {
  const [name, setName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url'
  const [uploadedUri, setUploadedUri] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fill the form from the sub-department being edited, or reset it, each time it opens.
  useEffect(() => {
    if (!visible) return;
    const src = initial ?? EMPTY;
    const isUploaded = (src.imageUri ?? '').startsWith('data:');
    setName(src.name ?? '');
    setLinkUrl(src.linkUrl ?? '');
    setImageMode(src.imageUri && !isUploaded ? 'url' : 'upload');
    setUploadedUri(isUploaded ? src.imageUri : '');
    setImageUrl(src.imageUri && !isUploaded ? src.imageUri : '');
    setPreviewFailed(false);
    setPicking(false);
    setSaving(false);
    setError(null);
  }, [visible, initial]);

  const imageUri = imageMode === 'upload' ? uploadedUri : normaliseUrl(imageUrl);

  const handlePick = async () => {
    setPicking(true);
    const result = await pickAndCompressImage();
    setPicking(false);
    if (result.uri) {
      setUploadedUri(result.uri);
      setPreviewFailed(false);
      setError(null);
    } else if (result.error) {
      setError(result.error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const message = await onSave({ name, imageUri, linkUrl });
    setSaving(false);
    if (message) setError(message);
    else onClose();
  };

  const clearError = () => setError(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.kicker}>{departmentName?.toUpperCase()}</Text>
              <Text style={styles.title}>{initial ? 'Edit Sub-department' : 'Add Sub-department'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={COLORS.text} />
            </Pressable>
          </View>
          <View style={styles.accent} />

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Image: upload from device, or paste an image URL */}
            <Text style={styles.fieldLabel}>IMAGE</Text>
            <View style={styles.tabs}>
              {[
                { key: 'upload', label: 'Upload Image', icon: 'upload' },
                { key: 'url', label: 'Image URL', icon: 'link' },
              ].map((tab) => {
                const active = imageMode === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      setImageMode(tab.key);
                      setPreviewFailed(false);
                      clearError();
                    }}
                    style={[styles.tab, active && styles.tabActive]}
                    accessibilityState={{ selected: active }}
                  >
                    <Feather name={tab.icon} size={15} color={active ? COLORS.white : COLORS.text} />
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.preview}>
              {imageUri && !previewFailed ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <View style={styles.previewEmpty}>
                  <MaterialCommunityIcons
                    name={previewFailed ? 'image-broken-variant' : 'image-outline'}
                    size={40}
                    color={COLORS.muted}
                  />
                  <Text style={styles.previewText}>
                    {previewFailed ? 'Could not load this image' : 'No image selected'}
                  </Text>
                </View>
              )}
            </View>

            {imageMode === 'upload' ? (
              <View style={styles.uploadRow}>
                <Pressable onPress={handlePick} style={[styles.button, styles.buttonOutline]}>
                  {picking ? (
                    <ActivityIndicator color={COLORS.navy} />
                  ) : (
                    <Text style={styles.buttonOutlineText}>
                      {uploadedUri ? 'Change Image' : 'Choose Image'}
                    </Text>
                  )}
                </Pressable>
                {uploadedUri ? (
                  <Pressable onPress={() => setUploadedUri('')} hitSlop={8}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <TextInput
                value={imageUrl}
                onChangeText={(t) => {
                  setImageUrl(t);
                  setPreviewFailed(false);
                  clearError();
                }}
                placeholder="https://example.com/photo.jpg"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Image URL"
              />
            )}

            <Text style={[styles.fieldLabel, styles.fieldGap]}>WEBSITE LINK</Text>
            <TextInput
              value={linkUrl}
              onChangeText={(t) => {
                setLinkUrl(t);
                clearError();
              }}
              placeholder="https://www.ineos.com/..."
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Website link"
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>SUB-DEPARTMENT NAME</Text>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                clearError();
              }}
              placeholder="e.g. Quality Control Lab"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              accessibilityLabel="Sub-department name"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={[styles.button, styles.buttonSecondary]}>
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving || picking}
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    maxWidth: 520,
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
  kicker: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  accent: { height: 4, backgroundColor: COLORS.orange, width: '66%' },
  content: { padding: 24 },
  fieldLabel: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  fieldGap: { marginTop: 22 },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
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
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  tabTextActive: { color: COLORS.white },

  preview: {
    height: 160,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.pageBg,
    overflow: 'hidden',
    marginBottom: 12,
  },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  previewText: { color: COLORS.muted, fontSize: 13 },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  removeText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },

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
  buttonOutline: { borderWidth: 1, borderColor: COLORS.navy, backgroundColor: COLORS.white },
  buttonOutlineText: { color: COLORS.navy, fontSize: 15, fontWeight: '600' },
});
