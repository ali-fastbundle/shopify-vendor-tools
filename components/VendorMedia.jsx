import React from "react";
import { C, S, R, F } from "@/lib/tools";
import { outbound } from "@/lib/outbound";

/*
 * Screenshots and a demo link the vendor supplied and an editor approved
 * (lib/media.js). Labelled as the vendor's, because it is their material and
 * the directory has not tested what it shows. Images are files in this
 * repository with their real sizes, so nothing shifts as they load. The video
 * is a plain link: no embedded player and no third-party script.
 */
export default function VendorMedia({ tool }) {
  const m = tool?.vendorMedia;
  if (!m || (!m.screenshots?.length && !m.video)) return null;
  let host = "";
  try { host = m.video ? new URL(m.video.url).hostname.replace(/^www\./, "") : ""; } catch {}
  return (
    <section style={{ marginTop: S.xl }} aria-label={`Screenshots and video from ${tool.name}`}>
      <h2 style={{ fontSize: F.xs, color: C.dim, margin: 0, fontWeight: 600 }}>From the vendor</h2>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
        Supplied by {tool.name}. The directory has not tested what these show.
      </p>
      {m.screenshots?.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.sm }}>
          {m.screenshots.map((s) => (
            <a key={s.path} href={s.path} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "min(100%, 300px)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.path} alt={s.alt} width={s.width} height={s.height} loading="lazy"
                style={{ width: "100%", height: "auto", border: `1px solid ${C.line}`, borderRadius: R.control, display: "block" }} />
            </a>
          ))}
        </div>
      )}
      {m.video && (
        <p style={{ fontSize: F.sm, margin: `${S.sm}px 0 0` }}>
          <a href={outbound(m.video.url)} target="_blank" rel="nofollow ugc noopener noreferrer" style={{ color: C.text }}>
            Watch the demo video{host ? ` on ${host}` : ""}
          </a>
        </p>
      )}
    </section>
  );
}
