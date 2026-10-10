#!/usr/bin/env node
/*
 * Invariant H, measured: every text token clears 4.5:1 on every surface it
 * sits on, in both themes.
 *
 *   node scripts/contrast-test.mjs
 *
 * Reads the two palettes out of app/globals.css, so the numbers are the ones
 * the site ships, and computes WCAG contrast. A colour that looks fine on a
 * monitor is not evidence; this is. Text tokens are opaque by design, so no
 * blending is needed; the surfaces they sit on are the page, a panel and a
 * raised fill.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "app/globals.css"), "utf8");

const block = (selector) => {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) throw new Error(`no ${selector} block`);
  const body = css.slice(i, css.indexOf("\n}", i));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
};
const themes = { light: block(":root"), dark: block(':root[data-theme="dark"]') };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = ["c-text", "c-muted", "c-dim", "c-accent-ink", "c-warn-ink", "c-bad-ink", "c-star"];
const SURFACES = ["c-bg", "c-panel", "c-raised"];
let failed = 0;
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n${name}:`);
  const inks = Object.keys(t).filter((k) => k.startsWith("ink-"));
  for (const tok of [...TEXT, ...inks]) {
    if (!t[tok]) { console.log(`  FAIL  --${tok} is not an opaque hex in this theme`); failed++; continue; }
    const worst = SURFACES.map((s) => [s, ratio(t[tok], t[s])]).sort((a, b) => a[1] - b[1])[0];
    const ok = worst[1] >= 4.5;
    if (!ok) failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"}  --${tok.padEnd(14)} ${t[tok]}  worst ${worst[1].toFixed(2)}:1 on --${worst[0]}`);
  }
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
