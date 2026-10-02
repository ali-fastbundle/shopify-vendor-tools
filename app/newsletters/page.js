import { mergedNewsletters } from "@/lib/listings";
import { LAST_UPDATED } from "@/lib/tools";
import { SITE, NEWSLETTERS_URL } from "@/lib/seo";
import Newsletters from "@/components/Newsletters";

export const dynamic = "force-dynamic";

const title = "Newsletters for Shopify app vendors | watchfor.tools";
const description =
  "Newsletters worth an app vendor's time: a couple about the Shopify platform itself, the rest merchant-side media read sideways for demand signal. Each with the honest caveat.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/newsletters" },
  openGraph: { title, description, type: "website", url: NEWSLETTERS_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

export default async function Page() {
  const newsletters = await mergedNewsletters();
  return <Newsletters newsletters={newsletters} lastUpdated={LAST_UPDATED} />;
}
