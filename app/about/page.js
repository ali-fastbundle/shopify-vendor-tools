import { C, S, F, R, TRACK, AUTHOR, AUTHOR_URL } from "@/lib/tools";
import { mintFormToken } from "@/lib/auth";
import ContactForm from "@/components/ContactForm";
import { withShareImage } from "@/lib/ogCard";
import { SITE, IDS, person } from "@/lib/seo";
import { outbound } from "@/lib/outbound";
import JsonLd from "@/components/JsonLd";

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

/*
 * The prose is Ali's, verbatim. Do not edit it here to match the house style:
 * it is a person's own account of themselves, and the first line is the
 * disclosure of the Fast Bundle role, so there is no separate disclaimer.
 * No phone number and no email address on this page, in text or in markup.
 * The form handles email (invariant 38).
 */
const ROLE = "Head of Partnerships & Strategic Accounts, Fast Bundle";
const PARAGRAPHS = [
  "I work on the vendor side of the Shopify ecosystem. At Fast Bundle, a bundling app with more than 2,000 merchant reviews, I run partnerships and strategic accounts. Before that I led key account management there, with a portfolio of around 1,200 accounts and $250K in monthly recurring revenue.",
  "Most of the job is conversations. With merchants about what they are trying to sell. With agencies about whether a partnership is real or just polite. With other app vendors about where our products meet. I built the company’s first affiliate program and its partner channel, and I set up the offshore support operation in Yerevan.",
  "I did not come to this from software. Most of my career was in publishing and international rights. I co-founded a literary agency in Tehran, ran one in Dubai, and sold books across 31 countries. I have been writing and translating for eighteen years, five books and more than thirty articles. I studied law before I studied trade.",
  "That background explains this directory better than my job title does. Rights work teaches you to ask who owns what, and to read a claim carefully before repeating it. When I started keeping a list of tools built for Shopify app vendors, those two habits turned into the “watch for” note on every entry.",
  "I am based in Yerevan. If you build something in this ecosystem, or you think something belongs in the directory, get in touch.",
];

export default function Page() {
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
            <img src={PHOTO} alt={`${AUTHOR}, who maintains watchfor.tools`} width={160} height={160}
              style={{ width: 160, height: 160, objectFit: "cover", borderRadius: R.card, border: `1px solid ${C.line}` }} />
          )}
          <div>
            <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
              {AUTHOR}
            </h1>
            <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.5, margin: `${S.sm}px 0 0` }}>{ROLE}</p>
          </div>
        </header>

        <div style={{ marginTop: S["2xl"], maxWidth: "68ch" }}>
          {PARAGRAPHS.map((p, i) => (
            <p key={i} style={{ fontSize: F.lg, lineHeight: 1.65, margin: i ? `${S.lg}px 0 0` : 0 }}>{p}</p>
          ))}
        </div>

        {AUTHOR_URL && (
          <p style={{ fontSize: F.md, margin: `${S.xl}px 0 0` }}>
            <a href={outbound(AUTHOR_URL)} target="_blank" rel="noopener noreferrer me" style={{ color: C.text }}>LinkedIn</a>
          </p>
        )}

        <ContactForm token={mintFormToken("contact")} />
      </div>
    </main>
  );
}
