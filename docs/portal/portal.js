/**
 * Revv business portal.
 *
 * A static page that talks to Firebase directly — no build step and no server of
 * our own. Authorization is Firestore rules, not this file: a client or detailer
 * may read only invoices they are a party to, and every invoice write is
 * server-side. Nothing here can widen that, which is why the portal can be a
 * plain page on GitHub Pages.
 *
 * The config below is the public web config. It is already inlined in the mobile
 * bundle and is not a secret.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc,
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

const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Number(n || 0).toFixed(2);
const when = (ts) => {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
};

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

let state = { role: null, uid: null, invoices: [], orders: [] };

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
    $("authErr").hidden = false;
  } catch {
    $("authErr").textContent = "Could not send a reset link to that address.";
    $("authErr").hidden = false;
  }
});

$("signOut").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  const inAuth = !user;
  $("viewAuth").hidden = !inAuth;
  $("viewMain").hidden = inAuth;
  $("viewDoc").hidden = true;
  $("who").hidden = inAuth;
  $("signOut").hidden = inAuth;
  if (!user) { state = { role: null, uid: null, invoices: [], orders: [] }; return; }

  state.uid = user.uid;
  $("who").textContent = user.email;

  const snap = await getDoc(doc(db, "users", user.uid));
  state.role = snap.data()?.userType ?? "client";
  state.isDealership = snap.data()?.isDealership === true;

  buildTabs();
  await loadInvoices();
  if (state.isDealership) loadOrders();
});

/* ------------------------------------------------------------------ tabs */

function buildTabs() {
  const tabs = [{ id: "Receipts", label: state.role === "detailer" ? "Payouts" : "Receipts" }];
  // Fleet ordering is a dealership capability, not something every client sees.
  if (state.isDealership) tabs.push({ id: "Fleet", label: "Fleet order" });
  $("tabs").innerHTML = tabs.map((t, i) =>
    `<button role="tab" data-t="${t.id}" aria-selected="${i === 0}">${t.label}</button>`).join("");
  $("tabs").hidden = tabs.length < 2;
  showTab("Receipts");
}

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-t]");
  if (b) showTab(b.dataset.t);
});

function showTab(id) {
  for (const t of ["Receipts", "Fleet"]) {
    const el = $("tab" + t);
    if (el) el.hidden = t !== id;
  }
  [...$("tabs").children].forEach((b) => b.setAttribute("aria-selected", String(b.dataset.t === id)));
}

/* -------------------------------------------------------------- receipts */

async function loadInvoices() {
  const field = state.role === "detailer" ? "detailerId" : "clientId";
  const detailer = state.role === "detailer";

  $("recTitle").textContent = detailer ? "Payout statements" : "Receipts";
  $("recLede").textContent = detailer
    ? "Every completed job, what Revv retained, and what was paid out to you."
    : "Every detail you've booked. Open one to download or print it.";
  $("recHead").innerHTML = detailer
    ? "<th>Date</th><th>Client</th><th>Vehicle</th><th>Service</th><th>Status</th><th class='amt'>Payout</th><th></th>"
    : "<th>Date</th><th>Detailer</th><th>Vehicle</th><th>Service</th><th>Status</th><th class='amt'>Total</th><th></th>";

  let docs = [];
  try {
    const q = query(collection(db, "invoices"), where(field, "==", state.uid), orderBy("createdAt", "desc"));
    docs = (await getDocs(q)).docs;
  } catch {
    // A missing composite index surfaces here; fall back to an unordered read so
    // the page still works rather than showing nothing.
    const q = query(collection(db, "invoices"), where(field, "==", state.uid));
    docs = (await getDocs(q)).docs;
  }

  state.invoices = docs.map((d) => ({ id: d.id, ...d.data() }));
  state.invoices.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

  const gross = state.invoices.reduce((s, i) => s + Number(i.price || 0), 0);
  const net = state.invoices.reduce((s, i) => s + Number(i.detailerPayout || 0), 0);
  const fees = state.invoices.reduce((s, i) => s + Number(i.platformFee || 0), 0);

  $("totals").innerHTML = detailer
    ? stat("Jobs", state.invoices.length) + stat("Gross", money(gross)) +
      stat("Revv fee", money(fees)) + stat("Paid to you", money(net))
    : stat("Details booked", state.invoices.length) + stat("Total spent", money(gross));

  $("recEmpty").hidden = state.invoices.length > 0;
  $("recRows").innerHTML = state.invoices.map((i) => `
    <tr>
      <td>${when(i.createdAt)}</td>
      <td>${esc(detailer ? i.clientName : (i.businessName || i.detailerName || "—"))}</td>
      <td>${esc(i.vehicleLabel || "—")}</td>
      <td>${esc(i.service || "—")}</td>
      <td>${statusPill(i.status)}</td>
      <td class="amt mono">${money(detailer ? i.detailerPayout : i.price)}</td>
      <td><button class="linkbtn" data-open="${esc(i.id)}">Open</button></td>
    </tr>`).join("");
}

const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v mono">${v}</div></div>`;

function statusPill(s) {
  const map = {
    released:         ["ok", "Paid"],
    pending_release:  ["mute", "Pending"],
    disputed:         ["bad", "Disputed"],
    refunded:         ["bad", "Refunded"],
    resolved_partial: ["warn", "Partial refund"],
  };
  const [cls, label] = map[s] || ["mute", s || "—"];
  return `<span class="pill ${cls}">${label}</span>`;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("recRows").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-open]");
  if (b) openDoc(b.dataset.open);
});

$("backBtn").addEventListener("click", () => {
  $("viewDoc").hidden = true;
  $("viewMain").hidden = false;
});
$("printBtn").addEventListener("click", () => window.print());

function openDoc(id) {
  const i = state.invoices.find((x) => x.id === id);
  if (!i) return;
  const detailer = state.role === "detailer";

  // A detailer's document is a payout statement (what they earned, net of the
  // fee); a client's is a receipt (what they paid). Same record, two readings.
  $("doc").innerHTML = `
    <div class="doc-h">
      <div>
        <div class="t">${detailer ? "Payout statement" : "Receipt"}</div>
        <div class="n">Revv</div>
      </div>
      <div style="text-align:right">
        <div class="t">Reference</div>
        <div class="n mono">#${esc(i.id.slice(-6).toUpperCase())}</div>
      </div>
    </div>

    <div class="parties">
      <div><div class="k">${detailer ? "Client" : "Detailer"}</div>
        ${esc(detailer ? i.clientName : (i.businessName || i.detailerName || "—"))}</div>
      <div><div class="k">Service date</div>${esc(i.date || when(i.createdAt))}</div>
      <div><div class="k">Vehicle</div>${esc(i.vehicleLabel || "—")}</div>
      <div><div class="k">Status</div>${statusPill(i.status)}</div>
    </div>

    <table class="lines">
      <tr><td>${esc(i.service || "Detailing service")}</td><td class="r mono">${money(i.price)}</td></tr>
      ${detailer ? `
        <tr class="sum"><td>Revv platform fee (10%)</td><td class="r mono">−${money(i.platformFee)}</td></tr>
        <tr class="grand"><td>Paid to you</td><td class="r mono">${money(i.detailerPayout)}</td></tr>
      ` : `
        <tr class="grand"><td>Total charged</td><td class="r mono">${money(i.price)}</td></tr>
      `}
    </table>

    <div class="doc-foot">
      ${detailer
        ? "Paid to your connected Stripe account after the 24-hour dispute window closed."
        : "Charged to the card on file once the job was completed and the dispute window closed."}
      <br />Booking reference ${esc(i.bookingId || i.id)} · Questions? support@revvapp.net
    </div>`;

  $("viewMain").hidden = true;
  $("viewDoc").hidden = false;
  window.scrollTo(0, 0);
}

/* ----------------------------------------------------------------- fleet */

const SERVICE_BASE = { "Express Wash": 85, "Full Interior": 180, "Paint Correction": 450, "Ceramic Coating": 900 };
// Volume discount. Indicative only — the binding number is the quote a human
// returns, which is why the UI never calls this a price.
const TIERS = [[25, 0.20], [10, 0.15], [5, 0.10], [0, 0]];
const discountFor = (n) => (TIERS.find(([min]) => n >= min) || [0, 0])[1];

function vehicleRow(i) {
  return `<div class="veh" data-v="${i}">
    <div><label for="mk${i}">Make and model</label><input id="mk${i}" class="v-desc" placeholder="2021 Audi A4" /></div>
    <div><label for="pl${i}">Stock or plate <span style="font-weight:400">(optional)</span></label><input id="pl${i}" class="v-ref" placeholder="A4-0231" /></div>
    <button class="btn ghost rm" type="button" data-rm="${i}" aria-label="Remove vehicle ${i + 1}">Remove</button>
  </div>`;
}

let vehSeq = 0;
function addVehicle() { $("vehicles").insertAdjacentHTML("beforeend", vehicleRow(vehSeq++)); repriceQuote(); }
$("addVeh").addEventListener("click", addVehicle);
$("vehicles").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-rm]");
  if (!b) return;
  b.closest(".veh").remove();
  if (!$("vehicles").children.length) addVehicle();
  repriceQuote();
});
$("vehicles").addEventListener("input", repriceQuote);
$("fleetService").addEventListener("change", repriceQuote);

function collectVehicles() {
  return [...$("vehicles").querySelectorAll(".veh")]
    .map((r) => ({
      description: r.querySelector(".v-desc").value.trim(),
      reference: r.querySelector(".v-ref").value.trim(),
    }))
    .filter((v) => v.description);
}

function repriceQuote() {
  const svc = $("fleetService").value;
  const n = collectVehicles().length;
  const base = SERVICE_BASE[svc] ?? 0;
  const disc = discountFor(n);
  const gross = base * n;
  const total = gross * (1 - disc);
  $("quote").innerHTML = n === 0
    ? `<div class="row"><span>Add a vehicle to see an estimate</span></div>`
    : `<div class="row"><span>${n} × ${esc(svc)}</span><span class="mono">${money(gross)}</span></div>
       ${disc ? `<div class="row"><span>Fleet discount (${Math.round(disc * 100)}%)</span><span class="mono">−${money(gross - total)}</span></div>` : ""}
       <div class="row tot"><span>Estimate</span><span class="mono">${money(total)}</span></div>
       <div class="row" style="color:var(--ink-soft);font-size:12.5px">
         <span>Indicative only. We'll confirm a detailer and send a firm quote.</span></div>`;
}

$("fleetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const vehicles = collectVehicles();
  $("fleetErr").hidden = true; $("fleetOk").hidden = true;
  if (!vehicles.length) {
    $("fleetErr").textContent = "Add at least one vehicle."; $("fleetErr").hidden = false; return;
  }
  const btn = $("fleetBtn");
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    const res = await httpsCallable(fns, "createFleetOrder")({
      service: $("fleetService").value,
      vehicles,
      preferredDate: $("fleetWhen").value,
      address: $("fleetAddr").value.trim(),
      notes: $("fleetNotes").value.trim(),
    });
    $("fleetOk").textContent =
      `Request sent. Reference ${res.data.orderId.slice(-6).toUpperCase()} — we'll email a quote within one business day.`;
    $("fleetOk").hidden = false;
    $("fleetForm").reset();
    $("vehicles").innerHTML = ""; addVehicle();
    loadOrders();
  } catch (err) {
    $("fleetErr").textContent = err?.message || "Could not send that request. Try again.";
    $("fleetErr").hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "Request quote";
  }
});

async function loadOrders() {
  try {
    const q = query(collection(db, "fleetOrders"), where("dealershipId", "==", state.uid));
    const rows = (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    state.orders = rows;
    $("fleetEmpty").hidden = rows.length > 0;
    $("fleetRows").innerHTML = rows.map((o) => `
      <tr>
        <td>${when(o.createdAt)}</td>
        <td>${esc(o.service)}</td>
        <td class="mono">${(o.vehicles || []).length}</td>
        <td>${orderPill(o.status)}${o.quoteNote ? `<div class="qnote">${esc(o.quoteNote)}</div>` : ""}</td>
        <td class="amt mono">${o.quotedCents != null ? money(o.quotedCents / 100) : money((o.estimateCents || 0) / 100)}</td>
        <td class="amt">${o.status === "quoted"
          ? `<button class="linkbtn" data-accept="${esc(o.id)}">Accept</button>
             <button class="linkbtn decline" data-decline="${esc(o.id)}">Decline</button>`
          : ""}</td>
      </tr>`).join("");
  } catch {
    $("fleetEmpty").hidden = false;
    $("fleetEmpty").textContent = "Could not load your fleet orders.";
  }
}

function orderPill(s) {
  const map = {
    requested: ["warn", "Awaiting quote"],
    quoted:    ["warn", "Quote ready"],
    accepted:  ["ok", "Accepted"],
    scheduled: ["ok", "Scheduled"],
    complete:  ["ok", "Complete"],
    declined:  ["bad", "Declined"],
  };
  const [cls, label] = map[s] || ["mute", s || "—"];
  return `<span class="pill ${cls}">${label}</span>`;
}

addVehicle();

/**
 * Accept or decline a quote. The server re-checks ownership and that the order
 * is still open, so a stale page cannot respond to something already resolved.
 */
$("fleetRows").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accept], button[data-decline]");
  if (!btn) return;
  const accept = btn.hasAttribute("data-accept");
  const orderId = btn.dataset.accept || btn.dataset.decline;
  const order = state.orders.find((o) => o.id === orderId);
  const amount = order?.quotedCents != null ? money(order.quotedCents / 100) : "this quote";
  if (accept && !confirm(`Accept ${amount} for ${order?.vehicleCount ?? ""} vehicles?`)) return;
  if (!accept && !confirm("Decline this quote? We'll follow up by email.")) return;

  [...$("fleetRows").querySelectorAll("button")].forEach((b) => (b.disabled = true));
  try {
    await httpsCallable(fns, "respondToFleetQuote")({ orderId, accept });
    await loadOrders();
  } catch (err) {
    alert(err?.message || "Could not record that. Try again.");
    [...$("fleetRows").querySelectorAll("button")].forEach((b) => (b.disabled = false));
  }
});
