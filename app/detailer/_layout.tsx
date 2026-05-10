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
      </Stack>
    </ProtectedRoute>
  );
}
