# Recovery Tags email verification links

Claim and owner-access emails now lead with a clickable button and include a
plain URL plus a six-digit fallback code. The original request page hides code
entry in “Link not working? Use the fallback code”. Previously issued codes
remain valid until their existing expiration.

The existing challenge tables are reused without a schema migration. New
`code_mac` values contain `code HMAC:link SHA-256 hash`; old values contain only
the code HMAC. A link uses 32 random bytes, expires with its challenge after ten
minutes, and is scoped by the existing challenge's email, purpose/table, and
claim tag ID. Verification atomically marks the challenge used, so a link and
its fallback code cannot both establish sessions. Neither raw links nor codes
are stored. Requests and resends share the existing rate ledger; insertion now
checks limits atomically and failed deliveries remain in the ledger.

Email tokens travel in fragments, are removed from the address bar, and are
submitted to the same route using POST. An external same-origin script is
explicitly permitted by the page CSP. Referrer-Policy is same-origin so the
browser can supply the Origin required for redemption without sending tokens
to other origins. No analytics or token logging is added.

The landing page automatically verifies email and returns the existing claim
form or owner dashboard. It includes an available Continue button and a new
link request path if navigation cannot finish. A scanner can consume a
verification link, but cannot claim or transfer ownership by visiting it;
users can request another link if needed.

Claim final submission, first-valid-claim-wins, owner authorization, session
cookie scope/expiration, management, transfer release/confirmation, tag events,
public pages, and newsletters retain their existing behavior. There is no
separate transfer-code mechanism: transfers already use the signed-in owner's
existing confirmation and the next owner's normal claim verification. Those
verification entry points now use email links. No transfer states or recipient
acceptance workflow were added. The current owner login has a 24-hour cookie;
there is no separate Remember This Device control in these routes.

No automated tests, browser tests, test emails, production ownership changes,
or post-deployment functional verification were performed for this release.
