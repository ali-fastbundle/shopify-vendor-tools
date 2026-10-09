import { agenda, placed, todayISO } from "@/lib/events";
import { mergedEvents } from "@/lib/listings";
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

export default async function Page() {
  const today = todayISO();
  // Merged, so an organiser's edit to the summary or link shows here too.
  const EVENTS = await mergedEvents();
  const plan = agenda(EVENTS, today);
  const upcoming = plan.timeline.flatMap((g) => g.items)
    .filter((e) => e.at.status !== "past" && e.at.mode === "exact");

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
