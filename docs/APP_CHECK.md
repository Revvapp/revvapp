# App Check enablement runbook

App Check attests that a request comes from **your genuine app binary** (Apple
App Attest / DeviceCheck, Android Play Integrity) rather than a script holding the
public Firebase config. Without it, anyone can call the callable Functions and hit
Firestore/Storage directly — bounded only by security rules and the two
rate-limited callables. Combined with marketplace reads, that makes
unauthenticated scraping and callable abuse cheap.

## What's already wired in the repo

The app uses the Firebase **JS** SDK, whose App Check providers are web-only, so
the code bridges native attestation into the JS SDK:

- `@react-native-firebase/app` + `@react-native-firebase/app-check` installed.
- Config plugins added to `app.json` `plugins`.
- [lib/appCheck.native.ts](../lib/appCheck.native.ts) — runs App Attest / Play
  Integrity via RNFB and feeds the token to the JS SDK through a `CustomProvider`.
- [lib/appCheck.ts](../lib/appCheck.ts) — web no-op (Metro picks the right one).
- [app/_layout.tsx](../app/_layout.tsx) — calls `setupAppCheck()` on boot.

`setupAppCheck()` is **guarded and inert**: it no-ops and never throws until the
steps below are done, so the current app, web build, and existing dev clients
behave exactly as before.

> ⚠️ **Build impact:** because the RNFB config plugins are now in `app.json`, the
> next native build (`eas build` / `expo prebuild` / `expo run:ios`) **requires**
> the two Google config files from Step 2. Until you add them, native builds fail.
> Metro/OTA on existing dev clients and the web build are unaffected. To fully back
> this out: `npm uninstall @react-native-firebase/app @react-native-firebase/app-check`,
> remove the two plugins from `app.json`, and delete `lib/appCheck*.ts` + the
> `setupAppCheck` call.

## Remaining steps (require your Firebase Console + a device build)

### 1. Register the apps (Console → App Check)
- **iOS** (`com.revvapp.revv`): enable **App Attest** (+ DeviceCheck fallback).
- **Android** (`com.revvapp.revv`): enable **Play Integrity** (enable the Play
  Integrity API in Google Cloud for the project).
- Leave every product **Unenforced** for now.

### 2. Add native Firebase config files
RNFB reads native config, not your `EXPO_PUBLIC_*` vars. Download from the Console
and place at the project root (already git-ignored):
- `GoogleService-Info.plist` (iOS)
- `google-services.json` (Android)

Then reference them in `app.json`:
```jsonc
"ios":     { "googleServicesFile": "./GoogleService-Info.plist", /* ... */ },
"android": { "googleServicesFile": "./google-services.json",     /* ... */ }
```

### 3. iOS capability + rebuild
Add the **App Attest** capability to the iOS entitlements, then do a full native
build (`eas build` or `expo run:ios`). App Check is not OTA-updatable.

### 4. Debug tokens (simulator & CI)
App Attest / Play Integrity don't verify on a simulator or in CI — the `'debug'`
provider in `appCheck.native.ts` prints a debug token on first run. Register each
printed token in **Console → App Check → Manage debug tokens**.

### 5. Monitor, then enforce  ⚠️ the step that prevents lockouts
1. Ship a build with App Check active but still **Unenforced**.
2. Watch the **verified vs. unverified** split for Firestore, Storage, and
   Functions until nearly all real-install traffic is verified (users need time
   to update).
3. Only then flip **Enforce** — Firestore first, then Storage, then callable
   Functions. Enforcing earlier rejects legitimate older clients.

## Keep in mind
- App Check is defense-in-depth, **not** a replacement for security rules — keep
  the server-owned trust boundary exactly as-is.
- Do **not** put App Check in front of `stripeWebhook` (an HTTP `onRequest`
  endpoint): it's protected by Stripe signature verification, and Stripe can't
  attest.
- App Attest only verifies on a **real device** — budget a device test pass.
- If you see RNFB namespaced-API deprecation warnings, switch `appCheck.native.ts`
  to the modular API (`initializeAppCheck`/`getToken` from
  `@react-native-firebase/app-check`); behavior is identical.
