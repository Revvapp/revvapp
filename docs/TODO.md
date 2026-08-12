# REVV — Road to Publish

Target: **App Store, by 2026-08-31.** Updated 2026-08-12.

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
- **Expo 57 assessed → deferred.** 54 → 57 is three major SDKs, 28 packages in
  lockstep plus a React Native upgrade and native rebuild. Not before a
  submission. Leaves one `postcss` advisory in build-time tooling only.
- Email + SMS notification channels, EAS build environment, Storage bucket fix,
  Firebase web config, money-math extraction, CI green, dependency patching.

---

## What's left

*35 items.*

### A. Unblock — everything queues behind these

| # | Task | Owner |
|---|---|---|
| 1 | **Verify CI is still green** after the Actions `@v5` bump — pushed but unconfirmed. | Either |
| 2 | **Grant the `admin` claim** — service-account key + which app-user email. | You |
| 3 | **Rewrite history** to strip 9 AI co-author trailers + purge `skills-lock.json`. Backup branch exists; warn `abdullaahahmadi` first. | You |
| 4 | **Delete `backup-pre-trailer-cleanup`** after #5 — holds the original 26. | You |

### B. Decide before building

| # | Task | Owner |
|---|---|---|
| 5 | **Settle the subscription/IAP question.** Recommendation: remove the purchase CTA from the iOS subscription screen and bill on the web (option 3), with a separate detailer app as the roadmap (option 1). File a pre-submission question to App Review. **Architectural — do this before #10.** | You |
| 6 | **Confirm Apple Developer Program membership is active** ($99/yr). | You |

### C. Build and distribution

| # | Task | Owner |
|---|---|---|
| 7 | **Create the APNs push key** (`eas credentials`). | You |
| 8 | **Run the production iOS build.** | Either |
| 9 | **Create the App Store Connect record** (`com.revvapp.revv`). | You |
| 10 | **Submit to TestFlight.** | You |
| 11 | **Run a real beta** — a week, real devices, real people. | You |

### D. Testing

| # | Task | Owner |
|---|---|---|
| 12 | **Run `QA_CRITICAL_PATH.md` end to end.** 40 steps. Never once executed — budget for finding bugs. | You |
| 13 | **Device matrix** — smallest/largest iPhone, oldest supported iOS, iPad if `supportsTablet` stays on. | You |
| 14 | **Poor-network and offline** behaviour on booking/payment paths. | You |
| 15 | **Verify App Check in monitor mode.** | You |

### E. Third-party accounts

| # | Task | Owner |
|---|---|---|
| 16 | **SendGrid** account + verified sender + API key → turns on email. | You |
| 17 | **Twilio** account + number → turns on SMS. | You |
| 18 | **Sentry DSN** in `.env` *and* EAS → crash reporting. | You |

### F. Legal and store metadata

| # | Task | Owner |
|---|---|---|
| 19 | **Terms of Service legal review.** The long pole — start today. | You |
| 20 | **Fill the ToS placeholders, remove the `noindex` line, merge `terms.html`.** | Either |
| 21 | **Two Privacy Policy decisions remain** (the text edits are done): the anonymized-record **retention period** needs a number from counsel, and whether adding SMS/email processing is a *material* change that moves the effective date and triggers the in-App notice §9 promises. | You |
| 22 | **App Privacy nutrition label** — transcribe from `APP_PRIVACY.md`. | You |
| 23 | **Screenshots** — plan and captions in `STORE_LISTING.md`. | You |
| 24 | **Paste the store listing** from `STORE_LISTING.md`; trim keywords to 100 chars. | You |
| 25 | **Run `npm run seed-demo`** and paste the credentials into App Review Information. | You |
| 26 | **Prepare the UGC moderation answer** — reviewers ask, given messaging/reviews/photos. | You |

### G. Money go-live

| # | Task | Owner |
|---|---|---|
| 27 | **Enable 1099 tax reporting** — Connect settings → Tax forms. | You |
| 28 | **Switch Stripe to LIVE** — keys, new webhook + secret, re-verify **all 9** events. | You |
| 29 | **One small real transaction** end to end, including payout. | You |
| 30 | **Confirm the entity can receive funds** — bank connected, identity verified. | You |

### H. Deferred — explicitly not blocking launch

| # | Task |
|---|---|
| 31 | **Checkr** — needs counsel on FCRA consent/adverse-action first. |
| 32 | **Revv Reach video + AI captions** — needs a vendor decision and cost model. |
| 33 | **App Check monitor → enforce.** |
| 34 | **Expo 57 bump** — clears the last `postcss` advisory. Post-launch. |
| 35 | **Split the detailer app out** — the durable answer to #7. |

---

## Risks

**1 — The subscription/IAP question (#7).** Now researched rather than
speculative: by a strict reading of 3.1.1 the subscription needs IAP, and no
3.1.3 exemption fits. Mitigations are known and cheap *if* decided before the
build. See `APPLE_IAP_RISK.md`.

**2 — The critical path has never been run (#14).** Everything is deployed and
unit-tested; no human has exercised it end to end.

**3 — Legal review is external (#21).** Gates #22, #23 and submission itself.

## Timeline — 19 days left

**Aug 31 for a public release is now unlikely.** Working backwards: Apple review
is 1–3 days, so submission by ~Aug 26 at the very latest; a beta worth running is
a week, so TestFlight by ~Aug 19; which means the build, the 40-step QA pass
(#14) and the IAP decision (#7) all have to land inside the next 7 days — while
legal review (#21) runs in parallel and gates the submission itself.

That can happen, but only if nothing surprises you, and #14 exists precisely
because something probably will.

**The realistic plan:** target **TestFlight by Aug 31**, public release early
September. That keeps the one thing you cannot compress — a real beta on real
devices — and it does not force you to submit before the critical path has ever
been run end to end.

**If Aug 31 public is non-negotiable**, the levers in order of least damage:
1. Ship without SMS (#19) — email covers the same events.
2. Ship without Sentry (#20) — accept blind debugging for a few weeks.
3. Shorten the beta to 3 days.
Do **not** compress #14, and do not submit before #7 is settled — a rejection
costs more days than either saves.

Stripe LIVE (#27–#30) is on the critical path regardless; launching in test mode
is not an option.
