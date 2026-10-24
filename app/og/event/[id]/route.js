import { ImageResponse } from "next/og";
import { DARK, CATEGORIES } from "@/lib/tools";
import { placed, todayISO } from "@/lib/events";
import { mergedEvents } from "@/lib/listings";
import { eventOgFacts, ogVersion } from "@/lib/ogCard";
import { inter } from "@/lib/ogFont";

export const dynamic = "force-dynamic";

/*
 * One event's share card: its name, when, where and who runs it, from
 * eventOgFacts (lib/ogCard.js), the same function the URL version hashes.
 * Used as the event page's share image and as the Event schema's image.
 * An unconfirmed date says so on the card, as it does everywhere else.
 */
const size = { width: 1200, height: 630 };

export async function GET(_request, { params }) {
  const e = placed(await mergedEvents(), todayISO()).find((x) => x.id === params.id);
  if (!e) return new Response("Not found", { status: 404 });
  const fonts = await inter();
  const f = eventOgFacts(e);
  const big = f.name.length > 42 ? 60 : f.name.length > 26 ? 74 : 88;

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: DARK.bg, color: DARK.text,
        padding: "70px 80px", fontFamily: fonts.length ? "Inter" : "sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", marginRight: 18 }}>
            {CATEGORIES.map((c) => (
              <div key={c.id} style={{ width: 6, height: 30, borderRadius: 3, background: c.color, marginRight: 4 }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em" }}>
            <div style={{ marginRight: 10 }}>Watch For</div>
            <div style={{ color: "#00E08A" }}>Tools</div>
            <div style={{ marginLeft: 18, color: DARK.muted, fontWeight: 500 }}>Events</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: big, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, maxWidth: 1040 }}>
            {f.name}
          </div>
          {f.organizer && (
            <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: DARK.muted, marginTop: 18 }}>{`by ${f.organizer}`}</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {f.when && <div style={{ display: "flex", fontSize: 38, fontWeight: 800 }}>{f.past ? `${f.when} (past)` : f.when}</div>}
          {f.place && <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: DARK.muted, marginTop: 8 }}>{f.place}</div>}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined, headers: { "x-og-version": ogVersion(f) } },
  );
}
