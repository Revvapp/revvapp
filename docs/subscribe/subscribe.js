/**
 * Revv Pro subscription — web.
 *
 * The web counterpart to app/detailer/subscription.tsx. It exists because Apple
 * guideline 3.1.1 makes an in-app purchase of platform access the exposed path;
 * billing here keeps the subscription on Stripe. See docs/APPLE_IAP_RISK.md.
 *
 * Like the portal, this is a static page talking to Firebase directly — no build
 * step and no server of our own. It grants nothing: `createSubscription` checks
 * the caller is a detailer, and entitlement is written by the Stripe webhook onto
 * users.subscriptionStatus. This page only reflects that field.
 *
 * The Firebase config and the Stripe publishable key below are both public. They
 * are already inlined in the mobile bundle and are not secrets.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  getFunctions, httpsCallable,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";

const app = initializeApp({
  apiKey: "AIzaSyC9r_O0fW90G47HpbRvdpWqh4x-qlb4-8M",
  authDomain: "revv-app2026.firebaseapp.com",
  projectId: "revv-app2026",
  storageBucket: "revv-app2026.firebasestorage.app",
  messagingSenderId: "87072671490",
  appId: "1:87072671490:web:3453bfd96cfe39eb30e41b",
});
const auth = getAuth(app);
const db = getFirestore(app);
// Callables are pinned to the region the rest of the backend lives in.
const fns = getFunctions(app, "us-west2");

// TEST-MODE key. Switching Stripe to live (TODO #27) means swapping this too —
// it is the one value on this page that differs between modes.
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51TkFvdBT8U6J4a3bjmM52dimEbcRvElOdLgh6hfGd49mMULyZl3WFI7KNRgSezTuBgtVkhYJjj2AWv4aCcVfYqDm000i5cTXW8";

const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);

let unsubUser = null;
let elements = null;

/** Friendly text for the auth failures people actually hit. */
function authMessage(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":   return "That email and password don't match an account.";
    case "auth/invalid-email":    return "That doesn't look like an email address.";
    case "auth/too-many-requests":return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed": return "Can't reach Revv. Check your connection and try again.";
    default: return "Could not sign you in. Try again, or contact support.";
  }
}

/** Mirrors statusCopy() in app/detailer/subscription.tsx so both surfaces agree. */
function statusCopy(status) {
  switch (status) {
    case "trialing":
      return { tone: "good", title: "Free trial active", body: "Your card is on file and will be charged automatically when the trial ends." };
    case "active":
      return { tone: "good", title: "Subscription active", body: "You're billed $34.99 monthly. Your profile is visible to clients." };
    case "past_due":
      return { tone: "warn", title: "Payment failed", body: "We could not charge your card. Email support@revvapp.net to update it and stay visible to clients." };
    case "incomplete":
      return { tone: "warn", title: "Setup incomplete", body: "Your card was not confirmed. Start again to finish setting up billing." };
    case "canceled":
      return { tone: "warn", title: "Subscription canceled", body: "Your profile is hidden from clients. Resubscribe to go live again." };
    default:
      return { tone: "none", title: "Not subscribed", body: "Start your free trial to appear in client search." };
  }
}

/** Callable failures, in the caller's language rather than Stripe's. */
function callableMessage(err) {
  switch (err?.code) {
    case "functions/permission-denied":   return "This account isn't a detailer account.";
    case "functions/unauthenticated":     return "Your session expired. Sign in again.";
    case "functions/resource-exhausted":  return "Too many attempts. Wait an hour and try again.";
    case "functions/failed-precondition": return "Subscriptions aren't available right now. Contact support@revvapp.net.";
    default: return err?.message || "Something went wrong. Try again, or contact support@revvapp.net.";
  }
}

function showErr(msg) { $("buyErr").textContent = msg; $("buyErr").hidden = false; }
function clearErr() { $("buyErr").hidden = true; }

/* ------------------------------------------------------------------ auth */

$("signInForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("signInBtn");
  btn.disabled = true;
  $("authErr").hidden = true;
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  } catch (err) {
    $("authErr").textContent = authMessage(err.code);
    $("authErr").hidden = false;
  } finally {
    btn.disabled = false;
  }
});

$("reset").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) { $("authErr").textContent = "Enter your email first."; $("authErr").hidden = false; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    $("authErr").textContent = "Reset link sent. Check your inbox.";
  } catch {
    $("authErr").textContent = "Could not send a reset link to that address.";
  }
  $("authErr").hidden = false;
});

$("signOut").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (unsubUser) { unsubUser(); unsubUser = null; }

  const inAuth = !user;
  $("viewAuth").hidden = !inAuth;
  $("who").hidden = inAuth;
  $("signOut").hidden = inAuth;
  $("viewMain").hidden = true;
  $("viewWrongRole").hidden = true;
  if (!user) return;

  $("who").textContent = user.email;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.data()?.userType !== "detailer") {
    $("viewWrongRole").hidden = false;
    return;
  }

  $("viewMain").hidden = false;

  // Live-follow the user doc so the page flips to "active" the moment the Stripe
  // webhook lands, without the detailer having to reload.
  unsubUser = onSnapshot(doc(db, "users", user.uid), (s) => {
    const d = s.data() ?? {};
    render(d.subscriptionStatus ? String(d.subscriptionStatus) : null,
           d.isFoundingPro === true);
  });
});

/* ---------------------------------------------------------------- render */

function render(status, isFoundingPro) {
  const copy = statusCopy(status);
  const card = $("statusCard");
  card.className = "statuscard" + (copy.tone === "none" ? "" : " " + copy.tone);
  $("statusTitle").textContent = copy.title;
  $("statusBody").textContent = copy.body;

  const entitled = status === "active" || status === "trialing";
  $("paneEntitled").hidden = !entitled;
  $("paneBuy").hidden = entitled;

  const days = isFoundingPro ? 60 : 14;
  $("trialNote").textContent = `Free for your first ${days} days. Cancel before it ends and you won't be charged.`;
  $("startLabel").textContent =
    status === "canceled" || status === "past_due"
      ? "Resubscribe"
      : `Start my ${days}-day free trial`;
}

/* -------------------------------------------------------------- purchase */

// Step 1 — create the subscription, which is what mints the SetupIntent we
// collect a card against. Deliberately behind a click: calling it on load would
// open an incomplete subscription for anyone who merely visits the page.
$("startBtn").addEventListener("click", async () => {
  clearErr();
  $("startBtn").disabled = true;
  try {
    const call = httpsCallable(fns, "createSubscription");
    const { data } = await call();

    // A trial with nothing due today can come back without a SetupIntent. The
    // subscription still exists; the webhook will flip the status card above.
    if (!data.setupIntentClientSecret) {
      $("startBtn").hidden = true;
      showErr("Your trial is active. We'll confirm your billing details shortly.");
      return;
    }

    elements = stripe.elements({
      clientSecret: data.setupIntentClientSecret,
      appearance: { theme: matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "stripe" },
    });
    elements.create("payment").mount("#paymentElement");

    $("startBtn").hidden = true;
    $("payStep").hidden = false;
  } catch (err) {
    showErr(callableMessage(err));
    $("startBtn").disabled = false;
  }
});

// Step 2 — confirm the SetupIntent. Entitlement is not granted here; the webhook
// writes subscriptionStatus and the snapshot listener above redraws the page.
$("payBtn").addEventListener("click", async () => {
  clearErr();
  $("payBtn").disabled = true;
  try {
    const { error } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: location.href },
    });
    if (error) {
      showErr(error.message || "That card could not be saved. Try another.");
      $("payBtn").disabled = false;
      return;
    }
    $("payStep").hidden = true;
    $("statusTitle").textContent = "Card saved";
    $("statusBody").textContent = "Finishing setup — this page will update in a moment.";
  } catch {
    showErr("Could not reach Stripe. Check your connection and try again.");
    $("payBtn").disabled = false;
  }
});
