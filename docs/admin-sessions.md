# Shared website administrator sessions

Inspection found HTTP Basic authentication with three different realms:
PeterHamRN Admin, Recovery Tags Admin, and Subscriptions Admin. There was no
administrator session cookie, D1 session expiration, session renewal, or
server-side logout. Browser-managed Basic credentials therefore had independent
caching/prompt behavior across sections. No existing session was being discarded
by website code. The same `peter` account and RECOVERY_ADMIN_PASSWORD protect
these website sections; Little Mini additionally requires LITTLE_MINI_ADMIN_USER.

Apply `functions/_admin/sessions.sql` to RECOVERY_DB before deployment. Visit
`https://peterhamrn.com/admin/` to sign in with the existing administrator password.
The form optionally remembers this browser for 30 days. Otherwise the cookie is
browser-session-only with an eight-hour server expiration. Both expire absolutely,
without indefinite sliding extension. Reauthentication replaces the current
session with a fresh credential. A password change invalidates existing sessions.

Every /admin request is gated by server-side session lookup. The opaque random
256-bit cookie uses __Host-, Path=/, Secure, HttpOnly and SameSite=Strict; only its
SHA-256 hash is stored in D1. Credentials are never saved in browser storage.
A signed, expiring login challenge plus Origin validation prevents login CSRF;
password attempts are atomically rate-limited using a keyed IP hash, which is
never used for device identity. State changes require same-origin requests;
forms additionally require a session-bound HMAC CSRF token injected into the
existing forms, while JSON requires its non-simple content type and Origin.
Existing HTML and Little Mini JSON controls retain their additional checks.

Session & Sign Out is linked throughout the admin pages. Log Out revokes the
current session; Log Out All Devices deletes all website admin sessions. Requests
without a valid session cannot bypass logout by sending cached Basic headers.
Legacy Basic validators remain as defensive compatibility helpers, behind the
mandatory session middleware. Old Basic-only automation targeting /admin must
now establish a form-based session rather than rely on browser Basic caching.
The existing private publisher service/bearer authentication is unaffected.

The shared session covers the website Admin Center, Subscriptions, Recovery Tags,
contact-tag administration and Little Mini. Little Mini's explicit account grant
remains required. Recovery owner email-code sessions, subscriber sessions and
ASM Instructor application authentication stay separate. No password reset,
account provisioning or recovery configuration was changed.

No automated tests, browser tests, test messages, live functional exercises, or
verification scripts were run for this implementation. Deployment/migration
results do not establish browser or email acceptance behavior.
