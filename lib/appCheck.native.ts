import app from '@/firebaseConfig';

/**
 * Activates Firebase App Check on native builds (iOS / Android).
 *
 * Revv reaches Firestore/Storage/Functions through the Firebase **JS** SDK,
 * whose App Check providers are web-only. So @react-native-firebase runs the
 * real device attestation (App Attest / Play Integrity) and we bridge the token
 * it mints into the JS SDK via a CustomProvider — every JS-SDK request then
 * carries an `X-Firebase-AppCheck` header the backend can verify.
 *
 * INERT UNTIL ACTIVATED. This never throws and no-ops unless three things are in
 * place: (1) the RNFB native module is compiled into the binary, (2) a native
 * Firebase config file is bundled (GoogleService-Info.plist / google-services.json),
 * and (3) the app is registered in Firebase Console → App Check. Until then the
 * app behaves exactly as before and App Check is simply not enforced. See
 * docs/APP_CHECK.md for Console registration, the native rebuild, debug tokens,
 * and the monitor-then-enforce rollout.
 */
let started = false;

export async function setupAppCheck(): Promise<void> {
  if (started) return;
  started = true;

  try {
    // Dynamic imports so a binary without the native module (or a broken
    // Firebase config) rejects here and is caught, instead of crashing at load.
    const { firebase } = await import('@react-native-firebase/app-check');
    const { initializeAppCheck, CustomProvider } = await import('firebase/app-check');

    const rn = firebase.appCheck();
    const provider = rn.newReactNativeFirebaseAppCheckProvider();
    provider.configure({
      // Debug provider on simulators/dev (register the printed token in the
      // Console); real attestation on release builds.
      apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
      android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
    });
    await rn.initializeAppCheck({ provider, isTokenAutoRefreshEnabled: true });

    // Bridge RNFB-minted App Check tokens onto every Firebase JS SDK request.
    initializeAppCheck(app, {
      isTokenAutoRefreshEnabled: true,
      provider: new CustomProvider({
        getToken: async () => {
          const { token } = await rn.getToken();
          // App Check tokens live ~1h; a conservative expiry just refreshes more
          // often. RNFB caches/refreshes the underlying attestation itself.
          return { token, expireTimeMillis: Date.now() + 30 * 60 * 1000 };
        },
      }),
    });
  } catch (err) {
    // Not yet activated, or attestation unavailable (e.g. a simulator with no
    // registered debug token). The app keeps working; App Check stays off.
    if (__DEV__) {
      console.warn('[appCheck] not active:', err instanceof Error ? err.message : err);
    }
  }
}
