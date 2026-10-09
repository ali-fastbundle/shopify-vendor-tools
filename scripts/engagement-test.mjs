#!/usr/bin/env node
/*
 * Every section gets the engagement set, the contact form keeps bots out
 * without a captcha, and a location never leaves the browser.
 *
 *   AUTH_SECRET=<the server's secret> node scripts/engagement-test.mjs [baseUrl]
 *
 * Needs a running server started with the same AUTH_SECRET, because it mints
 * a session to post a review and an admin edit. Against a local server only:
 * it writes votes, a review, a report and an override, and sends contact mail.
 * Start the server with ADMIN_EMAILS=admin@example.com for the edit check.
 *
 * The static half needs nothing running: it reads the source to prove the
 * negative claims, that NearbyEvents has no route out, and that the contact
 * address is not in the repository.
 */
import { createHmac } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.AUTH_SECRET;

let failed = 0;
const ok = (cond, what, extra = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`);
  if (!cond) failed++;
};
const sign = (p) => {
  const b = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`;
};
const session = (email) => `svt_session=${sign({ t: "session", email, exp: Date.now() + 3600e3 })}`;
const post = (path, body, cookie) => fetch(`${BASE}${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

/* ---------------- static: nothing a location could leave by ---------------- */
console.log("\nlocation stays in the browser:");
const nearby = readFileSync(join(root, "components/NearbyEvents.jsx"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
ok(!/\bfetch\s*\(|sendBeacon|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/.test(nearby),
  "NearbyEvents has no fetch, beacon, storage or cookie");
ok(/onClick=\{locate\}/.test(nearby) && !/useEffect/.test(nearby),
  "getCurrentPosition is reached only from the button, never from an effect on load");

console.log("\nevery section's cards open as a whole and carry votes:");
const read = (f) => readFileSync(join(root, f), "utf8");
for (const [file, what] of [["components/Directory.jsx", "tool cards"], ["components/Newsletters.jsx", "newsletter cards"], ["components/EventParts.jsx", "event rows"]]) {
  const src = read(file);
  ok(/className="card-link"/.test(src) && /className="card[\s"]/.test(src), `${what} use .card and .card-link`);
}
ok(/CardVotes/.test(read("components/Newsletters.jsx")) && /CardVotes/.test(read("components/EventParts.jsx")), "newsletter and event cards carry CardVotes");
ok(/\.card-link::after/.test(read("app/globals.css")) && /\.card :is\(a, button/.test(read("app/globals.css")), "the overlay and the raised controls are defined once, in globals.css");
ok(!/function Vote\(/.test(read("components/Directory.jsx")) && !/function VoteButton/.test(read("components/Engagement.jsx")), "there is one vote button, components/Vote.jsx");

console.log("\nthe contact address is not in the repository:");
const walk = (d) => readdirSync(d).flatMap((f) => {
  if (["node_modules", ".next", ".git", "brag-output"].includes(f)) return [];
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const hits = walk(root).filter((p) => /\.(js|jsx|mjs|md|json)$/.test(p) && !p.endsWith("engagement-test.mjs"))
  .filter((p) => /arabzadeh67/i.test(readFileSync(p, "utf8")));
ok(hits.length === 0, "no file names the contact inbox", hits.join(", "));

if (!SECRET) {
  console.log("\nAUTH_SECRET not set, skipping the live checks.");
  process.exit(failed ? 1 : 0);
}

/* ---------------- live: events and newsletters take the full set ---------------- */
const reviewer = session("engagement-test@example.com");
const admin = session("admin@example.com");
const ev = "web-summit";

console.log("\nevents take the full set:");
ok((await post("/api/vote", { id: ev, previous: 0, next: 1 })).status === 200, "an event can be liked");
ok((await post("/api/vote", { id: "dotdigital-summit", previous: 0, next: 1 })).status === 400, "a drafted event cannot");
ok((await post("/api/review", { id: ev, rating: 4 })).status === 401, "reviewing an event needs an account");
ok((await post("/api/review", { id: ev, rating: 4, text: "Worth it for the partner floor." }, reviewer)).status === 200,
  "a signed-in review of an event is stored");
ok((await post("/api/report", { toolId: ev, kind: "date", value: "Moved a week later" })).status === 200,
  "an event takes a wrong-date report");
ok((await post("/api/report", { toolId: ev, kind: "pricing", value: "x" })).status === 400,
  "but not a pricing report, which is for tools");
const claim = await post("/api/claim", { toolId: "shopify-unite", action: "start" }, reviewer);
ok(claim.status === 400, "an event with no domain of its own cannot be claimed", await claim.text());

console.log("\nnewsletters, which used to 500 after storing a review:");
const nl = await post("/api/review", { id: "shopifyappfounders", rating: 5, text: "Useful every week." }, reviewer);
ok(nl.status === 200, "a newsletter review answers 200", `HTTP ${nl.status}`);

console.log("\nan event owner edits the description, never the facts:");
const edit = await post("/api/listing", {
  toolId: ev, edit: { one: "Edited by the engagement test.", watch: "No downsides!", startDate: "2030-01-01", city: "Nowhere", price: "$1" },
}, admin);
if (edit.status === 403) {
  console.log("  skip  admin edit (start the server with ADMIN_EMAILS=admin@example.com)");
} else {
  const e = (await edit.json()).tools.find((t) => t.id === ev);
  ok(e.one === "Edited by the engagement test.", "the summary changed");
  ok(!/No downsides/.test(e.watch) && e.startDate !== "2030-01-01" && e.city !== "Nowhere" && !e.price,
    "watch, dates, city and an invented price did not");
}

/* ---------------- live: the contact form ---------------- */
console.log("\nthe contact form:");
const html = await (await fetch(`${BASE}/contact`)).text();
ok(!/arabzadeh67|mailto:/i.test(html), "the page carries no address and no mailto");
const token = (html.match(/token\\?":\\?"([^"\\]+)/) || [])[1];
ok(Boolean(token), "the form carries a signed render time");
const body = (extra) => ({ name: "Test", email: "sender@example.org", message: "A real message, long enough.", token, ...extra });
const quiet = async (b) => { const r = await post("/api/contact", b); return [r.status, await r.text()]; };
const [hpS, hpB] = await quiet(body({ company: "Acme" }));
ok(hpS === 200 && /"ok":true/.test(hpB), "a filled honeypot gets the same answer as success");
const [fastS] = await quiet(body());
ok(fastS === 200, "so does a submit faster than anybody types");
ok((await post("/api/contact", body({ token: "made.up" }))).status === 400, "a token we did not sign is refused");
await new Promise((r) => setTimeout(r, 3200));
ok((await post("/api/contact", body({ email: "nope" }))).status === 400, "a bad address is refused");
const real = await post("/api/contact", body());
ok(real.status === 200, "a real message after a few seconds is sent",
  real.status === 429 ? "429: five an hour per IP, already spent by an earlier run; restart the dev server" : `HTTP ${real.status}`);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
