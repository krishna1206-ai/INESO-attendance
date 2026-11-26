import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PageBody } from '../../components/Screen';
import AddDepartmentModal from '../../components/AddDepartmentModal';
import EmployeeModal from '../../components/EmployeeModal';
import TodayOverview from '../../components/admin/TodayOverview';
import { Avatar, Button, PageTitle, Panel } from '../../components/admin/ui';
import { useDepartments } from '../../data/departments';
import { addEmployee, describeEmployee, useEmployees } from '../../data/employees';
import { COLORS } from '../../theme';

const ADMIN_WIDE = 1100;
const RECENT_COUNT = 5;

// /admin — overview: totals, quick actions, recent employees, employees per department.
export default function AdminDashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= ADMIN_WIDE;
  const { departments, addDepartment } = useDepartments();
  const { employees } = useEmployees();
  const [deptFormOpen, setDeptFormOpen] = useState(false);
  const [empFormOpen, setEmpFormOpen] = useState(false);

  const subCount = departments.reduce((n, d) => n + d.subDepartments.length, 0);
  const recent = [...employees]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, RECENT_COUNT);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats = [
    { label: 'Departments', value: departments.length, icon: 'office-building-outline', href: '/admin/departments' },
    { label: 'Sub-departments', value: subCount, icon: 'sitemap-outline', href: '/admin/departments' },
    { label: 'Employees', value: employees.length, icon: 'account-group-outline', href: '/admin/employees' },
  ];

  return (
    <PageBody>
      <PageTitle label="ADMIN PANEL" title="Dashboard" subtitle={today}>
        <Button label="Add Employee" icon="user-plus" onPress={() => setEmpFormOpen(true)} />
        <Button label="Add Department" icon="plus" variant="outline" onPress={() => setDeptFormOpen(true)} />
      </PageTitle>

      <TodayOverview employees={employees} />

      {/* Totals */}
      <View style={[styles.stats, isWide && styles.row]}>
        {stats.map((s) => (
          <Pressable
            key={s.label}
            onPress={() => router.navigate(s.href)}
            style={({ hovered }) => [styles.stat, isWide && styles.flex1, hovered && styles.statHover]}
            accessibilityRole="link"
            accessibilityLabel={`${s.label}: ${s.value}`}
          >
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name={s.icon} size={26} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
            <Feather name="arrow-right" size={18} color={COLORS.muted} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.panels, isWide && styles.row]}>
        {/* Recent employees */}
        <Panel
          title="Recent employees"
          style={isWide ? { flex: 3 } : null}
          action={<LinkText label="View all" onPress={() => router.navigate('/admin/employees')} />}
        >
          {recent.length === 0 ? (
            <Text style={styles.muted}>No employees yet. Use “Add Employee” to add the first one.</Text>
          ) : (
            recent.map((e, i) => {
              const { departmentName, subDepartmentName } = describeEmployee(e, departments);
              return (
                <View key={e.id} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                  <Avatar name={e.name} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{e.name}</Text>
                    <Text style={styles.rowSub}>
                      {departmentName}
                      {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Panel>

        {/* Employees per department */}
        <Panel
          title="Employees by department"
          style={isWide ? { flex: 2 } : null}
          action={<LinkText label="Manage" onPress={() => router.navigate('/admin/departments')} />}
        >
          {departments.length === 0 ? (
            <Text style={styles.muted}>No departments yet.</Text>
          ) : (
            departments.map((d, i) => {
              const count = employees.filter((e) => e.departmentId === d.id).length;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => router.push(`/admin/department/${d.id}`)}
                  style={[styles.listRow, i > 0 && styles.listRowBorder]}
                >
                  <View style={styles.deptIcon}>
                    <MaterialCommunityIcons name={d.icon} size={18} color={COLORS.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{d.name}</Text>
                    <Text style={styles.rowSub}>
                      {d.subDepartments.length} sub-department{d.subDepartments.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </Panel>
      </View>

      <AddDepartmentModal
        visible={deptFormOpen}
        onClose={() => setDeptFormOpen(false)}
        onSave={addDepartment}
      />
      <EmployeeModal
        visible={empFormOpen}
        initial={null}
        departments={departments}
        onClose={() => setEmpFormOpen(false)}
        onSave={(values) => addEmployee(values, departments)}
      />
    </PageBody>
  );
}

function LinkText({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.link} accessibilityRole="link">
      <Text style={styles.linkText}>{label}</Text>
      <Feather name="arrow-right" size={14} color={COLORS.blue} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex1: { flex: 1 },
  stats: { gap: 16, marginBottom: 24 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 20,
    borderTopWidth: 4,
    borderTopColor: COLORS.orange,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statHover: { shadowOpacity: 0.12 },
  statIcon: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { color: COLORS.blue, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  statValue: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginTop: 2 },

  panels: { gap: 16 },
  muted: { color: COLORS.body, fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: 13, color: COLORS.body, marginTop: 2 },
  deptIcon: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
  },
  countText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
});
