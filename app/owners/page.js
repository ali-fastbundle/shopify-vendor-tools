import { withShareImage } from "@/lib/ogCard";
import { mergedTools, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { allOwners } from "@/lib/ownerIndex";
import { ownersIndexGraph } from "@/lib/seo";
import { OwnerIndex } from "@/components/Owners";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

const title = "Owners | watchfor.tools";
const description = "The companies and people behind the tools, newsletters and events on watchfor.tools, with their sites and every listing each is behind.";

const baseMetadata = {
  title, description,
  alternates: { canonical: "/owners", types: { "text/markdown": [{ url: "/owners.md", title: "Plain text for agents" }] } },
  openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
};

export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const [tools, newsletters, events] = await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents()]);
  const owners = allOwners({ tools, newsletters, events });
  return (
    <>
      <JsonLd data={ownersIndexGraph(owners)} />
      <OwnerIndex owners={owners} />
    </>
  );
}
