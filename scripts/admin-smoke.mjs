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

/*
 * An admin can edit any listing, and until this could not reach the form from
 * a tool page: /tools/<id> offered "Is this your tool?" to everybody, which is
 * the wrong question for the one person who does not need asking.
 *
 * The page is server rendered per request, so the control it offers depends on
 * the cookie. Checked with a real request rather than by reading the component,
 * because the wiring is the part that breaks: a page that forgets to pass
 * `viewer` renders the vendor pitch to an admin and compiles perfectly.
 *
 * It is an affordance and never a permission. The last check here is the one
 * that matters: /api/listing still refuses a signed-out write.
 */
console.log("\nthe tool page offers the right control to whoever is looking:");
{
  const ID = "appjubilee";
  const page = async (cookie) => {
    const res = await fetch(`${BASE}/tools/${ID}`, cookie ? { headers: { cookie } } : undefined);
    return { status: res.status, body: await res.text() };
  };

  const admin = await page(`svt_session=${COOKIE}`);
  check(admin.status === 200, "admin loads the tool page", `HTTP ${admin.status}`);
  check(admin.body.includes("Editing as admin"), "admin sees the admin state");
  check(admin.body.includes("Edit this listing"), "and gets an edit control");
  check(!admin.body.includes("Is this your tool?"),
    "and is not asked whether it is theirs");
  /* The boundary is stated to the admin too, because it applies to them. */
  check(/hand edit to the catalogue file/.test(admin.body),
    "and is told what the form cannot change");

  const anon = await page("");
  check(anon.status === 200, "a signed-out visitor loads it too", `HTTP ${anon.status}`);
  check(anon.body.includes("Is this your tool?"), "and gets the claim invitation");
  check(!anon.body.includes("Editing as admin"),
    "and never the admin state, which is the leak worth checking for");
  check(!anon.body.includes("Edit this listing"), "nor an edit control");

  /* Nothing admin-only rides along on the personalised render. */
  check(!/svt_session|ADMIN_EMAILS|maillog/.test(admin.body),
    "the admin render leaks no session or config data");

  const write = await fetch(`${BASE}/api/listing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ toolId: ID, edit: { one: "Should not save." } }),
  });
  check(write.status === 401, "and the write route still refuses a signed-out edit",
    `HTTP ${write.status}`);
}

console.log(`\n${failures ? `${failures} FAILED` : "all tabs render"}`);
process.exit(failures ? 1 : 0);
