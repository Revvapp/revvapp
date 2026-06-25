# Stripe Payment Layer — Implementation Plan

The single largest remaining gap. Everything below the UI exists (booking, VIR,
timer, invoice, dispute, review screens all write real Firestore docs) — but no
money moves. There is **zero** Stripe code in the repo today (`grep -ri stripe`
returns nothing). This document is the build plan.

> **Security non-negotiables** (from `REVV_Context.md`): Stripe secret keys live
> **server-side only** (Cloud Functions), all payment logic is server-side, and
> every webhook is signature-verified. The client never sees a secret key.

---

## 0. Prerequisites (you, not code)

| Step | Owner | Notes |
|---|---|---|
| Upgrade `revv-app2026` to the **Blaze** plan | You | Cloud Functions + outbound network to Stripe require it |
| `firebase login --reauth` | You | CLI token is currently stale — `functions:list` fails with `401 UNAUTHENTICATED`. Must be fixed before any function deploy |
| Create a **Stripe account**, enable **Connect** (Express) | You | Use **test mode** keys first |
| Add Stripe keys to Functions secrets | You | `firebase functions:secrets:set STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Never commit them |
| Add publishable key to the app | You | `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env` (publishable key is safe client-side) |

---

## 1. Architecture

```
Expo app  ──callable──▶  Cloud Functions  ──API──▶  Stripe
(PaymentSheet,          (holds STRIPE_SECRET_KEY,    (PaymentIntents,
 publishable key)        all money logic)             Connect, Transfers)
     ▲                          │
     └──────── Firestore ◀──────┘  (webhooks write status back)
```

- **Client**: `@stripe/stripe-react-native` for PaymentSheet / card entry only.
  Holds the **publishable** key. Calls Functions; never talks to Stripe directly
  for anything sensitive.
- **Cloud Functions**: the only place the **secret** key exists. Exposes
  `httpsCallable` functions for the app, an HTTPS webhook endpoint for Stripe,
  and a scheduled function for auto-release.
- **Firestore**: source of truth for app state. Webhooks reconcile Stripe →
  Firestore so the app stays real-time.

### Data-model additions
The `InvoiceDocument` already has `platformFee`, `detailerPayout`, and
`status: 'pending_release' | 'released' | 'disputed'` — the flow was designed for
this. Add:

| Collection | New fields |
|---|---|
| `clients/{uid}` | `stripeCustomerId` |
| `detailers/{uid}` | `stripeAccountId`, `payoutsEnabled` (bool), `subscriptionStatus` (`trialing`/`active`/`past_due`/`canceled`), `subscriptionId`, `trialEndsAt`, `isFoundingPro` (bool) |
| `bookings/{id}` | `paymentIntentId`, `paymentStatus` (`requires_capture`/`captured`/`canceled`) |
| `invoices/{id}` | `stripeTransferId`, `revvCareReserve` (1% set-aside), `releasedAt` |

---

## 2. Build phases (in dependency order)

This mirrors the README's "Critical Path to First Real Transaction."

### Phase 1 — Connect onboarding (detailers can receive money)
- **Function** `createConnectAccount` (callable): create an Express account, return
  an `accountLink` onboarding URL. Open it with `expo-web-browser`.
- **Function** `getConnectStatus` (callable): poll `charges_enabled` / `payouts_enabled`,
  write `payoutsEnabled` + `stripeAccountId` to `detailers/{uid}`.
- **Webhook** `account.updated` → keep `payoutsEnabled` in sync.
- **UI**: a "Set up payouts" card in detailer onboarding/profile, gated so a
  detailer can't appear in search until `payoutsEnabled === true` (the existing
  `isActive && profileComplete` gate in `useFindDetailers` extends naturally).

### Phase 2 — Card pre-auth on booking (escrow hold)
- **Function** `createBookingPaymentIntent` (callable): create/reuse a Customer,
  create a **PaymentIntent with `capture_method: 'manual'`** for `price`,
  `transfer_data.destination = detailer.stripeAccountId`,
  `application_fee_amount = round(price * 0.10)`. Return the client secret.
- **UI**: in `app/client/book/confirm.tsx` (currently just `addDoc('bookings')`),
  present **PaymentSheet** *before* writing the booking. Only create the booking
  once the PaymentIntent is `requires_capture`. Store `paymentIntentId` on the
  booking. **No booking without a card hold** (core business rule).
- **Webhook** `payment_intent.amount_capturable_updated` → set
  `bookings.paymentStatus = 'requires_capture'`.

### Phase 3 — Capture on completion + the invoice
- When the detailer marks a job `completed` (today this just `updateDoc(status)`),
  **capture** the PaymentIntent server-side (move it from hold → captured).
- **Function** `onBookingCompleted` (Firestore trigger on `status → completed`):
  capture the PI, compute `platformFee = price*0.10`,
  `revvCareReserve = platformFee*0.01`, `detailerPayout = price - platformFee - stripeFee`,
  and write the `invoices/{bookingId}` doc with `status: 'pending_release'`.
  (The dev-tools screens already create invoices manually — replace that with
  this real path.)

### Phase 4 — Auto-release after the 24h dispute window
- **Scheduled function** `releaseEligibleInvoices` (e.g. every 30 min): find
  invoices `status == 'pending_release'` whose `createdAt` is >24h old **and**
  whose booking is not `disputed`, then create a **Transfer** to the connected
  account (or let `transfer_data` settle), set `status: 'released'`, `releasedAt`,
  store `stripeTransferId`. Skip any invoice whose booking flipped to `disputed`.
- This closes the loop with the **existing dispute screens**, which already set
  `invoices.status = 'disputed'`.

### Phase 5 — Disputes & Revv Care
- On dispute (already wired in `app/*/dispute/[id].tsx`): a `disputes` doc exists
  and the invoice is `disputed`. Add an admin/resolution function to either
  release, partial-refund, or full-refund the PaymentIntent.
- **Revv Care**: accumulate `revvCareReserve` (1% of the take) into a ledger
  collection; claims filed within 72h (per business rules), capped at $2,500/booking.

### Phase 6 — Detailer subscription ($34.99/mo)
- **Function** `createSubscription` (callable): Customer + Subscription on the
  $34.99 price. 14-day trial (card required); **Founding Pro** (first 25) →
  60-day trial, no card, permanent badge (`isFoundingPro`).
- **Webhooks** `customer.subscription.*` / `invoice.payment_failed` → sync
  `subscriptionStatus`. Gate marketplace visibility on `subscriptionStatus ∈
  {trialing, active}` (extends the search gate).

---

## 3. Webhook endpoint (one function, signature-verified)

`stripeWebhook` (HTTPS): verify `STRIPE_WEBHOOK_SECRET`, then switch on:
`account.updated`, `payment_intent.amount_capturable_updated`,
`payment_intent.succeeded`, `payment_intent.canceled`, `charge.refunded`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_failed`. Each handler reconciles one Firestore doc. Idempotent
(check Stripe event id before applying).

---

## 4. Money math (single source of truth)

```
price                = booking.price                       (gross, what client pays)
platformFee          = round(price * 0.10)                 (Revv take, 10%)
stripeFee            = round(price * 0.029) + 30¢          (approx; Stripe deducts)
revvCareReserve      = round(platformFee * 0.01)           (1% of the take)
detailerPayout       = price - platformFee - stripeFee     (net to detailer)
```
Do this math **server-side only** and persist it on the invoice. Never trust a
client-supplied amount.

---

## 5. Test plan (Stripe test mode)

1. Connect onboarding with a test Express account → `payoutsEnabled` flips true.
2. Book with test card `4242 4242 4242 4242` → PI `requires_capture`, booking created.
3. Complete the job → PI captured, invoice written with correct split.
4. Fast-forward the release window (temporary 1-min threshold in the scheduled fn)
   → transfer created, invoice `released`.
5. Raise a dispute before release → invoice stays `disputed`, no transfer.
6. Subscription with trial → `trialing`; simulate `payment_failed` → `past_due`.

---

## 6. What I can do without your inputs vs. what needs you

| Can scaffold now (no secrets) | Needs you first |
|---|---|
| Functions skeletons + types, the money-math helper, Firestore field types, the webhook router shell, client PaymentSheet wiring behind a feature flag | Blaze upgrade · `firebase login --reauth` · Stripe account + Connect enablement · secret/publishable keys · the $34.99 Price id |

**Recommended starting point once prerequisites are met:** Phase 1 + 2 in Stripe
**test mode** end-to-end, because card-hold-on-booking is the rule everything else
depends on.
