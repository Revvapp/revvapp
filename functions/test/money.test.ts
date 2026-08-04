import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CARE_RESERVE_RATE,
  MAX_BOOKING_CENTS,
  MIN_BOOKING_CENTS,
  PLATFORM_FEE_RATE,
  careReserveCents,
  parseRateToCents,
  splitPartialRefund,
  splitPayout,
} from '../src/money';

describe('splitPayout', () => {
  it('takes a 10% commission on a typical booking', () => {
    // $249.99 detail: platform keeps $25.00, detailer is paid $224.99.
    assert.deepEqual(splitPayout(24_999), { detailerCents: 22_499, platformFeeCents: 2_500 });
  });

  it('always sums back to the captured amount', () => {
    // The transfer is drawn from the source charge's balance, so if rounding
    // ever produced parts summing to more than the charge, Stripe would reject
    // the transfer outright.
    for (let amount = 0; amount <= 5_000; amount += 1) {
      const { detailerCents, platformFeeCents } = splitPayout(amount);
      assert.equal(detailerCents + platformFeeCents, amount, `mismatch at ${amount}`);
      assert.ok(detailerCents >= 0 && platformFeeCents >= 0, `negative part at ${amount}`);
    }
  });

  it('never pays the detailer more than was captured', () => {
    for (const amount of [100, 999, 1_000, 33_333, MAX_BOOKING_CENTS]) {
      assert.ok(splitPayout(amount).detailerCents <= amount);
    }
  });

  it('rounds a half-cent fee up, absorbing it from the detailer side', () => {
    // 25 cents * 10% = 2.5 -> the platform takes 3, not 2.
    assert.deepEqual(splitPayout(25), { detailerCents: 22, platformFeeCents: 3 });
  });

  it('handles a zero capture without producing a negative payout', () => {
    assert.deepEqual(splitPayout(0), { detailerCents: 0, platformFeeCents: 0 });
  });

  it('rejects fractional or negative cents rather than silently rounding', () => {
    assert.throws(() => splitPayout(10.5), RangeError);
    assert.throws(() => splitPayout(-1), RangeError);
    assert.throws(() => splitPayout(Number.NaN), RangeError);
  });

  it('matches the documented commission rate', () => {
    assert.equal(PLATFORM_FEE_RATE, 0.1);
    assert.equal(splitPayout(100_000).platformFeeCents, 10_000);
  });
});

describe('careReserveCents', () => {
  it('accrues 1% of the released booking', () => {
    assert.equal(CARE_RESERVE_RATE, 0.01);
    assert.equal(careReserveCents(24_999), 250);
    assert.equal(careReserveCents(10_000), 100);
  });

  it('rounds down to zero for amounts too small to reserve against', () => {
    // The caller skips the ledger write entirely when this is 0.
    assert.equal(careReserveCents(49), 0);
    assert.equal(careReserveCents(50), 1);
  });

  it('rejects malformed amounts', () => {
    assert.throws(() => careReserveCents(-100), RangeError);
    assert.throws(() => careReserveCents(1.5), RangeError);
  });
});

describe('splitPartialRefund', () => {
  it('commissions only the retained remainder, not the original price', () => {
    // $249.99 job, $100 refunded: platform commissions the $149.99 kept, so it
    // earns $15.00 rather than the full $25.00 it would have on a clean release.
    const split = splitPartialRefund(24_999, 10_000);
    assert.deepEqual(split, {
      refundCents: 10_000,
      retainedCents: 14_999,
      detailerCents: 13_499,
      platformFeeCents: 1_500,
    });
  });

  it('keeps refund + retained equal to the full price', () => {
    for (let refund = 1; refund < 2_000; refund += 1) {
      const split = splitPartialRefund(2_000, refund);
      assert.equal(split.refundCents + split.retainedCents, 2_000);
      assert.equal(split.detailerCents + split.platformFeeCents, split.retainedCents);
    }
  });

  it('refuses a refund of zero or the entire price', () => {
    // Both have dedicated resolutions (release_detailer / refund_client) that
    // handle the payment differently; routing them through the partial path
    // would capture the hold when it should have been canceled.
    assert.throws(() => splitPartialRefund(24_999, 0), RangeError);
    assert.throws(() => splitPartialRefund(24_999, 24_999), RangeError);
  });

  it('refuses a refund larger than the price', () => {
    assert.throws(() => splitPartialRefund(24_999, 30_000), RangeError);
  });

  it('refuses fractional or negative refunds', () => {
    assert.throws(() => splitPartialRefund(24_999, 100.5), RangeError);
    assert.throws(() => splitPartialRefund(24_999, -100), RangeError);
  });
});

describe('parseRateToCents', () => {
  it('parses the rate-card formats a detailer actually types', () => {
    assert.equal(parseRateToCents('$249'), 24_900);
    assert.equal(parseRateToCents('249'), 24_900);
    assert.equal(parseRateToCents('$249.99'), 24_999);
    assert.equal(parseRateToCents('$1,299'), 129_900);
    assert.equal(parseRateToCents(' $85 '), 8_500);
    assert.equal(parseRateToCents('$120/vehicle'), 12_000);
  });

  it('survives the float imprecision of cents conversion', () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754.
    assert.equal(parseRateToCents('19.99'), 1_999);
    assert.equal(parseRateToCents('249.99'), 24_999);
    assert.equal(parseRateToCents('1.10'), 110);
  });

  it('rejects prices outside the accepted booking range', () => {
    assert.equal(parseRateToCents('$0'), null);
    assert.equal(parseRateToCents('$0.50'), null);
    assert.equal(parseRateToCents('$20000'), null);
    assert.equal(parseRateToCents(MAX_BOOKING_CENTS / 100 + 1), null);
  });

  it('accepts the exact range boundaries', () => {
    assert.equal(parseRateToCents('1.00'), MIN_BOOKING_CENTS);
    assert.equal(parseRateToCents('10000'), MAX_BOOKING_CENTS);
  });

  it('returns null for anything that is not a price', () => {
    assert.equal(parseRateToCents('Free'), null);
    assert.equal(parseRateToCents('call for quote'), null);
    assert.equal(parseRateToCents(''), null);
    assert.equal(parseRateToCents(null), null);
    assert.equal(parseRateToCents(undefined), null);
  });
});
