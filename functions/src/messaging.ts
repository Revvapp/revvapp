import { logger } from 'firebase-functions/v2';

import { db } from './admin';
import {
  type Channel,
  type ContactInfo,
  type NotificationEvent,
  channelsFor,
  normalizePhone,
} from './notifyChannels';

/**
 * Email (SendGrid) and SMS (Twilio) delivery.
 *
 * ## Why this reads process.env instead of defineSecret()
 *
 * Firebase Functions v2 refuses to deploy a function that declares a secret
 * which does not exist in Secret Manager yet. Declaring these up front would
 * therefore break `firebase deploy` for everyone until the Twilio/SendGrid
 * accounts are created — including the pending deploy of three unrelated
 * functions. Reading `process.env` works with both mechanisms, because bound
 * secrets are exposed as environment variables at runtime too.
 *
 * **To move these to Secret Manager once the accounts exist:**
 *   1. `firebase functions:secrets:set SENDGRID_API_KEY` (and `TWILIO_AUTH_TOKEN`)
 *   2. add `secrets: ['SENDGRID_API_KEY', 'TWILIO_AUTH_TOKEN']` to the options of
 *      the triggers in `notifications.ts`
 * No change is needed in this file. Until then they can be set as plain config
 * in `functions/.env.<project>` — acceptable for a test-mode setup, but move the
 * auth token to Secret Manager before handling real customer traffic.
 *
 * Everything here is best-effort and never throws: a notification that fails to
 * send must not fail the Firestore trigger that produced it, or a booking could
 * roll back because an email bounced.
 */

const EMAIL_FROM = process.env.NOTIFY_EMAIL_FROM ?? 'support@revvapp.net';
const EMAIL_FROM_NAME = process.env.NOTIFY_EMAIL_FROM_NAME ?? 'Revv';

function sendgridKey(): string | null {
  return process.env.SENDGRID_API_KEY?.trim() || null;
}

function twilioConfig(): { sid: string; token: string; from: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

/** True when at least one out-of-app channel is configured. */
export function messagingConfigured(): { email: boolean; sms: boolean } {
  return { email: sendgridKey() !== null, sms: twilioConfig() !== null };
}

/**
 * Sends one transactional email. Returns false when unconfigured or on failure —
 * callers log rather than retry, since the push already went out.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const key = sendgridKey();
  if (!key) return false;
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
        subject,
        content: [
          { type: 'text/plain', value: body },
          { type: 'text/html', value: renderHtml(subject, body) },
        ],
      }),
    });
    if (!res.ok) {
      // Never log the response body — SendGrid echoes the recipient address.
      logger.warn(`SendGrid HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('Email send failed', err as Error);
    return false;
  }
}

/** Sends one transactional SMS. `to` must already be E.164. */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const config = twilioConfig();
  if (!config) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        // Twilio truncates nothing: over 160 chars silently becomes multiple
        // billable segments, so the copy is capped before it gets here.
        body: new URLSearchParams({ To: to, From: config.from, Body: body }).toString(),
      }
    );
    if (!res.ok) {
      logger.warn(`Twilio HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('SMS send failed', err as Error);
    return false;
  }
}

/** Minimal branded HTML wrapper. Plain text stays the source of truth. */
function renderHtml(subject: string, body: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><body style="margin:0;background:#0d1b2a;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#1a2b3c;border:1px solid #2c3f52;border-radius:14px;padding:28px">
<div style="font-weight:900;font-size:24px;letter-spacing:4px;margin-bottom:24px"><span style="color:#fff">RE</span><span style="color:#c9a227">VV</span></div>
<h1 style="color:#fff;font-size:19px;margin:0 0 12px">${esc(subject)}</h1>
<p style="color:#f1f5f9;font-size:15px;line-height:1.6;margin:0">${esc(body)}</p>
</div>
<p style="max-width:520px;margin:20px auto 0;color:#b7c1cc;font-size:12px;line-height:1.5">
You're receiving this because of activity on your Revv account. Manage which
updates you receive in the app under Profile &rarr; Notifications.
</p></body></html>`;
}

/**
 * Looks up how to reach a user. Email lives on `users/{uid}`; phone is only
 * collected from clients at onboarding, so the role document is checked too.
 * A missing document is not an error — it just means fewer channels.
 */
export async function loadContact(uid: string): Promise<ContactInfo> {
  try {
    const [userSnap, clientSnap, detailerSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('clients').doc(uid).get(),
      db.collection('detailers').doc(uid).get(),
    ]);
    const user = userSnap.data() ?? {};
    const role = clientSnap.data() ?? detailerSnap.data() ?? {};
    return {
      email: (user.email as string | undefined) ?? (role.email as string | undefined) ?? null,
      phone: (role.phone as string | undefined) ?? (user.phone as string | undefined) ?? null,
      prefs: (user.notificationPrefs as ContactInfo['prefs']) ?? null,
    };
  } catch (err) {
    logger.warn(`Could not load contact info for ${uid}`, err as Error);
    return {};
  }
}

/**
 * Fans one notification out to email and SMS according to the channel policy.
 * Push is sent separately by the caller, which already owns the Expo token
 * lookup. Returns the channels actually delivered on, for logging.
 */
export async function deliverOutOfApp(
  uid: string,
  event: NotificationEvent,
  subject: string,
  body: string,
  smsBody?: string
): Promise<Channel[]> {
  const contact = await loadContact(uid);
  const channels = channelsFor(event, contact);
  const delivered: Channel[] = [];

  await Promise.all(
    channels.map(async (channel) => {
      if (channel === 'email' && contact.email) {
        if (await sendEmail(contact.email, subject, body)) delivered.push('email');
      } else if (channel === 'sms') {
        const phone = normalizePhone(contact.phone);
        // Keep SMS to one billable segment; the push and email carry the detail.
        if (phone && (await sendSms(phone, (smsBody ?? body).slice(0, 155)))) {
          delivered.push('sms');
        }
      }
    })
  );

  return delivered;
}
