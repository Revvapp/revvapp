# Critical-Path QA Script (Stripe test mode)

Item 14 on the road-to-publish list. This path has **never been run end to end**,
so expect to find real bugs — budget for fixing, not just confirming.

Run the whole thing on a **real device** (the card sheet and push notifications
do not behave identically in a simulator), against Stripe **test mode**, with
two accounts you can sign in and out of.

## Before you start

- [ ] Cloud Functions deployed (list item 2) — otherwise report resolution and
      two notification paths silently do nothing.
- [ ] `admin` claim granted to your account (item 4) — required for §7 and §8.
- [ ] Stripe Dashboard open on **test mode**, Payments + Connect + Events tabs.
- [ ] Firebase console open on Firestore, or `firebase firestore:get` handy.
- [ ] `npx firebase-tools functions:log --project revv-app2026` tailing.

### Test cards

| Card | Behaviour | Use for |
|---|---|---|
| `4242 4242 4242 4242` | Succeeds | The happy path everywhere |
| `4000 0025 0000 3155` | Requires 3DS authentication | §3 — confirm the sheet handles it |
| `4000 0000 0000 9995` | Declined (insufficient funds) | §3 — booking must not be created |
| `4000 0000 0000 0341` | Attaches, then fails on charge | §9 — subscription dunning |

Any future expiry, any CVC, any postcode.

---

## 1. Detailer signup and onboarding

1. Sign up as a detailer. **Expect:** `users/{uid}` with `userType: 'detailer'`,
   `subscriptionStatus: 'pending'`, `onboardingComplete: false`.
2. Complete onboarding through to the dashboard.
3. **Expect:** `detailers/{uid}` exists with a rate card. `isActive` is **not**
   true yet — an unsubscribed detailer must not be visible to clients.

## 2. Connect onboarding and subscription

4. Start Stripe Connect onboarding. Complete the hosted flow with test data.
5. **Expect:** back in the app, `payoutsEnabled: true` on `detailers/{uid}`, and
   the account shows in Stripe → Connect → Accounts.
6. Subscribe to Revv Pro with `4242…`.
7. **Expect:** `users/{uid}.subscriptionStatus` becomes `trialing`, and
   `detailers/{uid}.isActive` becomes `true`. **Both are written by the webhook,
   never the client** — if they only change after an app restart, the webhook is
   not firing. Check Stripe → Developers → Events.
8. **Expect:** the detailer now appears in client search.

## 3. Booking and the card hold

9. Sign in as a client, complete onboarding (phone number required).
10. Try to book **today** or **5+ days out**. **Expect:** rejected — the window
    is 1–4 days ahead.
11. Book a valid date with `4000 0000 0000 9995` (decline).
    **Expect:** no booking document is created. A declined payment must not
    leave a phantom booking.
12. Book again with `4000 0025 0000 3155`. **Expect:** the 3DS sheet appears and
    completes.
13. Book with `4242…`. **Expect:**
    - `bookings/{paymentIntentId}` created, `status: 'pending'`,
      `paymentStatus: 'requires_capture'`.
    - Stripe shows an **uncaptured** PaymentIntent for the full price.
    - The **document id equals the PaymentIntent id** — this is what makes
      replay impossible.
    - Detailer receives a push **and** an email **and** an SMS (channel policy).

## 4. The job

14. As the detailer, **accept**. **Expect:** `status: 'active'`, client notified.
15. Submit the VIR with photos. **Expect:** `status: 'vir_submitted'`, photos in
    Storage under the booking, client notified (push + **SMS**, no email).
16. As the client, **sign** the VIR. **Expect:** `status: 'vir_signed'`,
    `virSignedAt` set.
17. As the detailer, **start** the timer. Pause it. Resume it. Let real time pass
    between each.
18. **Expect:** `timerAccumulatedSeconds` only ever increases, and the paused
    interval is **not** counted. This is the arithmetic covered by
    `bookingRules.test.ts` — confirm it matches reality.
19. **Complete** the job. **Expect:**
    - `status: 'completed'`, `releaseEligibleAt` = now + 24h.
    - `invoices/{bookingId}` created automatically with
      `platformFee` = 10% and `detailerPayout` = 90%, to the cent.
    - Client notified.
20. Upload after-photos. **Expect:** they attach to both booking and invoice, and
    a second attempt is rejected (`afterPhotosFinalizedAt` is set once).

## 5. Dispute — release outcome

21. As the client, raise a dispute with photos.
    **Expect:** `disputes/{bookingId}` created, invoice `status: 'disputed'`,
    detailer notified (push + email).
22. As the detailer, submit a response. **Expect:** recorded, client notified,
    and a **second** response is refused.
23. As admin, resolve as **release_detailer**. **Expect:**
    - PaymentIntent captured; a Transfer for **90%** appears in Stripe.
    - `paymentStatus: 'captured'`, invoice `released`.
    - `revvCareLedger/{bookingId}` accrues **1%** of the price.
    - **Both** parties notified, each with outcome-specific copy.

## 6. Dispute — refund outcomes

Run these on two fresh bookings.

24. **refund_client** on an *uncaptured* hold. **Expect:** the PaymentIntent is
    **canceled**, not refunded — there is nothing to refund yet. Booking
    `paymentStatus: 'refunded'`.
25. **partial_refund** with half the price. **Expect:**
    - Full capture, then a partial refund to the client.
    - Detailer transfer = 90% **of the retained remainder**, not of the original
      price.
    - `partialRefundCents` recorded; invoice `resolved_partial`.
26. Try `clientRefundCents` of 0 and of the full price. **Expect:** both
    rejected — those have dedicated resolutions.

## 7. Auto-release

27. Complete a booking, raise **no** dispute, and let `releaseEligibleAt` pass
    (or set it backwards in Firestore to avoid waiting 24h).
28. Wait for the scheduler (every 30 min) or invoke it manually.
    **Expect:** captured, 90% transferred, invoice `released`, Care accrued.
29. **Race check:** raise a dispute on a booking whose window has just closed.
    Exactly one of {dispute accepted, auto-release} must win — never both.

## 8. Revv Care

30. Within 72h of completion, file a claim with photos for an amount under
    $2,500. **Expect:** `careClaims/{bookingId}` created, one per booking.
31. Try over $2,500, and try a second claim on the same booking. Both rejected.
32. As admin, approve for a partial amount. **Expect:** claim `approved`,
    `approvedCents` set, **client notified** (this trigger was undeployed until
    recently — confirm it actually fires).
33. Confirm the claim status is visible in the client's app.

## 9. Subscription lifecycle

34. In Stripe, advance the trial to its end with `4000 0000 0000 0341`.
    **Expect:** payment fails → `subscriptionStatus: 'past_due'`,
    `isActive: false`, detailer **disappears from client search**, and is
    notified by push + email + **SMS**.
35. Update to `4242…` and pay. **Expect:** `active`, visible again, notified.
36. Cancel. **Expect:** `canceled`, hidden, notified.

## 10. Trust, safety and account deletion

37. Submit a report from one account about another. As admin, resolve it and
    confirm it leaves the queue (this needs `resolveReport`, undeployed until
    recently).
38. Send chat messages both directions. **Expect:** push only — **no email, no
    SMS**. A chatty thread must not generate mail.
39. Toggle both switches off at Profile → Notifications, then trigger a booking
    request. **Expect:** push still arrives; email and SMS do not.
40. Delete an account. **Expect:** profile data gone, the Auth user gone, and
    transaction/dispute records retained (anonymized), not destroyed.

---

## Recording results

Log each failure with: the step number, what you expected, what happened, and
the booking id. The booking id is the PaymentIntent id, so it joins the Firestore
document, the Stripe payment and the function logs in one lookup — that is
usually enough to diagnose without reproducing.
