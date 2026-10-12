# Recovery-tag proof of concept

`functions/find/[token].js` serves recovery pages using the production-only
`RECOVERY_DB` binding on Pages project `peterhamrn-com`. The dedicated D1 database
is `peterhamrn-recovery-tags`; unrelated databases are not used.

`schema.sql` is the initial schema, applied once to that new database. This
underscore-prefixed support directory is not a Pages Function route. Production
owner data and tag URLs are stored in D1, never in source or static assets.

Each physical tag's URL uses 24 cryptographically random bytes encoded as
32-character unpadded base64url. Never change, delete/reuse, or regenerate a
programmed tag's token. Set a retired tag to `inactive` or `replaced` instead.
Authorized manual record edits must also update `updated_at` in UTC.

Only active tags with an assigned owner reveal the allowed contact options.
The page displays only the first word of `display_name` when `show_name` is set.
There is no public write API, account system, or admin interface. Preview
deployments are not bound to production owner data and fail closed.

Focused validation: `node --test tests/recovery.test.mjs`.

## Subscription announcement workspace

Apply `subscription-workspace.sql` to the existing production `RECOVERY_DB`
before deploying the workspace. It only creates two empty metadata tables:
selected sender identities for manual drafts, and separate sending approvals
for the older published-update catalog. Existing recipient snapshots, subscriber
preferences, accepted sends, and stored delivery payloads remain unchanged.

`/admin/subscriptions` defaults to My Drafts. New/Edit has dedicated subject,
message, audience, type, links, and publication-date fields. Saving or previewing
never sends; Prepare locks wording and the deduplicated recipient audience;
Approve records authorization; Send opens a separate confirmation page. Prepared
announcements can be copied to a new unsent draft, never silently unlocked.
Failed/uncertain deliveries remain held; accepted recipients cannot be resent.
Automatic publication events retain their original IDs and recovery safeguards.

`announcement-identities.js` configures subscription senders and Reply-To:

| Topic | From address | Reply-To |
| --- | --- | --- |
| ASM Instructor | asm@peterhamrn.com | peter@peterhamrn.com |
| Basic / Advanced ASM Classes | classes@peterhamrn.com | classes@peterhamrn.com |
| Recovery Tags | recovery@peterhamrn.com | support@peterhamrn.com |
| Little Mini | littlemini@peterhamrn.com | support@peterhamrn.com |

The sender uses the existing PeterHamRN.com display name. Combined Basic/Advanced
uses the Classes identity. Unrelated audiences require an explicitly selected
identity from the targeted topics. ASM software and Classes audiences remain
separate. New delivery payloads persist the chosen sender with their existing
idempotency key; recovery of older payloads preserves their original sender and
content. Authentication and subscription-confirmation senders are not changed.

Previews include topic, From, Reply-To, subject, HTML/text bodies, destination
links and preference management. Recipient opt-out links are described rather
than fabricated; an existing stored payload is displayed with its token redacted.
The workspace uses server-rendered tabs and collapsed secondary sections; local
JavaScript only expands the message editor and simplifies optional fields.

## Public subscription email links

Apply `subscription-links.sql` to the existing production `RECOVERY_DB` before
this release. It adds an email-link challenge table, its rate-limit index, and a
selected-topic snapshot table. It does not change subscriber preferences,
confirmed records, existing subscriber sessions, code challenges, or deliveries.

`/subscriptions` now offers all five existing subscription topics and a separate
management-link request. Existing `?topic=...` links preselect the corresponding
topic; `classes-both` preselects Basic and Advanced. Management requests never
enroll users. Confirmation links expire in 24 hours; management access links in
30 minutes. Both use 256-bit random tokens with only SHA-256 hashes stored in D1.
Email addresses and account IDs are never included in the link URL.

Subscription confirmation is intentionally one-click. New email links place the
256-bit token in a URL fragment, which is not transmitted in HTTP request URLs.
The first-party `/assets/subscription-confirm.js` removes the fragment from browser
history and automatically posts it in a request body; no second button or form is
required. JavaScript must be enabled for these new links. Previously issued
subscription query-token links also redeem on GET. Those existing URLs may remain
in infrastructure request logs; no application logging or analytics is added.
Token-page referrer policies suppress token-bearing URL disclosure.

Only subscription-purpose tokens use this automatic path. Management links still
show a read-only GET confirmation screen and require a same-origin manual POST;
their 30-minute expiry and hashed one-hour preference sessions are unchanged.
Subscription confirmation grants no preference-management session. Consumption,
account creation where needed and selected opt-ins are committed atomically in
one guarded D1 batch. Repeated visits never re-enable subsequently disabled
preferences or create sessions. Used links show Already Confirmed with current
confirmed topics. The success page comes from actual records after redemption,
not a URL success flag. Existing confirmed timestamps are preserved. Management
sessions remain Secure, HttpOnly, SameSite=Strict and scoped to `/subscriptions`.

The administrator explicitly accepted scanner activation risk for subscription
confirmation only. This does not relax unsubscribe, admin/application logins,
Recovery Tags owner verification or ASM Instructor authentication.

Requests and resends share an atomic per-email/per-IP limit of five per hour
and a one-minute cooldown. Delivery errors remain in that request ledger to
prevent bypassing the limits. Responses do not disclose subscriber membership;
Invalid or expired unused links offer a fresh-link request with email
entry; used subscription links report their completed confirmation. Email-link templates retain the existing transactional Resend sender and
include HTML plus plain text. The announcement senders, unsubscribe endpoints,
admin login, Recovery Tags owner verification and ASM authentication are untouched.
Previously issued public subscription codes are not accepted; their users are
invited to request a fresh link. No existing code records are deleted.
