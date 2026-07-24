/**
 * Firebase App Check — web fallback.
 *
 * App Check on Revv relies on native device attestation (App Attest / Play
 * Integrity) via @react-native-firebase, which does not exist on web. Metro
 * resolves `appCheck.native.ts` for iOS/Android and this file for web, so the
 * web bundle never imports the native module. No-op here.
 */
export async function setupAppCheck(): Promise<void> {
  // Intentionally empty on web.
}
