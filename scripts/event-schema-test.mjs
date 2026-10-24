#!/usr/bin/env node
/*
 * The Event schema fills optional fields only from published facts:
 * organizer with a URL, performers, offers, a per-event image. node scripts/event-schema-test.mjs
 *
 *   node scripts/follow-test.mjs
 *
 * No server and no keys. lib/ and the route handlers are loaded directly with
 * an import hook that resolves `@/` and extensionless paths, against the
 * in-memory store (no UPSTASH variables are set here). The network is stubbed:
 * feeds come from fixtures and Resend from a fetch that records what it was
 * given, so the assertions are about the emails that would have gone out.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "event-schema-secret";
process.env.RESEND_API_KEY = "re_test";
process.env.ADMIN_EMAILS = "admin@example.com";

const hook = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = ${JSON.stringify(pathToFileURL(root + "/").href)};
export async function resolve(spec, ctx, next) {
  let target = null;
  if (spec.startsWith("@/")) target = new URL(spec.slice(2), ROOT).href;
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL) target = new URL(spec, ctx.parentURL).href;
  if (target && !/\\.[mc]?jsx?$/.test(target)) {
    for (const ext of [".js", ".jsx"]) if (existsSync(fileURLToPath(target + ext))) return next(target + ext, ctx);
  }
  return next(spec, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hook));
const L = (p) => import(pathToFileURL(join(root, p)).href);
const { eventGraph, organizerUrlOf, offersOf } = await L("lib/seo.js");
const { EVENTS, placed } = await L("lib/events.js");
const { eventOgFacts, eventSharePath } = await L("lib/ogCard.js");
const fs = await import("node:fs");
let failed = 0;
const ok = (c, w, x = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${w}${x ? `  ${x}` : ""}`); if (!c) failed++; };
const T = "2026-10-24";
const P = placed(EVENTS, T);
const ev = (g) => g["@graph"].find((n) => n["@type"] === "Event");

console.log("organizer:");
const graphs = P.map((e) => [e, ev(eventGraph(e, { image: "https://watchfor.tools/og/event/x" }))]).filter(([, n]) => n);
ok(graphs.every(([, n]) => !n.organizer || /^https:\/\//.test(n.organizer.url)), "every organizer node has a URL", `${graphs.filter(([, n]) => n.organizer).length} of ${graphs.length}`);
ok(graphs.some(([e, n]) => e.organizer && !n.organizer), "and an organizer with no known site gets no node at all, not a bare name");
ok(organizerUrlOf({ organizer: "Nexfal", domain: "nexfal.com" }) === "https://nexfal.com" && organizerUrlOf({ organizer: "Ask Phill", domain: "nxtcommercesummit.com" }) === "", "a domain counts as the organizer's only when the name and the domain agree");

console.log("\nperformer:");
ok(graphs.every(([e, n]) => Boolean(n.performer) === Boolean(e.performers?.length)), "only where the entry records performers from the event's page");
ok(!graphs.some(([e, n]) => (n.performer || []).some((p) => p.name === e.organizer)), "never the organizer as a stand-in");

console.log("\noffers:");
ok(graphs.every(([e, n]) => !n.offers || (e.tickets && e.at.status !== "past")), "only from recorded tickets, and never for an edition that is over");
const base = { at: { status: "upcoming" }, tickets: { price: 0, currency: "EUR", url: "https://x.test", checked: "2026-10-20" } };
ok(offersOf(base, T)?.price === 0, "a recorded free ticket is an Offer at 0");
ok(!offersOf({ ...base, tickets: { ...base.tickets, checked: "2026-01-01" } }, T), "a price read more than 120 days ago is left out");
ok(!offersOf({ ...base, at: { status: "past" } }, T) && !offersOf({ ...base, tickets: { price: 20, url: "https://x.test", checked: "2026-10-20" } }, T), "a past edition, or a price with no currency, is left out");
ok(!offersOf({ at: { status: "upcoming" } }, T), "and nothing recorded is nothing emitted");

console.log("\nimage:");
ok(graphs.every(([, n]) => Array.isArray(n.image) && /\/og\/event\//.test(n.image[0])), "every Event carries its own card, never the site card");
const e1 = P.find((e) => e.id === "ongefilterd");
ok(eventSharePath(e1) !== eventSharePath({ ...e1, city: "Utrecht" }) && eventSharePath(e1) === eventSharePath({ ...e1, note: "x" }), "the card's URL moves when what it draws moves, and not otherwise");
ok(eventOgFacts(P.find((e) => e.at.mode === "inferred")).when === "Date not confirmed", "an inferred date says so on the card");
const page = fs.readFileSync(join(root, "app/events/[id]/page.js"), "utf8");
ok(/path: eventSharePath\(found\.e\)/.test(page) && /eventGraph\(e, \{ image:/.test(page), "the share image and the schema image are the same card");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
