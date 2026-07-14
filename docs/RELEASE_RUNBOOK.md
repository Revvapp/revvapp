# REVV — Release Runbook (exact commands)

Steps that need **interactive login to your accounts** (Firebase, Expo, Stripe,
Apple) can only be run by you — they open a browser or prompt for secrets. Once
you've re-authed the Firebase CLI on this machine, Claude can run the non-secret
deploys for you. Run everything from the repo root unless noted.

Pre-checked for you: `functions` builds clean (`npm --prefix functions run build`),
`firebase.json` is wired for rules + indexes + storage + functions, and all app
type-checks/lints/tests pass.

---

## 1. Firebase — deploy hardened rules + functions

```bash
# (you) refresh the CLI token — fixes the current 401
firebase login --reauth

# (you) confirm the project is on the Blaze plan (Functions require it):
#   https://console.firebase.google.com/project/revv-app2026/usage/details

# rules + storage (safe; server-validates before applying) — Claude can run after reauth
firebase deploy --only firestore:rules,storage --project revv-app2026
```

### Stripe secrets (needed before the Stripe functions will run)
```bash
# (you) paste your Stripe TEST secret key (sk_test_...)
firebase functions:secrets:set STRIPE_SECRET_KEY --project revv-app2026

# Webhook secret has a chicken-and-egg — do it in this order:
#  a) deploy functions once to get the stripeWebhook URL
firebase deploy --only functions --project revv-app2026
#  b) copy the deployed stripeWebhook URL (shown in output, region us-west2)
#  c) in Stripe Dashboard → Developers → Webhooks → Add endpoint, paste that URL,
#     subscribe to: account.updated, payment_intent.amount_capturable_updated,
#     payment_intent.canceled  → Stripe shows a signing secret (whsec_...)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project revv-app2026
#  d) redeploy so the secret binds
firebase deploy --only functions --project revv-app2026
```

### Verify
```bash
firebase functions:list --project revv-app2026   # should list notifications, stripe, ratings, etc.
```
Expected functions: `onBookingCreated`, `onBookingStatusChanged`, `onMessageCreated`,
`onDisputeCreated`, `onDisputeUpdated`, `onReviewCreated`, `onReportCreated`,
`aggregateDetailerRating`, `syncVehicleLastDetailed`, `createConnectAccount`,
`getConnectStatus`, `createBookingPaymentIntent`, `cancelHoldOnBookingEnd`,
`stripeWebhook`.

---

## 2. App env — Stripe publishable key + Sentry

Add to `.env` (never commit it — `.env` is gitignored):
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx   # optional but recommended
```
`app/_layout.tsx` reads the publishable key into `StripeProvider`; Sentry is a
no-op until the DSN is set.

---

## 3. EAS — fixes push notifications + build pipeline

```bash
eas login                 # (you) Expo account
eas init                  # creates the EAS project and writes
                          # expo.extra.eas.projectId into app.json  → commit that change
```
`eas.json` (build/submit profiles) is already in the repo. After `eas init`,
push-token registration will succeed (the `__DEV__` "no projectId" warning will
stop firing).

---

## 4. iOS build → TestFlight

```bash
# internal test build (managed credentials — EAS provisions the distribution cert
# + provisioning profile interactively the first time; needs your Apple account)
eas build -p ios --profile preview

# or a store build, then submit to App Store Connect / TestFlight
eas build -p ios --profile production
eas submit -p ios --latest
```

---

## 5. Apple / App Store Connect (web UI — you)

- Create the app record with bundle id **`net.revvapp.app`**.
- **App Privacy**: fill from `docs/APP_PRIVACY.md`.
- **Privacy Policy URL**: https://revvapp.github.io/revvapp/
- **License/EULA URL**: host `docs/TERMS_OF_SERVICE.md` (after legal review).
- Screenshots (6.7" + 6.5" + iPad if `supportsTablet`), age rating, category
  (Lifestyle/Business), support + marketing URLs.
- Add TestFlight testers.

---

## 6. Still to BUILD before a paid (not beta) launch

These aren't deploy steps — they're code, and belong in Stripe test mode first
(see `docs/STRIPE_PLAN.md` and `docs/RELEASE_CHECKLIST.md`):
- **Capture-on-completion + dispute-window release** — the #1 gap; holds are
  placed today but never captured, so no one is charged/paid.
- Dispute → refund path.
- Detailer subscription billing ($34.99/mo) + trial/Founding Pro.
- Revv Care accrual + claims.
- Background checks (Checkr) gating detailer go-live.

---

### Who does what
| Step | You (interactive login/secret) | Claude (after your reauth) |
|---|---|---|
| `firebase login --reauth` | ✅ | — |
| Set Stripe secrets | ✅ | — |
| Deploy rules/storage/functions | — | ✅ (or you) |
| `eas login` / `eas init` | ✅ | — |
| `eas build` / `eas submit` | ✅ (Apple creds) | — |
| App Store Connect setup | ✅ | — |
| Build capture-on-completion (code) | — | ✅ (test mode) |
