import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { PageBody } from '../../components/Screen';
import EmployeeModal from '../../components/EmployeeModal';
import ConfirmModal from '../../components/ConfirmModal';
import { Avatar, Button, EmptyState, PageTitle } from '../../components/admin/ui';
import { useDepartments } from '../../data/departments';
import {
  addEmployee,
  deleteEmployee,
  describeEmployee,
  canSignIn,
  updateEmployee,
  useEmployees,
} from '../../data/employees';
import { COLORS } from '../../theme';

const TABLE_BREAKPOINT = 900;

// /admin/employees — list, filter, add, edit and delete employees.
export default function AdminEmployees() {
  const { width } = useWindowDimensions();
  const asTable = width >= TABLE_BREAKPOINT;
  const { departments } = useDepartments();
  const { employees, loading } = useEmployees();

  const [filterDept, setFilterDept] = useState('all');
  const [query, setQuery] = useState('');
  // form: null | { mode: 'add' } | { mode: 'edit', employee }
  const [form, setForm] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const q = query.trim().toLowerCase();
  const visible = employees
    .filter((e) => filterDept === 'all' || e.departmentId === filterDept)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.email ?? '').includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = (values) =>
    form?.mode === 'edit'
      ? updateEmployee(form.employee.id, values, departments)
      : addEmployee(values, departments);

  return (
    <PageBody>
      <PageTitle
        label="PEOPLE"
        title="Employees"
        subtitle={`${employees.length} employee${employees.length === 1 ? '' : 's'}`}
      >
        <Button label="Add Employee" icon="user-plus" onPress={() => setForm({ mode: 'add' })} />
      </PageTitle>

      {/* Search + department filter */}
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Feather name="search" size={16} color={COLORS.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
            accessibilityLabel="Search employees"
          />
        </View>
        {/* Chips wrap onto new lines so none get cut off on phones. */}
        <View style={styles.filters}>
          {[{ id: 'all', name: 'All departments' }, ...departments].map((d) => {
            const active = filterDept === d.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => setFilterDept(d.id)}
                style={[styles.filter, active && styles.filterActive]}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{d.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.navy} style={{ marginTop: 40 }} />
      ) : employees.length === 0 ? (
        <EmptyState
          icon="account-plus-outline"
          title="No employees yet"
          text="Click “Add Employee” to add the first one."
        />
      ) : visible.length === 0 ? (
        <EmptyState icon="account-search-outline" title="No matching employees" />
      ) : (
        <View style={styles.table}>
          {asTable ? (
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.colName]}>NAME</Text>
              <Text style={[styles.th, styles.colDept]}>DEPARTMENT</Text>
              <Text style={[styles.th, styles.colSub]}>SUB-DEPARTMENT</Text>
              <Text style={[styles.th, styles.colActions]}> </Text>
            </View>
          ) : null}

          {visible.map((e, i) => {
            const { dept, departmentName, subDepartmentName } = describeEmployee(e, departments);
            const actions = (
              <View style={styles.actions}>
                <Button
                  label="Edit"
                  icon="edit-2"
                  variant="ghost"
                  small
                  onPress={() => setForm({ mode: 'edit', employee: e })}
                  accessibilityLabel={`Edit ${e.name}`}
                />
                <Pressable
                  onPress={() => setToDelete(e)}
                  style={styles.deleteBtn}
                  accessibilityLabel={`Delete ${e.name}`}
                >
                  <Feather name="trash-2" size={14} color={COLORS.danger} />
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            );

            return asTable ? (
              <View key={e.id} style={[styles.tr, i > 0 && styles.trBorder]}>
                <View style={[styles.colName, styles.nameCell]}>
                  <Avatar name={e.name} size={34} />
                  <View style={{ flexShrink: 1 }}>
                    <View style={styles.nameLine}>
                      <Text style={styles.name}>{e.name}</Text>
                      {!canSignIn(e) ? <NoLoginBadge /> : null}
                    </View>
                    {e.email ? <Text style={styles.email}>{e.email}</Text> : null}
                  </View>
                </View>
                <View style={[styles.colDept, styles.deptCell]}>
                  {dept ? <MaterialCommunityIcons name={dept.icon} size={16} color={COLORS.navy} /> : null}
                  <Text style={styles.td}>{departmentName}</Text>
                </View>
                <Text style={[styles.td, styles.colSub]}>{subDepartmentName}</Text>
                <View style={styles.colActions}>{actions}</View>
              </View>
            ) : (
              <View key={e.id} style={[styles.card, i > 0 && styles.trBorder]}>
                <View style={styles.nameCell}>
                  <Avatar name={e.name} size={38} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameLine}>
                      <Text style={styles.name}>{e.name}</Text>
                      {!canSignIn(e) ? <NoLoginBadge /> : null}
                    </View>
                    {e.email ? <Text style={styles.email}>{e.email}</Text> : null}
                    <Text style={styles.cardSub}>
                      {departmentName}
                      {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
                    </Text>
                  </View>
                </View>
                {actions}
              </View>
            );
          })}
        </View>
      )}

      <EmployeeModal
        visible={form !== null}
        initial={form?.mode === 'edit' ? form.employee : null}
        presetDepartmentId={filterDept !== 'all' ? filterDept : undefined}
        departments={departments}
        onClose={() => setForm(null)}
        onSave={handleSave}
      />
      <ConfirmModal
        visible={toDelete !== null}
        title="Delete employee?"
        message={toDelete ? `“${toDelete.name}” will be removed.` : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteEmployee(toDelete.id);
          setToDelete(null);
        }}
      />
    </PageBody>
  );
}

// Shown for employees created before email/password existed; edit them to set both.
function NoLoginBadge() {
  return (
    <View style={styles.noPw}>
      <Feather name="lock" size={11} color="#9A5B00" />
      <Text style={styles.noPwText}>Login not set</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  email: { fontSize: 13, color: COLORS.body, marginTop: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  noPw: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4E0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  noPwText: { color: '#9A5B00', fontSize: 11, fontWeight: '700' },
  toolbar: { gap: 12, marginBottom: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    maxWidth: 420,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 15, color: COLORS.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
  },
  filterActive: { backgroundColor: COLORS.navy },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  filterTextActive: { color: COLORS.white },

  table: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  thead: { backgroundColor: COLORS.pageBg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  trBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  th: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  td: { fontSize: 14, color: COLORS.body },
  colName: { flex: 3 },
  colDept: { flex: 2.5 },
  colSub: { flex: 2.5 },
  colActions: { flex: 2, alignItems: 'flex-end' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deptCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  card: { padding: 16, gap: 12 },
  cardSub: { fontSize: 13, color: COLORS.body, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FDECEC',
  },
  deleteText: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
});
