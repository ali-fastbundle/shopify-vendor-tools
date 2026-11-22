/*
 * Cached reads for public page renders. Server only.
 *
 * A tool page used to read and merge the whole catalogue (seven store keys),
 * every review, the Q&A, discovery and up to 1,000 feed rows on every request,
 * twice, once for its metadata and once for its body. Most requests are
 * crawlers, and the data changes a few times a day. So the pages read these
 * instead: each is cached in Next's data cache, tagged with the store keys it
 * reads (`storeTag` in lib/store.js), and dropped the moment any write touches
 * one of them, because the store clears the tag itself on every write.
 *
 * Only pages and GET routes use this file. A write route keeps calling
 * mergedTools(), read() and feedEntries() directly: Next applies a
 * revalidation after the request ends, so a cached read inside a
 * read-modify-write would hand back the value from before the write.
 *
 * The hour is a backstop for a write made outside a request (a script), not
 * the freshness rule. Keyed on the build too, because the file half of the
 * catalogue changes only with a deploy and the data cache outlives one.
 */
import * as React from "react";
import { read, KEYS, storeTag } from "./store";
import { mergedTools } from "./listings";
import { feedEntries } from "./feed";
import { publicReviews } from "./reviews";
import { readQA } from "./qa";

const BUILD = process.env.VERCEL_GIT_COMMIT_SHA || "local";
const HOUR = 3600;
const tags = (...keys) => keys.map(storeTag);

/*
 * Outside Next (the test scripts import these modules with plain node) there
 * is no data cache: "next/cache" does not resolve as an ES module and
 * unstable_cache throws without one, so the read happens directly. Both are
 * loaded lazily for that reason. Any other error is a real one and is thrown.
 */
const cache = typeof React.cache === "function" ? React.cache : (fn) => fn;

function cachedRead(fn, keyParts, opts) {
  let cached;
  return async () => {
    if (cached === undefined) {
      try { cached = (await import("next/cache")).unstable_cache(fn, keyParts, opts); }
      catch { cached = null; }
    }
    if (!cached) return fn();
    try { return await cached(); }
    catch (e) {
      if (/incrementalCache missing/.test(String(e?.message))) return fn();
      throw e;
    }
  };
}

/* The seven keys mergedTools() reads (lib/listings.js). Adding a read there
   means adding its key here and to CACHED_KEYS in lib/store.js. */
export const MERGED_KEYS = [
  "svt:entries", "svt:overrides", "svt:claims", "svt:interest",
  "svt:editoruse", "svt:structured", "svt:media",
];

const mergedCached = cachedRead(
  () => mergedTools(),
  ["page:merged-tools", BUILD],
  { revalidate: HOUR, tags: tags(...MERGED_KEYS) },
);

/* Public rows only (publicRow), so nothing private sits in the cache. One
   entry of 1,000 rows; callers slice. */
const feedCached = cachedRead(
  () => feedEntries({ limit: 1000 }),
  ["page:feed", BUILD],
  { revalidate: HOUR, tags: tags("svt:feed") },
);

/* Addresses stripped with no viewer, so the cached value is the same for
   everybody. A page that needs `mine` is a signed-in surface and reads fresh. */
const reviewsCached = cachedRead(
  async () => publicReviews(await read(KEYS.reviews, {})),
  ["page:reviews", BUILD],
  { revalidate: HOUR, tags: tags(KEYS.reviews) },
);

/* Raw Q&A, still to go through publicQA per tool, as the page always did. */
const qaCached = cachedRead(
  () => readQA(),
  ["page:qa", BUILD],
  { revalidate: HOUR, tags: tags("svt:qa") },
);

const discoveryCached = cachedRead(
  async () => (await read("svt:discovery", {})) || {},
  ["page:discovery", BUILD],
  { revalidate: HOUR, tags: tags("svt:discovery") },
);

/*
 * React cache() on top, so one request that asks twice (generateMetadata and
 * the page body, or a page and the share-card helper) pays once even on a
 * cold data cache.
 */
export const pageTools = cache(() => mergedCached());
export const pageFeed = cache(async (limit = 1000) => (await feedCached()).slice(0, limit));
export const pageReviews = cache(() => reviewsCached());
export const pageQA = cache(() => qaCached());
export const pageDiscovery = cache(() => discoveryCached());
