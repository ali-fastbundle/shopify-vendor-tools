import { readFile } from "fs/promises";
import { join } from "path";
import { ImageResponse } from "next/og";
import { C, CATEGORIES, TOOLS } from "@/lib/tools";

/*
 * The share card. Same mark, same palette and the same counts as the masthead,
 * read from lib/tools.js so the card cannot drift from the catalogue.
 *
 * Next wires this into og:image on its own; app/twitter-image.jsx re-exports it
 * so twitter:image resolves too.
 */
export const alt = "Watch For Tools — the app vendor's toolkit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
 * Archivo, vendored under app/_fonts (OFL-1.1, see OFL.txt alongside it).
 *
 * Fetching it from Google at build time was the obvious approach and the wrong
 * one twice over: the format depends on how the request identifies itself — a
 * browser UA gets woff2 and an old one gets EOT, and satori parses neither — and
 * it makes the card's typeface depend on network conditions during a build, so a
 * blocked or slow fetch silently ships a card in the wrong font. Reading the file
 * is deterministic and needs no egress.
 *
 * Read off disk rather than through `fetch(new URL(..., import.meta.url))`: that
 * is the pattern in the Next docs, but it resolves to a file: URL and undici does
 * not implement that scheme, so it lands in the catch and falls back without
 * saying so. next.config.mjs traces app/_fonts into the bundle so the read still
 * works once deployed.
 */
const FACES = [
  { weight: 800, file: "Archivo-800.ttf" },
  { weight: 500, file: "Archivo-500.ttf" },
];

async function archivo() {
  try {
    return await Promise.all(
      FACES.map(async ({ weight, file }) => ({
        name: "Archivo",
        data: await readFile(join(process.cwd(), "app", "_fonts", file)),
        weight,
        style: "normal",
      })),
    );
  } catch {
    // Falls back to next/og's bundled face. A share image is not worth failing a
    // build over, but the card will look wrong, so check here first if it does.
    return [];
  }
}

export default async function Image() {
  const fonts = await archivo();

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: C.bg, color: C.text,
        padding: "70px 80px", fontFamily: fonts.length ? "Archivo" : "sans-serif",
      }}>
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", marginRight: 18 }}>
            {CATEGORIES.map((c) => (
              <div key={c.id} style={{ width: 6, height: 34, borderRadius: 3, background: c.color, marginRight: 4 }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 800, letterSpacing: "-0.04em" }}>
            <div style={{ marginRight: 11 }}>Watch For</div>
            <div style={{ color: "#00E08A" }}>Tools</div>
          </div>
        </div>

        {/* The h1, verbatim */}
        <div style={{
          display: "flex", fontSize: 96, fontWeight: 800,
          letterSpacing: "-0.045em", lineHeight: 1.03, maxWidth: 900,
        }}>
          {"The app vendor's toolkit"}
        </div>

        {/* Counts over the full palette */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", marginBottom: 22 }}>
            {CATEGORIES.map((c) => (
              <div key={c.id} style={{ width: 74, height: 8, borderRadius: 4, background: c.color, marginRight: 11 }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: C.muted }}>
            {`${TOOLS.length} tools · ${CATEGORIES.length} categories`}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
