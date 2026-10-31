import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { Pill } from "@/components/Pill";
import { CardVotes } from "@/components/Engagement";
import VisitSite from "@/components/VisitSite";
import { podcastGroups, podcastIntro } from "@/lib/podcastCopy";

/*
 * The Podcasts index, server-rendered with no client state, the same contract
 * as components/Newsletters.jsx: whole in the first response for a crawler.
 *
 * Grouped the way the intro reads, so the honest answer is the shape of the
 * page and not only a sentence above it: the show made for app builders, the
 * shows for merchants and DTC brands, and the shows that stopped. No category
 * colour (invariant A); everything is neutral type.
 *
 * Every figure in the intro is counted from the catalogue, never typed, so a
 * show added or stopped changes the sentence by itself.
 */

function monthYear(s) {
  const [y, m] = String(s || "").split("-");
  if (!y) return "";
  const month = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] || "";
  return month ? `${month} ${y}` : y;
}

/* Cadence and run, or the fact that it stopped, as the lead. */
function Signal({ p }) {
  const lead = p.discontinued
    ? `Stopped${p.lastEpisode ? `, last episode ${monthYear(p.lastEpisode)}` : ""}`
    : (p.cadence || "No fixed schedule");
  const rest = [
    p.episodeCount ? `${p.episodeCount.toLocaleString("en-US")} episodes` : "",
    p.started ? `since ${monthYear(p.started)}` : "",
    p.length ? p.length.replace(/^About /, "about ") : "",
  ].filter(Boolean).join(" · ");
  return (
    <p className="tnum" style={{ margin: `${S.xs}px 0 0`, fontSize: F.sm }}>
      <span style={{ color: C.text, fontWeight: 600 }}>{lead}</span>
      {rest && <span style={{ color: C.muted }}>{" · "}{rest}</span>}
    </p>
  );
}

/* A show's card, built like a newsletter card: `.card` and `.card-link`, so
   the whole card opens the show's page and the votes and Visit site sit above
   the overlay (globals.css). */
function Card({ p }) {
  const by = p.host || p.publisher;
  return (
    <li className="card"
      style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
        padding: S.lg, marginTop: S.md,
      }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <a href={`/podcasts/${p.id}`} className="card-link"
          style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none", letterSpacing: TRACK.tight }}>
          {p.name}
        </a>
        {p.shopifySpecific && <Pill>Shopify-specific</Pill>}
      </div>
      <Signal p={p} />
      {by && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>hosted by {by}{p.host && p.publisher && p.publisher !== p.host ? `, ${p.publisher}` : ""}</p>}
      <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "62ch" }}>
        {p.one}
      </p>
      <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6, margin: `${S.xs}px 0 0`, maxWidth: "62ch" }}>
        <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{p.watch}
      </p>
      <div className="flex flex-wrap items-center justify-between"
        style={{ gap: S.sm, borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
        <CardVotes id={p.id} noun="podcast" />
        <VisitSite url={p.url} />
      </div>
    </li>
  );
}

function Group({ title, blurb, items }) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: S["3xl"] }}>
      <h2 style={{ fontSize: F.md, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{title}</h2>
      <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.xs}px 0 0`, maxWidth: "62ch" }}>{blurb}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: `${S.sm}px 0 0` }}>
        {items.map((p) => <Card key={p.id} p={p} />)}
      </ul>
    </section>
  );
}

export default function Podcasts({ podcasts }) {
  const { builders, merchants, stopped } = podcastGroups(podcasts);
  const intro = podcastIntro(podcasts);

  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 20px" }}>
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            Podcasts
          </h1>
          {intro.map((t) => (
            <p key={t} style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "62ch" }}>{t}</p>
          ))}
        </header>

        <div id="podcast-list">
          <Group
            title="Made for app builders"
            blurb="About building and selling Shopify apps, with app founders as the guests."
            items={builders}
          />
          <Group
            title="For merchants and DTC brands, heard sideways"
            blurb="Made for merchants, not for app developers. Useful as demand signal, as a view of what your merchants are being sold, and as a channel to them."
            items={merchants}
          />
          <Group
            title="Stopped publishing, kept as a record"
            blurb="No new episodes. The archive is still a record of who was saying what, and when."
            items={stopped}
          />
        </div>

        <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "62ch", margin: `${S["3xl"]}px 0 0` }}>
          Episode counts, dates and lengths are read from each show&apos;s own feed. Every entry keeps its watch note, and it is no more the host&apos;s to edit than a tool&apos;s is.
        </p>
      </div>
    </main>
  );
}
