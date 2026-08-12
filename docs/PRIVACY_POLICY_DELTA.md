# Privacy Policy — change log and what remains

> **STATUS 2026-08-12: §1, §3, §4, §5, §6 and §7 are APPLIED to
> `docs/index.html`.** §2 needed no change (the policy already lists phone
> number role-agnostically). What remains is §5's retention period and §8's
> effective date — both need a decision, see the bottom of this file.
> Counsel should still review the applied wording alongside the Terms (item 21).

## Original analysis

Item 28. The hosted policy (`docs/index.html`, effective 2026-05-20) predates
several things the app now does. Apple checks that the policy matches the App
Privacy answers, and a mismatch is a rejection reason.

These are drafted edits, not legal advice — counsel should review alongside the
Terms (item 26).

---

## 1. SMS and email notifications — **not mentioned at all** (highest priority)

As of 2026-08-12 the app sends transactional email (SendGrid) and SMS (Twilio).
The policy says nothing about either, and does not list them as processors. This
is the clearest gap.

**Add to the data-use section:**

> **Notifications.** We use your email address and phone number to send you
> transactional messages about your account and bookings — for example a new
> booking request, a cancellation, an inspection awaiting your signature, a
> dispute or claim decision, or a failed subscription payment. We do not send
> marketing messages. You can turn email and SMS off at any time in the app under
> Profile → Notifications; we will still email you about account security and
> anything we are legally required to send. Standard message and data rates may
> apply to text messages, and you can reply STOP to any text to opt out.

## 2. Phone numbers — collected from everyone, policy implies otherwise

Both clients and detailers must provide a phone number at onboarding. Confirm the
"Information We Collect" section says so explicitly for **both** roles.

## 3. Processor list is incomplete

The policy should name every third party that receives personal data. Currently
missing: **SendGrid**, **Twilio**, and **Sentry** (once its DSN is set).

**Suggested replacement list:**

> We share information with service providers who process it on our behalf:
> **Google Firebase** (authentication, database, file storage), **Stripe**
> (payments and detailer payouts), **Expo** (push notification delivery),
> **SendGrid** (email), **Twilio** (text messages), and **Sentry** (crash
> diagnostics). These providers are contractually limited to using your
> information to provide services to us. We do not sell personal information.

## 4. Vehicle data isn't described

The app stores vehicle make, model, year, colour and licence plate, and sends
make/model (no identifiers) to Wikipedia to fetch a stock photo. A **licence
plate** is arguably sensitive and should be named rather than folded into
"account information."

> **Vehicle information.** Make, model, year, colour and licence plate for the
> vehicles you add to your garage, plus the service history associated with them.
> To display a representative photo we send only the make and model — never your
> plate or any information identifying you — to Wikipedia's public API.

## 5. Retention after deletion is vague

The app anonymizes rather than destroys financial and dispute records. Say so and
give a period.

> When you delete your account we remove your profile, vehicles and contact
> details. We retain transaction, dispute and safety records in anonymized form
> where we are required to for tax, accounting, fraud-prevention and legal
> purposes, for **[NUMBER] years**.

## 6. Photo scope understates what's collected

Photos now include dispute evidence and Revv Care claim photos, not just VIR,
before/after and profile images. Worth listing, since claim photos may show
property damage.

## 7. Placeholders still unfilled

`PRIVACY_POLICY.md` (the markdown source) still contains `[insert when
published]`, `[insert support email]` and `[insert company name and full mailing
address]`. The **hosted** HTML has a date and a contact address, so the two have
drifted apart.

**Decide which is canonical.** Two copies of a legal document that disagree is
worse than either alone — recommend deleting the markdown and treating
`docs/index.html` as the single source, matching how `terms.html` works.

## 8. Effective date

Bump "Effective / Last updated" when these land, and note in-app that the policy
changed.

---

## Order of work

1. §1 and §3 — factually wrong today, and the ones Apple cross-checks against
   your App Privacy answers.
2. §7 — resolve the duplicate before editing either copy, or you will fix one and
   ship the other.
3. §2, §4, §5, §6 — accuracy improvements.
4. §8 — last, once the text is final.


---

## What remains after the 2026-08-12 pass

**A. The retention period is still unspecified.** The policy now says
transaction, dispute and safety records are retained in anonymized form "where
we are required to for tax, accounting, fraud-prevention and legal purposes,"
but gives no duration. Seven years is the usual answer for US tax records —
**counsel should confirm the number**, then it can be stated outright.

**B. The effective date was deliberately not moved.** "Last updated" is now
2026-08-12; "Effective" still reads 2026-05-20. A materially changed policy
normally takes a new effective date, and §9 of the policy itself promises that
material changes are communicated in-App or by email. That is a notice
obligation, not a text edit — **decide whether this counts as material** (adding
SMS/email processing arguably does), and if so, move the effective date and send
the notice together.

**C. The Markdown copy was retired, not updated.** `PRIVACY_POLICY.md` is now
`docs/PRIVACY_POLICY.superseded.md`, a pointer. `docs/index.html` is canonical.
