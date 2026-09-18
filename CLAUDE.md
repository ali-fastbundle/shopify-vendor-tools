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

**10. All email goes through `sendEvent()`, and every send is awaited.**
`lib/mail.js` is the only place that talks to Resend, and the matrix of who hears about
what lives there — not in the routes. A route calls `sendEvent(event, data)` once and
never composes or sends a message itself.

Sends used to be bare promises nobody waited on, which is not the same as fast: a
serverless function is frozen when it returns, so those sends were unfinished, and
because nothing rejected they left no trace. The symptom was an admin test button that
worked and real events that silently did not. So sends are now awaited. A few hundred
milliseconds on a request is the price of delivery that happens, and the transport's 8s
timeout bounds the worst case.

`sendEvent` never throws. A mail failure must never turn a stored suggestion into a 500
someone sees — `/api/auth/request` is the single exception, because there the mail *is*
the request, and it reads the failure off the returned result rather than a throw.

Every attempt is written to `svt:maillog` and logged as `[mail]`, success or failure.
Silence was the bug; the log is how it stays fixed. `/admin` shows the last 100 and the
failure count for 24 hours, and can fire any event in the matrix at the admin address.

**11. Outbound attribution is added at render time, never stored.**
Every link leaving the site goes through `outbound()` in `lib/outbound.js`, which appends
`utm_source=watchfor.tools`. It is applied in the JSX at the point the `href` is written:
`VisitSite`, `Social`, `ExternalRatings`, the byline, and a suggestion's own link in both
the public list and the admin queue.

The parameter is never written into `lib/tools.js` and never into a stored suggestion. The
catalogue is editorial source and a vendor's submitted URL is theirs; neither should carry
our tracking around after it leaves the page. It also means changing the tag, or dropping
it, is one line here rather than a migration over stored data.

The helper leaves alone anything that is not absolute http or https, which covers
`mailto:`, `tel:`, `#anchor` and relative paths, plus links back to watchfor.tools and any
URL that already carries a `utm_source` in any letter case. It appends by splicing the
string rather than re-serialising the URL, so a vendor's existing query string comes back
byte for byte: re-serialising would rewrite their encoding, and a link that stops working
because we tagged it is worse than an untagged link. The fragment stays last.

**12. A draft is invisible, and publishing is deleting the flag.**
Any catalogue entry of any kind may carry `draft: true`. A draft is absent from the
grid, the search, the matcher, every count, the share card and every API response
including `/api/listing`. It cannot be voted on, reviewed, reported or claimed: the write
routes check ids against the published list and answer 400. It appears in exactly one
place, the Drafts panel on `/admin`.

The mechanism is the naming, not the filter. Each catalogue exports the full source array
as `ALL_TOOLS` / `ALL_NEWSLETTERS` and the published list under the plain name `TOOLS` /
`NEWSLETTERS`, derived through `published()` in `lib/drafts.js`. Every route and component
imports the plain name and is draft-safe without having been changed and without knowing
drafts exist. Seeing a draft takes a deliberate `ALL_` import, which only `/admin` does. A
leak has to be written on purpose rather than forgotten into existence, so keep it that
way: if you add a catalogue, export the published list under the plain name.

**There is no publish button and there should not be one.** Publishing is deleting
`draft: true` from the entry in its source file. What makes an entry ready is `note` and
`watch` being right, which is a judgement made while editing the file, not a state to flip
from a web page. A button would also mean storing published-ness outside the file, and
then `lib/tools.js` would stop being the truth about what the directory says.

`LAST_UPDATED` is computed from the published list, so writing a draft does not move the
site-wide date. Nothing a visitor can see has changed, so the date of the last change has
not either. Give the entry an `updated` of the day you publish it, not the day you drafted
it.

**A section opens on two conditions.** `isLive(kind)` in `lib/sections.js` is `live: true`
on the `RESOURCE_KINDS` entry AND at least one published entry in its catalogue. They fail
in different directions: the flag on an empty catalogue ships a header over nothing, and a
full catalogue with the flag off is just work in progress. The roadmap renders
`pendingKinds()` rather than filtering on `live` alone, so a section still being drafted
keeps its roadmap card and opens by itself when both conditions are true. `lib/sections.js`
is also the one place that knows which catalogue belongs to which kind; a new section is
registered there.

**13. A report is a message, not an edit.**
`/api/report` is open to anyone, with no sign-in, because the person who spots a dead
link is rarely the person who owns the listing. It is only safe that way because it
writes to `svt:reports` and nowhere else — never to the catalogue, never to
`svt:overrides`. An editor reads the queue and makes the change by hand. If you ever
make a report apply itself, it stops being safe to leave open and needs auth in front
of it.

**14. Every email goes out as HTML and plain text, with a working reply address.**
`renderEmail()` in `lib/email.js` returns both halves together so a caller cannot send
one without the other, and every Resend call sets `reply_to` to the first
`ADMIN_EMAILS` address. The subscribe copy tells people they can reply to get off the
list; the from-address has no inbox, so without `reply_to` that is a lie.

**15. Every tool carries an `updated` date, and the site date is derived from it.**
Adding a tool or editing one means setting its `updated` to that day's date, in
`YYYY-MM-DD`. `LAST_UPDATED` is the newest `updated` across the catalogue, computed in
`lib/tools.js` — never a constant to bump by hand. A hand-maintained date only tells
the truth until the first time somebody forgets it, and it fails silently in the worst
direction: the footer claims the directory is stale while it is not.

It is computed from `TOOLS`, the editorial source, and never from `mergedTools()`. A
vendor editing their own listing must not move the site-wide date — that is their
change, not an editorial one, and it shows as "last updated {editedAt}" on that listing
alone. `updated` is in the protected set with `watch`, `cat`, `verified` and `ratings`.

Marking a suggestion reviewed in `/admin` publishes the suggestion, not a listing.
Turning it into a tool is still a hand edit to `lib/tools.js`; give that entry an
`updated` of the day it goes in and the site-wide date moves on its own. See invariant 18.

**16. Rating and reviewing need an account. Voting does not.**
A review is stored against the reviewer's email, one per account per tool, and
posting again replaces it rather than adding a second one under the same name.
`/api/review` answers 401 to a signed-out caller, and the check sits *above* the
rate limiter because reading the session is a signature compare with no I/O
(invariant 6). The reviewer's address is the key that makes one-per-account
possible and it is the only private field in the store: nothing reaches a
visitor except through `publicReviews()` in `lib/reviews.js`, which strips it, so
a route that forgets the helper ships nothing rather than shipping addresses.
`mine` is added per request from the caller's own session and never stored.

Anonymous ratings were one click somebody could repeat all afternoon, which made
the directory's own primary signal the cheapest number on the page. A fabricated
average is worse than no average, because it looks like evidence.

**Votes on a tool stay anonymous**, with the existing per-browser and per-IP
limits. A like is a shrug, it is worth roughly what it costs, and a sign-in wall
in front of one would lose more signal than it protects. Do not extend this to
the like and dislike buttons.

**Helpfulness votes on a review are gated like a rating, not like a like.**
`/api/review/helpful` answers 401 signed out, the session check sits above the
limiter like everywhere else, and one account gets one vote per review, which it
can take back. Deciding which review a visitor reads first is at least as worth
buying as a star, so it costs the same thing to cast.

- **Never on your own review.** Checked server-side, 403, and the button is not
  rendered at all where it could not be pressed. It is the cheapest possible way
  to climb the list and no rate limit makes it not worth doing.
- **Voter addresses are private**, stored as `helpfulBy` on the review, and they
  leave through the same single door as the reviewer's own: `publicReviews()`
  turns the list into a `helpful` count plus a per-request `helpfulByMe`. Two
  private fields now, one function that strips them.
- **Order is `byHelpfulness` in `lib/reviews.js`**: most helpful first, most
  recent to break a tie. It reads `date`, never `editedAt`, so an edit cannot
  climb the list.
- **Editing the text clears the votes on it.** They were cast on the words.
  Otherwise the top of the list is farmable: post something genuinely useful,
  collect what it earns, then rewrite it as an advertisement that keeps the
  position those votes bought. Changing only the rating keeps them, and the form
  says so when there are any to lose.
- Nothing is emailed, either side. It is a vote.

**The form says why, in one line:** "Ratings need an account so they mean
something. One email, no password." `SignInPrompt` in `components/Account.jsx`
takes a required `reason`, because a sign-in wall with no stated reason reads as
a toll, and this one has an argument behind it.

**Signing in happens in place and comes back.** The prompt is inside the review
form, not a redirect to a sign-in page. `SignInPrompt` takes a `returnTo` tool
id, `/api/auth/request` checks it against the catalogue, and it travels inside
the *signed* login token rather than as a query parameter, so the callback can
only ever land on our own origin with an id we minted. The callback redirects to
`/?signin=ok&tool=<id>`, and `Directory` validates the id again before opening
that listing and then strips both parameters so a refresh does not replay it.

**What they typed survives the trip.** `ReviewForm` keeps the rating, name and
text in `localStorage` under `svt:draft:<toolId>` while it is being written, and
clears it on a successful post. Signing in means leaving the page, opening an
email and coming back, and a half-written review does not survive that on its
own. Nobody reports losing two sentences to a sign-in wall, they just do not come
back. It is per-browser and every access is wrapped, because an unposted draft is
not something to put on the server and a browser with storage blocked should lose
the draft and nothing else.

Precedence when all three exist: a star just clicked beats a saved draft, and
both beat the review already stored. That is oldest-last, and it is why the
`existing` effect uses `(r) => r || ...` rather than assigning.

**17. A repeat suggestion increments a row. It never creates one.**
`lib/suggestions.js` matches a submission before it is stored, against the
published catalogue for its kind and against the suggestions already filed.
Wappalyzer was suggested by several different people and every one of them got
their own row, so the only fact worth knowing, that more than one person wanted
it, was invisible because it was spread across rows nobody counted.

- **Already listed** answers with the entry and stores nothing. The useful reply
  is the link, and `/admin` should not collect queue items for things a visitor
  could already be reading.
- **Already suggested** increments `count`, appends the submitter to `also`, and
  leaves the original row's name, URL, category and `why` alone: those are what
  an editor has already read, and a later submitter's spelling does not overwrite
  them.
- Matching is against the **published** list. A drafted entry does not answer
  "already listed", because it is not listed, and somebody asking for something
  already in draft is exactly the demand signal that makes it worth finishing.

Names match loosely and domains match exactly, but **a domain only decides it on
its own when one entry lives there**. Marmeto has three listings on marmeto.com
and Mantle has two on heymantle.com; on those a URL does not identify a product,
and a domain-only match would tell somebody suggesting Orbit that Elevate is
already listed. Anything else falls through to the queue, which is the right
answer anyway.

`also` carries submitter addresses, so it is stripped alongside `email` on every
public read. `/admin` sorts by `timesAsked()` and shows the count as a neutral
pill, because being able to see demand is the entire point of counting it.

**18. Approving a suggestion is not publishing, and the button says so.**
The action is **Mark reviewed**. It clears the `MODERATE_SUGGESTIONS` hold so the
row is served by `/api/data`, and it does nothing else. It used to say Approve,
which reads like the last step before something appears in the directory, and
people reasonably waited for a listing that was never coming.

Publishing is still a hand edit to `lib/tools.js` (or the catalogue file for the
kind), for the same reason invariant 12 has no publish button: `note` and `watch`
are editorial writing, not a state to flip from a web page. `/admin` says this
above the queue rather than leaving it to be rediscovered.

**Copy as entry stub** does the mechanical half: the id, the domain, the URL and
today's date, which are all derivable and are where a typo'd id comes from. It
leaves `one`, `note` and `watch` empty, sets `verified: false`, and carries
`draft: true`. A stub that guessed at the editorial fields would be a stub
somebody ships without reading the vendor's site.

The stored field is still `approved`, because rows written before the rename
carry it, and `approve-suggestion` is still accepted as an action name so a
client on an older page load does not get an error for pressing the same button.

**19. `shopifyExclusive: false` marks a general tool. There is no `true`.**
Nearly everything in the catalogue exists for the Shopify ecosystem and nothing
else, so a badge saying so would sit on every card and carry no information. The
badge that carries information is the one on the handful of general tools an app
vendor still genuinely reaches for, and it renders as a neutral "not Shopify-only"
`Pill` next to the name, on the card, the list row and the detail view. The
compare table adds a Scope row only when one of the tools being compared answers
differently.

It is a **label, not a gate**. What gets listed is still judged on whether an app
vendor has a real use for it, and a general tool has to clear a higher bar to be
worth the row: its `watch` should say plainly what it does not know about
Shopify. PartnerStack is listed and badged. Do not read this as an invitation to
list general tools generally.

Not to be confused with `shopifySpecific` on a newsletter, which runs the other
way round and for the same reason: there, most entries are not about Shopify, so
the informative label is the positive one.

## Layout

| Path | Role |
|---|---|
| `lib/tools.js` | Catalogue (`ALL_TOOLS` as written, `TOOLS` published), categories, design tokens (`C`, `S`, `R`, `F`, `TRACK`, `BAND`, `ink`), and `LAST_UPDATED` derived from it. Edit tools here only. |
| `lib/listings.js` | Claims, the editable whitelist, domain verification, merge logic |
| `lib/auth.js` | HMAC session cookies, magic-link tokens, admin check |
| `lib/store.js` | Redis with an in-memory dev fallback. Accepts `UPSTASH_*` or `KV_*` names |
| `lib/subscribers.js` | List add/remove, unsubscribe token mint and verify |
| `lib/mail.js` | The event matrix and `sendEvent()`. The only caller of Resend |
| `lib/outbound.js` | `outbound()`, the render-time `utm_source` on links that leave the site |
| `lib/drafts.js` | `draft: true`, and the `published()` filter every catalogue passes through |
| `lib/newsletters.js` | The newsletter catalogue and its own shape. Not the tool shape |
| `lib/reviews.js` | One review per account per tool, helpfulness votes and their order, and the only thing that strips an address off either |
| `lib/suggestions.js` | Fuzzy name and domain matching, and folding a repeat into the row that exists |
| `lib/sections.js` | Which kinds have a catalogue, and which sections are actually open |
| `lib/accounts.js` | Account records. Three fields, and the copy that promises them |
| `lib/email.js` | The HTML/text shell, `reply_to`, and the Resend transport |
| `components/Directory.jsx` | The whole UI, one client component |
| `components/Account.jsx` | Sign-in, claiming, vendor edit form |
| `components/Admin.jsx` | Admin console view. The gate is `app/admin/page.js` |
| `components/Pill.jsx` | The neutral attribute badge, defined once because the rule is that it looks the same everywhere |
| `components/Theme.jsx` | The pre-paint theme script and the Auto/Light/Dark toggle |
| `app/globals.css` | Also holds `.masthead` and `.roadmap`, the two layouts that need a real breakpoint rather than an inline style |
| `app/globals.css` | The two themes, as CSS variables, plus the handful of global base rules |
| `app/api/*` | data, vote, review (+ review/helpful), suggest, report, stat, match, claim, listing, auth, subscribe, admin |
| `app/admin` | Admin page. Auth gate first, data read only after it |

## Design conventions

The site borrows the conventions that make the Shopify admin feel familiar — the
typeface, the spacing rhythm, the radii — and none of Shopify's own design system.

**Polaris is not an option, and this is not a matter of taste.** Its licence limits use
to applications that interoperate with Shopify, and a directory *about* Shopify vendors
is not that. Polaris React is deprecated besides. And the footer promises this is an
independent directory not affiliated with Shopify — a UI that looks like the Shopify
admin argues the opposite of the disclaimer directly under it. Do not adopt Polaris,
its component library, or its tokens. Borrow the conventions, keep our own identity:
the category palette, the dark theme, and the card structure are ours and stay.

**Typeface: Inter**, and it stays. Frontend design advice reliably lists Inter as the
default to avoid, and that advice is about landing pages competing on distinctiveness.
This one competes on being legible at 13px in a table, and it is aimed at people who
spend their day in an admin set in Inter. Familiarity is the whole point. Hierarchy
comes from weight and colour, not from a more interesting face.

Loaded by `next/font` in `app/layout.js` and handed to
`globals.css` as `--font-sans`, which sets it once on `<body>`. It is the face the
Shopify admin is set in, and on its own it does most of the familiarity work. No
component names a family; everything says `fontFamily: "inherit"`. The share card in
`app/og` reads the same face as a vendored TTF, because satori needs a file, not a
stylesheet.

**Five design-token objects, all in `lib/tools.js`, all used by name:**

| Token | What it is |
|---|---|
| `C` | Colour. Every value is a CSS variable declared per theme in `globals.css` |
| `S` | Spacing on a 4px grid: `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `2xl` 24, `3xl` 32, `4xl` 48, `5xl` 64 |
| `BAND` | The gap between major bands of the page. `desktop` 64, `mobile` 32, and nothing else does that job |
| `R` | Radius: `control` 6, `card` 8, `modal` 12, `pill` 999 |
| `F` | Type: `xs` 12, `sm` 13, `md` 14, `lg` 16, `xl` 20, `2xl` 24, `display` 28, `hero` 36 |
| `TRACK` | Negative tracking, two steps. `tighter` from 24px up, `tight` below |

`BAND` exists because vertical rhythm used to arrive through the Tailwind door as
`mt-10`, `pb-7`, `pb-14` and `pb-16`: four numbers nobody chose together and none of
them named. Tailwind spacing utilities are still fine *inside* a component. Between
bands of the page, use `BAND`.

Spacing is `S.*` for any single number. A two- or three-value `padding` shorthand stays
a string for legibility, and every number in it is still a step on the same grid —
`"8px 16px"`, never `"9px 14px"`. If a value you want is not on a scale, the answer is
the nearest step, not a new one. The type scale is eight sizes because it used to be
twenty: 13.5 sitting next to 14 is not a decision anybody made, it is two people
rounding differently.

**Two themes, and the visitor picks.** `globals.css` declares dark on `:root` and light
on `:root[data-theme="light"]`, and nothing else — there is deliberately no
`prefers-color-scheme` copy of either palette, because a second copy is how a token ends
up defined in one theme and missing from the other. Resolving "follow the system" to a
concrete value is `THEME_SCRIPT`'s job: it runs before the body paints, reads the stored
choice or the system preference, sets `data-theme`, and updates the `theme-color` meta
tag. The toggle is three-state — Auto, Light, Dark — because a two-way switch can say
"I want light" but cannot say "follow the machine", and once touched there would be no
way back. With scripting off the page is dark, which is what it was before there was a
choice.

Components never read a raw colour. They read `C`, and `C` is exactly the set of names
declared in `globals.css`, so a colour that works in one theme and not the other is a
missing line in the stylesheet rather than a hex buried in a style object. The two
surfaces that render without the stylesheet — the share card in `app/og` and the
unsubscribe page in `app/api/subscribe/remove` — read the literal `DARK` palette
instead, and stay dark: an image and a one-line confirmation page have no theme to
follow.

**Category colour is information, not decoration.** It identifies the category
everywhere it appears, and the palette is closed — do not introduce an unrelated accent.
The nine hues are picked against a near-black background and *none* of them clears
4.5:1 on white, so a category colour set in type goes through `ink(hex)`, which returns
the hue on dark and a darker twin of the same hue on light. Fills, borders and the bars
in the wordmark keep the original hex. Adding a colour means adding its `--ink-` pair to
both blocks in `globals.css`; `ink()` falls back to the hex, so forgetting degrades to
today's behaviour rather than to nothing. The same split applies to the brand green and
the warning hues: `C.accent` is the fill, `C.accentInk` is the type, and `C.onAccent` is
the dark ink that sits on any accent or category fill in both themes.

### Colour invariants

These are the rules that erode one commit at a time — each individual coloured badge
looks like an improvement, and the twelfth one is why nothing means anything. Treat
them as invariants, not preferences.

**A. Category colour appears in exactly three places.** The spine, the category label,
and the filter chips.

- the spine — 3px across the top of a card, 4px across the top of the detail modal, and
  the same 3px turned on its side at the head of a list row or a matcher result
- the category label set in `ink(colour)` directly under the tool name
- the category filter chips, and the kind chips in the suggest modal, which are the
  same device

Nowhere else. Not the lettermark, not a badge, not a border, not a button, not a link,
not the panel a vendor edits their listing in. The wordmark and the masthead bars are
the palette shown as a legend, which is the same job.

**B. Every other badge is a neutral outline.** `C.edge` border, `C.muted` text, no
fill. It lives in `components/Pill.jsx` and is imported, never re-declared: a second copy
of those eight lines is how a neutral badge ends up neutral in one place and not in
another. Free plan, unverified, suite membership, same-owner, by-owner, claimed, price,
"Shopify-specific" and "not Shopify-only" are *attributes*, not categories — giving each its own hue put five
unrelated colours beside a spine whose colour means something and drained the meaning
out of all of them. `Pill` takes no colour any more; it only takes `tone`.

The single exception is `tone="warn"` on "winding down". That is a status warning about
the product, not a label on it, and it is allowed to be seen.

Two attributes stay badges rather than joining the `Facts` line, and both for the same
reason: they are statements about *scope*, not facts about the product. "Shopify-specific"
on a newsletter and "not Shopify-only" on a tool say which directory the thing belongs to
rather than what it costs or who owns it, and both are absent from nearly every entry, so
neither can stack up into a row of grey capsules. Anything that is true of most entries
belongs in `Facts`.

**C. Green is the action colour and nothing else.** Buttons that do something, the
selected-for-comparison state, an owned listing. It is not the free-plan colour: green
meaning both "do this" and "costs nothing" is two ideas wearing one coat. A filter that
is *on* is a state rather than an action, so it takes the neutral inversion —
`C.text` on `C.bg` — which is also what the "All" chip and the view toggle use.

**D. "Visit site" gets one treatment on every tool.** Solid `C.text`, ink `C.bg`, bold,
via the `VisitSite` component. It is the same link doing the same job on every card and
every row, and it was the category colour, which made the most important link on the
card look like nine different links.

**E. When there is nothing, render nothing.** No "no public profile", no "no reviews",
no "None found" — an empty state announcing itself is louder than the absence and reads
as a verdict on the tool rather than on the size of the category. `Social` returns null
with no profiles; a review count renders only above zero; the compare table drops a
whole row when nothing being compared has one.

### Layout invariants

**F. The directory is above the fold.** The first row of tool cards must be visible on a
1366x768 laptop, which means the page above the grid stays under about 400px. It was
709px once: headline, then a two-line subhead, then a stats row, then the matcher as a
full-width hero panel with its own heading, explainer, tall textarea and five example
chips. Every one of those was defensible on its own.

The masthead is therefore a two-column grid (`.masthead` in `globals.css`): headline,
one-line subhead and stats on the left, the matcher on the right, stacked below 1024px.
The matcher is a control, not a hero: no heading paragraph, a two-row textarea, and the
examples behind a disclosure. Once it has an answer the grid drops to one column, since
the answer is a list of tools and wants the width.

Anything added to the masthead comes out of the fold budget. Measure before and after.

**G. Attributes are type, not pills.** Price, free plan, suite, ownership, claimed and
unverified read as one line of 12px muted text with hairline separators, built by
`Facts` in `components/Directory.jsx`. They were six outlined pills; once rule B made
them all neutral the row became six identical grey capsules, and the borders drew more
attention than the words inside them. `Pill` survives for exactly one thing: the
`tone="warn"` status badge.

**H. Every text token clears 4.5:1 in both themes.** `C.dim` was 3.25:1 on raised in
dark and carried review counts, capture dates and the whole footer disclaimer. The
light-theme star was 2.76:1, which made the directory's own primary signal the least
legible thing on the page. Both are fixed. If you change a colour token, re-measure
rather than eyeball it: the ratios are arithmetic, and a value that looks fine on your
monitor is not evidence.

**I. No atmosphere.** No glows, no mesh gradients, no tinted haze behind the masthead.
`--c-glow` is `none` and `--c-hero` and `--c-invite` are flat surfaces. A reference tool
does not need a mood, and two full-width radial gradients repainting behind a scrolling
grid is a cost paid on every frame for nothing.

## Interaction

**Motion answers a pointer, it never asks for one.** Nothing on this page moves on load,
on scroll, or on a timer. What exists: a hover lift on cards, and `.press` for the
`scale(0.975)` a button gives under the finger.

Every transition lives inside `@media (prefers-reduced-motion: no-preference)` in
`globals.css`, so reduced motion is the *absence* of those rules rather than a list of
overrides somebody has to remember to keep in step. The reduce block is deliberately
empty. Adding a transition outside the no-preference block is the bug this shape
prevents.

**Icons are Phosphor, one family, no exceptions.** `@phosphor-icons/react`, sized in
px, `weight="fill"` for on-states and `regular` otherwise. Before this there were text
glyphs: `▲ ▼ ★ ✓ ×`, and `𝕏` for the X logo, which is U+1D54F MATHEMATICAL BOLD CAPITAL
X and renders as tofu on a lot of Android. Glyph metrics also differ per platform, so
the vote buttons were subtly different heights depending on the machine. Do not
hand-roll an SVG and do not add a second icon set.

**Figures are tabular.** `.tnum` for numbers inside prose, and every `table` gets it
wholesale, so a column of ratings and counts lines up. This is why there is no second
webfont for numbers: alignment was the only reason to want one.

**Dashes and dots.** No em-dash in anything a visitor reads: not headlines, labels,
buttons, helper text, alt text or the page title. Use a comma, a period, or two
sentences. This applies to UI copy, and to the `one` / `note` / `watch` / `blurb`
editorial strings in `lib/tools.js`, which have never had one. Code comments are not
visitor-facing and are exempt. The middle dot is a separator, capped at one per line.
`components/Admin.jsx` is behind auth and is not held to this.

**Enter does not submit prose.** Anywhere someone writes more than a value, the field is
a `GrowText`: a textarea that grows with the text, floored at its `rows` and capped at
`maxRows` so a long review cannot push the button off the screen. Enter makes a new line.
Cmd or Ctrl plus Enter submits, and the button always does.

The review box was a single-line `<input>` with Enter wired to submit, which is the shape
of a search box rather than of a place to write a paragraph. People wrote two sentences,
reached for a line break, and posted half a review. Nobody reports that, they just do not
come back. The same field type now covers the review, the suggestion's "why" and the
report's correction.

Enter-to-submit belongs only on genuinely single-line inputs: the search box, the two
email fields, and the matcher, which takes Cmd or Ctrl plus Enter and never plain Enter
because a problem description is prose too.

**Rating is one click, like voting.** Like and dislike write straight from the card.
Clicking a star on a card or a list row does the same thing as far as the person is
concerned: `onOpen(rating)` carries that number into the review form, which opens with
the rating already picked and the cursor in the text field. Three stars clicked means
three stars — never a form that opens empty and asks again.

**Cards browse, rows compare.** The grid/list toggle sits next to the sort control. A
card gives a tool room to describe itself, which is exactly what makes four of them
hard to hold side by side; a list row gives up the description to line the facts up in
columns — name, category, price, free plan, rating, external rating, ownership — and
every column header sorts, reversing when clicked again.

Both orders come from one `SORTS` object in `components/Directory.jsx`, because the
sort control and the column headers both write to it and must not drift into meaning
different things by the same name. A column header can select an order the control does
not offer, and the control renders an extra option for it rather than showing the wrong
one as selected. `dying` still sorts last in every order, in both views. The 2-to-4
tool compare modal is untouched: the list is the pass where you work out which two.

## Conventions

- Plain JS, no TypeScript. Keep it that way unless asked.
- Inline styles, not Tailwind utilities, for anything colour-related. Tailwind is only
  used for layout primitives.
- No animation for attention. `prefers-reduced-motion` is respected in `globals.css`.
- Tools that are `dying` sort last in every order. A shut-down product must never lead
  the grid.

## Sections beyond tools

`RESOURCE_KINDS` in `lib/tools.js` names every section: tools, newsletters, events,
podcasts, YouTube, books, groups, accounts, influencers. Only `tool` has `live: true`.
The roadmap renders every kind that is not open as a card that opens the suggest modal
preselected to it, and `/api/suggest` validates `kind` against that list, defaulting to
`tool` so suggestions stored before kinds existed still read.

Opening a section means: write its entries, drop their `draft` flags, and set
`live: true` on its kind. `lib/sections.js` requires both, and the roadmap card
disappears on its own. Colours are reused from `CATEGORIES` so the palette stays closed —
do not add a new accent for a new kind.

**A section gets its own file and its own shape.** `lib/newsletters.js` is the first one,
and it is deliberately not the tool shape with different words in it. A tool is judged on
what it does, what it costs and who owns it; a newsletter is judged on whether it is still
going, how often, how long for, who writes it and what they sell on the side. Forcing one
through the other means a `price` on something free and a `cat` from a list that does not
describe writing.

What every kind does share, because it is the directory's editorial contract rather than
anything about software: `id`, `name`, `url`, `one`, `note`, `watch`, `social`, `logo`,
`ratings`, `updated`, `draft`. `watch` especially. A newsletter written by a vendor about
the market they sell into has a conflict worth naming, the same way a tracker built by an
app vendor does, and it is no more theirs to edit than a tool's is.

**`shopifySpecific` is a positive tag, not a warning.** Optional on a newsletter. True
means the publication is about Shopify itself, and renders a neutral "Shopify-specific"
badge. Absent or false renders **nothing**: no badge, no "not Shopify-specific" note, no
disclaimer. A newsletter that is not about Shopify is not thereby worse, and a label
announcing the absence would read as a mark against it, the same way "None found" reads
as a verdict on a tool with no external ratings.

**It is not the Shopify-exclusive rule, and it does not extend that rule to newsletters.**
Those are different kinds of thing:

- For **tools**, Shopify-exclusive is a *boundary*. A general tool is not listed at all,
  and Wappalyzer, BuiltWith, PartnerStack and the mobile ASO platforms were removed on
  purpose. That rule is unchanged.
- For **newsletters**, `shopifySpecific` is a *label on something already listed*. The
  boundary is usefulness to an app vendor, which is wider. ECDB is ecommerce market data
  written for retailers, not a word of it about apps, and an app vendor reads it sideways
  to see which merchant categories are growing, which is the demand signal behind who
  installs their app. That is worth listing and it is not Shopify-specific, and both of
  those are true at once.

Do not add the badge to tools. Every tool in the catalogue is Shopify-specific by the
boundary rule, so the badge would be on all of them and would mean nothing.

**Optional is normal in this shape, and omitting beats estimating.** `author` is absent
where a team writes it and nobody is credited. `cadence` is absent where it genuinely is
not published, and `watch` says so rather than a rhythm being guessed from the archive.
`started` takes `YYYY-MM` where only the month is knowable, because inventing a day to
satisfy the format is inventing a fact. `started` and `issueCount` are independent: a
publication can have a countable run with no findable start date, or the reverse. Having
both is what lets a reader check the run for gaps.

Newsletters are not live. All five entries in the file are drafts.

## Writing style for tool entries

`one` is one line, lowercase-ish, no marketing. `note` is what it actually does and who
it is for. `watch` is the caveat someone would want before paying: a conflict of
interest, a coverage gap, a claim the vendor cannot back up. If a tool has no honest
caveat, look harder before writing "none".

**Shared ownership is always disclosed, and it belongs in `watch` only where the
products overlap or compete.** The disclosure itself is the neutral ownership field:
`linked`, `owner` or `suite`, which `Facts` renders as one line of muted type and the
compare table renders as a row. That states it as fact, which is what it is. Moving it
into `watch` makes it a warning, and a warning needs something to warn about.

It usually has one. AppJubilee and StoreCensus are the same company and AppJubilee
publishes comparisons against rivals, so the shared owner is the reason not to read those
as two sources. AppstorePulse is built by the maker of a bundle app, so anyone competing
in bundles would be handing over their keyword strategy. Rankbase started as Craftshift's
internal tracker and Craftshift sells product-image apps. In each of those, the conflict
is the caveat.

App Store Research and ShopExperts are the same owner and do not compete with each other
or with you: a research panel and an expert marketplace. There, `linked` says it and
`watch` covers the real caveats, which are the incentive structure and who pays to be
listed. A `watch` opening with a fact that is already on the card, stated neutrally, one
line up, trains people to skim the field that matters most.

State what is verified and what is not. `verified: true` means the vendor's own site was
read directly. Anything sourced from search results or a third party is `verified:
false` and renders an "unverified" badge.

## Logos

A tool entry may carry an optional `logo`: a path to a real mark under
`public/logos/`, e.g. `logo: "/logos/welookup.jpeg"`. Use one wherever we have it —
the favicon service tops out at 128px and most vendors' favicons are smaller than
that, so a mark the vendor publishes is the better image every time.

`Logo` in `components/Directory.jsx` tries the three in order: the `logo` path, then
the favicon service for the entry's `domain`, then the coloured lettermark. Each step
is the fallback for the one before it, so a wrong path or a deleted file degrades to
what the card showed before rather than to a hole. That is also why the field stays
optional: most entries will never have one.

Take the file from the vendor's own site, the same standard as `social` — a logo lifted
from somewhere else is a guess about what their mark is. Name it after the tool `id`
and keep the extension the vendor's file actually is.

## Social profiles

**The networks are declared once**, as `SOCIALS` in `lib/tools.js`: key, label and
placeholder. The render in `components/Directory.jsx`, the whitelist in `sanitiseEdit`
and the fields in the vendor edit form all read that list. The same three networks used
to be written out in all three places, and three copies of one list is how a network ends
up editable but never rendered, or rendered but silently dropped on save. Adding one is a
line in `SOCIALS` plus its mark in `SOCIAL_ICONS`. Currently LinkedIn, X, GitHub and
YouTube.

`SOCIAL_ICONS` is keyed separately because it holds components and `lib/tools.js` is
imported by server routes that have no business pulling in an icon set. A key in
`SOCIALS` with no mark in `SOCIAL_ICONS` renders nothing, so a half-finished addition
degrades to an absent link rather than a broken one.

The rule for filling them in is unchanged and applies to every kind: only a profile the
publisher puts on their own site. Never a plausible guess.

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

## The mail matrix

Who hears about what, all of it declared in `lib/mail.js`:

| event | admin | user |
|---|---|---|
| `signin_new` | yes | welcome |
| `signin_return` | no | nothing |
| `signin_link` | no | the magic link |
| `subscribe` | yes | confirmation + unsubscribe link |
| `review` | yes | thank you, names the tool. Says "updated" when it replaced one |
| `claim_verified` | yes | what they can and cannot edit |
| `suggestion` | yes | thank you, only if they gave an address. Says how many have asked when it was a repeat |
| `report` | yes | thank you, only if they gave an address |
| `listing_edited` | yes | nothing (they just made the edit) |

Votes send nothing, either side. That covers both kinds: liking a tool, and
marking a review helpful.

Suggestions and reports are open to signed-out visitors, so a missing address is normal,
not an error: the matrix's `user` function returns null and the request carries on.

Reviewing needs an account now (invariant 16), so there is always an address on `review`.
The `d.email` guard in that row stays anyway: the matrix is the contract, and a caller
that omits the field should send nothing rather than throw.

Adding an event means adding a row to `MATRIX` and nothing else. If you find yourself
importing the Resend transport into a route, stop — that is the pattern this replaced.

## Analytics and stats

**Page-level traffic lives in Vercel Analytics, not Redis.** Views, paths, referrers,
devices, countries — all of it is already collected by `<Analytics />` in
`app/layout.js`, and none of it is reimplemented here. Do not add a page-view counter,
a visit log, or a session table. If the question is "how many people came", the answer
is in the Vercel dashboard.

`svt:stats` holds only what Vercel cannot see, because it happens inside one client
component without a navigation:

- `tool:<id>` — a tool's detail view was opened
- `matcher:uses` — the matcher was run

with `svt:stats:queries` keeping the last 50 matcher queries as text, capped and never
joined to a person. No email is attached even when one is known, and no session id.

Counters are incremented with `HINCRBY` against one hash rather than read-modify-
written, so two instances counting at once cannot lose each other's increments. The
browser buffers events and posts them together — on an 8-second timer and on the way
out of the tab via `sendBeacon` — so this is a write per batch, never a write per view.
`/api/stat` drops any tool id not in the catalogue, so the hash cannot be seeded with
junk fields.

## Accounts

`svt:accounts` holds `{ email, firstSeen, lastSeen }` and nothing else — no IP, no user
agent, no page history, no referrer. It is upserted in the sign-in callback, awaited
(it is one read and one write on a store we are already using) but wrapped, so a store
outage costs someone their record and never their sign-in.

The sign-in copy in `components/Account.jsx` states exactly what is kept. It is a
promise, so **if you add a field to an account record, change that sentence in the same
commit.**

## Before committing

```
npm run build      # must compile
```

Then check the homepage HTML actually contains tool names, not just a loading state.

**Check `/admin` returns 200, not just that it returns something.** It is `force-dynamic`,
so `next build` never renders it and a missing component reference compiles cleanly and
throws only at request time. That shipped a 500 to production once, and the check that
missed it read the response body without ever looking at the status code. Assert the
code:

```
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: <admin session>" localhost:3000/admin
```

Next renames its process to `next-server` once running, so `pkill -f "next start"`
reports success without killing anything. Before verifying a build against a running
server, confirm the port is actually free — `lsof -ti:3000 | xargs kill -9` — or the
check will silently run against a stale build.

## What not to do without asking

- Add a general tool. Shopify-only is still the default and the bar: a general tool is
  listed only where an app vendor genuinely reaches for it and nothing native covers the
  job, and it carries `shopifyExclusive: false` and a `watch` saying what it does not know
  about Shopify. PartnerStack is listed on that basis. Wappalyzer, BuiltWith and the
  mobile ASO platforms are still out, and adding one is a decision to check first, not a
  precedent this creates.
- Add affiliate links or sponsored placement. The footer promises neither exists.
- Fabricate a social profile URL. Only link profiles published on the vendor's own site;
  otherwise leave `social` empty, and it renders nothing at all.
- Loosen `MODERATE_SUGGESTIONS`. Public unmoderated submission is the first thing spammed.
