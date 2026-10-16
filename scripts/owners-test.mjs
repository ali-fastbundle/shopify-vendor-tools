#!/usr/bin/env node
/*
 * Owners: a structured reference on every entry, a page per shared owner, the
 * siblings on each listing, and the monitor writing to the same field.
 *
 *   node scripts/owners-test.mjs
 *
 * Shims lib/ into a temp directory, in-memory store, no server and no keys.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
process.env.AUTH_SECRET = "owners-secret";
const dir = mkdtempSync(join(tmpdir(), "svt-owners-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const { ALL_TOOLS, TOOLS, ownerOf } = await load("lib/tools.js");
const { ALL_NEWSLETTERS } = await load("lib/newsletters.js");
const { ALL_EVENTS } = await load("lib/events.js");
const O = await load("lib/owners.js");
const X = await load("lib/ownerIndex.js");
const seo = await load("lib/seo.js");
const listings = await load("lib/listings.js");
const monitor = await load("lib/monitor.js");
const store = await load("lib/store.js");
const { voiceIssues } = await load("lib/voice.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");

console.log("the reference:");
const all = [...ALL_TOOLS, ...ALL_NEWSLETTERS, ...ALL_EVENTS];
const refs = all.filter((e) => e.ownership);
ok(refs.every((e) => O.ownerById(e.ownership.id)), "every ownership id is in lib/owners.js",
  refs.filter((e) => !O.ownerById(e.ownership.id)).map((e) => e.id).join(", "));
ok(refs.every((e) => typeof e.ownership.name === "string" && e.ownership.name), "and carries a display name");
ok(new Set(O.OWNERS.map((o) => o.id)).size === O.OWNERS.length, "owner ids are unique");
ok(O.OWNERS.every((o) => refs.some((e) => e.ownership.id === o.id)), "no owner is listed with nothing pointing at it");
for (const o of O.OWNERS.filter((x) => x.notes)) {
  const v = voiceIssues(o.notes);
  ok(!v.emDash && !v.semicolons && !v.marketing.length, `${o.name}: notes pass the voice checks`);
}

console.log("\nthe groups named in the request:");
const group = (id) => X.entriesOf(id).map((m) => m.id).sort().join(",");
ok(group("dark-ecommerce-labs") === "appjubilee,storecensus", "Dark Ecommerce Labs: AppJubilee, StoreCensus");
ok(group("marmeto") === "elevate,marmeto,orbit", "Marmeto: Elevate, Orbit, Marmeto");
ok(group("mantle") === "mantle,sasi", "Mantle: Mantle, SASI (App Store Analytics is not a listing)");
ok(group("thesaashub") === "partnerdock,shopifyappfounders", "TheSaaSHub: PartnerDock, Shopify App Founders Edition");
ok(group("shopexperts") === "appstoreresearch,shopexperts,shopops", "ShopExperts: App Store Research, ShopExperts, ShopOps Weekly");
ok(X.entriesOf("idube").length === 0, "a draft's owner has no published entries, so no page");

console.log("\npages:");
const pages = X.ownersWithPages();
ok(pages.every((o) => o.entries.length >= 2), "only owners with two or more entries get a page", pages.map((o) => `${o.id}:${o.entries.length}`).join(" "));
ok(!X.hasOwnerPage("craftshift"), "a one-listing owner has no page");
ok(pages.every((o) => o.entries.every((m) => TOOLS.some((t) => t.id === m.id) || ALL_NEWSLETTERS.some((n) => n.id === m.id && !n.draft) || ALL_EVENTS.some((e) => e.id === m.id && !e.draft))),
  "every entry on a page is published");
{
  const g = seo.ownerGraph(pages.find((o) => o.id === "mantle"), X.entriesOf("mantle"));
  const org = g["@graph"].find((n) => n["@type"] === "Organization");
  ok(org && org["@id"].endsWith("/owners/mantle#owner") && org.sameAs?.[0] === "https://heymantle.com", "the page has an Organization node with sameAs");
  const person = seo.ownerGraph(pages.find((o) => o.id === "beckett-oliphant"), X.entriesOf("beckett-oliphant"))["@graph"][0];
  ok(person["@type"] === "Person", "and a person is a Person, not an Organization");
}
ok(/ownersWithPages/.test(src("app/sitemap.js")), "the sitemap lists them");

console.log("\non a listing:");
{
  const sc = X.ownerContext(TOOLS.find((t) => t.id === "storecensus"), "tool");
  ok(sc.line === "by Dark Ecommerce Labs" && sc.href === "/owners/dark-ecommerce-labs", "StoreCensus: by Dark Ecommerce Labs, linked");
  ok(sc.siblings.map((s) => s.name).join() === "AppJubilee", "Also from: AppJubilee");
  const mm = X.ownerContext(TOOLS.find((t) => t.id === "marmeto"), "tool");
  ok(mm.line === "" && mm.siblings.map((s) => s.name).sort().join() === "Elevate,Orbit", "Marmeto names nothing as its owner and still lists Elevate and Orbit");
  ok(ownerOf(TOOLS.find((t) => t.id === "shopexperts")) === "", "ownerOf never prints an entry as its own owner");
  const ase = X.ownerContext(TOOLS.find((t) => t.id === "appstoreresearch"), "tool");
  ok(ase.siblings.some((s) => s.href === "/newsletters/shopops"), "siblings cross kinds: App Store Research lists ShopOps Weekly");
  const rb = X.ownerContext(TOOLS.find((t) => t.id === "rankbase"), "tool");
  const sasiCtx = X.ownerContext(TOOLS.find((t) => t.id === "sasi"), "tool");
  ok(sasiCtx.siblings.map((s) => s.name).join() === "the Mantle listing", "the owner's own product is named as its listing, not repeated", sasiCtx.siblings.map((s) => s.name).join());
  ok(rb.line === "by Craftshift" && rb.href === "" && rb.siblings.length === 0, "a one-listing owner is plain text with no siblings");
  const ev = X.ownerContext(ALL_EVENTS.find((e) => e.id === "shoptalk-us"), "event");
  ok(ev.line === "organized by Shoptalk (Hyve Group)" && ev.siblings.length === 2, "events say organized by and list the other editions");
  const sasi = TOOLS.find((t) => t.id === "sasi");
  ok(O.ownershipLine(sasi) === "acquired by Mantle" && seo.relationOf({ ...X.entriesOf("mantle").find((m) => m.id === "sasi") }, O.ownerById("mantle")) === "Acquired from Union Works.",
    "the relationship is stated plainly");
  ok(!/<OwnerFact|<AlsoFrom/.test(src("components/Directory.jsx").split("function DetailModal")[0].split("function Card")[1] || ""), "not on the card (rule J)");
}

console.log("\nthe monitor and the override:");
{
  const aj = TOOLS.find((t) => t.id === "appjubilee");
  const raw = { changes: [
    { kind: "ownership", what: "Now owned by a new parent.", old: "Dark Ecommerce Labs, LLC", new: "Acme Holdings Inc", confidence: 0.9,
      editListing: true, edit: { field: "owner", from: "Dark Ecommerce Labs, LLC", to: "Acme Holdings Inc" } },
    { kind: "ownership", what: "Owned by AppJubilee.", old: "Dark Ecommerce Labs, LLC", new: "AppJubilee", confidence: 0.9,
      editListing: true, edit: { field: "owner", from: "", to: "AppJubilee" } },
  ] };
  const kept = monitor.cleanChanges(raw, aj);
  ok(kept.length === 1 && kept[0].edit.field === "ownership" && kept[0].edit.state === "appliable", "an owner proposal becomes an appliable ownership edit", JSON.stringify(kept.map((c) => c.edit)));
  ok(!kept.some((c) => c.new === "AppJubilee"), "one naming the tool itself is suppressed");
  ok(listings.APPLIABLE.includes("ownership") && !listings.APPLIABLE.includes("owner") && !listings.EDITABLE.includes("ownership"), "ownership is appliable by an admin, never editable by a vendor");

  const r = await listings.applyFieldEdit("appjubilee", "owner", "Dark Ecommerce Labs");
  let merged = (await listings.mergedTools()).find((t) => t.id === "appjubilee");
  ok(!r.error && merged.ownership.id === "dark-ecommerce-labs", "applying a name writes the reference to a known owner", JSON.stringify(merged.ownership));
  ok((await listings.applyFieldEdit("appjubilee", "ownership", "AppJubilee")).error, "applying the tool's own name is refused");
  await listings.undoFieldEdit("appjubilee", "owner", r.previous);
  ok(!((await store.read("svt:overrides", {})).appjubilee || {}).ownership, "undo removes what apply wrote");

  await store.write("svt:overrides", { storecensus: { owner: "Acme Holdings Inc" } });
  merged = (await listings.mergedTools()).find((t) => t.id === "storecensus");
  ok(merged.ownership.name === "Acme Holdings Inc" && merged.ownership.id === "" && !("owner" in merged), "a legacy free-text override still reads, as a name with no page");
  await store.write("svt:overrides", { storecensus: { ownership: { id: "", name: "StoreCensus" } } });
  merged = (await listings.mergedTools()).find((t) => t.id === "storecensus");
  ok(merged.ownership.id === "dark-ecommerce-labs", "a vacuous override is dropped and the file's owner shows");
  await store.write("svt:overrides", {});
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
