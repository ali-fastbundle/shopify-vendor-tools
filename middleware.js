import { NextResponse } from "next/server";

/*
 * Markdown versions of the content pages (lib/markdown.js): any path ending in
 * .md is served by app/md/[[...path]]/route.js. `/index.md` is the home page.
 * A rewrite, so the address stays the .md one and an agent can read the rule
 * once (llms.txt) and apply it to any page it is on.
 *
 * Runs on .md paths only (the matcher), so nothing else pays for it.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.endsWith(".md") || pathname.startsWith("/md/")) return NextResponse.next();
  const bare = pathname.slice(0, -3);
  const url = request.nextUrl.clone();
  url.pathname = `/md${bare === "/index" ? "" : bare}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!_next/|api/|md/).*\\.md)"] };
