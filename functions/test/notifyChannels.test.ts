import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHANNEL_POLICY,
  type NotificationEvent,
  channelsFor,
  normalizePhone,
} from '../src/notifyChannels';

const EVENTS = Object.keys(CHANNEL_POLICY) as NotificationEvent[];
const REACHABLE = { email: 'user@example.test', phone: '5105551234' };

describe('CHANNEL_POLICY', () => {
  it('sends push for every event', () => {
    for (const event of EVENTS) {
      assert.ok(CHANNEL_POLICY[event].includes('push'), `${event} has no push`);
    }
  });

  it('reserves SMS for the few events where delay costs someone money', () => {
    // SMS costs per message and interrupts. If this set grows, that should be a
    // deliberate decision rather than something that drifted.
    const sms = EVENTS.filter((e) => CHANNEL_POLICY[e].includes('sms'));
    assert.deepEqual(sms.sort(), [
      'booking_cancelled',
      'booking_request',
      'subscription_past_due',
      'vir_ready',
    ]);
  });

  it('never emails or texts chat messages', () => {
    // Message bodies are user-authored, and a chatty thread would become dozens
    // of emails.
    assert.deepEqual(CHANNEL_POLICY.message, ['push']);
  });

  it('emails every event that moves money or records a decision', () => {
    for (const event of [
      'dispute_created', 'dispute_response', 'dispute_resolved',
      'care_claim_resolved', 'subscription_past_due', 'subscription_canceled',
      'job_complete', 'booking_accepted', 'booking_declined',
    ] as NotificationEvent[]) {
      assert.ok(CHANNEL_POLICY[event].includes('email'), `${event} has no email`);
    }
  });

  it('lists no channel twice', () => {
    for (const event of EVENTS) {
      const channels = CHANNEL_POLICY[event];
      assert.equal(new Set(channels).size, channels.length, `${event} repeats a channel`);
    }
  });
});

describe('channelsFor', () => {
  it('uses the full policy for a fully reachable user', () => {
    assert.deepEqual(channelsFor('booking_request', REACHABLE), ['push', 'email', 'sms']);
  });

  it('drops channels the user has no address for', () => {
    assert.deepEqual(channelsFor('booking_request', { email: null, phone: null }), ['push']);
    assert.deepEqual(
      channelsFor('booking_request', { email: 'a@b.test', phone: null }),
      ['push', 'email']
    );
    assert.deepEqual(
      channelsFor('booking_request', { email: null, phone: '5105551234' }),
      ['push', 'sms']
    );
  });

  it('honors per-channel opt-outs', () => {
    assert.deepEqual(
      channelsFor('booking_request', { ...REACHABLE, prefs: { email: false } }),
      ['push', 'sms']
    );
    assert.deepEqual(
      channelsFor('booking_request', { ...REACHABLE, prefs: { sms: false } }),
      ['push', 'email']
    );
    assert.deepEqual(
      channelsFor('booking_request', { ...REACHABLE, prefs: { email: false, sms: false } }),
      ['push']
    );
  });

  it('treats an absent preference as opted in', () => {
    // Defaulting to off would silently disable notifications for every existing
    // user, since none of them have the field yet.
    assert.deepEqual(channelsFor('booking_request', { ...REACHABLE, prefs: {} }), [
      'push', 'email', 'sms',
    ]);
    assert.deepEqual(channelsFor('booking_request', { ...REACHABLE, prefs: null }), [
      'push', 'email', 'sms',
    ]);
  });

  it('never suppresses push, whatever the preferences say', () => {
    for (const event of EVENTS) {
      const channels = channelsFor(event, {
        ...REACHABLE, prefs: { email: false, sms: false },
      });
      assert.deepEqual(channels, ['push'], `${event} lost its push`);
    }
  });

  it('drops SMS when the phone number is unusable', () => {
    assert.deepEqual(
      channelsFor('booking_request', { email: 'a@b.test', phone: '555-CALL-NOW' }),
      ['push', 'email']
    );
  });

  it('falls back to push for an unrecognized event', () => {
    assert.deepEqual(
      channelsFor('not_a_real_event' as NotificationEvent, REACHABLE),
      ['push']
    );
  });
});

describe('normalizePhone', () => {
  it('converts the formats people actually type', () => {
    for (const input of [
      '5105551234', '510-555-1234', '(510) 555-1234', '510.555.1234', ' 510 555 1234 ',
    ]) {
      assert.equal(normalizePhone(input), '+15105551234', `failed on ${input}`);
    }
  });

  it('handles a leading country code', () => {
    assert.equal(normalizePhone('15105551234'), '+15105551234');
    assert.equal(normalizePhone('1 (510) 555-1234'), '+15105551234');
    assert.equal(normalizePhone('+15105551234'), '+15105551234');
  });

  it('passes through international numbers already in E.164', () => {
    assert.equal(normalizePhone('+442071234567'), '+442071234567');
    assert.equal(normalizePhone('+44 20 7123 4567'), '+442071234567');
  });

  it('rejects anything it would have to guess at', () => {
    // A wrong guess delivers someone's booking details to a stranger.
    for (const bad of [
      '', '   ', '555-1234', '12345', '5105551234567890123',
      'call me', null, undefined, '+123',
    ]) {
      assert.equal(normalizePhone(bad), null, `accepted ${String(bad)}`);
    }
  });

  it('rejects a 11-digit number that is not country code 1', () => {
    assert.equal(normalizePhone('25105551234'), null);
  });
});
