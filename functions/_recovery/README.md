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
