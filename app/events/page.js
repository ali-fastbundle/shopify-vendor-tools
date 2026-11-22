import { withShareImage } from "@/lib/ogCard";
import { agenda, placed, todayISO } from "@/lib/events";
import { mergedEvents } from "@/lib/listings";
import { ownerContext } from "@/lib/ownerIndex";
import { LAST_UPDATED } from "@/lib/tools";
import { SITE, EVENTS_URL } from "@/lib/seo";
import Events from "@/components/Events";
import JsonLd from "@/components/JsonLd";
import SectionView from "@/components/SectionView";
import { pageEvents } from "@/lib/pageData";

/* Past, imminent and upcoming are worked out when the page renders
   (placeEvent), so it re-renders every hour: a day never goes stale by more
   than that, and a write to the catalogue re-renders it at once. */
export const revalidate = 3600;

const title = "Events for Shopify App Developers | watchfor.tools";
const description =
  "Conferences and meetups worth an app developer's time, with who is in the room. Dates checked against each organizer's site, and nothing unconfirmed shown as scheduled.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/events", types: { "text/markdown": [{ url: "/events.md", title: "Plain text for agents" }] } },
  openGraph: { title, description, type: "website", url: EVENTS_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const today = todayISO();
  // Merged, so an organizer's edit to the summary or link shows here too.
  const EVENTS = await pageEvents();
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
    isPartOf: { "@id": `${SITE}#website` },
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
      <SectionView id="events" />
      <JsonLd data={graph} />
      <Events plan={plan} events={placed(EVENTS, today).map((e) => ({ ...e, owner: ownerContext(e, "event", { events: EVENTS }) }))} lastUpdated={LAST_UPDATED} />
    </>
  );
}
