/*
 * What the site frame's sidebar shows that the layout can know without a store
 * read: a count per section and the categories in order. Its own module so the
 * layout stays free of catalogue arithmetic (scripts/og-test.mjs holds that the
 * layout builds no share-image version of its own from tool counts).
 */
import { TOOLS, categoriesByCount, isInCat } from "./tools";
import { NEWSLETTERS } from "./newsletters";
import { EVENTS, placeEvent } from "./events";
import { POSTS } from "./blog";

/*
 * The sidebar's counts and categories, from the catalogue files: no store read
 * on every page. Entries published from the admin queue live in Redis and are
 * counted in the directory's own heading, not here. Events counts what is
 * still ahead, since past events stay on the timeline.
 */
export function frameData() {
  /* Dated and still ahead. An inferred date is a guess, so it is not counted. */
  const upcoming = EVENTS.filter((e) => {
    try { const at = placeEvent(e); return at && at.status !== "past" && at.mode !== "unscheduled" && at.mode !== "inferred"; } catch { return false; }
  }).length;
  return {
    counts: { directory: TOOLS.length, newsletters: NEWSLETTERS.length, events: upcoming, blog: POSTS.length },
    categories: categoriesByCount(TOOLS).map((c) => ({
      id: c.id, label: c.label, color: c.color, n: TOOLS.filter((t) => isInCat(t, c.id)).length,
    })),
  };
}

