import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../data/session';
import { COLORS } from '../../theme';

// Employee pages require a signed-in employee; signed-out visitors are sent to /login.
export default function ClientLayout() {
  const { employee, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.white} />
      </View>
    );
  }
  if (!employee) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'My Attendance · INEOS' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy },
});
