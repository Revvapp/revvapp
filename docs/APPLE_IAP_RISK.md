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

For an August ship: **option 3 as the immediate move, option 1 as the roadmap.**
It is a small change now (remove the purchase CTA from the iOS subscription
screen; keep status display) and preserves everything already built on Stripe.

**Do this before the production build**, and file a pre-submission question to
App Review describing the two payment types and asking them to confirm the
treatment of the seller subscription. Getting that answer in writing costs days;
discovering it in a rejection costs a release.

## Sources

- [App Store Review Guidelines — 3.1.1, 3.1.1(a), 3.1.3(a)–(g)](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Wins Ability to Charge Fees on External Payment Links (Ninth Circuit, Dec 2025)](https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/)
- [Epic Games, Inc. v. Apple Inc., No. 25-2935 (9th Cir. 2025)](https://law.justia.com/cases/federal/appellate-courts/ca9/25-2935/25-2935-2025-12-11.html)
- [What Apple's anti-steering ruling means for developers](https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy)
