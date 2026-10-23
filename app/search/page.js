import { C, S, R, F, TRACK } from "@/lib/tools";
import { mergedTools, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { searchAll, summaryLine, cleanQuery, MIN_QUERY, MAX_QUERY } from "@/lib/universalSearch";

/*
 * Search across every section: tools, categories, newsletters, events (past
 * ones included), blog posts and owners. lib/universalSearch.js decides what
 * matches; this renders it.
 *
 * Server-rendered from ?q=, with a plain GET form, so it works with
 * JavaScript off and a search is a link anyone can send. Dynamic because the
 * answer depends on the query and on today (an event's past or upcoming).
 * Noindex: a page per query is the duplicate-content problem the filtered
 * directory views avoid by canonicalising to /.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const q = cleanQuery(searchParams?.q);
  return {
    title: q ? `Search: ${q} | watchfor.tools` : "Search | watchfor.tools",
    alternates: { canonical: "/search" },
    robots: { index: false, follow: true },
  };
}

export default async function Page({ searchParams }) {
  const q = cleanQuery(searchParams?.q);
  const [tools, newsletters, events] = q.length >= MIN_QUERY
    ? await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents()])
    : [[], [], []];
  const result = searchAll(q, { tools, newsletters, events });

  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.15 }}>
            Search
          </h1>
          <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5, margin: `${S.xs}px 0 0` }}>
            Tools, categories, newsletters, events, blog posts and owners. Past events are included.
          </p>
        </header>

        <form action="/search" method="get" role="search" className="flex" style={{ gap: S.sm, marginTop: S.lg }}>
          <input type="search" name="q" defaultValue={q} maxLength={MAX_QUERY} aria-label="Search everything"
            placeholder="A tool, a city, an organizer, a topic"
            style={{
              flex: 1, minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
              padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit",
            }} />
          <button type="submit" className="ctl press" style={{
            background: C.text, color: C.bg, border: 0, borderRadius: R.control,
            padding: "8px 16px", fontSize: F.md, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>Search</button>
        </form>

        <div role="status" style={{ marginTop: S.lg }}>
          {!q ? null : q.length < MIN_QUERY ? (
            <p style={{ fontSize: F.md, color: C.muted, margin: 0 }}>Type at least {MIN_QUERY} characters.</p>
          ) : result.total ? (
            <p className="tnum" style={{ fontSize: F.md, color: C.muted, margin: 0 }}>
              {summaryLine(result)}
            </p>
          ) : (
            <p style={{ fontSize: F.lg, margin: 0 }}>Nothing matches “{q}”.</p>
          )}
        </div>

        {/* One link per section with results, so a long list of tools does
            not hide the two events further down. */}
        {result.groups.length > 1 && (
          <nav aria-label="Result sections" className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.md }}>
            {result.groups.map((g) => (
              <a key={g.kind} href={`#r-${g.kind}`} className="ctl press tnum" style={{
                background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.pill,
                padding: "4px 12px", fontSize: F.sm, fontWeight: 600, color: C.text, textDecoration: "none",
              }}>{g.label} {g.items.length}</a>
            ))}
          </nav>
        )}

        {result.groups.map((g) => (
          <section key={g.kind} aria-labelledby={`r-${g.kind}`} data-kind={g.kind} style={{ marginTop: S["2xl"] }}>
            <h2 id={`r-${g.kind}`} className="tnum" style={{ fontSize: F.lg, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              {g.label} <span style={{ color: C.muted, fontWeight: 600 }}>{g.items.length}</span>
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.sm}px 0 0` }}>
              {g.items.map((it) => (
                <li key={it.id} className="card" style={{
                  background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
                  padding: "12px 16px", marginTop: S.sm, opacity: it.past ? 0.8 : 1,
                }}>
                  <a href={it.href} className="card-link" style={{ fontSize: F.md, fontWeight: 700, color: C.text, textDecoration: "none" }}>
                    {it.name}
                  </a>
                  {it.meta && (
                    <p className="tnum" style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0` }}>{it.meta}</p>
                  )}
                  {it.one && (
                    <p style={{ fontSize: F.sm, color: C.text, lineHeight: 1.5, margin: `${S.xs}px 0 0` }}>{it.one}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {q.length >= MIN_QUERY && (
          <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6, margin: `${S["2xl"]}px 0 ${S["3xl"]}px` }}>
            {result.total ? "Not what you need? " : ""}
            <a href={`/?ask=${encodeURIComponent(q)}`} style={{ color: C.accentInk, fontWeight: 600 }}>Ask the directory</a>
            {" "}in your own words: it answers from every section and says when nothing fits. Or{" "}
            <a href={`/?suggest=tool&why=${encodeURIComponent(q)}`} style={{ color: C.accentInk, fontWeight: 600 }}>suggest what is missing</a>.
          </p>
        )}
      </div>
    </main>
  );
}
