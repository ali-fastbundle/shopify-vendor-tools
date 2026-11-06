#!/usr/bin/env node
/*
 * A dated screenshot of each tool's own page, taken by the directory
 * (2026-11-06). Not vendor media (invariant 51): this is our record of what
 * the vendor's page showed on a day, labelled as ours with the date, and kept
 * in the repository rather than hotlinked.
 *
 *   SCREENS_PUPPETEER=/path/to/node_modules/puppeteer-core node scripts/capture-screens.mjs [id ...]
 *
 * puppeteer-core is not a dependency of the site; point SCREENS_PUPPETEER at
 * any install of it (the Hallmark linter's works). Chrome is the system one.
 *
 * 1280x800, the top of the page only, WebP at quality 70. Cookie and consent
 * banners are hidden with CSS, never clicked, so nothing is accepted on our
 * behalf. A page that fails to load, answers with a challenge, or renders
 * almost nothing is skipped and reported. Writes public/screens/<id>.webp and
 * rewrites lib/toolScreens.js, the manifest of what exists and when it was
 * taken, which is what the pages read.
 */
import { register, createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";

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
let SCREENS = {};
try { SCREENS = (await import(pathToFileURL(join(root, "lib/toolScreens.js")).href)).SCREENS || {}; } catch { /* first run */ }

const pp = process.env.SCREENS_PUPPETEER;
if (!pp) { console.error("Set SCREENS_PUPPETEER to a puppeteer-core install."); process.exit(2); }
const puppeteer = createRequire(join(pp, "package.json"))(pp);
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

const want = process.argv.slice(2);
const list = TOOLS.filter((t) => !want.length || want.includes(t.id)).filter((t) => !t.dying);
const today = new Date().toISOString().slice(0, 10);
mkdirSync(join(root, "public/screens"), { recursive: true });

const HIDE = `
  [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i],
  [id*="gdpr" i], [class*="gdpr" i], #onetrust-banner-sdk, #onetrust-consent-sdk,
  .cky-consent-container, #CybotCookiebotDialog, .cc-window, .termly-styles-root,
  [aria-label*="cookie" i], [id*="intercom" i], [class*="intercom" i], #crisp-chatbox,
  [id*="hubspot-messages" i], .drift-frame-controller, [id*="chat-widget" i]
  { display: none !important; visibility: hidden !important; }
  html, body { overflow: hidden !important; }`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
const report = { taken: [], skipped: {} };
for (const t of list) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36");
    const res = await page.goto(t.url, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => null);
    if (!res || res.status() >= 400) { report.skipped[t.id] = `HTTP ${res ? res.status() : "no response"}`; continue; }
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));
    /* A pop-up that opened after load (a report offer, a privacy modal):
       Escape first, then hide any fixed layer covering a third of the screen
       and the dimming behind it. Hidden, never clicked. */
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => {
      const area = innerWidth * innerHeight;
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") continue;
        const r = el.getBoundingClientRect();
        if (r.top < 120 && r.height < 140) continue;          // a site header
        if (r.width * r.height > area / 3) el.style.setProperty("display", "none", "important");
      }
      document.documentElement.style.overflow = "auto"; document.body.style.overflow = "auto";
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
    const text = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
    const title = await page.title();
    if (text < 120 || /just a moment|attention required|access denied|verify you are human/i.test(title)) {
      report.skipped[t.id] = `challenge or empty page (${text} chars, "${title}")`; continue;
    }
    const file = join(root, "public/screens", `${t.id}.webp`);
    await page.screenshot({ path: file, type: "webp", quality: 70, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    if (statSync(file).size < 8000) { report.skipped[t.id] = "screenshot is nearly blank"; continue; }
    SCREENS[t.id] = { src: `/screens/${t.id}.webp`, taken: today, page: t.url };
    report.taken.push(t.id);
  } catch (e) {
    report.skipped[t.id] = String(e.message || e).slice(0, 80);
  } finally {
    await page.close().catch(() => {});
  }
}
await browser.close();

const ids = Object.keys(SCREENS).sort();
writeFileSync(join(root, "lib/toolScreens.js"), `/*
 * Which tools have a screenshot of their own page, taken by the directory,
 * and when. Written by scripts/capture-screens.mjs; edit by rerunning it.
 * The pages show each one as "Its homepage on <date>, taken by the
 * directory", never as the vendor's own material (that is lib/media.js).
 * Pure and client-safe.
 */
export const SCREENS = {
${ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(SCREENS[id])},`).join("\n")}
};

export const screenOf = (id) => SCREENS[id] || null;
`);
console.log(JSON.stringify(report, null, 1));
