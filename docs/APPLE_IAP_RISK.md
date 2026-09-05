# The $34.99 Subscription vs. Apple In-App Purchase

Researched 2026-08-12 against the current App Review Guidelines. **Read this
before running a production build** — the conclusion may change what gets built.

## Short version

REVV takes two different kinds of money, and Apple treats them oppositely.

| Payment | Guideline | Verdict |
|---|---|---|
| Client pays for a detail ($249 etc.) | **3.1.3(e)** | ✅ Stripe is not merely allowed — it is **required**. |
| Detailer pays $34.99/mo for Revv Pro | **3.1.1** | ⚠️ **Likely requires IAP as currently built.** |

The booking side is safe. The subscription is the exposure.

## Why the client payments are fine

> **3.1.3(e) Goods and Services Outside of the App:** If your app enables people
> to purchase physical goods or services that will be consumed outside of the
> app, you must use purchase methods other than in-app purchase to collect those
> payments, such as Apple Pay or traditional credit card entry.

A car detail is a physical service consumed outside the app. Using IAP here would
itself be a violation. The Stripe card-hold flow is correct. **3.1.3(d)
Person-to-Person Services** reinforces this independently.

No change needed, and no risk.

## Why the subscription is exposed

> **3.1.1 In-App Purchase:** If you want to unlock features or functionality
> within your app (by way of example: subscriptions, in-game currencies, game
> levels, access to premium content, or unlocking a full version), you must use
> in-app purchase.

Revv Pro unlocks **in-app functionality**: `detailers.isActive` controls whether
the detailer appears in client search and can take bookings. That is squarely
"unlock features or functionality within your app."

Every exemption was checked and none fit:

- **3.1.3(e)** — the subscription is not a physical good or service consumed
  outside the app. The *bookings* are; the platform access is not.
- **3.1.3(c) Enterprise** — explicitly closes this door: *"Consumer, single
  user, or family sales must use in-app purchase."* Detailers are sole
  operators, not organizations buying seats.
- **3.1.3(d) Person-to-Person** — covers the client↔detailer service payment,
  not the platform's own fee.
- **3.1.3(f) Free Stand-alone Apps** — requires *no purchasing inside the app at
  all*. `app/detailer/subscription.tsx` presents the purchase, so this fails.

**A reviewer who notices this can reject the app.** It is not a certainty —
plenty of marketplace "pro" apps bill sellers off-IAP — but it is a live risk
sitting on the critical path, and it is architectural, not cosmetic.

## Does the Epic ruling save us?

Partly, and less than the headlines suggest.

Post-injunction, US storefront apps may include buttons and external links to
other purchase mechanisms without an entitlement (3.1.1(a)). But note what that
actually changed: it removed the **anti-steering** restriction. It did **not**
repeal 3.1.1's requirement that in-app functionality be unlocked via IAP. The
relief lets you *tell users about* an external option; it does not by itself make
an IAP-eligible subscription exempt.

It has also narrowed. In December 2025 the Ninth Circuit modified the injunction
so Apple **may again charge a commission on external-link purchases**, with the
rate remanded to the district court. So "link out and pay nothing" is no longer
reliably true, and the number is currently unsettled.

## Options, ranked

**1 — Split the detailer experience into its own app (recommended).**
The standard marketplace pattern: Uber/Uber Driver, DoorDash/Dasher,
Instacart/Shopper, Airbnb host tools. A business-facing app whose subscriber is
earning income through it draws materially less scrutiny, and it improves both
products — the client app stops shipping detailer-only screens. Highest effort,
lowest long-term risk, and it is where this is likely heading anyway.

**2 — Use IAP for the subscription only.**
Simple, unambiguous, ships fastest. Cost is **15%** under the App Store Small
Business Program (under $1M/yr), so about **$5.25/mo per detailer**, not 30%.
Keeps all client payments on Stripe where they belong. The downside is real:
Apple owns the billing relationship, and refunds/proration/dunning move out of
your control and out of the Stripe webhook logic already built.

**3 — Move subscription billing entirely to the web.**
Detailers subscribe at revvapp.net; the iOS app only *reflects* status and never
presents a purchase. On the US storefront you may also link out. Preserves
Stripe billing and the existing webhook architecture. Weaker than option 1
because a reviewer can still read it as gating in-app functionality.

**4 — Ship as-is and hope.**
Not recommended on a deadline. A rejection here costs a review cycle at minimum,
and a rearchitecture at worst — precisely when there is no slack.

## Recommendation

**Option 3 as the immediate move, option 1 as the roadmap.** It preserves
everything already built on Stripe and keeps the webhook architecture intact.

### Correction (2026-09-05): option 3 is not a pure deletion

An earlier draft of this section called option 3 "a small change — remove the
purchase CTA from the iOS subscription screen." That understates it, and taken
literally it would ship a broken product.

`app/detailer/subscription.tsx` is the **only** place a detailer can subscribe.
There is no web subscribe flow: `docs/` contains the marketing and policy pages
plus the Business Portal, and the portal serves business *clients* (receipts,
payout statements, fleet ordering) — it has no billing screen. Deleting the CTA
without building the web replacement leaves detailers with no way to pay at all,
which means `detailers.isActive` never turns on and nobody appears in client
search.

**Option 3 is therefore two pieces of work, not one:**

1. Remove the purchase path from the iOS screen — drop `handleSubscribe`, the
   `initPaymentSheet` / `presentPaymentSheet` calls and the `createSubscription`
   import, and replace the CTA with status display plus a pointer to the web.
   Keep the entitled-state card as it is. ~40 lines.
2. **Build the web subscribe page** at revvapp.net — the part that was missing
   from the estimate.

The good news is that piece 2 is cheaper than it looks, because
`docs/portal/portal.js` already carries every bit of plumbing it needs: Firebase
app init, email/password sign-in, `onAuthStateChanged`, Firestore reads and
`httpsCallable`. The `createSubscription` callable
(`functions/src/stripe.ts:872`) is transport-agnostic and works from web
unchanged. What has to be added is Stripe.js Elements to collect the card
against the SetupIntent the callable returns — the web equivalent of the
PaymentSheet the app uses today.

Estimate: about a day, mostly reusing the portal's existing auth shell.

**Sequencing consequence:** the web page has to exist *before* the iOS CTA comes
out, or there is a window with no subscription path on either surface.

### Implemented 2026-09-05

Both halves landed in the right order. `docs/subscribe/` went in first, then the
purchase came out of `app/detailer/subscription.tsx`. The screen keeps the status
card, the benefit list and the price, and where the trial button used to be it
now explains that billing is on the web and opens the page.

**The one judgment call:** the screen still *links* to the subscribe page rather
than saying nothing at all. Under 3.1.1(a) post-injunction that is allowed on the
US storefront, and this document's option 3 anticipated it. It is not free of
risk — Apple regained the ability to commission external-link purchases in
December 2025, and a reviewer could read a link-out as still presenting the
purchase. Removing the button and leaving only the explanatory text is the
strictly safer variant if App Review pushes back; it is a one-line change.

`lib/payments.ts` still exports `createSubscription`. Nothing in the app calls it
now — the web page calls the callable directly — but it is left in place because
option 1 would need it again.

**Do this before the production build**, and file a pre-submission question to
App Review describing the two payment types and asking them to confirm the
treatment of the seller subscription. Getting that answer in writing costs days;
discovering it in a rejection costs a release.

## Sources

- [App Store Review Guidelines — 3.1.1, 3.1.1(a), 3.1.3(a)–(g)](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Wins Ability to Charge Fees on External Payment Links (Ninth Circuit, Dec 2025)](https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/)
- [Epic Games, Inc. v. Apple Inc., No. 25-2935 (9th Cir. 2025)](https://law.justia.com/cases/federal/appellate-courts/ca9/25-2935/25-2935-2025-12-11.html)
- [What Apple's anti-steering ruling means for developers](https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy)
