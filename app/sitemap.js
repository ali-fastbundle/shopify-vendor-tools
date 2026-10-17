import { mergedTools, mergedNewsletters } from "@/lib/listings";
import { LAST_UPDATED_ISO, CATEGORIES, isInCat } from "@/lib/tools";
import { SITE } from "@/lib/seo";
import { feedEntries } from "@/lib/feed";
import { EVENTS } from "@/lib/events";
import { POSTS } from "@/lib/blog";
import { ownersWithPages } from "@/lib/ownerIndex";
import { rivalPairs, alternativesOf, pairSlug, confirmed } from "@/lib/rivals";
import { read } from "@/lib/store";
import { isIndexable } from "@/lib/lists";

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
  const [tools, newsletters, changes, discovery, lists] = await Promise.all([
    mergedTools(), mergedNewsletters(), feedEntries({ limit: 1 }), read("svt:discovery", {}), read("svt:lists", {}),
  ]);

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
    {
      url: `${SITE}/categories`,
      lastModified: new Date(LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    /*
     * One entry per category, dated from the newest tool in it rather than
     * from the build. A category whose tools have not moved in six months
     * should tell a crawler that, and an empty one is still a real page that
     * answers "is there anything here" with a sentence saying there is not.
     */
    ...CATEGORIES.map((c) => {
      const inIt = tools.filter((t) => isInCat(t, c.id));
      const newest = inIt.reduce(
        (max, t) => (t.updated && t.updated > max ? t.updated : max), "");
      return {
        url: `${SITE}/categories/${c.id}`,
        lastModified: new Date(newest || LAST_UPDATED_ISO || Date.now()),
        changeFrequency: "monthly",
        priority: 0.7,
      };
    }),
    ...tools.map((t) => ({
      url: `${SITE}/tools/${t.id}`,
      lastModified: new Date(t.updated || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "monthly",
      priority: 0.8,
    })),
    {
      url: `${SITE}/newsletters`,
      lastModified: new Date(
        newsletters.reduce((max, n) => (n.updated && n.updated > max ? n.updated : max), "")
        || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...newsletters.map((n) => ({
      url: `${SITE}/newsletters/${n.id}`,
      lastModified: new Date(n.updated || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "monthly",
      priority: 0.6,
    })),
    {
      url: `${SITE}/events`,
      lastModified: new Date(
        EVENTS.reduce((max, e) => (e.updated && e.updated > max ? e.updated : max), "")
        || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...EVENTS.map((e) => ({
      url: `${SITE}/events/${e.id}`,
      lastModified: new Date(e.updated || LAST_UPDATED_ISO || Date.now()),
      changeFrequency: "monthly",
      priority: 0.5,
    })),
    ...(POSTS.length ? [{
      url: `${SITE}/blog`,
      lastModified: new Date(POSTS.reduce((max, p) => ((p.updated || p.date) > max ? (p.updated || p.date) : max), "")),
      changeFrequency: "weekly",
      priority: 0.6,
    }] : []),
    ...POSTS.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: new Date(p.updated || p.date),
      changeFrequency: "monthly",
      priority: 0.7,
    })),
    /* Published lists an admin marked fine (lib/lists.js), and the section's
       index once there is one to list. */
    ...(Object.values(lists || {}).some(isIndexable) ? [{
      url: `${SITE}/lists`,
      lastModified: new Date(Object.values(lists).filter(isIndexable).reduce((m, l) => (l.updatedAt > m ? l.updatedAt : m), "")),
      changeFrequency: "weekly", priority: 0.5,
    }] : []),
    ...Object.values(lists || {}).filter(isIndexable).map((l) => ({
      url: `${SITE}/lists/${l.id}`, lastModified: new Date(l.updatedAt), changeFrequency: "monthly", priority: 0.3,
    })),
    /* Alternatives and head-to-heads (lib/rivals.js), listed only once they
       carry confirmed details: before that the pages are noindex, and a
       sitemap entry for a noindex page is a contradiction. */
    ...(() => {
      const pairs = rivalPairs(tools, discovery || {});
      const done = (t) => confirmed(t);
      const out = [];
      for (const t of tools) {
        const alts = alternativesOf(t, tools, pairs);
        if (done(t) && alts.some((x) => done(x.tool))) {
          out.push({ url: `${SITE}/alternatives/${t.id}`, lastModified: new Date(t.structured.confirmedAt), changeFrequency: "monthly", priority: 0.5 });
        }
      }
      for (const p of pairs.values()) {
        const [a, b] = [p.a, p.b].map((id) => tools.find((x) => x.id === id));
        if (done(a) && done(b)) {
          const at = [a.structured.confirmedAt, b.structured.confirmedAt].sort().at(-1);
          out.push({ url: `${SITE}/compare/${pairSlug(a.id, b.id)}`, lastModified: new Date(at), changeFrequency: "monthly", priority: 0.4 });
        }
      }
      return out;
    })(),
    /* Owners with two or more listings (lib/owners.js), each dated by the
       newest of its entries, and the index dated by the newest of them. */
    ...(() => {
      const owners = ownersWithPages({ tools, newsletters, events: EVENTS });
      const byId = (m) => [...tools, ...newsletters, ...EVENTS].find((x) => x.id === m.id)?.updated || "";
      const newest = (o) => o.entries.map(byId).filter(Boolean).sort().at(-1) || LAST_UPDATED_ISO;
      if (!owners.length) return [];
      return [
        { url: `${SITE}/owners`, lastModified: new Date(owners.map(newest).sort().at(-1)), changeFrequency: "monthly", priority: 0.4 },
        ...owners.map((o) => ({ url: `${SITE}/owners/${o.id}`, lastModified: new Date(newest(o)), changeFrequency: "monthly", priority: 0.5 })),
      ];
    })(),
    { url: `${SITE}/about`, lastModified: new Date("2026-10-16"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/privacy`, lastModified: new Date("2026-10-10"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
