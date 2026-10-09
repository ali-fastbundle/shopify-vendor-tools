/*
 * What the share card says, in one place, and the version derived from it.
 *
 * The card is generated from data, so its URL has to change when the data it
 * draws changes, or messengers keep showing the old card against the old URL
 * for days. The version used to be `${TOOLS.length}-${LAST_UPDATED_ISO}` in
 * app/layout.js while the image counted catalogueTools(), which includes
 * entries published from the admin queue in Redis. Two different counts: the
 * live card read "46 tools" behind a URL saying 44, and every queue publish
 * widened the gap. The same split had already been fixed once on the image
 * side alone, which is why it came back.
 *
 * So both read `ogFacts()`: the route draws exactly these facts, and the
 * version is a hash of exactly these facts. The URL moves when the picture
 * would and not otherwise, so a scraper's cache is only invalidated when
 * there is something new to show. /og also sends the version it drew as
 * `x-og-version`, so the two can be compared from outside with curl.
 *
 * What this does not cover is a change to the card's layout in code, which
 * moves no data. That ships with a deploy, and Next's own route hash does not
 * apply to a route we version ourselves, so a redesign should change something
 * the card draws or be followed by a manual cache refresh on the platforms.
 */
import { createHash } from "crypto";
import { CATEGORIES, HEADLINE } from "./tools";
import { catalogueTools } from "./entries";

/** Everything the card renders that comes from data. */
export async function ogFacts() {
  return {
    toolCount: (await catalogueTools()).length,
    categories: CATEGORIES.map((c) => c.color),
    headline: HEADLINE,
  };
}

/** A short, stable hash of those facts. */
export const ogVersion = (facts) =>
  createHash("sha1").update(JSON.stringify(facts)).digest("base64url").slice(0, 10);
