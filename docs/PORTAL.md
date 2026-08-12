# Business portal (`docs/portal/`)

A static web portal at **https://revvapp.github.io/revvapp/portal/** where
customers download receipts, detailers download payout statements, and
dealerships place fleet orders.

No build step and no server of our own: the page talks to Firebase directly, and
**authorization is Firestore rules, not the page**. A signed-in user may read
only invoices they are a party to, and every invoice write is server-side — the
portal cannot widen that, which is why it can safely be a plain page on GitHub
Pages. The Firebase config it embeds is the public web config, already inlined
in the mobile bundle.

## Before it works — two console steps

1. **Authorize the domain.** Firebase console → Authentication → Settings →
   Authorized domains → add `revvapp.github.io`. Sign-in fails with
   `auth/unauthorized-domain` until this is done.
2. **Deploy the new functions and rules** (they do not exist in production yet):
   ```bash
   npx firebase-tools deploy --only functions,firestore:rules --project revv-app2026
   ```

## Composite index

The receipts query filters by party and orders by date. If the console offers to
create the index, accept it — the page falls back to an unordered read and sorts
in memory if it is missing, so it degrades rather than breaks.

## Fleet ordering

New in this change, and a genuinely new product surface — there was no
dealership concept before.

**Flow:** dealership submits vehicles and a service → `requested` → admin
returns a firm quote → `quoted` → dealership accepts or declines → `accepted`.

**It is deliberately not a booking.** No card is held and no detailer is
assigned at request time, because a twenty-car job needs a human to confirm
capacity first. The consumer booking flow is untouched.

**Pricing.** `fleetEstimate` in `functions/src/money.ts` is the single
definition, used by both the page (to show an estimate) and the server (to store
one). Volume tiers: 5+ → 10%, 10+ → 15%, 25+ → 20%. These are *indicative*; the
binding figure is `quotedCents`, which only an admin can write. Covered by tests
asserting gross − discount = total for every service and count.

**Access.** `users/{uid}.isDealership` is server-owned — Firestore rules forbid
a user setting it on themselves, the same way the billing fields are locked, and
a rules test asserts that. Grant it with the `setDealershipStatus` callable.

### Callables added
| Function | Who | Purpose |
|---|---|---|
| `createFleetOrder` | dealership | Raise a request; estimate recomputed server-side |
| `quoteFleetOrder` | admin | Write the binding quote |
| `respondToFleetQuote` | dealership | Accept or decline |
| `setDealershipStatus` | admin | Grant or revoke dealership access |

## The loop is now closed

- ✅ **Admin quoting screen** at `/admin/fleet` — lists requests awaiting a
  quote, pre-filled with the estimate the dealership was shown, and warns before
  sending anything more than 25% off that figure.
- ✅ **Accept / decline in the portal.** The server re-checks ownership and that
  the order is still open, so a stale tab cannot respond to something already
  resolved.
- ✅ **Quote-ready notification** (`onFleetOrderQuoted`) — push and email, not
  SMS: a quote is a commercial decision they want in writing, and it is the
  reason they filled the form in, but it is not worth interrupting someone for.

## Still to build

- **Payment for fleet orders.** Accepting records a commitment; invoicing and
  collection are off-platform. Whether this becomes card-on-file or net-30 is a
  business decision, not an engineering one — and it is the last thing standing
  between this and a self-serve product.
- **Assigning a detailer.** A quote implies someone can do the work; today that
  confirmation happens in someone's head before they send the number.
- **A dealership sign-up path.** Accounts are created in the app and promoted
  with `setDealershipStatus`; there is no self-serve route in.
