# CLAUDE.md

Project guidance for Claude Code. Read this before changing anything.

## What this is

A public, community-rated directory of tools built for Shopify **app vendors** (not
merchants). Next.js 14 App Router, Upstash Redis, deployed on Vercel.

The value of this site is editorial independence. Most of the rules below exist to
protect that, not for technical reasons.

## Invariants — do not break these

**1. `watch` is never editable by a vendor.**
Every tool has a `watch` field: the honest caveat. Vendors who claim a listing can edit
the summary, description, pricing and links. They cannot touch `watch`, `cat`,
`verified`, `ratings` (the external scores), `updated`, community ratings or reviews.
This is enforced server-side in `lib/listings.js` via
the `EDITABLE` whitelist, and restated explicitly in `mergedTools()`. If you refactor
that file, verify with:

```
curl -H "Cookie: <owner session>" -X POST localhost:3000/api/listing \
  -d '{"toolId":"applora","edit":{"watch":"No downsides!","cat":"suite","ratings":[]}}'
```

It must return 200 with the original `watch`, `cat` and `ratings` intact.

**2. API keys stay server-side.**
`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are used only in `app/api/match/route.js`. Never
move a model call into a client component. The browser talks to `/api/match`, nothing
else.

**3. Tool `id` values are permanent.**
Votes, reviews, claims and overrides are all keyed on `id`. Renaming one orphans real
community data. Change `name` freely; never change `id`.

**4. The base catalogue is never mutated at runtime.**
`lib/tools.js` is editorial source. Vendor edits live in Redis as overrides and are
merged on read. This means any bad edit is reverted by deleting one key from
`svt:overrides`. Do not write vendor input back into `lib/tools.js`.

Revoking a claim does not by itself revert published content. The claim lives in
`svt:claims` and the edits in `svt:overrides`; dropping the first takes away the
vendor's access but leaves whatever they already published live on the listing. That is
why `revokeClaim` takes an explicit `revertContent`, surfaced in the admin console as
two separate buttons. Revoking for a change of ownership should keep the copy; revoking
for abuse should not, and the person clicking is the one who knows which it is.

**5. Tool cards must render server-side.**
The grid renders from props passed by the server component in `app/page.js`, not after
a client fetch. It was broken this way once: crawlers saw an empty page. Do not gate
the grid behind a loading state.

**6. Every write route validates and rate limits.**
Unknown tool ids, out-of-range ratings and non-http URLs are rejected. Rate limits are
per IP in `lib/ratelimit.js`. Keep both when adding routes.

**Put the limiter after the auth or token check, not before.** `allow()` costs a Redis
read and a write. Checks like `isAdmin`, `readLoginToken` and `validUnsubToken` are pure
compares with no I/O, so a rejected request currently costs nothing. Limiting first
turns the cheapest rejection into the most expensive one and hands an attacker
amplification instead of protection. The limiter belongs where real work starts.

The one place this rule argues *against* a limiter is `/api/auth/session`: it does a
single `getClaims()` read, so a limiter would triple the I/O on the hottest signed-in
path and save nothing once tripped (one read either way). Left unlimited on purpose.

**7. Admin routes re-check `isAdmin` on every request.**
`/admin` checking before it renders is a convenience for whoever is looking at it, never
the permission. `app/api/admin` and `app/api/admin/broadcast` re-derive the session from
the cookie and re-check, and answer 404 rather than 403 so they do not confirm they
exist. The admin page also returns *before* any Redis read, so an unauthorised request
never pulls data into the render tree. Do not move a read above that check.

**8. The subscriber list is write-only over HTTP.**
`/api/subscribe` returns the same response for a new address and a known one, so it
cannot be used to test who is on the list, and it only emails a genuinely new address so
it cannot be used to mail-bomb a stranger. `/api/subscribe/remove` answers the same page
whether or not the address was there. Nothing reads the list back out over HTTP — the
admin page renders a count, and `Copy all` is client-side. Keep it that way.

**9. Unsubscribe tokens are HMACs of the address under `AUTH_SECRET`.**
No per-address state is stored and a token cannot be edited to unsubscribe somebody
else. Rotating `AUTH_SECRET` invalidates every link already sent, and also every session
cookie. Say so before rotating it.

**10. Admin notification email is never awaited.**
`lib/notify.js` catches everything and callers deliberately drop the promise. A slow or
dead Resend must never fail or delay the request that triggered it. If you make a caller
`await` it, you have made someone else's suggestion depend on our mail provider.

**11. A report is a message, not an edit.**
`/api/report` is open to anyone, with no sign-in, because the person who spots a dead
link is rarely the person who owns the listing. It is only safe that way because it
writes to `svt:reports` and nowhere else — never to the catalogue, never to
`svt:overrides`. An editor reads the queue and makes the change by hand. If you ever
make a report apply itself, it stops being safe to leave open and needs auth in front
of it.

**12. Every email goes out as HTML and plain text, with a working reply address.**
`renderEmail()` in `lib/email.js` returns both halves together so a caller cannot send
one without the other, and every Resend call sets `reply_to` to the first
`ADMIN_EMAILS` address. The subscribe copy tells people they can reply to get off the
list; the from-address has no inbox, so without `reply_to` that is a lie.

**13. Every tool carries an `updated` date, and the site date is derived from it.**
Adding a tool or editing one means setting its `updated` to that day's date, in
`YYYY-MM-DD`. `LAST_UPDATED` is the newest `updated` across the catalogue, computed in
`lib/tools.js` — never a constant to bump by hand. A hand-maintained date only tells
the truth until the first time somebody forgets it, and it fails silently in the worst
direction: the footer claims the directory is stale while it is not.

It is computed from `TOOLS`, the editorial source, and never from `mergedTools()`. A
vendor editing their own listing must not move the site-wide date — that is their
change, not an editorial one, and it shows as "last updated {editedAt}" on that listing
alone. `updated` is in the protected set with `watch`, `cat`, `verified` and `ratings`.

Approving a suggestion in `/admin` publishes the suggestion, not a listing. Turning it
into a tool is still a hand edit to `lib/tools.js`; give that entry an `updated` of the
day it goes in and the site-wide date moves on its own.

## Layout

| Path | Role |
|---|---|
| `lib/tools.js` | Catalogue, categories, palette, and `LAST_UPDATED` derived from it. Edit tools here only. |
| `lib/listings.js` | Claims, the editable whitelist, domain verification, merge logic |
| `lib/auth.js` | HMAC session cookies, magic-link tokens, admin check |
| `lib/store.js` | Redis with an in-memory dev fallback. Accepts `UPSTASH_*` or `KV_*` names |
| `lib/subscribers.js` | List add/remove, unsubscribe token mint and verify |
| `lib/notify.js` | Admin notification email. Fire-and-forget, never awaited |
| `lib/email.js` | The shared HTML/text email shell, `reply_to`, and the Resend senders |
| `components/Directory.jsx` | The whole UI, one client component |
| `components/Account.jsx` | Sign-in, claiming, vendor edit form |
| `components/Admin.jsx` | Admin console view. The gate is `app/admin/page.js` |
| `app/api/*` | data, vote, review, suggest, report, match, claim, listing, auth, subscribe, admin |
| `app/admin` | Admin page. Auth gate first, data read only after it |

## Conventions

- Plain JS, no TypeScript. Keep it that way unless asked.
- Colours come from the `C` object and per-category `color` in `lib/tools.js`. Category
  colour is information, not decoration: it identifies the category everywhere it
  appears. Do not introduce unrelated accent colours.
- Inline styles, not Tailwind utilities, for anything colour-related. Tailwind is only
  used for layout primitives.
- No animation for attention. `prefers-reduced-motion` is respected in `globals.css`.
- Tools that are `dying` sort last in every order. A shut-down product must never lead
  the grid.

## Sections beyond tools

`RESOURCE_KINDS` in `lib/tools.js` names every section: tools, newsletters, events,
podcasts, YouTube, books, groups, accounts, influencers. Only `tool` has `live: true`.
The roadmap renders every other kind as a card that opens the suggest modal preselected
to it, and `/api/suggest` validates `kind` against that list, defaulting to `tool` so
suggestions stored before kinds existed still read.

Opening a section means giving it a catalogue and flipping `live`. Colours are reused
from `CATEGORIES` so the palette stays closed — do not add a new accent for a new kind.

## Writing style for tool entries

`one` is one line, lowercase-ish, no marketing. `note` is what it actually does and who
it is for. `watch` is the caveat someone would want before paying: a conflict of
interest, a coverage gap, a claim the vendor cannot back up. If a tool has no honest
caveat, look harder before writing "none".

State what is verified and what is not. `verified: true` means the vendor's own site was
read directly. Anything sourced from search results or a third party is `verified:
false` and renders an "unverified" badge.

## External ratings

Tools may carry an optional `ratings` array. Each entry is
`{ source, score, outOf, count, url, captured }` — `captured` being the date the figure
was read, so a stale number is visible as stale rather than passing for current.

- **Only the score, count, source name and link.** Never review text, never a quoted
  excerpt, not even a short one. These are third-party copyrighted reviews. We reference
  the aggregate and send people to read them at source.
- **Entered by hand from the public listing page.** Do not scrape these platforms; their
  terms prohibit it. No crawler, no API client, no "just this once" fetch.
- **Record `captured` on every entry.** An external score with no date is the one most
  likely to be quietly years out of date.
- **Vendors cannot edit `ratings`.** It sits in the protected set alongside `watch`,
  `cat` and `verified` — absent from `EDITABLE` and restated in `mergedTools()`.

A tool with no external ratings renders nothing at all — no row, no placeholder, no
"None found". Most of this catalogue is too niche for G2 or Trustpilot to have a page
at all, so an empty slot says something about the size of the category, not about the
tool. "None found" reads as a failed search and, next to a competitor showing 4.9, as a
verdict. The compare table drops the whole row when nothing being compared has one.

A source can also be recorded without a score: keep `count` and `url`, omit `score`
rather than guessing, and the UI shows the source and count alone.

Never blend an external score into the community rating, or show a single combined
number. They measure different populations, and averaging them would report a figure
neither source ever published. The card and detail view show them separately and at
different weights on purpose: the community rating is the directory's own signal, the
external scores are reference.

## Notifications

One email per event, never batched into a digest — a notification that arrives late
bundled with four others is one nobody acts on. `notifyAdmin` fires on a newsletter
signup, a suggestion, a verified claim, a listing edit, a review or rating, and a
report. Pass `{ origin }` so the mail carries a link to `/admin`.

Senders thank the person too, where there is an address to thank: the subscribe
confirmation, a suggestion when an email was given, and a review by a signed-in
visitor. The review form never asks for an address, so an anonymous review gets no
email by construction rather than by a check somebody has to remember.

Every one of these is fire-and-forget. A dead mail provider must never turn a stored
suggestion into a 500 the visitor sees.

## Before committing

```
npm run build      # must compile
```

Then check the homepage HTML actually contains tool names, not just a loading state.

Next renames its process to `next-server` once running, so `pkill -f "next start"`
reports success without killing anything. Before verifying a build against a running
server, confirm the port is actually free — `lsof -ti:3000 | xargs kill -9` — or the
check will silently run against a stale build.

## What not to do without asking

- Add a tool that is not Shopify-exclusive. That boundary is deliberate; general tools
  like Wappalyzer, BuiltWith, PartnerStack and mobile ASO platforms were removed on
  purpose.
- Add affiliate links or sponsored placement. The footer promises neither exists.
- Fabricate a social profile URL. Only link profiles published on the vendor's own site;
  otherwise leave `social` empty and let it render "no public profile".
- Loosen `MODERATE_SUGGESTIONS`. Public unmoderated submission is the first thing spammed.
