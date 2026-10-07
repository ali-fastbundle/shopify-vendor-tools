import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { EventBody, placeOf } from "@/components/EventParts";

/*
 * One event at its own URL. No client state in this file, same contract as
 * ToolPage and NewsletterPage: everything a crawler reads is in the first
 * response.
 *
 * No category colour (invariant A): a neutral rule across the top rather than
 * a coloured spine.
 */

/*
 * Related events: the same organiser first, then the same country. Never
 * padding: fewer than the limit shows fewer, including none, the rule every
 * related list on this site follows.
 */
function relatedEvents(e, all, limit = 4) {
  const others = all.filter((x) => x.id !== e.id && x.at.status !== "past");
  const seen = new Set();
  const out = [];
  const take = (list) => {
    for (const x of list) {
      if (out.length >= limit || seen.has(x.id)) continue;
      seen.add(x.id); out.push(x);
    }
  };
  if (e.organizer) take(others.filter((x) => x.organizer === e.organizer));
  if (e.country && !/^n\/a$/i.test(e.country)) take(others.filter((x) => x.country === e.country));
  return out;
}

export default function EventPage({ e, all, today, lastUpdated }) {
  const related = relatedEvents(e, all);

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <a href="/events" style={{ color: C.muted, textDecoration: "none" }}>Events</a>
          <span style={{ color: C.dim }}> / </span>
          <span style={{ color: C.text }}>{e.name}</span>
        </nav>

        <article style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
          overflow: "hidden", marginTop: S.xl,
        }}>
          <div style={{ height: 3, background: C.edge }} />
          <div style={{ padding: S["2xl"] }}>
            <EventBody e={e} today={today} />
          </div>
        </article>

        {related.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              Also coming up
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
              {related.map((r) => (
                <li key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <a href={`/events/${r.id}`} style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>
                    {r.name}
                  </a>
                  <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
                    {[r.at.label, placeOf(r)].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p style={{ marginTop: S["2xl"], fontSize: F.sm }}>
          <a href="/events" style={{ color: C.muted }}>All events</a>
        </p>

        <footer style={{ marginTop: S["3xl"], paddingBottom: S["4xl"] }}>
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch" }}>
            <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory for
            Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify, or by any
            organiser listed here. No affiliate links and no paid placement. Directory last updated {lastUpdated}.
          </p>
        </footer>
      </div>
    </main>
  );
}
