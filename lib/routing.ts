import { router } from 'expo-router';

import type { UserDocument } from '@/types/firestore';

export function navigateAfterAuth(profile: UserDocument | null) {
  if (!profile) {
    router.replace('/');
    return;
  }
  const done = profile.onboardingComplete === true;
  if (profile.userType === 'detailer') {
    router.replace(done ? '/detailer/dashboard' : '/detailer/onboarding/welcome');
    return;
  }
  router.replace(done ? '/client/dashboard' : '/client/onboarding');
}
