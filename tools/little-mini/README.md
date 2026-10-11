# Little Mini publication source

The six Markdown files in `manuscripts/` are the authoritative launch manuscripts
copied intact from Peter's Desktop on October 11, 2026. Preserve their complete
contents. The public HTML is generated from those files, not ChatGPT history.

## Generate pages

From the repository root:

```sh
node tools/little-mini/build.mjs
```

This writes `little-mini/index.html` and the six chapter `index.html` files.
It is page generation, not a test or a verification routine. Commit the source
and generated pages together. Existing Cloudflare Pages deploys the repository
root from GitHub `main`, with no build command or infrastructure changes.

## Expenses

Edit the `expenses` array in `project.json`, then regenerate and commit. Amounts
are integer cents. `purchased` and `refunded` affect actual spending. `planned`
and `pending` affect projected spending only. Refund amounts are negative.
Changing a refund from pending to refunded applies it to actual spending without
counting it twice. No subscription or Recovery Tags data is accessed.

## Future installments

The manifest has explicit installment `status` and `approved` fields. Statuses
are `draft`, `scheduled`, `published`, and `held`. Generation includes only
installments explicitly marked `published` and `approved: true`. Dates never
promote content, and no clock, automation, or Chapters 4 onward are active.

The intended cadence is Saturdays at 09:00 in `America/New_York`. Record any
future intended time with that IANA zone and the correctly converted UTC instant,
not a fixed EST offset. Do not add unpublished text to this repository while the
entire root is the static deployment directory: source Markdown would be publicly
retrievable. Keep future unapproved manuscripts outside the deployment root.

For this static first release, Publish Now means an explicit approved manifest
change, regeneration, commit, and deployment. Hold means keeping an unpublished
installment out of published status. Reschedule changes its intended time without
changing other installments. This is a publication structure, not an authenticated
admin or automatic scheduler. Withdrawing already generated pages requires
explicit removal of their HTML; manifest changes alone do not remove old output.

## Backend work remaining

Authenticated chapter correction editing now uses dedicated D1 storage, as
described below. Expense editing without source changes and automatic Saturday
publication remain unfinished. Future releases need revision-specific approvals,
protected previews, and explicit Hold/Resume controls. A future cron publisher must not change another installment's date when
Publish Now is used. No changes to existing functions or databases were made for
this launch.

The Official Little Mini Fan Club now links to the shared topic-specific
subscription flow. Apply `functions/_recovery/subscriptions.sql` before
deploying the signup buttons. See `docs/subscriptions.md` for configuration
and announcement handling.

## Release evidence

The user explicitly prohibited tests and verification routines for this launch.
Page generation and Git publication are not live website, browser, or device
verification. Deployment is triggered by pushing the commit to GitHub `main`;
report it as triggered, not verified, unless separate permission is given later.

## Database-backed corrections

The Admin Center now supports private drafts, immutable revisions, previews,
and live corrections for the six published chapters using dedicated D1 storage.
See `docs/little-mini-admin.md` for sign-in, migration, fallback behavior, and
publication limits. D1 is authoritative for corrections; the generator above
remains the original launch fallback. It does not overwrite D1 revisions.
Future installment scheduling remains Coming Soon, with no date-driven
promotion or new manuscript publication enabled.
