const { readFileSync } = require('node:fs');
const { after, before, beforeEach, test } = require('node:test');

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');
const { getBytes, ref, uploadBytes } = require('firebase/storage');

const PROJECT_ID = 'demo-no-project';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/client'), {
      uid: 'client', email: 'client@example.com', userType: 'client',
      subscriptionStatus: 'pending', trialDays: 0, trialStartDate: null,
    });
    await setDoc(doc(db, 'users/detailer'), {
      uid: 'detailer', email: 'detailer@example.com', userType: 'detailer',
      subscriptionStatus: 'pending', trialDays: 0, trialStartDate: null,
    });
    await setDoc(doc(db, 'bookings/booking-1'), {
      clientId: 'client', detailerId: 'detailer', status: 'completed', price: 200,
      paymentIntentId: 'pi_1', paymentStatus: 'requires_capture',
      completedAt: new Date(), releaseEligibleAt: new Date(Date.now() + 86_400_000),
      afterPhotosFinalizedAt: new Date(),
    });
    await setDoc(doc(db, 'invoices/booking-1'), {
      bookingId: 'booking-1', clientId: 'client', detailerId: 'detailer',
      status: 'disputed', price: 200, platformFee: 20, detailerPayout: 180,
    });
    await setDoc(doc(db, 'disputes/booking-1'), {
      bookingId: 'booking-1', invoiceId: 'booking-1', clientId: 'client',
      detailerId: 'detailer', status: 'open', description: 'private evidence',
    });
    await setDoc(doc(db, 'users/dealer'), {
      uid: 'dealer', email: 'dealer@example.com', userType: 'client',
      isDealership: true, subscriptionStatus: 'pending', trialDays: 0, trialStartDate: null,
    });
    await setDoc(doc(db, 'fleetOrders/order-1'), {
      dealershipId: 'dealer', service: 'Full Interior', vehicleCount: 12,
      status: 'requested', estimateCents: 183600, quotedCents: null,
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test('booking parties can read but cannot create or mutate lifecycle/payment fields', async () => {
  const clientDb = env.authenticatedContext('client', { email: 'client@example.com' }).firestore();
  const detailerDb = env.authenticatedContext('detailer', { email: 'detailer@example.com' }).firestore();
  await assertSucceeds(getDoc(doc(clientDb, 'bookings/booking-1')));
  await assertSucceeds(getDoc(doc(detailerDb, 'bookings/booking-1')));
  await assertFails(updateDoc(doc(detailerDb, 'bookings/booking-1'), {
    completedAt: new Date(0), releaseEligibleAt: new Date(0),
  }));
  await assertFails(updateDoc(doc(clientDb, 'bookings/booking-1'), { paymentStatus: 'captured' }));
  await assertFails(setDoc(doc(clientDb, 'bookings/forged'), {
    clientId: 'client', detailerId: 'detailer', status: 'pending', price: 1,
  }));
});

test('neither party can clear a dispute or forge an invoice/dispute', async () => {
  const clientDb = env.authenticatedContext('client').firestore();
  const detailerDb = env.authenticatedContext('detailer').firestore();
  await assertFails(updateDoc(doc(detailerDb, 'invoices/booking-1'), { status: 'released' }));
  await assertFails(updateDoc(doc(detailerDb, 'disputes/booking-1'), { status: 'resolved' }));
  await assertFails(setDoc(doc(clientDb, 'disputes/forged'), {
    clientId: 'client', detailerId: 'victim', status: 'open',
  }));
});

test('users cannot change roles or subscription entitlements', async () => {
  const db = env.authenticatedContext('client', { email: 'client@example.com' }).firestore();
  await assertFails(updateDoc(doc(db, 'users/client'), { userType: 'detailer' }));
  await assertFails(updateDoc(doc(db, 'users/client'), { subscriptionStatus: 'active' }));
  await assertSucceeds(updateDoc(doc(db, 'users/client'), { onboardingComplete: true }));
});

test('account types cannot create the opposite role profile or self-activate', async () => {
  const clientDb = env.authenticatedContext('client', { email: 'client@example.com' }).firestore();
  const detailerDb = env.authenticatedContext('detailer', { email: 'detailer@example.com' }).firestore();
  await assertFails(setDoc(doc(clientDb, 'detailers/client'), {
    uid: 'client', idVerified: false, rating: 0, reviewCount: 0,
    payoutsEnabled: false, stripeAccountId: '', isActive: false,
  }));
  await assertFails(setDoc(doc(detailerDb, 'detailers/detailer'), {
    uid: 'detailer', idVerified: false, rating: 0, reviewCount: 0,
    payoutsEnabled: false, stripeAccountId: '', isActive: true,
  }));
  await assertSucceeds(setDoc(doc(detailerDb, 'detailers/detailer'), {
    uid: 'detailer', idVerified: false, rating: 0, reviewCount: 0,
    payoutsEnabled: false, stripeAccountId: '', isActive: false,
  }));
});

test('email lookup cannot be enumerated by guests or other accounts', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'emailLookup/victim@example.com'), {
      uid: 'victim', userType: 'client',
    });
  });
  const guest = env.unauthenticatedContext().firestore();
  const attacker = env.authenticatedContext('attacker', { email: 'attacker@example.com' }).firestore();
  await assertFails(getDoc(doc(guest, 'emailLookup/victim@example.com')));
  await assertFails(getDoc(doc(attacker, 'emailLookup/victim@example.com')));
});

test('dispute evidence is private and finalized job evidence cannot be overwritten', async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const clientStorage = env.authenticatedContext('client').storage();
  const detailerStorage = env.authenticatedContext('detailer').storage();
  const attackerStorage = env.authenticatedContext('attacker').storage();

  const disputePath = ref(clientStorage, 'disputes/booking-1/client/evidence.jpg');
  await assertSucceeds(uploadBytes(disputePath, bytes, { contentType: 'image/jpeg' }));
  await assertSucceeds(getBytes(ref(detailerStorage, disputePath.fullPath)));
  await assertFails(getBytes(ref(attackerStorage, disputePath.fullPath)));
  await assertFails(uploadBytes(
    ref(detailerStorage, 'after-photos/booking-1/after.jpg'),
    bytes,
    { contentType: 'image/jpeg' }
  ));
});

test('storage rejects oversized/non-image profile uploads', async () => {
  const storage = env.authenticatedContext('detailer').storage();
  await assertFails(uploadBytes(
    ref(storage, 'detailers/detailer/payload.html'),
    new Uint8Array([1, 2, 3]),
    { contentType: 'text/html' }
  ));
});

test('detailer profiles are readable by signed-in users but not anonymous callers', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'detailers/detailer'), {
      uid: 'detailer', fullName: 'Ace Detailing', phone: '555-0100',
      lat: 38.58, lng: -121.49, idVerified: false, rating: 0, reviewCount: 0,
      payoutsEnabled: false, stripeAccountId: '', isActive: false,
    });
  });
  const guest = env.unauthenticatedContext().firestore();
  const clientDb = env.authenticatedContext('client', { email: 'client@example.com' }).firestore();
  // Phone + precise coordinates must not be scrapable without authentication.
  await assertFails(getDoc(doc(guest, 'detailers/detailer')));
  await assertSucceeds(getDoc(doc(clientDb, 'detailers/detailer')));
});

test('care claims are private to the filing client and never client-writable', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'careClaims/booking-1'), {
      bookingId: 'booking-1', clientId: 'client', detailerId: 'detailer',
      status: 'open', description: 'scratch on the driver door', amountRequestedCents: 15000,
    });
    await setDoc(doc(ctx.firestore(), 'revvCareLedger/booking-1'), {
      bookingId: 'booking-1', reserveCents: 200,
    });
  });
  const clientDb = env.authenticatedContext('client', { email: 'client@example.com' }).firestore();
  const detailerDb = env.authenticatedContext('detailer', { email: 'detailer@example.com' }).firestore();
  // The filing client may read their own claim; the reported detailer may not.
  await assertSucceeds(getDoc(doc(clientDb, 'careClaims/booking-1')));
  await assertFails(getDoc(doc(detailerDb, 'careClaims/booking-1')));
  // Claims are created and decided server-side only — never written directly.
  await assertFails(setDoc(doc(clientDb, 'careClaims/booking-2'), {
    bookingId: 'booking-2', clientId: 'client', detailerId: 'detailer', status: 'open',
  }));
  await assertFails(updateDoc(doc(clientDb, 'careClaims/booking-1'), { status: 'approved' }));
  // The Revv Care reserve ledger is server-only (default-denied).
  await assertFails(getDoc(doc(clientDb, 'revvCareLedger/booking-1')));
});

test('the admin claim widens reads for the review console but never grants writes', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'careClaims/booking-1'), {
      bookingId: 'booking-1', clientId: 'client', detailerId: 'detailer',
      status: 'open', description: 'scratch on the driver door', amountRequestedCents: 15000,
    });
    await setDoc(doc(ctx.firestore(), 'reports/report-1'), {
      bookingId: 'booking-1', reporterId: 'client', reporterRole: 'client',
      reportedUserId: 'detailer', clientId: 'client', detailerId: 'detailer',
      category: 'off_platform', status: 'open',
    });
  });
  // An admin is a third party to this booking — reads work only via the claim.
  const adminDb = env.authenticatedContext('staff', { email: 'staff@revvapp.net', admin: true }).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'disputes/booking-1')));
  await assertSucceeds(getDoc(doc(adminDb, 'careClaims/booking-1')));
  await assertSucceeds(getDoc(doc(adminDb, 'invoices/booking-1')));
  await assertSucceeds(getDoc(doc(adminDb, 'reports/report-1')));

  // Reads only. Every admin action is a callable that re-checks the claim
  // server-side, so the console can never write directly.
  await assertFails(updateDoc(doc(adminDb, 'disputes/booking-1'), { status: 'resolved' }));
  await assertFails(updateDoc(doc(adminDb, 'careClaims/booking-1'), { status: 'approved' }));
  await assertFails(updateDoc(doc(adminDb, 'invoices/booking-1'), { status: 'released' }));
  await assertFails(updateDoc(doc(adminDb, 'detailers/detailer'), { idVerified: true }));
  await assertFails(updateDoc(doc(adminDb, 'reports/report-1'), { status: 'reviewed' }));
  // Bookings were deliberately not widened — the invoice carries what's needed.
  await assertFails(getDoc(doc(adminDb, 'bookings/booking-1')));

  // A signed-in non-admin third party still sees nothing — not even the
  // reporter's own detailer counterpart, who the report is filed against.
  const strangerDb = env.authenticatedContext('stranger', { email: 'stranger@example.com' }).firestore();
  await assertFails(getDoc(doc(strangerDb, 'disputes/booking-1')));
  await assertFails(getDoc(doc(strangerDb, 'careClaims/booking-1')));
  await assertFails(getDoc(doc(strangerDb, 'invoices/booking-1')));
  const detailerDb = env.authenticatedContext('detailer', { email: 'detailer@example.com' }).firestore();
  await assertFails(getDoc(doc(detailerDb, 'reports/report-1')));

  // A forged claim is only trusted from the token, which clients cannot mint —
  // an unauthenticated caller gets nothing either.
  const guestDb = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(guestDb, 'disputes/booking-1')));
  await assertFails(getDoc(doc(guestDb, 'careClaims/booking-1')));
});

test('a detailer cannot self-assign a Stripe customer id to forge subscription state', async () => {
  const detailerDb = env.authenticatedContext('detailer', { email: 'detailer@example.com' }).firestore();
  // Base profile is fine.
  await assertSucceeds(setDoc(doc(detailerDb, 'detailers/detailer'), {
    uid: 'detailer', idVerified: false, rating: 0, reviewCount: 0,
    payoutsEnabled: false, stripeAccountId: '', isActive: false,
  }));
  // Claiming a Stripe customer id (which the subscription webhook keys on) is denied.
  await assertFails(updateDoc(doc(detailerDb, 'detailers/detailer'), {
    stripeCustomerId: 'cus_victim',
  }));
});

test('reviews require a paid, completed booking, valid score, and are immutable', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    // booking-1 (from beforeEach) is completed but only 'requires_capture'.
    // booking-paid is completed AND released ('captured') — the only reviewable state.
    await setDoc(doc(ctx.firestore(), 'bookings/booking-paid'), {
      clientId: 'client', detailerId: 'detailer', status: 'completed', price: 200,
      paymentIntentId: 'pi_paid', paymentStatus: 'captured', completedAt: new Date(),
    });
  });
  const clientDb = env.authenticatedContext('client', { email: 'client@example.com' }).firestore();
  const detailerDb = env.authenticatedContext('detailer', { email: 'detailer@example.com' }).firestore();
  const good = { bookingId: 'booking-paid', clientId: 'client', detailerId: 'detailer', rating: 5, body: 'Great' };

  // Completed but payment not yet released → denied.
  await assertFails(setDoc(doc(clientDb, 'reviews/booking-1'), {
    bookingId: 'booking-1', clientId: 'client', detailerId: 'detailer', rating: 5,
  }));
  // Doc id must equal the bookingId (caps it at one review per booking).
  await assertFails(setDoc(doc(clientDb, 'reviews/not-the-booking-id'), good));
  // Rating must be a real 1–5 score.
  await assertFails(setDoc(doc(clientDb, 'reviews/booking-paid'), { ...good, rating: 6 }));
  await assertFails(setDoc(doc(clientDb, 'reviews/booking-paid'), { ...good, rating: 0 }));
  // Cannot target a different detailer than the booking's.
  await assertFails(setDoc(doc(clientDb, 'reviews/booking-paid'), { ...good, detailerId: 'victim' }));
  // The detailer cannot post a review masquerading as the client.
  await assertFails(setDoc(doc(detailerDb, 'reviews/booking-paid'), good));
  // The booking's own client, paid + completed, one honest review → allowed.
  await assertSucceeds(setDoc(doc(clientDb, 'reviews/booking-paid'), good));
  // Reviews are permanent — no edits after the fact.
  await assertFails(updateDoc(doc(clientDb, 'reviews/booking-paid'), { rating: 1 }));
});

test('dealership status cannot be self-granted and fleet orders are private', async () => {
  const clientDb = env.authenticatedContext('client', { email: 'client@example.com' }).firestore();
  const dealerDb = env.authenticatedContext('dealer', { email: 'dealer@example.com' }).firestore();

  // isDealership gates volume pricing, so it is server-owned like the billing
  // fields — a client must not be able to promote themselves into it.
  await assertFails(updateDoc(doc(clientDb, 'users/client'), { isDealership: true }));
  await assertFails(setDoc(doc(clientDb, 'users/client'), {
    uid: 'client', email: 'client@example.com', userType: 'client', isDealership: true,
  }));
  // Nor may a real dealership revoke or re-assert it by hand.
  await assertFails(updateDoc(doc(dealerDb, 'users/dealer'), { isDealership: false }));

  // A dealership reads its own orders; nobody else can.
  await assertSucceeds(getDoc(doc(dealerDb, 'fleetOrders/order-1')));
  await assertFails(getDoc(doc(clientDb, 'fleetOrders/order-1')));

  // Every mutation is a callable, so direct writes are closed to everyone —
  // including the dealership that owns the order.
  await assertFails(updateDoc(doc(dealerDb, 'fleetOrders/order-1'), { quotedCents: 1 }));
  await assertFails(updateDoc(doc(dealerDb, 'fleetOrders/order-1'), { status: 'accepted' }));
  await assertFails(setDoc(doc(dealerDb, 'fleetOrders/forged'), {
    dealershipId: 'dealer', service: 'Ceramic Coating', vehicleCount: 99, status: 'accepted',
  }));
});
