import React from "react";
import { C, S, F, R, TRACK, AUTHOR_URL } from "@/lib/tools";
import { mintFormToken } from "@/lib/auth";
import ContactForm from "@/components/ContactForm";
import { withShareImage } from "@/lib/ogCard";
import { SITE, IDS, person } from "@/lib/seo";
import { outbound } from "@/lib/outbound";
import JsonLd from "@/components/JsonLd";
import { getAbout, aboutPhotoUrl } from "@/lib/aboutStore";
import { inlineTokens } from "@/lib/aboutText";
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

/*
 * Bold, italic and links in the text, rendered as elements from tokens, never
 * as HTML (lib/aboutText.js). A link off the site goes through outbound() and
 * opens in a new tab, like every other outbound link (invariant 11).
 */
function Inline({ text }) {
  return <Tokens tokens={inlineTokens(text)} />;
}

function Tokens({ tokens }) {
  return tokens.map((t, i) => {
    const kids = t.children ? <Tokens tokens={t.children} /> : t.v;
    if (t.t === "b") return <strong key={i}>{kids}</strong>;
    if (t.t === "i") return <em key={i}>{kids}</em>;
    if (t.t === "a") {
      const external = /^https?:/i.test(t.href);
      return external
        ? <a key={i} href={outbound(t.href)} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{kids}</a>
        : <a key={i} href={t.href} style={{ color: C.text }}>{kids}</a>;
    }
    return <React.Fragment key={i}>{t.v}</React.Fragment>;
  });
}

export default async function Page() {
  /* The saved text, or the file's when nothing is saved (lib/aboutStore.js). */
  const about = await getAbout();
  /* The photo uploaded from /admin, or the file in public/, or none. */
  const PHOTO = await aboutPhotoUrl();
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
            <p key={i} style={{ fontSize: F.lg, lineHeight: 1.65, margin: i ? `${S.lg}px 0 0` : 0 }}><Inline text={p} /></p>
          ))}
        </div>

        {/* LinkedIn, then the links added from /admin. */}
        <p className="flex flex-wrap" style={{ fontSize: F.md, margin: `${S.xl}px 0 0`, gap: S.lg }}>
          {AUTHOR_URL && (
            <a href={outbound(AUTHOR_URL)} target="_blank" rel="noopener noreferrer me" style={{ color: C.text }}>LinkedIn</a>
          )}
          {(about.links || []).map((l) => /^https?:/i.test(l.url)
            ? <a key={l.url} href={outbound(l.url)} target="_blank" rel="noopener noreferrer me" style={{ color: C.text }}>{l.label}</a>
            : <a key={l.url} href={l.url} style={{ color: C.text }}>{l.label}</a>)}
        </p>

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
