import { Stack } from 'expo-router';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function DetailerLayout() {
  return (
    <ProtectedRoute
      requiredType="detailer"
      publicPaths={['/detailer/onboarding/welcome', '/detailer/onboarding/signup']}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="vir/[id]" />
        <Stack.Screen name="timer/[id]" />
        <Stack.Screen name="before-after/[id]" />
        <Stack.Screen name="invoice/[id]" />
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen name="dev-tools" />
      </Stack>
    </ProtectedRoute>
  );
}
