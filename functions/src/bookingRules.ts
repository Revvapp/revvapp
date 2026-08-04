/**
 * Pure booking-lifecycle rules: who may perform which transition from which
 * state, how long a job has actually been running, and whether a requested
 * booking date falls inside the schedulable window.
 *
 * None of this touches Firestore or Stripe, so the state machine can be
 * exercised exhaustively in tests. `workflows.ts` owns the writes and maps the
 * failures returned here onto `HttpsError`; keeping the decision separate from
 * the write is what makes "can a client complete someone else's job?" a
 * question with a testable answer.
 */

export type BookingAction =
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'submit_vir'
  | 'sign_vir'
  | 'start'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'update_checklist';

export type BookingRole = 'client' | 'detailer';

/**
 * The subset of a booking document the rules actually read. The index signature
 * lets a full booking document be passed straight through without restating
 * every other field it carries.
 */
export interface BookingState {
  clientId?: unknown;
  detailerId?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  virPanels?: unknown;
  virSignedAt?: unknown;
  timerStartMs?: unknown;
  timerAccumulatedSeconds?: unknown;
  [key: string]: unknown;
}

export interface TransitionRule {
  /** Which party may perform the action. */
  role: BookingRole;
  /** Statuses the booking may be in when the action is performed. */
  from: readonly string[];
  /** Status the booking moves to, or null when the action does not move it. */
  to: string | null;
}

/**
 * The complete set of participant-driven booking transitions.
 *
 * Anything not listed here is rejected, so a new action cannot be introduced by
 * a client simply naming it. Note that no transition is reachable by both
 * parties: every action belongs to exactly one role.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingAction, TransitionRule>> = {
  accept: { role: 'detailer', from: ['pending'], to: 'active' },
  decline: { role: 'detailer', from: ['pending'], to: 'declined' },
  cancel: { role: 'client', from: ['pending', 'active'], to: 'cancelled' },
  submit_vir: { role: 'detailer', from: ['active'], to: 'vir_submitted' },
  sign_vir: { role: 'client', from: ['vir_submitted'], to: 'vir_signed' },
  start: { role: 'detailer', from: ['vir_signed'], to: 'in_progress' },
  pause: { role: 'detailer', from: ['in_progress'], to: 'paused' },
  resume: { role: 'detailer', from: ['paused'], to: 'in_progress' },
  complete: { role: 'detailer', from: ['in_progress', 'paused'], to: 'completed' },
  update_checklist: { role: 'detailer', from: ['in_progress', 'paused'], to: null },
};

/** Failure codes mirror the `HttpsError` codes `workflows.ts` throws. */
export type TransitionFailureCode =
  | 'invalid-argument'
  | 'permission-denied'
  | 'failed-precondition';

export type TransitionCheck =
  | { ok: true; rule: TransitionRule }
  | { ok: false; code: TransitionFailureCode; message: string };

function fail(code: TransitionFailureCode, message: string): TransitionCheck {
  return { ok: false, code, message };
}

function isKnownAction(action: string): action is BookingAction {
  return Object.prototype.hasOwnProperty.call(BOOKING_TRANSITIONS, action);
}

/**
 * Decides whether `uid` may perform `action` on `booking`.
 *
 * Checks run party → role → status → action-specific precondition, so the
 * caller learns the most fundamental reason a transition was refused rather
 * than leaking that, say, a booking they have no part in is in the wrong state.
 */
export function checkTransition(
  booking: BookingState,
  uid: string,
  action: string
): TransitionCheck {
  if (!isKnownAction(action)) {
    return fail('invalid-argument', 'Unknown booking action.');
  }
  if (booking.clientId !== uid && booking.detailerId !== uid) {
    return fail('permission-denied', 'You are not a party to this booking.');
  }

  const rule = BOOKING_TRANSITIONS[action];
  const expected = rule.role === 'client' ? booking.clientId : booking.detailerId;
  if (expected !== uid) {
    return fail('permission-denied', `${rule.role} access required.`);
  }
  if (!rule.from.includes(String(booking.status))) {
    return fail('failed-precondition', 'Booking is not in the required state.');
  }

  // Action-specific preconditions that the status alone does not capture.
  if (action === 'accept' && booking.paymentStatus !== 'requires_capture') {
    return fail('failed-precondition', 'A valid card hold is required.');
  }
  if (action === 'sign_vir' && !booking.virPanels) {
    return fail('failed-precondition', 'VIR is missing.');
  }
  if (action === 'complete' && !booking.virSignedAt) {
    return fail('failed-precondition', 'Signed VIR required.');
  }

  return { ok: true, rule };
}

/** Coerces a possibly-missing or malformed numeric field to a usable number. */
function finiteOr(value: unknown, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Total seconds a job has been worked, given the stored accumulator and the
 * current running segment.
 *
 * `running` is false when the timer is already paused, in which case the stored
 * accumulator is the whole answer. The result is clamped at zero so a device
 * clock ahead of the server cannot subtract time, and a corrupt stored value
 * degrades to 0 rather than writing NaN into Firestore (which the SDK rejects,
 * failing the whole transition).
 */
export function elapsedSeconds(
  booking: BookingState,
  nowMs: number,
  running: boolean
): number {
  const accumulated = Math.max(0, finiteOr(booking.timerAccumulatedSeconds, 0));
  if (!running) return Math.floor(accumulated);
  const started = finiteOr(booking.timerStartMs, nowMs);
  return Math.floor(accumulated) + Math.max(0, Math.floor((nowMs - started) / 1_000));
}

/**
 * How many whole days ahead of "today" a `YYYY-MM-DD` booking date falls, or
 * null when the string is not a real calendar date.
 *
 * Both sides are computed in UTC so the answer does not shift with the server's
 * local timezone. The round-trip comparison is what rejects dates that parse
 * but do not exist (`2026-02-30` would otherwise silently become March 2).
 */
export function bookingDaysAhead(date: string, nowMs: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const bookingDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(bookingDay)) return null;
  if (new Date(bookingDay).toISOString().slice(0, 10) !== date) return null;

  const now = new Date(nowMs);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((bookingDay - today) / (24 * 60 * 60 * 1_000));
}

/**
 * Bookings must be at least a day out and no more than four, which keeps the
 * card authorization comfortably inside its ~7-day validity even after the
 * 24-hour dispute window that follows completion.
 */
export const MIN_BOOKING_DAYS_AHEAD = 1;
export const MAX_BOOKING_DAYS_AHEAD = 4;

export function isSchedulableDate(date: string, nowMs: number): boolean {
  const daysAhead = bookingDaysAhead(date, nowMs);
  return (
    daysAhead !== null &&
    daysAhead >= MIN_BOOKING_DAYS_AHEAD &&
    daysAhead <= MAX_BOOKING_DAYS_AHEAD
  );
}
