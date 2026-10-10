# Public link previews

Public website pages use initial-HTML Open Graph and Twitter large-image metadata.
Edit `tools/link-previews.json`, then run `python3 tools/update-link-previews.py`.
Use `python3 tools/update-link-previews.py --check` to detect drift. The generator
only edits metadata and document titles; it does not run in the browser or add a
build step. The working homepage intentionally remains unchanged.

Nine dedicated JPEG cards live under `images/previews/`. All are 1200 × 630.
`tools/render-preview-cards.cjs` can regenerate them with a locally available
`sharp` installation. This optional maintenance tool is not a website dependency.
It composes existing site artwork and vector typography without editing originals.
If artwork changes later, use a new image filename in the manifest to avoid stale
image caches; do not make diagnostic query parameters permanent URLs.

## Diagnosis (October 10, 2026)

The live Classes, ASM Instructor, and other public information pages had no
Open Graph/Twitter metadata and generally no canonical links. Thus no explicit
large preview image was offered. The homepage also lacked these tags, but its
large portrait provides a plausible explanation for Apple's successful fallback
preview. Apple's precise fallback selection and cache state cannot be established
from server responses alone.

The previous preview-specific commit `b323070` only changed the unlisted birthday
page: it replaced a 1200 × 630 SVG preview with the 180 × 180 touch icon and changed
Twitter to a small summary card. It did not repair Classes or the public ASM page.
The birthday page remains excluded because it is unlisted and marked noindex.

Both Classes URLs already resolve to `https://classes.peterhamrn.com/classes/`.
The apex `/classes/` copy now advertises that same canonical/og:url; existing
redirects are unchanged. The public ASM `.html` URL redirects normally to
`https://peterhamrn.com/asm-instructor`, which is its metadata canonical.
The class calendar download is an ICS API response, not a webpage preview; no
calendar/publication logic changed.

Pages project `peterhamrn-com` uses GitHub main with no build command. Browser and
Applebot-style requests returned the same metadata before the change, without
observed bot challenges or redirect loops. Detailed zone security/rules settings
returned 403 to the available session, so they were not independently audited or
changed. No robots disallow rules were observed: the missing robots.txt paths
returned the site's HTML fallback. No new crawler permissions are required.

Communication Center/Campaign Manager descriptions are on the public Apps &
Automations page; there is no separate information page for them in this repo.
Separate ASM application hosts, owner/activation/admin/token routes, email
signature assets, and the unlisted birthday page are excluded. The separate
`brisketphotos.peterhamrn.com` gallery Worker also has no OG metadata and was left
unchanged; its public event landing page and the `brisket.peterhamrn.com` redirect
are covered. No application, database, auth, or security configuration changed.

## Verification and Apple-device handoff

Run `python3 tools/check-link-previews.py` after deployment. It checks all 19
configured pages and five aliases with both browser and Applebot-style user
agents, checks unique initial-HTML metadata/canonicals, and verifies every image's
HTTP status, MIME type, and deployed bytes. It does not execute JavaScript.
A user-agent comparison is not a test from Apple's network or its preview cache.

Paste these production URLs into a new Messages conversation:

- https://peterhamrn.com/ (unchanged working control)
- https://classes.peterhamrn.com/
- https://classes.peterhamrn.com/classes/
- https://peterhamrn.com/classes/
- https://peterhamrn.com/asm-instructor
- https://peterhamrn.com/asm-instructor.html (existing shared link)

For a one-time cache diagnostic, also try
`https://classes.peterhamrn.com/classes/?preview-check=20261010` and
`https://peterhamrn.com/asm-instructor?preview-check=20261010`.
Their metadata still points to the permanent canonical URLs. Check the preview
before sending. Actual Apple Messages rendering remains pending manual testing;
server-side checks alone cannot establish complete resolution.

Reference: [Apple TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages).
