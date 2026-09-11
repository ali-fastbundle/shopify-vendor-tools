# The Shopify app vendor's toolkit

A public, community-rated directory of tools built specifically for people who build
Shopify apps. 21 tools across 7 categories, with a problem-matcher, side-by-side
comparison, ratings, reviews, likes and open suggestions.

Next.js 14 (App Router) · Upstash Redis · Anthropic API · deploys to Vercel.

---

## What runs where

| Piece | Where it lives |
|---|---|
| Catalogue, categories, palette | `lib/tools.js` — edit tools here, nothing else |
| UI | `components/Directory.jsx` (single client component) |
| Community data | `app/api/data` (read), `app/api/vote`, `app/api/review`, `app/api/suggest` |
| Problem matcher | `app/api/match` — holds the API keys server-side, Anthropic and/or OpenAI |
| Storage | `lib/store.js` — Upstash Redis, with an in-memory fallback for local dev |
| Spam control | `lib/ratelimit.js` — per-IP sliding window |

**API keys never reach the browser.** The matcher posts to `/api/match`, which calls
the model provider server-side. Never move that call back into the component.

## Local

```bash
npm install
cp .env.example .env.local     # fill in what you have
npm run dev                    # http://localhost:3000
```

With no env vars it still runs. The matcher falls back to local keyword scoring and
storage falls back to memory, which resets on every restart. Fine for development,
not fine for a shared URL.

| Variable | Effect if missing |
|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Matcher drops to local keyword scoring |
| `MATCH_PROVIDER` | Anthropic is tried first |
| `UPSTASH_REDIS_REST_*` or `KV_REST_API_*` | Votes and reviews reset on every cold start |
| `MODERATE_SUGGESTIONS` | Suggestions are public the instant they are submitted |

## Deploy

```bash
git init && git add -A && git commit -m "Shopify app vendor tooling directory"
gh repo create shopify-vendor-tools --public --source=. --push
```

Then in Vercel: **Add New → Project → import the repo**. Framework detects as Next.js,
no build settings to change.

Before you share the URL, two things in the Vercel dashboard. Full walkthrough below.

## Creating the Redis store

Vercel KV no longer exists as its own product. Vercel retired it in December 2024 and
moved existing stores to Upstash. Redis now comes through the Marketplace, so the
steps are:

1. Open your project in the Vercel dashboard and go to the **Storage** tab.
2. Click **Create Database**. Under storage partners, pick a Redis provider.
   **Upstash** is the default choice and the one this project was written against;
   Redis Cloud also works.
3. Choose the free tier, pick the region closest to your audience, name it something
   like `shopify-vendor-tools`, and create it.
4. Wait for the status to move from `Initializing` to `Available`. Refresh if it
   looks stuck.
5. **Connect it to your project.** You are usually prompted. If not, find the store in
   the Storage tab and connect it manually. This is the step people skip, and without
   it the variables never reach your deployment.
6. Check **Settings → Environment Variables**. You should now see either
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` depending on the provider. `lib/store.js` accepts both, so
   either is fine. You do not need to add anything by hand.
7. **Redeploy.** Deployments/… → the latest one → Redeploy. Environment variables are
   only picked up by a fresh build.

To confirm it worked, open `/api/data` on your live URL. It should return JSON. Then
like a tool on the site, hard-refresh, and check the like survived. If it did not, the
store is not connected and you are still on the in-memory fallback.

Pull the variables locally with `vercel env pull .env.local` if you want dev and
production sharing one store. Be aware that means local testing writes real data.

## Adding the API keys

**Settings → Environment Variables.** Add `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`, or
both. With both set, one is tried if the other fails, so a provider outage does not
take the matcher down. `MATCH_PROVIDER=openai` flips which goes first; leave it unset
to prefer Anthropic.

Add them to Production, Preview and Development, then redeploy.

With neither key the matcher returns 503 and the UI silently falls back to local
keyword matching. The box still works, it is just blunter. Nothing visibly breaks,
which is exactly why it is worth checking rather than assuming.

## Accounts and claiming a listing

Anyone can sign in with an email address: no password, no OAuth app to register.
They receive a one-time link that expires in 15 minutes and exchanges for a 30-day
signed cookie. The cookie holds the email address and nothing else.

**Signing in proves nothing about owning a tool.** Claiming is a separate step, proved
by control of the tool's domain, in one of two ways:

1. Sign in with an email at that domain (`evan@applora.ai` claiming Applora). Verified
   instantly.
2. Publish the string `svt-verify=TOKEN` on the tool's site, either at
   `/.well-known/svt-verify.txt` or as `<meta name="svt-verify" content="...">` on the
   homepage. The server fetches and checks it.

Once verified, the vendor can edit the one-line summary, the description, pricing, the
free-plan flag, the site URL and their LinkedIn / X / GitHub links.

**They cannot edit the "watch for" note, the category, the verified flag, ratings or
reviews.** That is the whole point of the directory, and it is enforced in
`lib/listings.js` server-side, not just hidden in the UI — an owner POSTing `watch`
directly gets a 200 and their caveat unchanged.

Edits never mutate `lib/tools.js`. They are stored as overrides in Redis and merged on
read, so the editorial original is always recoverable: delete the tool's key from
`svt:overrides` and the listing reverts. Claimed listings carry a "claimed" badge and a
line saying the vendor maintains that copy, so readers know whose voice they are reading.

`ADMIN_EMAILS` can edit any listing and override a claim.

### Setting it up

| Variable | Effect if missing |
|---|---|
| `AUTH_SECRET` | Sign-in is disabled entirely; the site stays read-only |
| `RESEND_API_KEY` | Production refuses to send links; locally they print to the log |
| `ADMIN_EMAILS` | Nobody can override a claim |

Generate the secret with `openssl rand -base64 32`. For Resend, verify a sending domain
and set `EMAIL_FROM` to an address on it, or leave the default `onboarding@resend.dev`
which works for testing but will land in spam.

## Moderation

`MODERATE_SUGGESTIONS=true` stores new suggestions with `approved: false`, so they are
kept but never served by `/api/data`. To approve one, set its `approved` field to
`true` in the `svt:suggestions` key in Redis.

Leave the flag unset and every suggestion is public the moment it is submitted. On a
public directory that is the first thing spammed, so decide deliberately.

Rate limits as shipped: 60 votes/min, 5 reviews/10 min, 3 suggestions/hour,
20 matcher calls/hour, all per IP. Adjust in the route files.

## Editing the directory

Everything is in `lib/tools.js`. A tool looks like:

```js
{
  id: "applora",                    // stable, used as the storage key for votes
  name: "Applora",
  cat: "data",                      // must match a CATEGORIES id
  domain: "applora.ai",             // drives the favicon logo
  url: "https://applora.ai",
  price: "Free, Pro $49/mo",
  free: true,                       // drives the "Free plan" filter and compare row
  verified: true,                   // false renders an "unverified" badge
  tags: ["mcp", "ai", "dataset"],   // fuels the fallback matcher — keep these real
  one: "One line shown on the card.",
  note: "The research paragraph.",
  watch: "The caveat. This is the row people actually read in the comparison.",
  social: { li: "...", x: "...", gh: "..." },   // omit keys you cannot verify
}
```

Never change an `id` after launch. Votes and reviews are keyed on it and would orphan.

## Known limits

- **Logos** are Google's favicon service against each vendor's real domain, with a
  coloured lettermark fallback. Real marks, favicon resolution. Swap to hosted SVGs
  in `components/Directory.jsx` → `Logo` if you want them sharp.
- **Social profiles** cover 7 of 21 tools. Only profiles published on the vendor's own
  site are linked; the rest render "no public profile" rather than a guessed URL.
- **Votes are per browser.** The `svt:mine` localStorage key stops the same person
  double-voting in one browser. It stops nothing else.
- **Concurrent writes are last-write-wins.** Two reviews posted in the same instant can
  drop one. Fine at directory traffic, worth revisiting if it takes off.
