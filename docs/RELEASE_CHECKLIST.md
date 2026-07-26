# REVV — Release Readiness Checklist

Status as of the current branch. ✅ done · 🟠 in progress / needs verification ·
🔴 blocker · ⬜ not started. Grouped by what stops a launch first.

Companion docs: `RELEASE_RUNBOOK.md` (exact commands), `STRIPE_PLAN.md`,
`APP_CHECK.md`, `APP_PRIVACY.md`.

---

## 🔴 Blockers — must clear before a build exists

### iOS build — no successful build yet
- 🔴 **Firebase native config files are missing.** `app.json` loads
  `@react-native-firebase/app` + `@react-native-firebase/app-check`, and their
  config plugin **throws during prebuild** if the file is absent. `app.json` now
  points at `./GoogleService-Info.plist` and `./google-services.json`; both must
  be downloaded from the Firebase console (Project settings → Your apps) and
  **committed** — `ios/` and `android/` are gitignored, so EAS regenerates them
  from `app.json` on every build and cannot see uncommitted files.
- ✅ The 2026-07-14 build failure is already fixed. It errored on
  `sentry-cli … An organization ID or slug is required`;
  `SENTRY_DISABLE_AUTO_UPLOAD=true` is now set on the `preview` and `production`
  profiles in `eas.json`.
- ⚠️ **Bundle id changed.** It is now `com.revvapp.revv` (`app.json`), not the
  `net.revvapp.app` these docs previously recorded. Whatever is registered in
  App Store Connect must match this exactly — decide which one is canonical
  before creating the app record.
- ⬜ Distribution signing — EAS provisions the cert + profile interactively on
  the first store build.

### Cloud Functions — code written, NOT deployed
The following are committed and type-clean but have never been deployed. Verify
in Stripe **test mode** first, then `firebase deploy --only functions`:

`validateBookingHold`, `createInvoiceOnCompletion`, `resolveDispute`,
`createSubscription`, `accrueRevvCare`, `createCareClaim`, `resolveCareClaim`,
`setDetailerVerified`, `grantFoundingPro`.

- ⚠️ **Deploy order matters:** ship the updated app build **before**
  `createInvoiceOnCompletion`, or the old create-only before/after screen will
  skip the photo upload.
- ⬜ `STRIPE_SUBSCRIPTION_PRICE_ID` must be set or `createSubscription` throws
  `failed-precondition`. The Revv Pro price is `price_1TsqgEBT8U6J4a3bFadu5wED`.
- ⬜ Grant the `admin` claim to at least one account, or no admin capability is
  reachable: `cd functions && npm run set-admin -- <email>`.
- ℹ️ The Firebase CLI token on this machine is expired — `firebase login --reauth`
  is required before any deploy, and it expires quickly.

### Rules — changed, NOT deployed
- ✅ `firestore.rules`: added an `isAdmin()` helper (reads the `admin` custom
  claim) and widened **reads only** on `disputes`, `careClaims` and `invoices` so
  the console can list open cases. `bookings` was deliberately **not** widened.
- ✅ `storage.rules`: added `care-claims/{bookingId}/{uid}/**`, readable only by
  the filing client — unlike a dispute, the detailer must never see it.
- ✅ Covered by `npm run test:security` (12 tests passing, including one that
  asserts the admin claim grants no writes anywhere).
- ⬜ Both files still need `firebase deploy --only firestore:rules,storage`.

---

## 🟠 Required for App Store submission

- ⬜ **Terms of Service** — draft at `docs/TERMS_OF_SERVICE.md`; needs legal
  review + a hosted URL.
- ✅ Privacy Policy — hosted at https://revvapp.github.io/revvapp/
- ✅ In-app account deletion — wired in both edit-profile screens.
- ✅ Encryption compliance flag, permission usage strings — in `app.json`.
- ⬜ **App Privacy "nutrition label"** in App Store Connect (answers prepared in
  `docs/APP_PRIVACY.md`).
- ⬜ App Store Connect record: screenshots, age rating, support & marketing URLs,
  category. Bundle id per the warning above.
- ⬜ TestFlight beta before public release.
- 🟠 **Sentry DSN unset** — `EXPO_PUBLIC_SENTRY_DSN` is absent from `.env`, so
  crash monitoring is a no-op. (Source-map *upload* is separately disabled and
  that is fine; the DSN is what turns reporting on at all.)

---

## 🟡 Trust, safety & business gates

- ✅ **Interim manual verification** — `setDetailerVerified` + the admin console
  stand in for Checkr. Real background checks are still unbuilt.
- ✅ Marketplace visibility gates on `detailers.isActive`, which only the Stripe
  subscription webhook writes.
- ⬜ Checkr, Twilio (email/SMS), Shotstack/Creatomate + AI captions for Reach.
- ⬜ **Stripe LIVE mode.** Everything is test mode today.

---

## ⚪ Quality / hardening

- 🟠 **Tests are thin.** 21 unit tests over pure logic + 12 rules tests. The
  money math and booking state machine are still uncovered.
- ⬜ **Full manual QA of the critical path**, in Stripe test mode: signup (both
  roles) → Connect onboarding → subscription trial → booking + card hold → VIR →
  client sign → timer → complete → capture → invoice → dispute → resolve →
  Revv Care claim → review.
- 🟠 **App Check is inert.** The bridge is wired but needs console registration
  (App Attest / Play Integrity), the config files above, a native rebuild, and a
  monitor→enforce rollout. See `docs/APP_CHECK.md`.

---

## Fastest path to a TestFlight beta (test-mode money only)
1. Download + commit `GoogleService-Info.plist` and `google-services.json`.
2. `firebase login --reauth`, then deploy rules, storage and functions.
3. Set `STRIPE_SUBSCRIPTION_PRICE_ID`; grant yourself the `admin` claim.
4. `npx eas-cli build --platform ios --profile production` (run from the repo
   root, never `~`) → `npx eas-cli submit --platform ios --latest`.
5. Run the critical-path QA above in test mode before inviting anyone.
