import { C, S, F, R, TRACK, AUTHOR_URL } from "@/lib/tools";
import { mintFormToken } from "@/lib/auth";
import ContactForm from "@/components/ContactForm";
import { withShareImage } from "@/lib/ogCard";
import { SITE, IDS, person } from "@/lib/seo";
import { outbound } from "@/lib/outbound";
import JsonLd from "@/components/JsonLd";
import { getAbout } from "@/lib/aboutStore";
import { cookies, headers } from "next/headers";
import { sessionFrom, isAdmin } from "@/lib/auth";

/* Dynamic for the same reason as /contact: the form carries a token signed at
   render time (invariant 38). */
export const dynamic = "force-dynamic";

const title = "About Ali A. | watchfor.tools";
const description = "Ali A. maintains watchfor.tools. Head of Partnerships & Strategic Accounts at Fast Bundle, a Shopify bundling app, and before that publishing and international rights.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { title, description, type: "profile", siteName: "watchfor.tools" },
};

export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

/* Set at build time in next.config.mjs from whichever of
   public/ali-arabzadeh.{jpg,jpeg,png,webp} exists. Empty means no photo yet. */
const PHOTO = process.env.ABOUT_PHOTO || "";



export default async function Page() {
  /* The saved text, or the file's when nothing is saved (lib/aboutStore.js). */
  const about = await getAbout();
  /* An affordance, never the permission: /api/admin re-checks (invariant 7). */
  let admin = false;
  try {
    const session = sessionFrom({ cookies: cookies(), headers: headers() });
    admin = Boolean(session && isAdmin(session.email));
  } catch {}
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <JsonLd data={{
        "@graph": [
          {
            "@type": "ProfilePage", "@id": `${SITE}/about#page`, url: `${SITE}/about`, name: title,
            isPartOf: { "@id": IDS.website }, mainEntity: { "@id": IDS.author },
          },
          { ...person, ...(PHOTO ? { image: `${SITE}${PHOTO}` } : {}) },
        ],
      }} />
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <header className={PHOTO ? "about-head" : undefined} style={{ marginTop: S["3xl"] }}>
          {PHOTO && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={PHOTO} alt={`${about.name}, who maintains watchfor.tools`} width={160} height={160}
              style={{ width: 160, height: 160, objectFit: "cover", borderRadius: R.card, border: `1px solid ${C.line}` }} />
          )}
          <div>
            <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
              {about.name}
            </h1>
            <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.5, margin: `${S.sm}px 0 0` }}>{about.role}</p>
          </div>
        </header>

        <div style={{ marginTop: S["2xl"], maxWidth: "68ch" }}>
          {about.paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: F.lg, lineHeight: 1.65, margin: i ? `${S.lg}px 0 0` : 0 }}>{p}</p>
          ))}
        </div>

        {AUTHOR_URL && (
          <p style={{ fontSize: F.md, margin: `${S.xl}px 0 0` }}>
            <a href={outbound(AUTHOR_URL)} target="_blank" rel="noopener noreferrer me" style={{ color: C.text }}>LinkedIn</a>
          </p>
        )}

        <ContactForm token={mintFormToken("contact")} />

        {admin && (
          <p style={{ fontSize: F.sm, margin: `${S.xl}px 0 0` }}>
            <a href="/admin?tab=catalogue#about-page" style={{ color: C.muted }}>Edit this page</a>
          </p>
        )}
      </div>
    </main>
  );
}
