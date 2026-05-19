# REVV — Car Detailing OS

A hybrid SaaS + marketplace for professional car detailing. Detailers run their entire business through the app. Clients get a premium, protected booking experience.

**Stack:** Expo (React Native) · Firebase (Firestore, Storage, Functions) · Stripe Connect Express

---

## Business Model

| | |
|---|---|
| Detailer subscription | $34.99/month (14-day free trial, card required) |
| Founding Pro (first 25) | 60-day free trial, no card, permanent badge |
| Take rate | 10% of every transaction from day 1 |
| Revv Care fund | 1% of the take rate per booking (damage protection) |
| Coverage cap | $2,500 per booking |

---

## The Core Job Flow

```
Client books → card pre-authorized (held in escrow)
      ↓
Detailer accepts job
      ↓
Detailer arrives → VIR (panel-by-panel photos, pre-existing damage logged)
      ↓
Client digitally signs VIR in-app
      ↓
Job Timer starts  ← HARD GATE: impossible without VIR sign-off
      ↓
Detailer works through service checklist
      ↓
Job complete → Before/After photos uploaded
      ↓
Revv Invoice auto-generated
      ↓
24-hour dispute window opens
      ↓
No dispute → payment auto-releases to detailer (minus 10% + Stripe fees)
      ↓
Both parties leave verified review (requires real Revv Pay transaction)
      ↓
Revv Reach → AI-assisted social content creation
```

---

## Feature Status

### Auth & Onboarding
| Feature | Status |
|---|---|
| Email/password login & signup (both roles) | ✅ Done |
| Detailer onboarding (4-step: business, services, location, pricing) | ✅ Done |
| Client onboarding | ✅ Done |
| Role-based routing (detailer vs. client) | ✅ Done |
| Push notification token saved on login | ✅ Done |
| Sentry crash monitoring | ✅ Done |
| Checkr background check (gates detailer profile going live) | ❌ Not built |
| Detailer subscription billing ($34.99/month via Stripe) | ❌ Not built |
| Founding Pro badge + 60-day trial flow | ❌ Not built |

---

### Detailer — Core Screens
| Feature | Status |
|---|---|
| Dashboard — live Firestore data (jobs, earnings, pending count) | ✅ Done |
| Jobs tab — full booking status flow (pending → accepted → in-progress → complete) | ✅ Done |
| Job detail screen — accept / decline / complete actions | ✅ Done |
| VIR — panel-by-panel photo capture with interactive car diagram | ✅ Done |
| Job Timer — live clock + service checklist, gated behind VIR | ✅ Done |
| Before/After photo upload | ✅ Done |
| Detailer Invoice — formal receipt layout | ✅ Done |
| Edit Profile | ✅ Done |
| Clients tab | ✅ Done (mock data) |
| Earnings tab | ✅ Done (mock data) |
| Dev-tools screen (DEV only, gated in production) | ✅ Done |
| Stripe Connect Express — KYC onboarding for payouts | ❌ Not built |
| Payment auto-release to detailer after 24hr window | ❌ Not built |
| Off-platform report button (on every active booking) | ❌ Not built |

---

### Detailer — Revv Reach (Social Studio)
| Feature | Status |
|---|---|
| Reach tab — persistent hub in bottom nav | ✅ Done |
| AI Caption Studio — topic chips, style pills, generate button | ✅ Done |
| Platform deep links (Instagram, TikTok, Twitter, Facebook) | ✅ Done |
| "From Your Jobs" content feed | ✅ Done |
| Reel Studio — 5-step wizard (template → media → AI content → music → render) | ✅ Done |
| `lib/reachService.ts` — clean API boundary, mock now, swap-ready | ✅ Done |
| Shotstack / Creatomate video rendering API | ❌ Needs API account (code ready) |
| AI caption generation via Firebase Function | ❌ Needs Firebase Function (code ready) |
| Before photos in Reel Studio (VIR URLs stored in Firestore) | ❌ Not wired |
| Save to Camera Roll (`expo-media-library`) | ❌ Not built |

---

### Client — Core Screens
| Feature | Status |
|---|---|
| Dashboard | ✅ Done |
| Bookings tab — real-time list with status badges | ✅ Done |
| 4-step booking flow (service → vehicle → schedule → confirm) | ✅ Done |
| Detailer public profile screen | ✅ Done |
| VIR sign screen — client signs off on the inspection | ✅ Done |
| Client Invoice — luxury receipt layout with dispute window logic | ✅ Done |
| Find Detailers — map + list (main entry point) | ✅ Done |
| Garage tab | ❌ Not built |
| Stripe card pre-auth on booking (money into escrow) | ❌ Not built |
| 24hr Dispute — raise a dispute screen (`/dispute/[id]`) | ❌ Not built |
| Verified Reviews — post-payment (requires real Stripe transaction) | ❌ Not built |
| Off-platform report button | ❌ Not built |

---

### Infrastructure & Integrations
| Feature | Status |
|---|---|
| Firebase Firestore — real-time data across all screens | ✅ Done |
| Firebase Storage — photo upload (XHR blob pattern) | ✅ Done |
| Firestore security rules — tightened for bookings | ✅ Done |
| Expo push notifications — token fetch + save | ✅ Done |
| Sentry error monitoring | ✅ Done |
| Stripe Connect Express — detailer payout accounts | ❌ Not built |
| Stripe card pre-auth + escrow | ❌ Not built |
| Payment auto-release + 10% take rate logic | ❌ Not built |
| Revv Care fund — 1% set-aside per booking | ❌ Not built |
| Email / SMS delivery (Twilio) — invoice + notifications | ❌ Not built |
| Push notifications — server-side triggers on booking events | ❌ Not built |
| Per-booking chat / messaging | ❌ Not built |
| Firebase Cloud Functions (Blaze plan) | ❌ Not set up |

---

## Critical Path to First Real Transaction

These must be done in order before any real money can move:

1. **Find Detailers** — clients need to discover and browse detailers
2. **Stripe card pre-auth** — captures payment on booking confirmation
3. **Stripe Connect Express** — detailer KYC so they can receive payouts
4. **Payment auto-release** — releases escrow after 24hr dispute window closes
5. **Dispute flow** — client raises a dispute before window closes

Everything else (reviews, Revv Care, messaging, social) builds on top of a real transaction.

---

## Running the App

```bash
# Install dependencies
npm install

# Start Metro bundler
npx expo start --clear

# Build and run on physical iPhone (replace UDID with your device)
npx expo run:ios --device <UDID>
```

**Note:** This is a bare workflow app. Hot reload works over Metro (same WiFi). New native modules require a full Xcode rebuild.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_SENTRY_DSN        # optional — Sentry is no-op if missing
```
