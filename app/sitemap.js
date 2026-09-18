import { mergedTools } from "@/lib/listings";
import { LAST_UPDATED_ISO } from "@/lib/tools";
import { SITE } from "@/lib/seo";
import { feedEntries } from "@/lib/feed";

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
  const [tools, changes] = await Promise.all([mergedTools(), feedEntries({ limit: 1 })]);

  return [
    {
      url: SITE,
      lastModified: new Date(LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      /* The page that actually moves. Its lastModified is the newest entry on
         it rather than the build date, so a crawler that checks it weekly is
         told the truth about whether there is anything new. */
      url: `${SITE}/changes`,
      lastModified: new Date(changes[0]?.at || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...tools.map((t) => ({
      url: `${SITE}/tools/${t.id}`,
      lastModified: new Date(t.updated || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "monthly",
      priority: 0.8,
    })),
  ];
}
