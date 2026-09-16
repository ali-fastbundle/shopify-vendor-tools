import { readFile } from "fs/promises";
import { join } from "path";
import { ImageResponse } from "next/og";
import { DARK, CATEGORIES, TOOLS, HEADLINE } from "@/lib/tools";

/*
 * The share card, served from a route we name ourselves.
 *
 * It was an opengraph-image.jsx file convention, which Next wires up
 * automatically — and that is the problem: the convention also owns the URL,
 * appending a hash of its own build output and overriding any og:image set in
 * metadata. The image is generated from the catalogue rather than from this
 * file, so that hash does not move when a tool is added, and messengers cache
 * hard against the URL. Owning the route means owning the query string, so
 * app/layout.js can version it on the catalogue instead.
 */
const size = { width: 1200, height: 630 };

/*
 * The card is always dark, and reads the literal DARK palette rather than C:
 * satori resolves no CSS variables, and an image has no system preference to
 * follow anyway.
 *
 * Inter, vendored under app/_fonts (OFL-1.1, see OFL.txt alongside it) — the
 * same face the page is set in, because the card's whole job is to be the page.
 * app/layout.js gets its copy from next/font, which is a different problem:
 * that one wants a variable woff2 for a browser and has Next's build cache
 * behind it. This one wants a static TTF that satori can parse, and there is
 * no equivalent of next/font for an image.
 *
 * Fetching it from Google here at build time was the obvious approach and the
 * wrong one twice over: the format depends on how the request identifies
 * itself — a browser UA gets woff2 and an old one gets EOT, and satori parses
 * neither — and it makes the card's typeface depend on network conditions
 * during a build, so a blocked or slow fetch silently ships a card in the wrong
 * font. Reading the file is deterministic and needs no egress.
 *
 * Read off disk rather than through `fetch(new URL(..., import.meta.url))`: that
 * is the pattern in the Next docs, but it resolves to a file: URL and undici does
 * not implement that scheme, so it lands in the catch and falls back without
 * saying so. next.config.mjs traces app/_fonts into the bundle so the read still
 * works once deployed.
 */
const FACES = [
  { weight: 800, file: "Inter-800.ttf" },
  { weight: 500, file: "Inter-500.ttf" },
];

async function inter() {
  try {
    return await Promise.all(
      FACES.map(async ({ weight, file }) => ({
        name: "Inter",
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

export async function GET() {
  const fonts = await inter();

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: DARK.bg, color: DARK.text,
        padding: "70px 80px", fontFamily: fonts.length ? "Inter" : "sans-serif",
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

        {/* The h1 itself, read from the same constant the page uses */}
        <div style={{
          display: "flex", fontSize: 96, fontWeight: 800,
          letterSpacing: "-0.045em", lineHeight: 1.03, maxWidth: 900,
        }}>
          {HEADLINE}
        </div>

        {/* Counts over the full palette */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", marginBottom: 22 }}>
            {CATEGORIES.map((c) => (
              <div key={c.id} style={{ width: 74, height: 8, borderRadius: 4, background: c.color, marginRight: 11 }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: DARK.muted }}>
            {`${TOOLS.length} tools · ${CATEGORIES.length} categories`}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
