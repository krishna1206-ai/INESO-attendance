import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PageBody } from '../../components/Screen';
import { Avatar, Button, EmptyState, PageTitle } from '../../components/admin/ui';
import LeaveRequestRow from '../../components/leave/LeaveRequestRow';
import ConfirmModal from '../../components/ConfirmModal';
import { useDepartments } from '../../data/departments';
import { describeEmployee, useEmployees } from '../../data/employees';
import { decideLeave, useLeaveRequests } from '../../data/leave';
import { COLORS } from '../../theme';

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

// /admin/leave — employees' leave requests. Approve or reject pending ones (with an optional
// note). Approved days show as Leave in attendance and reports.
export default function AdminLeave() {
  const { requests, loading } = useLeaveRequests();
  const { employees } = useEmployees();
  const { departments } = useDepartments();
  const [filter, setFilter] = useState('pending');
  const [decision, setDecision] = useState(null); // { request, approve }
  const [note, setNote] = useState('');

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, 0]));
  for (const r of requests) if (counts[r.status] != null) counts[r.status] += 1;
  counts.all = requests.length;
  const shown = requests
    .filter((r) => filter === 'all' || r.status === filter)
    // Pending: oldest first (first come, first decided); others: newest first.
    .sort((a, b) => (filter === 'pending' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));

  const who = (r) => {
    const e = employees.find((x) => x.id === r.employeeId);
    if (!e) return <Text style={styles.name}>Deleted employee</Text>;
    const { departmentName, subDepartmentName } = describeEmployee(e, departments);
    return (
      <View style={styles.who}>
        <Avatar name={e.name} size={32} />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.name}>{e.name}</Text>
          <Text style={styles.dept}>
            {departmentName}
            {subDepartmentName !== '—' ? ` · ${subDepartmentName}` : ''}
            {`  ·  applied ${new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <PageBody>
      <PageTitle label="REQUESTS" title="Leave" subtitle="Approve or reject employees' leave requests." />

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filter, active && styles.filterActive]}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label} ({counts[f.key]})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.navy} style={{ marginTop: 32 }} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="airplane-takeoff"
          title={filter === 'pending' ? 'No pending leave requests' : 'Nothing here'}
          text={filter === 'pending' ? 'New requests from employees will appear here.' : undefined}
        />
      ) : (
        <View style={styles.list}>
          {shown.map((r, i) => (
            <LeaveRequestRow
              key={r.id}
              request={r}
              first={i === 0}
              who={who(r)}
              actions={
                r.status === 'cancelled' ? null : (
                  // Pending: Approve / Reject. Already decided: switch to the other decision.
                  <View style={styles.actions}>
                    {r.status !== 'approved' ? (
                      <Button
                        label={r.status === 'rejected' ? 'Approve instead' : 'Approve'}
                        icon="check"
                        small
                        variant={r.status === 'pending' ? 'primary' : 'ghost'}
                        onPress={() => { setNote(r.adminNote ?? ''); setDecision({ request: r, approve: true }); }}
                        accessibilityLabel="Approve leave"
                      />
                    ) : null}
                    {r.status !== 'rejected' ? (
                      <Button
                        label={r.status === 'approved' ? 'Reject instead' : 'Reject'}
                        icon="x"
                        variant="ghost"
                        small
                        onPress={() => { setNote(r.adminNote ?? ''); setDecision({ request: r, approve: false }); }}
                        accessibilityLabel="Reject leave"
                      />
                    ) : null}
                  </View>
                )
              }
            />
          ))}
        </View>
      )}

      <ConfirmModal
        visible={decision !== null}
        title={
          decision?.request.status === 'pending'
            ? decision?.approve ? 'Approve leave?' : 'Reject leave?'
            : decision?.approve ? 'Change to Approved?' : 'Change to Rejected?'
        }
        confirmLabel={decision?.approve ? 'Approve' : 'Reject'}
        tone={decision?.approve ? 'primary' : 'danger'}
        message={
          decision
            ? decision.approve
              ? `${decision.request.status === 'rejected' ? 'This request was rejected earlier. ' : ''}These days will show as Leave in attendance and reports.`
              : decision.request.status === 'approved'
                ? 'This leave was approved earlier. These days will no longer count as Leave, and the employee will see it as rejected.'
                : 'The employee will see that the request was rejected.'
            : ''
        }
        onCancel={() => setDecision(null)}
        onConfirm={async () => {
          const message = await decideLeave(decision.request.id, decision.approve, note);
          if (message) return message;
          setDecision(null);
          return null;
        }}
      >
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note for the employee (optional)"
          placeholderTextColor={COLORS.muted}
          style={styles.noteInput}
          maxLength={300}
          accessibilityLabel="Note for the employee"
        />
      </ConfirmModal>
    </PageBody>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.chipBg },
  filterActive: { backgroundColor: COLORS.navy },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  filterTextActive: { color: COLORS.white },
  list: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  dept: { fontSize: 12, color: COLORS.body },
  actions: { flexDirection: 'row', gap: 8 },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginTop: 14,
    minWidth: 0,
  },
});
