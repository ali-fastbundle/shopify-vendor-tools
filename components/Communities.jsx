import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { CardVotes } from "@/components/Engagement";
import VisitSite from "@/components/VisitSite";
import { COMMUNITY_GROUPS, communityGroups, communityIntro } from "@/lib/communityCopy";

/*
 * The Communities index, server-rendered with no client state, the same
 * contract as components/Podcasts.jsx: whole in the first response.
 *
 * Grouped by who is in the room, because that is the question this section
 * answers: most Shopify community is merchant or agency shaped, and the label
 * rarely says so. No category colour (invariant A); everything is neutral type.
 */

/* Platform, price and how you get in, as the lead: the three things that
   decide whether you can use it at all. */
function Signal({ c }) {
  const rest = [c.price, c.entry, c.members].filter(Boolean).join(" · ");
  return (
    <p className="tnum" style={{ margin: `${S.xs}px 0 0`, fontSize: F.sm }}>
      <span style={{ color: C.text, fontWeight: 600 }}>{c.platform}</span>
      {rest && <span style={{ color: C.muted }}>{" · "}{rest}</span>}
    </p>
  );
}

function Card({ c }) {
  return (
    <li className="card"
      style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
        padding: S.lg, marginTop: S.md,
      }}>
      <div className="flex items-center" style={{ gap: S.sm }}>
        {c.logo && <img src={c.logo} alt="" width={32} height={32} loading="lazy" decoding="async"
          style={{ width: 32, height: 32, borderRadius: R.card, flexShrink: 0, background: C.logoTile, objectFit: "contain", padding: 4, border: `1px solid ${C.line}` }} />}
        <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", display: "inline" }}>{/* a heading under its group */}
        <a href={`/communities/${c.id}`} className="card-link"
          style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none", letterSpacing: TRACK.tight }}>
          {c.name}
        </a></h3>
      </div>
      <Signal c={c} />
      {c.organisers && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>run by {c.organisers}</p>}
      <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.55, margin: `${S.sm}px 0 0`  }}>
        {c.one}
      </p>
      <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6, margin: `${S.xs}px 0 0`  }}>
        <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{c.watch}
      </p>
      <div className="flex flex-wrap items-center justify-between"
        style={{ gap: S.sm, borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
        <CardVotes id={c.id} noun="community" />
        <VisitSite url={c.url} />
      </div>
    </li>
  );
}

function Group({ title, blurb, items }) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: S["3xl"] }}>
      <h2 style={{ fontSize: F.md, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{title}</h2>
      <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.xs}px 0 0`  }}>{blurb}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: `${S.sm}px 0 0` }}>
        {items.map((c) => <Card key={c.id} c={c} />)}
      </ul>
    </section>
  );
}

export default function Communities({ communities }) {
  const groups = communityGroups(communities);
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ padding: "0 20px" }}>
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            Communities
          </h1>
          {communityIntro(communities).map((t) => (
            <p key={t} style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`  }}>{t}</p>
          ))}
        </header>

        <div id="community-list">
          {COMMUNITY_GROUPS.map((g) => <Group key={g.key} title={g.title} blurb={g.blurb} items={groups[g.key]} />)}
        </div>

        <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6 , margin: `${S["3xl"]}px 0 0` }}>
          Member figures are the community&apos;s own, with the day they were read on each listing. Every entry keeps its watch note, and it is no more the organizers&apos; to edit than a tool&apos;s is.
        </p>
      </div>
    </main>
  );
}
