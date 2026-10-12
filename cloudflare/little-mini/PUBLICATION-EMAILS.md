# Automatic project publication email

The existing Little Mini Durable Object records an immutable per-chapter outbox entry in the same D1 batch that first publishes a chapter. Chapters with matching numbers released in that batch share an event. Existing published chapters are not backfilled or announced. Drafts, schedule changes, Hold/Resume and live edits create no notification.

After publication and alarm reconciliation, the Worker calls the authenticated Pages endpoint `/api/internal/project-announcements`. Pages checks the public chapter URLs, freezes active confirmed topic recipients in the existing Recovery D1 subscription delivery tables, and uses the existing Resend sender, credentials and unsubscribe mechanism. Resend credentials remain exclusively in Pages. The Worker and production Pages share `LITTLE_MINI_SETUP_SECRET`; this endpoint cannot prepare arbitrary announcements.

Apply `functions/_mini/003-publication-notifications.sql` to LITTLE_MINI_DB and `functions/_recovery/automatic-announcements.sql` to RECOVERY_DB before deploying these changes. These migrations do not change manuscripts, approvals, release times or preferences. An ASM Instructor topic is registered without enrolling subscribers.

Each recipient has an immutable payload and stable Resend idempotency key. Only an accepted response with a Resend ID is recorded as sent. Accepted recipients are excluded from retries. Definite rejections and unconfirmed sends remain visible in the private Subscriptions Admin. Its retry action invokes notification delivery only, without publishing or changing alarms. Unknown sends older than 23 hours remain held for operator review because Resend expires idempotency keys after 24 hours. There are no email cron jobs or recurring polling; delivery uses finite batches with a lease and bounded per-request timeout. Failure does not undo successful publication. If the runtime is interrupted after publication, persisted pending work can be retried from admin only by explicit admin retry; later releases never drain older announcement events.

The generic announcement module accepts a publication descriptor for any registered enabled topic. Recovery Tags, ASM Instructor and future projects must explicitly connect their successful publication actions to it; unrelated website deployments never announce themselves. Existing manual announcement preparation and sending remain available.

Resend acceptance does not establish inbox delivery. No test messages, deployment-time announcements, publication/alarm invocations or automated tests were run for this release.

Latest Updates is rendered from published chapter records on every landing-page request. Delivery public-availability checks use Cloudflare-supported manual redirect handling. Resend failures retain sanitized HTTP status, error name and message.
