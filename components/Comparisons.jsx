import React from "react";
import { C, S, R, F, TRACK, ink, catOf, priceLine } from "@/lib/tools";
import { attributesFor, attributeValue, formatValue, isUnknown, integrationLabel, pricingDisplay } from "@/lib/categories";
import { launchCell } from "@/lib/launched";
import { OwnerFact } from "@/components/OwnerLine";
import { Pill } from "@/components/Pill";
import { outbound } from "@/lib/outbound";
import { pairSlug } from "@/lib/rivals";

/*
 * /alternatives/[tool] and /compare/[a]-vs-[b], server-rendered with no client
 * state, like components/ToolPage.jsx. Every sentence comparing two tools is
 * built from confirmed structured data (lib/rivals.js, differences); where a
 * tool is not confirmed the page says so rather than inventing one. Both
 * caveats are always here, in full, because the caveat is what makes this
 * worth reading rather than another comparison page.
 */

const WHY = {
  "same category": "same category",
  "named rivals": "named as a rival in this directory",
  "named on a vendor's comparison page": "named on a vendor's own comparison page",
};

const CatLabel = ({ tool }) => (
  <a href={`/categories/${tool.cat}`} style={{ fontSize: F.xs, color: ink(catOf(tool.cat).color), textDecoration: "none" }}>{catOf(tool.cat).label}</a>
);

const Watch = ({ tool, label = "Watch for." }) => (
  <p style={{ fontSize: F.sm, lineHeight: 1.6, color: C.muted, margin: `${S.sm}px 0 0` }}>
    <span style={{ color: C.warnInk, fontWeight: 700 }}>{label} </span>{tool.watch}
  </p>
);

function Differences({ items, subject }) {
  if (!items.length) {
    return (
      <p style={{ fontSize: F.sm, color: C.dim, margin: `${S.sm}px 0 0` }}>
        Details for one of these are not confirmed yet, so no difference from {subject} is stated.
      </p>
    );
  }
  return (
    <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18, fontSize: F.sm, lineHeight: 1.6, color: C.text }}>
      {items.map((d) => <li key={d}>{d}</li>)}
    </ul>
  );
}

const Crumbs = ({ items }) => (
  <nav aria-label="Breadcrumb" style={{ fontSize: F.sm, color: C.dim, marginTop: S["2xl"] }}>
    {items.map(([label, href], i) => (
      <React.Fragment key={label}>
        {i > 0 && " / "}
        {href ? <a href={href} style={{ color: C.muted }}>{label}</a> : <span>{label}</span>}
      </React.Fragment>
    ))}
  </nav>
);

export function AlternativesPage({ tool, owner, alts }) {
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 860, padding: "0 16px" }}>
        <Crumbs items={[["Directory", "/"], [tool.name, `/tools/${tool.id}`], ["Alternatives", ""]]} />
        <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: `${S.md}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
          Alternatives to {tool.name}
        </h1>
        <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "64ch" }}>
          {alts.length} {alts.length === 1 ? "tool competes" : "tools compete"} with {tool.name}: the same category, or named as
          a rival. Each difference below comes from details confirmed on the vendors' own sites, and each tool keeps its caveat.
        </p>

        <section style={{ marginTop: S.xl, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, background: C.panel }}>
          <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
            <a href={`/tools/${tool.id}`} style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none" }}>{tool.name}</a>
            <CatLabel tool={tool} />
            {tool.dying && <Pill tone="warn">winding down</Pill>}
          </div>
          <p style={{ fontSize: F.md, margin: `${S.xs}px 0 0` }}>{tool.one}</p>
          <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
            {priceLine(tool)}{owner?.line ? <> · <OwnerFact ctx={owner} /></> : null}
          </p>
          <Watch tool={tool} />
        </section>

        <ol style={{ listStyle: "none", padding: 0, margin: `${S.xl}px 0 0` }}>
          {alts.map(({ tool: t, why, diffs, owner: o }) => (
            <li key={t.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                <a href={`/tools/${t.id}`} style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none" }}>{t.name}</a>
                <CatLabel tool={t} />
                {t.dying && <Pill tone="warn">winding down</Pill>}
              </div>
              <p style={{ fontSize: F.md, margin: `${S.xs}px 0 0` }}>{t.one}</p>
              <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
                {priceLine(t)}{o?.line ? <> · <OwnerFact ctx={o} /></> : null}
              </p>
              <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
                Listed here because: {why.map((w) => WHY[w] || w).join(", ")}.
              </p>
              <Differences items={diffs} subject={tool.name} />
              <Watch tool={t} />
              <p style={{ fontSize: F.sm, margin: `${S.sm}px 0 0` }}>
                <a href={`/compare/${pairSlug(tool.id, t.id)}`} style={{ color: C.text }}>{tool.name} and {t.name} side by side</a>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

const cell = { padding: "8px 12px", fontSize: F.sm, verticalAlign: "top", borderTop: `1px solid ${C.line}`, lineHeight: 1.5 };
const head = { ...cell, color: C.muted, fontWeight: 500, textAlign: "left", width: "24%" };

function tiersOf(t) {
  const p = t.structured?.pricing;
  if (!p) return "Not confirmed yet";
  if (p.published === false) return "Not published";
  if (!p.tiers.length) return p.free === true ? "Free" : "No tiers stated";
  return p.tiers.map((x) => `${x.name ? `${x.name}: ` : ""}${pricingDisplay({ published: true, tiers: [x] })}`).join(", ");
}
const yesNo = (v) => (v === true ? "Yes" : v === false ? "No" : "Unknown");

export function ComparePage({ a, b, ownerA, ownerB, why, diffsA, diffsB }) {
  const same = a.cat === b.cat;
  const rows = [
    ["Category", (t) => catOf(t.cat).label],
    ["What it is", (t) => t.one],
    ["Price", (t) => priceLine(t)],
    ["Pricing tiers", tiersOf],
    ["Free plan", (t) => (t.structured ? yesNo(t.structured.pricing.free) : "Not confirmed yet")],
    ["Trial", (t) => (!t.structured ? "Not confirmed yet" : isUnknown(t.structured.pricing.trialDays) ? "Unknown" : Number(t.structured.pricing.trialDays) > 0 ? `${t.structured.pricing.trialDays} days` : "None")],
    ...(same ? attributesFor(a.cat).filter((x) => x.comparable).map((attr) => [attr.label, (t) => (t.structured ? formatValue(attr, attributeValue(attr, t.structured)) : "Not confirmed yet")]) : []),
    ["Integrations", (t) => (!t.structured ? "Not confirmed yet" : t.structured.integrations.length ? t.structured.integrations.map(integrationLabel).join(", ") : "None stated")],
    ["Ownership", (t, o) => (o?.line ? <OwnerFact ctx={o} /> : "Independent, as far as its site says")],
    ["Status", (t) => (t.dying ? "Winding down" : "Active")],
    ["Launched", (t) => launchCell(t)],
  ];
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 960, padding: "0 16px" }}>
        <Crumbs items={[["Directory", "/"], [`${a.name} vs ${b.name}`, ""]]} />
        <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: `${S.md}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
          {a.name} vs {b.name}
        </h1>
        <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "64ch" }}>
          Compared because they are in the {why.map((w) => WHY[w] || w).join(", and ")}. Values come from details confirmed on each
          vendor's own site. Unknown means the site does not say.
        </p>

        <div style={{ overflowX: "auto", marginTop: S.xl }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ ...head, borderTop: 0 }} />
                {[a, b].map((t) => (
                  <th key={t.id} style={{ ...cell, borderTop: 0, textAlign: "left", fontSize: F.lg }}>
                    <a href={`/tools/${t.id}`} style={{ color: C.text, textDecoration: "none" }}>{t.name}</a>
                    <div style={{ height: 3, background: catOf(t.cat).color, borderRadius: 2, marginTop: S.sm }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tnum">
              {rows.map(([label, fn]) => (
                <tr key={label}>
                  <th scope="row" style={head}>{label}</th>
                  <td style={cell}>{fn(a, ownerA)}</td>
                  <td style={cell}>{fn(b, ownerB)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section style={{ marginTop: S.xl }}>
          <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0 }}>The caveats</h2>
          <Watch tool={a} label={`${a.name}.`} />
          <Watch tool={b} label={`${b.name}.`} />
        </section>

        <section style={{ marginTop: S.xl }}>
          <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0 }}>How {b.name} differs from {a.name}</h2>
          <Differences items={diffsB} subject={a.name} />
          <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: `${S.lg}px 0 0` }}>How {a.name} differs from {b.name}</h2>
          <Differences items={diffsA} subject={b.name} />
        </section>

        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xl}px 0 0`, lineHeight: 1.7 }}>
          <a href={`/alternatives/${a.id}`} style={{ color: C.text }}>Alternatives to {a.name}</a>{" · "}
          <a href={`/alternatives/${b.id}`} style={{ color: C.text }}>Alternatives to {b.name}</a>
          <br />
          To compare up to four tools at once, pick them with Compare in the{" "}
          <a href="/" style={{ color: C.text }}>directory</a>. Sites:{" "}
          <a href={outbound(a.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{a.domain}</a>,{" "}
          <a href={outbound(b.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{b.domain}</a>.
        </p>
      </div>
    </main>
  );
}
