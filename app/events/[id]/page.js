import { notFound } from "next/navigation";
import { placed, todayISO } from "@/lib/events";
import { mergedEvents } from "@/lib/listings";
import { read, KEYS } from "@/lib/store";
import { publicReviews } from "@/lib/reviews";
import { LAST_UPDATED } from "@/lib/tools";
import { eventUrl, eventDescription, eventGraph } from "@/lib/seo";
import EventPage from "@/components/EventPage";

export const dynamic = "force-dynamic";

/*
 * One event at its own URL, server-rendered and complete without JavaScript,
 * the same contract as /tools/[id]. The index opens the same content in a
 * modal and pushes this address, so what is in the bar is always a page that
 * exists.
 */
async function load(id) {
  const today = todayISO();
  const [events, stored] = await Promise.all([mergedEvents(), read(KEYS.reviews, {})]);
  const all = placed(events, today);
  const e = all.find((x) => x.id === id);
  return e ? { e, all, today, reviews: publicReviews(stored)[id] || [] } : null;
}

export async function generateMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools" };
  const { e } = found;
  const title = `${e.name} | watchfor.tools events`;
  const description = eventDescription(e);
  return {
    title,
    description,
    alternates: { canonical: `/events/${e.id}` },
    openGraph: { title, description, type: "article", url: eventUrl(e.id), siteName: "watchfor.tools" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { e, all, today, reviews } = found;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventGraph(e)) }} />
      <EventPage e={e} all={all} today={today} reviews={reviews} lastUpdated={LAST_UPDATED} />
    </>
  );
}
