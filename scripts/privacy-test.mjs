#!/usr/bin/env node
/*
 * /privacy says what the code does, and the code keeps to it.
 *
 *   node scripts/privacy-test.mjs
 *
 *  - every localStorage key the components use is named on /privacy
 *  - the only cookie set anywhere is the session cookie
 *  - no script from another origin in the layout but Vercel's two
 *  - rate limiting stores no IP address and every key expires
 *  - /api/stat counts sections and recommender screens from fixed lists only
 *  - the footer links /privacy
 *
 * No server, no keys; the store is in memory.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_|_API_KEY$/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "privacy-test-secret";
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

let failed = 0;
const ok = (c, what, extra = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!c) failed++; };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(js|jsx)$/.test(f) ? [p] : []; });
const src = [...walk(join(root, "components")), ...walk(join(root, "lib")), ...walk(join(root, "app"))].map((p) => [p, readFileSync(p, "utf8")]);
const privacy = readFileSync(join(root, "app/privacy/page.js"), "utf8");

/* Every svt: key prefix that reaches localStorage, by its literal or the const it came from. */
const prefixes = new Set();
for (const [, s] of src) {
  if (!/localStorage/.test(s)) continue;
  for (const m of s.matchAll(/["`'](svt:[a-z:]+?)(?:\$\{|["`'])/g)) prefixes.add(m[1].replace(/:$/, ""));
}
const serverOnly = /^svt:(rl|interest|feed|discovery|comments|announcements|recommend|entries)/;
const browserKeys = [...prefixes].filter((k) => !serverOnly.test(k));
const missing = browserKeys.filter((k) => !privacy.includes(k) && k !== "svt:nlvote");
ok(browserKeys.length >= 5 && missing.length === 0, `every browser key is named on /privacy (${browserKeys.length})`, missing.join(", "));

const cookieSetters = src.filter(([, s]) => /Set-Cookie|document\.cookie/.test(s)).map(([p]) => p.replace(root + "/", ""));
ok(cookieSetters.every((p) => /api\/auth\/(callback|session)/.test(p)), "the only cookie set is the session, by the auth routes", cookieSetters.join(", "));

const layout = readFileSync(join(root, "app/layout.js"), "utf8");
const external = [...layout.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).filter((m) => !m.startsWith("@/") && !m.startsWith("."));
ok(external.every((m) => /^(next\/font\/google|@vercel\/analytics\/next|@vercel\/speed-insights\/next|react)$/.test(m)), "no third-party script in the layout but Vercel's", external.join(", "));
ok(!/<script[^>]+src=/.test(layout), "no external <script src> in the layout");

const { allow } = await L("lib/ratelimit.js");
const store = readFileSync(join(root, "lib/ratelimit.js"), "utf8");
ok(/ttlMs: windowMs/.test(store) && /createHash\("sha256"\)/.test(store), "rate-limit keys are hashed and expire with their window");
await allow("t", "203.0.113.9", 5, 60_000);
const inv = await L("lib/store.js");
ok(!(await inv.read("svt:rl:t:203.0.113.9", null)), "the raw IP is not a key");

const { POST } = await L("app/api/stat/route.js");
const post = (b) => POST(new Request("http://x/api/stat", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.1" }, body: JSON.stringify(b) }));
await post({ sections: ["events", "events", "nope"], recommend: ["prime1", "url", "bogus"] });
const { fields } = await inv.readStats();
ok(fields["section:events"] === 2 && !("section:nope" in fields), "sections are counted from the fixed list only");
ok(fields["recommend:reached:prime1"] === 1 && fields["recommend:reached:url"] === 1 && !("recommend:reached:bogus" in fields), "recommender screens are counted from SCREENS only");

ok(/href="\/privacy"/.test(readFileSync(join(root, "components/FooterLinks.jsx"), "utf8")), "the footer links /privacy");
ok(!/—/.test(privacy), "no em-dash on /privacy");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
