import { withShareImage } from "@/lib/ogCard";
import { mergedTools, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { ownersWithPages } from "@/lib/ownerIndex";
import { ownersIndexGraph } from "@/lib/seo";
import { OwnerIndex } from "@/components/Owners";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

const title = "Owners | watchfor.tools";
const description = "Companies and people behind more than one listing on watchfor.tools, across tools, newsletters and events.";

const baseMetadata = {
  title, description,
  alternates: { canonical: "/owners" },
  openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
};

export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const [tools, newsletters, events] = await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents()]);
  const owners = ownersWithPages({ tools, newsletters, events })
    .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));
  return (
    <>
      <JsonLd data={ownersIndexGraph(owners)} />
      <OwnerIndex owners={owners} />
    </>
  );
}
