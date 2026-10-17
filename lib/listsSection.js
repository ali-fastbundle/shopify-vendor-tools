/*
 * Whether the published-lists section has anything to show, for the site nav.
 *
 * A section enters the nav when it has content, not when its code ships, and
 * for lists the content lives in the store, not a file. So this is the one
 * store read the frame makes, cached for five minutes and dropped at once by
 * listsChanged() whenever a list is published, edited, reviewed or hidden. The
 * frame's other counts come from the catalogue files (lib/frameData.js).
 *
 * "Worth showing" is the index's own rule: public, not hidden, not empty, and
 * read by an editor (isIndexable). A list nobody has looked at yet is live at
 * its address but does not open a section.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { readLists, isIndexable } from "./lists";

export const LISTS_TAG = "lists-section";

export const publishedListCount = unstable_cache(
  async () => Object.values((await readLists()) || {}).filter(isIndexable).length,
  ["lists-section-count"],
  { revalidate: 300, tags: [LISTS_TAG] },
);

/** Call after any write that can change what the section shows. */
export function listsChanged() {
  try { revalidateTag(LISTS_TAG); } catch { /* outside a request: the five minutes cover it */ }
}
