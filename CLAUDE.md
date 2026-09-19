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

**Limit the outcome that creates work, not the request that might.**
`/api/suggest` capped every submission at 3 an hour, at the top of the route,
before it knew what the submission was. Three of its four outcomes create
nothing: already listed is answered from the catalogue, a merge increments a row
that exists, and a validation failure stores nothing at all. Only a new queue row
costs anybody attention. So the fourth person in an hour to suggest a tool that
was already in the directory got "Suggestion limit reached" instead of the link
they were looking for, having created nothing on any of the previous three.

It is two limits now: a wide flood guard before the dedup, which is what
protects the model call, and the tight budget immediately above the line that
writes a new row. **Being told something is already listed must never be rate
limited.** It creates nothing, it is the answer the person wanted, and refusing
it teaches them the form is broken.

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

**There is no publish button for a *file* entry, and there should not be one.** Publishing
one of these is deleting `draft: true` from the entry in its source file.

(Invariant 22 adds a publish button for a different thing: an entry drafted from a
suggestion, which lives in Redis and never touches this file. The rule below is about
`lib/tools.js` and is unchanged by it. A `draft: true` in the file is still published by
editing the file.) What makes an entry ready is `note` and
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

**32. Ownership is only a fact when it names something else.**
"AppJubilee is built by AppJubilee" is not information: every product is made by
itself. An owner is worth stating when it names a parent company, a legal
entity, a person, or another listed tool. `isVacuousOwner` in `lib/tools.js` is
the single copy of that rule.

It reached the live site once, and fixing it at the monitor was not enough,
which is the lesson worth keeping: **a guard on the door the last bad value came
through is not a rule about the field.** There are three defences now and they
fail in different directions.

- **`mergedTools()` drops a vacuous `owner` override** rather than merging it.
  This is the one that matters, because an override outranks the file. Had it
  only been suppressed at render, AppJubilee would have shown no owner at all
  instead of falling back to the real one in `lib/tools.js`.
- **`ownerOf(tool)` returns "" for one**, and every public render reads
  `ownerOf` rather than `tool.owner`: `Facts`, `ownershipOf`, the tool page and
  `llms.txt`. A bad value written by any route later still cannot reach a page.
- **`sweepOwnership()` clears what is already stored**, in `svt:overrides` and
  `svt:entries`, from a button on `/admin`. It deletes the key rather than
  writing an empty string, because an override's absence means "whatever the
  file says" and an empty string would pin it to nothing. Idempotent, and it
  returns what it cleared, so a second run reporting nothing is the evidence
  the first one worked.

**Match on equality after normalising, never on substring.** The first version
used substring and it cost a real owner: Becketto is built by Beckett Oliphant,
and `beckettoliphant` contains `becketto`, so the rule hid a genuine person and
the sweep would have deleted them from the record. A product named after its
founder is common. `bare()` strips protocol, `www.`, the TLD, legal suffixes and
the generic product nouns (`app`, `software`, `platform`, `team`, `hq`), so
"AppJubilee Inc", "The AppJubilee App" and "appjubilee.io" all reduce to
`appjubilee` on their own. It deliberately does **not** strip `labs`, `studio`
or `group`, which are what distinguish a real parent: Dark Ecommerce Labs is the
answer here, not the noise.

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
public read. **So is `draft`**, which is a model's unreviewed entry about a named
company, caveat and all. It was going out to anyone who called `/api/data` or
`/api/suggest`, which made invariant 21's human-approval step decorative: the
unapproved text was already public. Anything added to a suggestion row that is
not for a visitor has to be added to `publicOf` in the same commit. `/admin` sorts by `timesAsked()` and shows the count as a neutral
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

**A discovered competitor becomes a suggestion, and then it is just a
suggestion.** `promote-discovery` creates a queue row from a discovery finding
and stops. Research, the draft editor, approve-and-publish, the entry stub and
the tallies are the pipeline that already exists, reached unchanged. A name off
a competitor's comparison page and a name somebody typed into the form differ
only in how they arrived, so that is the only thing recorded differently: `via:
"discovery"` and `namedBy`, the vendors whose pages named it, which is the
evidence for looking at all.

- **It is idempotent.** Two admins on the same list, or one double click, land
  on the row that exists. `findDuplicate` decides, and the existing row comes
  back so the caller researches that one.
- **Already in the directory is refused**, not queued. Discovery filters those
  out when it runs, so hitting one means the finding went stale.
- **Never public, and not on one flag.** The row is written `approved: false`
  whatever `MODERATE_SUGGESTIONS` says, *and* `publicList` drops
  `via: "discovery"`. The public list is captioned as what people have asked
  for, and a lead we generated is not that.
- **It gets its own tally**, `suggestions:discovered`, rather than incrementing
  `suggestions:received`. That counter answers "how many people asked", and
  nobody asked for this one. Folding it in would make the label wrong, which is
  the whole of invariant 27.

The button is on the Discovered panel and does both steps, so one click means
one click: promote, then run the existing research pass, then render the same
`DraftPanel` the suggestion queue uses. A research failure still leaves the
queued row, so there is something to retry rather than nothing.

**19. `shopifyExclusive: false` marks a general tool. There is no `true`.**
Nearly everything in the catalogue exists for the Shopify ecosystem and nothing
else, so a badge saying so would sit on every card and carry no information. The
badge that carries information is the one on the handful of general tools an app
vendor still genuinely reaches for. It renders as a neutral "not Shopify-only"
`Pill` on the list row and the detail view, and as type in the `Facts` line on
`/tools/[id]`, because on that page every attribute is type. **Not on the card**,
which rule J stripped back to what helps somebody choose which one to open. The
compare table adds a Scope row only when one of the tools being compared answers
differently, and `llms.txt` carries it as a note.

It is a **label, not a gate**. What gets listed is still judged on whether an app
vendor has a real use for it, and a general tool has to clear a higher bar to be
worth the row: its `watch` should say plainly what it does not know about
Shopify. PartnerStack, BuiltWith and etailinsights are listed and badged, and each
`watch` ends by naming the one job the native tools cannot do, which is what earns
the row. Do not read this as an invitation to list general tools generally.

Not to be confused with `shopifySpecific` on a newsletter, which runs the other
way round and for the same reason: there, most entries are not about Shopify, so
the informative label is the positive one.

**20. The model is never the last word, and never the only path.**
Three features call a model: the matcher, suggestion dedup, and research
drafts. All three go through `lib/model.js`, which is the only file that reads
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. Anthropic first, OpenAI second, either
pinnable with `MATCH_PROVIDER`, and the other tried when the first fails.

**No model file may be imported by a client component.** `lib/suggestions.js` is
imported by `components/Admin.jsx`, so the model-backed matching lives in
`lib/dedup.js` instead. Tree shaking would probably have saved it, and probably
is not how invariant 2 is kept.

**Every model path has a non-model path behind it.** The matcher falls back to
local keyword matching, dedup falls back to name and domain matching, and
research simply refuses rather than half-working. A submission is never lost
because a model was unavailable: no key, a timeout, a 500, unparseable JSON, an
invented id or a low confidence all land on the string matching, which lands on
storing a new row. The worst outcome reachable here is a duplicate row an editor
merges by hand.

A verdict is ignored below `0.7` confidence, and an id the model returns is
checked against the list it was given, because inventing one is the failure that
would merge a submission into nothing at all.

**Every dedup verdict is logged to `svt:dedupelog`** with the provider, the
confidence, the reason and whether the model or the strings decided. A merge is
the only destructive outcome in that pipeline, so it is the one that has to be
answerable afterwards. `/admin` renders the last 60.

**21. A drafted entry is a draft until a person publishes it.**
`Research and draft` fetches the vendor's own pages and asks a model to write
`one`, `note`, `watch`, `price`, `free`, `domain`, `social`, `cat` and `tags`.
The prompt makes it go looking for what a vendor would not say: who owns or
built it, whether it shares an owner with anything in the catalogue, whether an
advertised rating can be stood up, whether pricing is genuinely published, how
old and how established it is, and what it could not verify.

**`watch` of "none" is refused by the software**, not just discouraged in the
prompt. `sanitiseEntry` rejects "none", "n/a", "nothing" and their variants. If
the research finds no caveat it must say what it checked and failed to find,
because an absence of evidence about ownership, pricing or age is itself the
caveat.

Everything the model repeated without being able to check it lands in
`unconfirmed`, which renders above the fields on `/admin` in the warning colour.
Nothing else in this console is coloured like that on purpose.

**What research must never do:**
- **Fetch a review platform.** Only the vendor's own origin is fetched, seven
  known paths, nothing else. G2 and Trustpilot terms prohibit crawling and that
  invariant is older than this feature. The consequence is that an advertised
  score cannot be checked, and the prompt says to record it as the vendor's
  claim rather than assert it.
- **Produce `ratings`.** Stripped on the way in. External scores are entered by
  hand in the file, from the platform's own page, with a `captured` date.
- **Set `verified: true`.** Forced to false whatever the model says. Verified
  means a person read the vendor's site, and a model reading it is not that.

A page under 200 characters is recorded as thin rather than read, because a
client-rendered `/team` returning an empty shell would otherwise read as "they
have no team page", which is a finding the caveat would lean on.

**22. Approving publishes to Redis, never into `lib/tools.js`.**
`Approve and publish` writes to `svt:entries`, which `mergedTools()` reads
alongside the file. Two reasons, and the first is not a preference: **a Vercel
function's filesystem is read only**, so there is no version of "write the entry
into the source file" that works in production. The second is invariant 4, which
survives intact because of the first. Nothing mutates the editorial file at
runtime, and a bad entry is one key delete away, exactly like a bad vendor
override.

A published entry is a first-class catalogue member: `catalogueTools()` is what
every write route validates ids against, so it can be voted on, reviewed,
reported, claimed, matched and counted exactly like one from the file. Adding a
route that checks `TOOLS` directly is the bug this arrangement prevents.

`Copy as entry stub` is how an entry graduates into the file, and it is worth
doing for anything meant to last: the file is reviewable in git and Redis is
not. Nothing forces it and nothing breaks without it.

**Suggestion counts are demand, and they are shown.** `suggestedBy` rides from
the merged suggestion onto the published entry and renders as "suggested by N
people" in the `Facts` line on the card and the detail view, above one only. The
admin queue sorts by it, so what the most people asked for is what gets reviewed
first.

**23. The monitor proposes a specific edit. A person applies it in one click.**
`lib/monitor.js` fetches every published entry once a week, records a
structured snapshot, reports only material changes, and for each one proposes a
concrete edit: **which field, from what, to what**. Nothing is ever written
without a click.

**`Apply` names the field and both values on the button**, because the click is
the approval and everything needed to judge it has to be on the thing being
clicked. It writes an override, the same mechanism a vendor edit uses, so it
inherits what already makes that safe: the editorial file is untouched and one
key delete undoes everything. `Undo` restores exactly what was there, including
restoring "there was nothing here" by deleting the key rather than writing the
file's value into an override.

Sending an editor to a form to retype what the monitor already worked out is
make-work, and make-work is how a weekly digest stops being read.

**Three whitelists, and the difference between them is the point.**
`EDITABLE` is what a *vendor* may change about themselves. `APPLIABLE` is what
an *admin* may apply from a proposal, which is wider because the monitor is not
an interested party: it adds `owner`, `linked`, `suite` and `dying`, the facts a
vendor should not get to assert about themselves. `PROTECTED` is what no route
may write: `watch`, `cat`, `verified`, `ratings`, `updated`, `id`, `name`.

**A proposal touching a protected field gets no button, ever.** It renders as
"needs a hand edit" with the reason stated rather than left as a missing
affordance. A monitor that could rewrite a caveat because a vendor stopped
mentioning the thing it warns about is the exact failure this arrangement
exists to prevent. `mergedTools()` restating the protected fields is the
enforcement; the list is the explanation.

**"I could not map this" is a first-class answer.** Where the change does not
land on one field the monitor says so and the row falls back to opening the
entry. A guess would be a button claiming it will write something and then
writing the wrong thing, which is worse than no button.

**The snapshot is structured, never raw HTML.** Diffing HTML produces a diff
every week and none of it means anything: session tokens, build hashes, rotating
testimonials, a copyright year, a blog teaser. A monitor whose output is noise is
one nobody opens, and then the week it matters it gets skimmed past with the
rest. The model records the handful of facts a listing depends on (pricing
tiers and figures, the headline claim, stated scale numbers, named integrations,
status signals, whether each page resolves) and the diff happens between two
small objects.

**Availability is observed, never asked.** Whether a URL resolves is a status
code we have, so the software decides it and `dead-page` is absent from the
kinds a model may return. Asking cost us a false alarm: the snapshot prompt
requested a `pages` map including a pricing page that was never fetched, because
no entry declared a `pricingUrl`, and the model filled the gap with "dead". A
live page with four pricing tiers was reported gone at 0.9. The prompt now lists
exactly which pages were fetched and forbids saying anything about the others.

**Three fetch outcomes, not two: reachable, blocked, unreachable.** A 401,
403, 429, a challenge page or a 200 with nothing readable in it means the site
is live and refusing us, usually because a WAF dislikes the datacentre range a
serverless function runs from. That is **a property of our coverage, not an
event in the vendor's week**, so it is recorded as `blocked` on the snapshot,
alerted on never, and surfaced once in "Cannot be monitored" in Catalogue. One
successful read clears the flag by itself.

Each page is tried with a second user agent before giving up, which helps where
a filter keys on the UA string and does nothing where it keys on the IP, which
is the SAMI and Ranksy case.

**A dead page takes two runs.** One failed fetch is a timeout, a deploy, a WAF
having a moment or our own network. The first failure is recorded as
"unreachable this run" at **0.3**; only a failure that repeats becomes a
dead-page claim, at **0.75**. Confidence on an availability finding is a
statement about how many times it has been verified, not about how certain the
sentence sounds. The streak lives on the snapshot record, and one good read
clears it.

**Non-findings are filtered in code, not just discouraged in the prompt.**
`isNonFinding()` drops a change whose old and new values are the same once
formatting is ignored, one whose value already appears in the entry we publish,
and one whose applyable edit would write what is already stored. Ownership gets
its own rule: **naming a brand as its own owner is not information.** The
monitor reported AppJubilee's owner as "AppJubilee"; the real answer, Dark
Ecommerce Labs LLC, is in the site metadata, and the vacuous finding crowded it
out. Ownership is reportable only when it names something else: a parent
company, a legal entity, a person, or another listed tool.

Every drop is logged, so a filter that is too aggressive is visible rather than
silent.

**Strictness is the feature.** Only seven kinds count, they are listed in the
compare prompt along with what explicitly does not (copy edits, blog posts,
design changes, a few percent of drift), a change under `0.6` confidence is
dropped, and an unknown kind is dropped. An empty result is the expected answer
most weeks.

**Silence is an output.** Nothing is emailed on a quiet week. An empty digest
every Monday is how a digest becomes something people filter into a folder.

**Politeness.** A browser-shaped user agent with the bot token and URL on the
end, because a bare bot string gets a challenge page or a 403 from plenty of
WAFs and that reads to us as a dead site,
`robots.txt` parsed and obeyed per origin and cached for the run, three entries
at a time across different domains with a pause between waves, and a 12s
timeout. Per-domain concurrency is 1 by construction.

**Cost.** One snapshot call per entry per week, plus a comparison call **only
when the snapshot actually moved**: an unchanged snapshot short-circuits before
the second call, compared with sorted keys so a provider reordering its JSON
does not buy itself a call. A quiet week is therefore about one call per entry,
a busy one closer to two.

**The schedule.** `vercel.json`, `0 9 * * 1`. Vercel's Hobby plan allows cron
expressions that run **at most once per day**, so weekly is within it; what
Hobby does not give is precision, so it fires somewhere in the 09:00 hour. The
endpoint also accepts `Authorization: Bearer $CRON_SECRET` from any external
scheduler and a POST from an admin session, so nothing depends on Vercel Cron
specifically and the sweep can be run by hand from `/admin`.

**A run that cannot finish does as much as it can.** Entries are processed
oldest-snapshot-first under a wall-clock budget, so a sweep cut short by the
function timeout resumes where it stopped rather than re-checking the same first
fifteen entries forever. An unreachable entry keeps last week's snapshot rather
than overwriting it with an outage, and is reported as needing a look rather
than as a dead site.

**`pricingUrl` and `changelogUrl` are optional and never guessed.** The monitor
fetches the homepage plus whatever an entry declares. Guessing at `/pricing`
would produce a dead-page alert every week for every vendor who does not have
one, which is exactly the crying-wolf failure this is built to avoid.

**33. A discovered name carries a URL, or says why it does not.**
Every finding read "no URL given on the page" and `Research and draft` then
failed on click. The cause was not the model: `textOf` strips tags before a page
is handed over, so every `href` was gone before anything could read it. The one
thing a `/vs` page reliably does was the one thing the fetch destroyed, and it
looked from outside like a model being unhelpful.

Three sources now, in order, and **which one answered is recorded**:

- **`found`** from a link on the page. `anchorsOf` keeps the anchors before
  `textOf` runs, and `linkForName` matches a name to a link in code after the
  model has had its go. Deterministic and free.
- **`resolved`** from `resolveDomains`, one batched call asking the model for
  the official domain of names nothing linked to. This is the only place
  discovery uses what a model knows rather than what a page says, so it is
  labelled differently in the admin. A guessed domain that looks like a found
  one sends somebody to research the wrong company.
- **Neither**, in which case `Research and draft` is **disabled with a sentence
  saying why**, rather than left to fail on click and spend a model call
  learning there was nothing to fetch.

**Outbound means a different registrable domain, not a different origin.** The
first version checked origin, which keeps `blog.vendor.com` and
`docs.vendor.com`, so the prompt filled with the publisher's own Blog and
Documentation links. Social, app stores and review sites are dropped too: none
of them is ever the competitor's own site.

**Expect most URLs to be `resolved` rather than `found`.** Vendors name
competitors on comparison pages and mostly do not link to them, which is
ordinary SEO rather than an oversight. AppJubilee's `/compare` links only to
appjubilee.io. The link path is still right, because it is free and exact where
it fires; it is just not the common case.

**One item, one place, and the cross-reference runs on render.**
A finding is worth showing only while all three are still true: it is not in the
directory, nobody has put it in the suggestion queue, and nobody has declined it.
`settled()` in `lib/discovery.js` is the one predicate that decides, and both
`getDiscovery()` and `runDiscovery()` call it.

The two used to disagree. A pass filtered against the catalogue as it stood that
morning and the render filtered against nothing, so a finding was correct on the
day it was written and then slowly stopped being. BuiltWith was named as a
competitor, added to the directory a week later, and the list went on saying "not
in the directory" for the rest of the month. **A cross-reference that only runs
monthly is wrong most of the time.** Now the catalogue and the live queue are
read on every render, so a name leaves the list the moment somebody deals with
it, with nothing rerun.

- **Promoting removes it from this list.** It is a suggestion now, and research,
  the draft editor, the entry stub and publishing are all over there. The list
  used to keep it and render "Already in the suggestion queue" in place of the
  whole action row, which is how the console ended up with a Dismiss button
  nobody could find: it was never missing, it was behind a branch that had
  swallowed the page. Two states now, not three.
- **The matching is `findListed` and `findDuplicate` from `lib/suggestions.js`**,
  deliberately the same rule the suggestion form uses rather than a second copy.
  A discovery finding and a suggestion are the same thing arriving by different
  doors, so "is this already known" has to have one answer. Name, then a domain
  when that domain has exactly one entry behind it, per invariant 17. For a
  yes-or-no question the order of the two tests cannot change the result, only
  which entry gets named as the reason.
- **A deleted queue row does not count as queued.** Deleting one is how an
  editor says this is not wanted, and the finding returning is the correct
  consequence. Dismissing it is how you say it should stay gone, and that is
  what the dismissed set is for.
- **`listedSince` and `queuedSince` come back as counts**, and render as one
  muted line above the list when either is above zero. A list that shrank
  because the work got done reads exactly like one that shrank because the pass
  found nothing, and those are opposite pieces of news.
- **`Clear list` throws the findings away and nothing else.** The dismissed set
  is a different key and is untouched: those are decisions somebody made, and
  clearing a stale list is not undoing them. `at` is kept so the health strip
  still reports when the last pass ran.

**Declining a name is permanent, and the reason is the point.**
`svt:discovery:dismissed` is keyed on the same normalised name `runDiscovery`
groups by, so the two cannot drift. It is filtered **on read as well as on
write**: filtering only at run time would leave a dismissed name in the list
until the next monthly run, which is up to a month of it still being there after
somebody pressed Dismiss.

Soft, like every other removal here. The stored finding is kept, `Restore` puts
it straight back, and the record holds who declined it, when and why. The reason
is what stops the same question being researched twice by somebody who was not
there the first time, so the three that need no research are one-click buttons:
out of scope, already listed under another name, defunct.

**24. Suggesting something already listed succeeds. It is counted, not refused.**
It used to be a dead end: the submitter got told it was already there and
nothing was recorded, which threw away the one thing the submission was evidence
of. Somebody went looking for this, did not find it easily, and cared enough to
type it in. The fourth person to do that is saying something about the tool and
something about our own navigation.

The counter lives in `svt:interest`, **never in `lib/tools.js`** — invariant 4,
and a number that moves whenever a stranger fills in a form is the opposite of
editorial. `mergedTools()` reads it the same way it reads vendor overrides, so a
hand-written entry and a published one both get it.

- **Two or more to show.** "Suggested by 1 person" is how everything got here
  and says nothing about this one. It renders in the `Facts` line, so it is type
  rather than a badge (invariant G).
- **Publication carries the count across.** `carryInterest` runs on the first
  publish of a suggestion, so the people who asked for something before it
  existed are not erased at the moment it starts existing, which is exactly when
  their asking turned out to be right. It is additive and skipped on a
  re-publish, so fixing a typo does not double it.
- **The reasons are kept and shown on `/admin`.** Somebody explaining why a
  listed tool matters is editorial input, and it keeps arriving long after the
  entry is written.
- `people` carries addresses, so it is stripped on every public read exactly
  like a suggestion's `also`. The count is public; who asked is not.
- **This path must never return an error.** Not rate limited (see invariant 6),
  and `addInterest` catches its own store failures and returns 0 rather than
  throwing: losing a counter is not a reason to hand somebody an error instead
  of the link they asked for. `scripts/interest-test.mjs` runs against a live
  server and checks exactly this, including the fourth submission in an hour.

**25. `/admin` is four tabs, ordered by whether there is anything to do.**
Inbox, Catalogue, People, System. It had grown to thirteen headings in one
column, and finding the two that needed a decision meant scrolling past eleven
that did not.

- **Inbox is the default and the only tab with a deadline**: suggestions to
  review (sorted by interest), open reports, claims to check, and monitor alerts.
  Its count is in the tab label, so "is there anything for me" is answered
  without clicking. **When it is empty it says so in one line** rather than
  rendering four empty panels, which is the state it is in most days.
- **Any list that can exceed about ten rows is collapsed by default, with a
  count in its header.** `Collapsible` does this. The count is the part you
  read; the rows are what you open when the count says something. A page of
  open panels answers "what happened" and buries "what needs me", and this
  console has had to be rescued from that twice.
- **The page answers "what needs me" first and "what happened" second.** That
  ordering is the whole of the tab layout, and it is why audience data is not
  in System and why the changelog archive is not in the Inbox.
- **Changes are grouped by tool, not listed chronologically.** One collapsed
  line per tool with a count, ordered by whether it needs a decision and then
  by recency, under a single summary sentence that is usually the whole answer.
  A tool leaves the Inbox once every one of its changes has a destination.
- **The Inbox holds the latest run, matched on its exact timestamp.** Every row
  from one sweep shares an `at` stamped once in `runMonitor`. Matching on the
  *day* looks equivalent and is not: three runs in an afternoon collapse into
  one, which put 90 changes in the Inbox instead of the 8 the last sweep found.
  Older unhandled findings go to Earlier, collapsed.
- **System answers "is anything broken" above the fold.** A status strip of
  store, mail, monitor, discovery, cron, coverage and env, each green or a
  number, each naming the consequence rather than the variable. Everything else
  on that tab is shut until the strip says to look.
- **One `Row` for every list, on every tab.** Title, one coloured tag, neutral
  badges, a grey meta line, body, actions, optional footer. Before this each
  panel had invented its own arrangement and no two were alike. Adding a panel
  means using `Row`, not writing a twelfth layout.
- **Every destructive action is a `ConfirmBtn`.** Revoke, delete, dismiss and
  unpublish are all one click from something unrecoverable, and they used to look
  identical to Resolve. It arms rather than opening a modal, and disarms itself
  after four seconds so a half-press is not a trap for the next click.
- **Every section states its empty case in one line.**
- The palette and type scale are the public site's, from `lib/tools.js`. There
  is no second design language here, and `components/Pill.jsx` is the badge.

**34. The store can be read before it is written to, and the reset names what it deletes.**
`lib/inventory.js` reports every key this application writes: what it holds, how
many rows, and for anything small enough to read, the rows themselves. It renders
as **Store contents** on the System tab.

Every other panel here shows one slice of the store shaped for a decision. None
of them answered "what is actually in here", which is the question you have after
six months of building the thing, when your own test account, your own test
reviews and forty test emails to yourself are in the same rows as the real ones
and you cannot see the real state through them.

**Nothing guesses what is test data**, because nothing can: an address that looks
like a test is somebody's address if it is not. The panel lists rows and a person
marks them, one `ConfirmBtn` at a time, and `deleteRow` takes four named targets
rather than a key, so a wrong string in a request body cannot reach anything
editorial.

**A test send is recorded as one rather than inferred later.** `sendEvent` carries
`test` through to the mail-log row, because a test and a real admin notification
are otherwise identical on the wire: both go to the admin address. Without the
flag, clearing test rows out of the log means guessing.

**`Reset test data` clears votes, reviews, subscribers and the mail log.** The
list lives in `lib/inventory.js`, so the confirmation text and what is actually
deleted are read from one place, and the button names all four on the confirm
rather than in a paragraph above it: the click is the approval, so everything
needed to judge it has to be on the thing being clicked. That is invariant 23's
rule about Apply, and it is the same rule.

**What it never touches is as much of the point, and the reasons are not
interchangeable:**

- **The catalogue and vendor edits** (`svt:overrides`, `svt:entries`). Invariant
  4: deleting those is editing the directory, which is not housekeeping.
- **Claims** (`svt:claims`). A claim is a relationship somebody verified by
  email, and there is already a deliberate two-button path for revoking one.
- **Monitor snapshots** (`svt:snapshots`, `svt:monitor`). A snapshot is the
  baseline the next diff is taken against. Delete them and the next run reports
  every tool in the directory as changed, which is the one output guaranteed not
  to be read, and it does not show up until the following Monday.
- **The counters** (`svt:stats`). Invariant 27 has them deliberately not derived
  from the rows so they survive the rows going. Resetting them to match a
  cleared list is exactly the thing they exist not to do.
- **Suggestions and reports**, which are queues with their own soft-delete.
- **Accounts**, because a sign-in is not test data by default. The likely test
  row there is one address the person running this recognises, and that is a
  marking, not a sweep.

Adding a store key means adding a row to `SHAPES` in the same commit, or it is a
key nobody can see.

**26. Merchant-facing Shopify apps are out of scope, and saying so is the job.**
People will suggest bundling apps, reviews apps, shipping apps. Those belong in
the Shopify App Store. The submission is **accepted, stored, flagged and
answered**, never refused: an error would tell somebody the form is broken
rather than that the directory is narrower than they thought.

**Classified on whose budget it comes out of, not on who appears on the site.**
App Store Research has merchants all over it and recruits them by the thousand,
but an app vendor pays for the calls, so it is in scope. A reviews app shows a
widget to shoppers and is paid for by the merchant, so it is not. The question
is always: whose money is this.

It rides on the dedup call rather than costing a second one, since both
questions need the same context and most submissions raise neither.

**Only a confident "merchants" rejects.** "unclear", a low confidence, or no
model at all all mean in scope. Wrongly turning somebody away is worse than an
editor reading one extra row, and there is deliberately no string heuristic:
"is this a merchant app" is a judgement, and a keyword version of it would
reject anything with "bundle" in the name.

**Out of scope is stored but not public** (`publicList` filters it) and lives in
its own collapsed section in **Catalogue**, never the Inbox, because it needs no
decision and would otherwise inflate the one count on that page that is supposed
to mean there is work here. It is kept because what people arrive expecting to
find is worth knowing: a run of them says the front page is not being read the
way it is written.

The thank-you email and the on-screen message both say plainly that it will not
be listed and where it does belong. The default suggestion copy promises "it
goes in after a check", and sending that would be a promise we are not going to
keep.

**27. Nothing in a queue is ever destroyed.**
Deleting a suggestion sets `status: "deleted"` with a timestamp, the admin who
did it and an optional reason. Dismissing a report stamps it the same way.
Nothing is spliced out of an array, ever, because the row is the only record
that somebody once asked for a thing, and removing it means "what have people
suggested" can only be answered about whatever nobody threw away.

Deleted rows leave every working list: the queue, the public list, `/api/data`,
and every count of what is waiting. They live in a collapsed **Deleted** section
in Catalogue with a **Restore** that puts one back exactly as it was.

**The counts are never derived from the list.** `lib/tallies.js` increments a
counter in `svt:stats` at the moment each thing happens: received, published,
out of scope, deleted, folded into a duplicate, already listed, and the report
equivalents. A total computed from what is currently stored reads like a total
and means "the survivors", and the 500-row cap alone guarantees they diverge.
They are incremented with `HINCRBY`, so two submissions at once cannot lose
each other.

Pending is the deliberate exception and is labelled as the live figure.
Received minus everything since would drift the moment two counters got out of
step, and it would go negative rather than merely wrong.

**28. Every tool has a real URL, and it works with JavaScript off.**
`/tools/[id]`, server-rendered, with its own title, description, canonical and
JSON-LD. The whole catalogue used to live at one address behind a modal, which
meant Google had one page to rank for thirty products and a model quoting us had
nothing to cite. The modal stays for browsing; the card title is now an anchor
with a real `href` that calls `preventDefault` only on a plain left click, so
middle-click and modifier-click go to the page.

**The address bar follows the modal.** Opening a tool pushes `/tools/<id>`,
closing pops back to `/`, and browser back closes the modal rather than leaving
the site. Until this, the thing on the screen had no address: it could not be
sent to anybody, bookmarked or reloaded, and the page that already existed at
that address was reachable only by knowing to middle-click a card title. A
modal that cannot be linked is a modal that undoes the point of invariant 28.

Next patches `pushState` and `replaceState` (`app-router.js`) to copy its own
internal history state onto the new entry and update the canonical URL without
navigating, which is exactly the arrangement wanted: the URL becomes
`/tools/<id>`, the directory underneath is untouched, nothing is refetched, and
our `svtTool` key rides along on the same entry.

- **Closing goes back, it never pushes.** Both put the right address in the bar
  and only one leaves a history that behaves: pushing would mean every open and
  close added two entries, so somebody who browsed six tools has to press back
  thirteen times to leave the page. The guard is that the current entry is one
  we pushed, which is what makes `history.back()` safe to call: it means there
  is an entry underneath and that entry is this page, so back can never walk
  somebody off the site.
- **The id lives on the history entry, not in a ref**, so forward reopens what
  back closed, and it is checked against the catalogue before it opens anything
  for the same reason the sign-in return is.
- **The sign-in return strips its parameters before it opens the tool**, not
  after. A `replaceState` afterwards would overwrite the entry the modal just
  pushed and take the id off it. Order is the whole of it.
- Every access is wrapped. A browser that refuses the History API should cost
  somebody a shareable URL and nothing else.

**The way to get the link is a control, not a word.** It said "permalink" in
grey next to the category, which is four letters for people who already know
what it means and invisible to everybody else, and following it opened a second
copy of the page you were reading. `components/CopyLink.jsx` says what it does,
puts the absolute URL on the clipboard and confirms in place by becoming
"Copied" for two seconds. It lives in its own file for the reason `Pill` does:
it is on the tool modal and on every entry in the feed, and the rule is that the
control that gives you a link looks the same wherever a link is worth giving.

It resolves `path` against the current origin **at click time**, so a preview
deployment copies its own URL and nothing has to know the canonical host. Two
clipboard paths, because `navigator.clipboard` needs a secure context and is
absent on plain http; the deprecated textarea and `execCommand` fallback is what
makes it work there. Discreet by construction: no fill, no accent, 12px muted
type. Confirmed reads in `C.text`, not the accent, because green has three jobs
and "something just happened" is not one of them.

**`components/ToolPage.jsx` has no client state on purpose** and deliberately
does not reuse the modal. The modal votes, opens a review form and carries a
session; this has to be complete in the first response for a crawler that will
never run our JavaScript, and reusing a component whose content arrives after
hydration is the quickest way to fail at that. Adding a `useState` to that file
is the bug this shape prevents.

**Descriptions are per tool, never the site description.** `toolDescription()`
builds one from `one`, the category and the price. Thirty pages sharing a
description is thirty pages treated as one.

**Every tool page links to related tools**, by shared owner first, then
category, then the rest. A page nothing links to is found once from the sitemap
and quietly dropped, and modal-only browsing produced nothing but orphans.

**29. Structured data says only what is true.**
`lib/seo.js` is the one place it is built, because the same facts have to agree
across the homepage graph, each tool page, the sitemap and llms.txt.

- **`aggregateRating` only where a review exists.** `ratingOf()` returns null
  otherwise and callers spread it, so absent is the default. A zero
  `ratingCount` is invalid and Google flags it, but the better reason is that a
  directory claiming ratings it does not have is the thing this site exists not
  to be.
- **`offers` is omitted rather than faked.** Our `price` is prose. Free tiers
  get a real `Offer` at 0; a price with a figure in it gets an `AggregateOffer`
  with `lowPrice`; prose we cannot read gets **no offers key at all**. An entity
  without offers is merely not eligible for a price rich result. An entity with
  a wrong price is a wrong price, and that is the number that gets quoted back
  at you. The first version emitted a priceless `Offer` on nine tools, which is
  invalid; `scripts/validate-jsonld.mjs` caught it and now guards it.
- Run `node scripts/validate-jsonld.mjs <url>` before shipping a change to the
  graph. It checks what the Rich Results Test checks, so the paste into Google
  is a confirmation rather than a discovery.

**30. The site is written to be quoted.**
`robots.js` names GPTBot, ClaudeBot, PerplexityBot, Google-Extended and the rest
and allows them explicitly. Silence would permit them too, but the point is that
it is a decision: the value here is the caveat nobody else writes down, and a
model repeating it with attribution is what this is for.

`/llms.txt` is the directory as plain text: what it is, who maintains it, the
boundary, the categories, and every tool with its one-liner and URL. It
deliberately **omits the `watch` notes**. They are the most valuable thing here
and the most context-dependent, and a caveat quoted without the entry around it
stops being a note about a product at a date and becomes a flat accusation about
a company. Every line points at the tool page, which carries it in full.

**31. A listing describes what a tool is. The feed records what changed.**
They are different jobs and they were being done by one field. Every monitor
finding used to have two destinations, the listing or the bin, so "added a
Slack integration" had to be crammed into `note` or thrown away. **A listing
that grows every week has stopped being a listing** and become an undated
changelog nobody reads to the end of.

So a finding has three destinations, and they are independent because one
finding can rightly need two of them:

- **Publish to feed**, the default and the right home for most findings: a new
  feature, an integration, a rebrand, a pricing move. News, dated, in order.
- **Update listing**, only when the change alters what the tool fundamentally
  is or costs: the headline price, a free tier appearing or disappearing, a
  wind-down, a category shift. This is the field-level Apply from invariant 23.
- **Dismiss**, for noise. Soft, like everything else that removes something.

A pricing move is usually both: the feed records that it happened, the listing
says what is true now.

**Feed entries are written by a person, every time.** `Publish to feed` calls
`/api/admin/announce` first, which drafts a line and writes nothing, then opens
the editor on the draft. Nothing reaches the feed until somebody has read it and
pressed a second button. `sanitiseEntry` refuses an em-dash outright, because
this is the one place text goes from an admin form straight onto a public page.

The draft is not the monitor's summary, which is written in a different register
and was the old pre-fill. The monitor addresses an editor deciding whether
something matters; the feed is read by somebody who uses the tool and wants to
know what it costs now. `lib/announce.js` holds the prompt, and most of its
length is spent preventing one failure: a model handed a price change will write
about strategy. "Raised the Starter tier to $79" is observable, "raised prices as
it moves upmarket" is invented, and a directory whose whole value is that it does
not make things up cannot publish the second.

**The voice examples are lifted from the catalogue, not written for the prompt.**
`houseVoice()` reads real `one` and `watch` lines out of `TOOLS`, so the examples
cannot drift from the site they are meant to match. Telling a model "plain,
factual, no marketing" returns marketing with the adjectives taken out; showing
it eight real lines returns the rhythm. It looks up ids and silently skips any it
cannot find, so `scripts/announce-test.mjs` asserts every example is really in
`lib/tools.js`. Renaming a tool would otherwise empty the prompt and only show up
as drafts quietly getting worse.

**The editor shows the claim beside the draft**, not under it and not a click
away: the observed values, the before and after, the confidence and the source
link. A generated sentence reads as finished whether or not it is true, so the
evidence for it has to be in the same glance. That panel renders from the row the
page already has rather than from the drafting response, so it is there when the
model is down and the textarea opens empty. A failed draft never blocks somebody
writing two sentences themselves.

The em-dash is also stripped in code after the model returns, along with the
spaces around it. The prompt forbids it twice, and a rule stated in a prompt is a
request rather than a guarantee.

**`/changes` is one chronological stream across every tool**, newest first, and
it is the primary view: linked from the main nav beside the directory, not a
per-tool sub-page. Filters narrow it by tool and by category; they do not change
what it is. It is the part of the site that moves weekly, which makes it what a
crawler comes back for and what a returning visitor has a reason to open. It is
in the sitemap with its `lastModified` taken from the newest entry rather than
the build date.

**It is called Recent updates** in the nav, the page heading, the RSS channel
title, the admin labels and the weekly email subject. The store keys, the route
and the internal names are still `changes`, which is fine: those are not read by
anybody the name is for.

**It appears in exactly two places, and both are the universal stream.** The
standalone page at `/changes`, and the Recent updates view on the directory. Not
the detail modal, not `/tools/[id]`, not collapsed and not further down a
listing. Those render what a tool *is*, and a dated list of events under the
description gives a reader two answers to "is this current" on one screen, which
is the problem the feed was built to solve rather than to relocate. If you find
yourself passing a `changes` prop into a listing component, that is this rule
being broken.

**The directory has two views, and the catalogue is always the default.**
A switcher above the filters, matching the view toggle's shape: `role="group"`
and `aria-pressed`, not `role="tab"`, because neither implements the arrow-key
contract `role="tab"` promises. Selected is a state rather than an action, so it
takes the neutral inversion, the same device as the "All" chip. No category
colour, because it is not a category, and no accent, because green does things.

**The Recent updates tab is a real `<a href="/changes">`.** A plain left click
is intercepted and the rows render in place; a middle click, a modifier click, a
crawler and a browser with no JavaScript all get the standalone page. That page
keeps its own title, description and JSON-LD and stays the thing that updates
weekly, so it cannot become a tab somebody has to know to press. Same pattern as
a card title linking to `/tools/[id]`.

**Every entry has an address of its own, and it is a fragment.** The feed is one
stream across every tool, so an entry has no page to be the subject of and does
not want one: what makes "Ranksy raised Starter to $79" worth reading is the
dated list around it. So each row carries its `id` as an HTML id, the date is a
real anchor to `/changes#<id>`, and a `CopyLink` sits beside it for everybody who
does not know that a date in a feed is usually a permalink. The ids are in the
server HTML, so a pasted fragment resolves with JavaScript off, and the filters
default to all, so it never lands on a row that has been filtered away.

RSS follows: an item's `link` is `/changes#<id>` rather than the tool page, and
the guid says `isPermaLink="true"` because now it is one. It used to point at the
tool page because the fragment resolved to nothing.

**`FeedRows` in `components/ChangesFeed.jsx` is the shared body.** The page wraps
it in a `<main>` with a heading; the tab drops it under the switcher. One
implementation, because two would drift.

**The count is per browser, and absent by default.** `localStorage` under
`svt:updates:seen`, never an account: "what is new to me" is a per-browser
question and nobody else's business. It renders only above zero and only on the
unselected tab, as a neutral figure, never a coloured dot and never with motion.

A first-time visitor has no mark stored, so there is nothing to be new against
and the tab is just a tab. That is the whole answer to "do not swamp somebody
who has never heard of any of these tools": the feed says nothing until the
visitor has a history to compare against. It is rule E applied to time.

The mark is stamped when the tab is **opened**, not on page load, because "I
have looked at this" is something a person does. The count clears on the next
visit rather than under the pointer. Every access is wrapped: blocked storage
costs the count and nothing else, and a corrupt mark fails closed to no count,
which is the direction to fail in.

**Anything added above the grid comes out of the fold budget** (invariant F).
The switcher costs roughly 50px and the header's bottom padding gave back 4 of
them. Measure before adding a third thing.

**RSS lives at `/changes/rss`**, declared through `alternates.types` on the page
so a reader finds it without being told. It is the one surface here that a person
never looks at while it is being written, so escaping is not cosmetic: `&` is
escaped before `<` and `>` or the others get double-escaped, and dates are RFC
822 rather than the ISO the rest of the codebase uses.

**The weekly email is built from the feed.** "Three changes this week" with
links is a better reason to open an email than a new listing, which happens
rarely and which nobody subscribed for. `Compose` drafts from the last seven
days; a person still writes the sentence around it and presses send.

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
| `lib/announce.js` | The announcement prompt and the house-voice examples. Drafts, never publishes |
| `lib/newsletters.js` | The newsletter catalogue and its own shape. Not the tool shape |
| `lib/communities.js` | The groups and communities catalogue, and its own shape again |
| `lib/suggestions.js` | Fuzzy name and domain matching, and folding a repeat into the row that exists. Client-safe, so no model import |
| `lib/dedup.js` | Model-first dedup with the string matching as fallback, and the verdict log |
| `lib/model.js` | The provider chain. The only reader of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` |
| `lib/research.js` | Fetches a vendor's own pages and drafts an entry from them |
| `lib/monitor.js` | The weekly sweep: robots.txt, polite fetching, structured snapshots, the strict diff |
| `lib/interest.js` | How many people have asked for a tool that is already listed, and why |
| `lib/feed.js` | The changes feed: what happened, as opposed to what a tool is |
| `app/changes` `components/ChangesFeed.jsx` | The public feed, filterable by tool and category |
| `lib/tallies.js` | Running counts that outlive the rows they count |
| `lib/inventory.js` | Every store key, what it holds, and the only two ways to delete from it |
| `lib/seo.js` | The JSON-LD graph, per-tool descriptions, and the related-tool links |
| `components/ToolPage.jsx` | One tool at its own URL, server-rendered, no client state |
| `app/tools/[id]` | The per-tool route. Title, description, canonical and graph per entry |
| `app/sitemap.js` `app/robots.js` `app/llms.txt` | What crawlers and models read |
| `lib/entries.js` | Entries published from the admin queue, and `catalogueTools()`, the catalogue everything validates against |
| `lib/reviews.js` | One review per account per tool, helpfulness votes and their order, and the only thing that strips an address off either |
| `lib/sections.js` | Which kinds have a catalogue, and which sections are actually open |
| `lib/accounts.js` | Account records. Three fields, and the copy that promises them |
| `lib/email.js` | The HTML/text shell, `reply_to`, and the Resend transport |
| `components/Directory.jsx` | The whole UI, one client component |
| `components/Account.jsx` | Sign-in, claiming, vendor edit form |
| `components/Admin.jsx` | Admin console view. The gate is `app/admin/page.js` |
| `components/Pill.jsx` | The neutral attribute badge, defined once because the rule is that it looks the same everywhere |
| `components/CopyLink.jsx` | The copy-link control, defined once for the same reason. Resolves its path against the current origin at click time |
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

**That line is on the detail view and the tool page. It is not on the card.** See rule J.

**J. The card answers one question: which of these thirty do I open.**
Everything on it earns its place against that question, and everything that
answers a question you only ask *after* choosing lives in the detail view. The
card had grown a badge per feature until it carried fifteen unranked elements.

On the card: the mark, the name, the category, the one-line summary, the price,
the community rating and review count, the votes, `Visit site`, and the compare
control. Plus `winding down`, which is rule B's one allowed warn badge and the
only thing on a card that tells you not to bother.

Not on the card, because each was already rendered on the detail view and was
being shown twice: suite membership, shared ownership, `by {owner}`, `suggested
by N people`, claimed, unverified, `not Shopify-only`, external ratings and
social links. Nothing was deleted. It stopped being in two places.

**The list view keeps them, and that is the point of having two views.** Cards
browse, rows compare: a row gives up the description to line the facts up in
sortable columns, so `not Shopify-only` and the external score belong there. Do
not "fix" the list to match the card.

**Free plan is part of the price line, never a badge.** `priceLine()` returns
the price untouched when it already says free, which is most of the catalogue
("Free, Pro $49/mo", "Free tier, then $49 / $149 / $349"), and completes the
sentence only where it does not: `From $49/mo` with `free: true` renders
"Free, then from $49/mo". A `dying` tool is left alone, because its price field
describes the wind-down and "Free, then winding down" is not a sentence anybody
meant to write. A badge repeating what the price already said was two elements
carrying one fact, and the badge was the one with a border around it.

**The rhythm is name, summary, price, footer.** One visual weight per line. The
footer is two rows, each with a left and a right and nothing in the middle:
rating and votes, which are both the community answering, then `Visit site` and
`Compare`, which are both things you do next.

**Adding anything to the card means arguing it helps somebody choose which one
to open.** That is the bar, and it is the bar because every one of the fifteen
was defensible on its own.

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

**A section gets its own file and its own shape.** `lib/newsletters.js` is the first one
and `lib/communities.js` the second, and neither is the tool shape with different words
in it. A community is judged on who is actually in the room, which is why it carries
`platform`, `entry` and `audience` and no `cat`: the fee is rarely the barrier, and most
Shopify community is merchant or agency shaped, so an app vendor reading the label can
waste a month finding that out. A tool is judged on
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

- For **tools**, Shopify-exclusive is a *boundary*. A general tool is listed only when it
  clears the higher bar in invariant 19, and Wappalyzer and the mobile ASO platforms were
  removed on purpose and stay out. PartnerStack and BuiltWith were each let back in on an
  explicit decision, which is the process working rather than the rule weakening.
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

**`verified` is an editorial record, and it never renders publicly.** `true`
means the vendor's own site was read directly; anything sourced from search
results or a third party is `false`.

It used to render an "unverified" badge on every public view. It reports our
research process, which is not a fact about the product and not something a
reader can act on, and next to a competitor carrying no badge it read as a mark
against the tool. Same failure as "None found" on external ratings: a note about
how much work we have done, phrased as a verdict on somebody else.

It shows in exactly one place, the **Needs verifying** panel on the Catalogue
tab, which lists every *published* entry still at `false`. Drafts are excluded:
they are unverified nearly by definition, they are already listed one panel up,
and including them would bury the entries that are live and thin. Do not put it
back on a card, a row, the compare table, the footer or `llms.txt`.

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
| `monitor_digest` | yes, and only when something changed | nothing |

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

## Definition of done

Work is not done until it is on `origin/main`. Every task ends the same way:
build, commit, push, then verify against `origin/main` and the live site, and
report the deployed commit hash.

A clean local tree is not the finish line. The work exists for people who are not
sitting at this machine, and until it is pushed none of them can reach it,
including Vercel, which builds what the remote has and nothing else.

**A "pushed" claim has to be backed by `git log origin/main`**, or
`git ls-remote origin refs/heads/main` for the remote's own answer. The local
branch is not evidence, and neither is `git push` printing a range: that says
what was sent, not what the remote kept. Fetch, compare the two hashes, then
report one.

This is not hypothetical. A session reported its work complete with 15 modified
files sitting uncommitted, so Vercel had nothing to build and the site served
none of it. The work was finished in every sense except the one that counts.

**Where the live check cannot close the loop, say so rather than implying it
did.** A draft changes nothing a visitor can reach, so an unchanged site is both
the correct outcome and exactly what a deploy that never ran would look like; the
two are indistinguishable from outside, and the response headers carry no commit
sha. Report the hash on `origin/main`, report that the site is unchanged and
serving, and name the gap. Closing it takes the Vercel dashboard or `/admin`, not
a more confident sentence.

The build gate below is the first step of this, not a separate ritual. A push of
something that does not compile is worse than no push, because the previous
deployment was working.

## Before committing

```
npm run build      # must compile

node scripts/feed-test.mjs           # the feed library and its field contract
node scripts/announce-test.mjs       # the draft prompt, the em-dash scrub, the voice examples
node scripts/feed-independence.mjs   # publishing does not apply, applying does not publish
node scripts/discovery-promote.mjs   # a lead becomes one suggestion, and never a public one
node scripts/ownership-test.mjs      # vacuous owners: merge, render and sweep
node scripts/updates-count.mjs       # "new since your last visit", including the first visit
node scripts/discovery-urls.mjs      # anchor capture against real markup, and the dismissed set
node scripts/discovery-settled.mjs   # one item, one place: listed, queued or declined
node scripts/housekeeping-test.mjs   # the reset clears four things and protects the snapshots
node scripts/interest-test.mjs       # needs a running server
node scripts/validate-jsonld.mjs     # needs a running server
node scripts/admin-smoke.mjs <cookie>
```

The four library tests need no server and no keys: they call the route handlers
directly with a plain `Request` and shim `lib/` into a temp directory, which is
how they run against the in-memory store rather than production Redis. Two of
them exist because reading the code proved the claim once and a test proves it
every time: that publishing to the feed never writes a listing, and that a
promoted discovery lead cannot escape as a community suggestion.

Then check the homepage HTML actually contains tool names, not just a loading state.

**Check `/admin` with something in the inbox, on every tab.** Run
`node scripts/admin-smoke.mjs <session cookie>`. A 200 from an empty `/admin`
proves almost nothing: `Inbox` returns early when there is nothing waiting, so
the entire populated branch is unrendered, and only the default tab
server-renders at all. That is exactly how a `ReferenceError: discovery is not
defined` shipped with a clean build and a passing curl.

**Every collection prop declares its own empty default**, in the signature, and
`app/admin/page.js` loads its sources from one named list of
`{ key, load, empty }`. It used to be three parallel lists kept in lockstep by
counting positions, which is a thing that works until somebody appends to two of
them. Most of these Redis keys postdate the first deployment, so a missing key
is the normal early state and every panel has to render its empty case rather
than throw. Do not guard an undefined variable at the point of use: an
undefined prop is a wiring bug, and a `|| []` in the render hides it.

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
  about Shopify. **Three are listed on that basis, and each names the thing the native
  tools cannot do.** PartnerStack, because an app vendor selling to agencies and
  enterprise partners at scale outgrows a link tracker. BuiltWith, because a
  Shopify-only database structurally cannot show you a merchant who is not on Shopify
  yet, which is the migration conversation. etailinsights, because its contacts are
  attached to retail brands rather than to storefronts, which is the only thing it has
  that Store Leads and StoreCensus do not.

  **etailinsights is the weakest of the three and was added on request rather than on
  the bar.** Its own `watch` says what is wrong with it: no published price, an order
  form, and no demonstrable detection of individual Shopify apps, which is the question
  this category exists to answer. If a general tool is ever removed for not earning its
  row, it is this one. Recorded here rather than left to be rediscovered, because a
  listing added on request and a listing added on the bar look identical six months
  later.

  Wappalyzer and the mobile ASO platforms are still out. **Adding one is a decision to
  check first, and the answer has three times been yes, which is not the same as the bar
  moving.** The test is whether the row names a job nothing native does, not whether the
  tool is good.
- Add affiliate links or sponsored placement. The footer promises neither exists.
- Fabricate a social profile URL. Only link profiles published on the vendor's own site;
  otherwise leave `social` empty, and it renders nothing at all.
- Loosen `MODERATE_SUGGESTIONS`. Public unmoderated submission is the first thing spammed.
