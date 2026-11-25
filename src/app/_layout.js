import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Employee pages (home, departments, attendance): sign-in required, see (client)/_layout.js */}
        <Stack.Screen name="(client)" />
        <Stack.Screen name="login" options={{ title: 'Sign in · INEOS' }} />
        <Stack.Screen name="admin-login" options={{ title: 'Admin sign in · INEOS' }} />
        {/* Admin panel: its own layout (sidebar + pages) in admin/_layout.js */}
        <Stack.Screen name="admin" options={{ title: 'INEOS Admin' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
