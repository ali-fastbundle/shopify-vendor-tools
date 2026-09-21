import React from "react";
import { outbound } from "@/lib/outbound";
import {
  C, S, R, F, TRACK, ink, catOf, secondaryCats, socialLabel, SOCIALS,
  formatDay, ownerOf,
} from "@/lib/tools";
import { toolDescription, logoAlt } from "@/lib/seo";
/*
 * The only client component in this tree, and it holds no state: `Pill` marks
 * a boundary and renders its span in the first response like anything else.
 * Importing it rather than re-declaring the eight lines is colour invariant B's
 * whole point, which is that this badge looks the same everywhere it appears.
 */
import { Pill } from "@/components/Pill";

/*
 * One tool, at its own URL, rendered on the server.
 *
 * Deliberately NOT a client component and deliberately not sharing the modal's
 * code. The modal is interactive: it votes, it opens a review form, it carries
 * a session. This has to be complete in the HTML for a crawler that will never
 * run a line of our JavaScript, and the quickest way to fail at that is to
 * reuse a component whose content arrives after hydration.
 *
 * So it renders the same facts with no state at all: no useState, no effects,
 * no fetch. Everything on the page is in the first response. Reviews are read
 * on the server and printed; voting and rating live on the directory page,
 * which this links back to.
 *
 * The visual language is the public site's, from lib/tools.js. The spine, the
 * category colour through ink(), the neutral attribute line, the solid
 * VisitSite treatment: all the same rules, because a tool page that looked
 * like a different site would read as a different site.
 */

const Fact = ({ children }) => (
  <span style={{ fontSize: F.xs, color: C.muted }}>{children}</span>
);

function Facts({ tool }) {
  const facts = [
    tool.price,
    tool.free && "free plan",
    tool.suite && `part of ${tool.suite}`,
    tool.linked && `same owner as ${tool.linked}`,
    ownerOf(tool) && `by ${ownerOf(tool)}`,
    tool.suggestedBy >= 2 && `suggested by ${tool.suggestedBy} people`,
    /* The one qualifier a general tool's own page cannot be without. It is the
       badge from the list row and the modal, set as type here because on this
       page every attribute is type. Absent or true renders nothing, per
       invariant 19: there is no "Shopify-only" label. */
    tool.shopifyExclusive === false && "not Shopify-only",
    tool.claimed && "claimed",
  ].filter(Boolean);

  return (
    <p className="flex flex-wrap items-baseline" style={{ gap: S.sm, margin: `${S.md}px 0 0` }}>
      {facts.map((f, i) => (
        <React.Fragment key={f}>
          {i > 0 && <span aria-hidden="true" style={{
            width: 1, height: 9, background: C.edge, display: "inline-block", opacity: 0.7,
          }} />}
          <Fact>{f}</Fact>
        </React.Fragment>
      ))}
    </p>
  );
}

/*
 * The way a vendor gets from this page to the form that edits it.
 *
 * The page had no affordance for that at all. Everything it offered was one
 * 12px grey line reading "Rate it, review it or report a problem on the
 * directory", which names none of the three things an owner arrives here to
 * do: claim the listing, correct the copy, or find out they cannot. A vendor
 * who lands on their own entry from a search result had no visible route to
 * it and no reason to think one existed.
 *
 * The form itself cannot be here. `OwnerPanel` mints a claim token, checks a
 * domain, carries a session and holds an edit form, all of which is client
 * state, and this file has none on purpose (invariant 28). So this is a link,
 * not a form: it points at `/?tool=<id>`, which the directory validates
 * against the catalogue and opens as the listing with `OwnerPanel` inside it.
 * Same trick as the category label being an anchor rather than a filter chip.
 *
 * Four states, keyed on who is looking, because the wrong invitation is worse
 * than none:
 *
 *   admin      can edit any listing and is the one person who does not need
 *              asking "is this your tool?". That question was the only thing
 *              this offered, so an editor arriving on an entry from a search
 *              result had no route to the form at all.
 *   owner      has verified the domain already, so it is an edit link rather
 *              than a claim pitch.
 *   claimed    by somebody else: says the vendor maintains it, rather than
 *              inviting a claim that would 409.
 *   otherwise  the invitation, with the boundary stated up front. A vendor who
 *              reads "edit your listing" and then discovers they cannot touch
 *              `watch` has been sold something.
 *
 * `viewer` is worked out on the server from the session cookie, so this stays
 * a server component with no client state and the whole page is still in the
 * first response. It is an affordance and never a permission: `/api/listing`
 * re-derives the session and re-checks `ownsListing || isAdmin` on every
 * write. Invariant 7.
 *
 * Dashed border and no fill, which is `OwnerPanel`'s own unclaimed treatment.
 * It is the same offer, so it looks like the same offer. No accent either:
 * green is the action colour and `Visit site` is the action on this page, so a
 * second green control would argue with the first.
 */
function OwnerInvite({ tool, viewer = {} }) {
  const href = `/?tool=${encodeURIComponent(tool.id)}`;

  /*
   * An editor or the verified owner gets a control, not a pitch. Accent edge
   * rather than the dashed border, because that is exactly how `OwnerPanel`
   * marks a listing you already control and the two surfaces should read as
   * the same state.
   */
  if (viewer.admin || viewer.owns) {
    return (
      <div style={{
        marginTop: S.xl, border: `1px solid ${C.accentEdge}`, borderRadius: R.card, padding: S.lg,
      }}>
        <p style={{ fontSize: F.md, fontWeight: 600, color: C.accentInk, margin: 0 }}>
          {viewer.owns ? "You own this listing" : "Editing as admin"}
        </p>
        {/*
          * The boundary holds for an admin too, and saying so beats letting
          * them find out: `sanitiseEdit` accepts the EDITABLE set only, and
          * `mergedTools()` restates the protected fields over any override.
          * The category, the caveat and the external ratings move by editing
          * lib/tools.js, which is reviewable in git. That is the design rather
          * than a missing feature.
          */}
        <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "64ch" }}>
          The summary, description, pricing, site URL and social links are editable here. The
          category, the "watch for" note, the external ratings and the community reviews are not,
          for anybody: those are a hand edit to the catalogue file.
        </p>
        <a href={href} style={{
          display: "inline-block", marginTop: S.md,
          background: C.accent, color: C.onAccent, borderRadius: R.control,
          padding: "8px 16px", fontSize: F.sm, fontWeight: 700, textDecoration: "none",
        }}>Edit this listing</a>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: S.xl, border: `1px dashed ${C.line}`, borderRadius: R.card, padding: S.lg,
    }}>
      <p style={{ fontSize: F.md, fontWeight: 700, margin: 0 }}>
        {tool.claimed ? `${tool.name} maintains this listing` : "Is this your tool?"}
      </p>
      <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "64ch" }}>
        {tool.claimed ? (
          <>
            The summary, description, pricing and links above are the vendor's. If you are the
            vendor, open the listing to change them. The category, the "watch for" note and the
            community ratings stay with the editors.
          </>
        ) : (
          <>
            Claim it and you can edit the summary, description, pricing, site and social links.
            The category, the "watch for" note and the community ratings stay with the editors,
            which is the point of the directory. Any email works: ownership is proved against the
            site rather than the address you sign in with.
          </>
        )}
      </p>
      {/*
        * `C.text` on `C.bg`, the neutral inversion, rather than the accent.
        * It is a real destination, so it is an anchor, and it works with
        * JavaScript off exactly like everything else on this page.
        */}
      <a href={href} style={{
        display: "inline-block", marginTop: S.md,
        background: C.text, color: C.bg, borderRadius: R.control,
        padding: "8px 16px", fontSize: F.sm, fontWeight: 700, textDecoration: "none",
      }}>{tool.claimed ? "Open the listing to edit it" : "Claim and edit this listing"}</a>
    </div>
  );
}

export default function ToolPage({ tool, related, reviews = [], rating, viewer = {}, lastUpdated }) {
  const col = catOf(tool.cat).color;
  const socials = SOCIALS
    .map(({ key }) => [key, tool.social?.[key]])
    .filter(([, href]) => href);

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 20px" }}>

        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          {/* The category page, not `/#cat`. That fragment landed on the
              directory and set nothing, because the filter is client state. */}
          <a href={`/categories/${tool.cat}`} style={{ color: ink(col), textDecoration: "none" }}>
            {catOf(tool.cat).label}
          </a>
          <span style={{ color: C.dim }}> / </span>
          <span style={{ color: C.text }}>{tool.name}</span>
        </nav>

        <article style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
          overflow: "hidden", marginTop: S.xl,
        }}>
          {/* The spine, same 4px as the detail modal. */}
          <div style={{ height: 4, background: col }} />
          <div style={{ padding: S["2xl"] }}>
            <div className="flex items-start" style={{ gap: S.lg }}>
              {tool.logo && (
                <img src={tool.logo} alt={logoAlt(tool)} width={46} height={46}
                  style={{
                    width: 46, height: 46, borderRadius: R.card, flexShrink: 0,
                    background: "#FFFFFF", objectFit: "contain", padding: S.xs,
                  }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                  <h1 style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter }}>
                    {tool.name}
                  </h1>
                  {tool.dying && <Pill tone="warn">winding down</Pill>}
                </div>
                {/* Every category, each linking to its page. The primary keeps
                    the colour; the rest follow in their own ink after "also
                    in", so nothing has to explain which is which. */}
                <p className="flex flex-wrap items-baseline" style={{ gap: S.sm, margin: `${S.xs}px 0 0` }}>
                  <a href={`/categories/${tool.cat}`}
                    style={{ fontSize: F.sm, color: ink(col), textDecoration: "none" }}>
                    {catOf(tool.cat).label}
                  </a>
                  {secondaryCats(tool).length > 0 && (
                    <span style={{ fontSize: F.xs, color: C.dim }}>
                      {"also in "}
                      {secondaryCats(tool).map((id, i) => (
                        <React.Fragment key={id}>
                          {i > 0 && ", "}
                          <a href={`/categories/${id}`}
                            style={{ color: ink(catOf(id).color), textDecoration: "none" }}>
                            {catOf(id).label}
                          </a>
                        </React.Fragment>
                      ))}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <p style={{ fontSize: F.lg, lineHeight: 1.55, margin: `${S.lg}px 0 0`, color: C.text }}>
              {tool.one}
            </p>

            <Facts tool={tool} />

            <p style={{ fontSize: F.lg, lineHeight: 1.62, margin: `${S.xl}px 0 0` }}>{tool.note}</p>

            {/* The caveat, and the reason this directory exists. It is in the
                server HTML because it is the part worth citing. */}
            <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.md}px 0 0`, color: C.muted }}>
              <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{tool.watch}
            </p>

            {tool.ratings?.length > 0 && (
              <section style={{ marginTop: S.xl }}>
                <h2 style={{ fontSize: F.xs, color: C.dim, margin: 0, fontWeight: 600 }}>External ratings</h2>
                <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18 }}>
                  {tool.ratings.map((r) => (
                    <li key={r.source} style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6 }}>
                      <a href={outbound(r.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>
                        {r.source}
                      </a>
                      {r.score != null && <> {r.score}{r.outOf && r.outOf !== 5 ? `/${r.outOf}` : ""}</>}
                      {r.count != null && <> from {r.count}</>}
                      {r.captured && <span style={{ color: C.dim }}>, read {formatDay(r.captured)}</span>}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0`, lineHeight: 1.5 }}>
                  Collected on other platforms, from a different set of people than the reviews here,
                  and deliberately never averaged together.
                </p>
              </section>
            )}

            <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
              <a href={outbound(tool.url)} target="_blank" rel="noopener noreferrer"
                style={{
                  background: C.text, color: C.bg, borderRadius: R.control,
                  padding: "8px 16px", fontSize: F.md, fontWeight: 700, textDecoration: "none",
                }}>{tool.domain}</a>
              {socials.map(([key, href]) => (
                <a key={key} href={outbound(href)} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: F.sm, color: C.muted }}>{socialLabel(key)}</a>
              ))}
            </div>

            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xl}px 0 0`, lineHeight: 1.55 }}>
              {tool.updated && <>Entry last checked {formatDay(tool.updated)}. </>}
              <a href={`/?tool=${encodeURIComponent(tool.id)}`} style={{ color: C.muted }}>
                Rate it, review it or report a problem on the directory
              </a>.
            </p>

            {/* Two different readers, so two separate controls. The line above
                is for a visitor, this is for whoever owns the thing. They were
                one grey sentence that served the first and hid the second. */}
            <OwnerInvite tool={tool} viewer={viewer} />
          </div>
        </article>

        {reviews.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              What people say
              {rating && (
                <span className="tnum" style={{ fontSize: F.md, color: C.muted, fontWeight: 500, marginLeft: S.sm }}>
                  {rating.ratingValue} from {rating.ratingCount}
                </span>
              )}
            </h2>
            <div style={{ marginTop: S.md }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <p style={{ fontSize: F.sm, margin: 0 }}>
                    <b>{r.author}</b>
                    <span className="tnum" style={{ color: C.star, marginLeft: S.sm }}>
                      {"★".repeat(r.rating)}<span style={{ color: C.starOff }}>{"★".repeat(5 - r.rating)}</span>
                    </span>
                    <span style={{ color: C.dim, marginLeft: S.sm }}>{r.date}</span>
                  </p>
                  {r.text && <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: `${S.xs}px 0 0` }}>{r.text}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/*
          * The links that make the catalogue crawlable from any entry. Without
          * these every tool page is an orphan: reachable from the sitemap once,
          * linked from nothing, and quietly dropped.
          */}
        {related.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              Related tools
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
              {related.map(({ tool: t, why }) => (
                <li key={t.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <a href={`/tools/${t.id}`} style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>
                    {t.name}
                  </a>
                  <span style={{ fontSize: F.xs, color: ink(catOf(t.cat).color), marginLeft: S.sm }}>
                    {catOf(t.cat).label}
                  </span>
                  {/* Empty where the category label above already says it.
                      Rule E: when there is nothing to add, render nothing. */}
                  {why && (
                    <span style={{ fontSize: F.xs, color: C.dim, marginLeft: S.sm }}>{why}</span>
                  )}
                  <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{t.one}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"] }}>
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch" }}>
            <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory of
            tools for Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify.
            No affiliate links and no paid placement. Directory last updated {lastUpdated}.
          </p>
        </footer>
      </div>
    </main>
  );
}
