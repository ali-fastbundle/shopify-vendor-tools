#!/usr/bin/env node
/*
 * Check the JSON-LD on a running server against the rules Google's Rich
 * Results Test enforces for the types we emit.
 *
 *   node scripts/validate-jsonld.mjs [baseUrl]
 *
 * This is not a substitute for the Rich Results Test, which is the only thing
 * that can say what Google will actually do. It catches the errors that tool
 * reports, so a run of this before deploying means the paste into Google is a
 * confirmation rather than a discovery.
 */
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
let errors = 0, warnings = 0;
const err = (m) => { console.log(`  ERROR    ${m}`); errors++; };
const warn = (m) => { console.log(`  warn     ${m}`); warnings++; };
const ok = (m) => console.log(`  ok       ${m}`);

async function graphOf(path) {
  const html = await (await fetch(BASE + path)).text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { err(`${path}: no JSON-LD at all`); return []; }
  const out = [];
  for (const b of blocks) {
    try { out.push(JSON.parse(b[1])); }
    catch (e) { err(`${path}: JSON-LD does not parse — ${e.message}`); }
  }
  return out;
}

const nodes = (doc) => (doc["@graph"] || [doc]);

function checkOffer(o, where) {
  if (!o) return;
  const t = o["@type"];
  if (t === "Offer") {
    if (o.price === undefined || o.price === null || o.price === "") {
      err(`${where}: Offer without a price. Google requires price or priceSpecification.`);
    }
    if (!o.priceCurrency) err(`${where}: Offer without priceCurrency`);
  } else if (t === "AggregateOffer") {
    if (o.lowPrice === undefined) err(`${where}: AggregateOffer without lowPrice`);
    if (!o.priceCurrency) err(`${where}: AggregateOffer without priceCurrency`);
  } else {
    err(`${where}: offers has unexpected @type ${t}`);
  }
}

function checkRating(r, where) {
  if (!r) return;
  const count = Number(r.ratingCount);
  const value = Number(r.ratingValue);
  if (!Number.isFinite(count) || count < 1) {
    err(`${where}: aggregateRating with ratingCount ${r.ratingCount}. Must be a positive integer.`);
  }
  if (!Number.isFinite(value) || value <= 0) err(`${where}: aggregateRating with ratingValue ${r.ratingValue}`);
  if (Number.isFinite(value) && (value < 1 || value > 5)) err(`${where}: ratingValue ${value} outside 1..5`);
  if (r.bestRating === undefined) warn(`${where}: aggregateRating without bestRating`);
}

function checkSoftware(a, where) {
  if (!a.name) err(`${where}: SoftwareApplication without a name`);
  if (!a.applicationCategory) err(`${where}: ${a.name} has no applicationCategory`);
  if (!a.description) warn(`${where}: ${a.name} has no description`);
  if (!a.offers && !a.aggregateRating) {
    warn(`${where}: ${a.name} has neither offers nor aggregateRating, so it is not rich-result eligible`);
  }
  checkOffer(a.offers, `${where} ${a.name}`);
  checkRating(a.aggregateRating, `${where} ${a.name}`);
}

console.log(`Validating JSON-LD on ${BASE}\n`);

console.log("homepage:");
for (const doc of await graphOf("/")) {
  const ns = nodes(doc);
  const types = ns.map((n) => n["@type"]);
  for (const need of ["Person", "Organization", "WebSite", "CollectionPage"]) {
    types.includes(need) ? ok(`has ${need}`) : err(`homepage missing ${need}`);
  }
  const page = ns.find((n) => n["@type"] === "CollectionPage");
  const list = page?.mainEntity;
  if (!list || list["@type"] !== "ItemList") err("CollectionPage has no ItemList");
  else {
    ok(`ItemList with ${list.itemListElement.length} items`);
    if (list.numberOfItems !== list.itemListElement.length) err("numberOfItems disagrees with the list length");
    let rated = 0;
    for (const li of list.itemListElement) {
      if (li["@type"] !== "ListItem") err("list element is not a ListItem");
      if (typeof li.position !== "number") err("ListItem without a position");
      const app = li.item;
      if (app?.["@type"] !== "SoftwareApplication") err(`position ${li.position}: item is not a SoftwareApplication`);
      else { checkSoftware(app, "home"); if (app.aggregateRating) rated++; }
    }
    ok(`${rated} of ${list.itemListElement.length} carry an aggregateRating (only where reviews exist)`);
  }
  const person = ns.find((n) => n["@type"] === "Person");
  person?.url ? ok(`Person links to ${person.url}`) : err("Person has no url");
}

console.log("\ntool page (/tools/appstoreresearch):");
for (const doc of await graphOf("/tools/appstoreresearch")) {
  const ns = nodes(doc);
  const app = ns.find((n) => n["@type"] === "SoftwareApplication");
  app ? checkSoftware(app, "tool") : err("tool page has no SoftwareApplication");
  const page = ns.find((n) => n["@type"] === "WebPage");
  page ? ok("has WebPage") : err("tool page has no WebPage");
  const bc = page?.breadcrumb;
  if (bc?.["@type"] !== "BreadcrumbList") err("no BreadcrumbList");
  else ok(`BreadcrumbList with ${bc.itemListElement.length} levels`);
}

/*
 * Category pages, which emit the same SoftwareApplication nodes inside their
 * own CollectionPage. Checked because the graph builder is shared: a change
 * that made a tool page emit a priceless Offer would make nine category pages
 * emit one each, which is the multiplier worth catching before Google does.
 */
console.log("\ncategory page (/categories/biz):");
for (const doc of await graphOf("/categories/biz")) {
  const ns = nodes(doc);
  const page = ns.find((n) => n["@type"] === "CollectionPage");
  if (!page) { err("category page has no CollectionPage"); continue; }
  ok("has CollectionPage");
  page.url?.endsWith("/categories/biz") ? ok(`url is ${page.url}`) : err(`url is ${page.url}`);
  page.description ? ok("has its own description") : err("no description");
  const bc = page.breadcrumb;
  if (bc?.["@type"] !== "BreadcrumbList") err("no BreadcrumbList");
  else if (bc.itemListElement.length !== 3) err(`breadcrumb has ${bc.itemListElement.length} levels, expected 3`);
  else ok("BreadcrumbList with 3 levels");
  const list = page.mainEntity;
  if (list?.["@type"] !== "ItemList") err("CollectionPage has no ItemList");
  else {
    ok(`ItemList with ${list.itemListElement.length} items`);
    if (list.numberOfItems !== list.itemListElement.length) err("numberOfItems disagrees with the list length");
    for (const li of list.itemListElement) {
      if (typeof li.position !== "number") err("ListItem without a position");
      const app = li.item;
      if (app?.["@type"] !== "SoftwareApplication") err(`position ${li.position}: item is not a SoftwareApplication`);
      else checkSoftware(app, "category");
    }
  }
}

console.log("\ncategory index (/categories):");
for (const doc of await graphOf("/categories")) {
  const ns = nodes(doc);
  const page = ns.find((n) => n["@type"] === "CollectionPage");
  if (!page) { err("category index has no CollectionPage"); continue; }
  ok("has CollectionPage");
  const list = page.mainEntity;
  if (list?.["@type"] !== "ItemList") err("no ItemList");
  else {
    ok(`ItemList with ${list.itemListElement.length} categories`);
    if (list.numberOfItems !== list.itemListElement.length) err("numberOfItems disagrees with the list length");
    for (const li of list.itemListElement) {
      if (!li.url) err(`${li.name}: no url`);
      else if (!/\/categories\/[a-z]+$/.test(li.url)) err(`${li.name}: url is ${li.url}`);
      if (!li.name) err("a category has no name");
    }
    ok("every category names a page");
  }
}

console.log(`\n${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
