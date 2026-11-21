import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { PageBody } from '../../../components/Screen';
import CardGrid from '../../../components/CardGrid';
import SubDepartmentCard from '../../../components/SubDepartmentCard';
import SubDepartmentModal from '../../../components/SubDepartmentModal';
import ConfirmModal from '../../../components/ConfirmModal';
import AddDepartmentModal from '../../../components/AddDepartmentModal';
import {
  addSubDepartment,
  deleteDepartment,
  deleteSubDepartment,
  updateDepartment,
  updateSubDepartment,
  useDepartments,
} from '../../../data/departments';
import { COLORS } from '../../../theme';

// The admin content area is narrower than the window (sidebar), so use 3 columns from 1100px.
const ADMIN_WIDE = 1100;

// Admin: one department's sub-departments, at /admin/department/<id>.
export default function DepartmentDetail() {
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isWide = width >= ADMIN_WIDE;
  const { departments, loading } = useDepartments();
  const dept = departments.find((d) => d.id === id);

  // form: null (closed) | { mode: 'add' } | { mode: 'edit', sub }
  const [form, setForm] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deptFormOpen, setDeptFormOpen] = useState(false);
  const [deptDeleteOpen, setDeptDeleteOpen] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/admin/departments'));

  const backLink = (
    <Pressable onPress={goBack} style={styles.back} accessibilityRole="link">
      <Feather name="arrow-left" size={16} color={COLORS.blue} />
      <Text style={styles.backText}>All departments</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <PageBody>
        <ActivityIndicator color={COLORS.navy} style={{ marginTop: 40 }} />
      </PageBody>
    );
  }

  if (!dept) {
    return (
      <PageBody>
        {backLink}
        <View style={styles.empty}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>Department not found</Text>
          <Text style={styles.emptyText}>It may have been removed.</Text>
        </View>
      </PageBody>
    );
  }

  const subs = dept.subDepartments;

  const handleSave = (values) =>
    form?.mode === 'edit'
      ? updateSubDepartment(dept.id, form.sub.id, values)
      : addSubDepartment(dept.id, values);

  return (
    <PageBody>
      {backLink}

      <View style={styles.sectionHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.deptIcon}>
            <MaterialCommunityIcons name={dept.icon} size={30} color={COLORS.white} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.sectionLabel}>DEPARTMENT</Text>
            <Text style={styles.sectionTitle}>{dept.name}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setDeptFormOpen(true)}
            style={({ pressed }) => [styles.smallButton, styles.editButton, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Edit department"
          >
            <Feather name="edit-2" size={15} color={COLORS.text} />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => setDeptDeleteOpen(true)}
            style={({ pressed }) => [styles.smallButton, styles.deleteButton, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Delete department"
          >
            <Feather name="trash-2" size={15} color={COLORS.danger} />
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
          <Pressable
            onPress={() => setForm({ mode: 'add' })}
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
          >
            <Feather name="plus" size={18} color={COLORS.white} />
            <Text style={styles.addButtonText}>Add Sub-department</Text>
          </Pressable>
        </View>
      </View>

      {subs.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="sitemap-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>No sub-departments yet</Text>
          <Text style={styles.emptyText}>
            Click “Add Sub-department” to add the first one to {dept.name}.
          </Text>
        </View>
      ) : (
        <CardGrid
          isWide={isWide}
          items={subs}
          renderItem={(sub, style) => (
            <SubDepartmentCard
              key={sub.id}
              sub={sub}
              fallbackIcon={dept.icon}
              isWide={isWide}
              style={style}
              onEdit={() => setForm({ mode: 'edit', sub })}
              onDelete={() => setToDelete(sub)}
            />
          )}
        />
      )}

      <SubDepartmentModal
        visible={form !== null}
        initial={form?.mode === 'edit' ? form.sub : null}
        departmentName={dept.name}
        onClose={() => setForm(null)}
        onSave={handleSave}
      />

      <ConfirmModal
        visible={toDelete !== null}
        title="Delete sub-department?"
        message={toDelete ? `“${toDelete.name}” will be removed from ${dept.name}.` : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteSubDepartment(dept.id, toDelete.id);
          setToDelete(null);
        }}
      />

      <AddDepartmentModal
        visible={deptFormOpen}
        initial={dept}
        onClose={() => setDeptFormOpen(false)}
        onSave={(values) => updateDepartment(dept.id, values)}
      />

      <ConfirmModal
        visible={deptDeleteOpen}
        title="Delete department?"
        message={
          subs.length > 0
            ? `“${dept.name}” and its ${subs.length} sub-department${subs.length === 1 ? '' : 's'} will be removed.`
            : `“${dept.name}” will be removed.`
        }
        onCancel={() => setDeptDeleteOpen(false)}
        onConfirm={async () => {
          const error = await deleteDepartment(dept.id);
          if (error) return error; // shown in the dialog
          setDeptDeleteOpen(false);
          router.replace('/admin/departments');
          return null;
        }}
      />
    </PageBody>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
  deptIcon: {
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  sectionTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  addButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, maxWidth: '100%' },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
  },
  editButton: { backgroundColor: COLORS.chipBg },
  editText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  deleteButton: { backgroundColor: '#FDECEC' },
  deleteText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    backgroundColor: COLORS.white,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptyText: { fontSize: 15, color: COLORS.body, marginTop: 6, textAlign: 'center' },
});
