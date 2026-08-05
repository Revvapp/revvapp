/**
 * Creates the two demo accounts App Review needs, with enough data that the
 * reviewer sees a working marketplace rather than empty screens.
 *
 * A marketplace app is routinely rejected when the reviewer signs in and finds
 * nothing to look at, so this seeds a subscribed, payout-enabled detailer who is
 * actually visible in search, a client with a vehicle, and one completed booking
 * with an invoice so the money flow is inspectable without running a card.
 *
 * Usage (from functions/):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json
 *   npx ts-node scripts/seedDemoAccounts.ts
 *   npx ts-node scripts/seedDemoAccounts.ts --reset   # delete and recreate
 *
 * Safe to re-run. Prints the credentials to paste into App Store Connect →
 * App Review Information.
 *
 * NOTE: this seeds Firestore only. It deliberately does not create Stripe
 * objects — the reviewer should not be pushed through Connect onboarding, and
 * `payoutsEnabled` is set directly so the detailer is browsable. Do not run it
 * against a project in Stripe LIVE mode.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const auth = getAuth();

const DEMO_PASSWORD = 'RevvDemo!2026';
const CLIENT_EMAIL = 'appreview.client@revvapp.net';
const DETAILER_EMAIL = 'appreview.detailer@revvapp.net';

async function upsertUser(email: string): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password: DEMO_PASSWORD, emailVerified: true });
    return existing.uid;
  } catch {
    const created = await auth.createUser({
      email, password: DEMO_PASSWORD, emailVerified: true,
    });
    return created.uid;
  }
}

async function deleteIfExists(email: string): Promise<void> {
  try {
    const user = await auth.getUserByEmail(email);
    await Promise.allSettled([
      db.recursiveDelete(db.collection('clients').doc(user.uid)),
      db.recursiveDelete(db.collection('detailers').doc(user.uid)),
      db.collection('users').doc(user.uid).delete(),
      db.collection('emailLookup').doc(email.toLowerCase()).delete(),
    ]);
    await auth.deleteUser(user.uid);
    console.log(`  removed existing ${email}`);
  } catch {
    // Nothing to remove.
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--reset')) {
    console.log('Resetting demo accounts…');
    await deleteIfExists(CLIENT_EMAIL);
    await deleteIfExists(DETAILER_EMAIL);
  }

  const detailerId = await upsertUser(DETAILER_EMAIL);
  const clientId = await upsertUser(CLIENT_EMAIL);

  // --- Detailer: subscribed, payout-enabled, visible in search -------------
  await db.collection('users').doc(detailerId).set({
    uid: detailerId,
    email: DETAILER_EMAIL,
    userType: 'detailer',
    onboardingComplete: true,
    // 'active' is normally webhook-owned; set directly so the reviewer is not
    // asked to complete Stripe onboarding or enter a card.
    subscriptionStatus: 'active',
    isFoundingPro: false,
    trialDays: 0,
    trialStartDate: null,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('detailers').doc(detailerId).set({
    uid: detailerId,
    email: DETAILER_EMAIL,
    fullName: 'Marcus Reed',
    businessName: 'Reed Mobile Detailing',
    bio: 'Mobile detailing across the East Bay. Paint correction, ceramic coating, '
      + 'and full interior restoration. Fifteen years in the trade.',
    city: 'Oakland',
    state: 'CA',
    phone: '5105550142',
    isActive: true,
    payoutsEnabled: true,
    idVerified: true,
    rating: 4.9,
    reviewCount: 24,
    ratingSum: 117.6,
    rates: {
      'Express Wash': '$85',
      'Full Interior': '$180',
      'Paint Correction': '$450',
      'Ceramic Coating': '$900',
    },
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // --- Client: onboarded, with a vehicle in the garage ----------------------
  await db.collection('users').doc(clientId).set({
    uid: clientId,
    email: CLIENT_EMAIL,
    userType: 'client',
    onboardingComplete: true,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('clients').doc(clientId).set({
    uid: clientId,
    email: CLIENT_EMAIL,
    fullName: 'Dana Whitfield',
    phone: '5105550188',
    city: 'Berkeley',
    state: 'CA',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const vehicleId = 'demo-vehicle';
  await db.collection('clients').doc(clientId).collection('vehicles').doc(vehicleId).set({
    ownerId: clientId,
    make: 'Audi',
    model: 'A4',
    year: '2021',
    color: 'Nardo Grey',
    plate: 'DEMO123',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // --- One completed booking + invoice so the flow is inspectable ----------
  // Prefixed id, never a real PaymentIntent id, so it cannot collide with or be
  // mistaken for a live payment.
  const bookingId = 'demo-completed-booking';
  const completedAt = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1_000);
  await db.collection('bookings').doc(bookingId).set({
    clientId,
    detailerId,
    detailerName: 'Reed Mobile Detailing',
    businessName: 'Reed Mobile Detailing',
    clientName: 'Dana Whitfield',
    service: 'Full Interior',
    price: 180,
    status: 'completed',
    // No paymentIntentId: this is display-only seed data and must never be
    // picked up by the auto-release scheduler.
    paymentStatus: 'captured',
    captureState: 'complete',
    date: new Date(completedAt.toMillis()).toISOString().slice(0, 10),
    time: '10:00 AM',
    vehicleId,
    vehicleLabel: '2021 Audi A4',
    address: '1200 Shattuck Ave, Berkeley, CA',
    notes: null,
    timerAccumulatedSeconds: 7_260,
    virSignedAt: completedAt,
    completedAt,
    releaseEligibleAt: completedAt,
    createdAt: completedAt,
  }, { merge: true });

  await db.collection('invoices').doc(bookingId).set({
    bookingId,
    clientId,
    detailerId,
    clientName: 'Dana Whitfield',
    detailerName: 'Reed Mobile Detailing',
    businessName: 'Reed Mobile Detailing',
    vehicleLabel: '2021 Audi A4',
    service: 'Full Interior',
    date: new Date(completedAt.toMillis()).toISOString().slice(0, 10),
    price: 180,
    platformFee: 18,
    detailerPayout: 162,
    status: 'released',
    afterPhotos: [],
    createdAt: completedAt,
  }, { merge: true });

  console.log(`
Demo accounts ready. Paste into App Store Connect → App Review Information:

  Client   ${CLIENT_EMAIL}   /  ${DEMO_PASSWORD}
  Detailer ${DETAILER_EMAIL} /  ${DEMO_PASSWORD}

Notes for the reviewer field:
  Sign in with either account to see that role. The detailer is already
  subscribed and payout-enabled, so no card entry is required to browse. One
  completed job with its invoice is included so the payment record is visible.
  Booking a new job authorizes a card hold via Stripe; use test card
  4242 4242 4242 4242 with any future expiry and CVC.
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
