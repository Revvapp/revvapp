/**
 * Pure money arithmetic for the payment layer.
 *
 * Everything here takes integer cents and returns integer cents with no I/O, so
 * the splits that decide what a detailer is actually paid can be asserted
 * directly instead of only being observable through a live Stripe call. The
 * rates live here as the single definition; `stripe.ts` imports them rather
 * than restating the arithmetic at each call site (the 90/10 split was
 * previously written out inline in three separate places).
 */

/** Platform commission retained from a released booking. */
export const PLATFORM_FEE_RATE = 0.1;

/**
 * Revv Care reserve set aside per released booking. Finance can tune this one
 * constant; it is an accounting accrual of platform-retained funds, never a
 * money movement.
 */
export const CARE_RESERVE_RATE = 0.01;

/** Bounds on a single booking charge, guarding against a mistyped rate card. */
export const MIN_BOOKING_CENTS = 100;
export const MAX_BOOKING_CENTS = 1_000_000;

/** Rejects anything that is not a non-negative whole number of cents. */
function wholeCents(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative whole number of cents.`);
  }
  return value;
}

export interface PayoutSplit {
  /** Transferred to the detailer's connected account. */
  detailerCents: number;
  /** Retained by the platform. */
  platformFeeCents: number;
}

/**
 * Splits a captured amount between the detailer and the platform.
 *
 * The fee is the rounded part and the detailer takes the exact remainder, so
 * the two always sum back to `amountCents` — rounding can never create or
 * destroy a cent, which is what keeps the Stripe transfer within the balance
 * the source charge actually made available.
 */
export function splitPayout(amountCents: number): PayoutSplit {
  const amount = wholeCents(amountCents, 'amountCents');
  const platformFeeCents = Math.round(amount * PLATFORM_FEE_RATE);
  return { detailerCents: amount - platformFeeCents, platformFeeCents };
}

/** The Revv Care reserve accrued from a released booking. */
export function careReserveCents(priceCents: number): number {
  return Math.round(wholeCents(priceCents, 'priceCents') * CARE_RESERVE_RATE);
}

export interface PartialRefundSplit extends PayoutSplit {
  /** Refunded to the client. */
  refundCents: number;
  /** Kept on the charge after the refund, then split above. */
  retainedCents: number;
}

/**
 * Splits a partial-refund dispute outcome: the client is refunded
 * `clientRefundCents`, and the detailer is paid their share of what is left.
 *
 * The commission is taken on the retained remainder rather than the original
 * price, so a partial refund reduces the platform's fee proportionally instead
 * of charging full commission on work that was partly refunded.
 */
export function splitPartialRefund(
  priceCents: number,
  clientRefundCents: number
): PartialRefundSplit {
  const price = wholeCents(priceCents, 'priceCents');
  const refund = wholeCents(clientRefundCents, 'clientRefundCents');
  if (refund <= 0 || refund >= price) {
    throw new RangeError('Partial refund must be greater than 0 and less than the full price.');
  }
  const retainedCents = price - refund;
  return { refundCents: refund, retainedCents, ...splitPayout(retainedCents) };
}

/**
 * Converts a rate-card entry (a human-entered string like `"$249"` or
 * `"249.99"`) to integer cents, or returns null when it is not a usable price.
 *
 * Null covers both unparseable text and amounts outside the accepted booking
 * range, because both mean the same thing to a caller: this service cannot be
 * charged for as written.
 */
export function parseRateToCents(rate: unknown): number | null {
  const dollars = parseFloat(String(rate ?? '').replace(/[^0-9.]/g, ''));
  const cents = Math.round(dollars * 100);
  if (!Number.isFinite(cents) || cents < MIN_BOOKING_CENTS || cents > MAX_BOOKING_CENTS) {
    return null;
  }
  return cents;
}
