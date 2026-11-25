import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import LeaveRequestModal from './LeaveRequestModal';
import LeaveRequestRow from './LeaveRequestRow';
import ConfirmModal from '../ConfirmModal';
import { cancelLeave } from '../../data/leave';
import { COLORS } from '../../theme';

// Employee home: "My leave" — apply for leave and see the status of past requests.
export default function MyLeaves({ requests, calendar }) {
  const [open, setOpen] = useState(false);
  const [toCancel, setToCancel] = useState(null);
  const [sent, setSent] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? requests : requests.slice(0, 5);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>My leave</Text>
        <Pressable
          onPress={() => {
            setSent(false);
            setOpen(true);
          }}
          style={({ pressed }) => [styles.apply, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Apply for leave"
        >
          <Feather name="plus" size={16} color={COLORS.white} />
          <Text style={styles.applyText}>Apply for leave</Text>
        </Pressable>
      </View>
      {sent ? <Text style={styles.sent}>✓ Leave request sent. Your admin will approve or reject it.</Text> : null}

      <View style={styles.list}>
        {requests.length === 0 ? (
          <Text style={styles.empty}>No leave requests yet.</Text>
        ) : (
          visible.map((r, i) => (
            <LeaveRequestRow
              key={r.id}
              request={r}
              first={i === 0}
              actions={
                r.status === 'pending' ? (
                  <Pressable onPress={() => setToCancel(r)} hitSlop={6} accessibilityLabel="Cancel leave request">
                    <Text style={styles.cancel}>Cancel request</Text>
                  </Pressable>
                ) : null
              }
            />
          ))
        )}
      </View>
      {requests.length > 5 ? (
        <Pressable onPress={() => setShowAll((v) => !v)} style={styles.more} hitSlop={6}>
          <Text style={styles.moreText}>{showAll ? 'Show fewer' : `Show all (${requests.length})`}</Text>
        </Pressable>
      ) : null}

      <LeaveRequestModal
        visible={open}
        calendar={calendar}
        onClose={(didSend) => {
          setOpen(false);
          if (didSend) setSent(true);
        }}
      />
      <ConfirmModal
        visible={toCancel !== null}
        title="Cancel leave request?"
        message="The request will be withdrawn. You can apply again later."
        confirmLabel="Cancel request"
        onCancel={() => setToCancel(null)}
        onConfirm={async () => {
          const message = await cancelLeave(toCancel.id);
          if (message) return message;
          setToCancel(null);
          return null;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  apply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6B46C1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  applyText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  sent: { fontSize: 14, color: '#1E7B4A', fontWeight: '600', marginBottom: 10 },
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
  empty: { padding: 16, fontSize: 14, color: COLORS.body },
  cancel: { color: COLORS.danger, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  more: { marginTop: 10, alignSelf: 'flex-start' },
  moreText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
});
