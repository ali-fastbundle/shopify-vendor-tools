#!/usr/bin/env node
/*
 * Collect each tool's own mark from its own site (CLAUDE.md, "Logos").
 *
 *   node scripts/collect-logos.mjs              # every published tool without a logo
 *   node scripts/collect-logos.mjs id1 id2      # just these
 *   node scripts/collect-logos.mjs --kind newsletter   # or community: reads
 *     each entry's own url, writes public/logos/newsletters/ or communities/<id>.png, and skips a
 *     page on LinkedIn or Facebook, whose icon is the platform's
 *
 * Reads the vendor's homepage and takes the best declared icon: an
 * apple-touch-icon, a sized <link rel="icon">, the web app manifest's icons,
 * or the logo in its own JSON-LD. Nothing from a third party, never a guess
 * at a path. The file is checked to be an image (sips reads its size), kept
 * only when it is at least 64px on its short side or an SVG, normalised to a
 * PNG of at most 256px, and written to public/logos/<id>.png (or .svg).
 *
 * A tool on a domain another listing shares (Elevate and Orbit on
 * marmeto.com) is skipped: that mark is the parent's, not the product's.
 *
 * Prints JSON of { id: "/logos/<file>" } for what it saved, and why it
 * skipped the rest. It writes no catalogue entry; adding `logo:` is a hand
 * edit, or the one-liner that reads this output.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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
const { TOOLS } = await import(pathToFileURL(join(root, "lib/tools.js")).href);
const argv = process.argv.slice(2);
const kindAt = argv.indexOf("--kind");
const KIND = kindAt >= 0 ? argv.splice(kindAt, 2)[1] : "tool";
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const ENTRIES = KIND === "tool" ? TOOLS
  : (await import(pathToFileURL(join(root, KIND === "newsletter" ? "lib/newsletters.js" : "lib/communities.js")).href))[KIND === "newsletter" ? "NEWSLETTERS" : "COMMUNITIES"]
    .map((e) => ({ ...e, domain: hostOf(e.url), own: true }));
const PLURAL = { newsletter: "newsletters", community: "communities" };
const OUT = KIND === "tool" ? "public/logos" : `public/logos/${PLURAL[KIND]}`;
const PUBLIC = KIND === "tool" ? "/logos" : `/logos/${PLURAL[KIND]}`;
if (KIND !== "tool") (await import("node:fs")).mkdirSync(join(root, OUT), { recursive: true });

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 watchfor.tools logo check";
const want = argv;
const domains = new Map();
for (const t of ENTRIES) domains.set(t.domain, (domains.get(t.domain) || 0) + 1);
const list = ENTRIES.filter((t) => (want.length ? want.includes(t.id) : !t.logo));
const tmp = mkdtempSync(join(tmpdir(), "logos-"));

async function get(url, as = "text") {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: as === "text" ? "text/html,*/*" : "image/*,*/*" }, redirect: "follow", signal: ctl.signal });
    if (!r.ok) return null;
    return as === "text" ? { body: await r.text(), url: r.url } : { body: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "", url: r.url };
  } catch { return null; } finally { clearTimeout(timer); }
}

const attr = (tag, name) => (tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i")) || [])[1] || "";

function candidates(html, base) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = attr(tag, "rel").toLowerCase(); const href = attr(tag, "href");
    if (!href) continue;
    const size = Math.max(0, ...(attr(tag, "sizes").match(/\d+/g) || ["0"]).map(Number));
    if (rel.includes("apple-touch-icon")) out.push({ href, score: 1000 + (size || 180) });
    else if (/\bicon\b/.test(rel)) out.push({ href, score: (/\.svg(\?|$)/i.test(href) ? 900 : 0) + size });
    else if (rel === "manifest") out.push({ manifest: href });
  }
  for (const m of html.matchAll(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"(https?:[^"]+)"/g)) out.push({ href: m[1], score: 700 });
  return out.map((c) => ({ ...c, href: c.href && new URL(c.href, base).href, manifest: c.manifest && new URL(c.manifest, base).href }));
}

function dims(file) {
  try {
    const o = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
    const w = Number((o.match(/pixelWidth: (\d+)/) || [])[1]); const h = Number((o.match(/pixelHeight: (\d+)/) || [])[1]);
    return w && h ? { w, h } : null;
  } catch { return null; }
}

const saved = {}; const skipped = {};
for (const t of list) {
  if (/(^|\.)(linkedin|facebook)\.com$/.test(t.domain)) { skipped[t.id] = "a platform page: its icon is the platform's"; continue; }
  if (domains.get(t.domain) > 1) { skipped[t.id] = `domain ${t.domain} is shared by ${domains.get(t.domain)} listings`; continue; }
  const page = t.own ? await get(t.url) : (await get(`https://${t.domain}/`) || await get(t.url));
  if (!page) { skipped[t.id] = "homepage did not load"; continue; }
  let cands = candidates(page.body, page.url);
  for (const c of cands.filter((c) => c.manifest)) {
    const m = await get(c.manifest);
    try {
      for (const icon of JSON.parse(m?.body || "{}").icons || []) {
        const size = Math.max(0, ...String(icon.sizes || "0").match(/\d+/g).map(Number));
        cands.push({ href: new URL(icon.src, c.manifest).href, score: 800 + size });
      }
    } catch { /* not JSON */ }
  }
  cands = cands.filter((c) => c.href && new URL(c.href).hostname.replace(/^www\./, "").endsWith(t.domain.replace(/^www\./, "").split(".").slice(-2).join(".")) || (c.href && /cdn|cloudfront|website-files|framerusercontent|wixstatic|squarespace|shopify|webflow/.test(c.href)));
  cands.sort((a, b) => b.score - a.score);
  let done = false;
  for (const c of cands) {
    const img = await get(c.href, "bin");
    if (!img || !img.body.length) continue;
    const svg = /svg/.test(img.type) || /^\s*(<\?xml[^>]*>\s*)?<svg/i.test(img.body.slice(0, 200).toString());
    if (svg) {
      const text = img.body.toString();
      if (/<script|on\w+\s*=/i.test(text)) continue;   // never ship a script inside a logo
      writeFileSync(join(root, OUT, `${t.id}.svg`), text);
      saved[t.id] = `${PUBLIC}/${t.id}.svg`; done = true; break;
    }
    if (!/image\//.test(img.type) && !/\.(png|jpe?g|webp|ico)(\?|$)/i.test(c.href)) continue;
    const raw = join(tmp, `${t.id}-raw`); writeFileSync(raw, img.body);
    const d = dims(raw);
    if (!d || Math.min(d.w, d.h) < 64) continue;
    const out = join(root, OUT, `${t.id}.png`);
    try {
      execFileSync("sips", ["-s", "format", "png", "-Z", "256", raw, "--out", out], { stdio: "ignore" });
      saved[t.id] = `${PUBLIC}/${t.id}.png`; done = true; break;
    } catch { continue; }
  }
  if (!done) skipped[t.id] = cands.length ? "no candidate was an image of 64px or more" : "the page declares no icon";
}
console.log(JSON.stringify({ saved, skipped }, null, 1));
