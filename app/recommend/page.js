import { C, S, F, TRACK, LAST_UPDATED } from "@/lib/tools";
import SiteNav from "@/components/SiteNav";
import Recommender from "@/components/Recommender";
import FooterLinks from "@/components/FooterLinks";
import { withShareImage } from "@/lib/ogCard";

const title = "Growth picks for your app | watchfor.tools";
const description =
  "Give the listing URL, budget, stage and goal for your Shopify app and get three tools from the directory, each with a reason tied to your situation.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/recommend" },
  openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
  /* A form behind a sign-in: nothing here for a search result to show. */
  robots: { index: false, follow: true },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default function Page() {
  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <SiteNav current="recommend" />
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            Three tools for your app
          </h1>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "60ch" }}>
            Give us your listing and what you are trying to do, and get three tools from the
            directory with a reason for each that fits your app, not a generic list.
          </p>
        </header>

        <Recommender />

        <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"], borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
          <FooterLinks />
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch", margin: 0 }}>
            <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory for
            Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify.
            No affiliate links and no paid placement. Directory last updated {LAST_UPDATED}.
          </p>
        </footer>
      </div>
    </main>
  );
}
