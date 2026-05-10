import { Redirect } from 'expo-router';

/**
 * Legacy route: detailer signup now lives at /detailer/onboarding/signup
 * after the welcome screen. Send users to role selection.
 */
export default function LegacySignupRedirect() {
  return <Redirect href="/onboarding" />;
}
