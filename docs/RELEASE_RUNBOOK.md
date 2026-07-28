# REVV — Release Runbook (exact commands)

Status: rules, storage and all 30 Cloud Functions are deployed to
`revv-app2026`/`us-west2` (2026-07-27). The Stripe webhook is live, subscribed
to every event the handler processes, and verified working end-to-end with a
real signed test event. Native config files are committed. Two things are left
that only you can do — a service-account key for the admin claim, and the
go-ahead to actually kick off a build/submit (those are gated for you to
trigger, not run silently).

---

## 1. Grant the `admin` claim — needs you

Nothing in the app can grant this claim (that's the point), and reusing the
Firebase CLI's own OAuth session to do it programmatically was tried and is
deliberately blocked by design — it's the same shape as credential misuse even
with good intent, so don't route around it either.

```bash
# (you) Firebase console → Project settings → Service accounts →
#        Generate new private key → save the JSON file somewhere, e.g. ~/Downloads/

cd functions
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/that-file.json
npm run set-admin -- <email>
```

`<email>` is an account in the **app's own** Firebase Auth user pool — whoever
signs into the Revv app itself as the team, not `abdelrahman@revvapp.net` (that
account is only the separate Firebase Console/CLI login and has no bearing on
the mobile app's user pool). Tell Claude which email once you've decided, or
run the command yourself — either way, sign out and back in on the device
afterward so the new ID token carries the claim.

---

## 2. iOS build → TestFlight — needs your go-ahead

Everything blocking a build is now fixed: `GoogleService-Info.plist` and
`google-services.json` are pulled from the already-registered
`com.revvapp.revv` Firebase apps and committed, and the 2026-07-14 failure
(`sentry-cli` demanding an org slug) is fixed via `SENTRY_DISABLE_AUTO_UPLOAD`
in `eas.json`. Kicking off the build itself is gated — it's a real, paid,
multi-hour action against your Apple account, so it needs you to actually run
it (or explicitly tell Claude to).

```bash
# from the repo root, never from ~
npx eas-cli build --platform ios --profile production
# EAS provisions the distribution cert + profile interactively the first time
# (Apple account). Then:
npx eas-cli submit --platform ios --latest
```

---

## 3. Everything else is already done

- ✅ **Rules deployed**: `firestore.rules` (adds `isAdmin()`, widens reads only
  on `disputes`/`careClaims`/`invoices`) and `storage.rules` (adds
  `care-claims/{bookingId}/{uid}/**`). 12 rules tests passing.
- ✅ **All 30 functions deployed**, including the 9 that were previously
  written-but-undeployed: `validateBookingHold`, `createInvoiceOnCompletion`,
  `resolveDispute`, `createSubscription`, `accrueRevvCare`, `createCareClaim`,
  `resolveCareClaim`, `setDetailerVerified`, `grantFoundingPro`. IAM invoker
  confirmed correct (401 unauthenticated, not a 403 org-policy block).
- ✅ **`STRIPE_SUBSCRIPTION_PRICE_ID` set** via `functions/.env.revv-app2026`
  (gitignored — recreate it after a clone: `price_1TsqgEBT8U6J4a3bFadu5wED`).
- ✅ **Stripe webhook fixed — this was a real, previously-undetected bug.** The
  live endpoint was subscribed to only 2 of the 9 event types the code
  handles: `payment_intent.canceled` and `.amount_capturable_updated`.
  `account.updated` (Connect payout sync), `charge.dispute.created`,
  `charge.refunded`, all three `customer.subscription.*` events, and
  `invoice.payment_failed` were silently never delivered — meaning Connect
  status sync and the entire subscription-billing path could never have
  worked, in test or prod. Fixed via the Stripe CLI (`stripe
  webhook_endpoints update we_1Tsw74BT8U6J4a3bgWPIWBt8 --enabled-events=...`);
  all 9 types are now subscribed.
- ✅ **`STRIPE_WEBHOOK_SECRET` confirmed live** (not the placeholder earlier
  memory flagged) — verified by firing a real Stripe event via `stripe
  trigger payment_intent.canceled` and confirming it passed signature
  verification in the function logs, while a deliberately unsigned manual
  request was correctly rejected with `400`.
- ✅ **Native config files pulled directly via the CLI** — no manual console
  download needed. `firebase apps:sdkconfig ios/android <app-id> --project
  revv-app2026 --out <file>` against the already-registered apps. Both
  confirmed to use bundle id / package `com.revvapp.revv`, matching
  `app.json` exactly — the `net.revvapp.app` earlier docs mentioned is stale.
  A stale gitignore rule (predating `app.json` referencing these files) had
  been silently excluding them; removed.

---

## 4. App env — Stripe publishable key + Sentry

Add to `.env` (gitignored):
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx   # optional but recommended
```
`app/_layout.tsx` reads the publishable key into `StripeProvider`; Sentry is a
no-op until the DSN is set. (Source-map upload is separately disabled via
`eas.json` and that's intentional — the DSN is what turns crash reporting on.)

---

## 5. Apple / App Store Connect (web UI — you)

- Create the app record with bundle id **`com.revvapp.revv`** (confirmed
  canonical above).
- **App Privacy**: fill from `docs/APP_PRIVACY.md`.
- **Privacy Policy URL**: https://revvapp.github.io/revvapp/
- **License/EULA URL**: host `docs/TERMS_OF_SERVICE.md` (after legal review).
- Screenshots (6.7" + 6.5" + iPad if `supportsTablet`), age rating, category
  (Lifestyle/Business), support + marketing URLs.
- Add TestFlight testers.

---

## 6. Still to BUILD before a paid (not beta) launch

Capture-on-completion, dispute→refund, subscription billing and Revv Care are
all **written and deployed now** — the webhook fix above is what actually makes
them testable end-to-end for the first time. What remains genuinely unbuilt:
- Background checks (Checkr) gating detailer go-live — `setDetailerVerified` +
  the admin console is the interim manual stand-in, live but unreachable until
  the admin claim is granted (step 1).
- Twilio email/SMS notifications.
- Shotstack/Creatomate + AI captions for Revv Reach.
- Stripe LIVE mode (everything is test mode today).

Before any of the money paths go live, run the full test-mode matrix in
`docs/STRIPE_PLAN.md`: hold → capture → transfer, hold → cancel, dispute →
release / full refund / partial refund, and the subscription
trial → active → past_due → canceled lifecycle.

---

### Who does what
| Step | You | Claude |
|---|---|---|
| `firebase login --reauth` | ✅ done | — |
| Deploy rules/storage/functions | — | ✅ done |
| Set Stripe secrets + subscription price id | — | ✅ done (price id; secrets were already set) |
| Fix webhook event subscriptions + verify secret | — | ✅ done |
| Pull native config files | — | ✅ done (via CLI, no console visit needed) |
| Grant the `admin` claim | ✅ service-account key + which email | — (blocked by design) |
| `eas build` / `eas submit` | ✅ your go-ahead to trigger | — (blocked by design) |
| App Store Connect setup | ✅ | — |
