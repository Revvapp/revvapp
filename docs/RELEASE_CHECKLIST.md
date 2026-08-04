# REVV — Release Readiness Checklist

Status as of the current branch. ✅ done · 🟠 in progress / needs verification ·
🔴 blocker · ⬜ not started. Grouped by what stops a launch first.

Companion docs: `RELEASE_RUNBOOK.md` (exact commands), `STRIPE_PLAN.md`,
`APP_CHECK.md`, `APP_PRIVACY.md`.

---

## 🔴 Blockers remaining

### EAS build environment — ✅ fixed 2026-08-04, would have shipped a dead app
- 🔴→✅ **EAS had no environment variables at all.** `firebaseConfig.js` /
  `firebaseConfig.native.js` read `EXPO_PUBLIC_FIREBASE_*` from `process.env`,
  which Expo inlines at bundle time. `.env` is gitignored, so it never reaches
  the EAS build servers — a production build would have shipped with
  `apiKey: undefined` and crashed on launch for every user. All seven
  publishable values are now set on the EAS project for the `production` and
  `preview` environments (`npx eas-cli env:list --environment production` to
  verify). They are `plaintext` visibility deliberately: every one of them is
  already inlined into the client bundle, so treating them as secret would be
  false comfort.
- 🔴→✅ **The Storage bucket was wrong and pointed at nothing.** `.env` had
  `revv-app2026.appspot.com`; both native config files say
  `revv-app2026.firebasestorage.app`. Confirmed by request: `.appspot.com`
  returns **404 (no such bucket)** and `.firebasestorage.app` returns 403
  (exists, anonymous listing correctly denied). Every upload path — VIR photos,
  before/after photos, dispute evidence, Revv Care claim photos — was aimed at a
  bucket that does not exist. Fixed in `.env` and on EAS.
- ⚠️ **`EXPO_PUBLIC_FIREBASE_APP_ID` is the *Android* app id**
  (`1:87072671490:android:…`) but is used by the Firebase **JS** SDK on both
  platforms. Auth, Firestore and Storage key off `apiKey` + `projectId` and were
  verified working, so this is not currently breaking anything, but it is wrong:
  register a **Web** app in the Firebase console and use that app id. Verifying
  which apps are registered needs a valid Firebase CLI login.
- ✅ The web `EXPO_PUBLIC_FIREBASE_API_KEY` was verified valid against the
  Identity Toolkit API (returns `INVALID_LOGIN_CREDENTIALS`, not
  `API key not valid`).

### iOS build — config unblocked, no successful build yet
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

- 🟠 **Terms of Service — page built, still needs counsel.** `docs/terms.html`
  is written and styled to match the privacy policy; once merged to `main` it
  serves at https://revvapp.github.io/revvapp/terms.html. Every figure in it was
  checked against what the code actually enforces (10% platform fee, 24h dispute
  window, 72h / $2,500 Revv Care claim, $34.99/mo with 14-day trial — 60 for
  Founding Pro, 1–4 day booking window), so counsel is reviewing the real
  product. **Do not merge to `main` or submit the URL to App Store Connect while
  the highlighted placeholders remain** — legal entity, state, mailing address,
  liability limits and the arbitration clause are the items only you or counsel
  can supply. They render as loud dashed-amber boxes so a half-finished page
  cannot be published by accident.
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

- ✅ **Money math and the booking state machine are now covered.** 59 new tests
  in `functions/test/` (`npm test` in `functions/`, wired into CI), on top of the
  21 app tests and 12 rules tests. To make them meaningful rather than a parallel
  reimplementation, the logic was first extracted out of the Stripe call sites
  into two pure modules that production now actually calls:
  - `functions/src/money.ts` — the 90/10 split, the 1% Revv Care accrual, the
    partial-refund split and rate-card parsing. The 90/10 split had been written
    out inline in **three** places; it is now one function, asserted to always
    sum back to the captured amount so rounding can never push a transfer past
    what the source charge made available.
  - `functions/src/bookingRules.ts` — the transition table, timer arithmetic and
    booking-date window. Tests sweep every action against every state and both
    parties, so "can a client complete their own job?" has an asserted answer.
  Two robustness fixes fell out of writing them: a corrupt `timerAccumulated‑
  Seconds` used to produce `NaN` (which Firestore rejects, failing the whole
  transition and stranding a job mid-service), and `captureAndTransfer` now
  returns the captured amount so the Care reserve accrues against what Stripe
  actually charged rather than the booking document's copy of the price.
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

Everything below needs a credential, a payment, a human decision or a web UI —
there is no remaining code work blocking a build.

1. **`firebase login --reauth`** — the CLI session expired again (2026-08-04),
   which blocks redeploying functions/rules and enumerating registered Firebase
   apps (needed to settle the Web-vs-Android app id above).
2. **Grant the `admin` claim** — needs a service-account key *and* a decision on
   which app-user email holds it. The admin console (`app/admin/`) is unreachable
   until then, which also means `setDetailerVerified` cannot be used and no
   detailer can be marked verified.
3. **Finish the iOS build → TestFlight.** The build environment is fixed as of
   this round; the remaining unknown is whether the Apple distribution
   credentials EAS provisioned for the 2026-07-14 attempt are still valid.
4. **Critical-path QA in Stripe test mode** — signup → Connect onboarding →
   subscription trial → booking + hold → VIR → sign → timer → complete →
   capture → invoice → dispute → resolve → Revv Care claim → review.
5. **ToS legal review** (see above), then merge `docs/terms.html` to `main`.
6. **App Store Connect**: app record, App Privacy, screenshots, category, age
   rating, support/marketing URLs. Sentry DSN.
7. **Enable 1099 tax reporting** for connected accounts in the Stripe Dashboard
   (Connect settings → Tax forms) before LIVE mode.
8. **Checkr, Twilio, Reach AI captions, Stripe LIVE mode** — the remaining
   externally-blocked or intentionally-deferred items.
