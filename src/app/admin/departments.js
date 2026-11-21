import { useState } from 'react';
import { ActivityIndicator, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { PageBody } from '../../components/Screen';
import FeatureCard from '../../components/FeatureCard';
import CardGrid from '../../components/CardGrid';
import AddDepartmentModal from '../../components/AddDepartmentModal';
import ConfirmModal from '../../components/ConfirmModal';
import { Button, EmptyState, PageTitle } from '../../components/admin/ui';
import { deleteDepartment, updateDepartment, useDepartments } from '../../data/departments';
import { useEmployees } from '../../data/employees';
import { COLORS } from '../../theme';

// The admin content area is narrower than the window (sidebar), so use 3 columns from 1100px.
const ADMIN_WIDE = 1100;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// /admin/departments — all departments, each with Edit / Delete.
// Click a card to manage its sub-departments.
export default function AdminDepartments() {
  const { width } = useWindowDimensions();
  const isWide = width >= ADMIN_WIDE;
  const { departments, loading, addDepartment } = useDepartments();
  const { employees } = useEmployees();
  // form: null (closed) | { mode: 'add' } | { mode: 'edit', dept }
  const [form, setForm] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const handleSave = (values) =>
    form?.mode === 'edit' ? updateDepartment(form.dept.id, values) : addDepartment(values);

  return (
    <PageBody>
      <PageTitle label="ORGANISATION" title="Departments">
        <Button label="Add Department" icon="plus" onPress={() => setForm({ mode: 'add' })} />
      </PageTitle>

      {loading ? (
        <ActivityIndicator color={COLORS.navy} style={{ marginTop: 40 }} />
      ) : departments.length === 0 ? (
        <EmptyState
          icon="office-building-outline"
          title="No departments yet"
          text="Click “Add Department” to create your first department."
        />
      ) : (
        <CardGrid
          isWide={isWide}
          items={departments}
          renderItem={(dept, style) => (
            <FeatureCard
              key={dept.id}
              isWide={isWide}
              style={style}
              card={{
                label: 'DEPARTMENT',
                title: dept.name,
                icon: dept.icon,
                tags: [
                  plural(dept.subDepartments.length, 'SUB-DEPARTMENT', 'SUB-DEPARTMENTS'),
                  plural(
                    employees.filter((e) => e.departmentId === dept.id).length,
                    'EMPLOYEE',
                    'EMPLOYEES'
                  ),
                ],
              }}
              onPress={() => router.push(`/admin/department/${dept.id}`)}
              onEdit={() => setForm({ mode: 'edit', dept })}
              onDelete={() => setToDelete(dept)}
            />
          )}
        />
      )}

      <AddDepartmentModal
        visible={form !== null}
        initial={form?.mode === 'edit' ? form.dept : null}
        onClose={() => setForm(null)}
        onSave={handleSave}
      />

      <ConfirmModal
        visible={toDelete !== null}
        title="Delete department?"
        message={
          toDelete
            ? toDelete.subDepartments.length > 0
              ? `“${toDelete.name}” and its ${plural(toDelete.subDepartments.length, 'sub-department', 'sub-departments')} will be removed.`
              : `“${toDelete.name}” will be removed.`
            : ''
        }
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const error = await deleteDepartment(toDelete.id);
          if (error) return error; // shown in the dialog (e.g. employees still assigned)
          setToDelete(null);
          return null;
        }}
      />
    </PageBody>
  );
}
