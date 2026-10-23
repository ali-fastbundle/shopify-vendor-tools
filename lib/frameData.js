/*
 * What the site frame's sidebar shows that the layout can know without a store
 * read: a count per section and the categories in order. Its own module so the
 * layout stays free of catalogue arithmetic (scripts/og-test.mjs holds that the
 * layout builds no share-image version of its own from tool counts).
 */
import { TOOLS, findCat } from "./tools";
import { countTools } from "./toolCount";
import { NEWSLETTERS } from "./newsletters";
import { EVENTS, placeEvent } from "./events";
import { POSTS } from "./blog";
import { allOwners } from "./ownerIndex";

/*
 * The sidebar's counts and categories. The tool figures are `tools`, the
 * public count from lib/toolCount.js that every other surface states, read
 * once per five minutes by the layout (lib/toolCountStore.js). Without it
 * (the store is down) they fall back to counting the file, through the same
 * function. Events counts what is still ahead, since past events stay on the
 * timeline.
 */
export function frameData(tools = countTools(TOOLS)) {
  /* Dated and still ahead. An inferred date is a guess, so it is not counted. */
  const upcoming = EVENTS.filter((e) => {
    try { const at = placeEvent(e); return at && at.status !== "past" && at.mode !== "unscheduled" && at.mode !== "inferred"; } catch { return false; }
  }).length;
  return {
    counts: { directory: tools.total, newsletters: NEWSLETTERS.length, events: upcoming, owners: allOwners({ tools: TOOLS, newsletters: NEWSLETTERS, events: EVENTS }).length, blog: POSTS.length },
    categories: tools.order.map(findCat).map((c) => ({
      id: c.id, label: c.label, color: c.color, n: tools.byCategory[c.id],
    })),
  };
}

