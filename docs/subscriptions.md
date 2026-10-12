# Shared project email subscriptions

## Enablement

Apply `functions/_recovery/subscriptions.sql` to the existing production
`peterhamrn-recovery-tags` D1 database before deploying the new buttons.
The migration is additive and imports/enrolls nobody. It does not alter tag
owners, tag activation, sign-in, finder permissions, or existing preferences.
Reuse Pages bindings `RECOVERY_DB`, `RESEND_API_KEY`, `RECOVERY_OTP_SECRET`,
and `RECOVERY_ADMIN_PASSWORD`. Preview environments must remain isolated.
The existing authorized sender is `recovery@peterhamrn.com`.

## Visitor flow

`/subscriptions?topic=little-mini` and `?topic=recovery-tags` request a
six-digit confirmation through the existing Resend sender and HMAC secret.
Codes expire in ten minutes, are limited to five attempts, are consumed once,
and are bound to email and topic. Request limits apply per email/IP. Email is
trimmed and lowercased; `subscribers.email` is a case-insensitive primary key.
Requesting a code never activates a subscription. Confirming a topic preserves
all other topic choices. Confirmation for management enrolls nobody.

`/subscriptions` sends a management confirmation code and creates a one-hour
HttpOnly/Secure/SameSite session. Authenticated users explicitly save individual
topic choices or unsubscribe from everything. POSTs require the same Origin.
Announcements include token-protected per-topic unsubscribe, unsubscribe-all,
and management links. GET unsubscribe links show a confirmation form and do
not change preferences. RFC 8058 one-click POST disables only that topic.

## Administration and announcements

`/admin/subscriptions` uses the existing `peter` Basic Auth admin credential.
It lists subscriber emails/preferences, counts per topic, delivery states,
and supports new slug IDs without schema changes. It cannot enroll anyone.
Future topic pages link to `/subscriptions?topic=THE-ID`.

Add a stable entry to `functions/_recovery/published-updates.js` only with an
approved published update. No dates, builds, deployments, page edits, or tag
activations send announcements automatically. The existing Little Mini opening
installment has one entry for its paired story/manual release. Recovery Tags
has no announcement entry until an actual update is published.

After the update is deployed, the administrator finds its announcement card,
clicks Prepare email for the displayed subscriber count, then Send announcement
until no emails remain waiting to send. Lists larger than 25 use multiple batches. Prepare freezes the
currently confirmed audience atomically and is idempotent. No late subscriber
is added to an earlier announcement. Each update/email pair has one durable
delivery record and one Resend idempotency key. Sending checks the current
opt-in again and skips unsubscribed recipients. Repeated/concurrent sends claim
only pending records. Uncertain or interrupted sends remain held and are not
automatically retried; investigate with Resend before any manual recovery.
Rejected requests are also held. This favors preventing duplicate messages
over automatic retries after ambiguous failures. Do not delete delivery records
or assign a new ID to the same published update. Confirm actual publication
before Prepare; the catalog itself does not check deployment success.

## Scope and operational limits

This implementation reuses the deployed Recovery Tags email-confirmation
pattern; inspection found no existing marketing subscriber workflow in source.
It neither imports external lists nor changes their preferences. If an external
subscriber store exists, reconcile it separately before activation.
No scheduling service or extra subscription vendor is introduced. Announcement
delivery is an explicit administrator action after publication, not an automatic
publication hook. No tests, builds, migrations, email sends, or deployment
verification were run as part of implementation unless separately reported.

Announcement emails include a readable HTML version and a plain-text fallback.
Optional `summary` and `buttonLabel` publication fields customize the introduction
and link label without changing update IDs or delivery history. Subscriber email
cells use Cloudflare email-off markers so authenticated administrators see the
actual address without relying on a browser decoding script.

## ASM Instructor and public Classes expansion

The existing ASM Instructor topic has a signup button on `/asm-instructor.html`.
Classes offers `classes-basic`, `classes-advanced`, and an explicit combined
signup selection `classes-both`. The combined selection confirms both real
preferences in one existing confirmation transaction; it is not a third topic.
Class registration and application authentication never enroll subscribers.

Apply `functions/_recovery/subscription-expansion.sql` to RECOVERY_DB. It adds
only the two topics, announcement drafts/topic mappings, and multi-topic
unsubscribe scopes. Existing subscriber/delivery/publication records are left
unchanged. The same Resend sender and credentials remain in use.

In `/admin/subscriptions`, use the database-backed composer to select ASM
Instructor or Basic/Advanced Classes. Enter a standalone message, or a published
update title, summary, date, and public-content URL. Multiple labeled links can
cover multiple classes. Saving creates a stable draft ID; editing a draft keeps
that ID. Preview uses the same email formatter as delivery, with a placeholder
for the recipient-specific unsubscribe token.

Preparation requires enabled topics and active, confirmed subscriptions with
valid confirmation timestamps. Combined audiences are deduplicated by normalized
email. The published mode requires a public same-site HTML URL returning HTTP
200 directly at preparation time, plus the administrator's actual publication
date. This proves public availability, not the truth of the entered summary;
the administrator remains responsible for matching the published content.

Prepared content and recipients are immutable. Review the recipient list and
preview, select Approve Sending, then Send Approved Announcement. Send works in
finite batches of up to ten. Eligibility is rechecked immediately before Resend.
Delivery uses the existing subscription_updates/subscription_deliveries tables
and persistent payload/idempotency metadata. Accepted recipients never resend;
rejected, uncertain or interrupted sends remain held for operator review in
Resend. Counts and sanitized errors appear in the manager. Existing manual
catalog announcements now also require valid confirmed_at at preparation/send.
Neither deployments nor class saves/publication send these announcements.

Combined email unsubscribe links disable only the opted-in topics represented
by that message. Existing single-topic unsubscribe tokens retain their behavior.
All preference-management and authentication messages remain independent.
