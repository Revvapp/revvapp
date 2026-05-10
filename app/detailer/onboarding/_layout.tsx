import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/hooks/useOnboarding';

export default function DetailerOnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
