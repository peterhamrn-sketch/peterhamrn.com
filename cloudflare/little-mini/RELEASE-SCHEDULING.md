# Little Mini release scheduling

The existing `WeeklyRelease` Durable Object class and named object are retained to preserve stored state. The name is historical: release dates can now be any future Eastern date and minute.

Cloudflare Pages production needs the private service binding `LITTLE_MINI_PUBLISHER` targeting `peterhamrn-little-mini-scheduler` in `production`. Keep workers.dev and preview URLs disabled, with no public Worker routes and no Cron Triggers. The existing D1 and Durable Object bindings and migrations remain unchanged.

Authenticated release actions pass through the service binding and the existing named Durable Object. The object serializes release changes and alarm handling. After scheduling, rescheduling, Hold, Resume, or Publish Now, it chooses the earliest eligible approved revision's release time, replacing the alarm or deleting it when the queue is empty. Saving edits clears approval and refreshes the alarm. A stale alarm can never release a chapter before its current D1 timestamp.

The alarm publishes only due, approved saved revisions in Scheduled status, then arms the next eligible release. Multiple chapters at the same time are released by one D1 batch. Failures use Cloudflare's bounded alarm retries; there is no recurring polling or weekly fallback check. A failure to arm after a committed change is returned as an explicit warning, not a successful armed-release claim.

Existing approved revisions are sufficient to schedule or Publish Now; there is no certification checkbox. Edited/restored manuscripts lose approval. The editor can explicitly approve a saved previewed manuscript independently of assigning any date.

The next Saturday at 9 a.m. Eastern is an initial suggestion only. Inputs use America/New_York, independent of the administrator's device time zone. Dates are validated on client and server; nonexistent spring-forward times and repeated fall-back times are rejected with explanatory messages. Choose a time outside the transition hour. Minute precision is supported; no chapter is released before its saved instant, though Cloudflare delivery can occur after that instant.

Deploy the publisher Worker, add the Pages production service binding, then push the Pages changes to main. Do not change chapter records as part of configuration. The existing alarm remains armed during the deployment; subsequent explicit release actions reconcile it with the database.
