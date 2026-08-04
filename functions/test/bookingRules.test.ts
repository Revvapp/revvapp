import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BOOKING_TRANSITIONS,
  type BookingAction,
  type BookingState,
  bookingDaysAhead,
  checkTransition,
  elapsedSeconds,
  isSchedulableDate,
} from '../src/bookingRules';

const CLIENT = 'client-uid';
const DETAILER = 'detailer-uid';
const STRANGER = 'stranger-uid';

/** A booking in `status`, already satisfying every action precondition. */
function booking(status: string, overrides: BookingState = {}): BookingState {
  return {
    clientId: CLIENT,
    detailerId: DETAILER,
    status,
    paymentStatus: 'requires_capture',
    virPanels: { hood: { photoUrl: 'https://example.test/a.jpg' } },
    virSignedAt: { seconds: 1 },
    ...overrides,
  };
}

const ACTIONS = Object.keys(BOOKING_TRANSITIONS) as BookingAction[];
const uidFor = (role: 'client' | 'detailer') => (role === 'client' ? CLIENT : DETAILER);

describe('checkTransition — the happy paths', () => {
  for (const action of ACTIONS) {
    const rule = BOOKING_TRANSITIONS[action];
    for (const from of rule.from) {
      it(`lets the ${rule.role} ${action} from ${from}`, () => {
        const check = checkTransition(booking(from), uidFor(rule.role), action);
        assert.equal(check.ok, true, check.ok ? '' : check.message);
      });
    }
  }
});

describe('checkTransition — authorization', () => {
  it('refuses anyone who is not a party to the booking', () => {
    for (const action of ACTIONS) {
      const from = BOOKING_TRANSITIONS[action].from[0];
      const check = checkTransition(booking(from), STRANGER, action);
      assert.equal(check.ok, false, `${action} allowed a stranger`);
      if (!check.ok) {
        assert.equal(check.code, 'permission-denied');
        assert.match(check.message, /not a party/);
      }
    }
  });

  it('refuses the opposite party on every action', () => {
    // No booking action is shared between the two roles, so the counterparty is
    // always wrong — a client must never be able to complete their own job.
    for (const action of ACTIONS) {
      const rule = BOOKING_TRANSITIONS[action];
      const wrongRole = rule.role === 'client' ? 'detailer' : 'client';
      const check = checkTransition(booking(rule.from[0]), uidFor(wrongRole), action);
      assert.equal(check.ok, false, `${action} allowed the ${wrongRole}`);
      if (!check.ok) assert.equal(check.code, 'permission-denied');
    }
  });

  it('rejects an unknown action before looking at anything else', () => {
    const check = checkTransition(booking('pending'), CLIENT, 'delete_everything');
    assert.equal(check.ok, false);
    if (!check.ok) {
      assert.equal(check.code, 'invalid-argument');
      assert.match(check.message, /Unknown booking action/);
    }
  });

  it('reports non-membership rather than leaking the booking state', () => {
    // A stranger probing a booking gets the same answer whatever state it is in.
    const messages = new Set(
      ['pending', 'completed', 'cancelled'].map((status) => {
        const check = checkTransition(booking(status), STRANGER, 'accept');
        return check.ok ? 'ok' : check.message;
      })
    );
    assert.equal(messages.size, 1);
  });
});

describe('checkTransition — state machine', () => {
  const ALL_STATES = [
    'pending', 'active', 'declined', 'cancelled', 'vir_submitted',
    'vir_signed', 'in_progress', 'paused', 'completed',
  ];

  it('refuses every state outside each action’s allowed set', () => {
    for (const action of ACTIONS) {
      const rule = BOOKING_TRANSITIONS[action];
      for (const status of ALL_STATES.filter((s) => !rule.from.includes(s))) {
        const check = checkTransition(booking(status), uidFor(rule.role), action);
        assert.equal(check.ok, false, `${action} was allowed from ${status}`);
        if (!check.ok) assert.equal(check.code, 'failed-precondition');
      }
    }
  });

  it('never moves a terminal booking', () => {
    for (const status of ['declined', 'cancelled', 'completed']) {
      for (const action of ACTIONS) {
        const rule = BOOKING_TRANSITIONS[action];
        assert.equal(
          checkTransition(booking(status), uidFor(rule.role), action).ok,
          false,
          `${action} moved a ${status} booking`
        );
      }
    }
  });

  it('walks the full job lifecycle end to end', () => {
    const path: [BookingAction, string][] = [
      ['accept', 'pending'],
      ['submit_vir', 'active'],
      ['sign_vir', 'vir_submitted'],
      ['start', 'vir_signed'],
      ['pause', 'in_progress'],
      ['resume', 'paused'],
      ['complete', 'in_progress'],
    ];
    for (const [action, from] of path) {
      const rule = BOOKING_TRANSITIONS[action];
      assert.equal(rule.from.includes(from), true, `${action} is not reachable from ${from}`);
      assert.equal(checkTransition(booking(from), uidFor(rule.role), action).ok, true);
    }
  });
});

describe('checkTransition — action preconditions', () => {
  it('will not accept a booking whose card hold is not authorized', () => {
    for (const paymentStatus of ['canceled', 'refunded', 'invalid', undefined]) {
      const check = checkTransition(booking('pending', { paymentStatus }), DETAILER, 'accept');
      assert.equal(check.ok, false, `accepted with paymentStatus=${paymentStatus}`);
      if (!check.ok) assert.match(check.message, /card hold/);
    }
  });

  it('will not sign a VIR that was never submitted', () => {
    const check = checkTransition(
      booking('vir_submitted', { virPanels: undefined }), CLIENT, 'sign_vir'
    );
    assert.equal(check.ok, false);
    if (!check.ok) assert.match(check.message, /VIR is missing/);
  });

  it('will not complete a job without a client-signed VIR', () => {
    // The signed VIR is the evidence record the dispute process rests on.
    const check = checkTransition(
      booking('in_progress', { virSignedAt: undefined }), DETAILER, 'complete'
    );
    assert.equal(check.ok, false);
    if (!check.ok) assert.match(check.message, /Signed VIR required/);
  });
});

describe('elapsedSeconds', () => {
  const NOW = 1_800_000_000_000;

  it('adds the open segment to the banked total while running', () => {
    const total = elapsedSeconds(
      { timerAccumulatedSeconds: 600, timerStartMs: NOW - 90_000 }, NOW, true
    );
    assert.equal(total, 690);
  });

  it('returns only the banked total when paused', () => {
    // A paused booking's timerStartMs is null; the open segment was already
    // banked at pause time and must not be counted twice.
    const total = elapsedSeconds(
      { timerAccumulatedSeconds: 600, timerStartMs: null }, NOW, false
    );
    assert.equal(total, 600);
  });

  it('starts from zero on a fresh booking', () => {
    assert.equal(elapsedSeconds({}, NOW, true), 0);
    assert.equal(elapsedSeconds({}, NOW, false), 0);
  });

  it('floors partial seconds instead of rounding up', () => {
    assert.equal(elapsedSeconds({ timerStartMs: NOW - 1_999 }, NOW, true), 1);
  });

  it('never subtracts time when the stored start is in the future', () => {
    // A device clock ahead of the server must not be able to reduce the total.
    const total = elapsedSeconds(
      { timerAccumulatedSeconds: 600, timerStartMs: NOW + 60_000 }, NOW, true
    );
    assert.equal(total, 600);
  });

  it('degrades a corrupt stored value to zero rather than writing NaN', () => {
    // Firestore rejects NaN, which would fail the whole transition and strand
    // the booking mid-job.
    for (const bad of ['not-a-number', {}, [], Number.NaN, Number.POSITIVE_INFINITY]) {
      const total = elapsedSeconds(
        { timerAccumulatedSeconds: bad, timerStartMs: bad }, NOW, true
      );
      assert.ok(Number.isFinite(total), `non-finite total for ${String(bad)}`);
      assert.ok(total >= 0);
    }
  });

  it('ignores a negative banked total', () => {
    assert.equal(elapsedSeconds({ timerAccumulatedSeconds: -500 }, NOW, false), 0);
  });
});

describe('bookingDaysAhead', () => {
  // Midday UTC, so a naive local-timezone implementation would still pass;
  // the near-midnight case below is what actually pins the UTC behaviour.
  const NOW = Date.parse('2026-08-04T12:00:00Z');

  it('counts whole days ahead in UTC', () => {
    assert.equal(bookingDaysAhead('2026-08-04', NOW), 0);
    assert.equal(bookingDaysAhead('2026-08-05', NOW), 1);
    assert.equal(bookingDaysAhead('2026-08-08', NOW), 4);
    assert.equal(bookingDaysAhead('2026-08-03', NOW), -1);
  });

  it('does not shift with the time of day', () => {
    for (const hour of ['00:00:01', '12:00:00', '23:59:59']) {
      assert.equal(bookingDaysAhead('2026-08-06', Date.parse(`2026-08-04T${hour}Z`)), 2);
    }
  });

  it('crosses month and year boundaries correctly', () => {
    assert.equal(bookingDaysAhead('2026-09-01', Date.parse('2026-08-31T12:00:00Z')), 1);
    assert.equal(bookingDaysAhead('2027-01-01', Date.parse('2026-12-31T12:00:00Z')), 1);
    assert.equal(bookingDaysAhead('2028-02-29', Date.parse('2028-02-28T12:00:00Z')), 1);
  });

  it('rejects dates that parse but do not exist', () => {
    // Date.UTC would roll 2026-02-30 forward to March 2 without the round trip.
    assert.equal(bookingDaysAhead('2026-02-30', NOW), null);
    assert.equal(bookingDaysAhead('2026-13-01', NOW), null);
    assert.equal(bookingDaysAhead('2027-02-29', NOW), null);
  });

  it('rejects anything that is not a plain YYYY-MM-DD string', () => {
    for (const bad of ['2026-8-4', '08/04/2026', '2026-08-04T00:00:00Z', 'tomorrow', '']) {
      assert.equal(bookingDaysAhead(bad, NOW), null, `accepted ${bad}`);
    }
  });
});

describe('isSchedulableDate', () => {
  const NOW = Date.parse('2026-08-04T12:00:00Z');

  it('accepts the 1–4 day booking window', () => {
    for (const date of ['2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08']) {
      assert.equal(isSchedulableDate(date, NOW), true, `rejected ${date}`);
    }
  });

  it('rejects same-day and past bookings', () => {
    assert.equal(isSchedulableDate('2026-08-04', NOW), false);
    assert.equal(isSchedulableDate('2026-08-03', NOW), false);
    assert.equal(isSchedulableDate('2025-01-01', NOW), false);
  });

  it('rejects anything past day four', () => {
    // Beyond this the card authorization could expire before the 24-hour
    // dispute window that follows completion has closed.
    assert.equal(isSchedulableDate('2026-08-09', NOW), false);
    assert.equal(isSchedulableDate('2026-12-25', NOW), false);
  });

  it('rejects malformed dates', () => {
    assert.equal(isSchedulableDate('2026-02-30', NOW), false);
    assert.equal(isSchedulableDate('not-a-date', NOW), false);
  });
});
