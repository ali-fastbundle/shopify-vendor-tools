import React from "react";
import { C, S, F } from "@/lib/tools";
import { attributesFor, attributeValue, formatValue, isUnknown, integrationLabel } from "@/lib/categories";
import { launchCell } from "@/lib/launched";

/*
 * A tool's confirmed attributes and integrations (lib/categories.js), as one
 * compact table. Renders nothing until the editor has confirmed the tool, and
 * shows Unknown for anything the vendor does not state: Unknown is the answer,
 * not a gap to hide. No state, so it is in the server HTML on the tool page
 * and renders the same inside the modal.
 */
export default function StructuredDetails({ tool }) {
  const s = tool?.structured;
  if (!s) return null;
  const attrs = attributesFor(tool.cat);
  return (
    <section style={{ marginTop: S.xl }}>
      <h2 style={{ fontSize: F.xs, color: C.dim, margin: 0, fontWeight: 600 }}>Details</h2>
      <table style={{ borderCollapse: "collapse", marginTop: S.sm, fontSize: F.sm, width: "100%", maxWidth: 520 }}>
        <tbody>
          {/* On every tool, whatever its category: age is a caveat here. */}
          <tr style={{ borderTop: `1px solid ${C.line}` }}>
            <th scope="row" style={{ textAlign: "left", fontWeight: 500, color: C.muted, padding: "6px 12px 6px 0", width: "50%" }}>Launched</th>
            <td style={{ padding: "6px 0", color: launchCell(tool) === "Unknown" ? C.dim : C.text }}>{launchCell(tool)}</td>
          </tr>
          {attrs.map((a) => {
            const v = attributeValue(a, s);
            return (
              <tr key={a.key} style={{ borderTop: `1px solid ${C.line}` }}>
                <th scope="row" style={{ textAlign: "left", fontWeight: 500, color: C.muted, padding: "6px 12px 6px 0", width: "50%" }}>{a.label}</th>
                <td style={{ padding: "6px 0", color: isUnknown(v) ? C.dim : C.text }}>{formatValue(a, v)}</td>
              </tr>
            );
          })}
          <tr style={{ borderTop: `1px solid ${C.line}` }}>
            <th scope="row" style={{ textAlign: "left", fontWeight: 500, color: C.muted, padding: "6px 12px 6px 0" }}>Integrations</th>
            <td style={{ padding: "6px 0", color: s.integrations?.length ? C.text : C.dim }}>
              {s.integrations?.length ? s.integrations.map(integrationLabel).join(", ") : "None stated"}
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
        From the vendor's own site, confirmed {String(s.confirmedAt).slice(0, 10)}. Unknown means the site does not say.
      </p>
    </section>
  );
}
