# Stripe Payment Layer

Current implementation uses Stripe test mode, Accounts v2 recipient onboarding,
manual-capture PaymentIntents, and separate charges and transfers.

## Security boundaries

- Secret and webhook keys exist only in Firebase Functions secrets.
- The app receives only the publishable key and PaymentIntent client secret.
- Prices, fees, recipients, capture, transfers, and refunds are server-controlled.
- Stripe webhook signatures are verified and event IDs are processed idempotently.
- Firestore rules prevent clients from changing Stripe identity or financial fields.

## Implemented flow

1. `createConnectAccount` creates an Accounts v2 connected account configured as
   a recipient and returns a single-use onboarding link. Existing v1 accounts remain
   supported during migration.
2. `getConnectStatus` checks the recipient's `stripe_transfers` capability.
3. `createBookingPaymentIntent` derives the price and recipient from Firestore,
   revalidates transfer readiness, creates a manual-capture platform charge, and
   assigns an opaque transfer group.
4. `finalizeBooking` accepts only valid dates one to four days ahead so the card
   authorization remains usable through service completion and the dispute window.
5. `releaseHoldsAfterDisputeWindow` runs every 30 minutes. For an undisputed job
   completed at least 24 hours earlier, it captures the charge and creates an
   idempotent separate Transfer of 90% to the detailer.
6. `stripeWebhook` verifies signatures and reconciles payment state. A Stripe event
   ledger prevents duplicate processing.

The platform keeps 10% before Stripe fees. Because the platform is the charge owner,
Stripe processing fees and chargebacks affect the platform balance; finance should
confirm that this matches the business model.

## Test-mode acceptance checks

- Complete recipient onboarding and confirm `payoutsEnabled` becomes true.
- Book with Stripe's standard successful test card and confirm the PaymentIntent is
  `requires_capture` and the booking is finalized only after authorization.
- Complete a job and verify no release occurs before 24 hours.
- Verify the scheduler captures the charge once and creates exactly one 90% Transfer.
- Open a dispute before release and verify neither capture nor Transfer occurs.
- Exercise declined cards, abandoned onboarding, expired authorization, webhook
  retries, duplicate scheduler runs, refund handling, and account capability loss.

## Remaining product work

- Admin dispute resolution with audited full/partial refunds.
- Detailer subscription billing and marketplace eligibility policy.
- Revv Care reserve/claims ledger and accounting policy.
- Confirm the deployed webhook event subscription in Stripe Dashboard test mode.
- Run a full test-mode transaction before any live-mode enablement.
