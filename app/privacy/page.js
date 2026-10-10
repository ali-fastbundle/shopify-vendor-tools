import { C, S, F, TRACK, LAST_UPDATED } from "@/lib/tools";
import SiteNav from "@/components/SiteNav";
import FooterLinks from "@/components/FooterLinks";
import { withShareImage } from "@/lib/ogCard";
import { SITE, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

/*
 * What the site stores, and why, in plain words. Written from the code, not
 * from a template: every line here names something a file in this repository
 * does. If you change what is stored, change this page in the same commit
 * (CLAUDE.md, "Privacy and consent").
 *
 * No cookie banner, on purpose. The only cookie is the sign-in session, which
 * is strictly necessary for the thing the person asked for, and nothing on the
 * site tracks anybody. A banner becomes necessary the day a third-party
 * script arrives, and adding one is a precondition of that script, not a
 * follow-up.
 */

/* Dynamic like every other page, so the share image version is read per
   request rather than frozen at build time (lib/ogCard.js). */
export const dynamic = "force-dynamic";

const title = "Privacy | watchfor.tools";
const description = "What watchfor.tools stores, why, and for how long. No tracking, no advertising, no data sold.";
const REVISED = "2026-10-10";

export async function generateMetadata() {
  return withShareImage({
    title, description,
    alternates: { canonical: "/privacy" },
    openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
  });
}

const H = ({ children }) => (
  <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tight }}>{children}</h2>
);
const P = ({ children }) => (
  <p style={{ fontSize: F.lg, lineHeight: 1.65, margin: `${S.md}px 0 0`, maxWidth: "68ch" }}>{children}</p>
);
const Li = ({ k, children }) => (
  <li style={{ fontSize: F.md, lineHeight: 1.6, marginTop: S.sm, maxWidth: "68ch" }}>
    {k && <code style={{ fontSize: F.sm, background: C.subtle, borderRadius: 4, padding: "1px 4px" }}>{k}</code>}{k ? " " : ""}{children}
  </li>
);
const Ul = ({ children }) => <ul style={{ margin: `${S.md}px 0 0`, paddingLeft: S.xl, listStyle: "disc" }}>{children}</ul>;

export default function Page() {
  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <JsonLd data={{
        "@type": "WebPage", "@id": `${SITE}/privacy#page`, url: `${SITE}/privacy`, name: "Privacy",
        isPartOf: { "@id": IDS.website }, dateModified: REVISED,
      }} />
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <SiteNav current="privacy" />
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>Privacy</h1>
          <P>
            The short version: nothing on this site tracks you, nothing is sold, and there is no
            advertising. There is one cookie, and only if you sign in. Your email address is stored
            only if you gave it to us, for the thing you gave it for.
          </P>
          <p style={{ fontSize: F.sm, color: C.dim, margin: `${S.sm}px 0 0` }}>Last revised <time dateTime={REVISED}>10 October 2026</time>.</p>
        </header>

        <H>In your browser</H>
        <P>
          A few small things are kept in your browser&apos;s local storage. They never leave it, we
          cannot read them, and clearing your site data removes them.
        </P>
        <Ul>
          <Li k="svt:theme">Your Auto, Light or Dark choice.</Li>
          <Li k="svt:mine, svt:vote:…">Which listings you liked or disliked, so a second click takes
            your vote back rather than counting it twice.</Li>
          <Li k="svt:updates:seen">When you last opened Recent updates, so the tab can say how many
            are new since then. It is a date, not a history.</Li>
          <Li k="svt:draft:…, svt:contact:draft">A review, comment or message you started and have not
            sent, so it survives a trip to your inbox to sign in. Deleted when you send it.</Li>
        </Ul>
        <P>
          &quot;Events near me&quot; asks for your location only when you press it, and works out
          distances in your browser. Your location is never sent anywhere.
        </P>

        <H>Cookies</H>
        <P>
          One, and only when you sign in: <code style={{ fontSize: F.sm }}>svt_session</code>. It
          holds your email address, signed so it cannot be edited, and keeps you signed in for 30
          days. It is how the site knows a review is yours. It is not readable by scripts on the
          page and it is not used for anything else. Signing out deletes it.
        </P>
        <P>That is the whole list. There is no cookie banner because there is nothing else to consent to.</P>

        <H>Analytics</H>
        <P>
          Page visits are counted by Vercel Analytics, and page speed by Vercel Speed Insights. Both
          are cookieless: they keep no identifier in your browser and do not follow you between
          sites or visits. We see totals (which pages, which countries, which kind of device), never
          a person.
        </P>
        <P>
          Separately, the site counts a few things Vercel cannot see, as plain totals with no cookie
          and no identifier: how often each listing is opened, each section is viewed, and each
          screen of the recommender is reached. What is typed into the matcher is kept as text,
          the last 50 queries only, never linked to who typed it.
        </P>

        <H>Email addresses</H>
        <P>Only from people who gave one, and only for the reason they gave it:</P>
        <Ul>
          <Li>Signing in: your address, when you first signed in and when you last did. Nothing else.</Li>
          <Li>A review or a comment: your address is stored with it so you can edit yours and so one
            account cannot pose as many. It is never shown; the name you choose is.</Li>
          <Li>The mailing list, or following a newsletter or an event: your address, until you
            unsubscribe. A follow is stored only after you click the confirmation link.</Li>
          <Li>A suggestion or a report: only if you chose to add an address, to thank you or ask a question.</Li>
          <Li>The contact form: your message is emailed to the maintainer and not stored on the site.</Li>
          <Li>The growth recommender: your answers are kept without your address. Unfinished
            answers are saved against a scrambled form of it, and deleted when you finish, start
            over, or after 60 days.</Li>
        </Ul>
        <P>
          Every email we send has a working reply address, and the list and every follow can be
          stopped from a link in the email itself.
        </P>

        <H>Abuse protection</H>
        <P>
          To stop one person flooding a form, each form counts recent requests per IP address. The
          address itself is not stored: only a one-way scrambled form of it, which expires with the
          window it counts, an hour at most.
        </P>

        <H>Who else is involved</H>
        <P>
          The site runs on Vercel and stores its data with Upstash. Email is sent through Resend.
          Each handles data only to provide that service to us.
        </P>
        <P>
          Some tool and event logos are loaded from Google&apos;s favicon service where we do not host
          the logo ourselves, so your browser asks Google for that small image. It sends no
          referrer and no cookie of ours, and Google learns nothing from us about you, but it does
          see the request. The typeface is served from this site, not from Google.
        </P>
        <P>
          No third-party tracking, no advertising, no social media widgets. Your data is not sold,
          rented or shared with anyone for their own use.
        </P>

        <H>Your data</H>
        <P>
          To see, correct or delete anything stored about you, including an account, a review or a
          comment, <a href="/contact" style={{ color: C.text }}>use the contact form</a>. It reaches
          the person who runs the site, and deletion is done by hand, completely.
        </P>

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
