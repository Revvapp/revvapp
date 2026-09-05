# REVV — Road to Publish

Target: **App Store.** Updated 2026-09-05. (The 2026-08-31 target was missed — see Timeline.)

Companions: `APPLE_IAP_RISK.md`, `QA_CRITICAL_PATH.md`, `STORE_LISTING.md`,
`PRIVACY_POLICY_DELTA.md`, `RELEASE_RUNBOOK.md`, `RELEASE_CHECKLIST.md`.

---

## ✅ Done

- **Apple IAP research** — booking payments confirmed safe (3.1.3(e) *requires*
  non-IAP); the $34.99 subscription identified as the real exposure. Analysis and
  four ranked options in `APPLE_IAP_RISK.md`.
- **App-layer test coverage** — 21 → **50** app tests (routing, conversation
  unread logic, car-image lookup). Functions at 76, rules at 12. **138 total.**
- **Critical-path QA script** — 40 numbered steps with expected state at each,
  test cards per branch, in `QA_CRITICAL_PATH.md`.
- **Demo-account seed script** — `npm run seed-demo` in `functions/`.
- **Store listing copy** — name, subtitle, keywords, description, categories,
  screenshot plan, reviewer notes, in `STORE_LISTING.md`.
- **App Privacy answers refreshed** — processor table added; corrected the phone
  row (both roles collect it, not detailers only).
- **Privacy Policy gap analysis** — 8 specific gaps in `PRIVACY_POLICY_DELTA.md`.
- **Support page built** (`docs/support.html`) — the missing hard Apple
  requirement. Covers contact, payments, the dispute window, Revv Care, detailer
  payouts, reporting, notification controls, account deletion and sign-in
  trouble. Goes live at `/support.html` on the next push; cross-linked from the
  policy and terms pages.
- **Privacy Policy brought current** — added the email/SMS disclosure and STOP
  language, named SendGrid and Twilio as processors, described vehicle data and
  the Wikipedia image lookup, disclosed dispute/claim photo evidence, and
  corrected the deletion route (it told users to email us; the App has had
  in-app deletion for a while). Retired the duplicate Markdown copy —
  `docs/index.html` is now the single source.
- **Everything deployed 2026-08-12.** All 38 Cloud Functions live (eight had
  never existed in production), plus Firestore and Storage rules. IAM invoker
  verified on every new callable.
- **User blocking built** (2026-08-12) — App Store guideline 1.2 requires apps
  with user-generated content to let users block abusive ones, and there was no
  block or suspend capability anywhere in the codebase. Enforced in Firestore
  rules (not client code), one-directional, and invisible to the person blocked.
  Offered at the point of reporting, managed at Profile → Blocked accounts, and
  blocked detailers are hidden from search. 14 rules tests.
- **CI verified green** on all three jobs, including the Actions `@v5` bump.
- **Store listing corrected** — keywords trimmed to 93 chars, and a moderation
  answer written for App Review (the earlier claim that blocking existed was
  wrong; it does now).
- **Expo 57 assessed → deferred.** 54 → 57 is three major SDKs, 28 packages in
  lockstep plus a React Native upgrade and native rebuild. Not before a
  submission. Leaves one `postcss` advisory in build-time tooling only.
- Email + SMS notification channels, EAS build environment, Storage bucket fix,
  Firebase web config, money-math extraction, CI green, dependency patching.

---

## What's left

*34 items.*

### A. Unblock — everything queues behind these

| # | Task | Owner |
|---|---|---|
| 1 | **Grant the `admin` claim** — service-account key + which app-user email. | You |
| 2 | **Rewrite history** to strip 9 AI co-author trailers + purge `skills-lock.json`. Backup branch exists; warn `abdullaahahmadi` first. | You |
| 3 | **Delete the backup branches** after #2 — holds the original 26. | You |

### B. Decide before building

| # | Task | Owner |
|---|---|---|
| 4 | **Settle the subscription/IAP question — code done 2026-09-05, option 3 implemented.** Web subscribe page at `docs/subscribe/`; the iOS screen no longer presents a purchase, it reflects status and links out. What is left is not code: **file the pre-submission question to App Review** describing both payment types and asking them to confirm the treatment of the seller subscription. Option 1 (separate detailer app) remains the roadmap. See `APPLE_IAP_RISK.md`. | You |
| 5 | **Confirm Apple Developer Program membership is active** ($99/yr). | You |

### C. Build and distribution

| # | Task | Owner |
|---|---|---|
| 6 | **Create the APNs push key** (`eas credentials`). | You |
| 7 | **Run the production iOS build.** | Either |
| 8 | **Create the App Store Connect record** (`com.revvapp.revv`). | You |
| 9 | **Submit to TestFlight.** | You |
| 10 | **Run a real beta** — a week, real devices, real people. | You |

### D. Testing

| # | Task | Owner |
|---|---|---|
| 11 | **Run `QA_CRITICAL_PATH.md` end to end.** 40 steps. Never once executed — budget for finding bugs. | You |
| 12 | **Device matrix** — smallest/largest iPhone, oldest supported iOS, iPad if `supportsTablet` stays on. | You |
| 13 | **Poor-network and offline** behaviour on booking/payment paths. | You |
| 14 | **Verify App Check in monitor mode.** | You |

### E. Third-party accounts

| # | Task | Owner |
|---|---|---|
| 15 | **SendGrid** account + verified sender + API key → turns on email. | You |
| 16 | **Twilio** account + number → turns on SMS. | You |
| 17 | **Sentry DSN** in `.env` *and* EAS → crash reporting. | You |

### F. Legal and store metadata

| # | Task | Owner |
|---|---|---|
| 18 | **Terms of Service legal review.** The long pole — start today. | You |
| 19 | **Fill the ToS placeholders, remove the `noindex` line, merge `terms.html`.** | Either |
| 20 | **Two Privacy Policy decisions remain** (the text edits are done): the anonymized-record **retention period** needs a number from counsel, and whether adding SMS/email processing is a *material* change that moves the effective date and triggers the in-App notice §9 promises. | You |
| 21 | **App Privacy nutrition label** — transcribe from `APP_PRIVACY.md`. | You |
| 22 | **Screenshots** — plan and captions in `STORE_LISTING.md`. | You |
| 23 | **Paste the store listing** from `STORE_LISTING.md`; trim keywords to 100 chars. | You |
| 24 | **Run `npm run seed-demo`** and paste the credentials into App Review Information. | You |
| 25 | **Prepare the UGC moderation answer** — reviewers ask, given messaging/reviews/photos. | You |

### G. Money go-live

| # | Task | Owner |
|---|---|---|
| 26 | **Enable 1099 tax reporting** — Connect settings → Tax forms. | You |
| 27 | **Switch Stripe to LIVE** — keys, new webhook + secret, re-verify **all 9** events. | You |
| 28 | **One small real transaction** end to end, including payout. | You |
| 29 | **Confirm the entity can receive funds** — bank connected, identity verified. | You |

### H. Deferred — explicitly not blocking launch

| # | Task |
|---|---|
| 30 | **Checkr** — needs counsel on FCRA consent/adverse-action first. |
| 31 | **Revv Reach video + AI captions** — needs a vendor decision and cost model. |
| 32 | **App Check monitor → enforce.** Note: `docs/subscribe/` and `docs/portal/` call Firebase from the browser, so enforcing App Check means registering a reCAPTCHA provider for the web app too, not just the iOS app. Callables are not enforcing today, so both pages work as-is. |
| 33 | **Expo 57 bump** — clears the last `postcss` advisory. Post-launch. |
| 34 | **Split the detailer app out** — the durable answer to #7. |

---

## Risks

**1 — The subscription/IAP question (#4).** Now researched rather than
speculative: by a strict reading of 3.1.1 the subscription needs IAP, and no
3.1.3 exemption fits. Still cheap *if* decided before the build, but no longer
free: option 3 needs a web subscribe page built before the iOS CTA comes out,
because that screen is currently the only way anyone can subscribe. See
`APPLE_IAP_RISK.md`.

**2 — The critical path has never been run (#11).** Everything is deployed and
unit-tested; no human has exercised it end to end.

**3 — Legal review is external (#18).** Gates #19, #20 and submission itself,
and it has not started.

## Timeline

**Where this actually stands: 2026-09-05.** The Aug 31 TestFlight target was
missed by five days, and there have been no commits since Aug 29. Nothing broke
— the repo is clean and all 133 tests pass. The project stalled because
everything remaining needs a credential, an account, a payment or a lawyer, and
none of that is work the codebase can do for itself.

**Stop treating this as a date-driven plan.** There is no useful "days left"
number while five prerequisites are unstarted, because every one of them is
external and none has a predictable turnaround. The schedule is a function of
when you do items #1–#5, not of the calendar.

### The honest critical path

Legal review (#18) is the long pole and **has not started**. It gates #19, #20
and submission itself, and it is the one item where the turnaround is entirely
someone else's. Everything else can be compressed; that cannot.

Second-longest is the beta (#10) — a week of real devices, and it is the thing
you least want to cut, because the 40-step critical path (#11) has *never been
run end to end*. That is not a formality. It is the most likely source of
surprises left in the project.

### If you start this week

Assuming legal starts immediately and comes back inside two weeks:

| When | What |
|---|---|
| Now | Kick off legal review (#18). Nothing else moves it. |
| Days 1–2 | Apple membership (#5), App Store Connect record (#8), APNs key (#6). |
| Days 2–3 | File the App Review pre-submission question (#4). |
| Days 3–4 | Production build (#7), then run QA (#11) — budget for finding bugs. |
| ~Day 6 | TestFlight (#9). |
| Days 6–13 | Beta (#10), with legal running in parallel. |
| ~Day 15 | Submit, once legal has cleared #19 and #20. |
| +1–3 days | Apple review. |

That puts a public release around **early October**, and only if the QA pass
does not turn up something structural.

### The next three things

If you do nothing else, do these, in this order:

1. **Start the legal review (#18).** It is the only item whose clock runs
   without you, and it gates submission. Every day it waits is a day added to
   the end.
2. **Confirm the Apple Developer membership is active (#5).** Cheap to check,
   and everything in section C is dead until it is.
3. **File the App Review pre-submission question (#4).** The code is done — both
   surfaces are built and the purchase is off the iOS screen. What is still worth
   having in writing is Apple's own read on the seller subscription, and that
   answer takes days to come back.

Stripe LIVE (#26–#29) stays on the critical path regardless; shipping in test
mode is not an option.
