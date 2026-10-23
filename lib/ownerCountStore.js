/*
 * How many owners the Owners page lists, for the sidebar. Server only.
 *
 * The page counts allOwners over the merged lists (overrides and entries
 * published from the queue included), so this counts exactly that, through the
 * same function, rather than a second sum that could disagree (invariant 53's
 * lesson). Cached for five minutes and keyed on the build, like the tool
 * count, and dropped with it when a queue entry is published or unpublished.
 */
import { unstable_cache } from "next/cache";
import { mergedTools, mergedNewsletters, mergedEvents } from "./listings";
import { allOwners } from "./ownerIndex";
import { TOOLS_TAG } from "./toolCountStore";

export const ownerCount = unstable_cache(
  async () => {
    const [tools, newsletters, events] = await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents()]);
    return allOwners({ tools, newsletters, events }).length;
  },
  ["owner-count", process.env.VERCEL_GIT_COMMIT_SHA || "local"],
  { revalidate: 300, tags: [TOOLS_TAG] },
);
