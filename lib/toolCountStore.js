/*
 * The public tool count read from the store, cached. Server only.
 *
 * The site frame shows the count on every page, and the queue half of the
 * catalogue lives in Redis, so this is cached for five minutes like the lists
 * section count (lib/listsSection.js), and dropped at once by toolsChanged()
 * whenever an entry is published from the queue or unpublished. The counting
 * itself is countTools in lib/toolCount.js; this only decides what it counts.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { catalogueTools } from "./entries";
import { countTools } from "./toolCount";

export const TOOLS_TAG = "tool-count";

export const toolCounts = unstable_cache(
  async () => countTools(await catalogueTools()),
  /* Keyed on the build too: the file half changes only with a deploy (a hand
     edit, or Publish on /admin committing to the file), and Next's data cache
     outlives a deploy, so without this the old count could stay up to five
     minutes after the new file is live. */
  ["tool-counts", process.env.VERCEL_GIT_COMMIT_SHA || "local"],
  { revalidate: 300, tags: [TOOLS_TAG] },
);

/** Call after any write that adds or removes a published tool. */
export function toolsChanged() {
  try { revalidateTag(TOOLS_TAG); } catch { /* outside a request: the five minutes cover it */ }
}
