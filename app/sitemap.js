import { mergedTools } from "@/lib/listings";
import { LAST_UPDATED_ISO } from "@/lib/tools";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

/*
 * The homepage and every tool page.
 *
 * `lastModified` comes from each entry's own `updated`, not from the build
 * date. A sitemap that stamps everything with "today" on every deploy teaches
 * a crawler that the dates mean nothing, and it stops using them to decide
 * what to recheck. Falling back to the site-wide date only where an entry has
 * none.
 *
 * Built from mergedTools(), so anything published from the admin queue is in
 * here the moment it goes live, and drafts never are: mergedTools reads the
 * published list.
 */
export default async function sitemap() {
  const tools = await mergedTools();

  return [
    {
      url: SITE,
      lastModified: new Date(LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...tools.map((t) => ({
      url: `${SITE}/tools/${t.id}`,
      lastModified: new Date(t.updated || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "monthly",
      priority: 0.8,
    })),
  ];
}
