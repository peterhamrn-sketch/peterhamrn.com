# PeterHamRN Admin Center and Little Mini editing

Production destinations: `/admin/`, `/admin/little-mini/`, `/admin/tags`, and
`/admin/subscriptions`. ASM opens the existing TEST application at
`https://test.asminstructor.peterhamrn.com/`, with separate sign-in.
Website Projects and account editing are Coming Soon. Little Mini release controls are available in the Chapter Manager.

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

## Publication workflow

The manager supports existing published corrections and new private manuscripts.
Scheduling controls and the single weekly alarm are described below. The static
manifest remains the original launch fallback; D1 owns later release status,
revision approvals, intended publication times, and new chapter visibility.
Do not put unapproved or scheduled manuscripts in the static deployment root.

After migration, D1 is authoritative for routine chapter corrections. The static
build generator is retained for the original launch fallback; rebuilding static
pages does not overwrite D1. Do not reseed with INSERT OR REPLACE or regenerate
chapter manuscripts. No Recovery Tags, subscription, email, or ASM behavior is
changed.

No tests, verification routines, browser/device checks, or post-deployment checks
were run for this task at the user's request. Infrastructure mutation responses
and Git push establish only migration/binding requests and deployment trigger,
not rendered/runtime acceptance or deployment completion.

## Scheduled releases (October 2026 extension)

Apply `functions/_mini/002-release-queue.sql` to the same dedicated D1 database.
It adds only Little Mini release metadata and event history; existing chapter
text, revision history, publication dates, and public URLs are unchanged.

The separate `peterhamrn-little-mini-scheduler` Worker binds the same D1 database
and runs once each Saturday at 9 a.m. America/New_York using a single Durable Object alarm. No cron polling is used. It publishes only Scheduled chapters whose saved draft
revision still equals the explicitly approved release revision. It requires no
login or page view, invokes no subscription/email code, and leaves other release
dates unchanged. The next weekly alarm is computed from
America/New_York, including EST/EDT. Invalid spring-forward and ambiguous
fall-back inputs are rejected. Actual execution may lag due to Cloudflare timing or outages. The job schedules only the next weekly alarm and processes all arrived approved releases. On a handled failure it records the error and waits until the next weekly window; Publish Now remains available. There is no high-frequency retry/polling loop or exact-second guarantee.

The Chapter Manager accepts new supplied manuscripts as private drafts. Preview
and save them, then select Schedule Publication / Reschedule for a Saturday at 9 a.m. Eastern, or Publish Now for immediate release at any time.
Confirm that the saved manuscript is reviewed, complete, and verified. Use the
matching-pair checkbox to apply a release action atomically to both unpublished
chapters with that number. Otherwise actions affect only the selected chapter.
Hold keeps the saved time and approval. Resume requires unchanged approved text
and a future saved time. If that time has passed, choose a new time or Publish
Now. Editing scheduled text automatically puts it On Hold and invalidates its
release approval; preview and approve the saved revision before rescheduling.
Draft edits to already published chapters preserve the existing Publish Changes
workflow and do not withdraw the public revision.

Public routes select only explicitly published revisions. Dynamic navigation
and the landing-page chapter lists contain only published chapters. Future
chapters have no static files or publicly retrievable source manuscripts.
Missing/unavailable D1 falls back only to the original six launch pages and home;
all later chapter URLs fail closed. Original Chapters 1–3 keep their D1 page
formatting and published manuscript HTML; only their navigation is updated when
later chapters become public.

Deploy the weekly-alarm Worker with the included `cloudflare/little-mini/wrangler.jsonc`. It explicitly removes all Cron Triggers. Initialize its single named object once through the temporary secret-protected setup endpoint, then disable workers.dev again. The object computes its next Saturday alarm each week, automatically using EST or EDT as appropriate.
No new Pages binding or account secret is needed. The existing Little Mini grant
and database are reused. No live tests or verification routines are run.

## Approved Chapter 4 queue

Peter explicitly approved the two final review-pair files in
`Desktop/Little Mini - Complete Project Archive/08 - Chapter 4 Pair - Ready for Review/`
for scheduling. Both exact source files, including their historical review
metadata, are stored privately as immutable D1 revisions. Only the obsolete
archive status banner is omitted from rendered manuscript HTML; the chapter
headings, paragraphs, instructions, warnings, and tables remain intact.

Both Chapters 4 are saved with Scheduled status and approved revision pointers
for `2026-10-17T13:00:00.000Z` (Saturday, October 17, 9 a.m. Eastern).
The named weekly alarm's initialization response saved that same initial window.
No private chapter source or rendered Chapter 4 page is committed as a static
asset. Migration and scheduling responses establish successful configuration
writes; no live chapter, admin, browser, or scheduled-job verification was run.
