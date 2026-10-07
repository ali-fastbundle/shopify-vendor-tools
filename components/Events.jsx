import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { monthLabel, monthShort } from "@/lib/events";
import { EventRow, placeOf } from "@/components/EventParts";
import EventDialog from "@/components/EventDialog";
import SiteNav from "@/components/SiteNav";

/*
 * The Events index. Server-rendered, whole in the first response, the same
 * contract as the newsletters index and the tool pages.
 *
 * An agenda rather than a month grid, deliberately. Most of these are one-day
 * events in scattered months, so a month grid is thirty-odd empty cells around
 * one or none, which reads as a dead section, and it is the worst possible
 * layout at phone width. The agenda shows only the months with something in
 * them, and the imprecise dates fit into it as rows that say what they are
 * rather than as cells that pretend to a day.
 *
 * What a grid is good for, seeing when the busy months are, is kept as the
 * strip at the top: the next twelve months with a count each, zeros included,
 * each non-empty month a link down to its section.
 *
 * Past events are behind a native <details>, closed: they are the record, not
 * the reason anybody opens this page. No JavaScript needed to open it.
 */

function Strip({ strip }) {
  return (
    <ol className="event-strip tnum" aria-label="Events in the next twelve months"
      style={{ listStyle: "none", padding: 0, margin: `${S.xl}px 0 0` }}>
      {strip.map(({ month, count, unconfirmed }, i) => {
        const any = count + unconfirmed > 0;
        const yearShown = i === 0 || month.endsWith("-01");
        const said = [
          `${count} dated event${count === 1 ? "" : "s"}`,
          unconfirmed ? `${unconfirmed} not confirmed` : "",
        ].filter(Boolean).join(", ");
        const inner = (
          <>
            <span style={{ fontSize: F.xs, color: any ? C.muted : C.dim, display: "block" }}>
              {monthShort(month)}{yearShown ? ` \u2019${month.slice(2, 4)}` : ""}
            </span>
            <span style={{ fontSize: F.lg, fontWeight: count ? 800 : 500, color: count ? C.text : C.dim, display: "block" }}>
              {count}
            </span>
            {/* Unconfirmed dates are a separate, softer figure. Rule E: only
                when there are any. */}
            <span style={{ fontSize: F.xs, color: C.muted, display: "block", minHeight: "1.4em" }}>
              {unconfirmed ? `+${unconfirmed} tbc` : ""}
            </span>
          </>
        );
        const cell = {
          display: "block", textAlign: "center", padding: `${S.sm}px 0 ${S.xs}px`,
          borderRadius: R.control, textDecoration: "none",
          border: `1px ${count ? "solid" : "dashed"} ${any ? C.edge : C.line}`,
        };
        return (
          <li key={month}>
            {any
              ? <a href={`#m-${month}`} className="press" style={cell}
                  aria-label={`${monthLabel(month)}: ${said}`}>{inner}</a>
              : <span style={cell} aria-label={`${monthLabel(month)}: none`}>{inner}</span>}
          </li>
        );
      })}
    </ol>
  );
}

const List = ({ items, today }) => (
  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
    {items.map((e) => <EventRow key={e.id} e={e} today={today} />)}
  </ul>
);

const H2 = ({ children, id }) => (
  <h2 id={id} style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{children}</h2>
);

export default function Events({ plan, events, lastUpdated }) {
  const { today, strip, months, past, unscheduled } = plan;
  const ahead = months.reduce((n, g) => n + g.items.length, 0);

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <SiteNav current="events" />

        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            Events
          </h1>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "62ch" }}>
            Conferences and meetups an app vendor might travel for, with who is actually in the room.
            Only a few are about the Shopify app ecosystem itself. Most are merchant and retail events,
            worth it when your buyers are there.
          </p>
        </header>

        <Strip strip={strip} />

        <section aria-labelledby="ahead" style={{ marginTop: S["3xl"] }}>
          <H2 id="ahead">Coming up</H2>
          {ahead === 0 && (
            <p style={{ fontSize: F.md, color: C.muted, margin: `${S.sm}px 0 0` }}>
              Nothing with a date in the next twelve months.
            </p>
          )}
          {months.map((g) => (
            <div key={g.month} id={`m-${g.month}`} style={{ marginTop: S.xl, scrollMarginTop: S.lg }}>
              <h3 style={{ fontSize: F.sm, fontWeight: 700, color: C.muted, margin: 0, paddingBottom: S.xs, borderBottom: `1px solid ${C.line}` }}>
                {monthLabel(g.month)}
              </h3>
              <List items={g.items} today={today} />
            </div>
          ))}
        </section>

        {unscheduled.length > 0 && (
          <section aria-labelledby="unscheduled" style={{ marginTop: S["4xl"] }}>
            <H2 id="unscheduled">Dates not announced</H2>
            <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, maxWidth: "64ch", lineHeight: 1.55 }}>
              Running, or recently run, with no next date we could find on the organiser's own site.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.sm}px 0 0` }}>
              {unscheduled.map((e) => (
                <li key={e.id} id={e.id} style={{ padding: `${S.sm}px 0`, borderTop: `1px solid ${C.line}` }}>
                  <a href={`/events/${e.id}`} data-event={e.id}
                    style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>{e.name}</a>
                  <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
                    {[placeOf(e), e.at.label].filter(Boolean).join(" · ")}
                  </p>
                  {e.one && <p style={{ fontSize: F.sm, color: C.text, margin: `${S.xs}px 0 0`, lineHeight: 1.55, maxWidth: "64ch" }}>{e.one}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {past.length > 0 && (
          <section style={{ marginTop: S["4xl"] }}>
            <details>
              <summary style={{ cursor: "pointer", fontSize: F.xl, fontWeight: 700, letterSpacing: TRACK.tight }}>
                Past events <span className="tnum" style={{ color: C.muted, fontWeight: 500, fontSize: F.md }}>{past.length}</span>
              </summary>
              <div style={{ marginTop: S.sm }}>
                <List items={past} today={today} />
              </div>
            </details>
          </section>
        )}

        <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"], borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch" }}>
            Dates are checked by hand against each organiser's own site, and an event with no confirmed
            date is never shown as scheduled. <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is
            an independent directory for Shopify app vendors. Not affiliated with, endorsed by, or sponsored
            by Shopify. No affiliate links and no paid placement. Directory last updated {lastUpdated}.
          </p>
        </footer>
      </div>

      <EventDialog events={events} today={today} />
    </main>
  );
}
