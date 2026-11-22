/*
 * Cache-Control values for responses the CDN should keep. Pure.
 *
 * Vercel's CDN caches a function response only when it carries s-maxage (or a
 * CDN-Cache-Control header). A bare max-age is for the browser, so /og, the
 * feeds, llms.txt and the sitemap were rendered again on every request even
 * though each said "public, max-age=...". These add the CDN half.
 */

/* A versioned image whose ?v= matches what it drew: the URL changes whenever
   the picture would, so it can be kept for a year. */
export const IMMUTABLE = "public, immutable, no-transform, max-age=31536000, s-maxage=31536000";

/* Any other ?v= (a stale share, a typo, a cache-buster) gets the current
   picture for ten minutes, so a stranger's query string cannot pin an image
   under their own key for a year. */
export const SHORT_IMAGE = "public, no-transform, max-age=600, s-maxage=600";

/* Text that changes when the catalogue or the feed does. The CDN keeps it for
   `edge` seconds and serves the old copy for a day while it fetches the next,
   so a crawler never waits on a render. */
export const text = (edge, browser = 0) =>
  `public, max-age=${browser}, s-maxage=${edge}, stale-while-revalidate=86400`;

/** The header for an image route, given the version asked for and drawn. */
export const imageCache = (asked, drawn) => (asked && asked === drawn ? IMMUTABLE : SHORT_IMAGE);
