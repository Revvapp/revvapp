# REVV — What's Left

Actionable index as of **2026-08-04**. Detail and reasoning live in
`RELEASE_CHECKLIST.md`; exact commands live in `RELEASE_RUNBOOK.md`. This file is
the "what do I do next" view.

**There is no known code work blocking a build.** App and functions both
typecheck, lint and test clean (21 app tests, 59 functions tests, 12 rules
tests), and the iOS bundle builds. Everything below needs a credential, a
payment, a human decision, a web UI, or is a feature nobody has written yet.

Owner column: **You** = needs your account/credential/judgement. **Either** = I
can do it if you grant the permission or make the one decision it hangs on.

---

## 1. Blocking a working build

| # | Task | Owner | Notes |
|---|---|---|---|
| 1.1 | **Deploy Cloud Functions** | Either | `resolveReport`, `onCareClaimUpdated`, `onSubscriptionStatusChanged` have **never** been deployed — 30 live vs 33 exported. Blocked by the Claude Code permission classifier, not credentials. `npx firebase-tools deploy --only functions --project revv-app2026` |
| 1.2 | **Redeploy Firestore + Storage rules** | Either | Cheap insurance — last deployed 2026-07-27 and nothing has verified they still match the repo. `--only firestore:rules,storage` |
| 1.3 | **Kick off the iOS build** | Either | `npx eas-cli build --platform ios --profile production`. Also classifier-blocked. Build env and Firebase config are fixed and verified against the real bundle. |
| 1.4 | **Grant the `admin` claim** | You | Needs a service-account key **and** a decision: *which app-user email* holds it (an account in the app's own Auth pool, not the console login). Until then `app/admin/` is unreachable and no detailer can be verified. |

## 2. Required before App Store submission

| # | Task | Owner | Notes |
|---|---|---|---|
| 2.1 | **Terms of Service — legal review** | You | `docs/terms.html` is built and figures are code-verified. Fill the amber placeholders: legal entity, state, mailing address, liability cap, arbitration clause. |
| 2.2 | **Merge ToS to `main`** | Either | Pages serves `docs/` from `main`. **Only after 2.1** — do not publish with placeholders showing. Then use https://revvapp.github.io/revvapp/terms.html as the EULA URL. |
| 2.3 | **App Store Connect record** | You | Bundle id `com.revvapp.revv`. Category, age rating, support + marketing URLs. |
| 2.4 | **App Privacy nutrition label** | You | Answers already prepared in `docs/APP_PRIVACY.md`. |
| 2.5 | **Screenshots** | You | 6.7" + 6.5", plus iPad if `supportsTablet` stays on. |
| 2.6 | **iOS push (APNs) key** | You | `eas credentials` → push key. Push code is wired and the EAS `projectId` is present, but iOS notifications won't deliver without this. Less urgent now that email/SMS exist as a fallback — but push is still the primary channel. |
| 2.9 | **SendGrid + Twilio accounts** | You | Turns on the email/SMS layer built in 4.2. See `RELEASE_RUNBOOK.md` §3b. |
| 2.7 | **Sentry DSN** | You | Set `EXPO_PUBLIC_SENTRY_DSN` in **both** `.env` and EAS. Crash reporting is a no-op until then. |
| 2.8 | **TestFlight beta** | You | `eas submit` after 2.3 exists. |

## 3. Before taking real money

| # | Task | Owner | Notes |
|---|---|---|---|
| 3.1 | **Full critical-path QA in Stripe test mode** | You | The one nobody can skip. Signup (both roles) → Connect onboarding → subscription trial → booking + hold → VIR → client sign → timer → complete → capture → invoice → dispute → resolve (all 3 outcomes) → Revv Care claim → review. Only became testable end-to-end after the webhook fix. |
| 3.2 | **Enable 1099 tax reporting** | You | Stripe Dashboard → Connect settings → Tax forms. Code already delegates correctly; nothing automated can verify this. |
| 3.3 | **Switch Stripe to LIVE mode** | You | New keys, new webhook endpoint + secret, re-verify all 9 event subscriptions. Everything today is test mode. |
| 3.4 | **App Check → enforce** | You | Register App Attest / Play Integrity in console, rebuild native, roll out monitor → enforce. See `docs/APP_CHECK.md`. Currently inert. |

## 4. Unbuilt features

Deliberately deferred — none block a beta.

| # | Task | Notes |
|---|---|---|
| 4.2 | ✅ **Email + SMS notifications — BUILT** | Only the accounts are left. Add SendGrid / Twilio credentials per `RELEASE_RUNBOOK.md` §3b and redeploy; each channel activates independently and is a logged no-op until then. |
| 4.1 | **Checkr background checks** | **Deliberately not built** — see below. `setDetailerVerified` + admin console remains the interim manual stand-in (itself blocked on 1.4). |
| 4.3 | **Revv Reach video + AI captions** | **Deliberately not built** — see below. `updateInvoiceReach` and the opt-in exist; the rendering pipeline does not. |

### Why 4.1 and 4.3 were not built blind

Both need a decision before they need code, and building them speculatively
would produce something that has to be thrown away.

- **Checkr** is FCRA-regulated. The hard part is not the API call — it is the
  disclosure and written consent flow, adverse-action notices, and how a failed
  check is surfaced without creating a defamation or discrimination exposure.
  That has to be designed with counsel, not reverse-engineered from API docs.
  Guessing at it would create a compliance surface that *looks* finished.
- **Revv Reach** needs a vendor decision (Shotstack vs Creatomate — different
  templating models, so the integration is not portable between them), a
  per-render cost model, and creative direction for the output. None of those
  are engineering calls.

Both are genuinely ready to build the moment those decisions are made.

## 5. Quality (no known defects — hardening)

| # | Task | Notes |
|---|---|---|
| 5.1 | Widen test coverage into the app layer | Functions logic is now well covered; the React screens have none. |
| 5.2 | Verify CI actually passes on GitHub | The workflow has never run — no push to `main` since it was added. |
| 5.3 | Bump `ios.buildNumber` handling | `autoIncrement: true` is set on the production profile, so this should be automatic — confirm on the first successful build. |

---

## Recently closed (2026-08-04)

Kept so nobody re-investigates these.

- **EAS had zero environment variables** — a production build would have inlined
  `apiKey: undefined` and crashed on launch for every user. All 7 publishable
  values now set for `production` + `preview`.
- **Storage bucket pointed at a 404** — `.env` said `revv-app2026.appspot.com`;
  the real bucket is `revv-app2026.firebasestorage.app`. Every upload path was
  dead.
- **Wrong Firebase app id and API key** — `.env` carried the *Android* app id and
  a key that wasn't the Web app's. Now byte-identical to `apps:sdkconfig web`.
- **Money math and booking state machine untested** — extracted to
  `functions/src/money.ts` and `functions/src/bookingRules.ts` (which production
  now calls) and covered by 59 tests, wired into CI.
- **Invoice fee was a third copy of the 90/10 math** in floating-point dollars —
  now derived from `splitPayout`.
- **`NaN` timer bug** — a corrupt `timerAccumulatedSeconds` produced `NaN`, which
  Firestore rejects, failing the transition and stranding a job mid-service.

### Two traps worth remembering
- `.env` and **EAS env vars are separate** and must be updated together. `.env`
  is gitignored, so it never reaches a build server.
- **Metro caches inlined `EXPO_PUBLIC_*` values.** `expo export` after a `.env`
  change silently re-emits the old ones — use `--clear`, and verify with
  `strings <out>/_expo/static/js/ios/*.hbc | grep <value>`.
