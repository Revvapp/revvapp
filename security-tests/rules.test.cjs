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
