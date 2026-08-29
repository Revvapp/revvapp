# App Store Listing — draft copy

Item 31. Paste-ready. Character limits are Apple's; counts shown are current.

---

## Name (30 max)
```
Revv — Mobile Car Detailing
```
*(26)* — Fallback if taken: `Revv: Mobile Car Detailing`

## Subtitle (30 max)
```
Book vetted detailers near you
```
*(29)*

## Promotional text (170 max — editable without a new build)
```
Every job is documented with a signed inspection report and before/after photos,
and your card isn't charged until the work is done. Damage protection included.
```
*(153)*

## Keywords (100 max, comma-separated, no spaces)
```
car detailing,auto detail,mobile detailing,car wash,ceramic coating,paint correction,detailer
```
*(94 — trimmed from 112 by dropping `auto spa` and `car care`; both were the
weakest terms and `detailing`/`detailer` already cover that intent.)*

Do not repeat words already in the name or subtitle — Apple indexes those
separately, so "revv", "mobile", "book" and "detailers" are wasted here.

## Description (4000 max)

```
Revv connects you with professional mobile detailers who come to you — at home,
at the office, wherever your car is parked.

BOOK IN UNDER A MINUTE
Browse detailers near you, compare real ratings and rate cards, and pick a time
that works. No phone tag, no quotes, no haggling.

YOUR CAR, DOCUMENTED
Every job starts with a Vehicle Inspection Report. Your detailer photographs the
car's condition and you sign off before any work begins — so there's never a
question about what was already there. When the job's done, you get before-and-
after photos with your invoice.

YOU'RE NOT CHARGED UNTIL IT'S DONE
Booking places a hold on your card, not a charge. The detailer is paid only after
the work is complete, and you have a full 24 hours afterward to raise a dispute
if something isn't right. Our team reviews every one.

REVV CARE
Every completed job includes damage protection up to $2,500. If something goes
wrong, file a claim with photos from your invoice and we'll review it.

TRACK THE JOB LIVE
Watch the work start, pause and finish in real time. Message your detailer
directly in the app.

FOR DETAILERS
Run your whole business from your phone. Get discovered by clients nearby, manage
bookings and your rate card, document jobs with built-in inspection reports, and
get paid automatically after every job — no invoicing, no chasing.

Revv is a marketplace. Detailers are independent professionals, not Revv
employees. Payments are processed securely by Stripe; we never see your full card
number.
```
*(~1,430)*

## What's New (first release)
```
Welcome to Revv — the first release. Book a mobile detailer, watch the job happen
in real time, and pay only when the work is finished.
```

---

## Categories
- **Primary:** Lifestyle — where consumers browse for car care.
- **Secondary:** Business — covers the detailer side.

*(Considered and rejected: Shopping. Revv sells a booked service, not goods, and
the category is dominated by retail apps.)*

## Age rating
**4+.** No objectionable content. Answer "None" to every content question.

**User-generated content:** the app has messaging, reviews and photo upload, so
guideline 1.2 applies. It does not change the 4+ rating, but reviewers do ask.

> ⚠️ An earlier revision of this file claimed blocking existed "via account
> suspension." It did not — there was no block or suspend capability anywhere in
> the codebase. Blocking was built 2026-08-12 to close that gap.

**Paste this into the review notes if asked how content is moderated:**

```
Revv includes messaging between a client and their detailer, written reviews,
and photo upload (vehicle inspections, before/after, dispute and claim
evidence). Messaging is private and scoped to a single booking — there is no
public feed, no discovery between strangers, and no way to contact someone you
have not booked with.

Reporting: any participant can report the other from the booking screen
(Report a Problem), choosing a category and description. Reports go to a
trust & safety queue in our admin console and are never shown to the reported
party.

Blocking: a user can block the other party, offered directly at the point of
reporting and manageable any time under Profile > Blocked accounts. A blocked
person cannot send messages, is hidden from that user's search results, and is
not told they were blocked. Enforcement is in Firestore security rules, not
client code, so it holds even against a modified client.

Response: reports are reviewed by our team and resolved as reviewed or
dismissed, with the outcome recorded against the report. Support is reachable
at support@revvapp.net and at
https://revvapp.github.io/revvapp/support.html.
```

## URLs
| Field | Value |
|---|---|
| Support URL | https://revvapp.github.io/revvapp/support.html ✅ **built** |
| Marketing URL | https://revvapp.github.io/revvapp/ (or a real landing page) |
| Privacy Policy URL | https://revvapp.github.io/revvapp/ |
| EULA / Terms | https://revvapp.github.io/revvapp/terms.html *(after item 27)* |

> ✅ **Built 2026-08-12.** `docs/support.html` covers contact, payments, the
> dispute window, Revv Care, detailer payouts, reporting, notification controls,
> account deletion and sign-in trouble. It goes live at
> https://revvapp.github.io/revvapp/support.html on the next push to `main`
> (Pages serves `docs/` from `main`). Verify the URL resolves before entering it
> in App Store Connect.

## App Review Information
- Demo accounts: run `npm run seed-demo` in `functions/` (item 32) and paste the
  credentials it prints.
- Notes field — include this:

```
Revv is a two-sided marketplace for mobile car detailing.

Sign in with either demo account to see that role. The detailer account is
already subscribed and payout-enabled, so no card entry is needed to browse.

Payments: booking a detail places a hold on the client's card via Stripe and is
captured only after the job is completed. These are real-world services performed
on the customer's vehicle, so per guideline 3.1.3(e) they use a payment method
other than in-app purchase.

To test a booking, use Stripe test card 4242 4242 4242 4242, any future expiry,
any CVC.
```

## Screenshots (item 30)

Six per size, in this order — the first two are what most people actually see:

1. Detailer search results with ratings — *"Find detailers near you"*
2. A detailer profile with rate card — *"Compare real prices"*
3. The VIR inspection screen — *"Every job documented"*
4. The live job timer — *"Track the work in real time"*
5. Invoice with before/after photos — *"See exactly what you paid for"*
6. Revv Care claim screen — *"$2,500 damage protection included"*

Required: 6.7" (1290×2796) and 6.5" (1242×2688). Add 12.9" iPad **only if**
`supportsTablet` stays enabled — if you are not testing on iPad, turn it off in
`app.json` and skip those.

Use the seeded demo data so screenshots show a populated marketplace, never empty
states.
