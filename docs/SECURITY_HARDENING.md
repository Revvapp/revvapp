# Security hardening and deployment gate

The repository uses a server-owned trust boundary for payment and liability
records. Mobile clients may read records they participate in, but they cannot
write bookings, invoices, disputes, Stripe state, lifecycle timestamps, or
finalized evidence directly.

## Security workflows

- `finalizeBooking` validates the authenticated client, Stripe hold, detailer,
  vehicle ownership and amount. The PaymentIntent id is the booking id, so a
  hold cannot be replayed into multiple bookings.
- `transitionBooking` enforces actor-specific, ordered state transitions and
  derives lifecycle/timer timestamps on the server.
- `createDispute` atomically creates one dispute per booking and freezes its
  invoice during the 24-hour window.
- `respondToDispute` appends one detailer response without allowing either
  party to alter the original evidence or resolve funds.
- `releaseHoldsAfterDisputeWindow` atomically claims eligible captures and
  rechecks the server-owned release time and dispute record.
- `attachAfterPhotos` finalizes completion evidence and makes its Storage path
  immutable afterward.
- `deleteMyAccount` requires recent reauthentication and performs privileged
  profile cleanup before deleting the Auth identity.

## Mandatory deployment order

Do not deploy the restrictive Firestore rules before deploying the matching
Cloud Functions and mobile build. Old clients write sensitive collections
directly and will fail after the rules are active.

1. Create a staging Firebase project and configure Stripe test-mode secrets.
2. Deploy Cloud Functions to staging.
3. Build the updated mobile app against staging.
4. Deploy Firestore indexes, Firestore rules, and Storage rules to staging.
5. Run `npm run test:security` and the complete Stripe test-mode matrix.
6. Verify account deletion, dispute evidence access, push notifications, and
   Cloud Logging in staging.
7. Release the compatible mobile build before applying production rules, or
   use a coordinated maintenance window so legacy clients cannot write.
8. Deploy production Functions, then rules, and monitor errors/capture logs.

## Console actions still required

- Enable Firebase App Check for the native apps, validate token delivery, then
  enforce it for Firestore, Storage, and callable Functions.
- Configure budget alerts, function error alerts, Stripe webhook alerts, and
  failed-capture monitoring.
- Set and verify `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Secret
  Manager; never place them in Expo environment variables.
- Register the Stripe webhook and verify its signing secret and event list.
- Establish an admin-only dispute-resolution process. The app intentionally
  contains no participant-accessible release action for disputed funds.
- Establish server-side subscription/background-check logic that sets
  `detailers.isActive`. New profiles remain inactive by default.
- Require MFA and least-privilege roles for Firebase/GCP, Stripe, Expo/EAS,
  GitHub, Apple, and Google Play accounts.
- Decide and document financial-record and dispute-evidence retention periods.

## Local verification

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand --watchman=false
npm run test:security
npm --prefix functions run build
npm audit
npm --prefix functions audit
```

The emulator tests are in `security-tests/rules.test.cjs` and cover direct
booking/payment mutation, dispute bypass, entitlement escalation, email
enumeration, private dispute evidence, finalized evidence, and upload types.
