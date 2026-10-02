import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { Pill } from "@/components/Pill";

/*
 * The Newsletters index, server-rendered with no client state, same contract
 * as components/Categories.jsx and components/ToolPage.jsx: whole in the first
 * response for a crawler that never runs our JavaScript.
 *
 * It does not reuse the directory grid. Newsletters are not tools and are not
 * chosen the same way, so the layout leads on the two things that decide a
 * newsletter, who writes it and how long it has run, rather than on a price and
 * a category. No category colour anywhere (invariant A reserves it for tool
 * categories); everything here is neutral type.
 *
 * The section is grouped by audience, which is the honest intro made
 * structural: a couple of these are about the Shopify platform and the rest are
 * merchant media an app vendor reads sideways. Saying that in the shape of the
 * page is better than letting the list look like it drifted off topic.
 */

function formatStarted(s) {
  if (!s) return "";
  const [y, m] = String(s).split("-");
  if (!m) return y;
  const month = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] || "";
  return month ? `${month} ${y}` : y;
}

/*
 * Cadence and run length, together, as the lead. This is the credibility
 * signal: "Weekly, 1,170 issues" and "New, since Feb 2026" have to read as
 * different kinds of thing without the reader doing any work. Cadence is set in
 * the text colour so it leads; the magnitude and the date follow in muted.
 */
function Signal({ n }) {
  const cadence = n.cadence || "New";
  const rest = [
    n.issueCount ? `${n.issueCount.toLocaleString()} issues` : "",
    n.started ? `since ${formatStarted(n.started)}` : "",
    n.free ? "Free" : "",
  ].filter(Boolean).join(" · ");
  return (
    <p className="tnum" style={{ margin: `${S.xs}px 0 0`, fontSize: F.sm }}>
      <span style={{ color: C.text, fontWeight: 600 }}>{cadence}</span>
      {rest && <span style={{ color: C.muted }}>{" · "}{rest}</span>}
    </p>
  );
}

function Row({ n }) {
  const by = n.author || n.publisher;
  return (
    <li style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <a href={`/newsletters/${n.id}`}
          style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none", letterSpacing: TRACK.tight }}>
          {n.name}
        </a>
        {n.shopifySpecific && <Pill>Shopify-specific</Pill>}
      </div>
      <Signal n={n} />
      {by && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>by {by}</p>}
      <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "70ch" }}>
        {n.one}
      </p>
      <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6, margin: `${S.xs}px 0 0`, maxWidth: "70ch" }}>
        <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{n.watch}
      </p>
    </li>
  );
}

function Group({ title, blurb, items }) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: S["3xl"] }}>
      <h2 style={{ fontSize: F.md, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{title}</h2>
      <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.xs}px 0 0`, maxWidth: "70ch" }}>{blurb}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
        {items.map((n) => <Row key={n.id} n={n} />)}
      </ul>
    </section>
  );
}

export default function Newsletters({ newsletters, lastUpdated }) {
  const forVendors = newsletters.filter((n) => n.shopifySpecific);
  const merchant = newsletters.filter((n) => !n.shopifySpecific);

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 20px" }}>

        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <span style={{ color: C.text }}>Newsletters</span>
        </nav>

        <header style={{ marginTop: S.xl }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            Newsletters
          </h1>
          {/* The honest intro. The gap is real and naming it beats pretending
              the list is something it is not. */}
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "64ch" }}>
            Two of these are about the Shopify platform and worth reading directly:
            Shopify App Founders Edition and ShopOps Weekly. The rest are merchant-side and
            operator media. You read them sideways, because what a merchant is sold and what a
            merchant buys is the demand signal behind who installs your app. Almost nobody
            writes for this audience directly, and naming that gap is more honest than
            pretending otherwise.
          </p>
        </header>

        <Group
          title="About the Shopify platform"
          blurb="Written about the platform and the app ecosystem. The closest thing here to reading for your own roadmap."
          items={forVendors}
        />
        <Group
          title="Merchant-side media, read sideways"
          blurb="Written for merchants and operators, not for app developers. Useful as demand signal and as a view of what your merchants are being sold."
          items={merchant}
        />

        <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"], borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch" }}>
            <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory for
            Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify.
            No affiliate links and no paid placement. Directory last updated {lastUpdated}.
            Every entry keeps its watch note, and it is no more the publisher's to edit than a tool's is.
          </p>
        </footer>
      </div>
    </main>
  );
}
