import { mergedTools } from "@/lib/listings";
import ListsManager from "@/components/ListsManager";

export const dynamic = "force-dynamic";

/* Your saved lists. Private, so never indexed. */
export const metadata = {
  title: "Your lists | watchfor.tools",
  robots: { index: false, follow: false },
  alternates: { canonical: "/lists" },
};

export default async function Page() {
  const tools = (await mergedTools()).map((t) => ({ id: t.id, name: t.name }));
  return <ListsManager tools={tools} />;
}
