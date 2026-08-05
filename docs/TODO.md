# REVV — Road to Publish

Target: **App Store, by 2026-08-31.** Written 2026-08-05 (26 days out).

Detail and reasoning live in `RELEASE_CHECKLIST.md`; exact commands in
`RELEASE_RUNBOOK.md`.

**Owner:** *You* = needs your account, credential, money or judgement.
*Either* = I can do it once the permission or the one blocking decision exists.

---

## A. Unblock (do first — everything else queues behind these)

| # | Task | Owner |
|---|---|---|
| 1 | **Verify CI passed on the Actions `@v5` bump.** Pushed but unverified — I was gated before I could check. If it broke, revert that hunk of `ci.yml`. | Either |
| 2 | **Deploy Cloud Functions.** `resolveReport`, `onCareClaimUpdated`, `onSubscriptionStatusChanged` have *never* been deployed. Report resolution and two notification paths are dead in production. | Either |
| 3 | **Redeploy Firestore + Storage rules** — last deployed 2026-07-27, unverified since. | Either |
| 4 | **Grant the `admin` claim.** Needs a service-account key *and* a decision on which app-user email. Blocks the admin console, detailer verification, dispute resolution and Care claim decisions. | You |
| 5 | **Rewrite history to strip 9 AI co-author trailers** + purge `skills-lock.json`. Commands and a filter script are in the runbook; backup branch exists. Warn `abdullaahahmadi` first — every SHA from `ab09fdc` changes. | You |
| 6 | **Delete `backup-pre-trailer-cleanup`** after #5 — it holds the original 26 trailers and would re-leak them if ever pushed. | You |

## B. Build and distribution

| # | Task | Owner |
|---|---|---|
| 7 | **Confirm the Apple Developer Program membership is active** ($99/yr). Everything below dies without it. | You |
| 8 | **Resolve the subscription/IAP question — see Risk 1 below.** Potentially architectural; settle it *before* building. | You |
| 9 | **Create the APNs push key** (`eas credentials`). Push does not deliver on iOS without it. | You |
| 10 | **Run the production iOS build** (`eas build --platform ios --profile production`). | Either |
| 11 | **Create the App Store Connect record**, bundle id `com.revvapp.revv`. | You |
| 12 | **Submit to TestFlight** (`eas submit --platform ios --latest`). | You |
| 13 | **Run a real TestFlight beta** — at least a week, on real devices, with real people. | You |

## C. Testing

| # | Task | Owner |
|---|---|---|
| 14 | **Full critical-path QA in Stripe test mode.** Signup (both roles) → Connect onboarding → subscription trial → booking + card hold → VIR → client sign → timer → pause/resume → complete → capture → invoice → dispute → resolve (**all three** outcomes) → Revv Care claim → review. **This has never been run end to end.** | You |
| 15 | **Test the money edge cases**: hold → cancel, hold → decline, expired authorization, partial refund arithmetic, double-capture attempt, dispute filed at the 24h boundary. | You |
| 16 | **Test subscription lifecycle**: trial → active → past_due → canceled → reactivate, and confirm marketplace visibility follows each. | You |
| 17 | **Test all three notification channels** once #23/#24 exist — including that SMS only fires for the four intended events. | You |
| 18 | **Test the admin console end to end** (needs #4): verify a detailer, resolve a dispute each way, decide a Care claim, clear a report. | You |
| 19 | **Test account deletion** — App Store requires it to actually work. | You |
| 20 | **Device matrix**: smallest and largest supported iPhone, oldest supported iOS, and iPad if `supportsTablet` stays on. | You |
| 21 | **Test poor-network and offline behaviour** on the booking and payment paths. | You |
| 22 | **Verify App Check in monitor mode** before considering enforce. | You |

## D. Third-party accounts

| # | Task | Owner |
|---|---|---|
| 23 | **SendGrid** account + verified sender + API key → turns on email. | You |
| 24 | **Twilio** account + phone number → turns on SMS. | You |
| 25 | **Sentry DSN** in `.env` *and* EAS → turns on crash reporting. Shipping without it means blind debugging. | You |

## E. Legal and store metadata — **start #26 today**

| # | Task | Owner |
|---|---|---|
| 26 | **Terms of Service legal review.** The long pole — engage counsel now. Figures are code-verified; entity, state, address, liability cap and arbitration clause are open. | You |
| 27 | **Fill the placeholders, remove the `noindex` line, merge `terms.html` to `main`.** | Either |
| 28 | **Review the Privacy Policy against what the app now actually collects** — it predates email/SMS notifications and phone numbers. | You |
| 29 | **App Privacy nutrition label** in App Store Connect (answers prepared in `docs/APP_PRIVACY.md` — update for email/SMS). | You |
| 30 | **Screenshots**: 6.7" + 6.5", plus iPad if applicable. | You |
| 31 | **Store listing**: name, subtitle, description, keywords, category, age rating, support + marketing URLs. | You |
| 32 | **Demo account for Apple review.** A marketplace app *will* be rejected without working credentials for both roles. | You |

## F. Money go-live

| # | Task | Owner |
|---|---|---|
| 33 | **Enable 1099 tax reporting** — Stripe Dashboard → Connect settings → Tax forms. Nothing automated can verify this. | You |
| 34 | **Switch Stripe to LIVE mode**: live keys, new webhook endpoint + secret, re-verify **all 9** event subscriptions (the test-mode endpoint was subscribed to only 2 of 9 — assume nothing). | You |
| 35 | **Re-run the payment path in live mode** with one small real transaction, end to end including payout. | You |
| 36 | **Confirm the business entity can actually receive funds** — Stripe account fully onboarded, bank connected, identity verified. | You |

## G. Deferred (explicitly *not* blocking launch)

| # | Task | Notes |
|---|---|---|
| 37 | **Checkr background checks** | Needs counsel on FCRA consent/adverse-action first. `setDetailerVerified` + admin console is the manual stand-in. |
| 38 | **Revv Reach video + AI captions** | Needs a vendor decision (Shotstack vs Creatomate) and a cost model. |
| 39 | **App Check monitor → enforce rollout** | After a stable release. |
| 40 | **App-layer test coverage** | Functions logic is well covered; the React screens have none. |
| 41 | **Expo 57 major bump** | Clears the last `postcss` advisory. Not before a submission. |

---

## Three risks that could break the deadline

**Risk 1 — Apple may demand In-App Purchase for the $34.99 detailer
subscription.** Real-world services are IAP-exempt, but a recurring fee for
*marketplace visibility* is a digital service, and reviewers do challenge this.
If Apple insists, it is 30% of subscription revenue and a rearchitecture, not a
tweak. **Resolve this before building** — App Review guideline 3.1.3, and worth
a pre-submission question to Apple rather than discovering it in a rejection.

**Risk 2 — the critical path has never been run once.** Every payment, dispute
and Care flow is deployed and unit-tested but has never been exercised
end-to-end by a human. Budget for finding real bugs in item 14, not for
confirming there are none.

**Risk 3 — legal review is external and unschedulable.** It gates items 27, 29
and the submission itself. Start it today; it is the one item no amount of
engineering effort can compress.

## Is 2026-08-31 realistic?

Achievable, but only on the aggressive path: items 1–4 done this week, legal
engaged immediately, TestFlight in ~10 days, submission by ~Aug 22 to leave
slack for an Apple rejection round (typical review is 1–3 days; first
submissions of marketplace apps are frequently rejected once).

The tightest sequencing decision: **launching in Stripe test mode is not an
option**, so items 33–36 sit on the critical path too. If the deadline slips,
the honest lever is to ship a TestFlight beta by Aug 31 and take the public
release in early September, rather than compressing item 14.
