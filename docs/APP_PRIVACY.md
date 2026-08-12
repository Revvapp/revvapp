# App Store "App Privacy" answers

Derived from the code so the App Store Connect privacy questionnaire can be filled
out accurately. No advertising or third-party tracking SDKs are present, so
**"Used for tracking" = No** for every item. Everything below is collected for
**App Functionality** (and, where noted, App Analytics/Diagnostics).

Verify each line against the current code before submitting; update if data use changes.

| Data type | Collected? | Linked to identity | Purpose | Where in code |
|---|---|---|---|---|
| Email address | Yes | Yes | App Functionality (auth) | Firebase Auth; `users/{uid}.email` |
| Name | Yes | Yes | App Functionality | `clients`/`detailers` `fullName` |
| Phone number | Yes (**both roles**) | Yes | App Functionality (contact + SMS alerts) | `clients/{uid}.phone` (onboarding), `detailers/{uid}.phone` (onboarding step 1) |
| Precise location | Yes (clients) | Yes | App Functionality (find nearby detailers) | `hooks/useFindDetailers.ts` (expo-location) |
| Coarse location | Yes (detailers) | Yes | App Functionality (map placement) | detailer `lat`/`lng` |
| Photos | Yes | Yes | App Functionality (VIR, before/after, profile, portfolio) | expo-image-picker → Firebase Storage |
| User content (reviews, messages, notes, reports) | Yes | Yes | App Functionality | `reviews`, `conversations`, `bookings`, `reports` |
| User ID | Yes | Yes | App Functionality | Firebase `uid` |
| Device ID / push token | Yes | Yes | App Functionality (notifications) | `pushTokens/{uid}` |
| Payment info (card) | **Collected by Stripe, not by the app** | — | App Functionality | Stripe PaymentSheet; app stores only Stripe customer/account IDs, never card data |
| Purchase history | Yes | Yes | App Functionality | `bookings`, `invoices` |
| Crash data / diagnostics | Only if Sentry DSN set | Yes | App Analytics / Diagnostics | `app/_layout.tsx` (Sentry, no-op if `EXPO_PUBLIC_SENTRY_DSN` unset) |

**Not collected:** browsing history, contacts, health, advertising identifiers,
search history, audio. **No third-party analytics/ads.** Firebase Analytics is
**not** wired in — do not declare analytics collection unless you add it.

## Third parties that receive personal data (processors)

Apple asks about data "shared with third parties." These are service providers
acting on our instructions, not independent controllers, but they must still be
disclosed in the Privacy Policy:

| Processor | Receives | Why |
|---|---|---|
| **Google Firebase** | Everything above | Auth, database, storage, functions |
| **Stripe** | Name, email, card data (directly), payout/identity data for detailers | Payments, Connect payouts, tax reporting |
| **Expo push service** | Device push token | Notification delivery |
| **SendGrid** *(once configured)* | Email address, notification content | Transactional email |
| **Twilio** *(once configured)* | Phone number, message text | Transactional SMS |
| **Sentry** *(once DSN set)* | Crash diagnostics, user id | Crash reporting |
| **Wikipedia API** | Vehicle make/model only — **no user identifiers** | Fetching a car image (`lib/carImage.ts`) |

SendGrid and Twilio are new as of 2026-08-12 and are **not yet reflected in the
hosted Privacy Policy** — see item 28 on the road-to-publish list.

## Info.plist permission strings (already in app.json → verify wording at submit)
- Location (when in use): "Revv needs your location to find detailers near you."
- Camera: capture vehicle inspection and before/after photos.
- Photo library: upload profile and portfolio photos.

## Notes for the reviewer questionnaire
- **Account creation required?** Yes → therefore **in-app account deletion is required** and is implemented (Profile → Edit Profile → Delete Account).
- **Third-party payment** (Stripe) for real-world services (car detailing) → not In-App Purchase. Guideline **3.1.3(e)** makes external payment not merely permitted but *required* here.
  ⚠️ **The $34.99/mo detailer subscription is a separate question and is the real exposure — read `APPLE_IAP_RISK.md` before submitting.**
- **Users can opt out** of email and SMS at Profile → Notifications. Push follows the OS permission.
- Provide the **Privacy Policy URL** (https://revvapp.github.io/revvapp/) and a **Terms/EULA URL** (https://revvapp.github.io/revvapp/terms.html, once counsel signs off and the `noindex` tag is removed).
