import { withShareImage } from "@/lib/ogCard";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, KEYS } from "@/lib/store";
import { mergedNewsletters, getClaims } from "@/lib/listings";
import { publicReviews } from "@/lib/reviews";
import { LAST_UPDATED } from "@/lib/tools";
import {
  newsletterUrl, newsletterDescription, newsletterGraph, relatedNewsletters,
  ratingOf, isForVendors,
} from "@/lib/seo";
import NewsletterPage from "@/components/NewsletterPage";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * One newsletter at its own URL, server-rendered and complete without
 * JavaScript, the same contract as /tools/[id]. The one interactive piece lives
 * in a client island (components/Engagement.jsx); everything a crawler reads is here.
 */
async function load(id) {
  const [newsletters, storedReviews, claims] = await Promise.all([
    mergedNewsletters(),
    read(KEYS.reviews, {}),
    getClaims(),
  ]);
  const n = newsletters.find((x) => x.id === id);
  if (!n) return null;
  return { n, newsletters, claims, reviews: publicReviews(storedReviews) };
}

async function baseMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools" };
  const { n } = found;
  const title = `${n.name} | watchfor.tools newsletters`;
  const description = newsletterDescription(n);
  return {
    title,
    description,
    alternates: { canonical: `/newsletters/${n.id}` },
    openGraph: {
      title, description, type: "article",
      url: newsletterUrl(n.id), siteName: "watchfor.tools",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { n, newsletters, reviews } = found;

  const related = relatedNewsletters(n, newsletters);
  const nReviews = reviews[n.id] || [];
  const session = sessionFrom({ cookies: cookies(), headers: headers() });

  return (
    <>
      <JsonLd data={newsletterGraph(n, reviews)} />
      <NewsletterPage
        newsletter={n}
        related={related}
        reviews={nReviews}
        rating={ratingOf(n.id, reviews)}
        forVendors={isForVendors(n)}
        session={session ? { email: session.email, admin: isAdmin(session.email) } : null}
        lastUpdated={LAST_UPDATED}
      />
    </>
  );
}

/* Wrapped so every page carries the one share card, versioned on what it
   draws (lib/ogCard.js), rather than each page writing its own. */
export async function generateMetadata(props) {
  return withShareImage(await baseMetadata(props));
}
