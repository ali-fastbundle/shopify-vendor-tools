import React from "react";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { outbound } from "@/lib/outbound";
import { countdown, RELEVANCE_LABEL, dayLabel } from "@/lib/events";
import { Pill } from "@/components/Pill";
import EventLogo from "@/components/EventLogo";
import { searchText } from "@/lib/search";
import { CardVotes } from "@/components/Engagement";

/*
 * The pieces of an event that render the same on the index, in the modal and
 * on /events/[id]. No hooks and no state, so the server page imports them as
 * server components and the modal imports them as client ones, and the two
 * cannot drift into saying different things about the same event.
 *
 * Colour. Past, imminent and upcoming are told apart by contrast, never by
 * hue: the category palette is reserved for tool categories (invariant A),
 * green is for actions (C) and the warn tone belongs to "winding down" (B).
 * Upcoming is full text, past is dimmed, and imminent gets the neutral
 * inversion, the same device as a selected state, because "this is the one to
 * act on" is a state.
 *
 * Certainty. The month is the information, so it is set exactly like a
 * confirmed day. An inferred date carries one quiet signal, "date TBC" on the
 * bottom line of the box and on the row, and the whole explanation lives in
 * the tooltip and the detail view. An approximate one shows the organiser's
 * own words on the row.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DateBlock({ e }) {
  const at = e.at;
  const past = at.status === "past";
  const tone = past ? C.dim : C.text;
  const small = past ? C.dim : C.muted;

  /* Three lines, every mode, and the middle one is always the information at
     the same size and weight: the day for an exact date, the month for
     anything less certain. The uncertainty is the quiet bottom line, never a
     phrase broken across the box competing with the month. */
  let top = "", big = "", bottom = "";
  if (at.mode === "exact" && at.date) {
    const [, m, d] = at.date.split("-").map(Number);
    top = MONTHS[m - 1];
    big = String(d);
    if (at.end && at.end !== at.date) {
      const [, m2, d2] = at.end.split("-").map(Number);
      bottom = m2 === m ? `to ${d2}` : `to ${d2} ${MONTHS[m2 - 1]}`;
    } else bottom = at.weekday || "";
  } else if (at.mode === "approx") {
    top = at.month.slice(0, 4);
    big = e.datePrecision === "season" ? String(e.dateRaw || "").split(" ")[0] : MONTHS[Number(at.month.slice(5)) - 1];
  } else if (at.mode === "year") {
    top = "Last held";
    big = at.year;
  } else if (at.mode === "inferred") {
    top = at.month.slice(0, 4);
    big = MONTHS[Number(at.month.slice(5)) - 1];
    bottom = "date TBC";
  }

  return (
    /* The full story is the tooltip and the detail view; the box carries the
       month and a hint. */
    <div className="tnum" title={at.mode === "exact" ? undefined : at.label} style={{
      width: 72, minHeight: 64, flexShrink: 0, borderRadius: R.card,
      border: `1px solid ${past ? C.line : C.edge}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: `${S.xs}px 0`, textAlign: "center", whiteSpace: "nowrap",
    }}>
      <span aria-hidden="true" style={{ fontSize: F.xs, color: small, lineHeight: 1.2, minHeight: "1.2em" }}>{top}</span>
      <span aria-hidden="true" style={{
        fontSize: big.length > 4 ? F.lg : F.xl, fontWeight: 800, color: tone,
        lineHeight: 1.2, letterSpacing: TRACK.tight,
      }}>{big}</span>
      <span aria-hidden="true" style={{ fontSize: F.xs, color: small, lineHeight: 1.2, minHeight: "1.2em" }}>{bottom}</span>
    </div>
  );
}

/* The neutral inversion, for the one state worth acting on. */
export function Countdown({ e, today }) {
  const text = countdown(e.at, today);
  if (!text) return null;
  return (
    <span className="tnum" style={{
      fontSize: F.xs, fontWeight: 700, lineHeight: 1.6, padding: "2px 8px",
      borderRadius: R.pill, background: C.text, color: C.bg, whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

export const placeOf = (e) =>
  [e.city, e.country].filter((x) => x && !/^n\/a$/i.test(x)).filter((x, i, a) => a.indexOf(x) === i).join(", ");

/*
 * One line of when and where. An approximate date gives the organiser's words;
 * an inferred one says "Date TBC" and nothing longer, with the last-held date
 * in the tooltip and the detail view.
 */
const whenLine = (e) => (e.at.mode === "inferred" ? "Date TBC" : e.at.label);

/* What an event row is searched on. Shared by the timeline rows and the "Dates not announced" list, so both answer alike. */
export const eventSearch = (e) =>
  searchText(e.name, e.organizer, e.city, e.country, e.venue, e.one, e.focus, e.audience);

export function EventRow({ e, today }) {
  const past = e.at.status === "past";
  const where = placeOf(e);
  return (
    /* A card like every other (globals.css): the name's overlay opens the event,
       which the timeline's EventDialog turns into the modal on a plain click.
       The border is transparent until hover, so a past event keeps "no fill". */
    <li id={e.id} data-search={eventSearch(e)} className="card"
      style={{
        padding: `${S.md}px ${S.sm}px`, margin: `${S.xs}px -${S.sm}px`, display: "flex", gap: S.lg, alignItems: "flex-start",
        border: "1px solid transparent", borderRadius: R.card,
      }}>
      <DateBlock e={e} />
      <div style={{ minWidth: 0 }}>
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          <EventLogo e={e} size={24} status={e.at.status} />
          {/* A real link to the event's page. A plain left click opens the
              modal instead (EventDialog); everything else, and every crawler,
              gets the page. */}
          <a href={`/events/${e.id}`} data-event={e.id} className="card-link"
            style={{
              color: past ? C.muted : C.text, fontWeight: 700, fontSize: F.md,
              textDecoration: "none", letterSpacing: TRACK.tight,
            }}>{e.name}</a>
          <Countdown e={e} today={today} />
          {e.at.discontinued && <Pill>discontinued</Pill>}
        </div>
        <p title={e.at.mode === "inferred" ? e.at.label : undefined}
          style={{ fontSize: F.sm, color: past ? C.dim : C.muted, margin: `${S.xs}px 0 0` }}>
          {[whenLine(e), where].filter(Boolean).join(" · ")}
        </p>
        {e.one && (
          <p style={{ fontSize: F.sm, color: past ? C.muted : C.text, lineHeight: 1.55, margin: `${S.xs}px 0 0`, maxWidth: "64ch" }}>
            {e.one}
          </p>
        )}
        <div style={{ marginTop: S.sm }}><CardVotes id={e.id} noun="event" /></div>
      </div>
    </li>
  );
}

const Sep = () => (
  <span aria-hidden="true" style={{ width: 1, height: 9, background: C.edge, display: "inline-block", opacity: 0.7 }} />
);

/*
 * The full entry: what the modal shows and what /events/[id] shows inside its
 * article. `Heading` is the level: an h1 on the page, an h2 in the modal,
 * which sits under the index page's own h1.
 */
export function EventBody({ e, today, Heading = "h1", headingId }) {
  const at = e.at;
  const domain = String(e.url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  const socials = Object.entries(e.social || {}).filter(([, href]) => href);
  const where = [e.venue && !/^(tbd|n\/a)$/i.test(e.venue) ? e.venue : "", placeOf(e)].filter(Boolean).join(", ");
  const facts = [
    e.organizer && `by ${e.organizer}`,
    e.attendees && `${e.attendees} attendees, by the organiser's count`,
    e.focus,
  ].filter(Boolean);

  let when;
  if (at.mode === "exact") when = at.label;
  else if (at.mode === "approx") when = `${at.label}. No exact date was published.`;
  else if (at.mode === "year") when = `${at.label}.`;
  else if (at.mode === "inferred")
    when = `Date not confirmed. Last held ${dayLabel(at.lastHeld)}, so placed around ${dayLabel(at.date)} until the organiser announces the next one.`;
  else when = at.label ? `Dates not announced. ${at.label}.` : "Dates not announced.";

  /* Imminent says so in the countdown and discontinued has its own badge. An
     inferred date is never called upcoming: that is the word for scheduled. */
  const statusWord = at.discontinued ? ""
    : at.mode === "inferred" ? "Not confirmed"
    : { past: "Past", upcoming: "Upcoming" }[at.status] || "";

  return (
    <div>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        <EventLogo e={e} size={40} status={at.status} />
        <Heading id={headingId} style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.15 }}>
          {e.name}
        </Heading>
        <Countdown e={e} today={today} />
        {statusWord && <Pill>{statusWord}</Pill>}
        {at.discontinued && <Pill>discontinued</Pill>}
      </div>

      <p className="tnum" style={{ fontSize: F.md, color: C.text, margin: `${S.md}px 0 0`, lineHeight: 1.5, fontWeight: 600 }}>
        {when}
      </p>
      {where && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>{where}</p>}

      {e.one && <p style={{ fontSize: F.lg, lineHeight: 1.55, margin: `${S.lg}px 0 0` }}>{e.one}</p>}

      {facts.length > 0 && (
        <p className="flex flex-wrap items-baseline" style={{ gap: S.sm, margin: `${S.md}px 0 0` }}>
          {facts.map((f, i) => (
            <React.Fragment key={f}>
              {i > 0 && <Sep />}
              <span style={{ fontSize: F.xs, color: C.muted }}>{f}</span>
            </React.Fragment>
          ))}
        </p>
      )}

      {e.audience && (
        <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.lg}px 0 0` }}>
          <span style={{ color: C.muted }}>Who it is for. </span>{e.audience}
        </p>
      )}
      {e.relevance && RELEVANCE_LABEL[e.relevance] && (
        <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.xs}px 0 0` }}>
          <span style={{ color: C.muted }}>For an app vendor. </span>{RELEVANCE_LABEL[e.relevance]}.
        </p>
      )}

      {e.watch && (
        <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.md}px 0 0`, color: C.muted }}>
          <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{e.watch}
        </p>
      )}

      <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
        {e.url && (
          <a href={outbound(e.url)} target="_blank" rel="noopener noreferrer"
            style={{
              background: C.text, color: C.bg, borderRadius: R.control,
              padding: "8px 16px", fontSize: F.md, fontWeight: 700, textDecoration: "none",
            }}>{domain}</a>
        )}
        {socials.map(([key, href]) => (
          <a key={key} href={outbound(href)} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: F.sm, color: C.muted }}>{key === "x" ? "X" : key[0].toUpperCase() + key.slice(1)}</a>
        ))}
      </div>

      {e.updated && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xl}px 0 0`, lineHeight: 1.55 }}>
          Dates last checked against the organiser's site {formatDay(e.updated)}.
        </p>
      )}
    </div>
  );
}
