import { C, S, F, TRACK, LAST_UPDATED } from "@/lib/tools";
import { mintFormToken } from "@/lib/auth";
import SiteNav from "@/components/SiteNav";
import ContactForm from "@/components/ContactForm";
import FooterLinks from "@/components/FooterLinks";
import { withShareImage } from "@/lib/ogCard";
import { SITE, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

/* Dynamic, because the form carries a token signed at render time and a
   cached page would hand everybody the same, ever older, timestamp. */
export const dynamic = "force-dynamic";

const title = "Contact | watchfor.tools";
const description = "Get in touch with the person who maintains watchfor.tools: corrections, listings, or anything else.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default function Page() {
  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      {/* No email in it: the address is kept out of the page source (invariant 38). */}
      <JsonLd data={{
        "@type": "ContactPage", "@id": `${SITE}/contact#page`, url: `${SITE}/contact`, name: "Contact",
        isPartOf: { "@id": IDS.website }, about: { "@id": IDS.organization },
      }} />
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <SiteNav current="contact" />
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            Contact
          </h1>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "60ch" }}>
            A correction, a listing you run, something that should be here, or anything else.
            It goes to the person who maintains the directory. To fix one detail on one listing,
            the report link on that listing is quicker.
          </p>
        </header>

        <ContactForm token={mintFormToken("contact")} />

        <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"], borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
          <FooterLinks />
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch", margin: 0 }}>
            <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory for
            Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify.
            Directory last updated {LAST_UPDATED}.
          </p>
        </footer>
      </div>
    </main>
  );
}
