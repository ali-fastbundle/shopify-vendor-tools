#!/usr/bin/env node
/*
 * Load every /admin tab, empty and populated, and assert each renders.
 *
 *   node scripts/admin-smoke.mjs <adminSessionCookie> [baseUrl]
 *
 * This exists because /admin shipped throwing "ReferenceError: discovery is
 * not defined" and every check before it passed:
 *
 *   next build                 compiles, it is a runtime name
 *   curl /admin (empty store)  200, because Inbox returns early when there is
 *                              nothing waiting and never reaches the broken line
 *
 * The bug only appeared with something in the inbox, on a tab that is not the
 * default. So this posts a suggestion and a report first, then walks all four
 * tabs. A build is not a browser, and a page that renders when there is nothing
 * on it has not been tested.
 *
 * Run it against localhost before shipping a change to components/Admin.jsx.
 */

const COOKIE = process.argv[2];
const BASE = (process.argv[3] || "http://localhost:3000").replace(/\/$/, "");
const TABS = ["", "?tab=catalogue", "?tab=people", "?tab=audience", "?tab=system"];

if (!COOKIE) {
  console.error("usage: node scripts/admin-smoke.mjs <svt_session cookie value> [baseUrl]");
  process.exit(2);
}

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function admin(path) {
  const res = await fetch(`${BASE}/admin${path}`, { headers: { cookie: `svt_session=${COOKIE}` } });
  const body = await res.text();
  return { status: res.status, body };
}

async function walk(when) {
  for (const tab of TABS) {
    const { status, body } = await admin(tab);
    const authed = !body.includes("Not authorised");
    check(status === 200 && authed, `${when}: /admin${tab || " (inbox)"}`,
      status === 200 ? (authed ? "" : "rendered the not-authorised page, is the cookie right?") : `HTTP ${status}`);
  }
}

console.log(`Admin smoke test against ${BASE}\n`);

console.log("empty store, the state a fresh deployment is in:");
await walk("empty");

console.log("\nputting something in the inbox, which is the path that broke:");
await fetch(`${BASE}/api/suggest`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Admin smoke test", url: "https://admin-smoke.invalid", kind: "tool", by: "smoke test" }),
}).catch(() => {});
await fetch(`${BASE}/api/report`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ toolId: "applora", kind: "broken" }),
}).catch(() => {});

await walk("populated");

/* The sections only exist once the inbox has something in it, so their absence
   here means the early return was taken and the walk above proved nothing. */
console.log("\nthe populated inbox really did render its sections:");
const { body } = await admin("");
for (const section of ["Suggestions to review", "Reports and corrections", "Claims to check", "Discovered competitors"]) {
  check(body.includes(section), section);
}

/* The System tab's whole job is answering "is anything broken" above the fold,
   so its strip has to be there whether or not anything is wrong. */
const sys = await admin("?tab=system");
check(sys.body.includes("Status"), "System tab leads with the status strip");
check(/nothing broken|things? to look at/.test(sys.body), "and states a verdict either way");

console.log(`\n${failures ? `${failures} FAILED` : "all tabs render"}`);
process.exit(failures ? 1 : 0);
