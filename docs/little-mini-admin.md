# PeterHamRN Admin Center and Little Mini editing

Production destinations: `/admin/`, `/admin/little-mini/`, `/admin/tags`, and
`/admin/subscriptions`. ASM opens the existing TEST application at
`https://test.asminstructor.peterhamrn.com/`, with separate sign-in.
Website Projects, account editing, and future installment scheduling are Coming Soon.

## Account and infrastructure

The production account grant `LITTLE_MINI_ADMIN_USER=peter` explicitly allows
that administrator to use the existing `RECOVERY_ADMIN_PASSWORD` for the new
Admin Center and chapter endpoints. No Recovery owner, subscriber, or programmer
token grants chapter access. Existing Recovery/Subscriptions authentication is
unchanged. Preview deployments have no production bindings or account grants.
Basic authentication is server-side, with no password or API credentials in
browser source. Mutations require the exact same Origin and JSON content type.

Open `https://peterhamrn.com/admin/`; enter username `peter` and the existing
Recovery Tags administrator password in the browser's authentication prompt.
Use a private browser session on shared devices and close it when done; Basic
credentials are browser-managed and this implementation has no logout endpoint.

Dedicated database: `peterhamrn-little-mini`, UUID
`8eea1435-8fca-4f48-bcc8-ae4e561d637a`, production binding `LITTLE_MINI_DB`.
Apply `functions/_mini/001-chapters.sql` only to this database, never RECOVERY_DB.
The migration is idempotent and imports the six original published sources,
their exact rendered manuscript HTML, and complete existing page templates.
Import timestamps reflect database registration; original publication dates
remain October 11, 2026. No unpublished manuscript is registered or exposed.

## Editing

Admin Center → Little Mini → Select Chapter → Edit → Preview → Publish Changes.
The editor loads a saved draft when present, otherwise the published source.
The revision dropdown identifies the current published revision. Restoring it
(or another revision) creates a new private draft; it never publishes by itself.
Markdown headings, links, lists, tables, and paragraph breaks use the existing
renderer. Preview uses that same renderer in a sandboxed frame. Find/Replace
is literal and case sensitive, and unsaved navigation triggers a warning.
Save Draft changes only the draft pointer. Publish replaces only the public
revision pointer, keeps an immutable revision, and clears the draft pointer.
Concurrent saves require the current version; conflicts instruct the user to
copy their edits and reload. The UI requires preview before publishing and asks
for final confirmation. No chapter update sends subscription announcements.

The public route reads only explicitly published chapters. Complete original
page templates preserve URLs, headings, navigation, metadata, companion links,
and publication dates; only the manuscript body changes. Database-backed reads
use no-store. During missing-binding/migration/database outages, the original
static published pages remain available. This fallback can display the original
launch text rather than later corrections until D1 recovers. The original
Markdown download remains the original launch manuscript, as its label states.

## Publication limits

This system edits the six existing published chapters; it cannot create, release,
withdraw, or reschedule new installments. The existing manifest describes a
planned Saturday 9 a.m. America/New_York cadence, explicitly states automatic
scheduling is inactive, and contains no future scheduled/unpublished chapters.
Those settings are preserved. A future release service needs separately supplied
manuscripts, revision-specific approval, protected storage, and Hold/Resume
controls before scheduling can be enabled. Do not add drafts to static source.

After migration, D1 is authoritative for routine chapter corrections. The static
build generator is retained for the original launch fallback; rebuilding static
pages does not overwrite D1. Do not reseed with INSERT OR REPLACE or regenerate
chapter manuscripts. No Recovery Tags, subscription, email, or ASM behavior is
changed.

No tests, verification routines, browser/device checks, or post-deployment checks
were run for this task at the user's request. Infrastructure mutation responses
and Git push establish only migration/binding requests and deployment trigger,
not rendered/runtime acceptance or deployment completion.
