import { C, S, F, TRACK, LAST_UPDATED } from "@/lib/tools";
import Recommender from "@/components/Recommender";
import { withShareImage } from "@/lib/ogCard";
import SectionView from "@/components/SectionView";

const title = "Growth picks for your app | watchfor.tools";
const description =
  "Five short parts about your Shopify app, one question at a time, and up to three tools from the directory, each tied to what you told us.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/recommend" },
  openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
  /* The whole flow is one page behind a sign-in, with nothing for a search
     result to show, so none of it is indexed. */
  robots: { index: false, follow: true },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default function Page() {
  return (
    <main style={{ background: C.bg, color: C.text, }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <SectionView id="recommend" />
        {/* The priming screens are the introduction, so the page heading is a
            label, not a second hero competing with them. */}
        <h1 style={{ fontSize: F.lg, fontWeight: 700, margin: `${S["2xl"]}px 0 0`, letterSpacing: TRACK.tight, color: C.muted }}>
          Growth picks for your app
        </h1>

        <Recommender />

      </div>
    </main>
  );
}
