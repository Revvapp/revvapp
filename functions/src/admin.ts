import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Single Admin SDK initialization shared by every function module.
 *
 * Each function file used to call initializeApp() itself, which throws once a
 * second module does the same in the same process. Centralizing it here lets us
 * split functions across files (ratings, notifications, …) while initializing
 * exactly once. The guard makes re-imports during local emulation safe too.
 */
if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
