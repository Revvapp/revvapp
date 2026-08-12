/**
 * Which channels each notification goes out on, and how to normalize a phone
 * number for SMS. Pure — no I/O — so the policy can be asserted directly.
 *
 * The policy matters more than it looks. Push is free and dismissible, so
 * everything gets it. Email is the only channel that leaves a durable record, so
 * anything touching money or a decision the user may need to refer back to gets
 * one. SMS costs real money per message, interrupts people, and is the fastest
 * way to make an app feel like spam — so it is reserved for the handful of
 * events where a slow response actually costs someone money.
 */

export type Channel = 'push' | 'email' | 'sms';

export type NotificationEvent =
  | 'booking_request'
  | 'booking_accepted'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'vir_ready'
  | 'vir_signed'
  | 'job_complete'
  | 'message'
  | 'dispute_created'
  | 'dispute_response'
  | 'dispute_resolved'
  | 'care_claim_resolved'
  | 'subscription_past_due'
  | 'subscription_canceled'
  | 'subscription_active'
  | 'review'
  | 'fleet_quote_ready';

/**
 * The channel policy. Every event must appear here; an event missing from the
 * table falls back to push only, which is the safe direction to fail.
 */
export const CHANNEL_POLICY: Readonly<Record<NotificationEvent, readonly Channel[]>> = {
  // Time-critical: the detailer loses the job if they don't answer quickly.
  booking_request: ['push', 'email', 'sms'],
  // Schedule impact on someone who has already blocked out the time.
  booking_cancelled: ['push', 'email', 'sms'],
  // The detailer is standing at the vehicle waiting for a signature.
  vir_ready: ['push', 'sms'],
  // Losing marketplace visibility means losing income — worth interrupting for.
  subscription_past_due: ['push', 'email', 'sms'],

  // A quote is a commercial decision the dealership needs in writing, and it is
  // the whole reason they filled the form in. Not urgent enough to text for.
  fleet_quote_ready: ['push', 'email'],

  // Money moved, or a decision was made that the user may need to look up later.
  booking_accepted: ['push', 'email'],
  booking_declined: ['push', 'email'],
  job_complete: ['push', 'email'],
  dispute_created: ['push', 'email'],
  dispute_response: ['push', 'email'],
  dispute_resolved: ['push', 'email'],
  care_claim_resolved: ['push', 'email'],
  subscription_canceled: ['push', 'email'],

  // In-app moments and good news: push is enough, and anything more is noise.
  vir_signed: ['push'],
  subscription_active: ['push'],
  review: ['push'],
  // Never email or text chat messages — a chatty conversation would turn into
  // dozens of emails, and the message body is user-authored content.
  message: ['push'],
};

/** Per-user opt-outs, read from `users/{uid}.notificationPrefs`. */
export interface NotificationPrefs {
  email?: boolean;
  sms?: boolean;
}

/** What we know about how to reach someone. */
export interface ContactInfo {
  email?: string | null;
  phone?: string | null;
  prefs?: NotificationPrefs | null;
}

/**
 * The channels a given notification should actually go out on for this
 * recipient: policy, minus anything they lack an address for, minus anything
 * they have opted out of.
 *
 * Push is never suppressed by preferences — it is controlled by the OS-level
 * permission the user already granted, so a second in-app switch for it would
 * only be able to disagree with the real setting.
 */
export function channelsFor(
  event: NotificationEvent,
  contact: ContactInfo
): Channel[] {
  const policy = CHANNEL_POLICY[event] ?? ['push'];
  const prefs = contact.prefs ?? {};
  return policy.filter((channel) => {
    if (channel === 'email') return Boolean(contact.email) && prefs.email !== false;
    if (channel === 'sms') return Boolean(normalizePhone(contact.phone)) && prefs.sms !== false;
    return true;
  });
}

/**
 * Converts a human-entered phone number to E.164, or null if it cannot be
 * trusted. Twilio rejects anything else, and a malformed number is worse than
 * no number: it can silently deliver to the wrong person.
 *
 * Bare 10-digit and 1-prefixed 11-digit input is assumed North American, which
 * matches where the product operates; anything already in `+` form is passed
 * through after a length sanity check rather than guessed at.
 */
export function normalizePhone(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  if (value.startsWith('+')) {
    const digits = value.slice(1).replace(/\D/g, '');
    // E.164 allows at most 15 digits; fewer than 8 is not a real number.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
