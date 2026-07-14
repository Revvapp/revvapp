# REVV — Release Readiness Checklist

Status as of the current branch. ✅ done · 🟠 in progress / needs verification ·
🔴 blocker · ⬜ not started. Grouped by what stops a launch first.

---

## 🔴 Blockers — must clear before real transactions

### Payments (Stripe) — Phases 1–2 built, Phase 3 missing
The layer is real: Connect Express onboarding, manual-capture card holds at
booking, hold cancellation on decline/cancel, and a signature-verified idempotent
webhook all exist in `functions/src/stripe.ts` + `lib/payments.ts`.

- ✅ Connect onboarding (`createConnectAccount`, `getConnectStatus`, `account.updated`)
- ✅ Card hold at booking (`createBookingPaymentIntent`, manual capture, server-derived amount)
- ✅ Cancel hold on booking end (`cancelHoldOnBookingEnd`)
- ✅ Webhook w/ signature verification + `stripeEvents` idempotency ledger
- 🔴 **Capture on job completion is NOT implemented.** Nothing calls
  `paymentIntents.capture()` when a booking → `completed`. Holds are placed but the
  card is never charged and the Detailer is never paid — the authorization simply
  expires (~7 days). **This is the single most important gap.**
  - Design decision required: the PaymentIntent uses `transfer_data.destination`,
    so capture transfers to the Detailer immediately. To honor the 24-hour dispute
    window you likely need **separate charges & transfers** (capture on completion,
    hold the transfer, release after the window) rather than capture-on-completion.
  - Build + test in **Stripe test mode** end-to-end before enabling live keys.
- ⬜ Auto-release / transfer after the 24h dispute window (server-side, scheduled)
- ⬜ Dispute → refund / partial-refund path
- ⬜ Detailer subscription billing ($34.99/mo) + trial/Founding Pro
- ⬜ Revv Care fund accrual + claims
- ⚠️ The legacy **client-side** invoice auto-release (`app/client/invoice/[id].tsx`)
  still flips status in the UI; it does not move money and should be replaced by the
  server-side release above.

### Security rules — fixed in code, NOT deployed
- ✅ Hardened rules committed (review-target binding, VIR/after photo access,
  detailer trust fields, invoice financials).
- 🔴 **Not deployed** — the live project still runs the old vulnerable rules.
  Run `firebase login --reauth` then
  `firebase deploy --only firestore:rules,storage --project revv-app2026`.

### Cloud Functions — deployment unverified
- ✅ Code exists: notifications, reports, ratings aggregation, vehicle sync, Stripe.
- 🔴 `firebase functions:list` failed on auth, so deployment is **unconfirmed**.
  If not deployed: no push sends, no report logging, ratings never aggregate, and
  **no Stripe function works**. Requires Blaze plan + `firebase login --reauth`
  + `firebase deploy --only functions`. Verify secrets are set:
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (`firebase functions:secrets:set`).

### Push notifications — non-functional
- 🔴 No EAS `projectId` and no `eas.json`, so `getExpoPushTokenAsync` fails and no
  token is ever saved. Run `eas init`, add `expo.extra.eas.projectId` to app.json.
  (A `__DEV__` warning now fires so this is visible during development.)

---

## 🟠 Required for App Store submission

- ⬜ **Terms of Service** — draft added at `docs/TERMS_OF_SERVICE.md`; needs legal review + a hosted URL.
- ✅ Privacy Policy — hosted at https://revvapp.github.io/revvapp/
- ✅ In-app account deletion — wired in both edit-profile screens.
- ✅ iOS bundle id — `net.revvapp.app` (app.json + native project in sync).
- ✅ Encryption compliance flag — `ITSAppUsesNonExemptEncryption: false` in app.json.
- ✅ Permission usage strings — location, camera, photos present in app.json.
- ⬜ **App Privacy "nutrition label"** in App Store Connect (you collect email, location, photos).
- ⬜ **Distribution signing** — currently a development profile; needs an App Store provisioning profile + distribution cert (via `eas build` or Xcode archive).
- ⬜ App Store Connect record: screenshots, age rating, support & marketing URLs, category.
- ⬜ TestFlight beta before public release.
- 🟠 **Sentry DSN** unset → crash monitoring is a no-op. Set `EXPO_PUBLIC_SENTRY_DSN` for production.

---

## 🟡 Trust, safety & business gates (product decisions)

- ⬜ **Background checks** (Checkr) — business rules gate a Detailer going live on this; not built. Real liability consideration for in-home service.
- ⬜ Marketplace visibility gate on active subscription (part of the Stripe subscription work).

---

## ⚪ Quality / hardening

- ⬜ **No automated tests.** Initial unit tests added for pure logic (`__tests__/`); expand to cover the money math and booking state machine.
- ⬜ Manual QA of the critical path: signup (both roles) → Connect onboarding → booking + card hold → VIR → client sign → timer → complete → **capture** → invoice → dispute → review.
- 🟠 Known sharp edges (documented): cold-start-offline auth fallback, and the legacy client-side invoice release noted above.

---

## Fastest path to a TestFlight beta (no real money yet)
1. `firebase login --reauth`
2. Deploy rules + storage, and functions (with Stripe secrets set).
3. `eas init` → add projectId → `eas build -p ios --profile preview` → TestFlight.
Detailers/Clients can then trial the full flow while capture-on-completion,
subscriptions, and background checks are finished for the paid launch.
