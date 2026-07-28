# REVV — Release Readiness Checklist

Status as of the current branch. ✅ done · 🟠 in progress / needs verification ·
🔴 blocker · ⬜ not started. Grouped by what stops a launch first.

Companion docs: `RELEASE_RUNBOOK.md` (exact commands), `STRIPE_PLAN.md`,
`APP_CHECK.md`, `APP_PRIVACY.md`.

---

## 🔴 Blockers remaining

### iOS build — config unblocked, no build kicked off yet
- ✅ **Firebase native config files are in place.** `GoogleService-Info.plist`
  and `google-services.json` were pulled straight from the already-registered
  Firebase apps via `firebase apps:sdkconfig` and are committed (they were
  previously hard-gitignored by a stale template rule that predated app.json
  referencing them — fixed).
- ✅ **Bundle id confirmed.** Both registered Firebase apps use
  `com.revvapp.revv`, matching `app.json` exactly. The `net.revvapp.app` these
  docs once recorded is stale; `com.revvapp.revv` is canonical — use it in App
  Store Connect.
- ✅ The 2026-07-14 build failure (`sentry-cli … An organization ID or slug is
  required`) is fixed — `SENTRY_DISABLE_AUTO_UPLOAD=true` on the `preview` and
  `production` profiles in `eas.json`.
- ⬜ **No build has been kicked off with the fix in place.** Run
  `npx eas-cli build --platform ios --profile production` from the repo root,
  then `npx eas-cli submit --platform ios --latest`. EAS provisions the
  distribution cert + profile interactively the first time (Apple credentials).

### Cloud Functions — ✅ deployed 2026-07-27
All 30 functions are live on `revv-app2026`/`us-west2`, including the 9 that
were previously written-but-undeployed: `validateBookingHold`,
`createInvoiceOnCompletion`, `resolveDispute`, `createSubscription`,
`accrueRevvCare`, `createCareClaim`, `resolveCareClaim`, `setDetailerVerified`,
`grantFoundingPro`. IAM invoker confirmed working on all of them (401
unauthenticated, not a 403 org-policy block). `STRIPE_SUBSCRIPTION_PRICE_ID` is
set via `functions/.env.revv-app2026` (gitignored — recreate after a clone; the
price id is `price_1TsqgEBT8U6J4a3bFadu5wED`).

- ⬜ **`admin` claim not yet granted to anyone** — the admin console
  (`app/admin/`) is unreachable until it is. Needs a service-account key (no
  `gcloud` on this machine, and reusing the Firebase CLI's own OAuth session for
  this was tried and is deliberately blocked — see `set-admin` in the runbook)
  and a decision on *which* app-user email should hold it — that's an account in
  the app's own Firebase Auth user pool (whoever signs into the Revv app as the
  team), not the `abdelrahman@revvapp.net` Console/CLI login.
- ⚠️ **Deploy-order note is now moot for the current build** (no build has ever
  shipped to a real user), but keep it in mind going forward: ship an app build
  before redeploying `createInvoiceOnCompletion` again in the future, or an
  older before/after screen in the wild would skip the photo upload.

### Rules — ✅ deployed 2026-07-27
- ✅ `firestore.rules`: `isAdmin()` helper widening **reads only** on
  `disputes`, `careClaims`, `invoices` (not `bookings`, deliberately).
- ✅ `storage.rules`: `care-claims/{bookingId}/{uid}/**`, client-only read.
- ✅ 12 rules tests passing, including one asserting the admin claim grants no
  writes anywhere.

### Stripe webhook — ✅ fixed 2026-07-27, real bug found
- 🔴→✅ **The live webhook endpoint was only subscribed to 2 of the 9 event
  types the handler processes** (`payment_intent.canceled` and
  `.amount_capturable_updated` only). `account.updated` (Connect payout sync),
  `charge.dispute.created`, `charge.refunded`, all three
  `customer.subscription.*` events, and `invoice.payment_failed` were being
  silently dropped — Connect status sync and the entire subscription billing
  path could never have worked. Fixed via the Stripe CLI; all 9 event types are
  now subscribed.
- ✅ `STRIPE_WEBHOOK_SECRET` confirmed to be a real, working value (not the
  placeholder noted in earlier memory) — verified by firing a real Stripe test
  event and confirming it passed signature verification, while a deliberately
  unsigned request was correctly rejected.

---

## 🟠 Required for App Store submission

- ⬜ **Terms of Service** — draft at `docs/TERMS_OF_SERVICE.md`; needs legal
  review + a hosted URL.
- ✅ Privacy Policy — hosted at https://revvapp.github.io/revvapp/
- ✅ In-app account deletion — wired in both edit-profile screens.
- ✅ Encryption compliance flag, permission usage strings — in `app.json`.
- ✅ Bundle id / native config — see above.
- ⬜ **App Privacy "nutrition label"** in App Store Connect (answers prepared in
  `docs/APP_PRIVACY.md`).
- ⬜ App Store Connect record: screenshots, age rating, support & marketing URLs,
  category.
- ⬜ TestFlight beta before public release.
- 🟠 **Sentry DSN unset** — `EXPO_PUBLIC_SENTRY_DSN` is absent from `.env`, so
  crash monitoring is a no-op.

---

## 🟡 Trust, safety & business gates

- ✅ **Interim manual verification** — `setDetailerVerified` + the admin console
  stand in for Checkr, deployed but unreachable until the `admin` claim is
  granted (see above).
- ✅ Marketplace visibility gates on `detailers.isActive`, written only by the
  Stripe subscription webhook (now correctly receiving its events).
- ⬜ Checkr, Twilio (email/SMS), Shotstack/Creatomate + AI captions for Reach.
- ⬜ **Stripe LIVE mode.** Everything is test mode today.
- ✅ **1099 tax reporting — code already delegates correctly to Stripe.**
  `createConnectAccount` uses Accounts v2 recipient onboarding with
  `collection_options: { fields: 'eventually_due', future_requirements: 'include' }`,
  which is Stripe's own hosted flow for collecting the identity/tax info (SSN or
  EIN) 1099 reporting needs — no custom W-9 form should be built. The one
  remaining step is a Stripe **Dashboard** setting, not code: enable 1099 tax
  reporting for connected accounts under Connect settings → Tax forms, before
  switching to LIVE mode. Nothing in code or CI can verify this — it has to be
  checked by hand in the dashboard.

---

## ⚪ Quality / hardening

- 🟠 **Tests are thin.** 21 unit tests over pure logic + 12 rules tests. The
  money math and booking state machine are still uncovered.
- ⬜ **Full manual QA of the critical path**, in Stripe test mode: signup (both
  roles) → Connect onboarding → subscription trial → booking + card hold → VIR →
  client sign → timer → complete → capture → invoice → dispute → resolve →
  Revv Care claim → review. The webhook fix above makes this newly *possible*
  to actually test end-to-end — it wasn't before.
- 🟠 **App Check is inert.** The bridge is wired and the config files it needs
  now exist, but it still needs console registration (App Attest / Play
  Integrity), a native rebuild, and a monitor→enforce rollout. See
  `docs/APP_CHECK.md`.
- ✅ **CI added** (`.github/workflows/ci.yml`) — lint, typecheck and unit tests
  on the app, a build (typecheck) on `functions`, and the Firestore/Storage
  rules tests against the emulator, all on push/PR to `main`. Previously none
  of this ran automatically; this session alone found two silent bugs (the
  webhook's missing event subscriptions, a stale gitignore rule hiding the
  Firebase config files) that only manual checking caught.
- ✅ **Trust & safety reports now have an admin console** (`/admin/reports`) —
  previously logged to Cloud Logging only with no way to ever clear one. New
  `resolveReport` callable marks a report reviewed/dismissed; `reports` reads
  widened for `isAdmin()` the same way disputes/claims were.
- ✅ **Notification gaps closed**: dispute resolution now sends the actual
  outcome (release/refund/partial) to *both* parties — previously the message
  was hardcoded to "payment released" regardless of outcome, and the detailer
  was never notified of a resolution at all. Revv Care claim decisions now
  notify the filing client (there was no trigger previously — a client had no
  way to learn a claim's outcome short of emailing support), and the
  `care-claim/[id]` screen now shows status/outcome if a claim already exists
  instead of only ever being a filing form. Subscription `past_due`/`canceled`
  transitions now notify the detailer (previously silent — a detailer could
  lose marketplace visibility with no idea why).
- ✅ **Rate limiting extended** to `createDispute` and `createCareClaim` (5 per
  24h per user) — previously only Connect onboarding, booking payment intents,
  and subscription creation were limited.
- ✅ **In-app Help & Support screen** (`/help`) — FAQ + support email, linked
  from both profile screens.

---

## What's left, in order
1. Grant the `admin` claim (needs a service-account key + a decision on which
   app-user email).
2. Kick off `eas build --platform ios --profile production` → submit to
   TestFlight.
3. Run the critical-path QA in Stripe test mode — now unblocked by the webhook
   fix.
4. App Store Connect: record, App Privacy, screenshots, ToS legal review +
   hosting, Sentry DSN.
5. Enable 1099 tax reporting for connected accounts in the Stripe Dashboard
   (Connect settings → Tax forms) before LIVE mode.
6. Checkr, Twilio, Reach AI captions, Stripe LIVE mode — the remaining
   externally-blocked or intentionally-deferred items.
