import { Stack } from 'expo-router';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function ClientLayout() {
  return (
    <ProtectedRoute requiredType="client" publicPaths={['/client/welcome', '/client/signup']}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="detailer/[id]" />
        <Stack.Screen name="book" />
        <Stack.Screen name="vir/[id]" />
        <Stack.Screen name="invoice/[id]" />
        <Stack.Screen name="dev-tools" />
      </Stack>
    </ProtectedRoute>
  );
}

