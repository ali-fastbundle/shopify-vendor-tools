import { EVENTS, agenda, placed, todayISO } from "@/lib/events";
import { LAST_UPDATED } from "@/lib/tools";
import { SITE, EVENTS_URL } from "@/lib/seo";
import Events from "@/components/Events";

/* Dynamic so past, imminent and upcoming are worked out on the day the page is
   read, never on the day it was built. */
export const dynamic = "force-dynamic";

const title = "Events for Shopify app vendors | watchfor.tools";
const description =
  "Conferences and meetups worth an app vendor's time, with who is actually in the room. Dates checked against each organiser's site, and nothing unconfirmed shown as scheduled.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/events" },
  openGraph: { title, description, type: "website", url: EVENTS_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

export default function Page() {
  const today = todayISO();
  const plan = agenda(EVENTS, today);
  const upcoming = plan.months.flatMap((g) => g.items).filter((e) => e.at.mode === "exact");

  const graph = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${EVENTS_URL}#collection`,
    url: EVENTS_URL,
    name: "Events",
    description,
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: upcoming.length,
      itemListElement: upcoming.map((e, i) => ({
        "@type": "ListItem", position: i + 1, url: `${SITE}/events/${e.id}`, name: e.name,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
      <Events plan={plan} events={placed(EVENTS, today)} lastUpdated={LAST_UPDATED} />
    </>
  );
}
