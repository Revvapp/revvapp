# Revv — Engineering Context

## What Revv Is
Two-sided car detailing marketplace.
Supply side: professional detailers
Demand side: car owners (clients)
Launch market: Sacramento CA

## Tech Stack
- Frontend: React Native with Expo
- Backend: Firebase
- Database: Firestore
- Auth: Firebase Authentication
- Storage: Firebase Storage
- Real-time: Firestore listeners
- Payments: Stripe Connect Express
- Notifications: Expo Notifications
- Error Monitoring: Sentry
- Analytics: Firebase Analytics

## Two User Types

### Detailer (Supply Side)
Features:
- Dashboard (income, job count, 
  daily goal progress)
- Vehicle Inspection Report
- Job Timer
- Revv Invoice
- Revv Pay (escrow payments)
- Revv Care (damage protection)
- Revv Reach (social posting)
- Pro Profile
- Income Goal Tracking
- Before & After Report

### Client (Demand Side)
Features:
- Search and browse Pros
- Pro Profiles
- Instant Booking
- Vehicle Profiles
- In-app Messaging
- Booking History

## Payment Flow (never deviate)
1. Client books → card pre-authorized
2. Funds held in Stripe escrow
3. Detailer completes job
4. 24-hour dispute window opens
5. No dispute → auto-release to detailer
6. Revv takes 10% gross
7. Stripe takes 2.9% + $0.30
8. Detailer receives remainder instantly

## Critical Business Rules
- No booking without card on file
- Vehicle Inspection Report must be
  completed and client must sign
  before timer can start
- Reviews only unlock after payment
  releases — enforced at database level
- Detailer must have active subscription
  to appear in marketplace search
- Founding Pros (first 25): 60-day free
  trial, no card required
- Standard detailers: 14-day trial,
  card on file, auto-charges day 15
- All bookings card-only, no cash
- Revv Care claims must be filed
  within 72 hours of job completion

## Pricing
- Detailer subscription: $34.99/month
- Platform take rate: 10% gross
- Net to Revv after Stripe: ~6.9%

## Firebase Project
- Project ID: revv-app2026
- Config: firebaseConfig.js
- Environment variables: .env

## Security Rules
- Never expose Stripe secret keys
  client-side
- All payment logic server-side only
- Firestore security rules on all
  collections
- All API calls wrapped in try/catch
- Stripe webhooks always verified