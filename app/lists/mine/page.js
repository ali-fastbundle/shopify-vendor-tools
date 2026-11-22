import { mergedTools } from "@/lib/listings";
import ListsManager from "@/components/ListsManager";
import { pageTools } from "@/lib/pageData";

/* Cached, not rendered per request (CLAUDE.md, Page caching and CPU). The
   data and the share image version come through tagged reads, so a write to
   any store key this page shows re-renders it at once; the hour is a backstop. */
export const revalidate = 3600;

/*
 * Your saved lists: the working tool, private, never indexed. Published lists,
 * the ones other people read, are the section at /lists.
 */
export const metadata = {
  title: "Your lists | watchfor.tools",
  robots: { index: false, follow: false },
  alternates: { canonical: "/lists/mine" },
};

export default async function Page() {
  const tools = (await pageTools()).map((t) => ({ id: t.id, name: t.name }));
  return <ListsManager tools={tools} />;
}
